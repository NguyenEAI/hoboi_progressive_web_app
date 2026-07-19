import * as admin from "firebase-admin";

export const TICKET_PACKAGE_VALIDITY_DAYS = 365;
export const TICKET_PACKAGE_EXPIRED_MESSAGE =
  "Vé lượt đã hết hạn sau 365 ngày từ ngày kích hoạt. Vui lòng mua gói mới tại quầy.";

const DAY_MS = 24 * 60 * 60 * 1000;

function timestampMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof admin.firestore.Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function")
    return (value as { toMillis: () => number }).toMillis();
  if (typeof value === "object" && "seconds" in value && typeof (value as { seconds?: unknown }).seconds === "number")
    return (value as { seconds: number }).seconds * 1000;
  return null;
}

export function packageExpiryFromStart(start: admin.firestore.Timestamp): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(start.toMillis() + TICKET_PACKAGE_VALIDITY_DAYS * DAY_MS);
}

export function getTicketPackageStartMillis(data: FirebaseFirestore.DocumentData): number | null {
  return timestampMillis(data.startDate) ?? timestampMillis(data.createdAt);
}

export function getTicketPackageExpiryMillis(data: FirebaseFirestore.DocumentData): number | null {
  const explicitExpiry = timestampMillis(data.expiryDate);
  if (explicitExpiry !== null) return explicitExpiry;
  const startMillis = getTicketPackageStartMillis(data);
  return startMillis === null ? null : startMillis + TICKET_PACKAGE_VALIDITY_DAYS * DAY_MS;
}

export function isTicketPackageExpired(data: FirebaseFirestore.DocumentData, nowMillis = Date.now()): boolean {
  const expiryMillis = getTicketPackageExpiryMillis(data);
  return expiryMillis !== null && expiryMillis <= nowMillis;
}
