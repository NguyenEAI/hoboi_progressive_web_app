# Đợt 2+ — Các tính năng còn thiếu sau rà soát — 2026-07-17

## Đã làm

### Quầy bán vé/lớp: mua cho bố/mẹ hoặc bé

- Khi lễ tân tìm phụ huynh có con, app hiện mục “Mua cho ai?”.
- Có thể chọn bố/mẹ hoặc từng bé.
- Hóa đơn tạm hiển thị người nhận dịch vụ.
- Khi kích hoạt, app gửi đúng người nhận dịch vụ xuống phía sau.

Kiểm browser:

- Tìm phụ huynh test 0900000002.
- App hiện bố/mẹ và 2 bé: BÔn, bo.

### Gia hạn có lý do

- Thêm xử lý gia hạn phía sau cho:
  - Vé thời hạn: thêm ngày.
  - Vé lượt: thêm lượt.
  - Khóa học: thêm ngày và/hoặc thêm buổi.
- Bắt buộc nhập lý do.
- Lưu lịch sử gia hạn trên dịch vụ.
- Ghi lại thao tác trong lịch sử hệ thống.
- Màn điểm danh hộ có nút gia hạn cho vé thời hạn và khóa học.

Ghi chú: cần đưa phần phía sau mới lên server trước khi bấm thật trong browser.

### Màu thẻ người lớn/trẻ em + ảnh khách

- Thẻ người lớn dùng màu đậm/chững.
- Thẻ trẻ em dưới 1.4m dùng màu sáng/dễ thương.
- Thẻ trẻ em trên 1.4m dùng màu sáng khác để dễ phân biệt.
- Thẻ vẫn giữ chữ người lớn/trẻ em.
- Hồ sơ khách cho khách tự thêm/sửa ảnh bằng đường dẫn ảnh.
- Màn khách hàng cho lễ tân/owner thêm/sửa ảnh nếu khách đồng ý.
- Nếu chưa có ảnh, app vẫn hiển thị hình mặc định.

### Khuyến mãi / thông báo

- Thêm màn owner tạo thông báo/khuyến mãi.
- Có tiêu đề, nội dung, xem trước.
- Có nhóm nhận:
  - Gửi thử theo SĐT.
  - Tất cả khách.
  - Khách có vé lượt.
  - Khách có vé tháng/quý/năm.
  - Phụ huynh có bé.
  - Học viên khóa bơi.
- Mặc định dùng gửi thử theo SĐT để tránh gửi nhầm khách thật.

Ghi chú: cần đưa phần phía sau mới lên server trước khi gửi thật.

### QR xác nhận số lượt + xác nhận hộ có lý do

- Màn QR cổng cho lễ tân chọn số lượt khách cần xác nhận.
- Mã QR ghi số lượt đã chọn.
- Khi khách quét vé lượt, yêu cầu gửi lên lễ tân theo đúng số lượt đó.
- Điểm danh hộ vé lượt bắt buộc nhập lý do xác nhận hộ.

Ghi chú: cần đưa phần phía sau mới lên server trước khi test trọn luồng quét thật.

## Kiểm tra kỹ thuật đã chạy

- Kiểm tra kiểu toàn app: OK.
- Kiểm tra phía sau: OK.
- Dựng bản app mới: OK.
- Browser: đã xác nhận quầy bán hiện chọn bố/mẹ hoặc bé sau khi tìm phụ huynh test.

## Còn cần làm để chốt hoàn toàn

- Đưa các hàm phía sau mới lên server.
- Test thật trong browser:
  - Gia hạn thẻ/khóa với lý do.
  - Gửi thử khuyến mãi theo SĐT test.
  - QR chọn 3 lượt → khách quét → lễ tân duyệt.
  - Điểm danh hộ vé lượt thiếu lý do thì không cho trừ.
