# Test Plan — Hồ Bơi Prosper Plaza

> **Phiên bản**: 1.0 · **Ngày**: 2026-06-17
> **Mục tiêu**: Kiểm tra toàn bộ ứng dụng PWA + Cloud Functions trước launch.
> **Tài liệu liên quan**: [PRD.md](./PRD.md) · [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)

---

## 1. Phạm vi & cách dùng tài liệu

### 1.1 Phạm vi test
| Loại | Có test | Không test (v1) |
|---|---|---|
| Functional | 5 vai trò, 12 callable, 4 cron, flows mua/check-in/hoàn tiền | Đa ngôn ngữ (v1 chỉ tiếng Việt) |
| Non-functional | Hiệu năng, bảo mật, offline cache, accessibility | Tải > 200 user đồng thời |
| Cross-device | Android Chrome, iOS Safari (16.4+), Desktop Chrome | Firefox/Edge desktop (best-effort) |
| Cross-role | OWNER · RECEPTIONIST · COACH · CUSTOMER · PARENT (gộp Customer) | — |

### 1.2 Cấp độ
- **P0 — Blocker**: Lỗi chặn launch (mất tiền, không check-in được, không đăng nhập được).
- **P1 — Critical**: Ảnh hưởng nghiệp vụ quan trọng; phải fix trước launch.
- **P2 — Major**: UX kém, cần fix sớm nhưng không chặn.
- **P3 — Minor**: Polish, có thể defer post-launch.

### 1.3 Cách dùng
1. Mỗi test case có **ID, mô tả, tiền đề, bước, kết quả mong đợi, mức ưu tiên**.
2. Tester ghi kết quả vào cột "Status" (Pass / Fail / N/A) trong copy báo cáo.
3. Bug log riêng vào sheet hoặc GitHub issue, đánh ref vào test ID.

---

## 2. Môi trường & dữ liệu test

### 2.1 Môi trường
| Môi trường | URL | Mục đích |
|---|---|---|
| **Local** | `http://localhost:3000` | Dev test |
| **Firebase emulator** | `firebase emulators:start` | Test functions không gọi prod |
| **Staging** | (chưa setup) | UAT thực tế trước launch |
| **Production** | `hoboi.htbaolam.com` hoặc `*.vercel.app` (sau deploy) | Smoke test cuối |

### 2.2 Tài khoản test
| Vai trò | SĐT | Mã OTP cố định | Người chịu trách nhiệm |
|---|---|---|---|
| **OWNER** | +84947010978 | (thật, qua SMS) | Anh chủ |
| **RECEPTIONIST** | +84900000001 | 111111 | Test fixed |
| **CUSTOMER có con** | +84900000002 | 222222 | Test fixed |
| **CUSTOMER không con** | +84900000003 | 333333 | Test fixed |
| **COACH (Thầy Tùng)** | (Owner gán sau) | — | — |
| **COACH (Thầy Tín)** | (Owner gán sau) | — | — |

> ⚠️ Số test +849000000xx chỉ hoạt động khi Firebase Console đã add vào "Phone numbers for testing". Sau khi launch nên xóa.

### 2.3 Dữ liệu seed mặc định (từ `seed/`)
- 2 HLV: `tung` (T4/T6/CN), `tin` (T3/T5/T7) — 60 slots, mỗi slot capacity 20, enrolledCount 0.
- 10 products (PASS × 4 thời hạn × 3 audience + PACKAGE × 2 size × 3 audience + 1 SWIM_COURSE).
- `/settings/pricing` doc đầy đủ ma trận giá.
- `/counters/memberCode.value = 100` (member code đầu tiên = 101).

### 2.4 Reset env trước test
```powershell
# Xóa dữ liệu test trước khi chạy lại smoke test
# (Owner-only, qua Firebase Console hoặc admin script)
# 1. /orders/* status != PAID  → xóa
# 2. /memberships/*, /ticketPackages/*, /enrollments/* tạo trong vòng 1h → xóa
# 3. /checkins/* trong vòng 1h → xóa
# 4. /coaches/*/slots/*  → reset enrolledCount về số thật từ enrollments ACTIVE
```

---

## 3. Smoke Test (5 phút — phải pass mỗi lần deploy)

