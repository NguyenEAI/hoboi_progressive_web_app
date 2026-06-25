# Implementation Plan — Hồ Bơi Prosper Plaza

> **Phiên bản**: **2.4** (bổ sung 4 chỉnh sửa UAT round 5 — xem §19)
> **Tài liệu mẹ**: [`PRD.md`](./PRD.md) v2.1 + [`../CLAUDE.md`](../CLAUDE.md) v2.4
> **Trạng thái dự án**: Phase 1–10 ✅ · Phase 11 (UAT) đang round 5 — feedback Owner ngày 2026-06-23 · Vercel chưa

---

## 1. Tech Stack

| Layer | Lựa chọn | Phiên bản đang dùng | Lý do |
|---|---|---|---|
| Framework | Next.js (App Router) | 15.5.19 | React 19, RSC, partial prerender, ổn định bản patch |
| Ngôn ngữ | TypeScript | 5.x strict | Compile-time safety, IDE support |
| UI | TailwindCSS + Shadcn/UI | Tailwind 3.4 | Atomic CSS, ít bundle |
| Auth | Firebase Auth (Phone OTP) | 11.x SDK | Native VN OTP, free OTP đầu |
| DB | Cloud Firestore | Native mode | Realtime, offline cache IndexedDB sẵn |
| Server logic | Cloud Functions v2 (asia-southeast1) | Node 20 | Concurrency cao, gần VN |
| Storage | Firebase Storage | — | Logo, avatar |
| Push | Firebase Cloud Messaging (Web Push) | VAPID | iOS 16.4+ hỗ trợ qua PWA installed |
| QR | `qrcode.react` (hiển thị) · `html5-qrcode` (quét) | latest | Tested |
| PWA | `next-pwa` 5.x (Workbox) | — | Service worker + manifest |
| Hosting FE | Vercel | — | Free tier đủ cho v1 |
| Hosting BE | Firebase (Functions + Firestore) | Blaze plan | Cần Blaze để dùng Cloud Functions |
| Bảo mật | **Firebase App Check** + reCAPTCHA Enterprise | — | Chống abuse callable + Phone Auth |
| Region | `asia-southeast1` (Singapore) | — | Gần VN nhất; lưu ý PDPL cross-border (xem PRD §11) |

### 1.1 Lý do không dùng
- ❌ **Next.js Server Actions cho ghi tiền** — Đã chọn callable functions để: (1) chạy gần data trong asia-southeast1, (2) App Check support gốc, (3) đồng nhất cho mobile native nếu sau này build. Server Actions dùng cho **prefetch tĩnh** + **form non-financial** (sửa profile).
- ❌ **Multi-region Firestore** — chi phí gấp đôi, chỉ 1 hồ tại VN không cần.
- ❌ **TypeORM/Prisma** — Firestore native không cần ORM.
- ❌ **NextAuth** — Firebase Auth đủ, NextAuth chồng chéo logic.

---

## 2. Cấu trúc dự án

```
D:\Hoboi_version2\
├ src/
│  ├ app/
│  │  ├ layout.tsx                 root layout · suppressHydrationWarning (Trancy fix)
│  │  ├ page.tsx                   landing → redirect by role
│  │  ├ (public)/
│  │  │  ├ signin/                 OTP 3 bước: phone → otp → tên
│  │  │  └ privacy/                ⭐ trang Chính sách quyền riêng tư (PDPL)
│  │  ├ (customer)/
│  │  │  ├ home/                   shortcut grid (thêm "Khóa học của tôi")
│  │  │  ├ services/               mua vé tháng/gói lượt + "Mua cho ai"
│  │  │  ├ services/course/        wizard 4 bước (v2.1: gộp ca theo khung giờ)
│  │  │  ├ cards/                  ví thẻ điện tử (front + back)
│  │  │  ├ my-courses/             ⭐ v2.1 — list + detail enrollment + attendances
│  │  │  ├ checkin/                preview + scan QR
│  │  │  ├ children/               CRUD trẻ em
│  │  │  ├ notifications/          inbox
│  │  │  └ profile/                sửa tên + Add-to-Home-Screen hint
│  │  ├ (staff)/admin/
│  │  │  ├ page.tsx                dashboard realtime
│  │  │  ├ orders/                 nhóm theo ngày + xóa PENDING (Owner) + v2.1: date-range filter + xóa cứng PAID có lý do
│  │  │  ├ products/               Owner-only matrix sửa giá
│  │  │  ├ coaches/                CRUD HLV
│  │  │  ├ customers/              search + thời gian đăng ký
│  │  │  ├ staff/                  phân quyền role + v2.1: nút "Gỡ quyền" về CUSTOMER
│  │  │  ├ reports/                ⭐ Owner-only · realtime · v2.1: filter Ngày/Tháng/Năm + bảng chéo Loại × Đối tượng
│  │  │  ├ qr-gate/                tablet cổng · QR rotation 30s · fullscreen
│  │  │  └ checkin-assist/         điểm danh hộ qua SĐT
│  │  └ (coach)/coach/
│  │     ├ layout.tsx              ⭐ v2.1: header có nút Đăng xuất
│  │     ├ page.tsx                lịch dạy hôm nay
│  │     └ students/               danh sách + Zalo deeplink
│  ├ components/
│  │  ├ Logo.tsx                   ⭐ HT BẢO LÂM base64
│  │  ├ BottomNav.tsx
│  │  ├ AdminSidebar.tsx
│  │  ├ MemberCard.tsx             render thẻ điện tử
│  │  └ ui/                        shadcn/ui (Button, Dialog, ...)
│  ├ lib/
│  │  ├ constants.ts               ⭐ giá fallback + quy tắc audience + brand colors
│  │  ├ callable.ts                wrapper httpsCallable + retry + error mapping
│  │  ├ utils.ts                   formatVND · formatDate · toDate · audienceOf(heightCm)
│  │  ├ firebase/
│  │  │  ├ client.ts               initializeApp + getAuth + getFirestore + getMessaging
│  │  │  ├ appCheck.ts             ⭐ initAppCheck với ReCaptchaV3Provider
│  │  │  └ messaging.ts            registerToken + onMessage
│  │  └ hooks/
│  │     ├ useAuthUser.ts          ⭐ getDoc check trước khi create (đã fix bug ghi đè role)
│  │     ├ useCoach.ts             load coach doc cho COACH role
│  │     └ usePricing.ts           ⭐ realtime listener /settings/pricing + fallback
│  └ types/
│     ├ index.ts                   data model: User, Order, Membership, Enrollment, ...
│     └ pricing.ts                 PricingDoc, PassDuration, Audience enum
├ functions/
│  ├ src/
│  │  ├ index.ts                   exports gom 12 functions
│  │  ├ helpers.ts                 requireAuth, requireOwner, requireAppCheck, audit()
│  │  ├ pricing.ts                 loadPricing() — đọc /settings/pricing fallback constants
│  │  ├ orders.ts                  createOrder · confirmPayment · cancelOrder · refundOrder
│  │  ├ checkin.ts                 issueQrToken · checkinByQr · staffCheckinByPhone
│  │  ├ admin.ts                   updatePricing · upsertCoach · setCoachActive · deleteOrder
│  │  ├ staff.ts                   setUserRole (sync custom claim + firestore)
│  │  └ schedules.ts               4 cron: expire · cancelUnpaid · notifyExpiring · aggregate
│  ├ package.json                  Node 20
│  └ tsconfig.json
├ firestore/
│  ├ firestore.rules               ⭐ helper functions isOwner() isStaff() isCoach()
│  ├ firestore.indexes.json        composite (status, createdAt desc), ...
│  └ storage.rules
├ seed/
│  ├ seed.ts                       10 products + 60 slots + counter
│  ├ seedPricing.ts                /settings/pricing doc
│  ├ setRole.ts                    CLI gán role (backup nếu UI chết)
│  └ check.ts                      smoke test
├ public/
│  ├ manifest.json                 PWA manifest
│  ├ sw.js                         generated bởi next-pwa
│  ├ firebase-messaging-sw.js      ⭐ FCM service worker riêng (Workbox không xử lý FCM)
│  └ icons/                        192/512 maskable
├ .env.local                       Firebase config (gitignore)
├ .env.production                  cho Vercel build
├ next.config.js                   next-pwa wrap + DISABLE_PWA + LOW_MEM cờ
├ firebase.json                    hosting/functions/rules config
└ .firebaserc                      project alias = hoboiapp
```

---

## 3. Firestore Data Model

> **Nguyên tắc**: docs nhỏ + ổn định ở root; data volatile (history, log, checkins, attendance) ở subcollection để giảm contention và index churn.

### 3.1 Root collections (khớp `src/types/index.ts`)
```
/users/{uid}
   role: "OWNER"|"RECEPTIONIST"|"COACH"|"PARENT"|"CUSTOMER"
   fullName, phone, heightCm?, audience?       ⭐ tính từ heightCm
   fcmTokens: string[]                          (mảng đơn giản, v1)
   childrenIds?: string[]                       (denormalized cho parent)
   disabled: boolean
   createdAt
   
/users/{uid}/children/{cid}
   parentId, fullName, dob, heightCm, audience
   
/users/{uid}/notifications/{nid}              ⭐ subcollection — append-heavy
   type, title, body, read, createdAt

/coaches/{coachId}
   userId (ref /users/{uid} có role COACH)
   fullName, phone, weekdays: number[]         (0=Sun..6=Sat)
   active: boolean
   createdAt
   
/coaches/{coachId}/slots/{slotId}             ⭐ /admin/coaches tạo tự động
   weekday, startHour, endHour, capacity(20), enrolledCount
   
/settings/pricing                              ⭐ Owner sửa realtime → khách thấy ngay
   pass:    { CHILD_UNDER_140: { MONTH_1, MONTH_3, MONTH_6, YEAR_1 }, ... }
   package: { CHILD_UNDER_140: { SIZE_15, SIZE_30 }, ... }
   swimCourse: 1800000
   singleTicket: { CHILD_UNDER_140, CHILD_OVER_140, ADULT, ADULT_WITH_TODDLER }
   updatedAt, updatedBy
   
/orders/{orderId}
   customerId
   beneficiaryKind: "USER"|"CHILD"             ⭐ USER = bản thân người mua
   beneficiaryId, beneficiaryName
   productType: "PASS"|"PACKAGE"|"SWIM_COURSE"  ⭐ khớp ProductType enum
   productSnapshot: { name, duration?, audience?, packageSize?, swimStyle? }   ⭐ đóng băng giá
   amountVND
   status: "PENDING_PAYMENT"|"PAID"|"CANCELLED"|"REFUNDED"
   coachId?, slotId?, startDate?                (chỉ SWIM_COURSE)
   createdAt, paidAt, confirmedByStaffId
   cancelledAt?, cancelledBy?
   refund?: { byOwnerId, reason, at }
   
/payments/{paymentId}
   orderId, amountVND, method: "CASH"
   receivedByStaffId, at
   
/memberships/{id}
   memberCode (counter)
   userId, holderKind: "USER"|"CHILD", holderId, holderName
   orderId
   duration: "MONTH_1"|"MONTH_3"|"MONTH_6"|"YEAR_1"
   audience: "CHILD_UNDER_140"|"CHILD_OVER_140"|"ADULT"
   startDate, endDate, amountVND
   status: "ACTIVE"|"EXPIRED"|"SUSPENDED"
   createdAt
   
/ticketPackages/{id}
   memberCode, userId, orderId
   size: "PACK_15"|"PACK_30", audience
   totalSessions, remainingSessions             ⭐ atomic bằng transaction
   amountVND
   usageHistory: [{ at, count, checkinId }]     (capped trong UI, không hard cap)
   status: "ACTIVE"|"DEPLETED"|"SUSPENDED"
   createdAt
   
/enrollments/{id}
   memberCode, studentKind: "USER"|"CHILD", studentId, studentName, parentId?
   orderId
   swimStyle: "BREASTSTROKE"|"FREESTYLE"|"BACKSTROKE"|"BUTTERFLY"
   coachId, coachName, slotId
   startDate, expiryDate                        ⭐ startDate + 90 days
   totalSessions (=15), attendedSessions
   status: "PENDING"|"ACTIVE"|"COMPLETED"|"EXPIRED"|"CANCELLED"
   coachNotes?: [{ text, at }]
   createdAt, completedAt?, expiredAt?
   
/enrollments/{id}/attendances/{YYYY-MM-DD}     ⭐ subcollection — append-heavy
   date, present, source: "QR"|"STAFF", at
   present: bool, by, at, note?

/checkins/{id}
   userId, beneficiaryId, kind, refId
   qrTokenId, groupSize, result
   at
   
/qrTokens/{tokenId}                            ⭐ short-lived, ~30s
   nonce, issuedAt, expiresAt, used
   
/counters/memberCode
   value                                       ⭐ atomic increment bằng FieldValue.increment(1)
   
/auditLogs/{id}                                ⭐ append-only, không cho update/delete
   actorId, action, targetType, targetId, detail, at

/dailyStats/{YYYY-MM-DD}                       ⭐ Owner-only read (INV-9)
   totalCheckins, revenue, revenueByType
/monthlyStats/{YYYY-MM}
   revenueByType
```

### 3.2 Data modeling decisions (theo best practices Firestore 2026)

| Pattern | Áp dụng ở đâu | Lý do |
|---|---|---|
| Subcollections cho volatile data | `/users/{uid}/notifications`, `/enrollments/{id}/attendances` | Tránh document quá lớn (1MB limit) + giảm index churn |
| Append-only `/auditLogs` ở root | — | Không có write contention vì mỗi doc ID khác nhau (Firestore auto ID) |
| **KHÔNG** dùng monotonically increasing ID cho doc | Firestore tự sinh ID (random) | Tránh hotspot ghi (best practice Firebase) |
| Counter `/counters/memberCode` với `FieldValue.increment` | Sinh member code | Không cần transaction read-modify-write |
| Snapshot giá vào `Order.productSnapshot` | Mọi đơn | Đóng băng giá (INV-10) |
| Capped array `usageHistory` 100 entries | `/ticketPackages` | Tránh doc lớn quá 1MB |
| Field transforms (`arrayUnion`, `increment`) thay vì read-then-write | Mọi nơi có counter | Atomic + ít round-trip |

---

## 4. Security Rules — RBAC + Defense in Depth

