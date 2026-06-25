import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { SWIM_COURSE_TOTAL_SESSIONS } from "./pricing";
import { phoneVariants } from "./helpers";

const REGION = "asia-southeast1";
const db = () => admin.firestore();
const TTL_MS = 30_000; // QR đổi mỗi 30s

// v2.4 (E1) — Tra uid khách theo SĐT.
// v2.4.1: nếu Auth có user nhưng Firestore không có → auto-create doc placeholder
// (đồng bộ với searchCustomerByPhone). Trả uid để check-in tiếp tục.
async function findUserUidByPhone(phone: string): Promise<string> {
  const variants = phoneVariants(phone);
  if (!variants)
    throw new HttpsError("invalid-argument", "SĐT không hợp lệ. Nhập 10 số bắt đầu bằng 0.");
  const q = await db()
    .collection("users")
    .where("phone", "in", [variants.raw, variants.local, variants.e164])
    .limit(1)
    .get();
  if (!q.empty) return q.docs[0].id;

  let authUser: admin.auth.UserRecord;
  try {
    authUser = await admin.auth().getUserByPhoneNumber(variants.e164);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "auth/user-not-found")
      throw new HttpsError(
        "not-found",
        "not-found: Khách chưa từng đăng ký với SĐT này. Yêu cầu khách mở app + đăng nhập 1 lần trước.",
      );
    throw new HttpsError("internal", `Lỗi tra Firebase Auth: ${(e as Error).message}`);
  }

  // Auto-create placeholder doc
  await db()
    .doc(`users/${authUser.uid}`)
    .set(
      {
        phone: variants.e164,
        fullName: authUser.displayName ?? "",
        role: "CUSTOMER",
        fcmTokens: [],
        disabled: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _synced: true,
      },
      { merge: true },
    );
  return authUser.uid;
}

// ===== Tablet cổng: phát QR mới mỗi 30s =====
export const issueQrToken = onCall({ region: REGION }, async (req) => {
  const role = req.auth?.token?.role;
  if (!["OWNER", "RECEPTIONIST"].includes(role))
    throw new HttpsError("permission-denied", "Chỉ thiết bị quầy được phát QR");
  const nonce = crypto.randomBytes(16).toString("hex");
  const now = admin.firestore.Timestamp.now();
  const exp = admin.firestore.Timestamp.fromMillis(now.toMillis() + TTL_MS);
  const ref = db().collection("qrTokens").doc();
  await ref.set({ id: ref.id, nonce, issuedAt: now, expiresAt: exp, used: false });
  return { token: `${ref.id}:${nonce}`, expiresAt: exp.toMillis() };
});

// ===== Khách quét QR =====
// data: { qrPayload: "tokenId:nonce", beneficiaryId?, groupSize?, adultsInGroup? }
export const checkinByQr = onCall({ region: REGION }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  const d = req.data as any;
  const [tokenId, nonce] = String(d.qrPayload).split(":");
  const tokenRef = db().doc(`qrTokens/${tokenId}`);

  const result = await db().runTransaction(async (tx) => {
    const tok = await tx.get(tokenRef);
    if (!tok.exists) throw new HttpsError("invalid-argument", "QR không hợp lệ");
    const t = tok.data()!;
    if (t.used) throw new HttpsError("failed-precondition", "QR đã được dùng");
    if (t.nonce !== nonce) throw new HttpsError("invalid-argument", "QR không khớp");
    if (t.expiresAt.toMillis() < Date.now())
      throw new HttpsError("deadline-exceeded", "QR đã hết hạn, vui lòng quét lại");
    return await resolveCheckin(tx, req.auth!.uid, d, tokenId, tokenRef);
  });
  await afterCheckin(result);
  return result;
});

