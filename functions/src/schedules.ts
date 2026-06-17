import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

const REGION = "asia-southeast1";
const TZ = "Asia/Ho_Chi_Minh";
const db = () => admin.firestore();

// ===== 1) Hết hạn vé & khóa học (00:05 mỗi ngày) =====
export const expireServicesDaily = onSchedule(
  { schedule: "5 0 * * *", timeZone: TZ, region: REGION },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const mems = await db().collection("memberships")
      .where("status", "==", "ACTIVE").where("endDate", "<", now).get();
    const b1 = db().batch();
    mems.forEach((d) => b1.update(d.ref, { status: "EXPIRED" }));
    await b1.commit();

    // Khóa học hết hạn → EXPIRED + giải phóng slot + thông báo lý do
    const enrolls = await db().collection("enrollments")
      .where("status", "==", "ACTIVE").where("expiryDate", "<", now).get();
    for (const d of enrolls.docs) {
      const e = d.data();
      await db().runTransaction(async (tx) => {
        const slotRef = db().doc(`coaches/${e.coachId}/slots/${e.slotId}`);
        const slot = await tx.get(slotRef);
        tx.update(d.ref, { status: "EXPIRED", expiredAt: now });
        if (slot.exists)
          tx.update(slotRef, { enrolledCount: Math.max(0, (slot.data()!.enrolledCount ?? 1) - 1) });
      });
      const attended = e.attendedSessions ?? 0;
      await notify(e.parentId ?? e.studentId, "Khóa học đã kết thúc",
        `Khóa học kết thúc sau 90 ngày. Đã học ${attended}/15 buổi; số buổi còn lại ` +
        `không được bảo lưu theo quy định. Đăng ký khóa mới nếu muốn tiếp tục.`, "COURSE_EXPIRED");
    }
  }
);

// ===== 2) Hủy đơn chưa thanh toán quá 24h (mỗi giờ) =====
export const cancelUnpaidOrdersHourly = onSchedule(
  { schedule: "0 * * * *", timeZone: TZ, region: REGION },
  async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 3600_000);
    const stale = await db().collection("orders")
      .where("status", "==", "PENDING_PAYMENT").where("createdAt", "<", cutoff).get();
    for (const d of stale.docs) {
      const o = d.data();
      await db().runTransaction(async (tx) => {
        if (o.productType === "SWIM_COURSE" && o.coachId && o.slotId) {
          const slotRef = db().doc(`coaches/${o.coachId}/slots/${o.slotId}`);
          const slot = await tx.get(slotRef);
          if (slot.exists)
            tx.update(slotRef, { enrolledCount: Math.max(0, (slot.data()!.enrolledCount ?? 1) - 1) });
        }
        tx.update(d.ref, { status: "CANCELLED", cancelledAt: admin.firestore.Timestamp.now() });
      });
    }
  }
);

// ===== 3) Nhắc còn 30/7/1 ngày & 10/5/1 buổi (08:00 mỗi ngày) =====
export const notifyExpiringDaily = onSchedule(
  { schedule: "0 8 * * *", timeZone: TZ, region: REGION },
  async () => {
    const now = new Date();
    const dayKeys = [30, 7, 1].map((n) => {
      const t = new Date(now); t.setDate(t.getDate() + n);
      return { n, key: t.toISOString().slice(0, 10) };
    });

    const mems = await db().collection("memberships").where("status", "==", "ACTIVE").get();
    for (const m of mems.docs) {
      const key = m.data().endDate.toDate().toISOString().slice(0, 10);
      const hit = dayKeys.find((x) => x.key === key);
      if (hit) await notify(m.data().userId, "Vé sắp hết hạn",
        `Vé của bạn còn ${hit.n} ngày.`, "EXPIRY_WARNING");
    }

    const enrolls = await db().collection("enrollments").where("status", "==", "ACTIVE").get();
    for (const e of enrolls.docs) {
      const data = e.data();
      const to = data.parentId ?? data.studentId;
      const key = data.expiryDate.toDate().toISOString().slice(0, 10);
      const hit = dayKeys.find((x) => x.key === key);
      if (hit) await notify(to, "Khóa học sắp hết hạn", `Khóa học còn ${hit.n} ngày.`, "EXPIRY_WARNING");
      const remaining = 15 - (data.attendedSessions ?? 0);
      if ([10, 5, 1].includes(remaining))
        await notify(to, "Sắp hết buổi học", `Khóa học của bạn còn ${remaining} buổi.`, "COURSE_REMAINING");
    }
  }
);

// ===== 4) Tổng hợp doanh thu ngày/tháng (23:55) =====
export const aggregateDailyStats = onSchedule(
  { schedule: "55 23 * * *", timeZone: TZ, region: REGION },
  async () => {
    const dayKey = new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
    const monthKey = dayKey.slice(0, 7);
    const start = admin.firestore.Timestamp.fromDate(new Date(`${dayKey}T00:00:00+07:00`));
    const end = admin.firestore.Timestamp.fromDate(new Date(`${dayKey}T23:59:59+07:00`));

    const checkins = await db().collection("checkins")
      .where("at", ">=", start).where("at", "<=", end).get();
    const paidOrders = await db().collection("orders").where("status", "==", "PAID")
      .where("paidAt", ">=", start).where("paidAt", "<=", end).get();

    const revenueByType: Record<string, number> = {};
    let total = 0;
    paidOrders.forEach((o) => {
      const t = o.data().productType;
      revenueByType[t] = (revenueByType[t] ?? 0) + (o.data().amountVND ?? 0);
      total += o.data().amountVND ?? 0;
    });

    await db().doc(`dailyStats/${dayKey}`).set({
      date: dayKey,
      totalCheckins: checkins.docs.reduce((s, c) => s + (c.data().groupSize ?? 1), 0),
      studentsAttended: checkins.docs.filter((c) => c.data().kind === "COURSE").length,
      revenue: total, revenueByType,
    });

    const monthRef = db().doc(`monthlyStats/${monthKey}`);
    await db().runTransaction(async (tx) => {
      const cur = await tx.get(monthRef);
      const prev = cur.exists ? cur.data()!.revenueByType ?? {} : {};
      const merged: Record<string, number> = { ...prev };
      for (const [k, v] of Object.entries(revenueByType)) merged[k] = (merged[k] ?? 0) + v;
      tx.set(monthRef, { month: monthKey, revenueByType: merged }, { merge: true });
    });
  }
);

async function notify(uid: string, title: string, body: string, type: string) {
  const u = await db().doc(`users/${uid}`).get();
  await db().collection("users").doc(uid).collection("notifications").add({
    title, body, type, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const tokens: string[] = u.data()?.fcmTokens ?? [];
  if (tokens.length)
    await admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } });
}
