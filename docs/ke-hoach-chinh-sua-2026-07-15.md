# Kế hoạch chỉnh sửa app hồ bơi — 2026-07-15

> Mục tiêu: thêm các nghiệp vụ anh Nguyên yêu cầu nhưng làm theo từng đợt nhỏ, có kiểm thử rõ, tránh ảnh hưởng tiền/lượt/quyền lợi khách.

## Quyết định anh Nguyên đã chốt

- Hoàn lại điểm danh sai: **lễ tân + owner** đều được làm.
- Cách sửa điểm danh sai: có cả **hoàn từng phần** và **hủy cả lần**.
- QR xác nhận số lượt: mặc định khách quét xác nhận; nếu khách không có điện thoại/app thì **lễ tân xác nhận hộ**, bắt buộc ghi lý do.
- Gia hạn khóa học/thẻ thời hạn: **owner + lễ tân** đều được làm, bắt buộc ghi lý do.
- Gia hạn cho phép: **thêm ngày** và **thêm buổi/lượt** tùy loại dịch vụ.
- Màu thẻ: người lớn dùng màu **đậm/chững**, trẻ em dùng màu **sáng/dễ thương**.
- Ảnh khách: khách tự thêm được; lễ tân cũng thêm/sửa được nếu khách đồng ý.
- Khuyến mãi: owner có thể gửi cho **tất cả khách** hoặc **chọn nhóm khách**.

---

## Đợt 1 — Sửa sai điểm danh thẻ lượt

### Mục tiêu
Nếu lỡ trừ sai lượt, app phải sửa lại được, có lý do và có lịch sử rõ ràng.

### Luồng cần có
1. Lễ tân/owner mở lịch sử điểm danh.
2. Chọn lần điểm danh cần sửa.
3. Chọn một trong hai cách:
   - Hoàn lại một phần, ví dụ trả lại 1 lượt.
   - Hủy cả lần điểm danh, rồi thao tác lại từ đầu nếu cần.
4. Nhập lý do bắt buộc.
5. App trả lượt về cho khách.
6. Owner xem lại được ai sửa, sửa lúc nào, lý do gì, trước/sau còn bao nhiêu lượt.

### Cần kiểm thử
- Lỡ trừ 3, hoàn 1, khách còn đúng lượt.
- Hủy cả lần, khách được trả đủ lượt.
- Không cho hoàn quá số lượt đã trừ.
- Lễ tân/owner đều thao tác được.
- Lịch sử không bị mất.

---

## Đợt 2 — Lễ tân mua dịch vụ hộ cho con

### Mục tiêu
Khi tìm bằng SĐT bố/mẹ, lễ tân phải chọn được mua cho bố/mẹ hoặc từng bé.

### Luồng cần có
1. Lễ tân nhập SĐT phụ huynh.
2. App hiện danh sách người được mua:
   - Bố/mẹ.
   - Bé 1.
   - Bé 2 nếu có.
3. Lễ tân chọn đúng người nhận dịch vụ.
4. Hóa đơn tạm ghi rõ mua cho ai.
5. Sau khi thu tiền, vé/thẻ/khóa nằm đúng người đó.

### Cần kiểm thử
- Mua vé cho bố/mẹ.
- Mua vé cho bé.
- Mua khóa học cho bé.
- Hóa đơn và thẻ hiển thị đúng tên người nhận.

---

## Đợt 3 — Gia hạn có lý do

### Mục tiêu
Owner/lễ tân gia hạn được khóa học hoặc thẻ thời hạn khi có lý do chính đáng.

### Luồng cần có
1. Mở hồ sơ khách.
2. Chọn thẻ/khóa đang còn hoặc vừa hết hạn gần đây.
3. Bấm gia hạn.
4. Chọn kiểu gia hạn:
   - Thêm ngày.
   - Thêm buổi/lượt.
5. Nhập số ngày/buổi/lượt.
6. Nhập lý do bắt buộc.
7. App cập nhật quyền lợi khách và ghi lịch sử.

### Cần kiểm thử
- Gia hạn thẻ tháng thêm ngày.
- Gia hạn khóa học thêm ngày.
- Gia hạn khóa học thêm buổi.
- Không cho gia hạn nếu thiếu lý do.
- Owner xem lại được lịch sử gia hạn.

---

## Đợt 4 — QR xác nhận trừ nhiều lượt

### Mục tiêu
Lễ tân nhập số lượt, khách quét QR để tự xác nhận, tránh trừ sai.

### Luồng chính
1. Lễ tân hỏi khách đi mấy lượt.
2. Lễ tân nhập số lượt, ví dụ 3.
3. App hiện mã QR xác nhận 3 lượt.
4. Khách quét bằng app của mình.
5. Khách nhìn lại thông tin và bấm xác nhận.
6. App trừ đúng 3 lượt.

### Luồng dự phòng
Nếu khách không có điện thoại/app:
1. Lễ tân bấm xác nhận hộ.
2. Nhập lý do bắt buộc.
3. App trừ lượt và ghi rõ đây là xác nhận hộ.

### Cần kiểm thử
- Khách quét xác nhận 1 lượt.
- Khách quét xác nhận 3 lượt.
- Lễ tân xác nhận hộ có lý do.
- Không cho trừ quá số lượt khách còn.
- QR hết hạn sau một khoảng thời gian để tránh dùng lại nhầm.

---

## Đợt 5 — Màu thẻ, khuyến mãi, ảnh khách

### 5.1 Màu thẻ người lớn/trẻ em
- Người lớn: màu đậm/chững.
- Trẻ em: màu sáng/dễ thương.
- Trên thẻ vẫn ghi chữ Người lớn/Trẻ em để không chỉ dựa vào màu.

### 5.2 Owner gửi khuyến mãi
Owner tạo thông báo gồm:
- Tiêu đề.
- Nội dung.
- Nhóm nhận:
  - Tất cả khách.
  - Khách có thẻ lượt.
  - Khách có thẻ tháng/quý/năm.
  - Phụ huynh có bé.
  - Học viên khóa bơi.
- Xem trước trước khi gửi.

### 5.3 Ảnh khách trên thẻ
- Khách tự thêm ảnh trong app.
- Lễ tân có thể thêm/sửa ảnh nếu khách đồng ý.
- Nếu chưa có ảnh thì dùng hình mặc định, không chặn sử dụng.

### Cần kiểm thử
- Thẻ người lớn/trẻ em phân biệt rõ.
- Owner gửi thử thông báo cho một nhóm nhỏ trước.
- Khách nhận được thông báo trong app.
- Thẻ có ảnh khi đã thêm ảnh.
- Không có ảnh thì app vẫn hiển thị bình thường.

---

## Thứ tự em đề xuất

1. Sửa sai điểm danh thẻ lượt.
2. Mua dịch vụ hộ cho con tại quầy.
3. Gia hạn có lý do.
4. QR xác nhận trừ nhiều lượt.
5. Màu thẻ + ảnh khách.
6. Khuyến mãi/thông báo.

Lý do: làm trước các phần ảnh hưởng trực tiếp tới lượt, tiền, và thao tác quầy; các phần truyền thông/hiển thị làm sau cho an toàn.

## Điều kiện xong

- Mỗi đợt có test riêng.
- Không làm mất lịch sử cũ.
- Không sửa âm thầm lượt/quyền lợi khách mà không có lý do.
- Owner luôn xem lại được các thao tác nhạy cảm.
