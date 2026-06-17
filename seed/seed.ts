/**
 * Khởi tạo dữ liệu mẫu (chạy 1 lần):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="đường-dẫn-service-account.json"
 *   npx tsx seed/seed.ts
 *
 * Tạo: products (bảng giá 3 đối tượng), coaches + 10 ca/ngày.
 */
import * as admin from "firebase-admin";
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const PASS_PRICES = {
  CHILD_UNDER_140: { MONTH_1: 400000, MONTH_3: 1000000, MONTH_6: 1800000, YEAR_1: 3500000 },
  CHILD_OVER_140: { MONTH_1: 450000, MONTH_3: 1150000, MONTH_6: 2150000, YEAR_1: 4200000 },
  ADULT: { MONTH_1: 500000, MONTH_3: 1300000, MONTH_6: 2300000, YEAR_1: 4400000 },
};
const PACKAGE_PRICES = {
  CHILD_UNDER_140: { PACK_15: 300000, PACK_30: 550000 },
  CHILD_OVER_140: { PACK_15: 350000, PACK_30: 700000 },
  ADULT: { PACK_15: 450000, PACK_30: 800000 },
};
const PASS_LABEL: Record<string, string> = {
  MONTH_1: "Vé tháng", MONTH_3: "Vé quý", MONTH_6: "Vé 6 tháng", YEAR_1: "Vé năm",
};
const PACK_LABEL: Record<string, string> = { PACK_15: "Gói 15 lượt", PACK_30: "Gói 30 lượt" };
const STYLES = [
  ["BREASTSTROKE", "Bơi cơ bản (ếch)"], ["FREESTYLE", "Bơi sải"],
  ["BACKSTROKE", "Bơi ngửa"], ["BUTTERFLY", "Bơi bướm"],
];
const START_HOURS = [7, 8, 9, 10, 14, 15, 16, 17, 18, 19];

async function main() {
  // ---- PASS products (1 doc/thời hạn, giá theo đối tượng) ----
  for (const dur of ["MONTH_1", "MONTH_3", "MONTH_6", "YEAR_1"]) {
    await db.doc(`products/pass_${dur}`).set({
      id: `pass_${dur}`, type: "PASS", duration: dur, name: PASS_LABEL[dur],
      priceByAudience: {
        CHILD_UNDER_140: (PASS_PRICES as any).CHILD_UNDER_140[dur],
        CHILD_OVER_140: (PASS_PRICES as any).CHILD_OVER_140[dur],
        ADULT: (PASS_PRICES as any).ADULT[dur],
      },
      active: true,
    });
  }

  // ---- PACKAGE products ----
  for (const size of ["PACK_15", "PACK_30"]) {
    await db.doc(`products/pack_${size}`).set({
      id: `pack_${size}`, type: "PACKAGE", packageSize: size, name: PACK_LABEL[size],
      priceByAudience: {
        CHILD_UNDER_140: (PACKAGE_PRICES as any).CHILD_UNDER_140[size],
        CHILD_OVER_140: (PACKAGE_PRICES as any).CHILD_OVER_140[size],
        ADULT: (PACKAGE_PRICES as any).ADULT[size],
      },
      active: true,
    });
  }

  // ---- SWIM_COURSE products (giá phẳng) ----
  for (const [id, name] of STYLES) {
    await db.doc(`products/course_${id}`).set({
      id: `course_${id}`, type: "SWIM_COURSE", swimStyle: id, name,
      flatPrice: 1800000, active: true,
    });
  }

  // ---- Vé lẻ (pricingRules — tham khảo) ----
  await db.doc("pricingRules/single").set({
    CHILD_UNDER_140: 25000, CHILD_OVER_140: 30000, ADULT: 35000, ADULT_WITH_TODDLER: 40000,
  });

  // ---- Coaches + 10 ca/ngày ----
  const coaches = [
    { id: "tung", fullName: "Thầy Tùng", weekdays: [3, 5, 0] },
    { id: "tin", fullName: "Thầy Tín", weekdays: [2, 4, 6] },
  ];
  for (const c of coaches) {
    await db.doc(`coaches/${c.id}`).set({
      id: c.id, userId: `${c.id}-uid`, fullName: c.fullName, phone: "",
      weekdays: c.weekdays, active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    for (const wd of c.weekdays) {
      for (const h of START_HOURS) {
        const id = `${c.id}_${wd}_${h}`;
        await db.doc(`coaches/${c.id}/slots/${id}`).set({
          id, coachId: c.id, weekday: wd, startHour: h, endHour: h + 1,
          capacity: 20, enrolledCount: 0,
        });
      }
    }
  }

  await db.doc("counters/memberCode").set({ value: 100 }, { merge: true });
  console.log("✅ Seed xong: products, pricingRules, 2 HLV, 60 ca/tuần.");
}
main().catch((e) => { console.error(e); process.exit(1); });