### 4.1 Helper functions trong `firestore.rules`
```javascript
function isSignedIn() { return request.auth != null; }
function uid() { return request.auth.uid; }
function role() { return request.auth.token.role; }              // ⭐ custom claim
function isOwner() { return isSignedIn() && role() == "OWNER"; }
function isStaff() { return isSignedIn() && (role() == "OWNER" || role() == "RECEPTIONIST"); }
function isCoach() { return isSignedIn() && role() == "COACH"; }
function isSelf(uid) { return isSignedIn() && request.auth.uid == uid; }
```

### 4.2 Bảng quy tắc tổng

| Collection | Read | Write | Ghi chú |
|---|---|---|---|
| `/users/{uid}` | self / staff / coach (limited fields) | self (limited fields) / Owner (all) | Coach chỉ xem name+phone, không thấy disabled |
| `/users/{uid}/children/{cid}` | self / staff | self / staff | Parent có thể CRUD con mình |
| `/users/{uid}/notifications/{nid}` | self | server only | Client chỉ mark read |
| `/coaches` | signed-in | Owner via callable | Public-ish: cần để khách chọn HLV khi đăng ký khóa |
| `/coaches/{id}/slots` | signed-in | callable only | Hiển thị "X/20" public |
| `/settings/pricing` | **public** | Owner via callable | Khách phải đọc được để tính giá |
| `/orders/{id}` | self / staff | callable only | INV-6 + INV-10 |
| `/payments/{id}` | self / staff | callable only | Sinh khi confirmPayment |
| `/memberships`, `/ticketPackages`, `/enrollments` | self / staff / coach (enrollment) | callable only | Đảm bảo trừ lượt qua transaction |
| `/enrollments/{id}/attendances` | self (student/parent) / staff / coach (own) | callable only | — |
| `/checkins` | self / staff | callable only | — |
| `/qrTokens`, `/counters` | **none** | callable only | Server internal |
| `/auditLogs` | Owner | callable only · **deny update/delete** | INV-12 |
| `/dailyStats`, `/monthlyStats` | **Owner only** | callable only | INV-9 |

### 4.3 Custom Claims Strategy (best practice 2026)
- **Hot path** dùng `request.auth.token.role` (custom claim) — không cần read /users doc trong rules.
- **Source of truth** là `/users/{uid}.role` field. Callable `setUserRole`:
  1. Update field trong Firestore
  2. Set custom claim qua Admin SDK `setCustomUserClaims`
  3. Ghi `/auditLogs`
- Client gọi `getIdToken(true)` ngay sau khi role đổi để buộc refresh token.
- Claim refresh tự động sau ≤ 1h khi token hết hạn.

### 4.4 App Check (bắt buộc trong production)
- Provider: **reCAPTCHA Enterprise** (web) — free tier 10k assessments/tháng đủ cho 2–3k user/năm.
- Bật cho: Firestore + Cloud Functions + Storage.
- Trong dev: dùng `FIREBASE_APPCHECK_DEBUG_TOKEN`.
- Trong callable: `request.app == null` → reject (`HttpsError("failed-precondition")`).

---

## 5. Cloud Functions (12 functions, all asia-southeast1)

### 5.1 Callable (gọi từ client qua `httpsCallable`)
| Function | Mô tả | Yêu cầu auth | Transaction? |
|---|---|---|---|
| `createOrder` | Tạo đơn `PENDING_PAYMENT`, giữ slot nếu COURSE | signed-in | ✅ INV-11 — đọc `slot.enrolledCount < 20` rồi increment |
| `confirmPayment` | Xác nhận PAID, sinh thẻ, kích hoạt dịch vụ | Staff | ✅ — sinh memberCode + ghi membership/package/enrollment + audit |
| `cancelOrder` | Hủy đơn chưa thanh toán | Staff (Owner cho PAID-cancel) | ✅ — trả slot nếu COURSE |
| `refundOrder` | **Owner only**, bắt buộc lý do | Owner | ✅ — khóa thẻ + audit + push |
| `deleteOrder` | **Owner only**, xóa đơn PENDING khách chọn nhầm; v2.1 mở rộng cho PAID/CANCELLED/REFUNDED khi cần clean data — bắt buộc lý do, không xóa thẻ/payment đã sinh (gắn cờ `orderDeleted:true`) | Owner | ✅ (v2.1) |
| `revokeUserRole` ⭐ v2.1 | **Owner only**, hạ role về CUSTOMER + clear custom claim; bảo vệ "ít nhất 1 OWNER" + không gỡ chính mình | Owner | ✅ |
| `issueQrToken` | Tablet cổng gọi mỗi 30s | Staff (gate kiosk) | — |
| `checkinByQr` | Khách quét QR, check-in nhóm | signed-in | ✅ — verify nonce + atomic trừ `ticketPackage.remaining` |
| `staffCheckinByPhone` | Lễ tân điểm danh hộ qua SĐT | Staff | ✅ |
| `updatePricing` | **Owner only**, ghi `/settings/pricing` | Owner | ✅ — đọc cũ + audit diff |
| `upsertCoach` | **Owner only**, tạo/sửa HLV + slots | Owner | ✅ — bảo vệ slot có enrollment |
| `setCoachActive` | **Owner only**, khóa/mở khóa HLV | Owner | — |
| `setUserRole` | **Owner only**, gán role + custom claim | Owner | ✅ — update doc + setCustomUserClaims + audit |

### 5.2 Scheduled (timezone Asia/Ho_Chi_Minh)
| Cron | Schedule | Mô tả |
|---|---|---|
| `expireServicesDaily` | `5 0 * * *` (00:05) | Chuyển membership/enrollment EXPIRED + giải phóng slot + push lý do |
| `cancelUnpaidOrdersHourly` | `0 * * * *` (mỗi giờ) | Hủy đơn PENDING > 24h |
| `notifyExpiringDaily` | `0 8 * * *` (08:00) | Push còn 30/7/1 ngày (membership), còn 10/5/1 buổi (package/enrollment) |
| `aggregateDailyStats` | `55 23 * * *` (23:55) | Tổng hợp doanh thu vào `/dailyStats` |

### 5.3 Best practices đã áp dụng (Cloud Functions v2 2026)
- **Concurrency**: mặc định 80, có thể nâng nếu cần (v2 instance xử lý nhiều requests).
- **Memory**: 256MB cho callable đơn giản, 512MB cho `confirmPayment` (đọc/ghi nhiều docs).
- **`minInstances`: 0** trong v1 — tiết kiệm chi phí, chấp nhận cold start ~2s (khách hồ bơi không phải HFT).
- **Functions code gọn**, mỗi function 1 việc → giảm bundle → giảm cold start.
- **Lazy-load Admin SDK** trong từng function (top-level chỉ import type).
- **Region pinned**: `asia-southeast1` → latency từ VN ~30ms.

---

## 6. Authentication Flow

### 6.1 Đăng ký / Đăng nhập (3 bước)
```
[Phone] +84 input → reCAPTCHA → signInWithPhoneNumber
    ↓
[OTP]   6-digit input → confirmationResult.confirm(code)
    ↓ (firebase user created)
[Name]  fullName input → useAuthUser.ensureUserDoc(uid)
    ↓                       └─ getDoc check → setDoc IF NOT EXISTS với role: "CUSTOMER"
[Redirect] landingFor(role) → /home | /admin | /coach
```

### 6.2 Phòng chống abuse (INV-13, INV-14)
- **SMS region policy**: Firebase Console → Authentication → Settings → SMS regions → chỉ tick VN. Set hard cap budget thấp.
- **reCAPTCHA SMS defense**: Identity Platform → Settings → bật cho phone auth (free tier 1k/tháng).
- **App Check** trên cả Auth + Firestore + Functions.
- **Test numbers** cho dev: +84900000001/111111, +84900000002/222222, +84900000003/333333 (set trong console, KHÔNG gửi SMS thật).

### 6.3 Auth state hook (`useAuthUser`)
```typescript
// đã fix bug ghi đè role mỗi lần đăng nhập:
async function ensureUserDoc(uid: string, phone: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      phone, role: "CUSTOMER", fullName: "",
      createdAt: serverTimestamp(),
    });
  }
  // KHÔNG merge:true với role — sẽ ghi đè OWNER → CUSTOMER!
}
```

---

## 7. PWA & Push Notifications

### 7.1 Manifest & install
- `public/manifest.json`: name, short_name, theme_color `#16a34a`, icons 192/512 maskable.
- next-pwa generate `sw.js` runtime cache:
  - **CacheFirst** cho static assets (`/_next/static/*`, fonts, icons).
  - **NetworkFirst** cho HTML pages + API.
  - **StaleWhileRevalidate** cho Firestore SDK calls (Firestore SDK tự cache trong IndexedDB rồi, SW chỉ cover network layer).

### 7.2 iOS Web Push (16.4+)
**Quan trọng**: iOS chỉ cho phép push notification **sau khi user Add-to-Home-Screen**. Trang `/profile` có khối hướng dẫn:
```
"Để nhận thông báo trên iPhone:
 1. Mở Safari, tap nút Share (mũi tên hướng lên)
 2. Cuộn xuống → 'Add to Home Screen'
 3. Mở app từ icon mới (không từ Safari)
 4. Vào /profile → tap 'Bật thông báo'"
```

### 7.3 FCM Web Push setup
- `public/firebase-messaging-sw.js` — service worker riêng cho FCM, KHÔNG chung với next-pwa SW.
- Khi user đăng nhập: `getMessaging() → getToken()` → lưu vào `/users/{uid}.fcmTokens` (map: token → timestamp).
- `onMessage` (foreground): hiển thị toast trong app.
- Cron clean: token cũ > 30 ngày không dùng → xóa.

### 7.4 Offline support (v1 scope)
- **Firestore SDK enableIndexedDbPersistence**: đã bật, cache trong IndexedDB tự động.
- Khách mất mạng vẫn xem được thẻ điện tử + thông báo cũ.
- Write offline: Firestore queue + sync khi up → callable functions sẽ fail, retry tự động qua wrapper `lib/callable.ts`.
- **Out of scope v1**: bộ đệm phức tạp cho UI khác, background sync API.

---

## 8. Performance & Cost Optimization

### 8.1 Bundle size
- next-pwa wrap với `disable: process.env.DISABLE_PWA === "1"` cho dev.
- `webpackMemoryOptimizations: lowMem` khi build local (RAM thấp).
- Dynamic import cho `html5-qrcode` (chỉ trang `/checkin`), `qrcode.react` (chỉ trang `/admin/qr-gate`).
- Shadcn/UI: import từng component, không barrel.

### 8.2 Firestore reads optimization
- `useDocument` / `onSnapshot` chỉ cho realtime cần thiết (pricing, orders pending, slots).
- `getDocs` 1 lần cho list ít thay đổi (coaches, customers list).
- Pagination với `limit(20) + startAfter` cho `/admin/customers`, `/admin/orders`.
- Composite indexes đã có: `(status, createdAt desc)` cho orders.
- Tránh `arrayContains` trên field lớn — đã giữ `fcmTokens` là map (key = token).

### 8.3 Cost ước tính (Blaze tier)
| Khoản | Ước tính/tháng |
|---|---|
| Firestore reads | ~500k/tháng = $0.30 |
| Firestore writes | ~100k/tháng = $0.18 |
| Cloud Functions invocations | ~50k = $0.02 |
| Cloud Functions compute | ~5GB-sec = $0.04 |
| SMS OTP (Firebase free tier 10/day rồi tính) | ~$5–10 nếu 2k user/năm |
| FCM | Free unlimited |
| Storage | < 1GB = $0.03 |
| Hosting Vercel | Free tier (Hobby) đủ |
| **Tổng** | **~$10–20/tháng** |

### 8.4 Monitoring
- Firebase Console → Performance Monitoring tab (tự bật cho web SDK).
- Cloud Logging cho functions (mặc định).
- Alert: budget alert $30/tháng → email Owner.

---

## 9. Phases triển khai (status)

| Phase | Trạng thái | Ngày hoàn thành | Output |
|---|---|---|---|
| **1. Phân tích nghiệp vụ + 10 invariants** | ✅ | tuần 1 | Spec đóng băng |
| **2. ERD + Firestore + Security rules design** | ✅ | tuần 1 | Sơ đồ + draft rules |
| **3. Mockup HTML 35 màn** | ✅ | tuần 2 | `mockups/index.html` |
| **4. Scaffold Next.js 15 + Firebase config** | ✅ | tuần 2 | repo `D:\Hoboi_version2` |
| **5. Types + Constants + Utils + Hooks** | ✅ | tuần 3 | `src/lib/`, `src/types/` |
| **6. Cloud Functions (12 functions)** | ✅ | tuần 3 | `functions/src/` |
| **7. UI Customer (8 trang)** | ✅ | tuần 4 | `src/app/(customer)/` |
| **8. UI Admin (8 trang) + Coach (2 trang)** | ✅ | tuần 4 | `src/app/(staff)/`, `(coach)/` |
| **9. Firebase project setup + deploy + seed** | ✅ | tuần 5 | project `hoboiapp` LIVE |
| **10. Pricing động + CRUD HLV + UAT round 1–2** | ✅ | tuần 5–6 | Batch fix cuối |
| **11. UAT toàn diện (khách + lễ tân + HLV)** | 🟡 | đang | — |
| **12. PDPL compliance (privacy page, deleteAccount)** | ⬜ | TBD | `/privacy`, callable `deleteAccount` |
| **13. App Check + reCAPTCHA SMS defense (production)** | ⬜ | TBD | Console config + code update |
| **14. Vercel deploy production** | ⬜ | TBD | URL prod |
| **15. Tablet cổng + đào tạo nhân viên** | ⬜ | TBD | — |

---

## 10. Lệnh deploy chuẩn

### 10.1 Local dev
```powershell
# Refresh PATH (Node mới cài)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Dev server (ít crash hơn production build trên máy RAM thấp)
$env:DISABLE_PWA = "1"
$env:LOW_MEM = "1"
$env:NODE_OPTIONS = "--max-old-space-size=2560"
npm run dev

# Hoặc production server local
npm run build
npm run start
```

### 10.2 Functions local emulator
```powershell
cd functions
npm run build
firebase emulators:start --only functions,firestore,auth
```

### 10.3 Production deploy
```powershell
# Backend
firebase use hoboiapp
firebase deploy --only firestore:rules,firestore:indexes,storage,functions

# Seed (lần đầu hoặc khi reset)
$env:GOOGLE_APPLICATION_CREDENTIALS = "service-account.json"
npx tsx seed/seed.ts
npx tsx seed/seedPricing.ts
npx tsx seed/setRole.ts +84947010978 OWNER

# Frontend (sau khi push GitHub)
# Vercel tự động build trên push main branch
# KHÔNG đặt DISABLE_PWA/LOW_MEM trên Vercel (RAM đủ)
```

