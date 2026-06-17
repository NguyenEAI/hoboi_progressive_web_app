# PRD — Hệ thống Quản lý Hồ Bơi Prosper Plaza

> **Phiên bản**: 2.0 (viết lại theo best practices ngành + Luật Bảo vệ Dữ liệu Cá nhân VN 2026)
> **Ngày cập nhật**: 2026-06-16
> **Người chủ sở hữu**: thucludinh@gmail.com (OWNER)

---

## 1. Bối cảnh & Mục tiêu

### 1.1 Đơn vị vận hành
| Mục | Thông tin |
|---|---|
| Pháp nhân | CÔNG TY TNHH HT BẢO LÂM |
| Hồ bơi | Hồ bơi Chung cư Prosper Plaza (1 hồ) |
| Địa chỉ | 22/14 Phan Văn Hớn, P. Tân Đông Hưng Thuận, TP. Hồ Chí Minh |
| Quy mô dự kiến | 2.000–3.000 thành viên hoạt động/năm · ~50–150 lượt check-in/ngày |
| Thị trường | B2C — cư dân Prosper Plaza & khu vực lân cận |

### 1.2 Mục tiêu sản phẩm
| # | Mục tiêu | KPI / Định lượng |
|---|---|---|
| G1 | Số hóa toàn bộ vận hành (bán vé/khóa, check-in, báo cáo) | 100% giao dịch ghi vào hệ thống trong v1 |
| G2 | Thay thế thẻ cứng bằng thẻ điện tử có check-in QR | ≥ 90% check-in qua QR sau 3 tháng |
| G3 | Tiết kiệm thời gian lễ tân (đỡ ghi sổ, đỡ giải thích giá) | Trung bình ≤ 30 giây/khách mới |
| G4 | Chủ hồ bơi nắm doanh thu/tồn thẻ realtime | Báo cáo có sẵn 24/7, không chờ kế toán |
| G5 | Tuân thủ pháp luật VN về dữ liệu cá nhân (PDPL 2026) | Đạt 100% checklist tại §11 |

### 1.3 Nguyên tắc thiết kế (Design Principles)
1. **Mobile-first PWA** — 80%+ khách dùng điện thoại; cài lên màn hình chính, không bắt buộc native app.
2. **Đóng băng giá** (price freeze) — đơn đã chốt giữ giá lúc mua kể cả khi Owner đổi bảng giá sau đó.
3. **Server is source of truth** — tất cả ghi tài chính/thẻ phải qua Cloud Functions; client chỉ đọc.
4. **Tối thiểu hóa dữ liệu** (PDPL): chỉ thu thập số điện thoại + họ tên + chiều cao + FCM token. Không yêu cầu CMND/email.
5. **Audit mọi thay đổi tiền + role** — bất biến, không xóa được, Owner xem được.
6. **Realtime mặc định** — Owner sửa giá/HLV → khách thấy ngay (Firestore `onSnapshot`).
7. **Tiếng Việt 100%** giao diện; thuật ngữ ngân hàng/tài chính theo chuẩn VN.

---

## 2. Vai trò & Quyền (RBAC)

5 vai trò, lưu trong `users.role` **và** Firebase custom claims (đồng bộ qua callable `setUserRole`).

| Vai trò | Quyền ghi | Quyền đọc | Đặc biệt |
|---|---|---|---|
| **OWNER** | Tất cả | Tất cả gồm báo cáo tài chính, audit log | Là vai trò duy nhất sửa giá, hoàn tiền, phân quyền |
| **RECEPTIONIST** | Xác nhận thanh toán, check-in hộ, điểm danh hộ, gia hạn thẻ, đăng ký khách mới | Đơn/khách/thẻ; KHÔNG báo cáo tài chính tổng | Vai trò mặc định cho nhân viên quầy |
| **COACH** | Ghi chú học viên, báo nghỉ dạy, nhắn Zalo | Lịch dạy của mình, danh sách học viên trong lớp mình | KHÔNG điểm danh (QR tự xử lý) |
| **PARENT** | Mua dịch vụ cho con, quản lý hồ sơ trẻ em | Thẻ/đơn/lịch của mình + con | CHILD KHÔNG có tài khoản riêng — luôn gắn parentId |
| **CUSTOMER** | Mua dịch vụ cho bản thân | Thẻ/đơn/thông báo của mình | Một số khách cũng đồng thời là PARENT (cờ `hasChildren`) |

