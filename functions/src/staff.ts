import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const REGION = "asia-southeast1";
const db = () => admin.firestore();

const ROLES = ["OWNER", "RECEPTIONIST", "COACH", "CUSTOMER", "PARENT"] as const;
type Role = (typeof ROLES)[number];

/**
 * Gán vai trò cho user (Owner-only).
 * Đặt custom claim + cập nhật doc /users/{uid}.role.
 * Nếu role=COACH và có coachId, liên kết coaches/{id}.userId.
 */
export const setUserRole = onCall({ region: REGION }, async (req) => {
  const callerRole = req.auth?.token?.role;
  if (callerRole !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ Owner được gán vai trò");

  const { phone, role, coachId } = req.data as { phone: string; role: Role; coachId?: string };
  if (!phone || !ROLES.includes(role))
    throw new HttpsError("invalid-argument", "Thiếu SĐT hoặc vai trò không hợp lệ");

  // Chuẩn hóa SĐT về E.164 (+84...). Firebase getUserByPhoneNumber yêu cầu E.164.
  const e164 = normalizeVNPhone(phone);
  if (!e164) throw new HttpsError("invalid-argument", `SĐT không hợp lệ: ${phone}`);

  const user = await admin.auth().getUserByPhoneNumber(e164).catch(() => null);
  if (!user) throw new HttpsError("not-found", `Không tìm thấy tài khoản với SĐT ${e164}. Người đó phải đăng nhập app 1 lần trước.`);

  await admin.auth().setCustomUserClaims(user.uid, { role });
  await db().doc(`users/${user.uid}`).set({ role }, { merge: true });

  if (role === "COACH" && coachId) {
    await db().doc(`coaches/${coachId}`).set({ userId: user.uid }, { merge: true });
  }

  // Audit log
  await db().collection("auditLogs").add({
    actorId: req.auth!.uid, action: "SET_USER_ROLE",
    targetType: "user", targetId: user.uid,
    detail: { phone, role, coachId: coachId ?? null },
    at: admin.firestore.Timestamp.now(),
  });

  return { ok: true, uid: user.uid, role };
});

// Chuẩn hóa SĐT Việt Nam về E.164.
// Chấp nhận: "+84905...", "0905...", "905...", "84 905 ...", có dấu cách/gạch.
function normalizeVNPhone(input: string): string | null {
  const raw = input.trim().replace(/[\s.-]/g, "");
  let digits = raw.startsWith("+") ? raw.slice(1) : raw;
  digits = digits.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "84" + digits.slice(1);
  if (!digits.startsWith("84")) digits = "84" + digits;
  // SĐT VN sau mã quốc gia: 9 chữ số (8x, 9x, 7x, 5x, 3x)
  if (digits.length !== 11) return null;
  return "+" + digits;
}