// ===== Lễ tân điểm danh hộ qua SĐT phụ huynh =====
// v2.3 (D9): mở rộng cho vé lượt + chọn số lượt cụ thể.
// data: {
//   phone: string,
//   beneficiaryId?: string,                  // childId nếu điểm danh hộ con
//   groupSize?: number,                      // số người (với PACKAGE)
//   adultsInGroup?: number,
//   forceKind?: "COURSE"|"PACKAGE"|"MEMBERSHIP",  // skip auto-resolve nếu set
// }
export const staffCheckinByPhone = onCall({ region: REGION }, async (req) => {
  const role = req.auth?.token?.role;
  if (!["OWNER", "RECEPTIONIST"].includes(role))
    throw new HttpsError("permission-denied", "Không đủ quyền");
  const d = req.data as any;
  // v2.4 (E1) — dùng helper chung; throw rõ ràng nếu Auth có nhưng Firestore không.
  const parentId = await findUserUidByPhone(String(d.phone ?? ""));
  const result = await db().runTransaction(async (tx) =>
    resolveCheckin(tx, parentId, d, "staff-manual", null));
  await afterCheckin(result);
  return result;
});

type CheckinResult = {
  ok: boolean; kind: string; message: string;
  notify?: { uid: string; title: string; body: string; type?: string };
};

