// ============================================================
// HẰNG SỐ HỆ THỐNG — nguồn sự thật cho bảng giá & quy tắc hồ bơi
// Khớp với THIET-KE-TONG-HOP.md và memory/pricing-matrix.md
// ============================================================

import type {
  Audience,
  PassDuration,
  PackageSize,
  SwimStyle,
  Weekday,
} from "@/types";

export const POOL_INFO = {
  company: "CÔNG TY TNHH HT BẢO LÂM",
  name: "Hồ Bơi Chung Cư Prosper Plaza",
  shortName: "Prosper Plaza",
  address: "22/14 Phan Văn Hớn, P. Tân Đông Hưng Thuận, TP. Hồ Chí Minh",
} as const;

// ---------- ĐỐI TƯỢNG ----------
export const AUDIENCES: { id: Audience; label: string; emoji: string }[] = [
  { id: "CHILD_UNDER_140", label: "Trẻ em dưới 1.4m", emoji: "🧒" },
  { id: "CHILD_OVER_140", label: "Trẻ em trên 1.4m", emoji: "🧑" },
  { id: "ADULT", label: "Người lớn", emoji: "🧔" },
];

// ---------- VÉ LẺ (tham khảo, bán tại quầy — KHÔNG qua app) ----------
export const SINGLE_TICKET_PRICES = {
  CHILD_UNDER_140: 25_000,
  CHILD_OVER_140: 30_000,
  ADULT: 35_000,
  ADULT_WITH_TODDLER: 40_000, // người lớn + trẻ < 2 tuổi
} as const;

// ---------- VÉ THỜI HẠN (giá theo đối tượng × thời hạn) ----------
export const PASS_DURATIONS: { id: PassDuration; label: string; days: number }[] = [
  { id: "MONTH_1", label: "1 Tháng", days: 30 },
  { id: "MONTH_3", label: "3 Tháng (Quý)", days: 90 },
  { id: "MONTH_6", label: "6 Tháng", days: 180 },
  { id: "YEAR_1", label: "1 Năm", days: 365 },
];

export const PASS_PRICES: Record<Audience, Record<PassDuration, number>> = {
  CHILD_UNDER_140: { MONTH_1: 400_000, MONTH_3: 1_000_000, MONTH_6: 1_800_000, YEAR_1: 3_500_000 },
  CHILD_OVER_140: { MONTH_1: 450_000, MONTH_3: 1_150_000, MONTH_6: 2_150_000, YEAR_1: 4_200_000 },
  ADULT: { MONTH_1: 500_000, MONTH_3: 1_300_000, MONTH_6: 2_300_000, YEAR_1: 4_400_000 },
};

// ---------- GÓI LƯỢT (giá theo đối tượng × số lượt) ----------
export const PACKAGE_SIZES: { id: PackageSize; label: string; sessions: number }[] = [
  { id: "PACK_15", label: "Gói 15 lượt", sessions: 15 },
  { id: "PACK_30", label: "Gói 30 lượt", sessions: 30 },
];

export const PACKAGE_PRICES: Record<Audience, Record<PackageSize, number>> = {
  CHILD_UNDER_140: { PACK_15: 300_000, PACK_30: 550_000 },
  CHILD_OVER_140: { PACK_15: 350_000, PACK_30: 700_000 },
  ADULT: { PACK_15: 450_000, PACK_30: 800_000 },
};

// ---------- KHÓA HỌC BƠI (giá phẳng, 4 kiểu) ----------
export const SWIM_COURSE_PRICE = 1_800_000;
export const SWIM_COURSE_TOTAL_SESSIONS = 15;
export const SWIM_COURSE_VALIDITY_DAYS = 90;

export const SWIM_STYLES: { id: SwimStyle; label: string; emoji: string; recommended?: boolean }[] = [
  { id: "BREASTSTROKE", label: "Bơi cơ bản (ếch)", emoji: "🐸", recommended: true },
  { id: "FREESTYLE", label: "Bơi sải", emoji: "🏊" },
  { id: "BACKSTROKE", label: "Bơi ngửa", emoji: "🛟" },
  { id: "BUTTERFLY", label: "Bơi bướm", emoji: "🦋" },
];

// ---------- HUẤN LUYỆN VIÊN & KHUNG GIỜ ----------
export const SLOT_CAPACITY = 20; // tối đa 20 HV/ca
export const SESSION_MINUTES = 60;

// Giờ bắt đầu mỗi ca: sáng 07–11h (4 ca), chiều 14–20h (6 ca) = 10 ca/ngày
export const SLOT_START_HOURS = [7, 8, 9, 10, 14, 15, 16, 17, 18, 19] as const;

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Chủ nhật",
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
};

// Lịch HLV cố định ban đầu (Owner có thể đổi qua admin)
export const DEFAULT_COACHES = [
  { fullName: "Thầy Tùng", weekdays: [3, 5, 0] as Weekday[] }, // T4, T6, CN
  { fullName: "Thầy Tín", weekdays: [2, 4, 6] as Weekday[] }, // T3, T5, T7
];

// ---------- QUY TẮC HỆ THỐNG (đã chốt) ----------
export const RULES = {
  UNPAID_ORDER_HOLD_HOURS: 24, // đơn chưa TT giữ chỗ 24h rồi hủy
  QR_TOKEN_TTL_SECONDS: 30, // QR cổng đổi mỗi 30s
  COURSE_REMAINING_ALERTS: [10, 5, 1], // push còn N buổi
  EXPIRY_ALERTS_DAYS: [30, 7, 1], // push còn N ngày
} as const;

// Mốc nhắc & nội dung mẫu (hardcode cho v1)
export const NOTIFICATION_TEMPLATES = {
  serviceActivated: (name: string, end: string) =>
    `Đã kích hoạt ${name}. Hiệu lực đến ${end}.`,
  childAttended: (date: string, time: string) =>
    `Con của bạn đã tham gia lớp học ngày ${date} lúc ${time}.`,
  courseRemaining: (n: number) => `Khóa học của bạn còn ${n} buổi.`,
  expiryDays: (name: string, n: number) => `${name} còn ${n} ngày.`,
  courseCompleted: (student: string) =>
    `🎉 Chúc mừng! ${student} đã hoàn thành khóa học (15/15 buổi).`,
  courseExpired: (attended: number) =>
    `Khóa học đã kết thúc sau 90 ngày. Đã học ${attended}/15 buổi; ` +
    `số buổi còn lại không được bảo lưu theo quy định. Vui lòng đăng ký khóa mới nếu muốn tiếp tục.`,
  pendingPayment: () =>
    `Bạn có đơn chưa thanh toán. Vui lòng đến quầy để hoàn tất.`,
} as const;
