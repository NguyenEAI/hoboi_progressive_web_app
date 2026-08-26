# IMPLEMENTATION PLAN — App bán hàng + quản lý hồ bơi

> Tài liệu nội bộ. Bám hướng anh Nguyên đã chốt: dùng giao diện có sẵn làm nền, nâng cấp màn quầy sang xịn, đủ tính năng như app bán hàng kết hợp app quản lý.

## Quên mật khẩu bằng OTP + giữ phiên 15 ngày — 2026-08-26

- [x] Rà lại luồng SĐT + mật khẩu và luồng OTP đặt lại mật khẩu hiện có.
- [x] Xác nhận phía server chỉ đổi mật khẩu khi tài khoản vừa xác minh OTP có đúng SĐT cần đặt lại.
- [x] Bật lưu phiên lâu dài để đóng/mở lại app không phải đăng nhập lại.
- [x] Lưu mốc hoạt động theo từng tài khoản và tự đăng xuất khi không dùng quá 15 ngày.
- [x] Giới hạn ghi mốc hoạt động tối đa một lần/phút để tránh ghi bộ nhớ liên tục.
- [x] Thêm kiểm thử ranh giới 15 ngày, lưu/xóa mốc hoạt động và giới hạn tần suất ghi.
- [x] Kiểm tra lại màn đăng nhập/quên mật khẩu và toàn bộ bản app sau thay đổi.
- [x] Thử OTP thật với số được anh Nguyên đồng ý: nhận mã, đổi mật khẩu, vào app và đóng/mở lại vẫn giữ đăng nhập.

## Nâng cấp trải nghiệm HLV — 2026-07-31

- [x] Chỉ chỉnh khu vực `/coach` và tài liệu; không đụng data semantics, quyền điểm danh, QR/check-in, Owner pages, auth hoặc deploy.
- [x] Chốt HLV chỉ xem lịch sử điểm danh; không thêm quyền tự check-in, tự điểm danh hay đánh dấu vắng học viên.
- [x] Thiết kế lại `/coach` thành màn vận hành dày thông tin: KPI học viên, lịch hôm nay, ca kế tiếp, lối tắt tìm học viên và báo nghỉ ca.
- [x] Surface rõ các việc cần theo dõi: ca đã báo nghỉ, học viên vắng liên tiếp, khóa gần hết buổi hoặc gần hết hạn khi dữ liệu có sẵn.
- [x] Khi HLV báo nghỉ, app chỉ ghi nhận báo nghỉ và hiển thị nhắc nội bộ để lễ tân/Owner follow-up lịch bù; không tạo workflow đề xuất/sắp lịch bù.
- [x] Giữ workflow chi tiết học viên: xem tiến độ, lịch sử điểm danh chỉ xem, cảnh báo vắng liên tiếp, Zalo phụ huynh và thêm ghi chú append-only.
- [x] Cải thiện `/coach/students`: tìm kiếm rõ hơn, empty state tốt hơn, badge ưu tiên theo vắng/gần mốc, link từ dashboard mở thẳng bottom sheet học viên.
- [x] Kiểm tra typecheck và build sau khi chỉnh.

## Nâng cấp Dashboard và Báo cáo Owner — 2026-07-31

- [x] Chỉ chỉnh hai trang `/admin` và `/admin/reports`; không đụng QR/check-in, khách hàng, HLV, auth hoặc deploy.
- [x] Giữ nguyên hướng đọc dữ liệu realtime từ các collection hiện có: `orders`, `checkins`, `checkinRequests`.
- [x] Dashboard Owner hiển thị bức tranh điều hành trong ngày: doanh thu, đơn đã thu, khách unique, check-in, đơn/yêu cầu chờ xử lý.
- [x] Thêm so sánh hôm nay với hôm qua và tháng này với tháng trước bằng dữ liệu PAID thật.
- [x] Thêm cơ cấu dịch vụ, bảng chéo Loại × Đối tượng, lưu lượng theo giờ, giao dịch mới, cảnh báo vận hành và lối tắt hành động.
- [x] Reports Owner có chọn kỳ rõ ràng theo ngày/tháng/năm/tùy chỉnh, kỳ so sánh tự động, KPI đầu trang, biểu đồ xu hướng, cơ cấu dịch vụ, bảng chéo, top khách hàng và danh sách giao dịch.
- [x] CSV xuất theo danh sách giao dịch đang lọc; không tạo dữ liệu giả, kỳ trống có empty state rõ.
- [x] Giữ trạng thái Owner-only cho báo cáo tài chính; lễ tân không thấy tổng doanh thu theo INV-9.
- [x] Kiểm tra typecheck và build sau khi chỉnh UI.

## Hồ sơ khách hàng 360 cho Owner — 2026-07-31

- [x] Thêm lối mở hồ sơ 360 từ `/admin/customers` chỉ cho Owner; lễ tân vẫn chỉ có quyền sửa tên như cũ.
- [x] Tạo trang `/admin/customers/[uid]` hiển thị hồ sơ liên hệ, trẻ em, vé thời hạn, gói lượt, khóa học, đơn hàng, thanh toán, check-in, lịch sử điểm danh khóa học và audit gần đây.
- [x] Cho Owner sửa hồ sơ khách hàng qua callable riêng, bắt buộc nhập lý do và ghi audit có actor, thời điểm, before/after.
- [x] Cho Owner chỉnh các trạng thái/chi tiết dịch vụ mà model hiện có hỗ trợ: trạng thái, ngày kích hoạt/hết hạn, tổng lượt/lượt còn lại, tổng buổi/buổi đã học.
- [x] Mọi chỉnh sửa dịch vụ đều đi qua callable Owner-only, kiểm tra dịch vụ thuộc đúng khách, ghi `ownerAdjustmentHistory` trên dịch vụ và ghi audit append-only.
- [x] Giữ nguyên lịch sử đơn hàng, thanh toán, check-in và điểm danh; không thêm thao tác xóa lịch sử.
- [x] Không đụng QR/check-in logic, dashboard/báo cáo, màn HLV, auth routing hoặc cấu hình deploy.
- [x] Thêm kiểm thử nhỏ cho phần validate patch hồ sơ/dịch vụ và payload audit.

