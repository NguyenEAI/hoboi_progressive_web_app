import * as admin from "firebase-admin";
admin.initializeApp();

export { createOrder, confirmPayment, cancelOrder, refundOrder } from "./orders";
export { issueQrToken, checkinByQr, staffCheckinByPhone } from "./checkin";
export { setUserRole } from "./staff";
export { updatePricing, upsertCoach, setCoachActive, deleteOrder } from "./admin";
export {
  expireServicesDaily,
  notifyExpiringDaily,
  cancelUnpaidOrdersHourly,
  aggregateDailyStats,
} from "./schedules";