// Ưu tiên: COURSE (đúng ca giờ này) → PACKAGE → MEMBERSHIP
// v2.3 (D9): nếu `forceKind` truyền vào → bỏ qua các kind khác, chỉ thử kind đó.
async function resolveCheckin(
  tx: FirebaseFirestore.Transaction,
  userId: string,
  d: any,
  qrTokenId: string,
  tokenRef: FirebaseFirestore.DocumentReference | null
): Promise<CheckinResult> {
  const subjectId = d.beneficiaryId ?? userId;
  const now = new Date();
  const weekday = now.getDay();
  const groupSize = Math.max(1, Number(d.groupSize ?? 1));
  const adultsInGroup = Number(d.adultsInGroup ?? 0);
  const forceKind: string | undefined = d.forceKind;
  const targetId: string | undefined = d.targetId;
  const skip = (kind: string) => forceKind && forceKind !== kind;

  // Helper: tạo notify khi staff check-in hộ (tokenRef === null)
  const isStaffSource = tokenRef === null;

  // v2.4 (E2/INV-17) — Khách chọn thẻ cụ thể: dùng targetId, skip auto-search.
  // v2.4.2: thêm nhánh PACKAGE + notify cho mọi staff check-in hộ.
  if (targetId && forceKind === "PACKAGE") {
    const pRef = db().doc(`ticketPackages/${targetId}`);
    const pDoc = await tx.get(pRef);
    if (!pDoc.exists) throw new HttpsError("not-found", "Vé lượt không tồn tại");
    const p = pDoc.data()!;
    if (p.status !== "ACTIVE")
      throw new HttpsError("failed-precondition", "Vé không còn hoạt động");
    if (p.userId !== userId)
      throw new HttpsError("permission-denied", "Vé này không phải của khách");
    const isChildCard =
      p.audience === "CHILD_UNDER_140" || p.audience === "CHILD_OVER_140";
    if (isChildCard && adultsInGroup > 0)
      throw new HttpsError(
        "failed-precondition",
        "Thẻ trẻ em không dùng cho người lớn. Người lớn vui lòng mua vé lẻ tại quầy.",
      );
    if ((p.remainingSessions ?? 0) < groupSize)
      throw new HttpsError(
        "resource-exhausted",
        `Vé chỉ còn ${p.remainingSessions} lượt, không đủ cho ${groupSize} người`,
      );
    const remaining = (p.remainingSessions ?? 0) - groupSize;
    const cid = db().collection("checkins").doc().id;
    tx.update(pRef, {
      remainingSessions: remaining,
      status: remaining <= 0 ? "DEPLETED" : "ACTIVE",
      usageHistory: admin.firestore.FieldValue.arrayUnion({
        at: admin.firestore.Timestamp.now(),
        count: groupSize,
        checkinId: cid,
      }),
    });
    writeCheckin(tx, userId, d.beneficiaryId, "PACKAGE", pDoc.id, qrTokenId, groupSize, tokenRef, cid);
    return {
      ok: true,
      kind: "PACKAGE",
      message: `Đã trừ ${groupSize} lượt · còn ${remaining} lượt`,
      notify: isStaffSource
        ? {
            uid: userId,
            title: "Lễ tân đã điểm danh hộ bạn ✓",
            body: `Trừ ${groupSize} lượt từ vé MS${p.memberCode ?? ""} · còn ${remaining}/${p.totalSessions} lượt.`,
          }
        : undefined,
    };
  }

  if (targetId && forceKind === "COURSE") {
    const eRef = db().doc(`enrollments/${targetId}`);
    const eDoc = await tx.get(eRef);
    if (!eDoc.exists) throw new HttpsError("not-found", "Khóa học không tồn tại");
    const e = eDoc.data()!;
    if (e.status !== "ACTIVE")
      throw new HttpsError("failed-precondition", "Khóa học không còn hoạt động");
    if (e.studentId !== subjectId && e.parentId !== userId)
      throw new HttpsError("permission-denied", "Khóa học này không phải của bạn");
    if (e.expiryDate.toDate() < now)
      throw new HttpsError("failed-precondition", "Khóa học đã hết hạn");
    const slot = await tx.get(db().doc(`coaches/${e.coachId}/slots/${e.slotId}`));
    if (!slot.exists) throw new HttpsError("not-found", "Ca học không tồn tại");
    const s = slot.data()!;
    if (s.weekday !== weekday)
      throw new HttpsError("failed-precondition", "Hôm nay không phải ngày học của khóa này.");
    // v2.5: bỏ check giờ — cho phép điểm danh khóa học bất kỳ thời điểm nào trong ngày dạy
    // (khách có thể đến sớm/muộn, lễ tân vẫn xác nhận được).
    const dateKey = isoDate(now);
    const attRef = eDoc.ref.collection("attendances").doc(dateKey);
    const att = await tx.get(attRef);
    if (att.exists)
      throw new HttpsError("already-exists", "Đã điểm danh buổi học hôm nay rồi.");
    const attended = (e.attendedSessions ?? 0) + 1;
    tx.set(attRef, {
      date: admin.firestore.Timestamp.fromDate(now),
      present: true,
      source: tokenRef ? "QR" : "STAFF",
      at: admin.firestore.Timestamp.now(),
    });
    const completed = attended >= SWIM_COURSE_TOTAL_SESSIONS;
    tx.update(eDoc.ref, {
      attendedSessions: attended,
      ...(completed
        ? { status: "COMPLETED", completedAt: admin.firestore.Timestamp.now() }
        : {}),
    });
    if (completed)
      tx.update(slot.ref, { enrolledCount: Math.max(0, (s.enrolledCount ?? 1) - 1) });
    writeCheckin(tx, userId, d.beneficiaryId, "COURSE", eDoc.id, qrTokenId, 1, tokenRef);
    const notifyUid = (e.parentId as string | undefined) ?? (isStaffSource ? userId : undefined);
    const notify = notifyUid
      ? {
          uid: notifyUid,
          title: isStaffSource ? "Lễ tân đã điểm danh hộ ✓" : "Điểm danh thành công",
          body: e.parentId
            ? `Con của bạn đã tham gia lớp học ngày ${viDate(now)} lúc ${pad(s.startHour)}:00.`
            : `Bạn đã được điểm danh buổi học ngày ${viDate(now)} lúc ${pad(s.startHour)}:00.`,
        }
      : undefined;
    return {
      ok: true,
      kind: "COURSE",
      message: "Điểm danh khóa học thành công",
      notify,
    };
  }

  if (targetId && forceKind === "MEMBERSHIP") {
    const mRef = db().doc(`memberships/${targetId}`);
    const mDoc = await tx.get(mRef);
    if (!mDoc.exists) throw new HttpsError("not-found", "Vé thời hạn không tồn tại");
    const m = mDoc.data()!;
    if (m.status !== "ACTIVE")
      throw new HttpsError("failed-precondition", "Vé không còn hoạt động");
    if (m.userId !== userId)
      throw new HttpsError("permission-denied", "Vé này không phải của bạn");
    if (m.holderId !== subjectId)
      throw new HttpsError("permission-denied", "Vé thuộc người khác trong gia đình");
    if (m.endDate.toDate() < now)
      throw new HttpsError("failed-precondition", "Vé đã hết hạn");
    writeCheckin(tx, userId, d.beneficiaryId, "MEMBERSHIP", mDoc.id, qrTokenId, 1, tokenRef);
    return {
      ok: true,
      kind: "MEMBERSHIP",
      message: "Vé còn hiệu lực, mời vào",
      notify: isStaffSource
        ? {
            uid: userId,
            title: "Lễ tân đã check-in cho bạn ✓",
            body: `Vé thời hạn MS${m.memberCode ?? ""} · còn hiệu lực đến ${viDate(m.endDate.toDate())}.`,
          }
        : undefined,
    };
  }

  if (skip("COURSE")) {
    // fall through to PACKAGE/MEMBERSHIP
  } else {
  // 1) COURSE — enrollment ACTIVE của subject, slot khớp weekday & giờ hiện tại
  const enrolls = await tx.get(db().collection("enrollments")
    .where("studentId", "==", subjectId).where("status", "==", "ACTIVE"));
  // v2.4.2 (Q2): track issue cho enrollment đầu tiên để throw error rõ hơn
  let firstIssue: string | undefined;
  for (const eDoc of enrolls.docs) {
    const e = eDoc.data();
    if (e.expiryDate.toDate() < now) {
      firstIssue ??= "Khóa học đã hết hạn (90 ngày).";
      continue;
    }
    const slot = await tx.get(db().doc(`coaches/${e.coachId}/slots/${e.slotId}`));
    if (!slot.exists) {
      firstIssue ??= "Ca học không tồn tại trong hệ thống.";
      continue;
    }
    const s = slot.data()!;
    if (s.weekday !== weekday) {
      firstIssue ??= `Hôm nay không có buổi học của khóa này (lịch học: thứ ${(s.weekday + 6) % 7 + 2 === 8 ? "CN" : (s.weekday + 6) % 7 + 2}, ${s.startHour}h–${s.endHour}h).`;
      continue;
    }
    // v2.5: bỏ check giờ — cho phép điểm danh suốt cả ngày dạy.

    const dateKey = isoDate(now);
    const attRef = eDoc.ref.collection("attendances").doc(dateKey);
    const att = await tx.get(attRef);
    let attended = e.attendedSessions ?? 0;
    if (att.exists) {
      firstIssue ??= "HV đã được điểm danh buổi học hôm nay rồi.";
      continue;
    }
    attended += 1;
    tx.set(attRef, {
      date: admin.firestore.Timestamp.fromDate(now), present: true,
      source: tokenRef ? "QR" : "STAFF", at: admin.firestore.Timestamp.now(),
    });
    const completed = attended >= SWIM_COURSE_TOTAL_SESSIONS;
    tx.update(eDoc.ref, {
      attendedSessions: attended,
      ...(completed ? { status: "COMPLETED", completedAt: admin.firestore.Timestamp.now() } : {}),
    });
    if (completed) {
      tx.update(slot.ref, { enrolledCount: Math.max(0, (s.enrolledCount ?? 1) - 1) });
    }
    writeCheckin(tx, userId, d.beneficiaryId, "COURSE", eDoc.id, qrTokenId, 1, tokenRef);
    const notifyUid = (e.parentId as string | undefined) ?? (isStaffSource ? userId : undefined);
    const notify = notifyUid
      ? {
          uid: notifyUid,
          title: isStaffSource ? "Lễ tân đã điểm danh hộ ✓" : "Điểm danh thành công",
          body: e.parentId
            ? `Con của bạn đã tham gia lớp học ngày ${viDate(now)} lúc ${pad(s.startHour)}:00.`
            : `Bạn đã được điểm danh buổi học ngày ${viDate(now)} lúc ${pad(s.startHour)}:00.`,
        }
      : undefined;
    return { ok: true, kind: "COURSE", message: "Điểm danh khóa học thành công", notify };
  }
  // Có enrollment nhưng không match → throw issue cụ thể
  if (forceKind === "COURSE" && enrolls.size > 0 && firstIssue)
    throw new HttpsError("failed-precondition", firstIssue);
  } // end COURSE block

  if (skip("PACKAGE")) {
    // skip
  } else {
  // 2) PACKAGE — check-in nhóm
  // FIFO: gói tạo trước dùng hết trước (đỡ tiếc gói cũ nếu hết hạn)
  const pkgs = await tx.get(db().collection("ticketPackages")
    .where("userId", "==", userId).where("status", "==", "ACTIVE"));
  const pkgSorted = pkgs.docs
    .slice()
    .sort((a, b) => {
      const ta = (a.data().createdAt?.toMillis?.() ?? 0) as number;
      const tb = (b.data().createdAt?.toMillis?.() ?? 0) as number;
      return ta - tb;
    });
  const pkg = pkgSorted.find((p) => (p.data().remainingSessions ?? 0) >= groupSize);
  if (pkg) {
    const data = pkg.data();
    // Quy tắc: gói TRẺ EM không dùng cho người lớn (không phụ thu)
    const isChildCard = data.audience === "CHILD_UNDER_140" || data.audience === "CHILD_OVER_140";
    if (isChildCard && adultsInGroup > 0)
      throw new HttpsError("failed-precondition",
        "Thẻ trẻ em không dùng cho người lớn. Người lớn vui lòng mua vé lẻ tại quầy.");

    const remaining = (data.remainingSessions ?? 0) - groupSize;
    const cid = db().collection("checkins").doc().id;
    tx.update(pkg.ref, {
      remainingSessions: remaining,
      status: remaining <= 0 ? "DEPLETED" : "ACTIVE",
      usageHistory: admin.firestore.FieldValue.arrayUnion({
        at: admin.firestore.Timestamp.now(), count: groupSize, checkinId: cid,
      }),
    });
    writeCheckin(tx, userId, d.beneficiaryId, "PACKAGE", pkg.id, qrTokenId, groupSize, tokenRef, cid);
    return {
      ok: true,
      kind: "PACKAGE",
      message: `Check-in ${groupSize} người, trừ ${groupSize} lượt`,
      notify: isStaffSource
        ? {
            uid: userId,
            title: "Lễ tân đã điểm danh hộ bạn ✓",
            body: `Trừ ${groupSize} lượt từ vé MS${data.memberCode ?? ""} · còn ${remaining}/${data.totalSessions} lượt.`,
          }
        : undefined,
    };
  }
  // có gói nhưng không đủ lượt
  if (pkgSorted.some((p) => (p.data().remainingSessions ?? 0) > 0))
    throw new HttpsError("resource-exhausted", "Số lượt còn lại không đủ cho cả nhóm");
  } // end PACKAGE block

  if (skip("MEMBERSHIP")) {
    // skip
  } else {
  // 3) MEMBERSHIP — cá nhân, chỉ đúng chủ thẻ
  const mems = await tx.get(db().collection("memberships")
    .where("userId", "==", userId).where("status", "==", "ACTIVE"));
  const mem = mems.docs.find((m) => {
    const md = m.data();
    return md.holderId === subjectId && md.endDate.toDate() >= now;
  });
  if (mem) {
    writeCheckin(tx, userId, d.beneficiaryId, "MEMBERSHIP", mem.id, qrTokenId, 1, tokenRef);
    const md = mem.data();
    return {
      ok: true,
      kind: "MEMBERSHIP",
      message: "Vé còn hiệu lực, mời vào",
      notify: isStaffSource
        ? {
            uid: userId,
            title: "Lễ tân đã check-in cho bạn ✓",
            body: `Vé thời hạn MS${md.memberCode ?? ""} · còn hiệu lực đến ${viDate(md.endDate.toDate())}.`,
          }
        : undefined,
    };
  }
  } // end MEMBERSHIP block

  throw new HttpsError("failed-precondition",
    forceKind
      ? `Không tìm thấy ${forceKind === "PACKAGE" ? "vé lượt" : forceKind === "MEMBERSHIP" ? "vé thời hạn" : "khóa học"} phù hợp.`
      : "Không tìm thấy vé/gói/khóa học hợp lệ. Vui lòng mua vé tại quầy.");
}

