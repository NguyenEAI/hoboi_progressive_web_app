import * as admin from "firebase-admin";
admin.initializeApp();

export { createOrder, createCounterSale, confirmPayment, cancelOrder, refundOrder, extendService } from "./orders";
export {
  issueQrToken,
  checkinByQr,
  staffCheckinByPhone,
  // v2.3 D5 — vé lượt lễ tân duyệt
  requestCheckin,
  approveCheckin,
  correctPackageCheckin,
  rejectCheckin,
  cancelCheckinRequest,
} from "./checkin";
export {
  setUserRole,
  revokeUserRole,
  searchCustomerByPhone,
  syncAllAuthUsersToFirestore,
  createCustomerByPhone,
  updateCustomerName,
  deleteCustomer,
} from "./staff";
export { ownerUpdateCustomerProfile, ownerUpdateCustomerService } from "./customerAdmin";
export { updatePricing, upsertCoach, setCoachActive, deleteOrder, sendPromotion } from "./admin";
// v2.4 (E4) — màn HLV: ghi chú HV + báo nghỉ ca
export { addCoachNote, reportCoachAbsence } from "./coach";
export {
  expireServicesDaily,
  notifyExpiringDaily,
  cancelUnpaidOrdersHourly,
  aggregateDailyStats,
} from "./schedules";