**Quy tắc về role:**
- Role mặc định khi đăng ký = `CUSTOMER`. Owner nâng cấp qua `/admin/staff`.
- Một số điện thoại = một role tại một thời điểm. Đổi role cần Owner.
- Custom claim được làm mới khi token refresh (≤ 1h). Sau khi gán role mới, client gọi `getIdToken(true)` để buộc làm mới.

---

## 3. Bảng giá chính thức (frozen at order time)

### 3.1 Vé lẻ — KHÔNG bán qua app, chỉ hiển thị tham khảo
| Đối tượng | Giá |
|---|---|
| Trẻ em < 1.4m | 25.000₫ |
| Trẻ em ≥ 1.4m | 30.000₫ |
| Người lớn | 35.000₫ |
| Người lớn dẫn trẻ < 2 tuổi | 40.000₫ |

**Lý do giữ ngoài hệ thống**: doanh thu vé lẻ nhỏ, ghi sổ tay vẫn nhanh hơn quét app. Tránh tăng độ phức tạp v1.

### 3.2 Vé thời hạn (không giới hạn lượt) — 3 đối tượng × 4 thời hạn
| Đối tượng | 1 Tháng | 3 Tháng | 6 Tháng | 1 Năm |
|---|---|---|---|---|
| Trẻ < 1.4m | 400.000₫ | 1.000.000₫ | 1.800.000₫ | 3.500.000₫ |
| Trẻ ≥ 1.4m | 450.000₫ | 1.150.000₫ | 2.150.000₫ | 4.200.000₫ |
| Người lớn | 500.000₫ | 1.300.000₫ | 2.300.000₫ | 4.400.000₫ |

### 3.3 Gói lượt (trừ 1 lượt/check-in) — 3 đối tượng × 2 gói
| Đối tượng | 15 Lượt | 30 Lượt |
|---|---|---|
| Trẻ < 1.4m | 300.000₫ | 550.000₫ |
| Trẻ ≥ 1.4m | 350.000₫ | 700.000₫ |
| Người lớn | 450.000₫ | 800.000₫ |

### 3.4 Khóa học bơi — **giá phẳng 1.800.000₫**, 15 buổi, hiệu lực 90 ngày
4 kiểu cùng giá, không yêu cầu điều kiện tiên quyết:
- 🐸 Bơi cơ bản (ếch)  ·  🏊 Bơi sải  ·  🛟 Bơi ngửa  ·  🦋 Bơi bướm

> Bảng giá chi tiết (đầy đủ mốc 6 tháng + 3 nhóm đối tượng) cũng được lưu ở `memory/pricing-matrix.md` để các phiên Claude tiếp theo tham chiếu nhanh.

---

## 4. Quy tắc nghiệp vụ bất biến (Invariants)

Mỗi invariant có **mã số ổn định** để test/security rules tham chiếu. Đừng đổi mã số khi thêm mới — chỉ thêm INV-mới ở cuối.