function writeCheckin(
  tx: FirebaseFirestore.Transaction, userId: string, beneficiaryId: string | undefined,
  kind: string, refId: string, qrTokenId: string, groupSize: number,
  tokenRef: FirebaseFirestore.DocumentReference | null, fixedId?: string,
) {
  const ref = fixedId ? db().collection("checkins").doc(fixedId) : db().collection("checkins").doc();
  tx.set(ref, {
    id: ref.id, userId, beneficiaryId: beneficiaryId ?? null,
    kind, refId, qrTokenId, groupSize, result: "ACCEPTED",
    at: admin.firestore.Timestamp.now(),
  });
  if (tokenRef) tx.update(tokenRef, { used: true });
}

async function afterCheckin(r: CheckinResult) {
  if (!r.notify) return;
  const { uid, title, body, type } = r.notify;
  const u = await db().doc(`users/${uid}`).get();
  await db().collection("users").doc(uid).collection("notifications").add({
    title, body, type: type ?? "CHILD_ATTENDED", read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const tokens: string[] = u.data()?.fcmTokens ?? [];
  if (tokens.length)
    await admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } });
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const viDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

// =====================================================================
// v2.3 (D5, INV-15) — Vé lượt: khách quét QR → "yêu cầu chờ duyệt"
// Lễ tân xem thông tin vé, chỉnh số lượt, bấm xác nhận → mới trừ thực tế.
// Không TTL: request giữ PENDING vô hạn cho đến khi có hành động.
// =====================================================================

