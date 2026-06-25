# TEST_PLAN.md — Hệ thống Quản lý Hồ Bơi Prosper Plaza

> **Phiên bản**: v2.3 (2026-06-22) — bao quát toàn bộ luồng v1 + 9 chỉnh sửa D1–D9.
> **Tài liệu liên quan**: [`CLAUDE.md`](CLAUDE.md) (PRD), [`.agent/IMPLEMENTATION-PLAN.md`](.agent/IMPLEMENTATION-PLAN.md).
> **Quy ước**: `[ ]` chưa làm · `[~]` đang làm · `[x]` đã pass · `[!]` fail (ghi rõ bug).
> Mỗi case có **ID** duy nhất (vd `UT-001`) để dễ tham chiếu khi báo bug.

---

## 0. Pre-conditions (chuẩn bị môi trường)

### 0.1 Hạ tầng
- [ ] **ENV-01** Firebase project `hoboiapp` (Blaze) sẵn sàng; region asia-southeast1.
- [ ] **ENV-02** Firestore indexes đã deploy (`firebase deploy --only firestore:indexes`).
- [ ] **ENV-03** Firestore rules đã deploy (`firebase deploy --only firestore:rules`).
- [ ] **ENV-04** Cloud Functions đã deploy (`firebase deploy --only functions`).
- [ ] **ENV-05** Seed `pricing` matrix tồn tại tại `/settings/pricing` (giá khớp memory/pricing-matrix.md).
- [ ] **ENV-06** Counter `/counters/memberCode` khởi tạo = 100.
- [ ] **ENV-07** App Check (dev): có `FIREBASE_APPCHECK_DEBUG_TOKEN` trong console.

### 0.2 Test data
- [ ] **DATA-01** Tài khoản OWNER: `+84947010978` (thucludinh) đã set custom claim `OWNER`.
- [ ] **DATA-02** Tài khoản RECEPTIONIST: tạo 1 user mới, gán role qua `/admin/staff`.
- [ ] **DATA-03** Tài khoản COACH × 2: Thầy Tùng (T4/T6/CN), Thầy Tín (T3/T5/T7).
- [ ] **DATA-04** Tài khoản CUSTOMER × 3 (test với SĐT thử: `+84900000001/002/003` + OTP cố định `111111/222222/333333`).
- [ ] **DATA-05** Mỗi HLV có 10 slots × số weekday → 60 slots tổng (Tùng+Tín = 30+30 = 60).
- [ ] **DATA-06** Customer #1 có thêm 1–2 con trong subcollection `children`.

### 0.3 Thiết bị
- [ ] **DEV-01** 1 máy laptop Owner (Chrome desktop).
- [ ] **DEV-02** 1 tablet/máy lễ tân chạy `/admin/qr-gate` full-screen.
- [ ] **DEV-03** 2 điện thoại customer (Android Chrome + iPhone Safari nếu test PWA).
- [ ] **DEV-04** PWA installed trên iPhone (Add-to-Home-Screen) — bắt buộc test push iOS.

---

## 1. Unit Tests (utilities, hooks, helpers)

> Chạy bằng Vitest sau khi cài: `npm i -D vitest @testing-library/react jsdom`.
> File test đặt cùng folder với source, đuôi `.test.ts(x)`.

### 1.1 `src/lib/utils.ts`
- [ ] **UT-001** `formatVND(1_800_000)` → `"1.800.000₫"`.
- [ ] **UT-002** `formatVND(0)` → `"0₫"`.
- [ ] **UT-003** `formatVNDShort(450_000)` → `"450k₫"`; `formatVNDShort(1_800_000)` → `"1,8tr₫"` (locale vi-VN).
- [ ] **UT-004** `toDate(Timestamp{seconds, nanoseconds})` trả về `Date` đúng UTC.
- [ ] **UT-005** `toDate("2026-06-22")` trả về `Date` hợp lệ.
- [ ] **UT-006** `toDate(undefined)` → `Date` với `isNaN(getTime())===true`.
- [ ] **UT-007** `formatDate(now)` ra định dạng `dd/mm/yyyy`.
- [ ] **UT-008** `daysUntil(now + 7 ngày)` → `7`; `daysUntil(now - 1 ngày)` → âm.
- [ ] **UT-009** `addDays(2026-06-22, 90)` → `2026-09-20`.
- [ ] **UT-010** `cn("a", false && "b", "c")` → `"a c"`.

### 1.2 `src/lib/phone.ts` (nếu có) hoặc helper normalize
- [ ] **UT-020** `normalizeVNPhone("0947010978")` → `"+84947010978"`.
- [ ] **UT-021** `normalizeVNPhone("+84947010978")` → `"+84947010978"`.
- [ ] **UT-022** `normalizeVNPhone("0947 010 978")` → `"+84947010978"` (loại space).
- [ ] **UT-023** `normalizeVNPhone("84947010978")` → `"+84947010978"`.
- [ ] **UT-024** Regex `/^0\d{9}$/.test("0947010978")` → true.
- [ ] **UT-025** Regex reject `"094701097"` (9 số), `"a947010978"` (có chữ).

### 1.3 `src/lib/constants.ts` (snapshot)
- [ ] **UT-030** `PASS_PRICES.ADULT.MONTH_1 === 500_000`.
- [ ] **UT-031** `PACKAGE_PRICES.CHILD_UNDER_140.PACK_15 === 300_000`.
- [ ] **UT-032** `SWIM_COURSE_PRICE === 1_800_000`.
- [ ] **UT-033** `SWIM_COURSE_TOTAL_SESSIONS === 15`.
- [ ] **UT-034** `SWIM_COURSE_VALIDITY_DAYS === 90`.
- [ ] **UT-035** `SLOT_CAPACITY === 20`.
- [ ] **UT-036** `SLOT_START_HOURS.length === 10` (4 sáng + 6 chiều).

### 1.4 `nextOccurrence()` trong `services/course/page.tsx`
- [ ] **UT-040** weekdays=[2,4,6], hour=14, weekOffset=0, now=Mon → trả T3 cùng tuần lúc 14:00.
- [ ] **UT-041** weekdays=[2,4,6], hour=14, weekOffset=0, now=T3 13:00 → trả T3 hôm nay 14:00.
- [ ] **UT-042** weekdays=[2,4,6], hour=14, weekOffset=0, now=T3 15:00 → trả T5 (skip vì quá giờ).
- [ ] **UT-043** weekOffset=1 → trả ngày tương ứng tuần sau.
- [ ] **UT-044** weekOffset=4 (clamp max) → vẫn ra date hợp lệ.
- [ ] **UT-045** Trả `weekday` chính xác để client derive slotId.

### 1.5 `audienceOf(heightCm)` (nếu có helper)
- [ ] **UT-050** `audienceOf(undefined)` → `null` hoặc `undefined` (v2.3 — không bắt buộc).
- [ ] **UT-051** `audienceOf(135)` → `"CHILD_UNDER_140"`.
- [ ] **UT-052** `audienceOf(140)` → `"CHILD_OVER_140"`.
- [ ] **UT-053** `audienceOf(180)` → `"CHILD_OVER_140"` (audience trẻ — adult chọn ở UI).