| Mã | Quy tắc | Lý do |
|---|---|---|
| **INV-1** | Khóa học KHÔNG thay thế vé vào hồ. Học 08:00 → quay lại 15:00 phải có vé/thẻ riêng. | Tách doanh thu HLV ↔ doanh thu vé hồ |
| **INV-2** | Khóa học hết hiệu lực sau đúng **90 ngày** kể từ ngày kích hoạt. Buổi chưa học → mất, không bảo lưu, không hoàn tiền, không học bù. | Tránh nợ buổi vô hạn |
| **INV-3** | Mỗi ca tối đa **20 học viên**. Đầy → không cho đăng ký (Firestore transaction kiểm tra `enrolledCount < capacity`). | Chất lượng giảng dạy |
| **INV-4** | Lịch HLV cố định: Thầy Tùng (T4/T6/CN) · Thầy Tín (T3/T5/T7). T2 nghỉ chung. | Chính sách HR |
| **INV-5** | Khung giờ dạy: Sáng 07–11h (4 ca) · Chiều 14–20h (6 ca) = **10 ca/ngày** × 60 phút. | Hợp khung giờ vận hành |
| **INV-6** | Đơn mặc định `PENDING_PAYMENT`, chỉ kích hoạt sau khi Lễ tân/Owner xác nhận `PAID` (tiền mặt tại quầy). | Hồ chưa có thanh toán online |
| **INV-7** | Trẻ đi học một mình: lễ tân tra SĐT phụ huynh → chọn bé → điểm danh hộ → tự push cho phụ huynh. | Quy trình thực tế của hồ |
| **INV-8** | Check-in QR dùng nonce đổi mỗi **30 giây**, single-use. Token cấp bởi server, không đoán được. | Chống chụp màn hình + screenshot share |
| **INV-9** | Lễ tân KHÔNG xem báo cáo tài chính tổng, KHÔNG xóa dữ liệu (chỉ Owner). | Tách bạch quyền tài chính |
| **INV-10** | Đóng băng giá: đơn đã mua giữ giá lúc mua dưới dạng `productSnapshot`; Owner đổi giá chỉ ảnh hưởng đơn mới. | Bảo vệ khách + kế toán |
| **INV-11** | Mọi callable function ghi tài chính phải dùng Firestore **transaction** (đọc-rồi-ghi nguyên tử), không dùng `set` rời. | Chống race condition booking slot |
| **INV-12** | Mọi thay đổi giá / role / hoàn tiền ghi vào `/auditLogs` (append-only). Không cho phép cập nhật/xóa log. | Forensic + tuân thủ |
| **INV-13** | OTP gửi qua Firebase Phone Auth chỉ chấp nhận mã quốc gia **+84** (SMS region policy). Bật reCAPTCHA SMS defense. | Chống SMS pumping fraud |
| **INV-14** | Tất cả callable function phải `requireAppCheck` trong production. | Chống abuse từ client giả mạo |

### 4.0 Vai trò PARENT trong v1
**Quyết định v1**: PARENT không phải tài khoản riêng. Khách hàng có con thì vẫn dùng vai trò `CUSTOMER`, có cờ ngầm `childrenIds[]` trong doc `/users/{uid}` + subcollection `/users/{uid}/children`. Lý do: giảm độ phức tạp; phụ huynh đi bơi cùng con cũng cần Customer role. PARENT chỉ tách khi cần phân biệt UX rõ rệt (sau v1).

### 4.1 Quy tắc dùng thẻ
- **Vé thời hạn** (membership): chỉ chủ thẻ. KHÔNG cho mượn, KHÔNG dẫn người miễn phí. Mặt trước thẻ điện tử hiển thị tên + MS + audience + ngày hết hạn.
- **Gói lượt** (ticket package) — **check-in nhóm**: 1 quét = N người = trừ N lượt. Mặt sau thẻ có lưới đánh dấu các lượt đã dùng (giống thẻ cứng truyền thống).
  - **Gói người lớn**: mọi đối tượng (người lớn / trẻ ≥1.4m / trẻ <1.4m) đều dùng được, đếm 1 lượt mỗi người.
  - **Gói trẻ em** (< 1.4m hoặc ≥ 1.4m): **chỉ trẻ em** dùng được. Người lớn đi cùng phải mua vé lẻ tại quầy (KHÔNG phụ thu, KHÔNG ép gói thấp hơn).

### 4.2 Vòng đời khóa học
| Trạng thái | Điều kiện chuyển | Hành động |
|---|---|---|
| `ACTIVE` | Confirmed PAID, ngày bắt đầu hợp lệ | Giữ slot, hiển thị trong lịch HLV |
| `COMPLETED` | Đủ 15 buổi đã điểm danh | Push chúc mừng + gợi ý kiểu bơi khác · giải phóng slot |
| `EXPIRED` | Quá 90 ngày mà chưa đủ 15 buổi | Push thông báo kèm lý do · giải phóng slot |
| `CANCELLED` | Owner hoàn tiền | Push lý do · slot trả về first-come |