---

## 11. Vấn đề môi trường local

### 11.1 Quirks máy dev (xem `memory/build-environment.md`)
- **Node v24.16.0** đã cài qua winget. PATH không tự update → mỗi PowerShell session phải refresh.
- **RAM hạn chế** (~1.5–2.5GB trống) → bắt buộc cờ `DISABLE_PWA=1 LOW_MEM=1 NODE_OPTIONS=--max-old-space-size=2560`.
- **Dev server** hay crash → ưu tiên `npm run build && npm run start` cho test local.
- **Trên Vercel**: KHÔNG đặt các cờ trên (RAM CI đủ + cần PWA bật).

### 11.2 Firebase CLI
- Account đã login: `stanfordpines257@gmail.com`
- Default project: `hoboiapp`
- Service account JSON cho seed scripts: tải từ Firebase Console → Project Settings → Service accounts.

---

## 12. Vercel Deploy (chưa làm)

### 12.1 Bước
1. **GitHub repo**: tạo repo private, push code (đảm bảo `.env.local`, `service-account.json` trong `.gitignore`).
2. **Vercel Import**: chọn Next.js framework auto-detect.
3. **Environment Variables** (Production scope):
   ```
   NEXT_PUBLIC_FB_API_KEY=...
   NEXT_PUBLIC_FB_AUTH_DOMAIN=hoboiapp.firebaseapp.com
   NEXT_PUBLIC_FB_PROJECT_ID=hoboiapp
   NEXT_PUBLIC_FB_STORAGE_BUCKET=hoboiapp.appspot.com
   NEXT_PUBLIC_FB_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FB_APP_ID=...
   NEXT_PUBLIC_FB_VAPID_KEY=...          ⭐ cho FCM Web Push
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...    ⭐ cho App Check
   ```
4. **KHÔNG** đặt `DISABLE_PWA` / `LOW_MEM`.
5. **Custom domain** (sau): `hoboi.htbaolam.com` hoặc giữ `.vercel.app` cho v1.
6. **Add domain vào Firebase Auth authorized domains**.

### 12.2 Post-deploy checklist
- [ ] OTP gửi được trên domain prod
- [ ] App Check đã bật + reCAPTCHA site key prod đăng ký với Firebase
- [ ] FCM Web Push hoạt động (test trên 1 iPhone real đã Add-to-Home-Screen)
- [ ] Lighthouse mobile ≥ 90
- [ ] Service worker register thành công (Application tab DevTools)
- [ ] `/privacy` page có nội dung đầy đủ

---

## 13. Testing Strategy

### 13.1 Trong v1 (manual + smoke test)
- Test thủ công theo Acceptance Criteria trong PRD §12
- Smoke test sau mỗi deploy: `seed/check.ts` (đọc 1 doc từ mỗi collection)
- Test số: +84900000001~003 với OTP cố định

### 13.2 Hoãn (sau khi launch ổn)
- Vitest cho `lib/utils.ts` (audienceOf, formatVND, ...)
- Playwright e2e cho luồng chính (signin → buy → checkin)
- Firestore emulator + jest-firestore cho test security rules

---

## 14. Backup & Disaster Recovery

| Loại | Tần suất | Retention | Khôi phục |
|---|---|---|---|
| **Firestore backup** | Daily 03:00 ICT (Cloud Scheduler trigger Firestore export) | 30 ngày | `gcloud firestore import gs://hoboiapp-backups/<date>` |
| **Source code** | Mỗi commit | Vĩnh viễn (GitHub) | `git checkout` |
| **Service account JSON** | Mỗi lần xoay key | — | Tạo mới từ Console |
| **Audit log** | — | Vĩnh viễn (Firestore append-only) | Đọc trực tiếp |

**Quy trình khi sự cố**:
1. Check Firebase Status: https://status.firebase.google.com/
2. Check Vercel Status: https://www.vercel-status.com/
3. Nếu Firestore down: lễ tân ghi sổ tay → sync khi up
4. Nếu app down: Owner gọi support, restore từ git HEAD ổn định trước

---

## 15. Lịch sử thay đổi

| Phiên bản | Ngày | Người | Nội dung |
|---|---|---|---|
| 1.0 | 2026-06-14 | Claude + Owner | Plan ban đầu khi đóng băng spec |
| 2.0 | 2026-06-16 | Claude (Opus 4.7) + Deep Research | Viết lại theo best practices: App Check, Transactions, Cloud Functions v2 concurrency, iOS Web Push, PDPL compliance, cost estimate, monitoring, backup plan, testing strategy |
| 2.1 | 2026-06-17 | Claude (Opus 4.7) | UI/UX overhaul + bug fixes (chi tiết §16) |
| **2.2** | **2026-06-17** | **Claude (Opus 4.7) + Owner UAT feedback** | **Triển khai 8 chỉnh sửa PRD v2.1 (chi tiết §17)** |
| **2.3** | **2026-06-22** | **Claude (Opus 4.7) + Owner UAT round 4** | **9 chỉnh sửa D1–D9: xóa đơn 1-click, back button, fix logout admin, fix wizard khóa, lễ tân duyệt vé lượt, bỏ chiều cao trẻ, restructure flow Dịch vụ, fix khách hàng rỗng, điểm danh hộ vé lượt (§18)** |
| **2.4** | **2026-06-23** | **Claude (Opus 4.7) + Owner UAT round 5** | **4 chỉnh sửa E1–E4: fix điểm danh hộ không tìm thấy khách (Auth fallback), restructure check-in khách (bỏ "Số người cùng vào" + bộ chọn thẻ), hàng đợi lễ tân audio beep, màn HLV hoàn thiện ghi chú + báo nghỉ + highlight vắng (§19)** |
| **2.4.1** | **2026-06-23** | **Claude (Opus 4.7) + Owner hotfix** | **4 sửa F1–F4: bỏ vé thời hạn khỏi check-in (chỉ /cards), đảo E1 thành auto-create doc placeholder, thêm syncAllAuthUsersToFirestore + nút Đồng bộ Auth, ghi lại quy trình deploy (§19.6)** |

## 16. Lịch sử bug fix & UI polish (v2.1 — 2026-06-17)

### 16.1 Backend bugs đã sửa
| # | File | Vấn đề | Sửa |
|---|---|---|---|
| BF-1 | [admin.ts:66](../functions/src/admin.ts:66) | `userId: ${coachId}-uid` — placeholder giả gán cho coach mới tạo | Đổi thành `userId: null`; được điền thực khi Owner gán role COACH qua `setUserRole` |
| BF-2 | [admin.ts updatePricing](../functions/src/admin.ts) | Audit log không lưu before/after diff | Đọc giá cũ trước khi ghi mới, lưu `detail: { before, after }`; thêm `updatedBy: uid`; dùng `merge: true` |
| BF-3 | [orders.ts cancelOrder](../functions/src/orders.ts) | Thiếu audit log (INV-12 yêu cầu) | Thêm `auditLogs.add` với action `CANCEL_ORDER`; thêm field `cancelledBy` vào order |
| BF-4 | [orders.ts confirmPayment](../functions/src/orders.ts) | Khách không nhận thông báo khi thẻ được kích hoạt | Sau transaction, gọi `notifyUser` (FCM + in-app inbox) với tiêu đề "Thẻ đã kích hoạt 🎉" |
| BF-5 | [staff.ts setUserRole](../functions/src/staff.ts) | `getUserByPhoneNumber` fail vì Owner nhập SĐT không E.164 | Thêm `normalizeVNPhone()` — chấp nhận "0905...", "+84905...", có dấu cách/gạch; chuẩn về E.164 trước khi query |
| BF-6 | [helpers.ts](../functions/src/helpers.ts) (mới) | Auth/audit helpers duplicate trong nhiều file | Tạo file dùng chung `requireAuth/requireStaff/requireOwner/audit` + ghi chú cách bật App Check |

### 16.2 UI/UX polish
| Khu vực | Trước | Sau |
|---|---|---|
| **Design system** | Globals.css tối thiểu, không animation | CSS variables + safe-area, 6 keyframes animations, btn/card/chip/input/skeleton utilities |
| **Font** | System default | Inter Vietnamese (next/font) |
| **Tailwind** | 5 màu brand, 1 keyframe | Thêm shadows (card/elevated/glow), 6 keyframes, accent palette, ink palette |
| **Components mới** | — | `Toast`, `Skeleton/SkeletonList`, `EmptyState` |
| **BottomNav** | Phẳng, không safe-area, không indicator | Backdrop-blur, safe-area inset, active highlight pill + top bar, Check-in CTA highlighted |
| **Landing** | List vé lẻ rời | Header gradient + chips + stats card + fade-in animations + PDPL badge |
| **Sign-in** | 3 màn rời, button "Quay lại" thô | Progress dots, country chip 🇻🇳 +84, OTP one-time-code autocomplete, resend countdown 60s |
| **Home (khách)** | Header + grid 4 ô | Header gradient + dynamic greeting + skeleton loading + animated progress bars + bell badge cho noti chưa đọc |
| **Services** | Cards xếp dọc | "Mua cho ai" UI radio đẹp + audience selector card + section titles + Khóa học card gradient nổi bật |
| **Check-in** | QR reader thô, không hint | Frame guide corners, pulse-ring animation khi chờ, scanner preview gradient màu theo loại dịch vụ |
| **Cards** | List + caption text | MemberCard giữ nguyên (đẹp giống thẻ thật) + chip status, skeleton loading |
| **Profile** | List icon ASCII | Lucide icons, gradient header với role chip, hướng dẫn iOS Add-to-Home-Screen tự ẩn nếu đã standalone |
| **Toast** | `setMsg` + fixed div tự build | `useToast()` global với success/error/info, animation fade-up, dismiss tự động 3.5s |
| **Loading** | "Đang tải…" text | `SkeletonList` shimmer animation |
| **Empty states** | Inline text "chưa có" | `<EmptyState>` component với icon tròn, mô tả, CTA button |

### 16.3 Requirements alignment (PRD ↔ code)
| Lệch | Quyết định |
|---|---|
| PRD nói `beneficiaryKind: "SELF" \| "CHILD"`, code dùng `"USER" \| "CHILD"` | Sửa PRD theo code (code đã chạy + deploy) |
| PRD nói `productType: "MEMBERSHIP" \| "TICKET_PACKAGE" \| "COURSE"`, code dùng `"PASS" \| "PACKAGE" \| "SWIM_COURSE"` | Sửa PRD theo code |
| PRD nói field `total/remaining`, code dùng `totalSessions/remainingSessions` | Sửa PRD theo code |
| PRD nói `fcmTokens: { [token]: timestamp }`, code dùng `fcmTokens: string[]` | Giữ array (đơn giản, đủ dùng v1); đổi PRD |
| PRD nói SwimStyle dùng "BREAST/BACK", code dùng "BREASTSTROKE/BACKSTROKE" | Sửa PRD theo code |
| PRD tách PARENT thành role riêng | Quyết định v1: gộp với CUSTOMER + cờ `childrenIds`. Ghi rõ trong PRD §4.0 |

### 16.4 Chưa làm (giữ trong backlog)
- [ ] **App Check production**: cần config Console + thêm `enforceAppCheck: true` cho từng `onCall`. Code helpers đã chuẩn bị sẵn.
- [ ] **Trang `/privacy`** (PDPL yêu cầu trước launch).
- [ ] **Callable `deleteAccount`** (right to erasure theo PDPL).
- [ ] **Firestore daily backup** — cần cron Cloud Scheduler trigger `gcloud firestore export`.

---

## 17. v2.2 Implementation — 8 chỉnh sửa từ PRD v2.1

Triển khai 8 hạng mục C1–C8 trong PRD §14. Sắp theo thứ tự thực hiện (ít rủi ro trước → nhiều rủi ro sau).

### 17.1 Tổng quan task list

| # | Task | Files chính | Backend? | Ước tính |
|---|---|---|---|---|
| C1 | Logout cho Coach | [src/app/(coach)/coach/layout.tsx](../src/app/(coach)/coach/layout.tsx) | — | 15 phút |
| C4 | Signin nhận 10 số đầy đủ | [src/app/(public)/signin/page.tsx](../src/app/(public)/signin/page.tsx) + thêm `lib/phone.ts` | — | 30 phút |
| C5 | Gỡ quyền user | [src/app/(staff)/admin/staff/page.tsx](../src/app/(staff)/admin/staff/page.tsx) + [functions/src/staff.ts](../functions/src/staff.ts) | ✅ thêm `revokeUserRole` | 1h |
| C3a | Lịch sử đơn theo ngày/tháng/năm | [src/app/(staff)/admin/orders/page.tsx](../src/app/(staff)/admin/orders/page.tsx) | — (đọc Firestore client) | 1.5h |
| C3b | Xóa cứng đơn có lý do | [functions/src/admin.ts:deleteOrder](../functions/src/admin.ts) + UI confirm | ✅ mở rộng `deleteOrder` | 1h |
| C6 | Dashboard chéo Loại × Đối tượng | [src/app/(staff)/admin/page.tsx](../src/app/(staff)/admin/page.tsx) + reports | — | 1h |
| C7 | Báo cáo Owner filter Ngày/Tháng/Năm | [src/app/(staff)/admin/reports/page.tsx](../src/app/(staff)/admin/reports/page.tsx) | — | 2h |
| C2 | Wizard 4 bước + gộp ca | [src/app/(customer)/services/course/page.tsx](../src/app/(customer)/services/course/page.tsx) + [functions/src/orders.ts:createOrder](../functions/src/orders.ts) | ✅ server tự tính `startDate` | 2.5h |
| C8 | Khóa học của tôi | mới [src/app/(customer)/my-courses/page.tsx](../src/app/(customer)/my-courses/page.tsx) + `[id]/page.tsx` + nav | — (đọc Firestore client) | 3h |

**Tổng**: ~13h dev + 2h test = 2 ngày làm việc.

### 17.2 Chi tiết kỹ thuật từng task

#### C1 — Logout Coach (rủi ro: thấp)
- Sửa `src/app/(coach)/coach/layout.tsx` thêm header bar với icon LogOut (lucide). Onclick → `signOut(auth)` → `router.replace("/")`.
- Tái dùng pattern logout đang có ở `(customer)/profile/page.tsx`.

