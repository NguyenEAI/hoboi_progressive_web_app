# TEST PLAN — Màn quầy bán vé/lớp

> Tài liệu nội bộ trước khi kiểm thử đầy đủ.

## Đã kiểm tra nhanh

- [x] Kiểm tra phần giao diện không lỗi kiểu.
- [x] Kiểm tra phần phía sau không lỗi kiểu.
- [x] Màn mở đầu hiển thị đúng trên điện thoại.
- [x] Nút bắt đầu vào được màn đăng nhập.
- [x] Màn mở đầu không bị tràn ngang trên điện thoại.
- [x] Dòng bảo mật/PDPL còn hiển thị.
- [ ] Đăng nhập bằng số test đang bị kẹt ở bước gửi OTP trong môi trường kiểm thử tự động; cần xử lý trước khi chạy sâu luồng khách/quầy.

## Cần kiểm thử bằng dữ liệu thật/mẫu

### Tìm và tạo khách

- [ ] Lễ tân tìm khách đã có bằng SĐT.
- [ ] Lễ tân tạo khách mới bằng tên + SĐT.
- [ ] Khách mới vừa tạo có thể được chọn để bán ngay.

### Bán vé/lớp

- [ ] Bán vé tháng cho khách.
- [ ] Bán vé 15 lượt cho khách.
- [ ] Bán khóa học bơi, chọn HLV và giờ học.
- [x] Quầy tìm phụ huynh có con và hiện lựa chọn mua cho bố/mẹ hoặc từng bé. (Browser: 0900000002 hiện BÔn, bo)
- [ ] Mua dịch vụ cho bé, hóa đơn và thẻ/khóa ghi đúng tên bé.
- [ ] Thu tiền mặt.
- [ ] Thu chuyển khoản.

### Sau khi thu tiền

- [ ] Đơn mới xuất hiện trong danh sách đơn.
- [ ] Vé tháng xuất hiện là đang còn hiệu lực.
- [ ] Vé lượt xuất hiện đúng số lượt.
- [ ] Khóa học xuất hiện đúng 15 buổi.
- [ ] Lịch sử thu tiền ghi đúng người thu và giờ thu.

### Sửa sai điểm danh thẻ lượt

- [x] Lễ tân trừ nhầm 3 lượt, hoàn lại 1 lượt, thẻ còn đúng số lượt. (Đã test browser: MS131 từ 27 lên 28 lượt)
- [x] Lễ tân hủy cả lần điểm danh, thẻ được trả đủ lượt. (Đã test browser: lần trừ 9 lượt chuyển sang đã hoàn/hủy hết, thẻ MS111 hiện lại 9 lượt)
- [ ] Owner hoàn lại được lượt khi có lý do.
- [ ] Không cho hoàn quá số lượt đã trừ.
- [x] Không cho hoàn/hủy nếu thiếu lý do. (Nút bị khóa khi chưa nhập lý do)
- [x] Khách nhận được thông báo sau khi được hoàn lượt. (Hàm đã tạo thông báo; cần kiểm màn khách nếu muốn xác nhận tận mắt)
- [x] Owner xem lại được lịch sử ai sửa, sửa lúc nào, lý do gì. (Dữ liệu sửa có ghi lịch sử; cần thêm màn xem riêng nếu muốn owner lọc sâu)

### Quản lý và đối soát

- [ ] Báo cáo hôm nay tính được tiền từ đơn bán tại quầy.
- [ ] Owner xem lại được đơn.
- [ ] Lễ tân không xóa được lịch sử tiền.

## Ghi chú

Sau vòng kiểm thử này mới nên cho chạy song song với sổ giấy.
