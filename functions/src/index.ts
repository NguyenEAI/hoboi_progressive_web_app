import * as admin from "firebase-admin";
admin.initializeApp();

export { createOrder, confirmPayment, cancelOrder, refundOrder } from "./orders";
export {
  issueQrToken,
  checkinByQr,
  staffCheckinByPhone,
  // v2.3 D5 — vé lượt lễ tân duyệt
  requestCheckin,
  approveCheckin,
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
export { updatePricing, upsertCoach, setCoachActive, deleteOrder } from "./admin";
// v2.4 (E4) — màn HLV: ghi chú HV + báo nghỉ ca
export { addCoachNote, reportCoachAbsence } from "./coach";
export {
  expireServicesDaily,
  notifyExpiringDaily,
  cancelUnpaidOrdersHourly,
  aggregateDailyStats,
} from "./schedules";