#### C4 — Phone input 10 chữ số (rủi ro: thấp — pure UI)
- Tạo `src/lib/phone.ts` exports `normalizeVNPhone(input: string): string` (đã có bản backend trong `functions/src/staff.ts`; nhân bản client). Regex chấp nhận `0xxxxxxxxx` `+84xxxxxxxxx` `84xxxxxxxxx` → trả `+84...`.
- Sửa `(public)/signin/page.tsx`:
  - Bỏ chip "+84"; placeholder = "0947 010 978"; `maxLength=10`; `inputMode="numeric"`.
  - Validation: regex `/^0\d{9}$/`, báo lỗi "Vui lòng nhập đủ 10 số bắt đầu bằng 0".
  - Trước khi `signInWithPhoneNumber`, gọi `normalizeVNPhone`.
- Sửa toàn bộ chỗ search SĐT (`admin/customers`, `admin/checkin-assist`, `admin/staff`) — chấp nhận 10 số input, normalize trước khi query Firestore (`where("phone","==",normalized)` — đồng thời migrate dữ liệu cũ nếu lưu khác format).
- **Lưu ý dữ liệu cũ**: tài liệu hiện đang lưu `phone` ở dạng `+84...` (E.164). Giữ nguyên format lưu; chỉ thay đổi cách hiển thị (`displayPhone(e164)` → `0947 010 978`) + cách nhận input.

#### C5 — Gỡ quyền (rủi ro: trung — touch custom claims)
- Functions: tạo `revokeUserRole` trong `functions/src/staff.ts`:
  ```ts
  export const revokeUserRole = onCall({ region }, async (req) => {
    requireOwner(req);
    const { targetUid } = req.data;
    if (targetUid === req.auth!.uid) throw new HttpsError("failed-precondition", "Không thể gỡ quyền chính mình");
    // Đếm OWNER còn lại nếu target đang là OWNER
    const target = await db.doc(`users/${targetUid}`).get();
    if (target.data()?.role === "OWNER") {
      const owners = await db.collection("users").where("role","==","OWNER").get();
      if (owners.size <= 1) throw new HttpsError("failed-precondition", "Phải có ít nhất 1 OWNER khác");
    }
    await admin.auth().setCustomUserClaims(targetUid, { role: "CUSTOMER" });
    await db.doc(`users/${targetUid}`).update({ role: "CUSTOMER" });
    await db.collection("auditLogs").add({ actorId: req.auth!.uid, action: "REVOKE_ROLE",
      targetType: "user", targetId: targetUid, detail: { from: target.data()?.role }, at: FV.serverTimestamp() });
    return { ok: true };
  });
  ```
- Export trong `functions/src/index.ts`.
- UI `admin/staff/page.tsx`: với mỗi user role ≠ CUSTOMER → button đỏ "Gỡ quyền" + Dialog confirm hiển thị role hiện tại + cảnh báo. Onclick gọi callable.
- Sau call thành công → toast success + refresh list + nếu user đang đăng nhập là target → force `getIdToken(true)`.

#### C3a — Lịch sử đơn theo ngày/tháng/năm
- Sửa `admin/orders/page.tsx`: thêm date-range picker (component custom dùng `<input type="date">` + preset buttons "Hôm nay/Hôm qua/7 ngày/Tháng này/Tháng trước/Năm này/Tùy chỉnh").
- Query Firestore: `where("createdAt", ">=", rangeStart).where("createdAt","<=", rangeEnd).orderBy("createdAt","desc").limit(50)`. Cần composite index `(status, createdAt)` đã có; thêm index `(createdAt desc)` standalone nếu chưa.
- Group by ngày (label "Hôm nay/Hôm qua/DD/MM/YYYY"). Tổng tiền + đếm đơn ở footer mỗi nhóm.

#### C3b — Xóa cứng đơn có lý do
- Mở rộng `functions/src/admin.ts:deleteOrder`: 
  - Cho phép tất cả trạng thái (không chỉ PENDING) **nếu** request có `reason` không rỗng.
  - Nếu đơn PAID: cập nhật memberships/ticketPackages/enrollments liên quan với `orderDeleted: true` (không thay đổi `status` để khách vẫn dùng được thẻ đã active). Refund logic vẫn riêng — KHÔNG tự refund.
  - Audit log: `DELETE_ORDER` với `detail: { reason, prevStatus, productType }`.
- UI orders: nút "Xóa" hiển thị cho Owner ở mọi trạng thái (đỏ, icon trash). Confirm 2 lớp: dialog 1 yêu cầu nhập lý do (textarea), dialog 2 xác nhận lần cuối "Bạn chắc chắn? Hành động này không thể hoàn tác."

#### C6 — Dashboard chéo Loại × Đối tượng
- Sửa `admin/page.tsx` (dashboard Owner+Receptionist):
  - Query `/orders` PAID hôm nay (đã có).
  - Reduce thành matrix `{ [productType]: { [audience]: { count, amountVND } } }`.
  - Render bảng: hàng = productType (Khóa học / Vé tháng / Gói lượt), cột = audience (Người lớn / Trẻ ≥1.4m / Trẻ <1.4m). Với khóa học, audience = N/A (gộp 1 cột).
  - Hiển thị `{count} đơn / {formatVND(amount)}` mỗi ô. Tổng cột + tổng hàng.

#### C7 — Báo cáo Owner filter Ngày/Tháng/Năm
- Sửa `admin/reports/page.tsx`:
  - Segmented control "Ngày | Tháng | Năm | Tùy chỉnh".
  - Khi chọn Ngày: date picker; query orders PAID trong ngày.
  - Khi chọn Tháng: month picker (`type="month"`); query trong tháng + bar chart group by ngày.
  - Khi chọn Năm: year picker (select); query cả năm + bar chart group by tháng (12 cột).
  - Khi tùy chỉnh: 2 date pickers from/to.
  - Tái dùng matrix chéo từ C6.
- Cần composite index `(status, paidAt desc)` cho query trên paidAt.

#### C2 — Wizard 4 bước + gộp ca (rủi ro: cao — thay đổi UX cốt lõi)
- Frontend `(customer)/services/course/page.tsx`:
  - Step state đổi từ 5 → 4. Bỏ state `startDate`.
  - Step "Chọn ca": query slots của coach, **gộp theo `(startHour, endHour)`**, hiển thị label "07h–08h (T3-T5-T7)" + "Còn N chỗ" (lấy `min(20 - enrolledCount)` qua 3 weekday).
  - Step "Xác nhận": hiển thị `startDate` server-suggested (tính client-side cho preview: `nextOccurrence(firstWeekday, now)`) + nút "+1 tuần" / "−1 tuần" (clamp ±4 tuần).
  - Payload gửi `createOrder`: `{ coachId, hourGroup: { startHour, endHour }, weekOffset: 0..4 }` thay vì `slotId, startDate`.
- Backend `functions/src/orders.ts:createOrder`:
  - Nhận `hourGroup` + `weekOffset`. Lấy 3 slot doc của coach theo (weekday, startHour) — chọn slot có weekday gần nhất từ now+weekOffset chưa đầy (`enrolledCount < capacity`).
  - Tính `startDate = nextOccurrence(chosenSlot.weekday, now + weekOffset*7 days)`. Nếu đã quá giờ hôm đó → bump tuần kế.
  - Transaction tăng `enrolledCount` của slot được chọn (giữ logic INV-3, INV-11).
- Helper `lib/date.ts`: `nextOccurrence(weekday: 0..6, from: Date): Date`.
- Migration: enrollment doc vẫn lưu `slotId` cụ thể như trước → các trang HLV/khóa của tôi không cần đổi.

#### C8 — Khóa học của tôi (rủi ro: trung — màn mới, nhiều query)
- Tạo route `(customer)/my-courses/page.tsx` (list) + `(customer)/my-courses/[id]/page.tsx` (detail).
- **List query**: 2 query parallel: 
  ```ts
  where("studentId","==",uid)                     // bản thân
  where("parentId","==",uid)                      // các con
  ```
  Gộp + sort theo status (ACTIVE first, `expiryDate` asc).
- **Detail query**: 
  - 1 read `/enrollments/{id}` (đã có data từ list, có thể truyền qua nav state).
  - 1 read `/coaches/{coachId}` để lấy SĐT cho Zalo deeplink.
  - 1 listen `/enrollments/{id}/attendances` order by `date desc` limit 15.
  - 1 listen `/users/{uid}/notifications` where `type in ["COURSE_REMAINING","COURSE_EXPIRED","EXPIRY_WARNING"]` limit 5.
- Components mới:
  - `<CourseProgressCard>`: progress bar + days-remaining countdown.
  - `<AttendanceList>`: rows với date + source chip.
- Update `BottomNav.tsx` hoặc Home shortcut grid: thêm icon "Khóa học của tôi" (BookOpen lucide).
- Firestore index cần: `enrollments (parentId, status, expiryDate)` + `enrollments (studentId, status, expiryDate)`. Thêm vào `firestore/firestore.indexes.json`.

### 17.3 Thứ tự deploy đề xuất

1. **PR #1 — Quick wins (UI only)**: C1 + C4 + C6 — không đụng backend, deploy ngay, test trên dev.
2. **PR #2 — Order ops**: C3a + C3b — cần index mới, deploy index trước, sau đó functions + UI.
3. **PR #3 — Owner power tools**: C5 + C7 — cần functions mới, deploy functions trước.
4. **PR #4 — Course UX overhaul**: C2 — UX cốt lõi, làm cuối + UAT kỹ.
5. **PR #5 — New feature**: C8 — feature mới, có thể flag-toggle ẩn link nav cho đến khi UAT xong.

### 17.4 Testing checklist v2.2

- [ ] C1: HLV đăng nhập → bấm logout → về landing → không vào lại `/coach` được.
- [ ] C4: nhập "0947010978" → OTP gửi đến `+84947010978`. Nhập sai format (9 số / có chữ) → báo lỗi VN.
- [ ] C5: Owner gỡ quyền 1 RECEPTIONIST → user đó refresh không vào được `/admin`. Thử gỡ Owner cuối cùng → bị chặn.
- [ ] C3a: chọn "Tháng trước" → list đúng đơn tháng trước, tổng tiền đúng. Chọn ngày 15/06/2026 cụ thể → đếm khớp.
- [ ] C3b: xóa đơn PAID → đơn biến mất khỏi list; thẻ tương ứng vẫn dùng được; auditLog có entry.
- [ ] C6: dashboard hiển thị "3 khóa = 5.4M" sau khi PAID 3 đơn khóa học hôm nay.
- [ ] C7: filter "Năm 2026" → bar chart 12 cột tháng, tổng = tổng các tháng.
- [ ] C2: đăng ký khóa Thầy Tín 14h-15h → server tự chọn ngày T3/T5/T7 gần nhất; thử +1 tuần → đẩy đúng 7 ngày.
- [ ] C8: phụ huynh có 2 con đều học khóa → list hiện 2 thẻ; tap chi tiết hiện đúng attendances; bấm Zalo HLV → mở app Zalo.
- [ ] Regression: check-in QR vẫn hoạt động sau khi đổi createOrder; rules vẫn deny lễ tân vào `/admin/reports`.

### 17.5 Rủi ro & rollback

| Task | Rủi ro | Rollback |
|---|---|---|
| C2 | createOrder thay đổi contract → đơn cũ trong DB không lệch (vẫn giữ slotId), nhưng client cũ cache có thể gửi payload cũ → server cần BC nhận cả 2 format trong 1 tuần. | Functions revert + redeploy version trước; UI version cũ trên Vercel rollback qua Vercel UI. |
| C5 | Gỡ nhầm quyền Owner duy nhất → khóa hệ thống. | Bảo vệ "≥1 OWNER" + có script `seed/setRole.ts +84... OWNER` để khôi phục bằng service account. |
| C3b | Xóa đơn PAID làm khó kế toán đối soát. | Audit log giữ đủ thông tin để revert thủ công; orderDeleted flag thay vì xóa data cứng cũng OK. |
| C4 | Khách cũ đã quen UI "+84" có thể bối rối → thêm hint nhỏ "Nhập đủ 10 số (bắt đầu bằng 0)". | UI-only, revert nhanh. |

---

---

## 18. v2.3 Implementation — 9 chỉnh sửa từ UAT round 4 (2026-06-22)

Triển khai 9 hạng mục D1–D9 do Owner phản hồi sau khi dùng thử trên local. Sắp theo độ rủi ro (thấp → cao) để PR nhỏ + dễ rollback.

### 18.1 Tổng quan task list

| # | Task | Files chính | Backend? | Ước tính |
|---|---|---|---|---|
| D3 | Fix logout ẩn ở subpage admin | [src/app/(staff)/admin/layout.tsx](../src/app/(staff)/admin/layout.tsx) + [components/AdminSidebar.tsx](../src/components/AdminSidebar.tsx) | — | 30 phút |
| D2 | Back button toàn cục | mới [components/BackButton.tsx](../src/components/BackButton.tsx) + chèn vào ~12 page | — | 1.5h |
| D6 | Bỏ chiều cao ở form trẻ em | [src/app/(customer)/children/page.tsx](../src/app/(customer)/children/page.tsx) | — | 30 phút |
| D8 | Fix `/admin/customers` rỗng | [src/app/(staff)/admin/customers/page.tsx](../src/app/(staff)/admin/customers/page.tsx) + firestore.rules check | — (có thể cần rules) | 1h |
| D1 | Xóa đơn 1-click | [src/app/(staff)/admin/orders/page.tsx](../src/app/(staff)/admin/orders/page.tsx) + [functions/src/admin.ts:deleteOrder](../functions/src/admin.ts) | ✅ bỏ require `reason` | 45 phút |
| D7 | Restructure flow Dịch vụ | viết lại [src/app/(customer)/services/page.tsx](../src/app/(customer)/services/page.tsx) + tách subroute `services/pass` `services/package` `services/course` | — | 3h |
| D4 | Fix wizard khóa học bug "Thiếu HLV" | [src/app/(customer)/services/course/page.tsx](../src/app/(customer)/services/course/page.tsx) + [functions/src/orders.ts:createOrder](../functions/src/orders.ts) | ✅ kiểm tra payload contract | 1.5h |
| D9 | Điểm danh hộ cho vé lượt | [src/app/(staff)/admin/checkin-assist/page.tsx](../src/app/(staff)/admin/checkin-assist/page.tsx) + [functions/src/checkin.ts:staffCheckinByPhone](../functions/src/checkin.ts) | ✅ thêm branch PACKAGE | 1.5h |
| D5 | Vé lượt: lễ tân duyệt check-in | mới `/checkinRequests` collection + [functions/src/checkin.ts](../functions/src/checkin.ts) thêm `requestCheckin/approveCheckin/rejectCheckin` + UI customer chờ + UI lễ tân hàng đợi | ✅ mới 3 functions + cron expire | 4h |

