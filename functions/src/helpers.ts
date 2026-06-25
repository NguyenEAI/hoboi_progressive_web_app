// Helper dùng chung cho tất cả callable: auth check, audit log, App Check hint.
//
// App Check (INV-14): callable v2 hỗ trợ qua option `enforceAppCheck: true` trên onCall.
// Production deploy chuẩn:
//   const CALL_OPTS = { region: REGION, enforceAppCheck: true, consumeAppCheckToken: true };
//   export const X = onCall(CALL_OPTS, async (req) => { ... });
// Client cần initialize AppCheck với ReCaptchaV3Provider (xem lib/firebase/appCheck.ts).
//
// Trong dev: dùng env FIREBASE_APPCHECK_DEBUG_TOKEN — Firebase sẽ cấp debug token, không cần reCAPTCHA thật.

import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export type CallReq = { auth?: { uid: string; token: Record<string, unknown> } | null };

export function requireAuth(req: CallReq): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  return req.auth.uid;
}

export function requireStaff(req: CallReq): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  const role = req.auth.token.role as string | undefined;
  if (!role || !["OWNER", "RECEPTIONIST"].includes(role))
    throw new HttpsError("permission-denied", "Không đủ quyền");
  return req.auth.uid;
}

export function requireOwner(req: CallReq): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  const role = req.auth.token.role as string | undefined;
  if (role !== "OWNER") throw new HttpsError("permission-denied", "Chỉ Owner được thực hiện");
  return req.auth.uid;
}

export function role(req: CallReq): string | undefined {
  return req.auth?.token.role as string | undefined;
}

// Ghi audit log (INV-12). Append-only — không bao giờ update/delete.
export async function audit(
  actorId: string,
  action: string,
  target: { type: string; id: string },
  detail?: Record<string, unknown>,
) {
  await admin.firestore().collection("auditLogs").add({
    actorId, action,
    targetType: target.type, targetId: target.id,
    detail: detail ?? null,
    at: admin.firestore.Timestamp.now(),
  });
}

// Chuẩn hóa SĐT Việt Nam về E.164 (+84...).
// Chấp nhận: "+84905...", "0905...", "905...", "84 905 ...", có dấu cách/gạch.
// Trả null nếu format sai.
export function normalizeVNPhone(input: string): string | null {
  if (!input) return null;
  const raw = input.trim().replace(/[\s.-]/g, "");
  let digits = raw.startsWith("+") ? raw.slice(1) : raw;
  digits = digits.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "84" + digits.slice(1);
  if (!digits.startsWith("84")) digits = "84" + digits;
  // SĐT VN sau mã quốc gia: 9 chữ số → total 11
  if (digits.length !== 11) return null;
  return "+" + digits;
}

// Trả về 3 format có thể của 1 SĐT VN (raw input, local 0..., E.164 +84...)
// Dùng cho query `where("phone", "in", [...])` để bắt cả 3 format dữ liệu cũ.
export function phoneVariants(input: string): { e164: string; local: string; raw: string } | null {
  const raw = input.trim();
  const e164 = normalizeVNPhone(raw);
  if (!e164) return null;
  return { e164, local: "0" + e164.slice(3), raw };
}