**Không có**: chứng nhận hoàn thành, ưu đãi khóa tiếp theo, giữ slot ưu tiên cho HV cũ.

### 4.3 Vòng đời đơn hàng
```
DRAFT(client) → PENDING_PAYMENT (server) → PAID (staff confirm) → ACTIVE
                                        ↘ CANCELLED (timeout 24h OR staff/owner)
                  PAID → REFUNDED (Owner only, reason required)
```

---

## 5. Tính năng v1 (chốt)

### 5.1 Khách hàng (Customer / Parent)
- **Đăng ký 3 bước**: Số ĐT (+84) → OTP → Họ tên. Lưu chiều cao tùy chọn (cần cho audience).
- **Home**: shortcut Mua thẻ · Mua khóa · Check-in · Thẻ của tôi.
- **Mua dịch vụ**: bước "Mua cho ai" (bản thân / con A / con B / nhập trẻ mới). Hiển thị giá realtime từ `/settings/pricing`.
- **Mua khóa học**: wizard 5 bước (Học cho ai → Chọn kiểu → Chọn HLV → Chọn ca → Xác nhận).
- **Ví thẻ điện tử**: mỗi thẻ render giống y thẻ cứng (mặt trước + mặt sau ô lượt cho gói lượt).
- **Check-in**: chọn số người → preview "Sẽ dùng thẻ X, trừ Y lượt" → quét QR cổng. Nếu thiếu lượt → đề xuất mua vé lẻ tại quầy.
- **Trẻ em**: thêm/sửa/xóa hồ sơ con (tên, ngày sinh, chiều cao → tự tính audience).
- **Thông báo**: in-app + FCM Web Push (cần Add-to-Home-Screen trên iOS).
- **Hồ sơ**: sửa tên, đổi avatar (tùy chọn), logout.

### 5.2 Lễ tân (Receptionist)
- **Dashboard nhanh**: đơn pending hôm nay · check-in hôm nay · doanh thu hôm nay (KHÔNG tổng/tháng).
- **Đăng ký khách mới**: nhập SĐT → nếu chưa có tạo bản ghi → bán dịch vụ ngay tại quầy.
- **Xác nhận thanh toán**: tap đơn pending → "Xác nhận đã nhận tiền mặt" → đơn chuyển PAID, thẻ kích hoạt.
- **Check-in hộ**: nhập SĐT → preview → confirm. Đặc biệt cho **trẻ đi học một mình** (INV-7).
- **Quản lý đơn**: lọc theo trạng thái + ngày, nhóm theo ngày (Hôm nay/Hôm qua/Ngày DD/MM).
- **Quản lý khách**: search SĐT/tên, xem thẻ + lịch sử check-in.
- **Gia hạn thẻ**: chọn khách + chọn gói có sẵn → tạo đơn PENDING.

### 5.3 Huấn luyện viên (Coach)
- **Lịch dạy hôm nay**: danh sách ca trong ngày + số HV.
- **Học viên**: từng HV có nút Zalo (deeplink `zalo.me/{phone}`), ghi chú riêng, đánh dấu vắng.
- **Báo nghỉ dạy**: chọn ca + lý do → push tự động cho HV trong ca đó.
- **Cảnh báo vắng nhiều**: HV vắng ≥ 3 buổi liên tiếp → highlight + gợi ý nhắn Zalo.

### 5.4 Chủ hồ bơi (Owner)
- **Tất cả của Lễ tân +**:
- **Báo cáo doanh thu**: realtime từ `/orders` PAID (KHÔNG đợi cron). Chia 3 chiều: theo loại (vé thời hạn / gói lượt / khóa học), theo đối tượng (3 nhóm), theo ngày (bar chart 30 ngày gần nhất).
- **Sửa bảng giá** (`/admin/products`): UI matrix realtime, lưu vào `/settings/pricing`, khách thấy ngay.
- **CRUD HLV** (`/admin/coaches`): thêm/sửa/khóa, tự tạo 10 ca/ngày cho mỗi ngày dạy. Bảo vệ không xóa HLV có HV đang học.
- **Phân quyền** (`/admin/staff`): tap khách → đổi role (callable `setUserRole`).
- **Xóa đơn PENDING** lỡ tạo nhầm.
- **Hoàn tiền PAID**: bắt buộc nhập lý do, khóa thẻ, push lý do cho khách, ghi audit log.
- **QR Gate** (`/admin/qr-gate`): màn hình tablet ở cổng, QR rotation 30s, full-screen, prevent screen lock.