**Tổng**: ~14h dev + 2h test = 2 ngày làm việc.

### 18.2 Chi tiết kỹ thuật từng task

#### D3 — Fix logout ẩn ở `/admin/products` `/admin/reports` (rủi ro: thấp)

**Phỏng đoán nguyên nhân**: nút logout nằm trong `AdminSidebar` (desktop) hoặc topbar (mobile). Khi vào subpage, layout có thể wrap trong container `overflow-hidden` cao bằng viewport → footer sidebar bị cắt. Hoặc subpage tự render header riêng đè lên topbar.

**Fix**:
- Kiểm tra [src/app/(staff)/admin/layout.tsx](../src/app/(staff)/admin/layout.tsx) — sidebar phải `flex-col h-screen`, nút logout `mt-auto` (đẩy xuống đáy). Main content `overflow-y-auto`.
- Mobile: thêm topbar persistent (sticky top-0) chứa logo + nút logout icon, render ở layout — KHÔNG để các subpage tự định nghĩa header.
- Test: navigate `/admin → /admin/products → /admin/reports`, đảm bảo nút logout luôn click được.

#### D2 — Back button toàn cục (rủi ro: thấp)

- Tạo `src/components/BackButton.tsx`:
  ```tsx
  "use client";
  import { ArrowLeft } from "lucide-react";
  import { useRouter } from "next/navigation";
  export function BackButton({ fallback = "/" }: { fallback?: string }) {
    const router = useRouter();
    return (
      <button onClick={() => { if (window.history.length > 1) router.back(); else router.replace(fallback); }}
              className="p-2 -ml-2 rounded-full hover:bg-black/5" aria-label="Quay lại">
        <ArrowLeft className="size-5" />
      </button>
    );
  }
  ```
- Chèn `<BackButton />` vào header trái của các trang **không phải tab root**:
  - Customer: `services/*`, `checkin`, `cards`, `children`, `notifications`, `my-courses/*` (chi tiết khóa, không phải list).
  - Admin: `orders`, `products`, `coaches`, `customers`, `staff`, `reports`, `qr-gate`, `checkin-assist` — sidebar có nav, nhưng mobile cần back.
  - Coach: `students` (list dạy).
- KHÔNG chèn ở: `(customer)/home`, `(staff)/admin` (root), `(coach)/coach` (root), `(public)/signin`.

#### D6 — Bỏ chiều cao ở form đăng ký trẻ em (rủi ro: thấp)

- Form `(customer)/children/page.tsx`: bỏ input `heightCm` khỏi modal Thêm/Sửa. Không xóa field khỏi schema (vẫn optional trong `Child` type).
- Update text hint: "Chiều cao sẽ được xác định khi mua thẻ tại quầy."
- Không cần migration — docs cũ có heightCm vẫn dùng được.
- Khi mua thẻ: ở wizard chọn audience (radio trẻ <1.4m / ≥1.4m / người lớn) — đã có trong D7.

#### D8 — Fix `/admin/customers` rỗng (rủi ro: trung — cần debug query)

**Phỏng đoán**: 
- Query có thể filter `where("role","==","CUSTOMER")` nhưng user mới đăng ký có `role: undefined` (do `ensureUserDoc` ghi `role:"CUSTOMER"` nhưng có race condition) → bị loại.
- Hoặc rules `/users/{uid}` cấm read cross-user trừ self → staff query bị deny silently.

**Fix**:
1. Kiểm tra `firestore.rules` cho `/users`: cho phép `isStaff()` read list.
2. Đổi query thành `where("role","in",["CUSTOMER","PARENT"])` để bắt cả 2 role (PARENT v1 = CUSTOMER nhưng phòng hờ).
3. Hoặc bỏ filter role và lọc client-side: `where("phone","!=","")` để loại staff/coach (vì phone luôn có với customer thật).
4. Thêm console.warn nếu snap.empty để debug.
5. Test: tạo 2 customer test → reload page → thấy đủ 2 dòng.

#### D1 — Xóa đơn 1-click (rủi ro: thấp)

- Functions `deleteOrder`:
  - **Bỏ** require `reason` (vẫn chấp nhận nếu client gửi để audit).
  - Vẫn yêu cầu `requireOwner`.
  - **Xóa thực sự** doc `/orders/{id}` (current v2.2 không xóa cứng cho PAID — chỉ set `orderDeleted:true`). v2.3: dùng `transaction.delete(orderRef)`.
  - Set `orderDeleted:true` trên membership/ticketPackage/enrollment liên kết (để báo cáo realtime loại ra).
  - Tương ứng xóa `/payments/{paymentId}` của order đó (hoặc set `orderDeleted:true`).
  - Audit log `DELETE_ORDER` với `detail: { prevStatus, productType, amountVND, beneficiaryName }` để recovery thủ công nếu cần.
- UI `admin/orders`: nút "Xóa" cho Owner ở mọi trạng thái → onClick gọi callable **trực tiếp**, không dialog. Toast "Đã xóa đơn #abc" + undo trong 5s? → v1 không cần undo, audit log đủ.
- **Lưu ý report**: query reports phải filter `orderDeleted:true` ra (`where("orderDeleted","!=",true)` không hoạt động trên field thiếu → giải pháp: lưu `orderDeleted:false` mặc định khi tạo order; query `where("orderDeleted","==",false)`).
- Migration: backfill 1 lần các order cũ → thêm `orderDeleted:false`. Có thể chạy 1 callable temp hoặc script trong `seed/`.

#### D7 — Restructure flow Dịch vụ (rủi ro: trung — UI lớn nhưng không đụng data)

**Trang chính** `(customer)/services/page.tsx` viết lại:
- Hiển thị 3 card lớn:
  1. **Học bơi** — gradient xanh-cyan, badge "🔥 Phổ biến nhất", emoji 🏊, "Từ 1.800.000₫ · 15 buổi · Có HLV chuyên nghiệp" → click `/services/course`.
  2. **Vé thời hạn** — card trắng border xanh, "Không giới hạn lượt · 1/3/6/12 tháng" → click `/services/pass`.
  3. **Vé lượt** — card trắng, "15 / 30 lượt · Đi nhóm OK" → click `/services/package`.

**Trang vé lượt** mới `(customer)/services/package/page.tsx`:
- Step 1: chọn gói (radio 2 option: "15 lượt" / "30 lượt") với giá cập nhật theo audience.
- Step 2: chọn áp dụng giá theo (radio 3: trẻ <1.4m / trẻ ≥1.4m / người lớn).
- Step 3: chọn người thụ hưởng (bản thân / con — nếu có).
- Step 4: review + xác nhận → callable `createOrder({ productType:"PACKAGE", productSnapshot:{packageSize,audience}, beneficiary…})`.

**Trang vé thời hạn** mới `(customer)/services/pass/page.tsx`:
- Step 1: chọn duration (1T / 3T / 6T / 1N).
- Step 2: chọn audience.
- Step 3: chọn người thụ hưởng.
- Step 4: review + xác nhận → callable `createOrder({ productType:"PASS", ...})`.

**Wizard khóa học** `(customer)/services/course/page.tsx`: giữ flow 4 bước, chỉ thêm back button + fix bug D4.

Tách subroute giúp:
- Mỗi flow đơn giản, không 1 page khổng lồ.
- Back button hoạt động đúng (back về `/services` không phải bước trước nữa).
- Bundle nhỏ hơn.

#### D4 — Fix wizard khóa học bug "Thiếu HLV/khung giờ/ngày bắt đầu" (rủi ro: trung — cần repro)

**Triệu chứng** (ảnh user gửi): user đã chọn đầy đủ Học cho ai (con "bo") + Kiểu (bướm) + HLV (Thầy Tín) + Khung giờ (9h–10h T3-T5-T7) + Ngày (23/06/2026) nhưng vẫn báo lỗi khi bấm "Xác nhận đăng ký".

**Phỏng đoán nguyên nhân**:
1. Client gửi payload thiếu key (vd: `coachId` lưu trong state nhưng quên include khi build `data`). Hoặc gửi `slotId` cũ thay vì `hourGroup` mới (lệch contract v2.2 ↔ server).
2. Backend `createOrder` validate `slotId && startDate && coachId` (theo schema cũ) trong khi v2.2 đổi sang `hourGroup + weekOffset` — chưa cập nhật hoàn chỉnh.
3. `nextOccurrence` trả về `null` khi không có slot match → throw "Thiếu khung giờ".

**Fix**:
1. Đọc current `services/course/page.tsx` + `functions/src/orders.ts:createOrder` để xem contract thực tế.
2. Đồng bộ: client gửi gì → server validate đó. Khi thiếu key cụ thể, throw với tên key đó (vd: "Thiếu coachId") thay vì gộp chung "Thiếu HLV/khung giờ/ngày bắt đầu" → debug nhanh.
3. Test:
   - Đăng ký 1 khóa cho bản thân — phải tạo được order PENDING.
   - Đăng ký cho con — tương tự.
   - +1 tuần / −1 tuần — phải đẩy đúng 7 ngày.

#### D9 — Điểm danh hộ cho vé lượt (rủi ro: trung)

**Backend** `functions/src/checkin.ts:staffCheckinByPhone` (hoặc tạo callable mới `staffCheckinByPhoneForPackage` cho rõ):
- Hiện tại chỉ hỗ trợ ENROLLMENT (khóa học).
- Mở rộng: nhận thêm `kind: "ENROLLMENT" | "PACKAGE"` + `count?: number` (nếu PACKAGE).
- Logic PACKAGE:
  - Tra ticketPackage theo `userId` (parent hoặc bản thân) — ACTIVE + còn ≥ count lượt.
  - Transaction trừ `remainingSessions`, push usageHistory.
  - Tạo `/checkins` doc với `source:"STAFF"`.
  - Audit log `STAFF_CHECKIN_PACKAGE` + push khách.

**UI lễ tân** `admin/checkin-assist/page.tsx`:
- Sau khi tra SĐT → hiển thị **list thẻ ACTIVE của khách** (membership + ticketPackage + enrollment).
- Mỗi card có nút "Điểm danh":
  - Membership → 1 chạm trừ ngày.
  - TicketPackage → mở dialog nhập "Số lượt cần trừ" (default 1, range 1..remaining) → xác nhận.
  - Enrollment (khóa) → 1 chạm điểm danh buổi hôm nay.

#### D5 — Vé lượt: lễ tân duyệt check-in (rủi ro: cao — flow mới)

**Data**: new collection `/checkinRequests/{id}` (schema xem CLAUDE.md §10).

**Backend** `functions/src/checkin.ts`:

```ts
// Khách quét QR (thay cho checkinByQr với PACKAGE)
export const requestCheckin = onCall({ region }, async (req) => {
  requireAuth(req);
  const { qrTokenId, ticketPackageId, suggestedCount } = req.data;
  // verify qrToken, consume
  // verify ticketPackage thuộc user + ACTIVE + còn đủ lượt
  // tạo /checkinRequests/{id} status PENDING expiresAt = now+2m
  // push lễ tân
  return { requestId };
});

// Lễ tân duyệt
export const approveCheckin = onCall({ region }, async (req) => {
  requireStaff(req);
  const { requestId, approvedCount } = req.data;
  // transaction: load request (must be PENDING + not expired)
  // load ticketPackage, trừ approvedCount
  // tạo /checkins doc
  // update request: status=APPROVED, approvedCount, resolvedAt, resolvedBy, checkinId
  // push khách (FCM + inbox)
  return { ok: true };
});

export const rejectCheckin = onCall({ region }, async (req) => {
  requireStaff(req);
  // tương tự, status=REJECTED + lý do
});
```

**Không TTL** (quyết định Owner 2026-06-22): request giữ `PENDING` vô thời hạn — không cron expire. Khách có thể chủ động hủy bằng callable `cancelCheckinRequest` (chỉ chính chủ).

**Rules** `firestore.rules`: 
- `/checkinRequests/{id}`: read self / staff; write **none** (callable only).

**UI customer** `(customer)/checkin/page.tsx`:
- Khi quét QR với vé lượt → gọi `requestCheckin` → nhận `requestId`.
- Listen `/checkinRequests/{requestId}` realtime onSnapshot:
  - `PENDING` → spinner "Đang chờ lễ tân duyệt..." + nút "Hủy yêu cầu" (gọi `cancelCheckinRequest`).
  - `APPROVED` → toast success "Đã trừ X lượt · còn Y" + animation tick.
  - `REJECTED` → toast error + lý do.
  - `CANCELLED` (khách tự hủy) → đóng pop-up.
- Vé thời hạn (membership) → giữ luồng cũ `checkinByQr` (trực tiếp).

**UI lễ tân** `admin/page.tsx` (dashboard) hoặc trang riêng `/admin/queue`:
- Section "Hàng đợi check-in vé lượt" — listen `/checkinRequests` `where("status","==","PENDING").orderBy("createdAt","asc")`.
- Mỗi row: tên khách + tên thẻ + suggestedCount → 2 button "Duyệt" (mở dialog chỉnh `approvedCount` → xác nhận) / "Từ chối" (mở dialog nhập lý do).
- Audio beep + visual highlight khi có request mới (Notification API hoặc đơn giản dùng audio HTML5).

**Index**: `/checkinRequests (status, createdAt asc)`.

### 18.3 Thứ tự deploy đề xuất

1. **PR #1 — UI quick wins**: D3 + D2 + D6 — không backend, ship nhanh.
2. **PR #2 — Bugfix data**: D8 + D4 — debug + fix, có thể cần rules update.
3. **PR #3 — Owner UX**: D1 — backend + UI, deploy functions trước.
4. **PR #4 — Service restructure**: D7 — refactor lớn, làm cẩn thận.
5. **PR #5 — Receptionist powers**: D9 + D5 — feature mới, UAT kỹ với 2 thiết bị (khách + lễ tân) đồng thời.

### 18.4 Testing checklist v2.3

- [ ] **D1**: Owner bấm Xóa → đơn biến mất ngay, không dialog. Auditlog có entry. Báo cáo không tính đơn đã xóa.
- [ ] **D2**: Vào `/services/course` → bấm ← → về `/services`. Vào `/my-courses/abc` → ← → về `/my-courses`. Trên home không có nút ← (đúng).
- [ ] **D3**: `/admin → /admin/products → /admin/reports` → nút Đăng xuất luôn click được trên cả desktop + mobile.
- [ ] **D4**: Đăng ký khóa bơi cho con → KHÔNG còn báo "Thiếu HLV/khung giờ/ngày bắt đầu". Order PENDING được tạo. Slot.enrolledCount +1.
- [ ] **D5**: 
  - Khách quét QR vé lượt → màn khách "Đang chờ lễ tân...". 
  - Màn lễ tân hiện request mới (beep). 
  - Lễ tân chỉnh số lượt 4→2 → duyệt → khách thấy "Đã trừ 2 lượt".
  - Lễ tân từ chối → khách thấy lý do.
  - Để 2 phút không duyệt → cron expire → khách thấy "Hết hạn".