### 1.6 React hooks
- [ ] **UT-060** `useAuthUser`: `ensureUserDoc` chỉ tạo nếu doc chưa tồn tại (không ghi đè role OWNER).
- [ ] **UT-061** `useAuthUser`: sau khi đăng xuất, `profile === null`.
- [ ] **UT-062** `usePricing`: nhận update realtime khi `/settings/pricing` thay đổi (mock onSnapshot).
- [ ] **UT-063** `useCoach`: load đúng coach doc theo `userId === request.auth.uid`.

---

## 2. Backend Integration Tests (Cloud Functions + Firestore)

> Chạy với Firebase Emulator: `firebase emulators:start --only functions,firestore,auth`.
> Mỗi case reset state trước khi run.

### 2.1 `createOrder` callable

#### 2.1.1 PASS (vé thời hạn)
- [ ] **IT-101** Tạo PASS ADULT/MONTH_1 → order PENDING, `amountVND === 500_000`, `productSnapshot.audience === "ADULT"`.
- [ ] **IT-102** Tạo PASS CHILD_UNDER_140/YEAR_1 → `amountVND === 3_500_000`.
- [ ] **IT-103** Thiếu `audience` → throw `invalid-argument`.
- [ ] **IT-104** Sai `duration` (vd "MONTH_99") → throw `invalid-argument`.
- [ ] **IT-105** Unauthenticated → throw `unauthenticated`.

#### 2.1.2 PACKAGE (vé lượt)
- [ ] **IT-110** Tạo PACKAGE ADULT/PACK_15 → `amountVND === 450_000`.
- [ ] **IT-111** Tạo PACKAGE CHILD_OVER_140/PACK_30 → `amountVND === 700_000`.
- [ ] **IT-112** Sai `packageSize` → throw `invalid-argument`.

#### 2.1.3 SWIM_COURSE (khóa học)
- [ ] **IT-120** Tạo COURSE với `{coachId, startHour, weekOffset:0}` (path mới) → order tạo OK + `slot.enrolledCount += 1` + `startDate` chính xác.
- [ ] **IT-121** Tạo COURSE với `{coachId, slotId, startDate}` (path cũ BC) → vẫn OK.
- [ ] **IT-122** Tạo COURSE với cả 2 path (D4 client gửi BC) → ưu tiên path mới.
- [ ] **IT-123** Thiếu `coachId` → throw `"Thiếu HLV (coachId)"` (D4 — error rõ ràng).
- [ ] **IT-124** Thiếu `swimStyle` → throw `"Thiếu kiểu bơi (swimStyle)"`.
- [ ] **IT-125** Thiếu cả `startHour` và `slotId` → throw `"Thiếu khung giờ..."`.
- [ ] **IT-126** Slot đầy (`enrolledCount === 20`) → throw `resource-exhausted` (INV-3).
- [ ] **IT-127** Race condition: 21 user cùng đăng ký 1 slot → chỉ 20 thành công (transaction INV-11).
- [ ] **IT-128** Coach không có lịch (`weekdays === []`) → throw `failed-precondition`.

### 2.2 `confirmPayment` callable
- [ ] **IT-201** Staff confirm PENDING → order PAID, payment doc tạo, audit log có entry.
- [ ] **IT-202** Confirm PAID lần 2 → throw `failed-precondition`.
- [ ] **IT-203** Customer (không phải staff) gọi → throw `permission-denied`.
- [ ] **IT-204** PASS PAID → tạo membership ACTIVE với `endDate = startDate + PASS_DAYS[duration]`.
- [ ] **IT-205** PACKAGE PAID → tạo ticketPackage ACTIVE với `remainingSessions === totalSessions`.
- [ ] **IT-206** COURSE PAID → tạo enrollment ACTIVE với `expiryDate = startDate + 90 days`, `attendedSessions === 0`.
- [ ] **IT-207** Member code tăng đúng (counter atomic).
- [ ] **IT-208** Sau confirm, customer nhận notification "Thẻ đã kích hoạt 🎉".

### 2.3 `cancelOrder` callable
- [ ] **IT-301** Customer hủy đơn của chính mình (PENDING) → CANCELLED + slot released nếu COURSE.
- [ ] **IT-302** Hủy đơn PAID → throw `failed-precondition` (chỉ cho PENDING).
- [ ] **IT-303** Customer hủy đơn người khác → throw `permission-denied`.
- [ ] **IT-304** Audit log có `action: "CANCEL_ORDER"` + `reason`.

### 2.4 `refundOrder` callable (Owner only)
- [ ] **IT-401** Owner refund đơn PAID với reason → REFUNDED + slot released nếu COURSE.
- [ ] **IT-402** Receptionist refund → throw `permission-denied`.
- [ ] **IT-403** Refund không có reason → throw `invalid-argument`.
- [ ] **IT-404** Refund đơn PENDING → throw `failed-precondition`.
- [ ] **IT-405** Sau refund, membership/package/enrollment liên quan → `status: SUSPENDED/CANCELLED`.
- [ ] **IT-406** Customer nhận push thông báo refund.

### 2.5 `deleteOrder` callable (D1 — v2.3 1-click)
- [ ] **IT-501** Owner xóa order PENDING_PAYMENT (không reason) → doc bị xóa cứng, slot released nếu COURSE.
- [ ] **IT-502** Owner xóa order PAID (không reason) → doc xóa, thẻ liên quan gắn `orderDeleted:true`.
- [ ] **IT-503** Owner xóa order CANCELLED → doc xóa.
- [ ] **IT-504** Owner xóa order REFUNDED → doc xóa, refund record vẫn trong auditLog.
- [ ] **IT-505** Audit log `DELETE_ORDER` có `detail.orderSnapshot` chứa đủ field để recovery.
- [ ] **IT-506** Receptionist gọi deleteOrder → throw `permission-denied`.
- [ ] **IT-507** Xóa order không tồn tại → throw `not-found`.
- [ ] **IT-508** Sau khi xóa PAID order: card vẫn dùng được để check-in (status `ACTIVE`).
- [ ] **IT-509** Báo cáo doanh thu filter `orderDeleted !== true` → loại đơn đã xóa.

### 2.6 `setUserRole` / `revokeUserRole` (Owner only)
- [ ] **IT-601** Owner gán role RECEPTIONIST cho user theo SĐT → custom claim updated + doc updated.
- [ ] **IT-602** Owner gán COACH cho user → coach doc liên kết qua userId.
- [ ] **IT-603** Owner gỡ quyền RECEPTIONIST → user về CUSTOMER, custom claim cleared.
- [ ] **IT-604** Owner gỡ quyền chính mình → throw `failed-precondition`.
- [ ] **IT-605** Gỡ Owner cuối cùng (chỉ còn 1) → throw `failed-precondition`.
- [ ] **IT-606** Audit log `REVOKE_ROLE` có `detail.from`.
- [ ] **IT-607** Phone normalize: nhập `"0947 010 978"`, `"+84947010978"`, `"84947010978"` đều tìm đúng user.

