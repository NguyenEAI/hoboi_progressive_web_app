# Kiểm thử thật các tính năng mới — 2026-07-17

## Đã đưa phần phía sau lên server

- Gia hạn có lý do.
- Gửi khuyến mãi/thông báo.
- QR có số lượt lễ tân chọn trước.
- Điểm danh hộ vé lượt bắt buộc lý do.

## Kết quả browser

### Quầy bán vé/lớp mua cho con

- Đăng nhập lễ tân test.
- Mở quầy bán vé/lớp.
- Tìm phụ huynh test 0900000002.
- Kết quả: app hiện mục “Mua cho ai?” gồm:
  - Bố/mẹ: Dụng cụ chuyên bơi.
  - Con: BÔn.
  - Con: bo.
- Hóa đơn tạm hiển thị “Mua cho” đúng người đang chọn.

Trạng thái: **OK giao diện/luồng chọn người nhận**.

### Điểm danh hộ / gia hạn

- Đăng nhập lễ tân test.
- Mở điểm danh hộ.
- Tìm phụ huynh test 0900000002.
- Kết quả:
  - Vé lượt hiện ô “Lý do xác nhận hộ (bắt buộc)”.
  - Khi chưa nhập lý do, nút “Trừ 1 lượt” bị khóa.
  - Vé thời hạn có nút “Gia hạn”.
  - Khóa học có nút “Gia hạn”.
  - Cửa gia hạn bắt buộc nhập ngày/buổi và lý do; nút lưu bị khóa khi thiếu.

Trạng thái: **OK giao diện và ràng buộc bắt buộc lý do**.

Ghi chú: chưa bấm gia hạn thật để tránh kéo dài dữ liệu test quá nhiều khi không cần.

### QR xác nhận số lượt

- Mở màn QR cổng.
- Kết quả:
  - Có phần “Số lượt khách cần xác nhận”.
  - Có nút tăng/giảm số lượt.
  - Có nút tạo lại mã với số lượt đã chọn.
  - Phần phía sau đã nhận `requestedCount` trong mã QR.

Trạng thái: **OK màn QR và phần phía sau**.

### Khuyến mãi / thông báo

- Đăng nhập owner test 0947010978.
- Mở màn khuyến mãi/thông báo.
- Chọn mặc định “Gửi thử theo SĐT”.
- SĐT test: 0900000002.
- Nội dung test: “Test khuyến mãi nội bộ”.
- Kết quả: app báo “Đã gửi 1 thông báo.”

Trạng thái: **OK gửi thử, không gửi rộng**.

## Ghi chú lỗi đã xử lý trong lúc test

- Ban đầu màn khuyến mãi chưa vào đúng đường dẫn, đã tạo lại đúng màn quản trị.
- Ban đầu gửi khuyến mãi báo lỗi nội bộ do thiếu mã owner trong lịch sử, đã sửa và đưa lại lên server.
- Ban đầu màn QR chưa hiện chọn số lượt, đã sửa lại và đưa phần QR lên server.

## Kết luận

Các tính năng mới đã có trong app, phần phía sau đã lên server, và các luồng chính đã kiểm bằng browser với dữ liệu test.