- [ ] **D6**: Form thêm trẻ em không có ô chiều cao. Vẫn lưu được trẻ mới.
- [ ] **D7**: 
  - Vào `/services` thấy Học bơi nổi bật đứng đầu.
  - Chọn Vé lượt → 15 lượt → trẻ <1.4m → bản thân → review giá 300k → xác nhận → order PENDING.
  - Tương tự Vé thời hạn.
- [ ] **D8**: Owner vào `/admin/customers` → thấy đủ N khách hàng. Search SĐT hoạt động.
- [ ] **D9**: Lễ tân `/admin/checkin-assist` tra SĐT khách quên điện thoại → hiện list thẻ → chọn vé lượt → nhập 3 lượt → xác nhận → khách nhận push.
- [ ] **Regression**: 
  - Vé thời hạn quét QR vẫn check-in trực tiếp (không qua queue).
  - Check-in khóa học qua QR (nếu có) vẫn hoạt động.
  - Lễ tân không vào được `/admin/reports`.

### 18.5 Rủi ro & rollback

| Task | Rủi ro | Rollback |
|---|---|---|
| D1 | Xóa nhầm đơn vĩnh viễn | Audit log giữ snapshot `{prevStatus, productType, amountVND, beneficiary}` — recovery thủ công bằng script tạo lại order. |
| D5 | Khách offline khi lễ tân duyệt → push không tới | Cron expire 2 phút + UI khách show TTL countdown để khách biết refresh; lễ tân vẫn thấy "đã duyệt" trong list `/checkins`. |
| D7 | Đơn cũ trong DB có productSnapshot khác format → trang chi tiết đơn hiển thị "—" | Giữ legacy fields trong productSnapshot, không xóa; UI fallback "(không có thông tin)". |
| D4 | Fix bug nhưng phát sinh regression khác | Test cả 3 case (bản thân/con/+1 tuần) trước khi deploy. |
| D8 | Mở rộng rules `/users` cho staff read all → leak phone | Chỉ allow `list` nếu role==OWNER hoặc RECEPTIONIST. Customer field nhạy cảm (fcmTokens) không trả về client thông qua security rules. |

### 18.6 Files mới sẽ tạo

```
src/components/BackButton.tsx               (D2)
src/app/(customer)/services/pass/page.tsx   (D7)
src/app/(customer)/services/package/page.tsx (D7)
functions/src/checkin.ts                    (D5 — add 3 functions)
firestore/firestore.indexes.json            (D5 — add 1 index)
```

---

## 19. v2.4 Implementation — 4 chỉnh sửa từ UAT round 5 (2026-06-23)

Triển khai 4 hạng mục E1–E4 do Owner phản hồi sau khi dùng thử v2.3 trên local.

### 19.1 Tổng quan task list

| # | Task | Files chính | Backend? | Ước tính |
|---|---|---|---|---|
| E1 | Fix bug điểm danh hộ: SĐT khách không tìm thấy (Auth fallback chỉ chẩn đoán, KHÔNG auto-create) | [functions/src/checkin.ts:staffCheckinByPhone](../functions/src/checkin.ts) + [src/app/(staff)/admin/checkin-assist/page.tsx](../src/app/(staff)/admin/checkin-assist/page.tsx) | ✅ thêm callable `searchCustomerByPhone` + refactor `staffCheckinByPhone` | 1h |
| E2 | Customer check-in restructure: bỏ "Số người cùng vào" + bộ chọn thẻ + `forceKind` | [src/app/(customer)/checkin/page.tsx](../src/app/(customer)/checkin/page.tsx) + [functions/src/checkin.ts](../functions/src/checkin.ts) | ✅ `checkinByQr`/`requestCheckin` accept `forceKind`, `targetId` | 2.5h |
| E3 | Dashboard lễ tân: audio beep + highlight khi có request mới | [src/components/CheckinQueue.tsx](../src/components/CheckinQueue.tsx) + thêm `public/beep.mp3` (hoặc Web Audio API tone) | — | 45 phút |
| E4 | Màn HLV hoàn thiện: ghi chú HV + báo nghỉ ca + highlight HV vắng ≥3 buổi | [src/app/(coach)/coach/students/page.tsx](../src/app/(coach)/coach/students/page.tsx) + [page.tsx](../src/app/(coach)/coach/page.tsx) + [functions/src/coach.ts](../functions/src/coach.ts) mới + [firestore.rules](../firestore/firestore.rules) | ✅ 2 callables mới `addCoachNote`, `reportCoachAbsence` + collection `/coaches/{id}/absences` | 4h |

**Tổng**: ~9h dev + 1.5h test = 1.5 ngày làm việc.

### 19.2 Chi tiết kỹ thuật từng task

#### E1 — Fix điểm danh hộ không tìm thấy khách (rủi ro: trung)

**Triệu chứng** (Owner UAT 2026-06-23): tạo test number `0900000002` ở Firebase Console (Authentication → Phone Test Numbers) nhưng `/admin/checkin-assist` tra SĐT → "Không tìm thấy khách với SĐT này".

**Phỏng đoán nguyên nhân**:
1. **Test number trong Auth không tự sinh `/users/{uid}` doc** — chỉ khi user thực sự đăng nhập app + hoàn tất bước "tên" thì `useAuthUser.ensureUserDoc()` mới được gọi.
2. Hoặc user đã đăng nhập một lần nhưng dropout giữa bước OTP và bước tên → Firebase Auth có user, Firestore không có doc.

**Giải pháp**:

1. **Callable mới** `searchCustomerByPhone` trong [functions/src/staff.ts](../functions/src/staff.ts):
   ```ts
   export const searchCustomerByPhone = onCall({ region }, async (req) => {
     requireStaff(req);
     const raw = String(req.data?.phone ?? "").trim();
     const e164 = normalizeVNPhone(raw); // throw nếu sai format
     const local = "0" + e164.slice(3);
     // 1) Tra Firestore trước (chấp nhận cả 3 format lưu)
     const q = await db.collection("users")
       .where("phone", "in", [raw, local, e164])
       .limit(1).get();
     if (!q.empty) {
       const u = q.docs[0];
       return { found: true, id: u.id, ...u.data() };
     }
     // 2) Fallback: tra Firebase Auth — CHỈ ĐỂ CHẨN ĐOÁN, không auto-create
     try {
       await admin.auth().getUserByPhoneNumber(e164);
       // Auth có nhưng Firestore không có → khách dropout giữa OTP và bước nhập tên
       throw new HttpsError(
         "failed-precondition",
         "incomplete-profile: Khách đã xác thực SĐT nhưng chưa hoàn tất hồ sơ. Yêu cầu khách mở app và hoàn tất bước nhập tên.",
       );
     } catch (e: any) {
       if (e.code === "auth/user-not-found")
         throw new HttpsError(
           "not-found",
           "not-found: Khách chưa từng đăng ký với SĐT này. Yêu cầu khách mở app + đăng nhập 1 lần trước.",
         );
       throw e; // re-throw HttpsError ở trên hoặc lỗi khác
     }
   });
   ```

2. **Refactor** `staffCheckinByPhone` trong [functions/src/checkin.ts](../functions/src/checkin.ts) — extract helper `findUserByPhone(phone): Promise<string>` dùng chung. Nếu user không tồn tại trong Firestore → throw cùng error code `not-found` / `failed-precondition` như callable mới. Không tự ý tạo doc.

3. **UI** `admin/checkin-assist/page.tsx`:
   - Đổi từ `getDocs(query(...))` sang `await searchCustomerByPhone({ phone })` callable.
   - Hiển thị toast/error rõ theo prefix message:
     - `incomplete-profile: ...` → toast vàng "Khách đã xác thực SĐT nhưng chưa nhập tên. Yêu cầu khách mở app hoàn tất bước nhập tên rồi quay lại."
     - `not-found: ...` → toast đỏ "Khách chưa từng đăng ký với SĐT này. Yêu cầu khách mở app + đăng nhập 1 lần trước."
     - Lỗi format → toast "SĐT không hợp lệ. Nhập 10 số bắt đầu bằng 0."
   - Normalize SĐT input client-side trước khi gọi.

4. **Helper** `functions/src/utils/phone.ts` (mới) → export `normalizeVNPhone(input)`; cả `staff.ts` và `checkin.ts` import dùng chung (hiện đã có bản trong staff.ts → move).

5. **Test cases**:
   - SĐT `0900000002` trong Auth, chưa có Firestore doc → callable throw `failed-precondition` với prefix `incomplete-profile:` → UI hiển thị hướng dẫn rõ.
   - SĐT đã đăng ký full → trả full info user → UI render bình thường.
   - SĐT chưa từng tồn tại ở Auth → callable throw `not-found` → UI hiển thị lỗi rõ.
   - SĐT sai format → callable throw `invalid-argument` → UI hiển thị "SĐT không hợp lệ".

#### E2 — Customer check-in restructure (rủi ro: trung — UX cốt lõi đổi)

**Hiện trạng** (đã đọc [src/app/(customer)/checkin/page.tsx](../src/app/(customer)/checkin/page.tsx)):
- Logic preview tự động chọn 1 thẻ: COURSE (nếu khớp giờ) → PACKAGE → MEMBERSHIP.
- Stepper "Số người cùng vào" + slider trẻ/người lớn vẫn hiển thị cho PACKAGE.
- `requestCheckin` gửi `suggestedCount=group, adultsInGroup=adults`.

**Mục tiêu sau E2**:
- Hiển thị **list mọi thẻ active** dạng radio cards (Course/Pass/Package).
- Bỏ hoàn toàn UI Stepper + slider.
- Khi quét QR → gửi `forceKind` + `targetId` (enrollment/membership/ticketPackage ID) lên server.
- `requestCheckin` luôn gửi `suggestedCount=1` (lễ tân chốt sau).

**Implement**:

1. **Frontend** `src/app/(customer)/checkin/page.tsx` rewrite:
   - State `selectedCard: { kind: "COURSE"|"PASS"|"PACKAGE"; id: string } | null` thay cho `preview`.
   - Render danh sách card scrollable: foreach enrollment ACTIVE → 1 card; foreach membership ACTIVE → 1 card; foreach ticketPackage ACTIVE → 1 card.
   - Card UI:
     - Course: emoji kiểu, "Khóa học bơi · HLV X · {attendedSessions}/15 buổi · HH {date}".
     - Pass: "📅 Vé thời hạn · {audience} · HH {endDate}".
     - Package: "🎟️ Vé lượt · {audience} · Còn {remaining}/{total} lượt".
   - Radio mark trên card được chọn (border 2px brand-600 + checkmark).
   - Empty state nếu không có thẻ ACTIVE: link `/services`.
   - Bỏ component `Stepper` + state `group`, `adults`.
   - Nút "Bắt đầu quét QR" disabled nếu chưa chọn thẻ.

2. **Khi quét QR** — phân nhánh theo `selectedCard.kind`:
   ```ts
   if (selectedCard.kind === "PACKAGE") {
     await requestCheckin({
       qrPayload: text,
       ticketPackageId: selectedCard.id,
       suggestedCount: 1, // luôn = 1, lễ tân chốt số thật
     });
     // listen như cũ
   } else {
     // COURSE/PASS
     const r = await checkinByQr({
       qrPayload: text,
       forceKind: selectedCard.kind === "COURSE" ? "COURSE" : "MEMBERSHIP",
       targetId: selectedCard.id, // mới — backend dùng để skip search
       beneficiaryId: who === "self" ? undefined : who,
     });
   }
   ```

3. **Backend** [functions/src/checkin.ts](../functions/src/checkin.ts) — mở rộng `checkinByQr`:
   - Nhận thêm `forceKind?: "COURSE"|"PASS"|"PACKAGE"` + `targetId?: string`.
   - Nếu cả 2 set → load đúng doc đó, skip auto-resolve. Validate `userId` khớp, status ACTIVE, các điều kiện cụ thể của loại (slot khớp giờ, endDate, remaining).
   - Nếu chỉ `forceKind` set không có `targetId` → vẫn dùng auto-resolve (như hiện tại với `forceKind`).
   - Backward compat: không truyền gì → behavior cũ.

4. **Backend** `requestCheckin`: param không thay đổi nhưng client luôn gửi `suggestedCount=1`. Server vẫn validate. UI hiển thị "Đề xuất trừ: 1" trong pending state.

5. **Lưu ý**: nếu user **không có thẻ ACTIVE** nào → vẫn show empty state + link mua. Không hiển thị tab thẻ rỗng.

#### E3 — Audio beep + highlight Hàng đợi (rủi ro: thấp)

**Hiện trạng**: `<CheckinQueue />` đã có UI nhập count + Duyệt/Từ chối hoàn chỉnh. Chỉ thiếu audio + visual highlight cho request mới.

**Implement**:

1. **Audio**: dùng Web Audio API generate tone đơn giản (không cần asset):
   ```ts
   function beep() {
     const ctx = new AudioContext();
     const osc = ctx.createOscillator();
     const gain = ctx.createGain();
     osc.connect(gain); gain.connect(ctx.destination);
     osc.frequency.value = 880; // A5
     gain.gain.setValueAtTime(0.15, ctx.currentTime);
     gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
     osc.start(); osc.stop(ctx.currentTime + 0.3);
   }
   ```
2. **Trigger**: trong `onSnapshot` của `CheckinQueue`, so sánh `items.length` mới với cũ (useRef). Nếu tăng → `beep()` + visual flash (CSS class `animate-flash` 0.5s) trên card mới nhất.
3. **Mute toggle**: thêm icon nhỏ ở header section "Hàng đợi" cho lễ tân tắt tiếng (lưu vào localStorage).
4. **Lưu ý**: browser policy yêu cầu user interaction trước khi `AudioContext` chạy được. Vì lễ tân chắc chắn đã click gì đó trong session → ok. Fallback nếu fail: silent.

#### E4 — Màn HLV hoàn thiện (rủi ro: cao — feature mới + nhiều UI)

