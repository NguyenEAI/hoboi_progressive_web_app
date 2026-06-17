/**
 * Gán vai trò cho tài khoản (OWNER / RECEPTIONIST / COACH / CUSTOMER).
 * Đặt custom claim (để Security Rules nhận) + cập nhật doc /users.
 *
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="service-account.json"
 *   npx tsx seed/setRole.ts +84905123456 OWNER
 *   npx tsx seed/setRole.ts +84903000222 COACH tin   # tham số 4: gán vào coaches/{id}.userId
 */
import * as admin from "firebase-admin";
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const ROLES = ["OWNER", "RECEPTIONIST", "COACH", "CUSTOMER", "PARENT"];

async function main() {
  const [phone, role, coachId] = process.argv.slice(2);
  if (!phone || !ROLES.includes(role)) {
    console.error("Dùng: npx tsx seed/setRole.ts <+84...> <OWNER|RECEPTIONIST|COACH|CUSTOMER|PARENT> [coachId]");
    process.exit(1);
  }

  // Tìm user theo SĐT (Auth)
  const user = await admin.auth().getUserByPhoneNumber(phone).catch(() => null);
  if (!user) { console.error(`Không tìm thấy tài khoản với SĐT ${phone}. Hãy đăng nhập app 1 lần trước.`); process.exit(1); }

  await admin.auth().setCustomUserClaims(user.uid, { role });
  await db.doc(`users/${user.uid}`).set({ role }, { merge: true });

  // Nếu là COACH và có coachId → liên kết coaches/{id}.userId
  if (role === "COACH" && coachId) {
    await db.doc(`coaches/${coachId}`).set({ userId: user.uid }, { merge: true });
    console.log(`Đã liên kết coaches/${coachId}.userId = ${user.uid}`);
  }

  console.log(`✅ ${phone} → ${role}. Người dùng cần ĐĂNG XUẤT & ĐĂNG NHẬP LẠI để claim có hiệu lực.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
