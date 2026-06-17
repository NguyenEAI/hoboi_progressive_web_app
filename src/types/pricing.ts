import type { Audience, PassDuration, PackageSize } from "@/types";

export type PassPriceMatrix = Record<Audience, Record<PassDuration, number>>;
export type PackagePriceMatrix = Record<Audience, Record<PackageSize, number>>;
export type SingleTicketPrices = {
  CHILD_UNDER_140: number;
  CHILD_OVER_140: number;
  ADULT: number;
  ADULT_WITH_TODDLER: number;
};

// /settings/pricing — Owner sửa, client đọc realtime
export interface PricingSettings {
  pass: PassPriceMatrix;
  package: PackagePriceMatrix;
  swimCourse: number;        // giá phẳng
  singleTicket: SingleTicketPrices;
  updatedAt?: unknown;
}