---

## 6. Tính năng phi-chức-năng (NFR)

| Loại | Yêu cầu | Đo lường |
|---|---|---|
| Hiệu năng | LCP ≤ 2.5s trên 4G; TTI ≤ 4s | Lighthouse mobile ≥ 90 |
| Realtime | Owner đổi giá → khách thấy < 3s | `onSnapshot` round-trip |
| Khả dụng | Uptime ≥ 99% (Firebase SLA + Vercel SLA) | Statuspage tự theo dõi |
| Offline | App vẫn xem được thẻ điện tử khi mất mạng (cache Firestore) | Test DevTools Offline |
| Bảo mật | App Check bật cho mọi callable; SMS region policy chỉ VN | Audit log + Firebase console |
| Tiết kiệm | Cloud Functions cold start ≤ 2s p95; trung bình ≤ $20/tháng | Cloud Monitoring |
| i18n | 100% tiếng Việt, định dạng tiền `vi-VN` (`1.000.000 ₫`) | Manual review |
| Accessibility | Tap target ≥ 44×44px; contrast AA | Lighthouse a11y ≥ 90 |

---

## 7. UX Flow (mức cao)

### 7.1 Khách mua thẻ
```
Home → "Mua thẻ" → Chọn loại (Vé tháng/Gói lượt)
   → Mua cho ai (tôi/con A) → Chọn cấu hình (thời hạn/audience)
   → Xem giá realtime → "Đặt mua" → Đơn PENDING tạo
   → Hiển thị mã đơn + "Mang mã này đến quầy thanh toán tiền mặt"
   → (Lễ tân tại quầy) confirm → Push "Thẻ đã kích hoạt"
   → Khách mở /cards thấy thẻ mới
```

### 7.2 Check-in QR
```
Tablet cổng /admin/qr-gate hiển thị QR (rotation 30s)
Khách mở /checkin → chọn số người đi cùng (cho gói lượt)
   → app preview "Sẽ dùng thẻ X, trừ Y lượt" 
   → tap "Quét QR" → camera mở → scan → server validate
   → if valid: tick xanh + ghi /checkins + trừ lượt
   → if invalid (thiếu lượt/sai audience): show lỗi + gợi ý mua vé lẻ
```

### 7.3 Đăng ký khóa học
```
Home → "Khóa học bơi" → Wizard:
   B1: Học cho ai? (tôi/con)
   B2: Kiểu bơi? (ếch/sải/ngửa/bướm) — cùng giá
   B3: HLV? (Tùng T4/T6/CN, Tín T3/T5/T7)
   B4: Ca? (sáng/chiều × 10 ca, hiển thị "X/20")
   B5: Xác nhận giá 1.800k + ngày bắt đầu
→ Đơn PENDING + giữ chỗ slot 24h
→ Confirm PAID → enrollment ACTIVE, 90 ngày, 15 buổi
```

---

## 8. Data Model nghiệp vụ (chi tiết kỹ thuật trong IMPLEMENTATION-PLAN.md)

**Sơ đồ entity cấp cao**:
```
User ─┬─< Child
      ├─< Order ─┬─> Payment (1-1)
      │          └─> Membership | TicketPackage | Enrollment
      ├─< Checkin
      ├─< Notification
      └─< Coach (1-0..1)  (chỉ COACH role)

Coach ─< Slot (10 slots × 7 weekdays = max 70 slots)
Slot ─< Enrollment (max 20 students)

Settings.pricing (singleton) ─ realtime ─> Customer pricing UI
AuditLog (append-only) — mọi thao tác tiền/role/refund
```

