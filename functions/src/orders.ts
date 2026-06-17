import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  Audience, PassDuration, PackageSize, SwimStyle,
  PASS_PRICES as FB_PASS, PASS_DAYS, PACKAGE_PRICES as FB_PKG, PACKAGE_SESSIONS,
  SWIM_COURSE_PRICE as FB_COURSE, SWIM_COURSE_TOTAL_SESSIONS, SWIM_COURSE_VALIDITY_DAYS,
  SLOT_CAPACITY, passLabel, packLabel, styleLabel,
} from "./pricing";

// Đọc bảng giá hiện tại từ Firestore /settings/pricing.
// Fallback về giá hardcode nếu doc chưa tồn tại (chưa seed pricing).
async function loadPricing(): Promise<{
  pass: Record<Audience, Record<PassDuration, number>>;
  pkg: Record<Audience, Record<PackageSize, number>>;
  course: number;
}> {
  const snap = await admin.firestore().doc("settings/pricing").get();
  if (!snap.exists) return { pass: FB_PASS, pkg: FB_PKG, course: FB_COURSE };
  const d = snap.data() as Record<string, unknown>;
  return {
    pass: (d.pass as typeof FB_PASS) ?? FB_PASS,
    pkg: (d.package as typeof FB_PKG) ?? FB_PKG,
    course: (d.swimCourse as number) ?? FB_COURSE,
  };
}

const REGION = "asia-southeast1";
const db = () => admin.firestore();
const FV = admin.firestore.FieldValue;

function requireAuth(req: any): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  return req.auth.uid;
}
function requireStaff(req: any) {
  const role = req.auth?.token?.role;
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  if (!["OWNER", "RECEPTIONIST"].includes(role))
    throw new HttpsError("permission-denied", "Không đủ quyền");
}

// Sinh số thẻ (MS) tăng dần qua counter
async function nextMemberCode(tx: FirebaseFirestore.Transaction): Promise<string> {
  const ref = db().doc("counters/memberCode");
  const snap = await tx.get(ref);
  const cur = snap.exists ? (snap.data()!.value as number) : 100;
  const next = cur + 1;
  tx.set(ref, { value: next }, { merge: true });
  return String(next);
}

// =============== CREATE ORDER ===============
// data: { productType, duration?, packageSize?, swimStyle?, audience?,
//         beneficiaryKind, beneficiaryId, beneficiaryName, coachId?, slotId?, startDate? }
export const createOrder = onCall({ region: REGION }, async (req) => {
  const uid = requireAuth(req);
  const d = req.data as any;
  const { productType, beneficiaryKind, beneficiaryId, beneficiaryName } = d;

  let amountVND = 0;
  const snapshot: { [k: string]: unknown } = { audience: d.audience ?? null };
  const prices = await loadPricing();

  if (productType === "PASS") {
    const aud = d.audience as Audience;
    const dur = d.duration as PassDuration;
    if (!prices.pass[aud]?.[dur]) throw new HttpsError("invalid-argument", "Sai loại vé/đối tượng");
    amountVND = prices.pass[aud][dur];
    snapshot.name = passLabel(dur);
    snapshot.duration = dur;
  } else if (productType === "PACKAGE") {
    const aud = d.audience as Audience;
    const size = d.packageSize as PackageSize;
    if (!prices.pkg[aud]?.[size]) throw new HttpsError("invalid-argument", "Sai gói/đối tượng");
    amountVND = prices.pkg[aud][size];
    snapshot.name = packLabel(size);
    snapshot.packageSize = size;
  } else if (productType === "SWIM_COURSE") {
    const style = d.swimStyle as SwimStyle;
    if (!d.coachId || !d.slotId || !d.startDate)
      throw new HttpsError("invalid-argument", "Thiếu HLV/khung giờ/ngày bắt đầu");
    amountVND = prices.course;
    snapshot.name = styleLabel(style);
    snapshot.swimStyle = style;
  } else {
    throw new HttpsError("invalid-argument", "Loại sản phẩm không hợp lệ");
  }

  const baseOrder = {
    customerId: uid,
    beneficiaryKind: beneficiaryKind ?? "USER",
    beneficiaryId: beneficiaryId ?? uid,
    beneficiaryName: beneficiaryName ?? "",
    productType,
    productSnapshot: snapshot,
    amountVND,
    status: "PENDING_PAYMENT",
    createdAt: FV.serverTimestamp(),
  };

  // Khóa học: giữ chỗ slot trong transaction
  if (productType === "SWIM_COURSE") {
    const slotRef = db().doc(`coaches/${d.coachId}/slots/${d.slotId}`);
    return await db().runTransaction(async (tx) => {
      const slot = await tx.get(slotRef);
      if (!slot.exists) throw new HttpsError("not-found", "Khung giờ không tồn tại");
      const s = slot.data()!;
      if ((s.enrolledCount ?? 0) >= (s.capacity ?? SLOT_CAPACITY))
        throw new HttpsError("resource-exhausted", "Khung giờ đã đầy 20/20");
      tx.update(slotRef, { enrolledCount: (s.enrolledCount ?? 0) + 1 });

      const orderRef = db().collection("orders").doc();
      tx.set(orderRef, {
        ...baseOrder, id: orderRef.id,
        coachId: d.coachId, slotId: d.slotId,
        startDate: admin.firestore.Timestamp.fromDate(new Date(d.startDate)),
      });
      return { orderId: orderRef.id, amountVND };
    });
  }

  const orderRef = db().collection("orders").doc();
  await orderRef.set({ ...baseOrder, id: orderRef.id });
  return { orderId: orderRef.id, amountVND };
});

