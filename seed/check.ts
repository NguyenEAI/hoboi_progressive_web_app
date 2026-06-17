import * as admin from "firebase-admin";
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function main() {
  const cols = ["products", "coaches", "pricingRules", "counters"];
  for (const c of cols) {
    const s = await db.collection(c).count().get();
    console.log(`/${c}: ${s.data().count} doc`);
  }
  // Đếm slots toàn hệ thống
  let totalSlots = 0;
  const coaches = await db.collection("coaches").get();
  for (const c of coaches.docs) {
    const s = await db.collection(`coaches/${c.id}/slots`).count().get();
    totalSlots += s.data().count;
  }
  console.log(`Tổng slots: ${totalSlots}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
