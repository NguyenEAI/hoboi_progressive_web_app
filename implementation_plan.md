# Redesign UI/UX - Hồ Bơi Prosper Plaza (HT Bảo Lâm)

Dưới đây là kế hoạch chi tiết để thiết kế lại toàn bộ giao diện (UI) và trải nghiệm người dùng (UX) của ứng dụng quản lý hồ bơi, đảm bảo sự chuyên nghiệp, mượt mà, cao cấp, đồng thời giữ vững tone màu chủ đạo xanh lá cây - trắng theo đúng yêu cầu.

---

## Nguyên tắc Thiết kế & Trải nghiệm Người dùng (UX/UI Principles)

1. **Bảng màu cao cấp (Curated Color Palette):**
   - Thay thế các màu xanh mặc định bằng hệ màu Emerald/Jade sâu sắc, tạo cảm giác sang trọng của câu lạc bộ bơi lội/thể thao phong cách sống.
   - Sử dụng các mã HSL/Hex tinh tế: màu xanh chủ đạo đậm đà tinh xảo, màu trắng và slate nhẹ mát làm nền, tránh nền xanh lá cây quá sáng gây mỏi mắt.
   - Thêm các điểm nhấn màu ngọc lục bảo (Emerald) và mòng két (Teal) để tạo chiều sâu cho dòng nước.
2. **Hiệu ứng Glassmorphism & Khối nổi (Premium Cards & Glassmorphism):**
   - Tận dụng `backdrop-filter` mượt mà cho các menu điều hướng, hộp thoại, và nút nhấn.
   - Đường viền thẻ siêu mỏng (`border-white/20` hoặc `border-brand-500/10`) kết hợp đổ bóng kép giúp các phần tử trông nổi bật, sắc nét.
3. **Chuyển động mượt mà (Micro-interactions & Animations):**
   - Hiệu ứng chạm thực tế (tactile feedback) cho mọi nút bấm (`active:scale-97`).
   - Hiệu ứng quét sáng (shimmer/sheen) trên các nút bấm chính và thẻ hội viên để tăng phần cao cấp.
   - Nút check-in trung tâm có hiệu ứng sóng xung mạch (pulsing halo) xanh lá dịu mắt, khuyến khích tương tác.
4. **Trình bày thẻ số hóa (Digital Wallet Passes):**
   - Thẻ thành viên (`MembershipCard`) được thiết kế lại giả lập thẻ ví điện tử (Apple Wallet) có độ chuyển màu mượt, có vân sóng nước nghệ thuật chìm dưới nền, mã số định danh rõ ràng.
   - Thẻ lượt (`PackageCard`) phân tách rõ nét giữa mặt trước thông tin và mặt sau lịch sử dùng lượt (dưới dạng các ô tích điểm được thiết kế gọn gàng, trực quan).

---

## Chi tiết các thay đổi đề xuất

### 1. Nền tảng thiết kế & Cấu hình

#### [MODIFY] [globals.css](file:///d:/Hoboi_version2/src/app/globals.css)
- Tinh chỉnh các biến CSS màu sắc thương hiệu (`--brand-*`):
  - `--brand-500`: `#059669` (Xanh ngọc lục bảo Emerald tươi mát, chuyên nghiệp)
  - `--brand-600`: `#047857` (Xanh ngọc sẫm hơn cho văn bản và viền)
  - `--brand-700`: `#065f46` (Xanh đậm sâu sắc)
  - `--brand-800`: `#064e3b` (Xanh rừng già sang trọng)
  - `--brand-900`: `#022c22` (Xanh đen hoàng gia dùng làm nền Sidebar Admin và Header)
- Cải thiện chất lượng hiển thị font chữ hệ thống trên iOS và Android.
- Tối ưu hóa hiệu ứng của lớp kính `.card-glass`, tăng độ mượt mà khi cuộn.
- Thêm hiệu ứng `.glow-pulse` mềm mại cho cổng check-in QR.
- Thêm transition cho tất cả trạng thái hover/focus của input, select.

---

### 2. Giao diện Phân hệ Khách hàng (Customer UI Redesign)

#### [MODIFY] [page.tsx](file:///d:/Hoboi_version2/src/app/page.tsx) (Landing Page)
- Thiết kế lại phần Hero Banner: Tăng cường độ mờ nhòe của các orb màu bơi lội, tạo chuyển động trôi chậm (`aurora-drift`).
- Thay thế các biểu tượng dịch vụ và bảng giá vé lẻ bằng thiết kế lưới sang trọng, có viền phát sáng mỏng khi di chuột (hover).
- Thêm nút kêu gọi hành động (CTA) "Bắt đầu ngay" lớn hơn, nổi bật hơn với hiệu ứng ánh sáng lướt qua (shimmer sheen).

#### [MODIFY] [signin/page.tsx](file:///d:/Hoboi_version2/src/app/%28public%29/signin/page.tsx) (Trang Đăng Nhập OTP)
- Tạo bố cục đăng nhập hiện đại với các ô nhập số điện thoại và OTP bo góc tròn sang trọng.
- Hiển thị thanh tiến trình 3 bước sắc nét và trực quan hơn.
- Thiết kế riêng phần nhập mã OTP 6 số với khoảng cách ký tự rộng, font chữ đậm nét và phản hồi tập trung (focus border) cao cấp.