// =============== CONFIRM PAYMENT ===============
export const confirmPayment = onCall({ region: REGION }, async (req) => {
  requireStaff(req);
  const { orderId } = req.data as any;
  const orderRef = db().doc(`orders/${orderId}`);

  const result = await db().runTransaction(async (tx) => {
    // --- TẤT CẢ READ TRƯỚC ---
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Đơn hàng không tồn tại");
    const o = snap.data()!;
    if (o.status !== "PENDING_PAYMENT")
      throw new HttpsError("failed-precondition", `Đơn đang ở trạng thái ${o.status}`);
    const ps = o.productSnapshot;

    // đọc coach trước (nếu là khóa học) — phải trước mọi write
    let coachName = "";
    if (o.productType === "SWIM_COURSE") {
      const coachSnap = await tx.get(db().doc(`coaches/${o.coachId}`));
      coachName = coachSnap.data()?.fullName ?? "";
    }
    // nextMemberCode đọc rồi ghi counter — đặt cuối cùng trong nhóm read
    const now = admin.firestore.Timestamp.now();
    const code = await nextMemberCode(tx);

    if (o.productType === "PASS") {
      const days = PASS_DAYS[ps.duration as PassDuration];
      const end = new Date(); end.setDate(end.getDate() + days);
      const ref = db().collection("memberships").doc();
      tx.set(ref, {
        id: ref.id, memberCode: code, userId: o.customerId,
        holderKind: o.beneficiaryKind, holderId: o.beneficiaryId, holderName: o.beneficiaryName,
        orderId, duration: ps.duration, audience: ps.audience,
        startDate: now, endDate: admin.firestore.Timestamp.fromDate(end),
        amountVND: o.amountVND, status: "ACTIVE", createdAt: now,
      });
    } else if (o.productType === "PACKAGE") {
      const total = PACKAGE_SESSIONS[ps.packageSize as PackageSize];
      const ref = db().collection("ticketPackages").doc();
      tx.set(ref, {
        id: ref.id, memberCode: code, userId: o.customerId, orderId,
        size: ps.packageSize, audience: ps.audience,
        totalSessions: total, remainingSessions: total,
        amountVND: o.amountVND, status: "ACTIVE", usageHistory: [], createdAt: now,
      });
    } else if (o.productType === "SWIM_COURSE") {
      const start = o.startDate ? o.startDate.toDate() : new Date();
      const expiry = new Date(start);
      expiry.setDate(expiry.getDate() + SWIM_COURSE_VALIDITY_DAYS);
      const ref = db().collection("enrollments").doc();
      tx.set(ref, {
        id: ref.id, memberCode: code,
        studentKind: o.beneficiaryKind, studentId: o.beneficiaryId, studentName: o.beneficiaryName,
        parentId: o.beneficiaryKind === "CHILD" ? o.customerId : null,
        orderId, swimStyle: ps.swimStyle,
        coachId: o.coachId, coachName,
        slotId: o.slotId,
        startDate: o.startDate, expiryDate: admin.firestore.Timestamp.fromDate(expiry),
        totalSessions: SWIM_COURSE_TOTAL_SESSIONS, attendedSessions: 0,
        status: "ACTIVE", createdAt: now,
      });
    }

    tx.set(db().collection("payments").doc(), {
      orderId, amountVND: o.amountVND, method: "CASH",
      receivedByStaffId: req.auth!.uid, at: now,
    });
    tx.update(orderRef, { status: "PAID", paidAt: now, confirmedByStaffId: req.auth!.uid });
    return { ok: true, memberCode: code, customerId: o.customerId, productName: ps.name as string };
  });

  // Sau khi PAID thành công → notify khách (ngoài transaction để giữ tx nhẹ)
  try {
    await notifyUser(
      result.customerId,
      "Thẻ đã kích hoạt 🎉",
      `${result.productName} của bạn đã sẵn sàng. Cùng đi bơi nhé! 🌊`,
      "SERVICE_ACTIVATED",
    );
  } catch (e) {
    console.warn("notifyUser sau confirmPayment thất bại", e);
  }
  return { ok: true, memberCode: result.memberCode };
});