| # | Test | Kết quả mong đợi |
|---|---|---|
| SM-01 | Mở `/` thấy Landing với bảng giá thật | LCP < 2.5s, không lỗi JS |
| SM-02 | Đăng nhập +84900000001 với OTP 111111 | Vào được `/home` (vì là CUSTOMER chưa role staff) |
| SM-03 | Đọc `/cards` không lỗi | Hiển thị "Chưa có thẻ" hoặc thẻ có sẵn |
| SM-04 | Owner đăng nhập → vào được `/admin/reports` | Hiển thị số liệu hoặc "Chưa có giao dịch" |
| SM-05 | Owner đổi giá vé tháng người lớn → khách thấy giá mới trong < 5s | Realtime hoạt động |

---

## 4. Test Cases theo vai trò

### 4.1 PUBLIC (chưa đăng nhập)

| ID | Mức | Mô tả | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| PUB-01 | P0 | Mở landing | 1. Mở `/`  | Header gradient + logo + 4 dịch vụ + bảng vé lẻ + 2 nút Đăng nhập/Đăng ký |
| PUB-02 | P1 | Bảng giá hiển thị giá thật (không fallback) | 1. Owner đặt giá vé tháng người lớn = 600k<br>2. Mở `/` ẩn danh | Vé tháng "từ 400.000₫" (giá thấp nhất CHILD_UNDER_140) |
| PUB-03 | P2 | Click "Đăng ký" hoặc "Đăng nhập" đều ra cùng flow | 1. Click "Đăng ký" | Vào `/signin` step "phone" |
| PUB-04 | P3 | Mobile responsive | 1. Resize 360px | Không tràn ngang, footer phía dưới |
| PUB-05 | P2 | PDPL badge dưới CTA | 1. Scroll xuống Landing | Hiển thị "Bảo mật bằng mã OTP qua SMS · Tuân thủ PDPL 2026" |

### 4.2 SIGN-IN flow

| ID | Mức | Mô tả | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| SI-01 | P0 | OTP flow đầy đủ với SĐT mới | 1. Nhập 905xxx<br>2. Bấm "Gửi OTP"<br>3. Nhập OTP từ SMS<br>4. Nhập tên<br>5. Bấm "Hoàn tất" | Vào `/home`, doc `/users/{uid}` tạo với role=CUSTOMER, fullName |
| SI-02 | P0 | Đăng nhập lại (đã có doc) | 1. Logout<br>2. Đăng nhập với SĐT cũ | Bỏ qua step "name", vào thẳng landing theo role |
| SI-03 | P1 | Auto-redirect theo role | 1. Owner đăng nhập | Vào `/admin` (không phải `/home`) |
| SI-04 | P1 | Coach đăng nhập | 1. Tùng đăng nhập (sau khi Owner gán COACH) | Vào `/coach` |
| SI-05 | P1 | Resend OTP countdown | 1. Vào step OTP<br>2. Đếm ngược 60s | Sau 60s mới enable "Gửi lại mã" |
| SI-06 | P1 | OTP sai → báo lỗi | 1. Nhập OTP 000000 | Toast đỏ với message từ Firebase |
| SI-07 | P0 | SĐT không VN bị reject | 1. Nhập +1555... | Firebase trả "auth/region-not-allowed" (vì SMS region policy chỉ VN) |
| SI-08 | P0 | Login OWNER không bị ghi đè role | 1. Owner +84947010978 đăng nhập lần 2 | Doc `/users/{uid}.role` vẫn là OWNER (không reset về CUSTOMER) |
| SI-09 | P2 | Đổi số điện thoại từ step OTP | 1. Vào step OTP<br>2. Click "Đổi SĐT" | Quay lại step phone, confirm reset |
| SI-10 | P2 | OTP tự nhận từ SMS (Android) | 1. Allow web OTP autofill<br>2. Nhận SMS | Input OTP tự điền (autocomplete="one-time-code") |

### 4.3 CUSTOMER — Mua dịch vụ