**Convention key (khớp `src/types/index.ts`)**:
| Lĩnh vực | Tên trường thực tế |
|---|---|
| `ProductType` | `"PASS" \| "PACKAGE" \| "SWIM_COURSE"` |
| `beneficiaryKind` | `"USER" \| "CHILD"` (USER = bản thân người mua) |
| `holderKind` (Membership) | `"USER" \| "CHILD"` |
| `studentKind` (Enrollment) | `"USER" \| "CHILD"` |
| Số lượt | `totalSessions` / `remainingSessions` |
| Số buổi học | `totalSessions` (=15) / `attendedSessions` |
| `SwimStyle` | `"BREASTSTROKE" \| "FREESTYLE" \| "BACKSTROKE" \| "BUTTERFLY"` |
| FCM tokens | `fcmTokens: string[]` (mảng đơn giản — v1) |
| Slot ID convention | `${coachId}_${weekday}_${startHour}` |
| Member code | Sinh tăng dần bắt đầu từ 100, qua counter `/counters/memberCode` |

**Bất biến dữ liệu**:
- `Order.productSnapshot` lưu **bản sao** giá tại thời điểm tạo đơn → đóng băng giá (INV-10).
- `Membership.endDate` = `startDate + PASS_DAYS[duration]` ngày.
- `TicketPackage.remainingSessions = totalSessions - sum(usageHistory.count)` (đảm bảo bằng transaction).
- `Enrollment.attendedSessions ≤ 15`, `expiryDate = startDate + 90 days`.

---

## 9. Phạm vi v1 vs Hoãn

### ✅ Trong v1 (must-have để launch)
- 5 vai trò + RBAC qua custom claim
- Bán & kích hoạt: vé thời hạn, gói lượt, khóa học
- Thẻ điện tử mô phỏng thẻ cứng
- QR check-in rotation 30s
- Báo cáo doanh thu realtime
- Pricing động (Owner sửa qua UI)
- CRUD HLV qua UI
- Phân quyền qua UI
- Hoàn tiền có lý do + audit log
- FCM Web Push (in-app + system, sau Add-to-Home-Screen)
- PWA installable
- Hoàn toàn tiếng Việt

### ⏸ Hoãn (post-launch, sau khi đủ 200 thành viên hoặc Owner yêu cầu)
| # | Tính năng | Lý do hoãn |
|---|---|---|
| H1 | Lịch nghỉ hồ (Tết/bảo trì) | v1 dùng "thông báo hàng loạt" thay |
| H2 | Giờ mở cửa cấu hình | Hiện tại cố định, ít đổi |
| H3 | Quên mật khẩu / đổi SĐT | Có thể nhờ Owner đổi role thay |
| H4 | Đánh giá HLV (1–5 sao) | Phát sinh drama; cần process kỷ luật trước |
| H5 | Biên lai in / hóa đơn VAT | Quy mô B2C nhỏ, chưa cần |
| H6 | Marketing (sinh nhật, giới thiệu bạn bè, voucher) | Mất focus, deferred Nhóm 4 |
| H7 | Cổng thanh toán online (VNPay/MoMo) | Cần ký hợp đồng + KYC doanh nghiệp |
| H8 | Audit log nâng cao UI | Dùng Firestore console là đủ cho v1 |
| H9 | Offline-first đầy đủ (không chỉ Firestore cache) | Hồ có wifi tốt, ưu tiên sau |
| H10 | Mobile native iOS/Android | PWA install đủ; chỉ làm khi App Store yêu cầu |
| H11 | Đa hồ bơi (multi-tenant) | Hiện chỉ 1 hồ, không scope SaaS |

---

## 10. Rủi ro & Đối phó

