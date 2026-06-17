// ============================================================
// DATA MODEL — TypeScript types khớp Firestore collections
// Dùng chung cho client (Next.js) và server (Cloud Functions).
// Timestamp: dùng kiểu generic để tương thích cả admin & client SDK.
// ============================================================

// Cho phép dùng chung giữa firebase-admin (Timestamp) và client.
// Ở client ta đọc về dưới dạng Date sau khi convert; ở Firestore là Timestamp.
export type TS = { seconds: number; nanoseconds: number } | Date | string;

// ---------- ENUMS ----------
export type Role = "OWNER" | "RECEPTIONIST" | "COACH" | "CUSTOMER" | "PARENT";

export type Audience = "CHILD_UNDER_140" | "CHILD_OVER_140" | "ADULT";

export type PassDuration = "MONTH_1" | "MONTH_3" | "MONTH_6" | "YEAR_1";
export type PackageSize = "PACK_15" | "PACK_30";
export type SwimStyle = "BREASTSTROKE" | "FREESTYLE" | "BACKSTROKE" | "BUTTERFLY";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = CN

export type ProductType =
  | "PASS" // vé thời hạn
  | "PACKAGE" // gói lượt
  | "SWIM_COURSE"; // khóa học

export type OrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PAID"
  | "CANCELLED"
  | "REFUNDED";

export type MembershipStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED";
export type PackageStatus = "ACTIVE" | "DEPLETED" | "SUSPENDED";
export type EnrollmentStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

export type CheckInKind = "PACKAGE" | "MEMBERSHIP" | "COURSE";
export type CheckInResult = "ACCEPTED" | "REJECTED";
export type SkillLevel = "NOT_STARTED" | "LEARNING" | "COMPLETED";

// ---------- USERS ----------
export interface User {
  id: string;
  role: Role;
  fullName: string;
  phone: string; // unique, index
  email?: string;
  address?: string;
  dob?: TS;
  heightCm?: number;
  audience?: Audience; // suy ra từ tuổi/chiều cao, dùng gợi ý giá
  fcmTokens: string[];
  childrenIds?: string[]; // chỉ với PARENT
  disabled: boolean;
  createdAt: TS;
}

export interface Child {
  id: string;
  parentId: string;
  fullName: string;
  dob: TS;
  heightCm: number;
  audience: Audience;
}

// ---------- COACHES ----------
export interface Coach {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  weekdays: Weekday[];
  active: boolean;
  createdAt: TS;
}

export interface CoachSlot {
  id: string; // `${coachId}_${weekday}_${startHour}`
  coachId: string;
  weekday: Weekday;
  startHour: number; // 7..19
  endHour: number;
  capacity: number; // 20
  enrolledCount: number; // denormalized, cập nhật trong transaction
}

// ---------- PRODUCTS & PRICING ----------
export interface Product {
  id: string;
  type: ProductType;
  // PASS:
  duration?: PassDuration;
  // PACKAGE:
  packageSize?: PackageSize;
  // SWIM_COURSE:
  swimStyle?: SwimStyle;
  name: string;
  // giá: với PASS/PACKAGE là map theo audience; với COURSE là số phẳng
  priceByAudience?: Record<Audience, number>;
  flatPrice?: number;
  active: boolean; // toggle hiển thị cho khách
}

// ---------- ORDERS & PAYMENTS ----------
export interface Order {
  id: string;
  customerId: string;
  beneficiaryKind: "USER" | "CHILD";
  beneficiaryId: string; // userId hoặc childId
  beneficiaryName: string;
  productType: ProductType;
  // snapshot để đóng băng giá lúc mua
  productSnapshot: {
    name: string;
    duration?: PassDuration;
    packageSize?: PackageSize;
    swimStyle?: SwimStyle;
    audience?: Audience;
  };
  amountVND: number;
  status: OrderStatus;
  // riêng SWIM_COURSE:
  coachId?: string;
  slotId?: string;
  startDate?: TS;
  createdAt: TS;
  paidAt?: TS;
  confirmedByStaffId?: string;
  cancelledAt?: TS;
  refund?: { byOwnerId: string; reason: string; at: TS };
}

export interface Payment {
  id: string;
  orderId: string;
  amountVND: number;
  method: "CASH";
  receivedByStaffId: string;
  at: TS;
}

// ---------- DỊCH VỤ ĐÃ KÍCH HOẠT ----------
export interface Membership {
  id: string;
  memberCode: string; // số MS in trên thẻ
  userId: string; // tài khoản quản lý thẻ (người mua)
  // Vé thời hạn là CÁ NHÂN: chỉ đúng người này dùng được
  holderKind: "USER" | "CHILD";
  holderId: string; // userId hoặc childId
  holderName: string;
  orderId: string;
  duration: PassDuration;
  audience: Audience;
  startDate: TS;
  endDate: TS;
  amountVND: number;
  status: MembershipStatus;
  createdAt: TS;
}

export interface TicketPackage {
  id: string;
  memberCode: string;
  userId: string; // người mua / chủ thẻ
  orderId: string;
  size: PackageSize;
  audience: Audience; // ADULT → mọi đối tượng dùng; CHILD → chỉ trẻ em
  totalSessions: number;
  remainingSessions: number;
  amountVND: number;
  status: PackageStatus;
  usageHistory: {
    at: TS;
    count: number; // số người check-in lần này
    checkinId: string;
  }[];
  createdAt: TS;
}

export interface Enrollment {
  id: string;
  memberCode: string;
  studentKind: "USER" | "CHILD";
  studentId: string;
  studentName: string;
  parentId?: string;
  orderId: string;
  swimStyle: SwimStyle;
  coachId: string;
  coachName: string;
  slotId: string;
  startDate: TS;
  expiryDate: TS; // startDate + 90 ngày
  totalSessions: number; // 15
  attendedSessions: number;
  status: EnrollmentStatus;
  coachNotes?: { text: string; at: TS }[]; // ghi chú riêng (chỉ HLV)
  createdAt: TS;
  completedAt?: TS;
  expiredAt?: TS;
}

export interface Attendance {
  date: TS; // doc id = YYYY-MM-DD
  present: boolean;
  source: "QR" | "STAFF"; // tự động QR hay lễ tân điểm danh hộ
  markedByStaffId?: string;
  at: TS;
}

// ---------- CHECK-IN & QR ----------
export interface CheckIn {
  id: string;
  userId: string;
  beneficiaryId?: string;
  kind: CheckInKind;
  refId: string; // packageId / membershipId / enrollmentId
  qrTokenId: string;
  groupSize: number; // số người vào lần này (gói lượt)
  result: CheckInResult;
  reason?: string;
  at: TS;
}

export interface QrToken {
  id: string;
  nonce: string;
  issuedAt: TS;
  expiresAt: TS; // +30s
  used: boolean;
}

// ---------- NOTIFICATIONS / AUDIT / STATS ----------
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type:
    | "SERVICE_ACTIVATED"
    | "CHILD_ATTENDED"
    | "COURSE_REMAINING"
    | "EXPIRY_WARNING"
    | "COURSE_COMPLETED"
    | "COURSE_EXPIRED"
    | "PENDING_PAYMENT"
    | "COACH_OFF"
    | "GENERAL";
  read: boolean;
  createdAt: TS;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail?: Record<string, unknown>;
  at: TS;
}
