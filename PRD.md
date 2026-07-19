# PRD — App quầy bán hàng + quản lý hồ bơi

> Tài liệu nội bộ cho vibe-builder. Người dùng duyệt bằng bản nháp giao diện và cách app hoạt động, không duyệt tài liệu này.

## 1. Tổng quan

Hệ thống cần hoạt động giống một **app bán hàng bình thường kết hợp app quản lý hồ bơi**.

Trọng tâm đầu tiên là màn quầy cho lễ tân: tìm khách, bán vé/lớp, thu tiền, kích hoạt ngay. Sau đó các phần quản lý phải đủ để Owner không phải quay lại sổ giấy quá nhiều.

Không làm lại từ trắng. Dùng giao diện và logic hiện có làm nền, bổ sung phần thiếu và sắp xếp lại luồng quầy cho nhanh.

## 2. Vấn đề

Hiện các việc quan trọng đang rải ở nhiều nơi:

- Tìm khách ở màn khách/check-in.
- Xem đơn ở màn đơn hàng.
- Dịch vụ mua vé/lớp nằm phía khách.
- Thanh toán/kích hoạt nằm ở đơn hàng.
- Báo cáo, khách hàng, HLV, sản phẩm đã có nhưng chưa gom thành một luồng bán hàng hoàn chỉnh tại quầy.

Nếu đưa vào dùng thật, lễ tân sẽ phải chuyển màn nhiều và Owner vẫn phải đối sổ bằng tay.

## 3. Người dùng chính

- **Lễ tân:** dùng mỗi ngày, cần nhanh và rõ.
- **Owner:** cần kiểm tra tiền, khách, vé/lớp, nhân viên.
- **HLV:** cần xem học viên, lịch, ghi chú.
- **Khách/phụ huynh:** cần xem thẻ, lượt còn lại, khóa học.

## 4. Mục tiêu

- Quầy bán vé/lớp nhanh như app bán hàng.
- Quản lý khách, vé, lượt, khóa học, tiền thu và lịch sử đầy đủ.
- Thu tiền xong dịch vụ dùng được ngay.
- Có dấu vết cho các thao tác tiền/lượt/hạn học.
- Giao diện sang xịn, nhưng không rối.
- Anh Nguyên không phải nhắc từng tính năng nhỏ sau này.

## 5. Không làm trong vòng đầu

- Không chuyển sang app điện thoại riêng.
- Không làm lại toàn bộ giao diện từ trắng.
- Không làm phần cứng cổng xoay/RFID ngay.
- Không làm quản lý kho hóa chất/bảo trì trước khi quầy bán hàng ổn.

## 6. Bộ tính năng cần có

## 6.1 Bán hàng tại quầy

### FR-01 — Tìm khách bằng SĐT

- Lễ tân thấy ô nhập SĐT lớn ở đầu màn.
- Gõ SĐT thì hiện khách khớp.
- Nếu có khách: hiện tên, SĐT, vé/gói/khóa đang còn.
- Nếu chưa có: hiện nút tạo khách nhanh.

### FR-02 — Tạo khách nhanh

- Lễ tân nhập tên + SĐT.
- Có thể chọn người lớn/trẻ em/phụ huynh.
- Sau khi tạo, quay lại màn bán ngay.
- Về sau khách đăng nhập app thì nối lại đúng SĐT.

### FR-03 — Bán vé tháng/quý/năm

- Chọn khách/người dùng vé.
- Chọn loại vé.
- Chọn đối tượng giá.
- App tính tiền.
- Thu tiền xong kích hoạt vé.

### FR-04 — Bán vé 15/30 lượt

- Chọn khách chủ gói.
- Chọn 15 hoặc 30 lượt.
- Chọn đối tượng giá.
- Thu tiền xong tạo gói còn đủ lượt.
- Gói lượt có hạn dùng 365 ngày tính từ ngày kích hoạt/thu tiền.

### FR-05 — Bán khóa học bơi

- Chọn học viên.
- Chọn kiểu bơi.
- Chọn HLV/ca học.
- Hiện còn chỗ hay đã đầy.
- Tổng tiền 1.800.000đ.
- Thu tiền xong kích hoạt khóa học 15 buổi.

### FR-06 — Hóa đơn tạm

- Bên phải màn luôn có khách đang chọn, dịch vụ đang bán, tổng tiền.
- Có thể bỏ dịch vụ khỏi hóa đơn trước khi thu.
- Tổng tiền phải nổi bật.

### FR-07 — Thu tiền

- Hỗ trợ tiền mặt trước.
- Có chỗ ghi chuyển khoản nếu cần.
- Bấm “đã thu tiền” thì dịch vụ được kích hoạt.
- Hiện kết quả rõ: mã thẻ, hạn/lượt/buổi.

## 6.2 Quản lý sau bán