// Khách quét QR vé lượt → tạo /checkinRequests/{id} status PENDING.
// data: { qrPayload, ticketPackageId, suggestedCount, adultsInGroup? }
export const requestCheckin = onCall({ region: REGION }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  const uid = req.auth.uid;
  const d = req.data as any;
  const [tokenId, nonce] = String(d.qrPayload ?? "").split(":");
  if (!tokenId || !nonce) throw new HttpsError("invalid-argument", "QR không hợp lệ");
  if (!d.ticketPackageId) throw new HttpsError("invalid-argument", "Thiếu mã vé");
  const suggestedCount = Math.max(1, Number(d.suggestedCount ?? 1));

  const tokenRef = db().doc(`qrTokens/${tokenId}`);
  const pkgRef = db().doc(`ticketPackages/${d.ticketPackageId}`);
  const userRef = db().doc(`users/${uid}`);

  const requestId = await db().runTransaction(async (tx) => {
    const [tok, pkg, user] = await Promise.all([tx.get(tokenRef), tx.get(pkgRef), tx.get(userRef)]);
    if (!tok.exists) throw new HttpsError("invalid-argument", "QR không hợp lệ");
    const t = tok.data()!;
    if (t.used) throw new HttpsError("failed-precondition", "QR đã được dùng");
    if (t.nonce !== nonce) throw new HttpsError("invalid-argument", "QR không khớp");
    if (t.expiresAt.toMillis() < Date.now())
      throw new HttpsError("deadline-exceeded", "QR đã hết hạn, vui lòng quét lại");

    if (!pkg.exists) throw new HttpsError("not-found", "Vé không tồn tại");
    const p = pkg.data()!;
    if (p.userId !== uid) throw new HttpsError("permission-denied", "Vé không thuộc về bạn");
    if (p.status !== "ACTIVE") throw new HttpsError("failed-precondition", "Vé không còn hoạt động");
    if ((p.remainingSessions ?? 0) < suggestedCount)
      throw new HttpsError("resource-exhausted", `Vé chỉ còn ${p.remainingSessions} lượt`);

    // Consume QR (single-use)
    tx.update(tokenRef, { used: true });

    const ref = db().collection("checkinRequests").doc();
    tx.set(ref, {
      id: ref.id,
      userId: uid,
      userName: user.data()?.fullName ?? "",
      userPhone: user.data()?.phone ?? "",
      beneficiaryKind: "USER",
      beneficiaryId: uid,
      beneficiaryName: user.data()?.fullName ?? "",
      ticketPackageId: d.ticketPackageId,
      ticketRemaining: p.remainingSessions ?? 0,
      suggestedCount,
      adultsInGroup: Number(d.adultsInGroup ?? 0),
      status: "PENDING",
      qrTokenId: tokenId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  });

  return { requestId };
});

// Lễ tân duyệt → trừ lượt + tạo checkin.
// data: { requestId, approvedCount }
export const approveCheckin = onCall({ region: REGION }, async (req) => {
  const role = req.auth?.token?.role;
  if (!["OWNER", "RECEPTIONIST"].includes(role))
    throw new HttpsError("permission-denied", "Không đủ quyền");
  const { requestId, approvedCount } = req.data as { requestId: string; approvedCount: number };
  const count = Math.max(1, Number(approvedCount ?? 1));

  const reqRef = db().doc(`checkinRequests/${requestId}`);
  const result = await db().runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) throw new HttpsError("not-found", "Yêu cầu không tồn tại");
    const r = snap.data()!;
    if (r.status !== "PENDING")
      throw new HttpsError("failed-precondition", `Yêu cầu đã ${r.status}`);

    const pkgRef = db().doc(`ticketPackages/${r.ticketPackageId}`);
    const pkg = await tx.get(pkgRef);
    if (!pkg.exists) throw new HttpsError("not-found", "Vé không tồn tại");
    const p = pkg.data()!;
    if (p.status !== "ACTIVE") throw new HttpsError("failed-precondition", "Vé không còn hoạt động");
    if ((p.remainingSessions ?? 0) < count)
      throw new HttpsError("resource-exhausted", `Vé chỉ còn ${p.remainingSessions} lượt`);

    const remaining = (p.remainingSessions ?? 0) - count;
    const checkinId = db().collection("checkins").doc().id;

    tx.update(pkgRef, {
      remainingSessions: remaining,
      status: remaining <= 0 ? "DEPLETED" : "ACTIVE",
      usageHistory: admin.firestore.FieldValue.arrayUnion({
        at: admin.firestore.Timestamp.now(),
        count,
        checkinId,
      }),
    });

    tx.set(db().collection("checkins").doc(checkinId), {
      id: checkinId,
      userId: r.userId,
      beneficiaryId: r.beneficiaryId,
      kind: "PACKAGE",
      refId: r.ticketPackageId,
      qrTokenId: r.qrTokenId,
      groupSize: count,
      result: "ACCEPTED",
      at: admin.firestore.Timestamp.now(),
    });

    tx.update(reqRef, {
      status: "APPROVED",
      approvedCount: count,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: req.auth!.uid,
      checkinId,
    });

    return { userId: r.userId, count, remaining };
  });

  // Notify khách
  try {
    await db().collection("users").doc(result.userId).collection("notifications").add({
      title: "Đã trừ lượt thành công ✅",
      body: `Lễ tân đã xác nhận check-in của bạn, trừ ${result.count} lượt. Còn lại ${result.remaining} lượt.`,
      type: "GENERAL",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const u = await db().doc(`users/${result.userId}`).get();
    const tokens: string[] = u.data()?.fcmTokens ?? [];
    if (tokens.length)
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: "Check-in thành công",
          body: `Đã trừ ${result.count} lượt · còn ${result.remaining} lượt`,
        },
      });
  } catch (e) {
    console.warn("notify approveCheckin failed", e);
  }

  return { ok: true, ...result };
});