| Rủi ro | Tác động | Đối phó |
|---|---|---|
| Khách screenshot QR rồi share | Mất doanh thu | INV-8 rotation 30s + nonce single-use |
| SMS pumping / OTP abuse | Hóa đơn SMS phình | INV-13: SMS region policy + reCAPTCHA SMS defense + App Check |
| Race condition booking slot | 2 khách chiếm cùng 1 chỗ | INV-11: Firestore transaction trong `createOrder` |
| Owner đổi giá sai làm hoàn tiền hàng loạt | Doanh thu lỗi | INV-10: đóng băng giá + INV-12: audit log đầy đủ |
| Mất kết nối Firebase trong giờ cao điểm | Hồ tê liệt check-in | Cache Firestore + lễ tân ghi sổ tay backup + sync khi up lại |
| Khách iOS không nhận push | Ít engage | Hướng dẫn Add-to-Home-Screen trên `/profile` |
| Tablet cổng bị tắt | Không check-in được | Hướng dẫn "đừng tắt" + Lễ tân check hộ qua SĐT |
| Mất dữ liệu Firestore | Thảm họa | Bật `firestore:backups` daily + giữ 30 ngày |
| Coach quên báo nghỉ | HV đến hồ vô ích | Push cho HV khi confirmed; nếu báo muộn → notify từ HLV |

---

## 11. Tuân thủ pháp luật — Luật Bảo vệ Dữ liệu Cá nhân VN 2026 (PDPL)

**Cơ sở pháp lý**: Luật số 91/2025/QH15 (PDPL) + Nghị định 356/2025/NĐ-CP, có hiệu lực **01/01/2026**. App có người dùng VN → bắt buộc tuân thủ.

### 11.1 Phân loại dữ liệu thu thập
| Trường | Loại theo PDPL | Mục đích | Lưu trữ |
|---|---|---|---|
| Số điện thoại | **Cơ bản** | Xác thực + liên lạc | Firestore + Firebase Auth |
| Họ tên | Cơ bản | Hiển thị + xưng hô | Firestore |
| Chiều cao trẻ em | Cơ bản (PII của con + parent xử lý) | Phân nhóm audience tính giá | Firestore (subdoc `users/{uid}/children/{cid}`) |
| FCM token thiết bị | Cơ bản (technical) | Gửi push notification | Firestore |
| Lịch sử check-in | Cơ bản | Báo cáo cho khách + Owner | Firestore `/checkins` |
| Lịch sử giao dịch | Cơ bản | Kế toán + tranh chấp | Firestore `/orders`, `/payments` |

> **KHÔNG thu thập**: CMND/CCCD, email, địa chỉ nhà cụ thể, sinh trắc học, vị trí GPS. Nếu sau này cần → bắt buộc consent riêng.

### 11.2 Checklist tuân thủ
- [x] **Mục đích rõ ràng**: trang `/signin` hiển thị "Bằng việc đăng ký, bạn đồng ý chia sẻ SĐT và tên để chúng tôi tạo tài khoản và xử lý giao dịch."
- [ ] **Trang Chính sách quyền riêng tư** (`/privacy`) — liệt kê đầy đủ dữ liệu, mục đích, thời gian lưu, quyền của chủ thể dữ liệu. **Phải có trước launch**.
- [ ] **Quyền của chủ thể dữ liệu**:
  - Quyền truy cập: khách xem được dữ liệu của mình qua `/profile`.
  - Quyền chỉnh sửa: khách sửa được tên, chiều cao, hồ sơ con.
  - Quyền xóa: khách yêu cầu xóa → Owner xử lý qua callable `deleteAccount` (giữ giao dịch tài chính ẩn danh hóa, không xóa hẳn vì luật kế toán giữ 10 năm).
  - Quyền rút lại đồng ý: nút "Xóa tài khoản" trong `/profile`.
- [x] **Tối thiểu hóa dữ liệu**: chỉ thu trường thực sự cần.
- [x] **Bảo mật**: Firestore Security Rules + App Check + HTTPS bắt buộc.
- [ ] **Thông báo vi phạm**: trong vòng 72h kể từ khi phát hiện, báo Cục An ninh mạng. Owner cần liên hệ luật sư chuẩn bị template.
- [x] **Không chuyển dữ liệu xuyên biên giới tự do**: Firebase asia-southeast1 (Singapore). **Lưu ý**: Singapore là ngoài VN → đây là cross-border transfer. Cần đánh giá tác động (DPIA) — work-around: ghi rõ trong `/privacy` và thu thập consent rõ ràng.
- [x] **Quyền của trẻ em** (PARENT đại diện): mọi thao tác cho trẻ < 16 tuổi do tài khoản PARENT thực hiện, có consent của phụ huynh.
- [ ] **Đăng ký với Cục An ninh mạng** nếu xử lý dữ liệu của ≥ 10.000 chủ thể VN. **Quy mô hồ này 2–3k/năm → tạm dưới ngưỡng, nhưng theo dõi**.

