// v2.4 (E4/INV-19) — Helpers cho màn HLV: tính lịch học expected + đếm buổi vắng liên tiếp.
// Attendance doc CHỈ TẠO KHI present=true (theo logic checkin.ts hiện tại).
// Vắng = thiếu attendance doc cho ngày đáng lẽ phải có.

import { toDate } from "@/lib/utils";

export function isoDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Tính các ngày học expected từ startDate đến `now` theo weekday của slot.
// Trả tối đa `totalSessions` ngày, dừng nếu vượt `now`.
export function expectedSessionDates(
  startDate: unknown,
  weekday: number,
  now: Date,
  totalSessions: number,
): Date[] {
  const start = toDate(startDate);
  start.setHours(0, 0, 0, 0);
  // Tìm ngày đầu tiên có weekday khớp (>= startDate)
  const first = new Date(start);
  while (first.getDay() !== weekday) first.setDate(first.getDate() + 1);
  const dates: Date[] = [];
  for (let i = 0; i < totalSessions; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + i * 7);
    if (d.getTime() > now.getTime()) break;
    dates.push(d);
  }
  return dates;
}

// Đếm số buổi vắng liên tiếp tính từ ngày gần nhất ngược về.
// `attendedDateKeys` = Set các "YYYY-MM-DD" mà HV đã điểm danh present:true.
export function countConsecutiveAbsences(
  expectedDates: Date[],
  attendedDateKeys: Set<string>,
): number {
  let count = 0;
  for (let i = expectedDates.length - 1; i >= 0; i--) {
    const key = isoDateKey(expectedDates[i]);
    if (!attendedDateKeys.has(key)) count++;
    else break;
  }
  return count;
}

// Lấy weekday + startHour từ slotId (`${coachId}_${weekday}_${startHour}`).
export function parseSlotId(slotId: string): { weekday: number; startHour: number } | null {
  const parts = (slotId ?? "").split("_");
  if (parts.length < 3) return null;
  const weekday = Number(parts[parts.length - 2]);
  const startHour = Number(parts[parts.length - 1]);
  if (!Number.isInteger(weekday) || !Number.isInteger(startHour)) return null;
  return { weekday, startHour };
}
