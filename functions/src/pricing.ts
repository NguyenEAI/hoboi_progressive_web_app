// Bảng giá phía server (bản sao của src/lib/constants.ts vì functions là package riêng).
// Khớp memory/pricing-matrix.md. Khi đổi giá phải sửa CẢ HAI nơi (v1 chưa có UI giá động).

export type Audience = "CHILD_UNDER_140" | "CHILD_OVER_140" | "ADULT";
export type PassDuration = "MONTH_1" | "MONTH_3" | "MONTH_6" | "YEAR_1";
export type PackageSize = "PACK_15" | "PACK_30";
export type SwimStyle = "BREASTSTROKE" | "FREESTYLE" | "BACKSTROKE" | "BUTTERFLY";

export const PASS_DAYS: Record<PassDuration, number> = {
  MONTH_1: 30, MONTH_3: 90, MONTH_6: 180, YEAR_1: 365,
};

export const PASS_PRICES: Record<Audience, Record<PassDuration, number>> = {
  CHILD_UNDER_140: { MONTH_1: 400_000, MONTH_3: 1_000_000, MONTH_6: 1_800_000, YEAR_1: 3_500_000 },
  CHILD_OVER_140: { MONTH_1: 450_000, MONTH_3: 1_150_000, MONTH_6: 2_150_000, YEAR_1: 4_200_000 },
  ADULT: { MONTH_1: 500_000, MONTH_3: 1_300_000, MONTH_6: 2_300_000, YEAR_1: 4_400_000 },
};

export const PACKAGE_SESSIONS: Record<PackageSize, number> = { PACK_15: 15, PACK_30: 30 };

export const PACKAGE_PRICES: Record<Audience, Record<PackageSize, number>> = {
  CHILD_UNDER_140: { PACK_15: 300_000, PACK_30: 550_000 },
  CHILD_OVER_140: { PACK_15: 350_000, PACK_30: 700_000 },
  ADULT: { PACK_15: 450_000, PACK_30: 800_000 },
};

export const SWIM_COURSE_PRICE = 1_800_000;
export const SWIM_COURSE_TOTAL_SESSIONS = 15;
export const SWIM_COURSE_VALIDITY_DAYS = 90;

export const SLOT_CAPACITY = 20;
export const UNPAID_ORDER_HOLD_HOURS = 24;

const PASS_LABEL: Record<PassDuration, string> = {
  MONTH_1: "Vé tháng", MONTH_3: "Vé quý", MONTH_6: "Vé 6 tháng", YEAR_1: "Vé năm",
};
const PACK_LABEL: Record<PackageSize, string> = {
  PACK_15: "Gói 15 lượt", PACK_30: "Gói 30 lượt",
};
const STYLE_LABEL: Record<SwimStyle, string> = {
  BREASTSTROKE: "Bơi cơ bản (ếch)", FREESTYLE: "Bơi sải",
  BACKSTROKE: "Bơi ngửa", BUTTERFLY: "Bơi bướm",
};

export function passLabel(d: PassDuration) { return PASS_LABEL[d]; }
export function packLabel(s: PackageSize) { return PACK_LABEL[s]; }
export function styleLabel(s: SwimStyle) { return STYLE_LABEL[s]; }
