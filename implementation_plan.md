# IMPLEMENTATION PLAN — App bán hàng + quản lý hồ bơi

> Tài liệu nội bộ. Bám hướng anh Nguyên đã chốt: dùng giao diện có sẵn làm nền, nâng cấp màn quầy sang xịn, đủ tính năng như app bán hàng kết hợp app quản lý.

## Bản nháp giao diện

- [x] Xem các màn sẵn có trong repo.
- [x] Xác định màn quan trọng nhất: quầy bán vé/lớp.
- [x] Tạo bản nháp giao diện màn quầy bán vé/lớp.
- [x] Chụp ảnh bản nháp để anh Nguyên xem.
- [x] Anh Nguyên duyệt hướng giao diện.
- [x] Khóa vibe giao diện vào tài liệu thiết kế.

## Phần bán hàng tại quầy

- [ ] Tạo màn quầy bán vé/lớp trong khu lễ tân.
- [ ] Làm ô tìm khách bằng SĐT thật nhanh.
- [ ] Làm tạo khách nhanh tại quầy.
- [ ] Hiển thị vé tháng/vé lượt/khóa học đang còn của khách.
- [ ] Làm chọn vé tháng/quý/năm.
- [ ] Làm chọn vé 15/30 lượt.
- [ ] Làm chọn khóa học bơi 15 buổi.
- [ ] Làm hóa đơn tạm bên phải.
- [ ] Làm chọn tiền mặt/chuyển khoản.
- [ ] Bấm đã thu tiền thì kích hoạt dịch vụ ngay.
- [ ] Hiển thị kết quả sau khi kích hoạt.

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
- [ ] Vé lượt: chọn số người và trừ lượt.
- [ ] Khóa học: điểm danh buổi học.
- [ ] Lưu lịch sử check-in.

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
- [ ] Check-in bằng vé lượt.
- [ ] Điểm danh khóa học.
- [ ] Cuối ngày xem tổng tiền đúng.
- [ ] Lễ tân không xóa được lịch sử tiền.
- [ ] Owner xem lại được giao dịch.