// Lễ tân từ chối.
// data: { requestId, reason }
export const rejectCheckin = onCall({ region: REGION }, async (req) => {
  const role = req.auth?.token?.role;
  if (!["OWNER", "RECEPTIONIST"].includes(role))
    throw new HttpsError("permission-denied", "Không đủ quyền");
  const { requestId, reason } = req.data as { requestId: string; reason: string };
  if (!reason?.trim()) throw new HttpsError("invalid-argument", "Vui lòng nhập lý do từ chối");

  const reqRef = db().doc(`checkinRequests/${requestId}`);
  const userId = await db().runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) throw new HttpsError("not-found", "Yêu cầu không tồn tại");
    const r = snap.data()!;
    if (r.status !== "PENDING")
      throw new HttpsError("failed-precondition", `Yêu cầu đã ${r.status}`);
    tx.update(reqRef, {
      status: "REJECTED",
      rejectReason: String(reason).trim(),
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: req.auth!.uid,
    });
    return r.userId as string;
  });

  try {
    await db().collection("users").doc(userId).collection("notifications").add({
      title: "Check-in bị từ chối",
      body: `Lý do: ${reason}`,
      type: "GENERAL",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch {}

  return { ok: true };
});

// Khách tự hủy request (trước khi lễ tân duyệt).
export const cancelCheckinRequest = onCall({ region: REGION }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  const uid = req.auth.uid;
  const { requestId } = req.data as { requestId: string };
  const reqRef = db().doc(`checkinRequests/${requestId}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) throw new HttpsError("not-found", "Yêu cầu không tồn tại");
    const r = snap.data()!;
    if (r.userId !== uid) throw new HttpsError("permission-denied", "Không phải yêu cầu của bạn");
    if (r.status !== "PENDING") return; // đã resolve rồi, không cần làm gì
    tx.update(reqRef, {
      status: "CANCELLED",
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: uid,
    });
  });
  return { ok: true };
});