### 11.3 Lưu trữ & xóa
- Dữ liệu khách hoạt động: lưu vô thời hạn trong khi tài khoản active.
- Khách yêu cầu xóa: ẩn danh hóa (hash SĐT, xóa tên) thay vì xóa hẳn (giữ ghi sổ kế toán).
- Audit log: giữ **vĩnh viễn** (yêu cầu của INV-12).
- FCM token: tự xóa khi 30 ngày không hoạt động.

---

## 12. Tiêu chí chấp nhận (Acceptance Criteria) — Definition of Done cho v1

App được coi là **sẵn sàng launch** khi tất cả các mục sau pass:

### 12.1 Chức năng
- [ ] Khách đăng ký mới + mua vé tháng + thanh toán + thấy thẻ + check-in thành công
- [ ] Khách mua gói lượt + check-in nhóm 3 người + thấy lượt giảm đúng
- [ ] Phụ huynh mua khóa học cho con + chọn HLV/ca + confirm PAID + lễ tân điểm danh hộ
- [ ] Owner đổi giá vé tháng người lớn từ 500k → 600k → khách mua mới thấy 600k, khách đã mua giữ 500k
- [ ] Lễ tân không vào được trang `/admin/reports` (báo lỗi quyền)
- [ ] Owner hoàn tiền 1 đơn + bắt buộc nhập lý do + thẻ khóa + audit log ghi đủ
- [ ] HLV thấy đúng học viên trong ca của mình, nhắn được Zalo
- [ ] Đơn PENDING quá 24h tự cancel (cron `cancelUnpaidOrdersHourly`)

### 12.2 Phi-chức-năng
- [ ] Lighthouse mobile ≥ 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] App Check bật cho cả 12 callable function
- [ ] SMS region policy chỉ cho phép +84
- [ ] Firestore backups daily bật, retention 30 ngày
- [ ] Tất cả callable function ghi tiền đều dùng transaction (verified bằng code review)
- [ ] Trang `/privacy` có nội dung đầy đủ theo §11

### 12.3 Vận hành
- [ ] Owner có account hoạt động + biết cách phân quyền
- [ ] Ít nhất 1 lễ tân được train + có account active
- [ ] 2 HLV (Tùng, Tín) có account COACH
- [ ] Tablet cổng cài + ghim `/admin/qr-gate` toàn màn hình
- [ ] Số test +84900000001–003 vẫn còn hoạt động để demo
- [ ] OWNER nắm được quy trình hoàn tiền + sửa giá + cấp role

---

## 13. Lịch sử thay đổi

| Phiên bản | Ngày | Người | Nội dung |
|---|---|---|---|
| 1.0 | 2026-06-14 | Claude + Owner | PRD ban đầu, sau khi đóng băng spec để code |
| **2.0** | **2026-06-16** | **Claude (Opus 4.7) + Deep Research** | **Viết lại theo best practices ngành + PDPL 2026. Thêm INV-11~14, §11 PDPL, §12 acceptance criteria, §10 risk matrix** |

---

## Tài liệu liên quan
- [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) — chi tiết kỹ thuật triển khai
- [`TASKS.md`](./TASKS.md) — task list theo trạng thái
- [`CHAT-HISTORY.md`](./CHAT-HISTORY.md) — timeline thiết kế + xây dựng
- `memory/pricing-matrix.md` — bảng giá chính thức (tham chiếu nhanh)
- `memory/build-environment.md` — quirks máy dev RAM thấp
- `../THIET-KE-TONG-HOP.md` — spec gốc đóng băng
- `../mockups/index.html` — 35 màn HTML tĩnh
