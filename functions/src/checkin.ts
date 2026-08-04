import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { SWIM_COURSE_TOTAL_SESSIONS } from "./pricing";
import { phoneVariants } from "./helpers";
import { TICKET_PACKAGE_EXPIRED_MESSAGE, isTicketPackageExpired } from "./packageExpiry";

function positiveInt(value: unknown, fallback = 1): number {
  const n = Math.floor(Number(value ?? fallback));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const REGION = "asia-southeast1";
const db = () => admin.firestore();
const TTL_MS = 30_000; // QR đổi mỗi 30s

export type QrPurpose = "VISIT" | "COURSE";
export function normalizeQrPurpose(value: unknown): QrPurpose {
  return String(value ?? "VISIT").toUpperCase() === "COURSE" ? "COURSE" : "VISIT";
}

export function assertQrPurposeCanUseKind(purpose: QrPurpose, requestedKind?: string) {
  const kind = String(requestedKind ?? "").toUpperCase();
  if (purpose === "COURSE" && kind && kind !== "COURSE")
    throw new HttpsError("failed-precondition", "QR này chỉ dùng để điểm danh khóa học, không dùng để trừ vé lượt/vé thời hạn.");
  if (purpose !== "COURSE" && kind === "COURSE")
    throw new HttpsError("failed-precondition", "QR cổng này chỉ dùng cho vé lượt. Vui lòng quét màn QR điểm danh khóa học.");
}

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
  const purpose = normalizeQrPurpose((req.data as any)?.purpose ?? (req.data as any)?.qrPurpose);
  const requestedCount = purpose === "COURSE" ? 1 : positiveInt((req.data as any)?.requestedCount, 1);
  const adultsInGroup = purpose === "COURSE"
    ? 0
    : Math.min(
        requestedCount,
        Math.max(0, Math.floor(Number((req.data as any)?.adultsInGroup ?? 0))),
      );
  const now = admin.firestore.Timestamp.now();
  const exp = admin.firestore.Timestamp.fromMillis(now.toMillis() + TTL_MS);
  const ref = db().collection("qrTokens").doc();
  await ref.set({
    id: ref.id,
    nonce,
    issuedAt: now,
    expiresAt: exp,
    used: false,
    purpose,
    requestedCount,
    ...(adultsInGroup > 0 ? { adultsInGroup } : {}),
  });
  return { token: `${ref.id}:${nonce}`, expiresAt: exp.toMillis(), requestedCount, purpose };
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
    const purpose = normalizeQrPurpose(t.purpose);
    assertQrPurposeCanUseKind(purpose, d.forceKind);
    return await resolveCheckin(
      tx,
      req.auth!.uid,
      {
        ...d,
        ...(purpose === "COURSE" ? { forceKind: "COURSE", groupSize: 1, adultsInGroup: 0 } : {
          groupSize: positiveInt(t.requestedCount, 1),
          adultsInGroup: Number(t.adultsInGroup ?? d.adultsInGroup ?? 0),
        }),
      },
      req.auth!.uid,
      tokenId,
      tokenRef,
    );
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
  const staffReason = String(d.reason ?? "").trim();
  if (d.forceKind === "PACKAGE" && !staffReason) throw new HttpsError("invalid-argument", "Cần nhập lý do xác nhận hộ");
  // v2.4 (E1) — dùng helper chung; throw rõ ràng nếu Auth có nhưng Firestore không.
  const parentId = await findUserUidByPhone(String(d.phone ?? ""));
  const result = await db().runTransaction(async (tx) =>
    resolveCheckin(tx, parentId, d, req.auth!.uid, "staff-manual", null));
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
  actorId: string,
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
    if (isTicketPackageExpired(p))
      throw new HttpsError("failed-precondition", TICKET_PACKAGE_EXPIRED_MESSAGE);
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
    writeCheckin(tx, actorId, userId, d.beneficiaryId, "PACKAGE", pDoc.id, qrTokenId, groupSize, tokenRef, cid);
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
    writeCheckin(tx, actorId, userId, d.beneficiaryId, "COURSE", eDoc.id, qrTokenId, 1, tokenRef);
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
    writeCheckin(tx, actorId, userId, d.beneficiaryId, "MEMBERSHIP", mDoc.id, qrTokenId, 1, tokenRef);
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
    writeCheckin(tx, actorId, userId, d.beneficiaryId, "COURSE", eDoc.id, qrTokenId, 1, tokenRef);
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
  const usablePkgs = pkgSorted.filter((p) => !isTicketPackageExpired(p.data()));
  const pkg = usablePkgs.find((p) => (p.data().remainingSessions ?? 0) >= groupSize);
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
    writeCheckin(tx, actorId, userId, d.beneficiaryId, "PACKAGE", pkg.id, qrTokenId, groupSize, tokenRef, cid);
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
  if (usablePkgs.some((p) => (p.data().remainingSessions ?? 0) > 0))
    throw new HttpsError("resource-exhausted", "Số lượt còn lại không đủ cho cả nhóm");
  if (pkgSorted.some((p) => isTicketPackageExpired(p.data()) && (p.data().remainingSessions ?? 0) > 0))
    throw new HttpsError("failed-precondition", TICKET_PACKAGE_EXPIRED_MESSAGE);
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
    writeCheckin(tx, actorId, userId, d.beneficiaryId, "MEMBERSHIP", mem.id, qrTokenId, 1, tokenRef);
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
  tx: FirebaseFirestore.Transaction, actorId: string, userId: string, beneficiaryId: string | undefined,
  kind: string, refId: string, qrTokenId: string, groupSize: number,
  tokenRef: FirebaseFirestore.DocumentReference | null, fixedId?: string,
) {
  const now = admin.firestore.Timestamp.now();
  const ref = fixedId ? db().collection("checkins").doc(fixedId) : db().collection("checkins").doc();
  tx.set(ref, {
    id: ref.id, userId, beneficiaryId: beneficiaryId ?? null,
    kind, refId, qrTokenId, groupSize, result: "ACCEPTED",
    at: now,
  });
  if (tokenRef) tx.update(tokenRef, { used: true });
  const byStaff = tokenRef === null;
  tx.set(db().collection("auditLogs").doc(), {
    actorId,
    action: byStaff ? "STAFF_CHECKIN_ON_BEHALF" : "QR_CHECKIN_ACCEPTED",
    targetType: "checkin",
    targetId: ref.id,
    description: byStaff
      ? `Lễ tân điểm danh hộ ${serviceKindLabel(kind)} cho khách`
      : `Khách check-in ${serviceKindLabel(kind)} bằng QR`,
    detail: { userId, beneficiaryId: beneficiaryId ?? null, kind, refId, groupSize, qrTokenId },
    at: now,
  });
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
function serviceKindLabel(kind: string) {
  if (kind === "COURSE") return "khóa học";
  if (kind === "PACKAGE") return "vé lượt";
  if (kind === "MEMBERSHIP") return "vé thời hạn";
  return "dịch vụ";
}

// PACKAGE QR now deducts immediately from the QR token requestedCount.
// Legacy checkinRequests are kept for history only and expire on approve/reject attempts.
// =====================================================================

// Compatibility callable: legacy clients may still call this for PACKAGE QR.
// It now deducts immediately through the same path as checkinByQr; no new PENDING request is created.
// data: { qrPayload, ticketPackageId, suggestedCount, adultsInGroup? }
export const requestCheckin = onCall({ region: REGION }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  const uid = req.auth.uid;
  const d = req.data as any;
  const [tokenId, nonce] = String(d.qrPayload ?? "").split(":");
  if (!tokenId || !nonce) throw new HttpsError("invalid-argument", "QR không hợp lệ");
  if (!d.ticketPackageId) throw new HttpsError("invalid-argument", "Thiếu mã vé");
  const tokenRef = db().doc(`qrTokens/${tokenId}`);

  const result = await db().runTransaction(async (tx) => {
    const tok = await tx.get(tokenRef);
    if (!tok.exists) throw new HttpsError("invalid-argument", "QR không hợp lệ");
    const t = tok.data()!;
    if (t.used) throw new HttpsError("failed-precondition", "QR đã được dùng");
    if (t.nonce !== nonce) throw new HttpsError("invalid-argument", "QR không khớp");
    if (t.expiresAt.toMillis() < Date.now())
      throw new HttpsError("deadline-exceeded", "QR đã hết hạn, vui lòng quét lại");
    const purpose = normalizeQrPurpose(t.purpose);
    if (purpose === "COURSE")
      throw new HttpsError("failed-precondition", "QR này chỉ dùng để điểm danh khóa học, không dùng để trừ vé lượt.");
    return await resolveCheckin(
      tx,
      uid,
      {
        ...d,
        forceKind: "PACKAGE",
        targetId: d.ticketPackageId,
        groupSize: positiveInt(t.requestedCount, 1),
        adultsInGroup: Number(t.adultsInGroup ?? d.adultsInGroup ?? 0),
      },
      uid,
      tokenId,
      tokenRef,
    );
  });

  await afterCheckin(result);
  return { ...result, requestId: null };
});

