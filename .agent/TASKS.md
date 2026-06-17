# Tasks — Hồ Bơi Prosper Plaza

## ✅ Đã hoàn thành

### Phase 1 — Thiết kế (đóng băng spec)
- [x] Phân tích nghiệp vụ, 10 quy tắc bất biến
- [x] ERD + Firestore collections
- [x] API + Cloud Functions design
- [x] Authentication & Authorization (5 vai trò)
- [x] UI/UX wireframe — `mockups/index.html` (35 màn HTML tĩnh)
- [x] Chốt bảng giá thật (3 đối tượng + 4 thời hạn + giá phẳng khóa học)

### Phase 2 — Code (Step 7)
- [x] Khởi tạo Next.js 15 + TypeScript + Tailwind + PWA
- [x] Brand: theme xanh lá + logo HT BẢO LÂM (base64)
- [x] Data model types (`src/types/`)
- [x] Constants + bảng giá fallback
- [x] Cloud Functions:
  - [x] `orders.ts` — createOrder, confirmPayment, cancelOrder, refundOrder
  - [x] `checkin.ts` — issueQrToken, checkinByQr, staffCheckinByPhone
  - [x] `schedules.ts` — 4 cron job
  - [x] `staff.ts` — setUserRole
  - [x] `admin.ts` — updatePricing, upsertCoach, setCoachActive, deleteOrder
- [x] Security Rules (Firestore + Storage)
- [x] Firestore indexes

### Phase 3 — UI hoàn chỉnh (22 trang)
**Public**: landing · signin (OTP 3 bước phone → otp → tên)
**Customer**: home · services (chọn người được hưởng) · services/course (wizard 5 bước) · cards (ví thẻ điện tử mặt trước + mặt sau ô lượt) · checkin (preview dịch vụ + chọn số người) · children · notifications · profile (sửa tên)
**Admin**: dashboard · orders (nhóm theo ngày + xóa) · qr-gate · checkin-assist · customers (thời gian đăng ký) · coaches (CRUD) · staff (gán quyền UI) · products (sửa giá) · reports (realtime)
**Coach**: today · students (nhắn Zalo)

### Phase 4 — Triển khai Firebase (Step 8)
- [x] Tạo project `hoboiapp` + upgrade Blaze
- [x] Bật Authentication Phone + SMS region VN
- [x] Tạo Firestore + Storage + Cloud Messaging
- [x] Deploy rules + indexes + 12 Cloud Functions
- [x] Seed data: 10 products, 2 HLV, 60 slots, pricing
- [x] Gán OWNER cho +84947010978

### Phase 5 — Sửa lỗi sau UAT lần 1
- [x] Sửa lỗi Trancy extension gây hydration mismatch
- [x] Tab Orders filter không hoạt động → thêm composite index (status, createdAt)
- [x] Không có form nhập tên sau OTP → thêm bước "name" trong signin
- [x] Services không cho chọn người được hưởng → thêm UI "Mua cho ai"
- [x] Không biết QR check-in quét gì → tạo `/admin/qr-gate` cho cổng + preview dịch vụ trên `/checkin`
- [x] Bug ghi đè role mỗi lần đăng nhập (`useAuthUser`) → chỉ tạo doc nếu chưa tồn tại
- [x] Owner không auto-redirect → thêm landingFor(role) trong signin
- [x] Phân quyền chỉ qua CLI → tạo `/admin/staff` + callable `setUserRole`

### Phase 6 — Sửa lỗi sau UAT lần 2 (vừa xong)
- [x] **Pricing động**: lưu `/settings/pricing`, Owner sửa qua UI → khách thấy ngay (realtime)
- [x] **CRUD HLV**: form thêm/sửa/khóa qua UI, tự tạo slots theo ngày dạy
- [x] Dashboard bỏ "Khách vào hồ", query realtime từ orders
- [x] Orders nhóm theo ngày + nút xóa cho đơn PENDING
- [x] Customers thêm cột "Đăng ký lúc" + relative time
- [x] Reports query trực tiếp orders PAID (không đợi cron đêm)

## 🟡 Đang thực hiện

- [ ] UAT — bạn đang test ở vai trò khách hàng + lễ tân
- [ ] Test luồng đăng ký khóa học → confirm → check-in → hoàn thành/hết hạn
- [ ] Test thêm/sửa HLV qua UI
- [ ] Test thay đổi giá → khách thấy đổi

## ⬜ Còn lại trước khi launch

- [ ] Test trang `/coach` với 1 tài khoản COACH (cần gán quyền qua `/admin/staff`)
- [ ] Test push notification thực tế (FCM Web Push)
- [ ] **Deploy lên Vercel** (production hosting)
  - Đẩy code lên GitHub
  - Import vào Vercel
  - Set env vars (NEXT_PUBLIC_FB_*)
  - KHÔNG đặt DISABLE_PWA/LOW_MEM trên CI
- [ ] Cài đặt thiết bị tablet ở cổng → mở `/admin/qr-gate` toàn màn hình
- [ ] Đào tạo nhân viên lễ tân + HLV

## ⏸️ Hoãn (Nhóm 3 trở lên — sau khi launch)

- [ ] Lịch nghỉ hồ (Tết/bảo trì) — tạm dùng "thông báo hàng loạt"
- [ ] Cấu hình giờ mở cửa
- [ ] Quên mật khẩu / đổi SĐT
- [ ] Đánh giá HLV (1-5 sao)
- [ ] Biên lai in / xuất hóa đơn VAT
- [ ] Marketing: sinh nhật, giới thiệu bạn bè, voucher
- [ ] Push notification khi tắt app (Service Worker FCM)
- [ ] Cổng thanh toán online (VNPay/MoMo)
- [ ] Audit log nâng cao UI
- [ ] Offline mode PWA
- [ ] Mobile native (iOS/Android) — hiện đã là PWA, có thể cài lên màn hình chính

## 🐛 Vấn đề kỹ thuật còn tồn tại (không chặn launch)

- **Máy dev RAM thấp** → cần cờ `DISABLE_PWA=1 LOW_MEM=1` khi build local; trên Vercel không cần
- **PATH Node chưa tự cập nhật** sau cài → mỗi PowerShell session cần refresh thủ công
- Dev server hay crash → ưu tiên `npm run start`

## 📁 Tài liệu liên quan
- `THIET-KE-TONG-HOP.md` — Spec đầy đủ (đóng băng trước khi code)
- `BUOC-8-FIREBASE.md` — Hướng dẫn deploy Firebase từng bước
- `README.md` — Setup + chạy
- `mockups/index.html` — Mockup HTML tĩnh 35 màn
- `memory/pricing-matrix.md` — Bảng giá lưu ở memory
- `memory/build-environment.md` — Lưu ý môi trường build máy này
