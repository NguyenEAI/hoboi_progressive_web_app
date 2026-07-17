# Kiểm tra nhóm tính năng mới — 2026-07-17

## Tài khoản test

- Lễ tân: 0900000003.
- Phụ huynh/khách: 0900000002.

## Kết quả từng tính năng

### 1. Hoàn lượt khi điểm danh sai

Trạng thái: **OK**.

Đã test bằng browser built-in:

- Lễ tân vào được màn điểm danh hộ.
- Tìm được phụ huynh test 0900000002.
- Thấy khu “Sửa sai điểm danh vé lượt”.
- Chưa nhập lý do thì nút hoàn/hủy bị khóa.
- Nhập lý do rồi hoàn 1 lượt: thẻ MS131 từ 27 lên 28 lượt, dòng chuyển sang “đã hoàn một phần”.
- Hủy cả lần: dòng trừ 9 lượt chuyển sang “đã hoàn/hủy hết”, thẻ MS111 hiện lại 9/15 lượt.

Còn nên test thêm:

- Vai owner tự làm hoàn lượt.
- Cố hoàn quá số lượt đã trừ để chắc chắn bị chặn.

### 2. Lễ tân mua dịch vụ hộ cho con

Trạng thái: **Chưa đạt yêu cầu mới**.

Đã test bằng browser:

- Lễ tân tìm SĐT 0900000002 ra phụ huynh có 2 con.
- App chỉ hiện “Khách đang chọn” là bố/mẹ.
- Chưa có danh sách chọn bé để mua dịch vụ cho con.
- Các nút bán vé/lớp vẫn ghi theo giá người lớn.

Kết luận: cần làm đợt 2.

### 3. Gia hạn khóa học/thẻ thời hạn có lý do

Trạng thái: **Chưa thấy tính năng để test**.

Đã kiểm tra code/UI:

- Chưa thấy nút/màn gia hạn.
- Chưa thấy xử lý gia hạn có lý do.

Kết luận: cần làm đợt 3.

### 4. Màu thẻ người lớn/trẻ em khác nhau

Trạng thái: **Có nhãn người lớn/trẻ em, nhưng chưa đạt yêu cầu màu rõ ràng**.

Đã kiểm tra:

- Thẻ có ghi loại người dùng.
- Chưa thấy logic tách màu rõ: người lớn màu đậm/chững, trẻ em màu sáng/dễ thương.

Kết luận: cần làm trong đợt màu thẻ.

### 5. Owner gửi khuyến mãi/thông báo cho khách

Trạng thái: **Chưa thấy màn gửi khuyến mãi**.

Đã kiểm tra:

- App đã có thông báo trong app khách.
- Chưa có màn owner tạo chương trình khuyến mãi.
- Chưa có chọn nhóm khách để gửi.

Kết luận: cần làm đợt khuyến mãi.

### 6. Lễ tân set số lượt, khách quét QR xác nhận

Trạng thái: **Có một phần sẵn, chưa đúng trọn yêu cầu mới**.

Đã kiểm tra:

- App đã có luồng khách quét QR tạo yêu cầu chờ lễ tân duyệt.
- Lễ tân có hàng chờ duyệt và có thể chỉnh số lượt trước khi duyệt.
- Nhưng chưa đúng luồng anh mô tả: lễ tân nhập trước 3 lượt rồi xuất QR 3 lượt cho khách quét xác nhận.
- Luồng xác nhận hộ có lý do cũng chưa thấy đủ.

Kết luận: cần làm đợt QR mới.

### 7. Hình khách trên thẻ nếu có

Trạng thái: **Chưa thấy tính năng ảnh khách**.

Đã kiểm tra:

- Chưa thấy trường ảnh khách/thẻ trong màn khách hoặc thẻ.
- Chưa thấy luồng khách tự thêm ảnh hoặc lễ tân thêm ảnh.

Kết luận: cần làm đợt ảnh khách.

## Tổng kết

- Đã OK: hoàn lượt/hủy điểm danh sai bằng vai lễ tân.
- Có một phần nhưng chưa đúng yêu cầu mới: QR xác nhận lượt, màu thẻ người lớn/trẻ em.
- Chưa làm/chưa test được: mua hộ cho con, gia hạn, khuyến mãi, ảnh khách.

## Đề xuất bước tiếp theo

Làm tiếp đợt 2: **lễ tân mua dịch vụ hộ cho con**.

Lý do: đây là lỗi vận hành rõ nhất ở quầy; browser đã xác nhận phụ huynh có con nhưng quầy chưa cho chọn con.