**Hiện trạng**:
- `coach/page.tsx` (Hôm nay): lịch dạy sáng/chiều + count HV/ca. Không có nút "Báo nghỉ".
- `coach/students/page.tsx` (HV): list HV + nút Zalo. Không có ghi chú/highlight vắng.

**Backend mới** — tạo file [functions/src/coach.ts](../functions/src/coach.ts):

```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const REGION = "asia-southeast1";
const db = () => admin.firestore();

// E4.1 — HLV thêm ghi chú cho HV
// data: { enrollmentId: string, text: string (1..500) }
export const addCoachNote = onCall({ region: REGION }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  if (req.auth.token.role !== "COACH" && req.auth.token.role !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ HLV được ghi chú");
  const { enrollmentId, text } = req.data as { enrollmentId: string; text: string };
  if (!text?.trim()) throw new HttpsError("invalid-argument", "Ghi chú không được trống");
  if (text.length > 500) throw new HttpsError("invalid-argument", "Ghi chú tối đa 500 ký tự");

  const eRef = db().doc(`enrollments/${enrollmentId}`);
  const e = await eRef.get();
  if (!e.exists) throw new HttpsError("not-found", "Khóa học không tồn tại");
  // Coach đứng lớp = enrollment.coachId. Cần map req.auth.uid → coachId.
  // Coach có /coaches/{cid}.userId === req.auth.uid
  if (req.auth.token.role === "COACH") {
    const coachQ = await db().collection("coaches").where("userId", "==", req.auth.uid).limit(1).get();
    if (coachQ.empty) throw new HttpsError("permission-denied", "Tài khoản chưa gắn HLV");
    if (coachQ.docs[0].id !== e.data()?.coachId)
      throw new HttpsError("permission-denied", "Không phải HLV đứng lớp này");
  }

  await eRef.update({
    coachNotes: admin.firestore.FieldValue.arrayUnion({
      text: text.trim(),
      at: admin.firestore.Timestamp.now(),
    }),
  });
  return { ok: true };
});

// E4.2 — HLV báo nghỉ ca
// data: { coachId: string, date: "YYYY-MM-DD", startHour: number, reason?: string }
export const reportCoachAbsence = onCall({ region: REGION }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  if (req.auth.token.role !== "COACH" && req.auth.token.role !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ HLV được báo nghỉ");
  const { coachId, date, startHour, reason } = req.data as any;

  // Validate coach mapping (như addCoachNote)
  if (req.auth.token.role === "COACH") {
    const coachQ = await db().collection("coaches").where("userId", "==", req.auth.uid).limit(1).get();
    if (coachQ.empty || coachQ.docs[0].id !== coachId)
      throw new HttpsError("permission-denied", "Không phải HLV này");
  }

  const docKey = `${date}_${startHour}`;
  const absenceRef = db().doc(`coaches/${coachId}/absences/${docKey}`);
  const existing = await absenceRef.get();
  if (existing.exists) throw new HttpsError("already-exists", "Đã báo nghỉ ca này rồi");

  // Tìm HV của ca đó
  const slotId = `${coachId}_${new Date(date).getDay()}_${startHour}`;
  const enrolls = await db().collection("enrollments")
    .where("coachId", "==", coachId)
    .where("slotId", "==", slotId)
    .where("status", "==", "ACTIVE")
    .get();

  // Tạo doc absence
  await absenceRef.set({
    coachId, date, startHour,
    reason: reason ?? "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: req.auth.uid,
    notifiedCount: enrolls.size,
  });

  // Push HV
  const coach = await db().doc(`coaches/${coachId}`).get();
  const coachName = coach.data()?.fullName ?? "HLV";
  const batch = db().batch();
  const tokensToSend: string[] = [];
  for (const e of enrolls.docs) {
    const ed = e.data();
    const targetUid = ed.parentId ?? ed.studentId;
    const notifRef = db().collection("users").doc(targetUid).collection("notifications").doc();
    batch.set(notifRef, {
      title: `${coachName} báo nghỉ ngày ${date}`,
      body: `Ca ${startHour}h–${startHour + 1}h ${reason ? "· " + reason : ""}. Vui lòng đợi thông báo lịch bù.`,
      type: "COACH_OFF",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const u = await db().doc(`users/${targetUid}`).get();
    tokensToSend.push(...(u.data()?.fcmTokens ?? []));
  }
  await batch.commit();
  if (tokensToSend.length)
    await admin.messaging().sendEachForMulticast({
      tokens: tokensToSend,
      notification: {
        title: `${coachName} báo nghỉ ngày ${date}`,
        body: `Ca ${startHour}h–${startHour + 1}h`,
      },
    });

  return { ok: true, notified: enrolls.size };
});
```

Export trong [functions/src/index.ts](../functions/src/index.ts).

**Frontend** `src/lib/callable.ts` — thêm 2 callable wrapper:
```ts
export const addCoachNote = call<{ enrollmentId: string; text: string }, { ok: boolean }>("addCoachNote");
export const reportCoachAbsence = call<
  { coachId: string; date: string; startHour: number; reason?: string },
  { ok: boolean; notified: number }
>("reportCoachAbsence");
```

**UI Hôm nay** `src/app/(coach)/coach/page.tsx`:
- Thêm nút "Báo nghỉ" trên mỗi card slot.
- Click → mở dialog xác nhận: "Báo nghỉ ca {hour}h hôm nay? {N} HV sẽ nhận thông báo." + optional textarea "Lý do (không bắt buộc)".
- Confirm → gọi `reportCoachAbsence({ coachId, date: today, startHour, reason })` → toast success "Đã báo nghỉ. {N} HV đã nhận thông báo."
- Hiển thị badge "Đã báo nghỉ" trên slot đã có absence doc (load `/coaches/{coachId}/absences` ngày hôm nay).

**UI HV** `src/app/(coach)/coach/students/page.tsx`:
- Mỗi row HV → tap mở **bottom sheet** chi tiết HV:
  - Header: avatar + tên + ca + progress {attended}/15 + chip trạng thái.
  - Thông tin: kiểu bơi, lịch học (T3-T5-T7 hoặc T4-T6-CN), HH `expiryDate`, nút Zalo lớn.
  - **Section "Lịch sử buổi học"**: list 10 attendances gần nhất (date + present + source). Buổi vắng = chip đỏ "Vắng".
  - **Section "Ghi chú HV"**: list `coachNotes` cũ (text + thời gian, sort `at desc`). Textarea + nút "Thêm ghi chú" → `addCoachNote` callable.
- **Highlight HV vắng ≥3 buổi liên tiếp** (INV-19):
  - Hàm `countConsecutiveAbsences(attendances: Attendance[]): number` — load 5 attendances gần nhất (sort `date desc`), đếm số buổi liên tiếp `present === false`. Nếu ≥3 → badge đỏ trên row.
  - Hoặc tính từ thiếu attendance doc khi đến giờ học đáng lẽ phải có (so với `slot.weekday + slot.startHour` từ enrollment.startDate đến nay). v1: chỉ dùng attendance doc với `present:false` để đơn giản.
- **Performance**: với 30 HV, mỗi HV load 5 attendances → 150 reads ban đầu. Chấp nhận v1; nếu chậm → denormalize `lastAbsenceStreak` vào enrollment doc qua cron daily.

**Firestore rules** — thêm:
```javascript
match /coaches/{coachId}/absences/{date} {
  allow read: if isSignedIn(); // HV/lễ tân/Owner xem được
  allow write: if false; // qua callable
}
```

**Index cần thêm** (firestore.indexes.json):
```json
{
  "collectionGroup": "attendances",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "date", "order": "DESCENDING" }
  ]
}
```
(Có thể không cần — `attendances` subcollection query bằng `orderBy("date","desc").limit(5)` thường tự work với composite index single field).

### 19.3 Thứ tự deploy đề xuất

1. **PR #1 — Backend foundations**: E1 (callable mới `searchCustomerByPhone` + refactor `staffCheckinByPhone`) + E4 (2 callables mới `addCoachNote`, `reportCoachAbsence`) + rules update. Deploy functions + rules trước.
2. **PR #2 — Customer check-in restructure**: E2 (frontend + backend `checkinByQr` accept `targetId`). UAT kỹ với 3 case (course/pass/package).
3. **PR #3 — Coach UI**: E4 frontend (bottom sheet HV + ghi chú + báo nghỉ + highlight vắng).
4. **PR #4 — Polish**: E3 (audio beep) + E1 UI update + bug fixes tổng hợp.

### 19.4 Testing checklist v2.4

- [ ] **E1**: 
  - Tạo test number `0900000002` ở Firebase Console, chưa từng login app → vào `/admin/checkin-assist` tra `0900000002` → tìm thấy + toast cảnh báo "Khách chưa hoàn tất hồ sơ" + doc placeholder được tạo (kiểm bằng Firestore Console).
  - Tra SĐT đã đăng ký đầy đủ → hiển thị tên + thẻ.
  - Tra SĐT chưa tồn tại ở Auth → toast lỗi rõ ràng.
  - Tra SĐT format sai (9 số, có chữ) → toast "SĐT không hợp lệ".

- [ ] **E2**:
  - Customer có 1 enrollment ACTIVE + 1 ticketPackage ACTIVE + 1 membership ACTIVE → vào `/checkin` thấy đủ 3 card.
  - Chọn card khóa học → quét QR (test với QR từ `/admin/qr-gate`) → server xử lý đúng loại COURSE → attendance được ghi.
  - Chọn card vé lượt → quét → server tạo `/checkinRequests` với `suggestedCount=1`, không phụ thuộc input khách → lễ tân duyệt với count = 3 → trừ 3 lượt.
  - Chọn card vé thời hạn → quét → ghi `/checkins` trực tiếp.
  - KHÔNG còn UI "Số người cùng vào" + slider trẻ/người lớn trên page customer.

- [ ] **E3**:
  - Mở `/admin` ở thiết bị lễ tân (giữ tab active) → ở thiết bị khác (customer) quét QR vé lượt → màn lễ tân **kêu beep** + card mới flash sáng 0.5s.
  - Click icon mute → tắt tiếng → quét tiếp → không kêu nhưng vẫn flash.
  - Reload page → mute state vẫn được giữ (localStorage).

- [ ] **E4**:
  - **Ghi chú HV**: vào `/coach/students` → tap 1 HV → bottom sheet mở → gõ "HS tiến bộ tốt, đã biết thở" → submit → note xuất hiện trong list. Reload → vẫn còn.
  - **Báo nghỉ**: vào `/coach` → bấm "Báo nghỉ" ở ca 14h → confirm → toast success. Mở app khách của 1 HV ca đó → thấy notification "HLV X báo nghỉ ngày...". Trên `/coach` thấy badge "Đã báo nghỉ" ở ca đó.
  - **Highlight vắng**: tạo enrollment + ghi 3 attendance liên tiếp với `present:false` → vào `/coach/students` → HV đó có badge đỏ "Vắng 3 buổi" trên row.

- [ ] **Regression**:
  - Vé thời hạn / khóa học quét QR vẫn check-in trực tiếp.
  - Vé lượt quét QR vẫn vào hàng đợi và lễ tân duyệt được.
  - `/admin/orders`, `/admin/customers` không bị ảnh hưởng.
  - Đăng nhập 3 role (OWNER/RECEPTIONIST/COACH) không lệch.

### 19.5 Rủi ro & rollback

| Task | Rủi ro | Rollback |
|---|---|---|
| E1 | Khách chưa hoàn tất hồ sơ vẫn bị chặn check-in hộ → lễ tân phải bảo khách mở app ngay. Trade-off để tránh tạo account ma. | Trong UI hiển thị link copy SĐT cho lễ tân share với khách qua Zalo/SMS. Nếu thật sự cần check-in gấp → Owner có thể chạy script `seed/setRole.ts` tạo doc thủ công. |
| E2 | Khách hàng cũ quen UI "Số người cùng vào" có thể bối rối khi mất tính năng. | Tooltip "Lễ tân sẽ chốt số lượt khi xác nhận" hiển thị trên card vé lượt. |
| E3 | Browser block AudioContext nếu chưa có user interaction → beep silent. | Fallback chỉ visual flash; thêm note "Bật âm thanh" lần đầu vào page. |
| E4 | `addCoachNote` cho phép append vô hạn → doc enrollment phình to vượt 1MB (sau ~2000 notes). | Cap UI 100 notes hiển thị; server reject nếu `coachNotes.length >= 200` (HLV ko ghi nhiều thế trong 90 ngày khóa). |
| E4 | `reportCoachAbsence` push N HV (max 20 — INV-3) → fan-out OK nhưng nếu HV không có fcmToken → silent. | Hiển thị `notified` count trong response để HLV biết. |

### 19.6 v2.4.1 hotfix — 4 sửa F1-F4 (2026-06-23 ngay sau v2.4)

Owner UAT bản v2.4 trên local + báo cáo 4 vấn đề ngay sau khi deploy. Các fix:

| # | Mã | Vấn đề | Cách fix | Files |
|---|---|---|---|---|
| F1 | Vé thời hạn không nên có ở flow check-in | Bỏ MEMBERSHIP khỏi bộ chọn thẻ, thay bằng banner "Xem thẻ" link `/cards`. Ẩn cả QR scanner + nút "Bắt đầu quét" nếu user chỉ có membership. | [src/app/(customer)/checkin/page.tsx](../src/app/(customer)/checkin/page.tsx) |
| F2 | "Khách đã xác thực SĐT nhưng chưa hoàn tất hồ sơ" — lễ tân bị chặn | Đảo quyết định cũ: server AUTO-CREATE doc placeholder (`role:"CUSTOMER"`, `fullName:""`, `_synced:true`, `createdAt:now`) khi Auth có user nhưng Firestore không. Audit `AUTO_CREATE_USER_FROM_AUTH`. Áp dụng cho cả `searchCustomerByPhone` (staff.ts) và `findUserUidByPhone` (checkin.ts). | [functions/src/staff.ts](../functions/src/staff.ts), [functions/src/checkin.ts](../functions/src/checkin.ts) |
| F3 | Test number trong Firebase Console không hiện ở `/admin/customers` (vì chưa từng login app) | Callable mới `syncAllAuthUsersToFirestore` (Owner-only) — lặp page 1000 user/lần qua `admin.auth().listUsers()`, tạo doc placeholder cho user có phoneNumber mà chưa có Firestore doc. Audit log `SYNC_AUTH_USERS`. UI nút "Đồng bộ Auth" ở header `/admin/customers` (chỉ Owner). | [functions/src/staff.ts](../functions/src/staff.ts), [src/app/(staff)/admin/customers/page.tsx](../src/app/(staff)/admin/customers/page.tsx), [src/lib/callable.ts](../src/lib/callable.ts) |
| F4 | Lỗi "Lưu thất bại: internal" khi HLV thêm ghi chú | Không phải bug code — callable `addCoachNote` mới (v2.4) chưa được deploy lên server. Lệnh khắc phục: `firebase deploy --only functions,firestore:rules`. Ghi rõ trong README + changelog. | — |

