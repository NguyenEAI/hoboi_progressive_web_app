import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// gộp class Tailwind (shadcn/ui convention)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// định dạng tiền VNĐ: 1800000 -> "1.800.000₫"
export function formatVND(amount: number): string {
  return amount.toLocaleString("vi-VN") + "₫";
}

// rút gọn: 1800000 -> "1.8tr₫", 450000 -> "450k₫"
export function formatVNDShort(amount: number): string {
  if (amount >= 1_000_000) return (amount / 1_000_000).toLocaleString("vi-VN") + "tr₫";
  if (amount >= 1_000) return Math.round(amount / 1_000) + "k₫";
  return amount + "₫";
}

// alias tương thích ngược (sẽ gỡ khi refresh admin dashboard)
export const fmtVND = formatVND;

export const weekdayVi = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

// chuyển TS (Firestore Timestamp | Date | string) -> Date
export function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  if (value && typeof value === "object" && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date(NaN);
}

// định dạng ngày: 08/06/2026
export function formatDate(value: unknown): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN");
}

// số ngày còn lại tới mốc (âm = đã quá hạn)
export function daysUntil(value: unknown): number {
  const d = toDate(value);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

// cộng ngày
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