### 2.7 `checkinByQr` callable (khóa học + membership)
- [ ] **IT-701** Khách quét QR đúng nonce trong 30s → ACCEPTED.
- [ ] **IT-702** Quét QR đã used → throw `failed-precondition`.
- [ ] **IT-703** Quét QR sai nonce → throw `invalid-argument`.
- [ ] **IT-704** Quét QR quá 30s → throw `deadline-exceeded`.
- [ ] **IT-705** Resolve COURSE đúng weekday + hour hiện tại → `attendedSessions += 1`, attendance doc tạo.
- [ ] **IT-706** Attendance đã có cho ngày hôm nay → không tăng lần 2 (idempotent).
- [ ] **IT-707** Đủ 15 buổi → enrollment COMPLETED + slot released.
- [ ] **IT-708** Resolve MEMBERSHIP nếu trong hạn → ACCEPTED, không trừ.
- [ ] **IT-709** Không có thẻ phù hợp → throw `failed-precondition`.

### 2.8 `requestCheckin` / `approveCheckin` / `rejectCheckin` / `cancelCheckinRequest` (D5 — vé lượt)
- [ ] **IT-801** Khách quét QR + ticketPackageId → tạo `/checkinRequests/{id}` status PENDING.
- [ ] **IT-802** QR token consume (`used:true`) ngay khi tạo request (single-use).
- [ ] **IT-803** Quét QR lần 2 cho cùng token → throw.
- [ ] **IT-804** ticketPackageId không phải của khách → throw `permission-denied`.
- [ ] **IT-805** ticketPackage status !== ACTIVE → throw `failed-precondition`.
- [ ] **IT-806** suggestedCount > remainingSessions → throw `resource-exhausted`.
- [ ] **IT-807** Staff approve với approvedCount=2 → `remainingSessions -= 2`, status APPROVED, checkin doc tạo.
- [ ] **IT-808** Approve trên request đã APPROVED → throw `failed-precondition`.
- [ ] **IT-809** Customer approve (không phải staff) → throw `permission-denied`.
- [ ] **IT-810** Staff reject với reason → status REJECTED, không trừ lượt.
- [ ] **IT-811** Reject không có reason → throw `invalid-argument`.
- [ ] **IT-812** Customer cancel request PENDING của chính mình → status CANCELLED.
- [ ] **IT-813** Customer cancel request của user khác → throw `permission-denied`.
- [ ] **IT-814** Cancel request đã APPROVED → no-op (không throw).
- [ ] **IT-815** Sau APPROVED, khách nhận notification + FCM push "Đã trừ X lượt".
- [ ] **IT-816** Sau REJECTED, khách nhận notification với reason.
- [ ] **IT-817** Approve đúng lúc package vừa hết → status DEPLETED nếu remainingSessions ≤ 0.
- [ ] **IT-818** **Không có TTL** — request giữ PENDING vô thời hạn, không cron expire.

### 2.9 `staffCheckinByPhone` (D9 — điểm danh hộ mở rộng)
- [ ] **IT-901** Staff tra SĐT `+84947010978` → tìm user.
- [ ] **IT-902** Staff tra SĐT `0947010978` (local format) → cũng tìm được (D9 normalize).
- [ ] **IT-903** SĐT không tồn tại → throw `not-found`.
- [ ] **IT-904** forceKind=PACKAGE + groupSize=3 → trừ 3 lượt từ package.
- [ ] **IT-905** forceKind=PACKAGE nhưng khách không có package → throw `failed-precondition` với message "Không tìm thấy vé lượt phù hợp".
- [ ] **IT-906** forceKind=MEMBERSHIP với beneficiaryId của con → check-in membership của con.
- [ ] **IT-907** forceKind=COURSE → điểm danh enrollment đúng ca giờ hiện tại.
- [ ] **IT-908** Không truyền forceKind → auto-resolve COURSE → PACKAGE → MEMBERSHIP (BC).
- [ ] **IT-909** Sau staff check-in, khách nhận notification.

### 2.10 `updatePricing` callable (Owner only)
- [ ] **IT-1001** Owner update PASS.ADULT.MONTH_1: 500k → 600k → `/settings/pricing` updated.
- [ ] **IT-1002** Audit log có `detail.before` + `detail.after` (diff).
- [ ] **IT-1003** Receptionist gọi → throw `permission-denied`.
- [ ] **IT-1004** Customer mua đơn ngay sau khi đổi giá → đơn dùng giá mới.
- [ ] **IT-1005** Đơn cũ (PENDING) giữ giá `productSnapshot.amountVND` cũ (INV-10).

### 2.11 `upsertCoach` / `setCoachActive` (Owner only)
- [ ] **IT-1101** Tạo HLV mới với weekdays=[2,4,6] → 30 slots auto-tạo (10 hours × 3 days).
- [ ] **IT-1102** Update HLV thêm weekday=5 → 10 slot mới cho thứ 6 tạo, slot cũ giữ nguyên.
- [ ] **IT-1103** Update HLV bỏ weekday=2 (T3) nhưng còn enrolment ở T3 → throw `failed-precondition`.
- [ ] **IT-1104** `setCoachActive(false)` cho HLV không HV → OK, không xóa slots.
- [ ] **IT-1105** Tạo HLV thiếu `fullName` → throw `invalid-argument`.

### 2.12 `issueQrToken` callable
- [ ] **IT-1201** Staff gọi → trả `{ token: "<id>:<nonce>", expiresAt }`.
- [ ] **IT-1202** Customer gọi → throw `permission-denied`.
- [ ] **IT-1203** Token expiresAt = now + 30_000ms.
- [ ] **IT-1204** Token mặc định `used: false`.

### 2.13 Scheduled functions
- [ ] **IT-1301** `cancelUnpaidOrdersHourly`: order PENDING > 24h → CANCELLED + slot released.
- [ ] **IT-1302** `expireServicesDaily`: enrollment quá 90 ngày → EXPIRED + slot released + push.
- [ ] **IT-1303** `expireServicesDaily`: membership quá endDate → EXPIRED + push.
- [ ] **IT-1304** `notifyExpiringDaily`: enrollment còn 10/5/1 buổi → push tương ứng.
- [ ] **IT-1305** `notifyExpiringDaily`: membership còn 30/7/1 ngày → push.
- [ ] **IT-1306** `aggregateDailyStats`: cuối ngày 23:55 → `/dailyStats/{YYYY-MM-DD}` có doanh thu đúng.

---

## 3. Firestore Security Rules Tests

> Chạy bằng `@firebase/rules-unit-testing` trên emulator.

