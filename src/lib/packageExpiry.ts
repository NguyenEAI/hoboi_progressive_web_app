import type { TicketPackage } from "@/types";
import { addDays, toDate } from "@/lib/utils";

export const TICKET_PACKAGE_VALIDITY_DAYS = 365;

function validDate(value: unknown): Date | null {
  const d = toDate(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function getPackageStartDate(pkg: TicketPackage): Date | null {
  return validDate(pkg.startDate) ?? validDate(pkg.createdAt);
}

export function getPackageExpiryDate(pkg: TicketPackage): Date | null {
  return validDate(pkg.expiryDate) ?? (
    getPackageStartDate(pkg) ? addDays(getPackageStartDate(pkg)!, TICKET_PACKAGE_VALIDITY_DAYS) : null
  );
}

export function isPackageExpired(pkg: TicketPackage, now = new Date()): boolean {
  const expiry = getPackageExpiryDate(pkg);
  return !!expiry && expiry.getTime() <= now.getTime();
}

export function isPackageUsable(pkg: TicketPackage, now = new Date()): boolean {
  return pkg.status === "ACTIVE" && (pkg.remainingSessions ?? 0) > 0 && !isPackageExpired(pkg, now);
}