// Legacy PENDING requests are no longer actionable. Keep the doc for history and mark EXPIRED.
// data: { requestId, approvedCount }
export const approveCheckin = onCall({ region: REGION }, async (req) => {
  const role = req.auth?.token?.role;
  if (!["OWNER", "RECEPTIONIST"].includes(role))
    throw new HttpsError("permission-denied", "Không đủ quyền");
  const { requestId } = req.data as { requestId: string; approvedCount?: number };
  if (!requestId) throw new HttpsError("invalid-argument", "Thiếu yêu cầu check-in");

  const reqRef = db().doc(`checkinRequests/${requestId}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) throw new HttpsError("not-found", "Yêu cầu không tồn tại");
    const r = snap.data()!;
    if (r.status !== "PENDING")
      throw new HttpsError("failed-precondition", `Yêu cầu đã ${r.status}`);
    tx.update(reqRef, {
      status: "EXPIRED",
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: req.auth!.uid,
      expireReason: "QR_PACKAGE_AUTO_DEDUCTION_ENABLED",
    });
  });

  throw new HttpsError(
    "failed-precondition",
    "Yêu cầu check-in cũ đã hết hiệu lực. Khách vui lòng quét QR mới để trừ lượt tự động.",
  );
});


// Lễ tân/owner sửa sai điểm danh vé lượt.
// data: { checkinId, mode: "PARTIAL"|"CANCEL", refundCount?, reason }
export const correctPackageCheckin = onCall({ region: REGION }, async (req) => {
  const role = req.auth?.token?.role;
  if (!["OWNER", "RECEPTIONIST"].includes(role))
    throw new HttpsError("permission-denied", "Không đủ quyền");

  const { checkinId, mode, refundCount, reason } = req.data as {
    checkinId: string;
    mode: "PARTIAL" | "CANCEL";
    refundCount?: number;
    reason?: string;
  };
  if (!checkinId) throw new HttpsError("invalid-argument", "Thiếu lần điểm danh cần sửa");
  const cleanReason = String(reason ?? "").trim();
  if (!cleanReason) throw new HttpsError("invalid-argument", "Vui lòng nhập lý do sửa sai");
  if (!["PARTIAL", "CANCEL"].includes(String(mode)))
    throw new HttpsError("invalid-argument", "Kiểu sửa sai không hợp lệ");

  const result = await db().runTransaction(async (tx) => {
    const checkinRef = db().doc(`checkins/${checkinId}`);
    const checkinSnap = await tx.get(checkinRef);
    if (!checkinSnap.exists) throw new HttpsError("not-found", "Không tìm thấy lần điểm danh");
    const c = checkinSnap.data()!;
    if (c.kind !== "PACKAGE")
      throw new HttpsError("failed-precondition", "Chỉ hoàn được điểm danh thẻ lượt");
    if (c.result !== "ACCEPTED")
      throw new HttpsError("failed-precondition", "Lần điểm danh này không ở trạng thái đã nhận");

    const originalCount = Number(c.groupSize ?? 1);
    const alreadyRefunded = Number(c.refundedCount ?? 0);
    const refundable = originalCount - alreadyRefunded;
    if (refundable <= 0)
      throw new HttpsError("failed-precondition", "Lần điểm danh này đã được hoàn hết");

    const count = mode === "CANCEL" ? refundable : Math.max(1, Number(refundCount ?? 0));
    if (!Number.isFinite(count) || count < 1)
      throw new HttpsError("invalid-argument", "Số lượt hoàn phải lớn hơn 0");
    if (count > refundable)
      throw new HttpsError("failed-precondition", `Chỉ còn ${refundable} lượt có thể hoàn cho lần này`);

    const pkgRef = db().doc(`ticketPackages/${c.refId}`);
    const pkgSnap = await tx.get(pkgRef);
    if (!pkgSnap.exists) throw new HttpsError("not-found", "Không tìm thấy thẻ lượt");
    const p = pkgSnap.data()!;
    const before = Number(p.remainingSessions ?? 0);
    const total = Number(p.totalSessions ?? 0);
    const after = Math.min(total, before + count);
    const correctionStatus = after >= total || alreadyRefunded + count >= originalCount ? "CANCELLED_OR_FULLY_REFUNDED" : "PARTIALLY_REFUNDED";
    const correction = {
      at: admin.firestore.Timestamp.now(),
      by: req.auth!.uid,
      role,
      mode,
      reason: cleanReason,
      refundCount: count,
      beforeRemaining: before,
      afterRemaining: after,
    };

    tx.update(pkgRef, {
      remainingSessions: after,
      status: after > 0 ? "ACTIVE" : p.status,
      correctionHistory: admin.firestore.FieldValue.arrayUnion({
        ...correction,
        checkinId,
      }),
    });

    tx.update(checkinRef, {
      refundedCount: alreadyRefunded + count,
      correctionStatus,
      remainingAfterCorrection: after,
      corrections: admin.firestore.FieldValue.arrayUnion(correction),
    });

    tx.set(db().collection("auditLogs").doc(), {
      actorId: req.auth!.uid,
      action: mode === "CANCEL" ? "CHECKIN_CANCELLED" : "CHECKIN_PARTIALLY_REFUNDED",
      targetType: "checkin",
      targetId: checkinId,
      detail: {
        packageId: c.refId,
        userId: c.userId,
        refundCount: count,
        originalCount,
        refundedBefore: alreadyRefunded,
        beforeRemaining: before,
        afterRemaining: after,
        reason: cleanReason,
      },
      at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { userId: c.userId as string, refundCount: count, remaining: after, originalCount, refundedTotal: alreadyRefunded + count };
  });

  try {
    await db().collection("users").doc(result.userId).collection("notifications").add({
      title: "Đã hoàn lại lượt bơi",
      body: `Hồ bơi đã hoàn lại ${result.refundCount} lượt do thao tác sai. Hiện còn ${result.remaining} lượt.`,
      type: "GENERAL",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("notify correctPackageCheckin failed", e);
  }

  return { ok: true, ...result };
});

// Lễ tân từ chối.
// data: { requestId, reason }
export const rejectCheckin = onCall({ region: REGION }, async (req) => {
  const role = req.auth?.token?.role;
  if (!["OWNER", "RECEPTIONIST"].includes(role))
    throw new HttpsError("permission-denied", "Không đủ quyền");
  const { requestId } = req.data as { requestId: string; reason?: string };
  if (!requestId) throw new HttpsError("invalid-argument", "Thiếu yêu cầu check-in");

  const reqRef = db().doc(`checkinRequests/${requestId}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) throw new HttpsError("not-found", "Yêu cầu không tồn tại");
    const r = snap.data()!;
    if (r.status !== "PENDING")
      throw new HttpsError("failed-precondition", `Yêu cầu đã ${r.status}`);
    tx.update(reqRef, {
      status: "EXPIRED",
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: req.auth!.uid,
      expireReason: "QR_PACKAGE_AUTO_DEDUCTION_ENABLED",
    });
  });

  throw new HttpsError(
    "failed-precondition",
    "Yêu cầu check-in cũ đã hết hiệu lực. Khách vui lòng quét QR mới để trừ lượt tự động.",
  );
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