### 3.1 `/users`
- [ ] **RULE-101** Customer đọc doc của chính mình → allow.
- [ ] **RULE-102** Customer đọc doc của user khác → **deny**.
- [ ] **RULE-103** Staff đọc bất kỳ user → allow.
- [ ] **RULE-104** Coach đọc user (cho việc xem HV) → allow.
- [ ] **RULE-105** Anonymous đọc users → deny.
- [ ] **RULE-106** Customer update doc của mình → allow.
- [ ] **RULE-107** Customer update doc người khác → deny.
- [ ] **RULE-108** Customer self.delete → deny (always).

### 3.2 `/users/{uid}/children`
- [ ] **RULE-201** Parent CRUD con của mình → allow.
- [ ] **RULE-202** User khác CRUD con không phải mình → deny.
- [ ] **RULE-203** Staff đọc + ghi children → allow (cho việc đăng ký hộ).

### 3.3 `/orders`
- [ ] **RULE-301** Customer đọc đơn của mình → allow.
- [ ] **RULE-302** Customer đọc đơn người khác → deny.
- [ ] **RULE-303** Staff đọc tất cả đơn → allow.
- [ ] **RULE-304** Customer write trực tiếp đơn → deny (chỉ qua callable).

### 3.4 `/auditLogs`
- [ ] **RULE-401** Owner đọc → allow.
- [ ] **RULE-402** Receptionist đọc → deny.
- [ ] **RULE-403** Customer đọc → deny.
- [ ] **RULE-404** Mọi write → deny (chỉ qua server SDK).

### 3.5 `/dailyStats` / `/monthlyStats` (INV-9)
- [ ] **RULE-501** Owner đọc → allow.
- [ ] **RULE-502** Receptionist đọc → **deny**.
- [ ] **RULE-503** Customer đọc → deny.

### 3.6 `/checkinRequests` (D5 v2.3)
- [ ] **RULE-601** Khách đọc request của mình (PENDING) → allow.
- [ ] **RULE-602** Khách đọc request user khác → deny.
- [ ] **RULE-603** Staff đọc all → allow.
- [ ] **RULE-604** Bất kỳ write trực tiếp → deny (callable only).

### 3.7 `/qrTokens`, `/counters`
- [ ] **RULE-701** Mọi read/write client → deny (server only).

---

## 4. UI Tests — Customer

### 4.1 Đăng ký / Đăng nhập
- [ ] **UI-C-101** Nhập SĐT 9 số → báo lỗi "Vui lòng nhập đủ 10 số".
- [ ] **UI-C-102** Nhập "0947010978" → gửi OTP đến `+84947010978` (số test).
- [ ] **UI-C-103** OTP đúng → vào màn nhập tên (nếu user mới) hoặc redirect /home.
- [ ] **UI-C-104** OTP sai → báo lỗi.
- [ ] **UI-C-105** Resend OTP sau 60s countdown.
- [ ] **UI-C-106** Đăng nhập user OWNER → redirect `/admin`.
- [ ] **UI-C-107** Đăng nhập user COACH → redirect `/coach`.
- [ ] **UI-C-108** Đăng nhập user CUSTOMER → redirect `/home`.

### 4.2 Home + Bottom Nav
- [ ] **UI-C-201** Home hiển thị greeting động (Chào buổi sáng/chiều).
- [ ] **UI-C-202** Bell icon hiển thị badge đỏ nếu có notification chưa đọc.
- [ ] **UI-C-203** Click "Thẻ" → /cards.
- [ ] **UI-C-204** Click "Khóa học của tôi" → /my-courses.
- [ ] **UI-C-205** Click FAB QR giữa nav → /checkin.
- [ ] **UI-C-206** Click "Dịch vụ" → /services hub.
- [ ] **UI-C-207** Tab nào active sẽ highlight (text brand + indicator).
- [ ] **UI-C-208** **D2**: 4 tab root (home/cards/services/profile) + checkin **KHÔNG** có BackButton ở header.

### 4.3 Dịch vụ — flow chính (D7)
- [ ] **UI-C-301** Vào /services thấy 3 cards: Học bơi (gradient + 🔥 PHỔ BIẾN NHẤT), Vé thời hạn, Vé lượt — đúng thứ tự.
- [ ] **UI-C-302** Click "Học bơi" → vào `/services/course` wizard 4 bước.
- [ ] **UI-C-303** Click "Vé thời hạn" → vào `/services/pass` wizard.
- [ ] **UI-C-304** Click "Vé lượt" → vào `/services/package` wizard.
- [ ] **UI-C-305** Mỗi subroute có BackButton về `/services`.

### 4.4 Wizard Vé thời hạn `/services/pass` (D7)
- [ ] **UI-C-401** Bước 1 chọn 1T/3T/6T/1N → tiến bước 2.
- [ ] **UI-C-402** Bước 2 chọn audience (3 radio: trẻ <1.4m / ≥1.4m / người lớn) — hiển thị giá tương ứng.
- [ ] **UI-C-403** Bước 3 chọn người dùng vé (bản thân / con).
- [ ] **UI-C-404** Nếu chưa có con → có link "Thêm con" → /children.
- [ ] **UI-C-405** Bước 4 review tóm tắt + giá đúng → bấm "Xác nhận đặt vé" → toast success + redirect /home.
- [ ] **UI-C-406** Đơn được tạo `PENDING_PAYMENT` với `productSnapshot.audience` chính xác.
- [ ] **UI-C-407** Bấm "← Đổi lựa chọn trước" ở mỗi bước → quay về bước trước, giữ state đã chọn.
- [ ] **UI-C-408** StepDots progress chính xác (filled cho bước đã qua).

### 4.5 Wizard Vé lượt `/services/package` (D7)
- [ ] **UI-C-501** Bước 1 chọn 15/30 lượt.
- [ ] **UI-C-502** Bước 2 chọn audience.
- [ ] **UI-C-503** Bước 3 chọn chủ thẻ.
- [ ] **UI-C-504** Bước 4 xác nhận → đơn PENDING.
- [ ] **UI-C-505** Hint "Đi nhóm dùng chung được" hiển thị ở header.

### 4.6 Wizard Khóa học `/services/course` (D4)
- [ ] **UI-C-601** Bước 1: chọn 1 trong 4 kiểu bơi → bước 2.
- [ ] **UI-C-602** Bước 2: list HLV ACTIVE, click chọn → bước 3.
- [ ] **UI-C-603** Bước 3: hiển thị khung giờ gộp theo `startHour` (vd "9h-10h · T3·T5·T7 · Còn 20 chỗ").
- [ ] **UI-C-604** Slot full → button disabled + chip "Hết chỗ".
- [ ] **UI-C-605** Click khung giờ còn chỗ → bước 4.
- [ ] **UI-C-606** Bước 4: chọn học cho (bản thân / con).
- [ ] **UI-C-607** "Ngày học đầu tiên" hiển thị weekday + dd/mm/yyyy.
- [ ] **UI-C-608** "+1 tuần" lùi 7 ngày, "-1 tuần" tiến 7 ngày. Clamp 0..4.
- [ ] **UI-C-609** **D4 bugfix**: bấm "Xác nhận đăng ký" sau khi điền đủ → KHÔNG còn báo "Thiếu HLV/khung giờ/ngày bắt đầu".
- [ ] **UI-C-610** Đơn tạo PENDING + `slot.enrolledCount += 1`.
- [ ] **UI-C-611** Sang bước 5 thành công → "🎉 Đăng ký thành công" + nút về home.
- [ ] **UI-C-612** Thiếu data ngầm → error message chỉ field thiếu (vd "Thiếu HLV") thay vì gộp.

