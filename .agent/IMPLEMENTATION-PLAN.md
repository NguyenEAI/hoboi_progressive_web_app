# Implementation Plan — Hồ Bơi Prosper Plaza

> **Phiên bản**: 2.2 (bổ sung 8 chỉnh sửa UAT v2.1 của PRD — xem §17)
> **Tài liệu mẹ**: [`PRD.md`](./PRD.md) v2.1
> **Trạng thái dự án**: Phase 1–10 ✅ · Đang UAT (round 3 — UI/UX feedback) · Vercel chưa

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

## Tài liệu liên quan
- [`PRD.md`](./PRD.md) — Product Requirements
- [`TASKS.md`](./TASKS.md) — Task list theo trạng thái
- [`CHAT-HISTORY.md`](./CHAT-HISTORY.md) — Timeline xây dựng
- `../firestore/firestore.rules` — Source of truth rules
- `../functions/src/` — Source code Cloud Functions
- `memory/build-environment.md` — Quirks máy dev
- `memory/pricing-matrix.md` — Bảng giá tham chiếu nhanh
