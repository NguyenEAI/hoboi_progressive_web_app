import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const raw = readFileSync(join(process.cwd(), "service-account.json"), "utf8");
  const serviceAccount = JSON.parse(raw);
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return "+84" + digits.slice(1);
  if (/^84\d{9}$/.test(digits)) return "+" + digits;
  if (/^\d{9}$/.test(digits)) return "+84" + digits;
  if (/^\+84\d{9}$/.test(input)) return input;
  throw new Error("SĐT test không hợp lệ");
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.E2E_DISABLE_APP_VERIFICATION !== "1") {
    return NextResponse.json({ error: "Chỉ mở trong chế độ kiểm thử nội bộ" }, { status: 403 });
  }
  try {
    getAdminApp();
    const phone = normalizePhone(req.nextUrl.searchParams.get("phone") ?? "");
    const user = await admin.auth().getUserByPhoneNumber(phone);
    const snap = await admin.firestore().doc(`users/${user.uid}`).get();
    const role = snap.data()?.role ?? "CUSTOMER";
    const token = await admin.auth().createCustomToken(user.uid, { role });
    return NextResponse.json({ token, uid: user.uid, role });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