| ID | Mức | Mô tả | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| CB-01 | P0 | Mua vé tháng người lớn cho bản thân | 1. Đăng nhập +84900000001<br>2. Vào `/services`<br>3. Beneficiary = "Bản thân"<br>4. Audience = ADULT<br>5. Click "Đăng ký" ở vé 1 tháng | Toast success với mã đơn 6 ký tự, doc `/orders/{id}` tạo PENDING |
| CB-02 | P0 | Mua khóa học cho con | 1. Vào `/children` thêm bé Linh 9 tuổi 130cm<br>2. Vào `/services/course`<br>3. Học cho ai: bé Linh<br>4. Kiểu: BREASTSTROKE<br>5. HLV: Tùng<br>6. Slot: T4 07:00<br>7. Ngày bắt đầu: tuần sau | Đơn PENDING tạo, slot `tung_3_7.enrolledCount += 1` |
| CB-03 | P0 | Giá khớp với pricing realtime | 1. Owner đổi giá vé 3 tháng người lớn 1.300k → 1.500k<br>2. Khách F5 `/services` | Card vé 3 tháng hiển thị 1.500k |
| CB-04 | P1 | Đóng băng giá (snapshot) | 1. Khách mua vé tháng 500k → đơn tạo PENDING<br>2. Owner đổi giá vé tháng → 600k<br>3. Lễ tân confirm đơn đó | Đơn PAID giữ amountVND=500k, membership giá 500k |
| CB-05 | P1 | Audience auto theo bé | 1. Chọn bé Linh 130cm | Aud lock = CHILD_UNDER_140; không sửa được |
| CB-06 | P1 | Audience auto theo bé > 1.4m | 1. Chọn bé Hùng 145cm | Aud lock = CHILD_OVER_140 |
| CB-07 | P2 | Khách chưa đặt tên không mua được | 1. Khách mới chưa fullName → `/services`<br>2. Click "Đăng ký" | Toast "Vui lòng đặt tên trước" |
| CB-08 | P0 | Slot 20/20 không cho đăng ký | 1. Đăng ký 20 đơn vào cùng slot<br>2. Đăng ký đơn 21 | Lỗi `resource-exhausted` "Khung giờ đã đầy 20/20" |
| CB-09 | P1 | 2 khách đăng ký cùng slot song song | 1. Mở 2 tab ẩn danh<br>2. Cùng confirm 1 slot còn 1 chỗ | Chỉ 1 thành công, 1 nhận lỗi (transaction retry) |
| CB-10 | P2 | Hủy đơn PENDING của mình | 1. Khách xem đơn pending<br>2. Click "Hủy" | Status CANCELLED, slot trả về (nếu COURSE) |

### 4.4 CUSTOMER — Thẻ điện tử & Check-in

| ID | Mức | Mô tả | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| CK-01 | P0 | Xem thẻ membership active | 1. Vào `/cards` | MembershipCard render kiểu thẻ thật, có MS, tên uppercase, ngày hết hạn |
| CK-02 | P0 | Xem thẻ gói lượt với ô tick | 1. Vào `/cards` với gói 15 còn 12 lượt | 3 ô đầu tick đỏ ✗, 12 ô sau trắng |
| CK-03 | P0 | Check-in QR khóa học đúng ca | 1. 07:00 T4: vào `/checkin`<br>2. Bấm scan QR từ tablet | Result OK, attendance ghi, attendedSessions +1 |
| CK-04 | P0 | Check-in QR gói lượt 1 người | 1. 10:00 T2: scan QR | remainingSessions -1, usageHistory thêm 1 entry |
| CK-05 | P0 | Check-in nhóm 3 người | 1. Set group=3<br>2. Scan QR | remainingSessions -3 |
| CK-06 | P0 | Check-in vé tháng | 1. Vé tháng còn hạn<br>2. Scan QR | Result OK, không trừ lượt |
| CK-07 | P1 | Gói trẻ em không cho người lớn | 1. Gói 15 audience=CHILD_UNDER_140<br>2. Set group=3, adults=2<br>3. Scan QR | Lỗi "Thẻ trẻ em không dùng cho người lớn" |
| CK-08 | P1 | Hết lượt → đề xuất vé lẻ | 1. Gói 15 còn 0 lượt<br>2. Vào `/checkin` | Banner cam "Chưa có dịch vụ phù hợp..." |
| CK-09 | P0 | QR hết hạn (30s+) | 1. Copy text QR rồi đợi 35s<br>2. Quét lại | Lỗi `deadline-exceeded` "QR đã hết hạn" |
| CK-10 | P0 | QR đã dùng | 1. Quét QR thành công<br>2. Quét lại cùng QR | Lỗi "QR đã được dùng" |
| CK-11 | P1 | Preview hiển thị đúng dịch vụ | 1. Vé tháng + gói 15 cùng active<br>2. Vào `/checkin` | Preview "Trừ lượt từ gói 15" (priority PACKAGE > MEMBERSHIP) |
| CK-12 | P1 | Preview ưu tiên khóa học khi đúng ca | 1. 07:00 T4 có cả gói 15 + course<br>2. Vào `/checkin` | Preview "Điểm danh khóa học" (priority COURSE > PACKAGE) |
| CK-13 | P0 | Đủ 15 buổi → COMPLETED + giải phóng slot | 1. attendedSessions=14, scan QR lần 15 | status=COMPLETED, slot.enrolledCount -1, push chúc mừng |
| CK-14 | P2 | Frame guide hiển thị khi scan | 1. Bấm "Bắt đầu quét" | 4 góc xanh + camera mở |
| CK-15 | P2 | Pulse-ring khi chưa scan | 1. Vào `/checkin` | Icon camera pulse vòng tròn |