#### [MODIFY] [home/page.tsx](file:///d:/Hoboi_version2/src/app/%28customer%29/home/page.tsx) (Trang chủ Khách hàng)
- Nâng cấp phần chào mừng đầu trang với hiệu ứng kính mờ chồng lên nền gradient nước biển.
- Redesign các phím tắt nhanh (Shortcut): Thay thế giao diện đơn điệu bằng các khối hình học bo góc mềm mại, kết hợp độ tương phản màu tốt để dễ bấm trên thiết bị di động.
- Cải tiến thanh tiến độ khóa học / số buổi đã học dùng gradient màu mượt mà.

#### [MODIFY] [profile/page.tsx](file:///d:/Hoboi_version2/src/app/%28customer%29/profile/page.tsx) (Hồ sơ cá nhân)
- Làm mới danh sách điều hướng cài đặt: Thay thế viền mỏng bằng các khối hộp tách biệt, khoảng cách thoáng đãng, icon màu xanh ngọc đồng bộ.
- Thiết kế lại giao diện hướng dẫn cài đặt PWA trên iOS cho bắt mắt, dễ hiểu hơn đối với người dùng không chuyên kỹ thuật.

---

### 3. Thành phần dùng chung (Shared Components Redesign)

#### [MODIFY] [BottomNav.tsx](file:///d:/Hoboi_version2/src/components/BottomNav.tsx) (Thanh điều hướng dưới)
- Tăng cường hiệu ứng kính mờ (`backdrop-blur-md`) cho thanh điều hướng di động.
- Tinh chỉnh nút Quét QR check-in chính giữa: Bổ sung viền gradient lấp lánh và hiệu ứng vòng tròn sóng lan tỏa (`nav-halo`) mượt mà, chuyên nghiệp hơn.

#### [MODIFY] [MemberCard.tsx](file:///d:/Hoboi_version2/src/components/MemberCard.tsx) (Thẻ Thành Viên & Thẻ Lượt)
- **MembershipCard:** Cải thiện thiết kế thẻ thời hạn với các họa tiết sóng trừu tượng màu vàng gold/emerald chìm, căn chỉnh chữ họ tên và mã số hội viên theo phong cách thẻ VIP tối giản.
- **PackageCard:** Nâng cấp lưới ô đánh dấu lượt sử dụng ở mặt sau: Mỗi ô lượt đã dùng sẽ có hiệu ứng gradient hổ phách và dấu check nhỏ, các ô chưa dùng có viền nét đứt thanh lịch.

#### [MODIFY] [Toast.tsx](file:///d:/Hoboi_version2/src/components/Toast.tsx) (Thông báo nổi)
- Thiết kế các thông báo toast nhỏ gọn hơn ở phía trên cùng màn hình, bo góc nhiều hơn và có đổ bóng mịn, màu sắc thông báo thành công hoặc lỗi được chọn từ bộ màu dịu nhẹ nhưng rõ ràng.

---

### 4. Giao diện Phân hệ Quản trị (Admin UI Redesign)

#### [MODIFY] [admin/page.tsx](file:///d:/Hoboi_version2/src/app/%28staff%29/admin/page.tsx) (Admin Dashboard)
- Tối ưu hóa các thẻ chỉ số KPI: Đường viền thẻ sắc nét hơn, font số to và rõ, có nhãn thể hiện biến động tăng/giảm xanh/đỏ chuyên nghiệp.
- Redesign biểu đồ lưu lượng theo giờ (HourBars): Thay thế cột thô cứng bằng cột bo góc tròn ở đỉnh (rounded-t-md) và hiệu ứng chuyển màu gradient ngọc lục bảo mượt.
- Cải thiện bảng chéo Doanh thu Loại × Đối tượng: Sử dụng màu xen kẽ giữa các dòng, tăng padding giúp số liệu tài chính dễ đọc, dễ kiểm tra.

#### [MODIFY] [AdminSidebar.tsx](file:///d:/Hoboi_version2/src/components/AdminSidebar.tsx) (Thanh bên Admin)
- Nâng cấp độ tương phản và chiều sâu của sidebar với màu xanh lục bảo cực tối (`#022c22`).
- Làm nổi bật mục menu đang được chọn bằng viền phát sáng nhẹ ở cạnh bên và màu nền xanh lá êm dịu.

---

## Kế hoạch Xác minh (Verification Plan)

### Kiểm tra tự động
- Đảm bảo dự án xây dựng (build) thành công không có lỗi TypeScript:
  ```powershell
  npm run build
  ```
- Đảm bảo dự án vượt qua kiểm tra kiểm lỗi tĩnh:
  ```powershell
  npm run lint
  ```

### Kiểm tra thủ công (Manual Verification)
- Sử dụng tính năng xem trước giao diện trên chế độ giả lập thiết bị di động (Mobile Emulator) của trình duyệt.
- Xác thực độ mượt của các tương tác bấm nút, các hiệu ứng shimmer, và hiệu ứng lướt trên thanh BottomNav.
- Đảm bảo độ tương phản của chữ trên tất cả các nền thẻ xanh/vàng/trắng đạt tiêu chuẩn dễ đọc.
- Kiểm tra tính tương thích của bố cục (layout) trên cả màn hình nhỏ (iPhone SE) và màn hình lớn.
