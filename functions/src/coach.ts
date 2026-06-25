// v2.4 (E4) — Callables cho màn HLV: ghi chú HV + báo nghỉ ca.
// addCoachNote        — append note vào enrollment.coachNotes[]; chỉ HLV đứng lớp được ghi.
// reportCoachAbsence  — tạo doc /coaches/{coachId}/absences/{YYYY-MM-DD_H} + push HV ca đó.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth, audit } from "./helpers";

const REGION = "asia-southeast1";
const db = () => admin.firestore();

const MAX_NOTE_LEN = 500;
const MAX_NOTES_PER_ENROLLMENT = 200;

// Lấy coachId của user đang gọi callable. Owner có thể truyền `actAsCoachId` để hỗ trợ HLV.
async function resolveCallerCoachId(
  uid: string,
  role: string | undefined,
  explicitCoachId?: string,
): Promise<string> {
  if (role === "OWNER" && explicitCoachId) return explicitCoachId;
  const q = await db().collection("coaches").where("userId", "==", uid).limit(1).get();
  if (q.empty)
    throw new HttpsError("permission-denied", "Tài khoản chưa được gắn với HLV");
  return q.docs[0].id;
}

/**
 * E4.1 — HLV thêm ghi chú riêng cho 1 HV (enrollment).
 * data: { enrollmentId: string, text: string (1..500), actAsCoachId?: string (Owner) }
 */
export const addCoachNote = onCall({ region: REGION }, async (req) => {
  const uid = requireAuth(req);
  const role = req.auth?.token?.role as string | undefined;
  if (role !== "COACH" && role !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ HLV/Owner được thêm ghi chú");

  const { enrollmentId, text, actAsCoachId } = req.data as {
    enrollmentId: string;
    text: string;
    actAsCoachId?: string;
  };
  if (!enrollmentId)
    throw new HttpsError("invalid-argument", "Thiếu enrollmentId");
  const t = String(text ?? "").trim();
  if (!t) throw new HttpsError("invalid-argument", "Ghi chú không được trống");
  if (t.length > MAX_NOTE_LEN)
    throw new HttpsError("invalid-argument", `Ghi chú tối đa ${MAX_NOTE_LEN} ký tự`);

  const coachId = await resolveCallerCoachId(uid, role, actAsCoachId);
  const eRef = db().doc(`enrollments/${enrollmentId}`);
  const eSnap = await eRef.get();
  if (!eSnap.exists) throw new HttpsError("not-found", "Khóa học không tồn tại");
  const e = eSnap.data()!;
  if (e.coachId !== coachId)
    throw new HttpsError("permission-denied", "Không phải HLV đứng lớp của HV này");

  const currentNotes = (e.coachNotes as { text: string; at: unknown }[] | undefined) ?? [];
  if (currentNotes.length >= MAX_NOTES_PER_ENROLLMENT)
    throw new HttpsError(
      "resource-exhausted",
      `Đã đạt giới hạn ${MAX_NOTES_PER_ENROLLMENT} ghi chú cho khóa này`,
    );

  await eRef.update({
    coachNotes: admin.firestore.FieldValue.arrayUnion({
      text: t,
      at: admin.firestore.Timestamp.now(),
    }),
  });
  return { ok: true, count: currentNotes.length + 1 };
});

/**
 * E4.2 — HLV báo nghỉ ca học.
 * data: { coachId: string, date: "YYYY-MM-DD", startHour: number, reason?: string }
 * Tạo doc /coaches/{coachId}/absences/{date_hour} + push HV ACTIVE của ca đó.
 */
export const reportCoachAbsence = onCall({ region: REGION }, async (req) => {
  const uid = requireAuth(req);
  const role = req.auth?.token?.role as string | undefined;
  if (role !== "COACH" && role !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ HLV/Owner được báo nghỉ");

  const { coachId: passedCoachId, date, startHour, reason } = req.data as {
    coachId?: string;
    date: string;
    startHour: number;
    reason?: string;
  };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new HttpsError("invalid-argument", "date phải có dạng YYYY-MM-DD");
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23)
    throw new HttpsError("invalid-argument", "startHour không hợp lệ");

  const coachId = await resolveCallerCoachId(uid, role, passedCoachId);
  const docKey = `${date}_${startHour}`;
  const absenceRef = db().doc(`coaches/${coachId}/absences/${docKey}`);
  const existing = await absenceRef.get();
  if (existing.exists)
    throw new HttpsError("already-exists", "Đã báo nghỉ ca này rồi");

  // Tính slotId từ weekday của date (Date.getDay() — 0=CN)
  const weekday = new Date(date + "T00:00:00").getDay();
  const slotId = `${coachId}_${weekday}_${startHour}`;

  const enrolls = await db()
    .collection("enrollments")
    .where("coachId", "==", coachId)
    .where("slotId", "==", slotId)
    .where("status", "==", "ACTIVE")
    .get();

  const coachSnap = await db().doc(`coaches/${coachId}`).get();
  const coachName = (coachSnap.data()?.fullName as string | undefined) ?? "HLV";

  // Ghi notification + collect FCM token cho push
  const batch = db().batch();
  batch.set(absenceRef, {
    coachId,
    date,
    startHour,
    reason: (reason ?? "").trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid,
    notifiedCount: enrolls.size,
  });

  const targetUids: string[] = [];
  for (const eDoc of enrolls.docs) {
    const ed = eDoc.data();
    const targetUid = (ed.parentId as string | undefined) ?? (ed.studentId as string);
    if (!targetUid) continue;
    targetUids.push(targetUid);
    const notifRef = db()
      .collection("users")
      .doc(targetUid)
      .collection("notifications")
      .doc();
    batch.set(notifRef, {
      title: `${coachName} báo nghỉ ngày ${formatVnDate(date)}`,
      body: `Ca ${startHour}h–${startHour + 1}h${(reason ?? "").trim() ? " · " + reason : ""}. Vui lòng đợi lịch bù.`,
      type: "COACH_OFF",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  // Push FCM (best-effort, không block response)
  try {
    const tokens: string[] = [];
    await Promise.all(
      [...new Set(targetUids)].map(async (u) => {
        const usnap = await db().doc(`users/${u}`).get();
        const ts = (usnap.data()?.fcmTokens as string[] | undefined) ?? [];
        tokens.push(...ts);
      }),
    );
    if (tokens.length)
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: `${coachName} báo nghỉ ngày ${formatVnDate(date)}`,
          body: `Ca ${startHour}h–${startHour + 1}h`,
        },
      });
  } catch (e) {
    console.warn("reportCoachAbsence push failed", e);
  }

  await audit(uid, "REPORT_COACH_ABSENCE", { type: "coach", id: coachId }, {
    date,
    startHour,
    notified: enrolls.size,
  });

  return { ok: true, notified: enrolls.size };
});

function formatVnDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  return `${d}/${m}/${y}`;
}
