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
