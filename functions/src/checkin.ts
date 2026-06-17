import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { SWIM_COURSE_TOTAL_SESSIONS } from "./pricing";

const REGION = "asia-southeast1";
const db = () => admin.firestore();
const TTL_MS = 30_000; // QR đổi mỗi 30s

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
export const staffCheckinByPhone = onCall({ region: REGION }, async (req) => {
  const role = req.auth?.token?.role;
  if (!["OWNER", "RECEPTIONIST"].includes(role))
    throw new HttpsError("permission-denied", "Không đủ quyền");
  const d = req.data as any;
  const q = await db().collection("users").where("phone", "==", d.phone).limit(1).get();
  if (q.empty) throw new HttpsError("not-found", "Không tìm thấy phụ huynh với SĐT này");
  const parentId = q.docs[0].id;
  const result = await db().runTransaction(async (tx) =>
    resolveCheckin(tx, parentId, d, "staff-manual", null));
  await afterCheckin(result);
  return result;
});

type CheckinResult = {
  ok: boolean; kind: string; message: string;
  notify?: { uid: string; title: string; body: string };
};

// Ưu tiên: COURSE (đúng ca giờ này) → PACKAGE → MEMBERSHIP
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
  const hour = now.getHours();
  const groupSize = Math.max(1, Number(d.groupSize ?? 1));
  const adultsInGroup = Number(d.adultsInGroup ?? 0);

  // 1) COURSE — enrollment ACTIVE của subject, slot khớp weekday & giờ hiện tại
  const enrolls = await tx.get(db().collection("enrollments")
    .where("studentId", "==", subjectId).where("status", "==", "ACTIVE"));
  for (const eDoc of enrolls.docs) {
    const e = eDoc.data();
    if (e.expiryDate.toDate() < now) continue;
    const slot = await tx.get(db().doc(`coaches/${e.coachId}/slots/${e.slotId}`));
    if (!slot.exists) continue;
    const s = slot.data()!;
    if (s.weekday !== weekday) continue;
    if (hour < s.startHour || hour >= s.endHour) continue;

    const dateKey = isoDate(now);
    const attRef = eDoc.ref.collection("attendances").doc(dateKey);
    const att = await tx.get(attRef);
    let attended = e.attendedSessions ?? 0;
    if (!att.exists) {
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
      // hoàn thành → giải phóng slot
      if (completed) {
        tx.update(slot.ref, { enrolledCount: Math.max(0, (s.enrolledCount ?? 1) - 1) });
      }
    }
    writeCheckin(tx, userId, d.beneficiaryId, "COURSE", eDoc.id, qrTokenId, 1, tokenRef);
    // thông báo cho phụ huynh nếu là điểm danh trẻ
    const notify = e.parentId
      ? { uid: e.parentId, title: "Điểm danh thành công",
          body: `Con của bạn đã tham gia lớp học ngày ${viDate(now)} lúc ${pad(s.startHour)}:00.` }
      : undefined;
    return { ok: true, kind: "COURSE", message: "Điểm danh khóa học thành công", notify };
  }

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
    return { ok: true, kind: "PACKAGE", message: `Check-in ${groupSize} người, trừ ${groupSize} lượt` };
  }
  // có gói nhưng không đủ lượt
  if (pkgSorted.some((p) => (p.data().remainingSessions ?? 0) > 0))
    throw new HttpsError("resource-exhausted", "Số lượt còn lại không đủ cho cả nhóm");

  // 3) MEMBERSHIP — cá nhân, chỉ đúng chủ thẻ
  const mems = await tx.get(db().collection("memberships")
    .where("userId", "==", userId).where("status", "==", "ACTIVE"));
  const mem = mems.docs.find((m) => {
    const md = m.data();
    return md.holderId === subjectId && md.endDate.toDate() >= now;
  });
  if (mem) {
    writeCheckin(tx, userId, d.beneficiaryId, "MEMBERSHIP", mem.id, qrTokenId, 1, tokenRef);
    return { ok: true, kind: "MEMBERSHIP", message: "Vé còn hiệu lực, mời vào" };
  }

  throw new HttpsError("failed-precondition",
    "Không tìm thấy vé/gói/khóa học hợp lệ. Vui lòng mua vé tại quầy.");
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
  const { uid, title, body } = r.notify;
  const u = await db().doc(`users/${uid}`).get();
  await db().collection("users").doc(uid).collection("notifications").add({
    title, body, type: "CHILD_ATTENDED", read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const tokens: string[] = u.data()?.fcmTokens ?? [];
  if (tokens.length)
    await admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } });
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const viDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