### 4.7 Trẻ em `/children` (D6)
- [ ] **UI-C-701** Vào /children có BackButton, header "Con của tôi".
- [ ] **UI-C-702** Click "+ Thêm" mở form.
- [ ] **UI-C-703** **D6 fix**: form KHÔNG có input chiều cao. Chỉ có Họ tên + Ngày sinh (optional).
- [ ] **UI-C-704** Hint "ℹ️ Chiều cao sẽ được xác định khi mua thẻ tại quầy lễ tân".
- [ ] **UI-C-705** Lưu chỉ tên → child doc tạo với `heightCm: undefined`.
- [ ] **UI-C-706** List child hiển thị: nếu có `heightCm` → show "XYZ cm · Trẻ <1.4m"; nếu không → "Chiều cao chưa xác định".

### 4.8 Check-in `/checkin` (D5)
- [ ] **UI-C-801** Header có BackButton về /home.
- [ ] **UI-C-802** Có dropdown chọn "Check-in cho" nếu có con.
- [ ] **UI-C-803** Preview banner hiển thị đúng loại thẻ ưu tiên (COURSE > PACKAGE > MEMBERSHIP).
- [ ] **UI-C-804** Khi preview PACKAGE: hiển thị Stepper số người + slider người lớn/trẻ.
- [ ] **UI-C-805** Hiển thị "Còn lại sau lần này: X lượt" trừ đúng.
- [ ] **UI-C-806** Click "Bắt đầu quét QR" → mở camera.
- [ ] **UI-C-807** Quét QR + COURSE → check-in trực tiếp, toast success.
- [ ] **UI-C-808** Quét QR + MEMBERSHIP → check-in trực tiếp.
- [ ] **UI-C-809** **D5**: Quét QR + PACKAGE → tạo request, hiển thị **panel chờ duyệt** với Clock icon pulse + "Đề xuất trừ: X lượt" + nút "Hủy yêu cầu".
- [ ] **UI-C-810** **D5**: Lễ tân approve → toast "Check-in thành công 🎉" + result card hiển thị "Đã trừ X lượt".
- [ ] **UI-C-811** **D5**: Lễ tân reject → result card "❌ Bị từ chối: <reason>".
- [ ] **UI-C-812** **D5**: Bấm "Hủy yêu cầu" → request CANCELLED + panel đóng.
- [ ] **UI-C-813** Không có thẻ phù hợp → banner amber "Chưa có dịch vụ phù hợp".

### 4.9 Khóa học của tôi `/my-courses` + `/my-courses/[id]`
- [ ] **UI-C-901** /my-courses có BackButton.
- [ ] **UI-C-902** Hiển thị enrollment của bản thân + con.
- [ ] **UI-C-903** Sort: ACTIVE (gần hết hạn trước) → COMPLETED → EXPIRED/CANCELLED.
- [ ] **UI-C-904** Card có chip Status, emoji kiểu bơi, tên HLV, progress bar X/15.
- [ ] **UI-C-905** Còn ≤ 5 buổi: banner cam "Sắp hết khóa".
- [ ] **UI-C-906** Tab "Đang học" / "Tất cả" filter đúng.
- [ ] **UI-C-907** Click vào card → /my-courses/[id] detail.
- [ ] **UI-C-908** Detail có BackButton về /my-courses.
- [ ] **UI-C-909** Detail hiển thị: hero gradient + tiến độ + cảnh báo + lịch sử attendances.
- [ ] **UI-C-910** Click Zalo HLV → mở `zalo.me/<phone-digits>`.
- [ ] **UI-C-911** Xem enrollment người khác (sai studentId/parentId) → "Bạn không có quyền".

### 4.10 Thẻ điện tử `/cards`
- [ ] **UI-C-1001** Hiển thị mọi thẻ ACTIVE (membership + package + enrollment).
- [ ] **UI-C-1002** Membership card: front design + barcode/QR member code.
- [ ] **UI-C-1003** Package card: hiển thị "X/Y lượt".
- [ ] **UI-C-1004** Empty state khi chưa có thẻ.

### 4.11 Thông báo `/notifications`
- [ ] **UI-C-1101** Có BackButton về /home.
- [ ] **UI-C-1102** List notification sort DESC by createdAt.
- [ ] **UI-C-1103** Notification chưa đọc highlight bg-brand-50 + dot đỏ.
- [ ] **UI-C-1104** Click → update `read: true`.
- [ ] **UI-C-1105** Empty state khi không có notification.

### 4.12 Hồ sơ `/profile`
- [ ] **UI-C-1201** Hiển thị tên + role chip.
- [ ] **UI-C-1202** Sửa tên → cập nhật `users.fullName`.
- [ ] **UI-C-1203** iOS user thấy hint "Add to Home Screen" (nếu chưa standalone).
- [ ] **UI-C-1204** Nút Đăng xuất → signOut + redirect /.

---

## 5. UI Tests — Receptionist (Lễ tân)

### 5.1 Dashboard `/admin`
- [ ] **UI-R-101** Hiển thị KPI: đơn pending, check-in hôm nay, doanh thu hôm nay.
- [ ] **UI-R-102** **KHÔNG** thấy section "Tháng" / tổng doanh thu (INV-9).
- [ ] **UI-R-103** Hiển thị banner amber "Báo cáo tài chính chỉ dành cho Owner".
- [ ] **UI-R-104** CrossTable hôm nay hiển thị nhưng cột tổng ẩn (`hideTotal`).
- [ ] **UI-R-105** **D5**: section "Hàng đợi check-in vé lượt" hiển thị khi có request PENDING.

### 5.2 Sidebar & Layout (D3)
- [ ] **UI-R-201** Sidebar sticky bên trái, sticky top khi scroll dài.
- [ ] **UI-R-202** **D3 bugfix**: vào `/admin/products` → nút Đăng xuất ở footer sidebar VẪN hiện và clickable.
- [ ] **UI-R-203** **D3**: vào `/admin/reports` → tương tự, logout hiện.
- [ ] **UI-R-204** Click "Đăng xuất" → signOut + redirect /.
- [ ] **UI-R-205** Lễ tân **KHÔNG** thấy "Báo cáo" / "Sản phẩm & Giá" / "HLV" / "Nhân viên" (ownerOnly hidden).
- [ ] **UI-R-206** **D2**: layout có BackButton bar trên cùng cho mọi subroute (trừ /admin root).