**Lệnh deploy chuẩn sau khi pull v2.4.1**:
```powershell
# Refresh PATH nếu Node mới cài
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Build functions
cd functions
npm run build
cd ..

# Deploy functions + rules
firebase deploy --only functions,firestore:rules

# (Optional) Deploy hosting nếu test trên prod
firebase deploy --only hosting
```

**Sau khi deploy**:
1. Owner mở `/admin/customers` → bấm "Đồng bộ Auth" → confirm số khách trong Auth được tạo doc.
2. Test điểm danh hộ với `0900000002` → tìm thấy + toast "Đã tạo hồ sơ tạm".
3. HLV mở `/coach/students` → tap HV → gõ ghi chú → submit → toast "Đã lưu ghi chú".

### 19.7 Files mới sẽ tạo / sửa

```
Mới (v2.4):
  functions/src/coach.ts                                   (E4 callables)
  src/lib/coachUtils.ts                                    (E4 countConsecutiveAbsences)

Sửa (v2.4 + v2.4.1):
  functions/src/checkin.ts                                 (E1 refactor + E2 forceKind/targetId + F2 auto-create)
  functions/src/staff.ts                                   (E1 searchCustomerByPhone + F2 auto-create + F3 syncAllAuthUsersToFirestore)
  functions/src/helpers.ts                                 (export normalizeVNPhone + phoneVariants)
  functions/src/index.ts                                   (export 4 callables mới)
  firestore/firestore.rules                                (E4 /coaches/{id}/absences rule)
  src/app/(customer)/checkin/page.tsx                      (E2 rewrite UI + F1 bỏ membership)
  src/app/(staff)/admin/checkin-assist/page.tsx            (E1 dùng callable mới + F2 bỏ error incomplete-profile)
  src/app/(staff)/admin/customers/page.tsx                 (F3 nút Đồng bộ Auth)
  src/app/(coach)/coach/page.tsx                           (E4 nút báo nghỉ + badge)
  src/app/(coach)/coach/students/page.tsx                  (E4 bottom sheet + highlight)
  src/components/CheckinQueue.tsx                          (E3 audio beep + flash + mute)
  src/lib/callable.ts                                      (5 callable wrappers mới)
  src/types/index.ts                                       (CoachAbsence interface)
```

---

## 20. v2.5 — UAT round 6 (2026-06-24)

6 chỉnh sửa từ feedback Owner. Mã tham chiếu CLAUDE.md §12.quinquies.

### 20.1 G1 — Fix `/admin/customers` chỉ hiện 2/5 số test

**Root cause**: query `query(collection(db,"users"), where("role","==","CUSTOMER"), orderBy("createdAt","desc"))` — Firestore mặc định **bỏ qua doc thiếu field `orderBy`**. Số `0857906079` được tạo bằng `setDoc(merge:true)` ở luồng legacy không gắn `createdAt`, nên không hiển thị dù vẫn có `role:"CUSTOMER"`.

**Fix** [src/app/(staff)/admin/customers/page.tsx]:
- Bỏ `orderBy`, bỏ luôn `where("role"==...)` (đã làm từ v2.3 D8 — list `/users` rồi filter client-side, an toàn hơn với legacy doc thiếu role).
- Query mới: `query(collection(db,"users"), limit(1000))`.
- Sort client-side: `[...users].sort((a,b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))` — doc thiếu `createdAt` được đẩy cuối.

### 20.2 G2 — CRUD khách hàng

3 callable mới ở [functions/src/staff.ts]:

**`createCustomerByPhone({phone, fullName?})`** — Owner-only:
1. `phoneVariants(phone)` → `{raw, local, e164}`.
2. `getUserByPhoneNumber(e164)` — nếu Auth có thì lấy `uid` đó, nếu không thì `createUser({phoneNumber: e164, displayName: fullName})`.
3. Check Firestore doc `users/{uid}` đã có chưa:
   - Có + role staff/coach → throw `failed-precondition` ("Không thể chuyển staff thành customer").
   - Có + CUSTOMER → trả `alreadyExists:true` (idempotent).
   - Chưa có → `set({phone:e164, fullName, role:"CUSTOMER", fcmTokens:[], _createdByOwner:true, createdAt: serverTimestamp()})`.
4. Audit log `CREATE_CUSTOMER` { uid, phone, by }.

**`updateCustomerName({uid, fullName})`** — Owner + Lễ tân:
1. Validate `fullName.trim().length in [1, 60]` else `invalid-argument`.
2. Read doc → if not exists throw `not-found`.
3. Update + audit `UPDATE_CUSTOMER_NAME` { uid, from: old, to: new, by }.

**`deleteCustomer({uid})`** — Owner-only:
1. Block `uid === req.auth.uid` ("Không thể tự xoá tài khoản Owner").
2. Read doc → if role in [OWNER, RECEPTIONIST, COACH] → throw `failed-precondition` ("Khách hàng này có role staff/coach — gỡ quyền trước").
3. Audit log `DELETE_CUSTOMER` { uid, phone, fullName, by } **trước** khi xoá (giữ snapshot).
4. `db().doc("users/${uid}").delete()`.
5. `admin.auth().deleteUser(uid)` (try/catch — nếu Auth user đã bị xoá ngoài thì log warning, không fail).

**UI** [src/app/(staff)/admin/customers/page.tsx]:
- Nút "+ Thêm khách" (Owner only) ở header → `CreateCustomerModal` (2 input: phone + fullName).
- Mỗi row có icon Pencil (staff) → `EditNameModal`.
- Mỗi row có icon Trash (Owner) → `ConfirmDeleteModal` (cảnh báo "Sẽ xoá cả Auth user, không phục hồi được").
- Generic `Modal` wrapper component (esc + click-outside đóng).

**Callable wrappers** [src/lib/callable.ts]:
```ts
export const createCustomerByPhone = call<{phone:string, fullName?:string}, {ok:boolean, uid:string, alreadyExists:boolean}>("createCustomerByPhone");
export const updateCustomerName = call<{uid:string, fullName:string}, {ok:boolean}>("updateCustomerName");
export const deleteCustomer = call<{uid:string}, {ok:boolean}>("deleteCustomer");
```

### 20.3 G2b — Khoá khách hàng tự đổi tên (INV-20)

**Firestore rules** [firestore/firestore.rules]:
```
match /users/{uid} {
  allow update: if isOwner()
    || (self(uid) && (
      !('fullName' in request.resource.data)
      || resource.data.fullName == null
      || resource.data.fullName == ''
      || request.resource.data.fullName == resource.data.fullName
    ));
}
```
Owner bypass mọi rule (qua callable dùng admin SDK). Self update chỉ pass khi: không touch `fullName`, HOẶC `fullName` cũ rỗng (lần đầu setup), HOẶC `fullName` mới giống cũ.

**UI** [src/app/(customer)/profile/page.tsx]:
```ts
const canEditName = !profile?.fullName?.trim();
```
- Nút Pencil chỉ render khi `canEditName === true`.
- Khi `!canEditName` → banner xám: "ℹ️ Để đổi tên trên thẻ, vui lòng liên hệ lễ tân tại hồ bơi."

### 20.4 G3 — Sửa bảng CrossTable + bar chart

**Bug bảng** [src/components/CrossTable.tsx]:
- Hàng `SWIM_COURSE` cũ render: `<td colSpan={2}>(giá phẳng)</td> <td><CellView c={matrix.SWIM_COURSE.ALL}/></td>` → CellView ALL rơi vào cột "Trẻ <1.4M" thay vì TỔNG.
- Hàng TỔNG cũ: `<td colSpan={3}>` — nhưng số cột audience+total = 4 (khi `hideTotal=false`), nên "X đơn · Y₫" lệch trái.

**Fix**:
```tsx
{p === "SWIM_COURSE" ? (
  <td colSpan={audiences.length} className="p-3 text-center text-slate-500">
    <span className="text-[11px] italic text-slate-400">(giá phẳng, không chia đối tượng)</span>
    {hideTotal && <span className="ml-2"><CellView c={matrix.SWIM_COURSE.ALL} /></span>}
  </td>
) : (
  audiences.map(a => <td><CellView c={matrix[p][a]} /></td>)
)}
```
- Owner (`hideTotal=false`): cột TỔNG bên phải đã hiển thị `rowCount · rowAmount`, không cần lặp ALL.
- Lễ tân (`hideTotal=true`): inline CellView ALL trong ô gộp (vẫn hiển thị `1 · 1.800.000₫`).
- Hàng TỔNG: `colSpan={audiences.length + 1}` = 4.

**Bug bar chart** [src/app/(staff)/admin/reports/page.tsx + src/app/(staff)/admin/page.tsx]:
- Layout cũ:
  ```tsx
  <div className="flex h-40 items-end">
    <div className="flex flex-1 flex-col items-center">  // ← column wrapper, no height
      <div style={{ height: `${pct}%` }} />               // ← % không có anchor
      <div>{label}</div>
    </div>
  </div>
  ```
- Cột `flex-col` cao = bar + label (content-based), bar `height: %` của cột → cyclic → bar collapse.

**Fix** (tách hai hàng):
```tsx
<div className="flex h-44 flex-col gap-2">
  <div className="flex flex-1 items-end gap-1">
    {chart.map(c => (
      <div className="flex h-full flex-1 items-end" title={...}>
        <div className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400"
             style={{ height: `${Math.max(2, (c.value/maxChart)*100)}%` }} />
      </div>
    ))}
  </div>
  <div className="flex gap-1">
    {chart.map(c => <div className="flex-1 text-center text-[10px]">{c.label}</div>)}
  </div>
</div>
```
- Hàng bar có `flex-1` (chiếm hết height còn lại sau hàng label), cột `h-full` → `%` resolve được.
- `min-height: 2px` để cột zero vẫn nhìn thấy chỗ đặt.

Fix luôn `HourBars` ở [src/app/(staff)/admin/page.tsx] — pattern lỗi giống hệt.

### 20.5 G4 — Autocomplete SĐT ở `/admin/checkin-assist`

**[src/app/(staff)/admin/checkin-assist/page.tsx]**:
```ts
type PhoneEntry = { uid: string; local: string; raw: string; fullName: string };
const [allPhones, setAllPhones] = useState<PhoneEntry[]>([]);

useEffect(() => {
  const q = query(collection(db, "users"), limit(2000));
  return onSnapshot(q, snap => {
    setAllPhones(
      snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as any))
        .filter(u => !u.role || u.role === "CUSTOMER" || u.role === "PARENT")
        .map(u => ({
          uid: u.uid,
          local: normalizeToLocal(u.phone),
          raw: u.phone,
          fullName: u.fullName ?? "",
        }))
    );
  });
}, []);

const suggestions = useMemo(() => {
  const digits = phoneInput.replace(/\D/g, "");
  if (digits.length < 3) return [];
  return allPhones
    .filter(p => p.local.startsWith(digits) || p.raw.includes(digits))
    .slice(0, 8);
}, [phoneInput, allPhones]);
```
- Dropdown render khi `suggestions.length > 0` + `focused`.
- Click suggestion → `setPhoneInput(p.local)` + auto trigger search.
- Click-outside qua `suggestBoxRef` + `useEffect` listener `mousedown`.

Scale ~2-3k user (per PRD) → load all client-side OK. Nếu scale lên 10k+ thì chuyển sang callable `searchCustomerByPhonePrefix({prefix})`.

### 20.6 G5 — Bỏ check giờ ca khi điểm danh khoá học (INV-21)

**[functions/src/checkin.ts]** — `processCheckin`:

Trước:
```ts
if (hour < s.startHour || hour >= s.endHour)
  throw new HttpsError("failed-precondition", `Chưa đến giờ học (${s.startHour}h–${s.endHour}h).`);
```

Sau (xoá hẳn 2 chỗ — nhánh `forceKind:"COURSE"+targetId` và nhánh auto-search):
```ts
// v2.5: bỏ check giờ — cho phép điểm danh khoá học bất kỳ thời điểm nào trong ngày dạy
```

Vẫn giữ:
- `s.weekday !== weekday` → block (sai ngày dạy).
- `e.status !== "ACTIVE"` → block.
- `e.expiryDate < now` → block.
- `attendances/{dateKey}` đã tồn tại → block (chống điểm danh kép trong ngày).

Cũng xoá `const hour = now.getHours();` ở dòng 130 vì TypeScript strict báo unused-var.

### 20.7 Lệnh deploy

```powershell
cd functions; npm run build
firebase deploy --only functions:createCustomerByPhone,functions:updateCustomerName,functions:deleteCustomer,functions:checkinByQr,functions:staffCheckinByPhone,firestore:rules
```

Hoặc deploy all cho an toàn:
```powershell
firebase deploy --only functions,firestore:rules
```

### 20.8 Files đã chạm v2.5

```
functions/src/staff.ts                        (G2: 3 callable CRUD)
functions/src/index.ts                        (export 3 callable mới)
functions/src/checkin.ts                      (G5: bỏ check hour)
firestore/firestore.rules                     (G2b: rule update users.fullName)
src/lib/callable.ts                           (G2: 3 wrapper mới)
src/app/(staff)/admin/customers/page.tsx      (G1+G2: bỏ orderBy, CRUD modals)
src/app/(staff)/admin/checkin-assist/page.tsx (G4: autocomplete)
src/app/(staff)/admin/page.tsx                (G3: HourBars fix)
src/app/(staff)/admin/reports/page.tsx        (G3: bar chart fix)
src/app/(customer)/profile/page.tsx           (G2b: hide Pencil + banner)
src/components/CrossTable.tsx                 (G3: colSpan SWIM_COURSE + TỔNG)
```

---

## Tài liệu liên quan
- [`PRD.md`](./PRD.md) — Product Requirements
- [`TASKS.md`](./TASKS.md) — Task list theo trạng thái
- [`CHAT-HISTORY.md`](./CHAT-HISTORY.md) — Timeline xây dựng
- `../firestore/firestore.rules` — Source of truth rules
- `../functions/src/` — Source code Cloud Functions
- `memory/build-environment.md` — Quirks máy dev
- `memory/pricing-matrix.md` — Bảng giá tham chiếu nhanh
