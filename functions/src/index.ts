import * as admin from "firebase-admin";
admin.initializeApp();

export { prepareCustomerRegistration, completeCustomerRegistration, resetCustomerPasswordAfterOtp } from "./auth";
export { createOrder, createCounterSale, confirmPayment, cancelOrder, refundOrder, extendService } from "./orders";
export {
  issueQrToken,
  checkinByQr,
  staffCheckinByPhone,
  // v2.3 D5 — vé lượt lễ tân duyệt
  requestCheckin,
  approveCheckin,
  correctPackageCheckin,
  correctCourseAttendance,
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
  resetCustomerPasswordToDefault,
} from "./staff";
export { ownerUpdateCustomerProfile, ownerUpdateCustomerService, updateMembershipPassPhoto } from "./customerAdmin";
export { updatePricing, upsertCoach, setCoachActive, deleteCoach, deleteOrder, sendPromotion } from "./admin";
export { createExpense, updateExpense, deleteExpense, upsertExpenseTemplate, deleteExpenseTemplate } from "./expenses";
// v2.4 (E4) — màn HLV: ghi chú HV + báo nghỉ ca
export { addCoachNote, reportCoachAbsence } from "./coach";
export {
  expireServicesDaily,
  notifyExpiringDaily,
  cancelUnpaidOrdersHourly,
  aggregateDailyStats,
} from "./schedules";