### 4.5 CUSTOMER — Profile & Children

| ID | Mức | Mô tả | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| PR-01 | P1 | Sửa tên | 1. Vào `/profile`<br>2. Tap "Sửa"<br>3. Đổi tên, Lưu | Tên hiển thị mới, doc cập nhật |
| PR-02 | P0 | Đăng xuất | 1. Tap "Đăng xuất" | Về `/` (Landing), Firebase auth logout |
| PR-03 | P1 | iOS Add-to-Home-Screen hint | 1. Mở `/profile` trên iOS Safari (không standalone) | Hiển thị 3 bước Share → Add to Home Screen |
| PR-04 | P1 | iOS hint ẩn nếu đã standalone | 1. Đã Add-to-Home<br>2. Mở app từ icon → `/profile` | Khối hint không hiển thị |
| PR-05 | P1 | Thêm con với chiều cao | 1. `/children` → Thêm<br>2. Tên: Linh, DOB, cao 130 | audience auto = CHILD_UNDER_140 |
| PR-06 | P2 | Sửa chiều cao bé → audience đổi | 1. Sửa bé từ 130 → 145 | audience = CHILD_OVER_140 |
| PR-07 | P2 | Xóa bé khi đã có thẻ ràng buộc | 1. Bé có membership active<br>2. Click xóa | Confirm dialog, vẫn xóa được (membership giữ holderName snapshot) |
| PR-08 | P1 | Notification badge | 1. Có 3 noti chưa đọc<br>2. Vào `/home` | Badge "3" trên Bell icon shortcut |

### 4.6 RECEPTIONIST

| ID | Mức | Mô tả | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| RC-01 | P0 | Login → vào /admin | 1. Lễ tân login | Vào `/admin` dashboard (không phải `/home`) |
| RC-02 | P0 | KHÔNG xem được Reports | 1. Vào `/admin/reports` | 403 hoặc "Bạn không có quyền" (INV-9) |
| RC-03 | P0 | KHÔNG sửa được giá | 1. Vào `/admin/products` | Hiển thị bảng giá readonly + thông báo "Chỉ Owner sửa" |
| RC-04 | P0 | Confirm thanh toán | 1. Khách có đơn PENDING #A<br>2. Lễ tân vào `/admin/orders` → tap #A<br>3. Click "Xác nhận đã nhận tiền mặt" | Status PAID, payment doc tạo, thẻ kích hoạt, khách nhận push "Thẻ đã kích hoạt 🎉" |
| RC-05 | P0 | Confirm trùng → lỗi | 1. Click confirm 2 lần liên tiếp | Lần 2 lỗi `failed-precondition` "Đơn đang ở trạng thái PAID" |
| RC-06 | P0 | Check-in hộ trẻ qua SĐT phụ huynh | 1. Vào `/admin/checkin-assist`<br>2. Nhập SĐT phụ huynh<br>3. Chọn bé<br>4. Confirm | Attendance ghi, push cho phụ huynh "Con của bạn đã tham gia..." |
| RC-07 | P1 | Tab Orders filter status | 1. Click tab "PENDING" | Chỉ hiển thị đơn pending (cần composite index) |
| RC-08 | P1 | Orders nhóm theo ngày | 1. Vào `/admin/orders` | "Hôm nay" / "Hôm qua" / "20/06/2026" |
| RC-09 | P2 | KHÔNG xóa đơn được | 1. Tap đơn PENDING → "Xóa" | Button ẩn hoặc 403 (chỉ Owner) |
| RC-10 | P1 | Search khách hàng theo SĐT | 1. `/admin/customers` nhập "0905" | Filter list |
| RC-11 | P1 | Hiển thị thời gian đăng ký | 1. Mở list khách | Cột "Đăng ký lúc" relative ("3 ngày trước") |