### 5.3 Đơn hàng `/admin/orders`
- [ ] **UI-R-301** Tab filter trạng thái: Tất cả / Chờ TT / Đã thu / Hủy / Hoàn.
- [ ] **UI-R-302** Date-range presets: Hôm nay / Hôm qua / 7 ngày / Tháng này / Tháng trước / Năm này / Tùy chỉnh.
- [ ] **UI-R-303** Tùy chỉnh → hiển thị 2 date input from/to.
- [ ] **UI-R-304** Nhóm đơn theo ngày, label "Hôm nay/Hôm qua/dd/mm/yyyy".
- [ ] **UI-R-305** Tổng kỳ hiển thị đúng: N đơn / VNĐ đã thu.
- [ ] **UI-R-306** Button "✓ Đã thu" cho đơn PENDING → confirmPayment, toast.
- [ ] **UI-R-307** Lễ tân **KHÔNG** thấy nút "↩ Hoàn" hay "🗑 Xóa" (ownerOnly).

### 5.4 Hàng đợi check-in vé lượt (D5)
- [ ] **UI-R-401** Khi có request mới, dashboard hiển thị card amber với bell icon + badge số.
- [ ] **UI-R-402** Mỗi row hiển thị: tên khách, SĐT, MS thẻ, audience, "Còn X/Y lượt", "Khách đề xuất: N người".
- [ ] **UI-R-403** Stepper "Số lượt trừ" default = suggestedCount, có ± nút.
- [ ] **UI-R-404** Đổi count khác suggestedCount → chip "≠ N đề xuất" cảnh báo đỏ.
- [ ] **UI-R-405** Count > remainingSessions → cảnh báo "Vé chỉ còn X lượt, không đủ cho Y".
- [ ] **UI-R-406** Button "Duyệt" → approveCheckin → request biến mất khỏi queue, khách nhận push.
- [ ] **UI-R-407** Button "Từ chối" → mở inline input reason → confirm → request biến mất.
- [ ] **UI-R-408** Realtime: khách quét QR → queue cập nhật ngay không cần refresh.

### 5.5 Điểm danh hộ `/admin/checkin-assist` (D9)
- [ ] **UI-R-501** Tra SĐT (nhập "0947010978" hoặc "+84947010978") → tìm user.
- [ ] **UI-R-502** **D9 fix**: hiển thị list thẻ ACTIVE chia 3 section: Vé thời hạn / Vé lượt / Khóa học.
- [ ] **UI-R-503** Vé thời hạn card có nút "Điểm danh" 1 click → trừ ngày, push khách.
- [ ] **UI-R-504** **D9**: Vé lượt card có Stepper số lượt + nút "Trừ N lượt" → trừ đúng.
- [ ] **UI-R-505** Khóa học card có nút "Điểm danh" → tăng attendedSessions nếu đúng ca giờ.
- [ ] **UI-R-506** Khách quên điện thoại → lễ tân điểm danh hộ → khách nhận FCM + in-app notification.
- [ ] **UI-R-507** Khách không có thẻ → empty state amber.

### 5.6 Khách hàng `/admin/customers` (D8)
- [ ] **UI-R-601** **D8 fix**: hiển thị đủ list khách (mọi user không phải staff/coach/owner).
- [ ] **UI-R-602** Sort DESC theo createdAt (mới nhất trước).
- [ ] **UI-R-603** Search theo tên / SĐT (cả format +84 và 0...).
- [ ] **UI-R-604** Hiển thị: tên, SĐT format đẹp ("0947 010 978"), loại, ngày đăng ký, relative ("Hôm qua" / "X tuần trước"), trạng thái.
- [ ] **UI-R-605** Rules deny → hiển thị error banner đỏ.

### 5.7 QR Gate `/admin/qr-gate`
- [ ] **UI-R-701** Full-screen QR rotation 30s.
- [ ] **UI-R-702** Token mới tạo qua issueQrToken mỗi 30s.
- [ ] **UI-R-703** Hiển thị logo + đếm ngược.

---

## 6. UI Tests — Owner (Chủ hồ)

### 6.1 Dashboard `/admin` (Owner)
- [ ] **UI-O-101** Toàn bộ Lễ tân +
- [ ] **UI-O-102** Section "Tháng" hiển thị tổng doanh thu + 3 card: Khóa học / Vé thời hạn / Gói lượt với % và bar progress.
- [ ] **UI-O-103** Card "Tổng doanh thu tháng" với gradient mesh.
- [ ] **UI-O-104** CrossTable hiển thị đầy đủ cả cột tổng.

### 6.2 Báo cáo `/admin/reports`
- [ ] **UI-O-201** Segmented control: Ngày / Tháng / Năm / Tùy chỉnh.
- [ ] **UI-O-202** "Ngày" → date picker → query orders PAID trong ngày.
- [ ] **UI-O-203** "Tháng" → month picker → bar chart theo ngày trong tháng.
- [ ] **UI-O-204** "Năm" → year picker → bar chart 12 cột tháng.
- [ ] **UI-O-205** "Tùy chỉnh" → 2 date input from/to.
- [ ] **UI-O-206** Bảng chéo Loại × Đối tượng.
- [ ] **UI-O-207** Tổng cột + tổng hàng đúng.
- [ ] **UI-O-208** Count unique khách.
- [ ] **UI-O-209** **D1**: Đơn đã xóa (`orderDeleted:true`) KHÔNG xuất hiện trong báo cáo.
- [ ] **UI-O-210** Receptionist truy cập → 403 hoặc redirect.

### 6.3 Sản phẩm & Giá `/admin/products`
- [ ] **UI-O-301** Matrix giá hiển thị 3 audience × 4 duration cho Vé thời hạn.
- [ ] **UI-O-302** Matrix 3 × 2 cho Vé lượt.
- [ ] **UI-O-303** Flat 1 ô cho Khóa học.
- [ ] **UI-O-304** 4 ô cho Vé lẻ.
- [ ] **UI-O-305** Sửa giá 1 ô → chip "Lưu thay đổi" highlight.
- [ ] **UI-O-306** Click "Lưu" → updatePricing → toast "Đã lưu".
- [ ] **UI-O-307** Khách mua đơn ngay sau khi đổi → giá mới áp dụng.
- [ ] **UI-O-308** Nút "Hủy" reset draft về current.
- [ ] **UI-O-309** Receptionist truy cập → "🔒 Chỉ Owner được sửa giá".

### 6.4 HLV `/admin/coaches`
- [ ] **UI-O-401** List HLV với weekdays + chip active/inactive.
- [ ] **UI-O-402** Click "+ Thêm HLV" → form fullName + weekdays checkboxes.
- [ ] **UI-O-403** Lưu HLV mới → tự tạo 10 × N weekday slots.
- [ ] **UI-O-404** Edit weekdays: thêm → tạo slot mới; bỏ ngày có HV → throw error.
- [ ] **UI-O-405** Toggle active/inactive → setCoachActive.
- [ ] **UI-O-406** HLV inactive ẩn khỏi wizard customer.