## Vòng kiểm thử bốn vai — 2026-07-31

- [x] Viết ma trận test Owner/lễ tân/khách hàng/HLV.
- [x] Tạo tài khoản test riêng cho khách, lễ tân và HLV.
- [x] Đổi test đăng nhập từ OTP cũ sang SĐT + mật khẩu.
- [x] Bổ sung test điều hướng và chặn quyền theo vai.
- [x] Bổ sung test thẻ khóa học, tên người dùng thẻ và ảnh vé thời hạn.
- [x] Chạy test tự động: 15 đạt, 1 bỏ qua hợp lệ, 0 lỗi.
- [x] Dùng built-in browser kiểm trực tiếp đủ bốn vai trên bản đang phục vụ khách.
- [x] Đối chiếu các yêu cầu trong ảnh: cả bốn mục đã có.

## Bản nháp giao diện

- [x] Xem các màn sẵn có trong repo.
- [x] Xác định màn quan trọng nhất: quầy bán vé/lớp.
- [x] Tạo bản nháp giao diện màn quầy bán vé/lớp.
- [x] Chụp ảnh bản nháp để anh Nguyên xem.
- [x] Anh Nguyên duyệt hướng giao diện.
- [x] Khóa vibe giao diện vào tài liệu thiết kế.

## Phần bán hàng tại quầy

- [x] Tạo màn quầy bán vé/lớp trong khu lễ tân.
- [x] Làm ô tìm khách bằng SĐT thật nhanh.
- [x] Làm tạo khách nhanh tại quầy.
- [ ] Hiển thị vé tháng/vé lượt/khóa học đang còn của khách.
- [x] Làm chọn vé tháng/quý/năm.
- [x] Làm chọn vé 15/30 lượt.
- [x] Làm chọn khóa học bơi 15 buổi.
- [x] Làm hóa đơn tạm bên phải.
- [x] Làm chọn tiền mặt/chuyển khoản.
- [x] Bấm đã thu tiền thì kích hoạt dịch vụ ngay.
- [x] Hiển thị kết quả sau khi kích hoạt.

## Phần quản lý sau bán

- [ ] Danh sách đơn hôm nay.
- [ ] Lọc đơn theo ngày/trạng thái.
- [ ] Xem chi tiết đơn.
- [ ] Hủy đơn chưa thu tiền.
- [ ] Hoàn tiền/điều chỉnh có lý do.
- [ ] Lưu lịch sử ai thao tác, thao tác lúc nào.

## Phần quản lý khách

- [ ] Danh sách khách.
- [ ] Tìm khách bằng SĐT/tên.
- [ ] Sửa tên/SĐT khi nhập sai.
- [ ] Thêm trẻ em vào phụ huynh.
- [ ] Xem toàn bộ vé/lượt/khóa của khách.

## Phần check-in

- [ ] Tìm khách bằng SĐT/mã thẻ.
- [ ] Vé tháng: xác nhận còn hạn.
- [x] Vé lượt: chọn số người trên màn QR cổng và trừ lượt bằng token VISIT.
- [x] Khóa học: có màn QR điểm danh riêng, token COURSE chỉ dùng cho khóa học.
- [x] Chặn dùng nhầm QR khóa học để trừ vé lượt/vé thời hạn và chặn QR cổng dùng để điểm danh khóa học.
- [x] Tránh điểm danh trùng khóa học trong cùng ngày học.
- [x] Lưu lịch sử check-in.

## Phần khóa học và HLV

- [ ] HLV xem danh sách học viên.
- [ ] Xem số buổi đã học/còn lại.
- [ ] Ghi chú học viên.
- [ ] Báo nghỉ ca nếu cần.
- [ ] Hết 15 buổi thì hoàn thành.
- [ ] Quá hạn thì báo hết hạn.

## Phần báo cáo/cuối ngày

- [ ] Hôm nay thu bao nhiêu.
- [ ] Số đơn hôm nay.
- [ ] Thu theo vé tháng/vé lượt/khóa học.
- [ ] Lọc theo ngày/tháng.
- [ ] Xem ai thu tiền.
- [ ] Xuất file nếu cần.

## Phần cấu hình

- [ ] Owner sửa giá vé tháng/quý/năm.
- [ ] Owner sửa giá vé 15/30 lượt.
- [ ] Owner sửa giá khóa học.
- [ ] Quản lý nhân viên/HLV.
- [ ] Phân quyền rõ cho Owner/lễ tân/HLV.

## Kiểm tra sau khi sửa

- [ ] Tạo khách mới tại quầy.
- [ ] Tìm khách cũ bằng SĐT.
- [ ] Bán vé tháng.
- [ ] Bán vé 15 lượt.
- [ ] Bán khóa học bơi.
- [ ] Thu tiền xong dịch vụ dùng được ngay.
- [ ] Check-in bằng vé tháng.
- [x] Check-in bằng vé lượt.
- [x] Điểm danh khóa học bằng QR riêng.
- [ ] Cuối ngày xem tổng tiền đúng.
- [ ] Lễ tân không xóa được lịch sử tiền.
- [ ] Owner xem lại được giao dịch.
