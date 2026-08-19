import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";

// Bọc gọn các Cloud Functions callable, có kiểu trả về.
function call<TReq, TRes>(name: string) {
  const fn = httpsCallable<TReq, TRes>(functions, name);
  return async (data: TReq): Promise<TRes> => (await fn(data)).data;
}

export const createOrder = call<
  {
    productType: "PASS" | "PACKAGE" | "SWIM_COURSE";
    duration?: string; packageSize?: string; swimStyle?: string; audience?: string;
    beneficiaryKind: "USER" | "CHILD"; beneficiaryId: string; beneficiaryName: string;
    passPhoto?: { storagePath: string };
    coachId?: string;
    // legacy
    slotId?: string; startDate?: string;
    // v2.1: server tự chọn weekday + tính startDate
    startHour?: number; weekOffset?: number;
  },
  { orderId: string; amountVND: number }
>("createOrder");

export const createCounterSale = call<
  {
    customerId: string;
    beneficiaryKind: "USER" | "CHILD";
    beneficiaryId: string;
    beneficiaryName: string;
    productType: "PASS" | "PACKAGE" | "SWIM_COURSE";
    duration?: string;
    packageSize?: string;
    swimStyle?: string;
    audience?: string;
    passPhoto?: { storagePath: string };
    coachId?: string;
    startHour?: number;
    weekOffset?: number;
    method?: "CASH" | "BANK_TRANSFER";
  },
  { ok: boolean; orderId: string; memberCode: string; amountVND: number; productName: string }
>("createCounterSale");
export const confirmPayment = call<{ orderId: string }, { ok: boolean; memberCode: string }>("confirmPayment");
export const cancelOrder = call<{ orderId: string }, { ok: boolean }>("cancelOrder");
export const refundOrder = call<{ orderId: string; reason: string }, { ok: boolean }>("refundOrder");
export const extendService = call<
  { kind: "MEMBERSHIP" | "PACKAGE" | "COURSE"; serviceId: string; addDays?: number; addSessions?: number; reason: string },
  { ok: boolean; kind: string; endDate?: string; totalSessions?: number; remainingSessions?: number }
>("extendService");

export const prepareCustomerRegistration = call<
  { phone: string },
  { ok: boolean; email: string }
>("prepareCustomerRegistration");
export const completeCustomerRegistration = call<
  { phone: string; fullName?: string },
  { ok: boolean }
>("completeCustomerRegistration");
export const resetCustomerPasswordAfterOtp = call<
  { phone: string; password: string },
  { ok: boolean; uid: string }
>("resetCustomerPasswordAfterOtp");

export const issueQrToken = call<
  { requestedCount?: number; adultsInGroup?: number; purpose?: "VISIT" | "COURSE"; qrPurpose?: "VISIT" | "COURSE" },
  { token: string; expiresAt: number; requestedCount?: number; purpose?: "VISIT" | "COURSE" }
>("issueQrToken");
export const checkinByQr = call<
  {
    qrPayload: string;
    beneficiaryId?: string;
    groupSize?: number;
    adultsInGroup?: number;
    // v2.4 (E2/INV-17): khách chọn loại + thẻ cụ thể (COURSE / MEMBERSHIP)
    forceKind?: "COURSE" | "MEMBERSHIP" | "PACKAGE";
    targetId?: string;
  },
  { ok: boolean; kind: string; message: string }
>("checkinByQr");
export const staffCheckinByPhone = call<
  {
    phone: string;
    beneficiaryId?: string;
    groupSize?: number;
    adultsInGroup?: number;
    forceKind?: "COURSE" | "PACKAGE" | "MEMBERSHIP";
    // v2.4.2: chỉ định doc cụ thể để skip auto-search, error rõ ràng hơn
    targetId?: string;
    reason?: string;
  },
  { ok: boolean; kind: string; message: string }
>("staffCheckinByPhone");

export const setUserRole = call<
  { phone: string; role: "OWNER" | "RECEPTIONIST" | "COACH" | "CUSTOMER" | "PARENT"; coachId?: string },
  { ok: boolean; uid: string; role: string }
>("setUserRole");
export const revokeUserRole = call<
  { targetUid: string },
  { ok: boolean; uid: string; from: string }
>("revokeUserRole");

// v2.4 (E1) — Tra khách hàng theo SĐT cho điểm danh hộ
// v2.4.1: nếu Auth có user nhưng Firestore không có → server auto-create doc placeholder
//   và trả `autoCreated:true` để UI hiển thị badge phù hợp.
export const searchCustomerByPhone = call<
  { phone: string },
  {
    found: true;
    id: string;
    autoCreated?: boolean;
    fullName?: string;
    phone?: string;
    role?: string;
    childrenIds?: string[];
    [k: string]: unknown;
  }
>("searchCustomerByPhone");

// v2.4.1 — Đồng bộ Auth → Firestore (Owner-only)
export const syncAllAuthUsersToFirestore = call<
  Record<string, never>,
  { ok: boolean; scanned: number; created: number }
>("syncAllAuthUsersToFirestore");

// v2.5 — CRUD khách hàng từ /admin/customers
export const createCustomerByPhone = call<
  { phone: string; fullName?: string },
  { ok: boolean; uid: string; alreadyExists: boolean }
>("createCustomerByPhone");
export const updateCustomerName = call<
  { uid: string; fullName: string },
  { ok: boolean }
