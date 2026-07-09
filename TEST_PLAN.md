# TEST PLAN — Màn quầy bán vé/lớp

> Tài liệu nội bộ trước khi kiểm thử đầy đủ.

## Đã kiểm tra nhanh

- [x] Kiểm tra phần giao diện không lỗi kiểu.
- [x] Kiểm tra phần phía sau không lỗi kiểu.

## Cần kiểm thử bằng dữ liệu thật/mẫu

### Tìm và tạo khách

- [ ] Lễ tân tìm khách đã có bằng SĐT.
- [ ] Lễ tân tạo khách mới bằng tên + SĐT.
- [ ] Khách mới vừa tạo có thể được chọn để bán ngay.

### Bán vé/lớp

- [ ] Bán vé tháng cho khách.
- [ ] Bán vé 15 lượt cho khách.
- [ ] Bán khóa học bơi, chọn HLV và giờ học.
- [ ] Thu tiền mặt.
- [ ] Thu chuyển khoản.

### Sau khi thu tiền

- [ ] Đơn mới xuất hiện trong danh sách đơn.
- [ ] Vé tháng xuất hiện là đang còn hiệu lực.
- [ ] Vé lượt xuất hiện đúng số lượt.
- [ ] Khóa học xuất hiện đúng 15 buổi.
- [ ] Lịch sử thu tiền ghi đúng người thu và giờ thu.

### Quản lý và đối soát

- [ ] Báo cáo hôm nay tính được tiền từ đơn bán tại quầy.
- [ ] Owner xem lại được đơn.
- [ ] Lễ tân không xóa được lịch sử tiền.

## Ghi chú

Sau vòng kiểm thử này mới nên cho chạy song song với sổ giấy.
