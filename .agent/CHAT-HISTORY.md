# Chat History Summary — Hồ Bơi Prosper Plaza

> Tóm tắt toàn bộ cuộc trò chuyện thiết kế + xây dựng dự án (Vietnamese).

## Mốc thời gian chính

### 🎨 Thiết kế (Step 1 → 6)
1. **Khởi đầu** — User yêu cầu hệ thống quản lý hồ bơi PWA, cung cấp spec ban đầu (5 vai trò, sản phẩm, quy tắc HLV cố định Tùng/Tín)
2. **Phân tích nghiệp vụ** — Xác định 10 invariants (INV-1 đến INV-10) làm xương sống thiết kế
3. **ERD + Firestore + API + Auth design** — Định nghĩa data model, security rules, callable functions
4. **Mockup HTML** — Tạo `mockups/index.html` với 35 màn (mobile/tablet/desktop), iteration nhiều lần:
   - Đổi tên "Hồ Bơi Tân Phú" → "Prosper Plaza" + địa chỉ Phan Văn Hớn
   - Tone màu: cyan → xanh lá (theo user yêu cầu)
   - Logo HT BẢO LÂM (cá mập cyan) — nhúng base64 sau khi user lưu file PNG
   - Bỏ chức năng bán vé lẻ qua app (giữ chỉ bảng giá tham khảo, vé lẻ bán tại quầy)
5. **Iteration nhiều vòng** về:
   - Thẻ điện tử mô phỏng thẻ cứng (mặt trước + mặt sau ô lượt)
   - Quy tắc thẻ tháng/quý/năm cá nhân vs gói lượt chia sẻ được
   - Gói lượt người lớn dùng được mọi đối tượng, gói trẻ em chỉ trẻ em
   - HLV: bỏ điểm danh, thêm Zalo, báo nghỉ, cảnh báo vắng nhiều
   - Khóa học: 4 kiểu bơi cùng giá phẳng 1.800.000₫ (không phân biệt đối tượng), không cấp chứng nhận, không ưu đãi khóa mới
   - Hoàn thành/hết hạn khóa → giải phóng slot ngay (first-come)

### 💻 Code (Step 7)
6. **Scaffold dự án** — Phát hiện thư mục `D:\Hoboi_version2` đã có sẵn scaffold cũ (theme cyan, 2-tier audience). Hợp nhất theo spec mới (3-tier, theme xanh lá).
7. **Cài Node.js** — Máy chưa cài, cài qua winget (Node v24.16.0 LTS)
8. **Xử lý lỗi build**:
   - Xung đột React 19 ↔ Next 15.0.3 → nâng Next lên 15.5.19 (bản đã vá CVE)
   - OOM build (máy ~1.5-2.5GB RAM trống) → thêm cờ `DISABLE_PWA=1` + `LOW_MEM=1` + `webpackMemoryOptimizations` + heap 3GB
   - Auth invalid-api-key prerender → tạo `.env.local` placeholder
9. **Đặt nền tảng** — Types, constants, utils, Firebase client, security rules
10. **Cloud Functions** — orders, checkin, schedules
11. **UI Customer** — 8 trang (landing, signin, home, services, course wizard, cards, checkin, children, profile, notifications)
12. **UI Admin** — 7 trang ban đầu (dashboard, orders, products read-only, customers, coaches read-only, reports, qr-gate, checkin-assist, staff)
13. **UI Coach** — 2 trang (today, students)

### 🚀 Triển khai Firebase (Step 8)
14. **Tạo project `hoboiapp`** — User cung cấp config, đối chiếu khớp `.env.local`
15. **Nâng Blaze + bật Phone Auth + Firestore + Storage + FCM**
16. **Deploy CLI** — Firebase login (`stanfordpines257@gmail.com`), deploy rules + indexes + 11 functions
17. **Xử lý lỗi**: `onUserCreate` (1st gen auth trigger) fail → chuyển logic tạo user doc sang client (`useAuthUser` self-create)
18. **Seed data**: products, pricing, 2 HLV, 60 ca/tuần, counter MS thẻ
19. **Gán OWNER** cho +84947010978

