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
    coachId?: string; slotId?: string; startDate?: string;
  },
  { orderId: string; amountVND: number }
>("createOrder");

export const confirmPayment = call<{ orderId: string }, { ok: boolean; memberCode: string }>("confirmPayment");
export const cancelOrder = call<{ orderId: string }, { ok: boolean }>("cancelOrder");
export const refundOrder = call<{ orderId: string; reason: string }, { ok: boolean }>("refundOrder");

export const issueQrToken = call<Record<string, never>, { token: string; expiresAt: number }>("issueQrToken");
export const checkinByQr = call<
  { qrPayload: string; beneficiaryId?: string; groupSize?: number; adultsInGroup?: number },
  { ok: boolean; kind: string; message: string }
>("checkinByQr");
export const staffCheckinByPhone = call<
  { phone: string; beneficiaryId?: string },
  { ok: boolean; kind: string; message: string }
>("staffCheckinByPhone");

export const setUserRole = call<
  { phone: string; role: "OWNER" | "RECEPTIONIST" | "COACH" | "CUSTOMER" | "PARENT"; coachId?: string },
  { ok: boolean; uid: string; role: string }
>("setUserRole");

export const updatePricing = call<{ pricing: unknown }, { ok: boolean }>("updatePricing");
export const upsertCoach = call<
  { id?: string; fullName: string; phone?: string; weekdays: number[] },
  { ok: boolean; id: string }
>("upsertCoach");
export const setCoachActive = call<{ id: string; active: boolean }, { ok: boolean }>("setCoachActive");
export const deleteOrder = call<{ orderId: string; reason?: string }, { ok: boolean }>("deleteOrder");