### 6.5 Nhân viên & Quyền `/admin/staff` (D5 — phân quyền)
- [ ] **UI-O-501** List user có role !== CUSTOMER.
- [ ] **UI-O-502** Search SĐT → tìm user, hiển thị form chọn role.
- [ ] **UI-O-503** Set role → setUserRole callable → audit log.
- [ ] **UI-O-504** Nút đỏ "Gỡ quyền" cho user role !== CUSTOMER → confirm → revokeUserRole.
- [ ] **UI-O-505** Gỡ chính mình → button disabled hoặc error.
- [ ] **UI-O-506** Gỡ Owner cuối cùng → error message rõ ràng.
- [ ] **UI-O-507** Cột "Cấp ngày" lấy từ auditLog SET_ROLE entry.

### 6.6 Đơn hàng `/admin/orders` (Owner)
- [ ] **UI-O-601** Toàn bộ Lễ tân +
- [ ] **UI-O-602** Nút "↩ Hoàn" cho đơn PAID → prompt reason → refundOrder.
- [ ] **UI-O-603** **D1**: Nút "🗑 Xóa" cho mọi trạng thái — **1 click, không dialog, không yêu cầu reason** → đơn biến mất ngay.
- [ ] **UI-O-604** **D1**: Sau xóa, audit log có entry với orderSnapshot đầy đủ.
- [ ] **UI-O-605** **D1**: Xóa đơn PAID → thẻ liên quan giữ ACTIVE, gắn `orderDeleted:true`.
- [ ] **UI-O-606** Refresh báo cáo → đơn đã xóa loại khỏi tính tổng.

---

## 7. UI Tests — Coach (HLV)

### 7.1 Layout & Logout (C1 — v2.1, không phải D)
- [ ] **UI-T-101** Header sticky có Logo + chip "HLV" + nút "Đăng xuất".
- [ ] **UI-T-102** Click Đăng xuất → confirm dialog → signOut.
- [ ] **UI-T-103** Bottom nav 2 tab: Hôm nay / Học viên.

### 7.2 Lịch dạy hôm nay `/coach`
- [ ] **UI-T-201** Hiển thị danh sách ca dạy hôm nay (weekday match coach.weekdays).
- [ ] **UI-T-202** Mỗi ca: giờ + số HV enrolled.
- [ ] **UI-T-203** Nếu T2 (HLV nghỉ) → empty state "Hôm nay nghỉ".

### 7.3 Học viên `/coach/students`
- [ ] **UI-T-301** Search theo tên HV.
- [ ] **UI-T-302** List HV ACTIVE của coach hiện tại.
- [ ] **UI-T-303** Mỗi HV: tên, emoji kiểu bơi, progress X/15.
- [ ] **UI-T-304** Click nút Zalo → mở `zalo.me/<phone>`.
- [ ] **UI-T-305** Highlight HV vắng ≥3 buổi liên tiếp (badge cam).
- [ ] **UI-T-306** HLV **KHÔNG** thấy nút điểm danh QR (v2.3 — lễ tân duyệt).

---

## 8. Regression Tests v2.3 (D1–D9 cụ thể)

### 8.1 D1 — Xóa đơn 1-click
- [ ] **REG-D1-1** Owner /admin/orders bấm 🗑 → đơn biến mất ngay, **không pop-up confirm/lý do**.
- [ ] **REG-D1-2** Snapshot đầy đủ trong /auditLogs (xem qua Firebase Console).
- [ ] **REG-D1-3** Receptionist KHÔNG thấy nút 🗑.

### 8.2 D2 — Back button toàn cục
- [ ] **REG-D2-1** Mọi non-tab-root customer page có BackButton ở header trái.
- [ ] **REG-D2-2** Admin subpage có BackButton bar ở top (trừ /admin root).
- [ ] **REG-D2-3** Coach root pages không có BackButton (chỉ có logout).
- [ ] **REG-D2-4** BackButton fallback hoạt động khi window.history.length === 1 (mở tab mới + paste URL).

### 8.3 D3 — Logout admin luôn hiển thị
- [ ] **REG-D3-1** Navigate /admin → /admin/products → /admin/reports → /admin/orders → /admin/customers: nút Đăng xuất luôn click được.
- [ ] **REG-D3-2** Cuộn xuống cuối page dài (orders list 50 entries) → sidebar vẫn sticky, logout vẫn ở chỗ.
- [ ] **REG-D3-3** Sidebar có sticky `h-screen overflow-y-auto`.

### 8.4 D4 — Wizard khóa học không bug
- [ ] **REG-D4-1** Đăng ký khóa cho con → không còn "Thiếu HLV/khung giờ/ngày bắt đầu".
- [ ] **REG-D4-2** Client gửi payload `{coachId, startHour, weekOffset, slotId, startDate, swimStyle, beneficiaryKind, beneficiaryId, beneficiaryName}` — đầy đủ cả 2 schema.
- [ ] **REG-D4-3** Server error message rõ ràng từng field nếu thực sự thiếu.

### 8.5 D5 — Vé lượt: lễ tân duyệt
- [ ] **REG-D5-1** Khách quét QR vé lượt → KHÔNG trừ ngay; tạo request PENDING.
- [ ] **REG-D5-2** Lễ tân thấy queue trên dashboard.
- [ ] **REG-D5-3** Lễ tân chỉnh count (vd 4 → 2) trước khi approve → trừ đúng 2.
- [ ] **REG-D5-4** Lễ tân reject với reason → khách nhận push reason.
- [ ] **REG-D5-5** Khách bấm "Hủy yêu cầu" trước khi lễ tân duyệt → request CANCELLED.
- [ ] **REG-D5-6** **Không TTL** — để 30 phút không duyệt, request vẫn PENDING.
- [ ] **REG-D5-7** Vé thời hạn vẫn check-in trực tiếp (không qua queue).
- [ ] **REG-D5-8** Khóa học vẫn check-in trực tiếp.

### 8.6 D6 — Bỏ chiều cao trẻ ở form
- [ ] **REG-D6-1** Form /children không có input heightCm.
- [ ] **REG-D6-2** Child doc tạo mới có `heightCm: undefined`.
- [ ] **REG-D6-3** Trẻ cũ có heightCm vẫn hiển thị đúng.
- [ ] **REG-D6-4** Wizard mua thẻ → audience chọn ở Bước 2 (radio).

### 8.7 D7 — Restructure flow Dịch vụ
- [ ] **REG-D7-1** /services hiển thị 3 cards, Học bơi gradient + 🔥 badge ở **đầu**.
- [ ] **REG-D7-2** Click mỗi card vào subroute đúng (course/pass/package).
- [ ] **REG-D7-3** Mỗi subroute là wizard nhiều bước với StepDots progress.
- [ ] **REG-D7-4** Vé lẻ vẫn hiển thị (chỉ tham khảo) ở footer /services.

### 8.8 D8 — /admin/customers không rỗng
- [ ] **REG-D8-1** Tạo 2 customer mới → /admin/customers hiển thị đủ 2.
- [ ] **REG-D8-2** Search SĐT format khác nhau đều match.
- [ ] **REG-D8-3** Owner/Receptionist/Coach không lẫn vào list.
- [ ] **REG-D8-4** Rules deny → error banner đỏ hiển thị.