### 4.7 OWNER

| ID | Mức | Mô tả | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| OW-01 | P0 | Xem Reports realtime | 1. Vào `/admin/reports` | Số liệu doanh thu theo loại / theo audience / theo ngày (bar chart 30 ngày) |
| OW-02 | P0 | Sửa giá pricing matrix | 1. `/admin/products`<br>2. Đổi vé tháng người lớn 500k → 550k<br>3. Lưu | `/settings/pricing` cập nhật, audit log có `{before, after}`, khách thấy ngay |
| OW-03 | P0 | Hủy thay đổi giá | 1. Edit nhưng không lưu<br>2. Click "Hủy" | Reset về giá hiện tại |
| OW-04 | P0 | Hoàn tiền đơn PAID | 1. Tap đơn PAID<br>2. Click "Hoàn tiền"<br>3. Nhập lý do "Test refund"<br>4. Confirm | Status REFUNDED, refund.reason ghi, thẻ chuyển SUSPENDED, slot trả (nếu course), khách nhận push lý do |
| OW-05 | P0 | Hoàn tiền không lý do → reject | 1. Refund với reason rỗng | Lỗi "Bắt buộc nhập lý do" |
| OW-06 | P1 | Xóa đơn PENDING | 1. Tap đơn PENDING → "Xóa" | Doc xóa, slot trả về, audit log ghi DELETE_ORDER |
| OW-07 | P0 | KHÔNG xóa đơn PAID | 1. Tap đơn PAID → "Xóa" | Lỗi "Chỉ xóa được đơn chưa thanh toán" |
| OW-08 | P0 | CRUD HLV — thêm mới | 1. `/admin/coaches` → Thêm<br>2. Tên: Thầy Hùng, T2/T5, SĐT 0909999<br>3. Lưu | Doc `/coaches/hung` tạo, 20 slots seed (10×2), audit log CREATE_COACH |
| OW-09 | P1 | Sửa HLV thêm ngày | 1. Thầy Hùng đang dạy T2/T5<br>2. Thêm T7<br>3. Lưu | 10 slots T7 seed mới |
| OW-10 | P1 | Sửa HLV bớt ngày khi có HV | 1. Thầy Hùng T2 có 5 HV<br>2. Bỏ T2 → Lưu | Lỗi "Ngày 2 còn học viên..." |
| OW-11 | P1 | Sửa HLV bớt ngày không có HV | 1. Thầy Hùng T5 = 0 HV<br>2. Bỏ T5 → Lưu | 10 slots T5 xóa |
| OW-12 | P1 | Khóa HLV | 1. Tap HLV → "Khóa" | active=false, audit SET_COACH_ACTIVE |
| OW-13 | P0 | Gán role qua /admin/staff | 1. Vào `/admin/staff`<br>2. Nhập SĐT người đăng ký rồi → chọn RECEPTIONIST | Custom claim set, doc cập nhật, người đó refresh token vào /admin |
| OW-14 | P1 | Gán role với SĐT chưa đăng ký | 1. Nhập SĐT chưa có user | Lỗi "Không tìm thấy tài khoản" |
| OW-15 | P1 | Gán role với SĐT format "0905..." | 1. Nhập "0905123456" (không +84) | Tự normalize thành +84905123456 thành công |
| OW-16 | P1 | Gán COACH + coachId | 1. Owner phải link coachId | doc `/coaches/{id}.userId` cập nhật |
| OW-17 | P0 | Audit log đầy đủ | 1. Sau khi update/refund/role → check `/auditLogs` | Mọi action có actorId, action, targetType, targetId, detail, at |
| OW-18 | P1 | QR Gate tablet | 1. Mở `/admin/qr-gate`<br>2. Đếm 30s | QR đổi mỗi 30s, nonce mới, doc `/qrTokens/{id}` tạo |

### 4.8 COACH