async function notifyUser(uid: string, title: string, body: string, type: string) {
  const u = await db().doc(`users/${uid}`).get();
  await db().collection("users").doc(uid).collection("notifications").add({
    title, body, type, read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const tokens: string[] = u.data()?.fcmTokens ?? [];
  if (tokens.length)
    await admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } });
}

// =============== CANCEL ORDER (chưa thanh toán) ===============
export const cancelOrder = onCall({ region: REGION }, async (req) => {
  const uid = requireAuth(req);
  const { orderId, reason } = req.data as { orderId: string; reason?: string };
  const orderRef = db().doc(`orders/${orderId}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Đơn không tồn tại");
    const o = snap.data()!;
    const role = req.auth?.token?.role;
    const isStaff = ["OWNER", "RECEPTIONIST"].includes(role);
    if (o.customerId !== uid && !isStaff)
      throw new HttpsError("permission-denied", "Không đủ quyền");
    if (o.status !== "PENDING_PAYMENT")
      throw new HttpsError("failed-precondition", "Chỉ hủy được đơn chưa thanh toán");
    if (o.productType === "SWIM_COURSE" && o.coachId && o.slotId)
      await releaseSlot(tx, o.coachId, o.slotId);
    tx.update(orderRef, {
      status: "CANCELLED",
      cancelledAt: admin.firestore.Timestamp.now(),
      cancelledBy: req.auth!.uid,
    });
  });
  // Audit log (INV-12)
  await db().collection("auditLogs").add({
    actorId: req.auth!.uid, action: "CANCEL_ORDER",
    targetType: "order", targetId: orderId,
    detail: { reason: reason ?? null },
    at: admin.firestore.Timestamp.now(),
  });
  return { ok: true };
});

// =============== REFUND (chỉ Owner, bắt buộc lý do) ===============
export const refundOrder = onCall({ region: REGION }, async (req) => {
  const role = req.auth?.token?.role;
  if (role !== "OWNER") throw new HttpsError("permission-denied", "Chỉ Owner được hoàn tiền");
  const { orderId, reason } = req.data as any;
  if (!reason || !String(reason).trim())
    throw new HttpsError("invalid-argument", "Bắt buộc nhập lý do hoàn tiền");

  const orderRef = db().doc(`orders/${orderId}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Đơn không tồn tại");
    const o = snap.data()!;
    if (o.status !== "PAID")
      throw new HttpsError("failed-precondition", "Chỉ hoàn được đơn đã thanh toán");

    // Trả slot nếu là khóa học (khóa thẻ dịch vụ xử lý ngoài transaction bên dưới)
    if (o.productType === "SWIM_COURSE" && o.coachId && o.slotId)
      await releaseSlot(tx, o.coachId, o.slotId);

    tx.update(orderRef, {
      status: "REFUNDED",
      refund: { byOwnerId: req.auth!.uid, reason: String(reason), at: admin.firestore.Timestamp.now() },
    });
    tx.set(db().collection("auditLogs").doc(), {
      actorId: req.auth!.uid, action: "REFUND_ORDER",
      targetType: "order", targetId: orderId, detail: { reason },
      at: admin.firestore.Timestamp.now(),
    });
  });
  // Khóa thẻ liên quan (ngoài transaction cho đơn giản)
  await suspendServiceByOrder(orderId);
  return { ok: true };
});

async function releaseSlot(tx: FirebaseFirestore.Transaction, coachId: string, slotId: string) {
  const slotRef = db().doc(`coaches/${coachId}/slots/${slotId}`);
  const slot = await tx.get(slotRef);
  if (slot.exists)
    tx.update(slotRef, { enrolledCount: Math.max(0, (slot.data()!.enrolledCount ?? 1) - 1) });
}

async function suspendServiceByOrder(orderId: string) {
  for (const [col, status] of [["memberships", "SUSPENDED"], ["ticketPackages", "SUSPENDED"], ["enrollments", "CANCELLED"]] as const) {
    const q = await db().collection(col).where("orderId", "==", orderId).get();
    const batch = db().batch();
    q.forEach((doc) => batch.update(doc.ref, { status }));
    if (!q.empty) await batch.commit();
  }
}