>("updateCustomerName");
export const deleteCustomer = call<{ uid: string }, { ok: boolean }>("deleteCustomer");
export const resetCustomerPasswordToDefault = call<{ uid: string }, { ok: boolean }>("resetCustomerPasswordToDefault");
export const ownerUpdateCustomerProfile = call<
  {
    uid: string;
    reason: string;
    patch: {
      fullName?: string;
      phone?: string;
      address?: string;
      dob?: string | null;
      heightCm?: number | "" | null;
      audience?: string | null;
      disabled?: boolean;
    };
  },
  { ok: boolean; fields: string[] }
>("ownerUpdateCustomerProfile");
export const ownerUpdateCustomerService = call<
  {
    customerId: string;
    kind: "MEMBERSHIP" | "PACKAGE" | "COURSE";
    serviceId: string;
    reason: string;
    patch: Record<string, unknown>;
  },
  { ok: boolean; fields: string[] }
>("ownerUpdateCustomerService");
export const updateMembershipPassPhoto = call<
  {
    customerId: string;
    membershipId: string;
    reason: string;
    passPhoto: { storagePath: string };
  },
  { ok: boolean; passPhoto: { storagePath: string; contentType?: string; sizeBytes?: number; uploadedBy?: string } }
>("updateMembershipPassPhoto");

// v2.4 (E4) — HLV ghi chú HV + báo nghỉ ca
export const addCoachNote = call<
  { enrollmentId: string; text: string; actAsCoachId?: string },
  { ok: boolean; count: number }
>("addCoachNote");

export const reportCoachAbsence = call<
  { coachId?: string; date: string; startHour: number; reason?: string },
  { ok: boolean; notified: number }
>("reportCoachAbsence");

export const updatePricing = call<{ pricing: unknown }, { ok: boolean }>("updatePricing");
export const upsertCoach = call<
  { id?: string; fullName: string; phone?: string; weekdays: number[] },
  { ok: boolean; id: string }
>("upsertCoach");
export const setCoachActive = call<{ id: string; active: boolean }, { ok: boolean }>("setCoachActive");
export const deleteCoach = call<{ id: string; reason?: string }, { ok: boolean }>("deleteCoach");
export const deleteOrder = call<{ orderId: string; reason?: string }, { ok: boolean }>("deleteOrder");

// v2.3 (D5, INV-15) — Vé lượt: lễ tân duyệt check-in
export const requestCheckin = call<
  {
    qrPayload: string;
    ticketPackageId: string;
    suggestedCount: number;
    adultsInGroup?: number;
  },
  { requestId: string | null; ok?: boolean; kind?: string; message?: string }
>("requestCheckin");

export const approveCheckin = call<
  { requestId: string; approvedCount: number },
  { ok: boolean; count: number; remaining: number }
>("approveCheckin");

export const correctPackageCheckin = call<
  { checkinId: string; mode: "PARTIAL" | "CANCEL"; refundCount?: number; reason: string },
  { ok: boolean; refundCount: number; remaining: number; originalCount: number; refundedTotal: number }
>("correctPackageCheckin");

export const correctCourseAttendance = call<
  { checkinId: string; reason: string },
  {
    ok: boolean;
    attendedSessions: number;
    totalSessions: number;
    restoredEnrollmentStatus: boolean;
    studentName?: string;
    coachName?: string | null;
    checkinTimeText?: string | null;
    scheduledTimeText?: string | null;
    memberCode?: string | null;
  }
>("correctCourseAttendance");

export const rejectCheckin = call<
  { requestId: string; reason: string },
  { ok: boolean }
>("rejectCheckin");

export const cancelCheckinRequest = call<
  { requestId: string },
  { ok: boolean }
>("cancelCheckinRequest");

export const sendPromotion = call<
  { title: string; body: string; audience: "TEST_PHONE" | "ALL" | "PACKAGE" | "PASS" | "PARENTS" | "COURSE"; testPhone?: string },
  { ok: boolean; notified: number; promotionId: string }
>("sendPromotion");

// Chi tiêu của hồ (v2.6)
export const createExpense = call<
  {
    date: string;
    amount: number | string;
    category: string;
    note?: string;
    paymentMethod: "CASH" | "TRANSFER" | "CARD";
    paidBy: "OWNER" | "RECEPTIONIST" | "OTHER";
    paidByName?: string;
    receiptPhoto?: { storagePath: string; contentType?: string; sizeBytes?: number } | null;
  },
  { ok: boolean; id: string }
>("createExpense");

export const updateExpense = call<
  {
    id: string;
    date: string;
    amount: number | string;
    category: string;
    note?: string;
    paymentMethod: "CASH" | "TRANSFER" | "CARD";
    paidBy: "OWNER" | "RECEPTIONIST" | "OTHER";
    paidByName?: string;
    receiptPhoto?: { storagePath: string; contentType?: string; sizeBytes?: number } | null;
  },
  { ok: boolean }
>("updateExpense");

export const deleteExpense = call<
  { id: string; reason: string },
  { ok: boolean }
>("deleteExpense");

export const upsertExpenseTemplate = call<
  { id?: string; name: string; category: string; typicalAmount?: number; note?: string; active?: boolean },
  { ok: boolean; id: string }
>("upsertExpenseTemplate");

export const deleteExpenseTemplate = call<{ id: string }, { ok: boolean }>("deleteExpenseTemplate");