| ID | Mức | Mô tả | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| CO-01 | P0 | Login → vào /coach | 1. Tùng login | Vào `/coach` dashboard |
| CO-02 | P0 | Xem lịch hôm nay | 1. T4: vào `/coach` | List 10 ca với số HV/ca |
| CO-03 | P1 | Xem danh sách HV trong ca | 1. Tap 1 ca có 5 HV | List 5 HV, mỗi HV có nút Zalo |
| CO-04 | P1 | Nhắn Zalo deeplink | 1. Tap nút Zalo | Mở `zalo.me/{phone}` |
| CO-05 | P0 | KHÔNG điểm danh được | 1. Coach mở /coach/students | Không có nút "Điểm danh" (auto via QR) |
| CO-06 | P1 | Ghi chú HV riêng | 1. Tap HV → "Ghi chú" | Lưu vào enrollment.coachNotes (chỉ HLV thấy) |
| CO-07 | P2 | Cảnh báo HV vắng ≥ 3 buổi | 1. HV vắng 3 buổi liên tiếp | Highlight đỏ + gợi ý "Nhắn Zalo" |
| CO-08 | P2 | KHÔNG xem được tài chính | 1. Mở `/admin/*` | 403 hoặc redirect |

---

## 5. Test Cron Jobs (cần Cloud Scheduler chạy hoặc force trigger)

| ID | Mức | Cron | Mô tả | Cách test |
|---|---|---|---|---|
| CRON-01 | P0 | `cancelUnpaidOrdersHourly` | Hủy đơn PENDING > 24h | Tạo đơn PENDING, set `createdAt` về 25h trước, force trigger cron, check status = CANCELLED + slot trả |
| CRON-02 | P0 | `expireServicesDaily` | EXPIRE membership/enrollment hết hạn | Set endDate/expiryDate về quá khứ, force trigger, check status + push |
| CRON-03 | P1 | `notifyExpiringDaily` | Push nhắc còn 30/7/1 ngày & 10/5/1 buổi | Set endDate vào dayKeys, force trigger, check notification doc + FCM |
| CRON-04 | P1 | `aggregateDailyStats` | Tổng hợp doanh thu ngày | Tạo vài đơn PAID hôm nay, force trigger, check `/dailyStats/{YYYY-MM-DD}` + `/monthlyStats/{YYYY-MM}` |

> **Cách force trigger trên prod**:
> ```powershell
> # Dùng Firebase Console → Cloud Functions → tab Scheduled functions → "Run now"
> # hoặc:
> gcloud scheduler jobs run firebase-schedule-cancelUnpaidOrdersHourly --location=asia-southeast1
> ```

---

## 6. Test bảo mật (P0 — không bỏ qua)

### 6.1 Firestore Rules
| ID | Test | Cách test | Kết quả mong đợi |
|---|---|---|---|
| SEC-01 | Khách A KHÔNG đọc được order của khách B | `getDoc('orders/{B-orderId}')` từ A | `permission-denied` |
| SEC-02 | Lễ tân đọc được mọi order | `getDocs(orders, where status==PENDING)` từ Lễ tân | OK |
| SEC-03 | Khách KHÔNG ghi trực tiếp `/orders` | `setDoc('orders/fake', {amount: 1})` từ client | `permission-denied` |
| SEC-04 | Khách KHÔNG đọc `/dailyStats` | `getDoc('dailyStats/2026-06-17')` từ Customer | `permission-denied` |
| SEC-05 | Lễ tân KHÔNG đọc `/dailyStats` | Tương tự từ Receptionist | `permission-denied` (INV-9) |
| SEC-06 | Owner đọc được `/auditLogs` | `getDocs('auditLogs')` từ Owner | OK |
| SEC-07 | Mọi role KHÔNG xóa `/auditLogs` | `deleteDoc('auditLogs/{id}')` từ Owner | `permission-denied` (INV-12 — append-only) |
| SEC-08 | Khách đọc `/settings/pricing` public | Không đăng nhập | OK (cần để hiển thị giá ở Landing) |

### 6.2 Callable Functions
| ID | Test | Bước | Kết quả mong đợi |
|---|---|---|---|
| CB-SEC-01 | `createOrder` cần đăng nhập | Gọi mà chưa login | `unauthenticated` |
| CB-SEC-02 | `confirmPayment` cần Staff | Customer gọi | `permission-denied` |
| CB-SEC-03 | `refundOrder` chỉ Owner | Receptionist gọi | `permission-denied` |
| CB-SEC-04 | `updatePricing` chỉ Owner | Customer gọi | `permission-denied` |
| CB-SEC-05 | `setUserRole` chỉ Owner | Customer gọi | `permission-denied` |
| CB-SEC-06 | `issueQrToken` chỉ Staff | Customer gọi | `permission-denied` |
| CB-SEC-07 | `deleteOrder` chỉ Owner | Receptionist gọi | `permission-denied` |
| CB-SEC-08 | Khách KHÔNG hủy được đơn của khách khác | A gọi `cancelOrder({orderId: B-order})` | `permission-denied` |