### 8.9 D9 — Điểm danh hộ vé lượt
- [ ] **REG-D9-1** /admin/checkin-assist tra SĐT → hiển thị mọi thẻ ACTIVE.
- [ ] **REG-D9-2** Vé lượt có Stepper số lượt → trừ đúng.
- [ ] **REG-D9-3** Khách quên ĐT, lễ tân điểm danh hộ vé lượt → khách nhận push.
- [ ] **REG-D9-4** SĐT format +84 / 0... đều tìm được.

---

## 9. Cross-cutting (NFR / Security)

### 9.1 Performance (Lighthouse)
- [ ] **NFR-101** Lighthouse mobile ≥ 90 (Performance, Accessibility, Best Practices, SEO).
- [ ] **NFR-102** LCP ≤ 2.5s trên 4G simulated.
- [ ] **NFR-103** TTI ≤ 4s.
- [ ] **NFR-104** Bundle main page ≤ 250KB gzipped.

### 9.2 Realtime
- [ ] **NFR-201** Owner đổi giá → khách thấy < 3s (test với 2 tab).
- [ ] **NFR-202** Lễ tân approve check-in → khách thấy result < 2s.
- [ ] **NFR-203** Tạo order PENDING → admin dashboard pending count tăng < 2s.

### 9.3 Offline
- [ ] **NFR-301** Tắt mạng → Customer vẫn xem được thẻ (Firestore IndexedDB cache).
- [ ] **NFR-302** Tắt mạng → mua vé fail với toast lỗi (Firestore queue retry khi up).

### 9.4 Cost & Cold start
- [ ] **NFR-401** Function cold start p95 ≤ 2s.
- [ ] **NFR-402** Budget alert email Owner khi vượt $30/tháng.

### 9.5 Accessibility
- [ ] **NFR-501** Tap target ≥ 44 × 44 px ở mọi button.
- [ ] **NFR-502** Contrast AA ở mọi text foreground/background.
- [ ] **NFR-503** Lighthouse Accessibility ≥ 90.
- [ ] **NFR-504** Keyboard nav: Tab di chuyển giữa controls.
- [ ] **NFR-505** aria-label cho icon-only buttons (BackButton, BottomNav icons).

### 9.6 Security
- [ ] **SEC-101** App Check enforce ở production (callable reject `request.app == null`).
- [ ] **SEC-102** SMS region whitelist VN only (Firebase Console).
- [ ] **SEC-103** reCAPTCHA SMS defense bật.
- [ ] **SEC-104** Test numbers `+84900000001-003` chỉ chấp nhận OTP cố định.
- [ ] **SEC-105** Firestore rules đã test với rules-unit-testing (§3).
- [ ] **SEC-106** Service account JSON KHÔNG commit vào git (kiểm tra .gitignore).
- [ ] **SEC-107** ENV biến nhạy cảm (VAPID, reCAPTCHA key) chỉ ở Vercel env, không hardcode.

### 9.7 PDPL 2026
- [ ] **PDPL-101** Trang /privacy có nội dung đầy đủ (mục đích, thời gian lưu, quyền chủ thể).
- [ ] **PDPL-102** /privacy có thông báo cross-border data (Singapore).
- [ ] **PDPL-103** Callable `deleteAccount` ẩn danh hóa SĐT + tên, giữ giao dịch.
- [ ] **PDPL-104** FCM token tự xóa sau 30 ngày inactive.

---

## 10. Deployment Smoke Tests (sau mỗi deploy prod)

- [ ] **SMOKE-01** Vào `/` redirect đúng landing page.
- [ ] **SMOKE-02** OTP gửi thành công trên domain prod (test với 1 SĐT thật).
- [ ] **SMOKE-03** Owner đăng nhập + vào /admin success.
- [ ] **SMOKE-04** `seed/check.ts` đọc được 1 doc từ mỗi collection.
- [ ] **SMOKE-05** Service worker register thành công (DevTools Application tab).
- [ ] **SMOKE-06** PWA manifest valid (Lighthouse audit).
- [ ] **SMOKE-07** FCM Web Push test trên 1 iPhone real (Add-to-Home-Screen rồi).
- [ ] **SMOKE-08** `/privacy` page có nội dung đầy đủ.
- [ ] **SMOKE-09** Firebase Functions logs không error trong 5 phút sau deploy.
- [ ] **SMOKE-10** Lighthouse mobile score ≥ 90.
- [ ] **SMOKE-11** Tablet cổng QR rotation chạy ổn định 1 giờ không freeze.
- [ ] **SMOKE-12** Test với +84900000001 (OTP 111111) → vào được /home.

---

## 11. Definition of Done — Test Sign-off

Trước khi merge v2.3 vào main:
- [ ] **DOD-01** ≥ 95% test case ở §1 (Unit) PASS.
- [ ] **DOD-02** ≥ 90% test case ở §2 (Backend Integration) PASS.
- [ ] **DOD-03** 100% test case ở §3 (Security Rules) PASS.
- [ ] **DOD-04** 100% UI test cho Customer happy path PASS (§4.1, 4.3, 4.6, 4.8, 4.9).
- [ ] **DOD-05** 100% UI test cho Receptionist (§5.1–5.5) PASS.
- [ ] **DOD-06** 100% UI test cho Owner (§6.1–6.6) PASS.
- [ ] **DOD-07** 100% Regression D1–D9 (§8) PASS.
- [ ] **DOD-08** Lighthouse mobile ≥ 90 (NFR-101).
- [ ] **DOD-09** Security checklist (§9.6) hoàn tất.
- [ ] **DOD-10** Smoke test (§10) PASS trên prod.

---

## Phụ lục A — Bug Report Template

Khi 1 case fail, ghi vào issue tracker:

```
Bug ID: BUG-<số>
Linked Test Case: <ID, vd UI-C-609>
Mức độ: P0 (chặn launch) / P1 / P2 / P3
Module: Customer / Receptionist / Owner / Coach / Backend / Infra

Steps to reproduce:
1.
2.
3.

Expected:
Actual:

Screenshot: <attach>
Console error: <copy>
Network tab: <copy>
Browser/OS: Chrome 130 / Win 10
Reproducible: Always / Sometimes / Once
```

## Phụ lục B — Tiến độ tổng

Cập nhật mỗi tuần:

| Tuần | Unit | IT | Rules | UI Customer | UI Recep | UI Owner | UI Coach | Regression | NFR/Sec | Smoke |
|---|---|---|---|---|---|---|---|---|---|---|
| W1 | 0/63 | 0/100 | 0/22 | 0/64 | 0/29 | 0/45 | 0/15 | 0/36 | 0/24 | 0/12 |
| W2 |  |  |  |  |  |  |  |  |  |  |

Tổng số case: **~410**. Mục tiêu: hoàn thành 90% trong 2 tuần UAT.
