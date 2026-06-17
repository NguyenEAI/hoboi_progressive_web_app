/**
 * Seed/reset /settings/pricing về giá gốc.
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="service-account.json"
 *   npx tsx seed/seedPricing.ts
 */
import * as admin from "firebase-admin";
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const DEFAULT = {
  pass: {
    CHILD_UNDER_140: { MONTH_1: 400_000, MONTH_3: 1_000_000, MONTH_6: 1_800_000, YEAR_1: 3_500_000 },
    CHILD_OVER_140: { MONTH_1: 450_000, MONTH_3: 1_150_000, MONTH_6: 2_150_000, YEAR_1: 4_200_000 },
    ADULT: { MONTH_1: 500_000, MONTH_3: 1_300_000, MONTH_6: 2_300_000, YEAR_1: 4_400_000 },
  },
  package: {
    CHILD_UNDER_140: { PACK_15: 300_000, PACK_30: 550_000 },
    CHILD_OVER_140: { PACK_15: 350_000, PACK_30: 700_000 },
    ADULT: { PACK_15: 450_000, PACK_30: 800_000 },
  },
  swimCourse: 1_800_000,
  singleTicket: { CHILD_UNDER_140: 25_000, CHILD_OVER_140: 30_000, ADULT: 35_000, ADULT_WITH_TODDLER: 40_000 },
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

async function main() {
  await db.doc("settings/pricing").set(DEFAULT);
  console.log("✅ Seeded /settings/pricing");
}
main().catch((e) => { console.error(e); process.exit(1); });