### 6.3 Bảo mật QR
| ID | Test | Bước | Kết quả mong đợi |
|---|---|---|---|
| QR-SEC-01 | QR thay đổi mỗi 30s | Stream `/admin/qr-gate` 60s | Token mới mỗi 30s, doc mới trong `/qrTokens` |
| QR-SEC-02 | QR single-use | Quét 2 lần | Lần 2 lỗi "QR đã được dùng" |
| QR-SEC-03 | QR không hợp lệ | Sửa nonce trong QR string | Lỗi "QR không khớp" |
| QR-SEC-04 | QR từ token khác hồ | Nhập tokenId fake | Lỗi "QR không hợp lệ" |

### 6.4 SMS Pumping (INV-13)
| ID | Test | Bước | Kết quả mong đợi |
|---|---|---|---|
| SMS-01 | Chỉ +84 được phép | Nhập +1555... vào signin | Firebase reject |
| SMS-02 | Spam OTP cùng 1 số | Bấm "Gửi OTP" 5 lần liên tiếp | Sau 2-3 lần Firebase throttle |
| SMS-03 | Verify reCAPTCHA invisible chạy | DevTools Console | Có request `recaptcha.net` |

---

## 7. Test hiệu năng & UX

| ID | Mức | Test | Cách đo | Pass khi |
|---|---|---|---|---|
| PERF-01 | P1 | Lighthouse mobile | Chrome DevTools → Lighthouse mobile | Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90 |
| PERF-02 | P1 | Realtime pricing | Owner đổi giá, đo thời gian khách thấy | < 3s |
| PERF-03 | P2 | LCP landing | Lighthouse | < 2.5s trên 4G slow |
| PERF-04 | P2 | TTI landing | Lighthouse | < 4s |
| PERF-05 | P1 | Offline read | DevTools → Offline mode → mở `/cards` | Vẫn hiển thị thẻ (Firestore cache) |
| PERF-06 | P2 | Page transition smooth | Click các tab bottom nav | Không jank, animation 200-300ms |
| PERF-07 | P3 | Service worker register | DevTools → Application → SW | `sw.js` active sau build PWA |

---

## 8. Test khả năng truy cập (Accessibility)

| ID | Mức | Test | Pass khi |
|---|---|---|---|
| A11Y-01 | P1 | Tap target ≥ 44×44px | DevTools → Inspect button | Min-height 44px |
| A11Y-02 | P1 | Color contrast AA | axe DevTools | Không có lỗi contrast trên text |
| A11Y-03 | P2 | Focus visible | Tab keyboard | Outline xanh lá (shadow glow) |
| A11Y-04 | P2 | Screen reader đọc đúng | VoiceOver/TalkBack đọc Landing | Đọc được tên, giá, button label |
| A11Y-05 | P3 | Reduce motion | OS Reduce Motion bật | Animation giảm tốc (chưa implement) |

---

## 9. Test cross-device & cross-browser

| Device / Browser | Smoke (SM-01..05) | Sign-in (SI-*) | Check-in QR (CK-*) | Push noti |
|---|---|---|---|---|
| Android Chrome (latest) | ✅ phải pass | ✅ | ✅ | ✅ |
| iPhone Safari 16.4+ standalone | ✅ phải pass | ✅ | ✅ | ✅ (sau ATH) |
| iPhone Safari 16.4+ in tab | ✅ phải pass | ✅ | ✅ | ❌ (chỉ standalone) |
| iPad Safari | ✅ | ✅ | ✅ | ✅ (sau ATH) |
| Desktop Chrome | ✅ | ✅ | ⚠️ camera laptop | ✅ |
| Desktop Safari | ⚠️ best-effort | ✅ | ⚠️ | — |
| Desktop Edge | ⚠️ best-effort | ✅ | ⚠️ | ✅ |

> Tablet ở cổng (`/admin/qr-gate`): test trên Android tablet (Lenovo M10 hoặc tương đương) trước launch.

---

## 10. Test tuân thủ PDPL 2026 (P0)