### 🐛 UAT Round 1 (vấn đề user báo cáo)
- **Trancy extension** chèn `trancy-version` vào `<html>` → hydration mismatch → fix bằng `suppressHydrationWarning`
- **SMS region** chưa bật VN → user bật + tạo số test cố định
- **Login owner nhưng vẫn vào home khách** → tìm bug: `useAuthUser` ghi đè `role: "CUSTOMER"` mỗi lần đăng nhập → fix bằng `getDoc` check trước
- **Tab Orders filter không hoạt động** → thiếu composite index `(status, createdAt)` → deploy index
- **Khách không nhập tên** → thêm bước "name" sau OTP
- **Mua thẻ không chọn được người được hưởng** → thêm UI "Mua cho ai" trên `/services`
- **Không biết QR check-in quét cái gì** → tạo `/admin/qr-gate` cho tablet cổng + preview dịch vụ trên `/checkin`
- **Phân quyền chỉ qua CLI** → tạo callable `setUserRole` + trang `/admin/staff`
- **Auto-redirect theo role** sau đăng nhập

### 🔧 UAT Round 2 (vừa thực hiện)
User báo 5 vấn đề lớn → fix toàn bộ:
- **Pricing động** — lưu `/settings/pricing`, Owner sửa UI → khách thấy ngay (realtime listener). Backend `createOrder` đọc giá từ Firestore.
- **CRUD HLV** — callable `upsertCoach`, `setCoachActive` + UI form (tự tạo 10 ca/ngày dạy, bảo vệ không xóa ca có HV)
- **Dashboard** — bỏ "Khách vào hồ", query realtime từ orders
- **Orders** — nhóm theo ngày + nút xóa cho đơn PENDING
- **Customers** — thêm cột "Đăng ký lúc" + relative time
- **Reports** — query trực tiếp orders PAID (không đợi cron đêm)

## Quyết định nghiệp vụ quan trọng đã chốt

| Câu hỏi | Quyết định |
|---|---|
| Vé lẻ có vào hệ thống? | KHÔNG — bán tại quầy, chỉ hiển thị bảng giá tham khảo |
| Tone màu? | Xanh lá (#16a34a) |
| Logo? | HT BẢO LÂM cá mập cyan (nhúng base64) |
| Thẻ tháng/quý/năm — chia sẻ được? | KHÔNG, chỉ cá nhân |
| Gói lượt trẻ em — người lớn dùng có phụ thu? | KHÔNG phụ thu, phải mua vé lẻ |
| Khóa học có 4 kiểu — điều kiện tiên quyết? | KHÔNG, ai cũng đăng ký được |
| Cấp chứng nhận hoàn thành? | KHÔNG |
| Ưu đãi khóa tiếp theo? | KHÔNG |
| Giữ slot ưu tiên cho HV cũ? | KHÔNG, giải phóng ngay (first-come) |
| Khóa học giá theo đối tượng? | KHÔNG — giá phẳng 1.800k cho mọi đối tượng/kiểu bơi |
| Vé thời hạn có mốc 6 tháng? | CÓ (4 mốc: 1/3/6/12 tháng) |
| Đơn chưa thanh toán giữ slot bao lâu? | 24 giờ |
| QR cổng đổi mỗi bao lâu? | 30 giây |
| Hoàn tiền? | Chỉ Owner, bắt buộc lý do, khóa thẻ, audit log |
| Gia hạn thẻ thủ công? | Owner chọn từ gói có sẵn |

## Trạng thái cuối phiên này

- **App đang LIVE** tại http://localhost:3000 (production server `npm run start`)
- **Firebase deployed đầy đủ**: rules, indexes, 12 functions, 10 products, 2 HLV, 60 ca, pricing
- **OWNER**: +84947010978
- **Build verified**: 22 trang generated, typecheck sạch
- **User đang test**: vai trò khách hàng + lễ tân (vừa được hướng dẫn dùng số test +84900000001 / +84900000002)

## Hồ sơ dự án còn lại trước launch

1. UAT hoàn tất các kịch bản (khách, lễ tân, HLV)
2. Test push notification thực tế
3. Deploy lên Vercel production
4. Cài tablet ở cổng cho QR check-in
5. Đào tạo nhân viên