### FR-08 — Lịch sử đơn và tiền thu

- Xem đơn hôm nay.
- Lọc theo ngày.
- Xem ai thu tiền.
- Xem khách mua gì, số tiền bao nhiêu.

### FR-09 — Hủy/hoàn/điều chỉnh

- Đơn chưa thu tiền có thể hủy.
- Đơn đã thu muốn hoàn/điều chỉnh phải có lý do.
- Điều chỉnh lượt/hạn/buổi phải lưu dấu vết.
- Lễ tân không được xóa sạch lịch sử tiền.

### FR-10 — Quản lý khách

- Xem danh sách khách.
- Tìm bằng SĐT/tên.
- Sửa tên/SĐT nếu sai.
- Thêm trẻ em vào phụ huynh.
- Xem khách đang có vé/lượt/khóa nào.

### FR-11 — Quản lý vé/gói/khóa đang còn

- Xem vé tháng/quý/năm còn hạn.
- Xem vé lượt còn bao nhiêu lượt và hạn dùng. Vé lượt hết hạn sau 365 ngày không được dùng để check-in, dù trạng thái dữ liệu cũ còn là ACTIVE.
- Xem khóa học còn bao nhiêu buổi.
- Chặn hoặc tạm dừng khi cần, có lý do.

### FR-12 — Check-in

- Tìm khách bằng SĐT hoặc mã thẻ.
- Hiện các vé/gói/khóa đang dùng được.
- Vé tháng: xác nhận còn hạn.
- Vé lượt: chọn số người, trừ lượt; chặn gói đã hết hạn 365 ngày và hiển thị lý do đơn giản.
- Khóa học: điểm danh buổi học.

### FR-13 — HLV và học viên

- HLV xem danh sách học viên.
- Xem số buổi đã học/còn lại.
- Ghi chú học viên.
- Báo nghỉ ca nếu cần.

### FR-14 — Sản phẩm và giá

- Owner xem/sửa giá vé tháng, vé lượt, khóa học.
- Giá đơn đã bán không bị đổi theo giá mới.
- Tắt/bật dịch vụ đang bán.

### FR-15 — Báo cáo cơ bản

- Hôm nay thu bao nhiêu.
- Bao nhiêu đơn.
- Thu theo loại: vé tháng, vé lượt, khóa học.
- Lọc theo ngày/tháng.
- Xuất file nếu cần.

### FR-16 — Cuối ngày

- Lễ tân/Owner xem tổng tiền hôm nay.
- So với tiền thực tế.
- Thấy danh sách đơn đã thu.
- Ghi chú chênh lệch nếu có.

## 7. Màn hình cần có

### S1 — Quầy bán vé/lớp

Màn chính đã được anh Nguyên duyệt bản nháp.

Gồm:

1. Tìm khách bằng SĐT.
2. Hồ sơ khách và vé/gói/khóa đang có.
3. Thẻ dịch vụ để bán.
4. Hóa đơn tạm và nút thu tiền.

### S2 — Tạo khách nhanh

- Tên.
- SĐT.
- Loại khách.
- Thêm trẻ em nếu cần.

### S3 — Đơn hôm nay

- Danh sách đơn.
- Trạng thái đã thu/chưa thu/hủy/hoàn.
- Nút xem chi tiết.

### S4 — Khách hàng

- Danh sách khách.
- Tìm kiếm.
- Hồ sơ khách.
- Vé/lượt/khóa của khách.

### S5 — Check-in

- Tìm khách.
- Chọn vé/gói/khóa đang dùng được.
- Xác nhận vào hồ.

### S6 — Khóa học/HLV

- Lịch học.
- Học viên.
- Số buổi.
- Ghi chú.

### S7 — Báo cáo/cuối ngày

- Tiền thu.
- Số đơn.
- Loại dịch vụ.
- Lọc ngày/tháng.

### S8 — Cài đặt giá và nhân viên

- Giá dịch vụ.
- Nhân viên/HLV.
- Quyền truy cập.

## 8. Thứ tự làm

1. Làm màn quầy bán vé/lớp trước.
2. Nối tìm/tạo khách.
3. Nối thu tiền/kích hoạt.
4. Làm lịch sử đơn và đối soát cuối ngày.
5. Hoàn thiện check-in.
6. Hoàn thiện khóa học/HLV.
7. Hoàn thiện báo cáo.

## 9. Tiêu chí nhận

- Lễ tân bán xong một vé/lớp không phải mở nhiều màn.
- Khách mới vẫn mua được ngay tại quầy.
- Thu tiền xong vé/lượt/khóa dùng được ngay.
- Owner xem lại được tiền và lịch sử.
- Lượt/hạn/buổi không bị lệch.
- Giao diện sang xịn nhưng vẫn rõ và nhanh.