| ID | Test | Cách test | Pass khi |
|---|---|---|---|
| PDPL-01 | Trang `/privacy` tồn tại | Mở URL | Hiển thị nội dung quyền riêng tư đầy đủ §11 PRD |
| PDPL-02 | Consent rõ ràng ở signin | Mở /signin | Có text "Bằng đăng ký bạn đồng ý..." có link `/privacy` |
| PDPL-03 | Quyền truy cập dữ liệu | Vào /profile | Khách xem được toàn bộ data của mình |
| PDPL-04 | Quyền chỉnh sửa | /profile, /children | Sửa/xóa được |
| PDPL-05 | Quyền xóa tài khoản | Có nút "Xóa tài khoản" | (Chưa implement — callable `deleteAccount`) |
| PDPL-06 | Chỉ thu thập tối thiểu | Audit signup form | Chỉ SĐT + tên + (option) chiều cao. KHÔNG CMND/email/địa chỉ |
| PDPL-07 | Cross-border consent | /privacy nói rõ Singapore | Trang giải thích Firebase asia-southeast1 |

---

## 11. Regression Tests (chạy mỗi sprint hoặc trước deploy)

Bộ tối thiểu sau khi sửa bất kỳ Cloud Function nào:

1. **SM-01 → SM-05** (Smoke)
2. **SI-01, SI-08** (Auth + bug ghi đè role)
3. **CB-01, CB-02, CB-04** (Mua + đóng băng giá)
4. **CB-08, CB-09** (Slot capacity + race condition)
5. **CK-03, CK-04, CK-09, CK-10** (Check-in + QR security)
6. **RC-04, RC-05** (Confirm payment + idempotent)
7. **OW-02, OW-04, OW-13** (Pricing + refund + role grant)
8. **SEC-01 → SEC-08** (Firestore rules)
9. **CB-SEC-01 → CB-SEC-08** (Callable security)

---

## 12. Lịch trình test trước launch

| Ngày trước launch | Việc | Phụ trách |
|---|---|---|
| **D-14** | Smoke test toàn bộ, fix P0 | Dev + Owner |
| **D-10** | UAT lễ tân (RC-*) trong môi trường staging | Lễ tân + Owner |
| **D-7** | UAT khách hàng thật (5-10 người) — flow mua + check-in | Owner mời |
| **D-5** | Test cron jobs trên staging | Dev |
| **D-3** | Test bảo mật + PDPL | Dev + Owner |
| **D-2** | Test trên tablet cổng thật | Owner + Dev đến hồ |
| **D-1** | Smoke prod + final review | Tất cả |
| **D-0** | Launch + monitor | Tất cả |
| **D+1** | Daily check audit log + Cloud Logging | Owner + Dev |
| **D+7** | Post-launch retrospective | Tất cả |

---

## 13. Bug report template

```markdown
**ID**: BUG-001
**Test case ref**: CB-08
**Mức**: P0 / P1 / P2 / P3
**Môi trường**: Local / Staging / Prod
**Device**: iPhone 13 Safari 17.2 (standalone)
**Reproduce**:
1. Bước 1
2. Bước 2
3. Bước 3
**Expected**: Slot báo đầy
**Actual**: Đơn vẫn tạo được, slot.enrolledCount = 21
**Log**: (paste console error / Firebase log)
**Screenshot**: (link)
**Status**: Open / In Progress / Fixed / Verified / Closed
**Assignee**: dev / owner
```

---

## 14. Definition of Done (cho test)

App được coi là **TEST PASSED** khi:
- ✅ Tất cả P0 pass (Blocker)
- ✅ Tất cả P1 pass HOẶC có workaround chấp nhận được + ticket follow-up
- ✅ ≥ 80% P2 pass
- ✅ Bảo mật §6 pass 100%
- ✅ PDPL §10 hoàn tất ít nhất PDPL-01 → PDPL-06
- ✅ Lighthouse mobile ≥ 90 trên 3 trang chính (landing, home, cards)
- ✅ Có audit log đầy đủ sau mỗi action tài chính
- ✅ Owner ký duyệt launch

---

## Tài liệu liên quan
- [`PRD.md`](./PRD.md) — Yêu cầu sản phẩm + 14 invariants tham chiếu
- [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) — §16 bug fix history
- [`TASKS.md`](./TASKS.md) — Task list + trạng thái phases
- [`CHAT-HISTORY.md`](./CHAT-HISTORY.md) — Timeline UAT rounds 1 & 2
