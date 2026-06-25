import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { SLOT_CAPACITY } from "./pricing";

const REGION = "asia-southeast1";
const db = () => admin.firestore();
const FV = admin.firestore.FieldValue;

function requireOwner(req: { auth?: { token?: Record<string, unknown> } }) {
  if ((req.auth?.token as { role?: string } | undefined)?.role !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ Owner được thực hiện");
}

// ============== UPDATE PRICING ==============
// data: { pricing: PricingSettings } — ghi đè toàn bộ ma trận giá
export const updatePricing = onCall({ region: REGION }, async (req) => {
  requireOwner(req);
  const { pricing } = req.data as { pricing: Record<string, unknown> };
  if (!pricing || typeof pricing !== "object")
    throw new HttpsError("invalid-argument", "Thiếu dữ liệu pricing");

  // Đọc giá cũ để tính diff cho audit log (INV-12)
  const prevSnap = await db().doc("settings/pricing").get();
  const prev = prevSnap.exists ? prevSnap.data() : {};

  await db().doc("settings/pricing").set(
    { ...pricing, updatedAt: FV.serverTimestamp(), updatedBy: req.auth!.uid },
    { merge: true },
  );
  await db().collection("auditLogs").add({
    actorId: req.auth!.uid, action: "UPDATE_PRICING",
    targetType: "settings", targetId: "pricing",
    detail: { before: prev, after: pricing },
    at: admin.firestore.Timestamp.now(),
  });
  return { ok: true };
});

// ============== COACHES CRUD ==============
const START_HOURS = [7, 8, 9, 10, 14, 15, 16, 17, 18, 19];

// data: { id?, fullName, phone?, weekdays: number[] }
// Nếu không truyền id → tạo mới (id = slug fullName); có id → cập nhật.
export const upsertCoach = onCall({ region: REGION }, async (req) => {
  requireOwner(req);
  const { id, fullName, phone, weekdays } = req.data as {
    id?: string; fullName: string; phone?: string; weekdays: number[];
  };
  if (!fullName?.trim()) throw new HttpsError("invalid-argument", "Thiếu họ tên HLV");
  if (!Array.isArray(weekdays) || weekdays.length === 0)
    throw new HttpsError("invalid-argument", "Phải chọn ít nhất 1 ngày dạy");

  const coachId = id || slugify(fullName);
  const ref = db().doc(`coaches/${coachId}`);
  const existing = await ref.get();

  if (existing.exists) {
    const oldWeekdays = (existing.data()!.weekdays ?? []) as number[];
    // Cập nhật thông tin
    await ref.set({ fullName, phone: phone ?? "", weekdays, active: true }, { merge: true });
    // Xóa slots ngày không còn dạy (nếu không có HV enrolled)
    const removed = oldWeekdays.filter((w) => !weekdays.includes(w));
    for (const wd of removed) {
      const slotsToDel = await db().collection(`coaches/${coachId}/slots`).where("weekday", "==", wd).get();
      for (const s of slotsToDel.docs) {
        if ((s.data().enrolledCount ?? 0) > 0)
          throw new HttpsError("failed-precondition", `Ngày ${wd} còn học viên đang theo học, không thể xóa`);
        await s.ref.delete();
      }
    }
    // Thêm slots cho ngày mới
    const added = weekdays.filter((w) => !oldWeekdays.includes(w));
    for (const wd of added) await seedSlotsFor(coachId, wd);
  } else {
    // userId = null cho đến khi HLV đăng nhập app và Owner gán role COACH (qua setUserRole)
    await ref.set({
      id: coachId, userId: null, fullName, phone: phone ?? "",
      weekdays, active: true, createdAt: FV.serverTimestamp(),
    });
    for (const wd of weekdays) await seedSlotsFor(coachId, wd);
  }

  await db().collection("auditLogs").add({
    actorId: req.auth!.uid, action: existing.exists ? "UPDATE_COACH" : "CREATE_COACH",
    targetType: "coach", targetId: coachId,
    detail: { fullName, weekdays }, at: admin.firestore.Timestamp.now(),
  });
  return { ok: true, id: coachId };
});

// Khoá / mở khoá HLV (không xoá hẳn để giữ lịch sử)
export const setCoachActive = onCall({ region: REGION }, async (req) => {
  requireOwner(req);
  const { id, active } = req.data as { id: string; active: boolean };
  await db().doc(`coaches/${id}`).set({ active }, { merge: true });
  await db().collection("auditLogs").add({
    actorId: req.auth!.uid, action: "SET_COACH_ACTIVE",
    targetType: "coach", targetId: id, detail: { active }, at: admin.firestore.Timestamp.now(),
  });
  return { ok: true };
});

async function seedSlotsFor(coachId: string, weekday: number) {
  for (const h of START_HOURS) {
    const id = `${coachId}_${weekday}_${h}`;
    await db().doc(`coaches/${coachId}/slots/${id}`).set({
      id, coachId, weekday, startHour: h, endHour: h + 1,
      capacity: SLOT_CAPACITY, enrolledCount: 0,
    });
  }
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

// ============== DELETE ORDER (v2.3) ==============
// v2.3 — Xóa 1-click, không cần lý do (Owner UX feedback 2026-06-22):
// - Mọi trạng thái (PENDING_PAYMENT / PAID / CANCELLED / REFUNDED) đều xóa được.
// - Doc /orders/{id} bị xóa cứng. Snapshot order được giữ trong /auditLogs để recovery thủ công.
// - Thẻ/payment đã sinh: gắn cờ `orderDeleted:true` để loại khỏi báo cáo, không xóa data (khách vẫn dùng được).
// - Trả slot nếu PENDING khóa học. KHÔNG tự refund — Owner dùng refundOrder riêng nếu cần.
export const deleteOrder = onCall({ region: REGION }, async (req) => {
  requireOwner(req);
  const { orderId, reason } = req.data as { orderId: string; reason?: string };
  const orderRef = db().doc(`orders/${orderId}`);

  let prevStatus = "";
  let productType = "";
  let orderSnapshot: Record<string, unknown> = {};

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Đơn không tồn tại");
    const o = snap.data()!;
    prevStatus = o.status;
    productType = o.productType;
    // Snapshot order để lưu vào auditLog (recovery khi cần)
    orderSnapshot = {
      customerId: o.customerId ?? null,
      beneficiaryKind: o.beneficiaryKind ?? null,
      beneficiaryId: o.beneficiaryId ?? null,
      beneficiaryName: o.beneficiaryName ?? null,
      productType: o.productType ?? null,
      productSnapshot: o.productSnapshot ?? null,
      amountVND: o.amountVND ?? 0,
      coachId: o.coachId ?? null,
      slotId: o.slotId ?? null,
      startDate: o.startDate ?? null,
      createdAt: o.createdAt ?? null,
      paidAt: o.paidAt ?? null,
    };

    if (o.status === "PENDING_PAYMENT" && o.productType === "SWIM_COURSE" && o.coachId && o.slotId) {
      const slotRef = db().doc(`coaches/${o.coachId}/slots/${o.slotId}`);
      const slot = await tx.get(slotRef);
      if (slot.exists)
        tx.update(slotRef, { enrolledCount: Math.max(0, (slot.data()!.enrolledCount ?? 1) - 1) });
    }
    tx.delete(orderRef);
  });

  // Gắn cờ vào thẻ/payment liên quan (ngoài transaction)
  if (prevStatus !== "PENDING_PAYMENT") {
    for (const col of ["memberships", "ticketPackages", "enrollments", "payments"] as const) {
      const q = await db().collection(col).where("orderId", "==", orderId).get();
      const batch = db().batch();
      q.forEach((d) => batch.update(d.ref, { orderDeleted: true, orderDeletedAt: FV.serverTimestamp() }));
      if (!q.empty) await batch.commit();
    }
  }

  await db().collection("auditLogs").add({
    actorId: req.auth!.uid,
    action: "DELETE_ORDER",
    targetType: "order",
    targetId: orderId,
    detail: {
      reason: reason ?? null,
      prevStatus,
      productType,
      // Snapshot đủ thông tin để dựng lại order thủ công nếu cần
      orderSnapshot,
    },
    at: admin.firestore.Timestamp.now(),
  });
  return { ok: true };
});
