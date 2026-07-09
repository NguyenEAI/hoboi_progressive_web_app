# PRD — Màn quầy bán vé/lớp

> Tài liệu nội bộ cho vibe-builder. Người dùng duyệt bằng bản nháp giao diện, không duyệt tài liệu này.

## 1. Tổng quan

Làm màn quầy trung tâm cho lễ tân hồ bơi Prosper Plaza. Màn này dùng giao diện hiện có làm nền, nhưng gom luồng bán vé/lớp để lễ tân thao tác nhanh trong giờ đông khách.

## 2. Vấn đề

Hiện các việc liên quan quầy đang nằm rải rác:

- Tìm khách ở màn khách/check-in.
- Xem đơn ở màn đơn hàng.
- Dịch vụ mua vé/lớp nằm phía khách.
- Thanh toán/kích hoạt nằm ở đơn hàng.

Khi đông khách, lễ tân dễ mất thời gian chuyển màn và tìm khách.

## 3. Người dùng chính

- Lễ tân: dùng nhiều nhất.
- Owner: xem lại giao dịch và kiểm soát.
- Khách/phụ huynh: hưởng lợi vì mua nhanh hơn.

## 4. Mục tiêu

- Nhập SĐT là tìm được khách nhanh.
- Nếu chưa có khách, tạo hồ sơ tối thiểu ngay tại quầy.
- Chọn vé tháng/quý/năm, vé 15/30 lượt, khóa học bơi.
- Thu tiền xong kích hoạt ngay.
- Giao diện sang xịn, rõ tiền, rõ bước, ít thao tác.

## 5. Không làm trong vòng này

- Không làm lại toàn bộ app.
- Không đổi toàn bộ data model ngay.
- Không làm mobile native/desktop.
- Không làm báo cáo nâng cao trước khi màn quầy ổn.

## 6. Luồng chính

### FR-01 — Tìm khách bằng SĐT

- Lễ tân thấy ô nhập SĐT lớn ở đầu màn.
- Gõ SĐT thì hiện khách khớp.
- Nếu có khách: hiện tên, SĐT, vé/gói/khóa đang còn.
- Nếu chưa có: hiện nút tạo khách nhanh.

### FR-02 — Tạo khách nhanh

- Lễ tân nhập tên + SĐT.
- Có thể chọn người lớn/trẻ em/phụ huynh.
- Sau khi tạo, quay lại màn bán ngay.

### FR-03 — Chọn dịch vụ

Các nhóm dịch vụ:

- Vé tháng/quý/năm.
- Vé 15/30 lượt.
- Khóa học bơi 15 buổi.

Mỗi thẻ dịch vụ cần có:

- Tên.
- Giá.
- Ghi chú ngắn: hạn, số lượt, số buổi.

### FR-04 — Bán khóa học bơi

- Chọn học viên.
- Chọn kiểu bơi.
- Chọn HLV/ca học.
- Hiện còn chỗ hay đã đầy.
- Tổng tiền 1.800.000đ.

### FR-05 — Thu tiền và kích hoạt

- Tổng tiền luôn hiện ở cạnh phải hoặc dưới cùng.
- Lễ tân chọn tiền mặt/chuyển khoản nếu cần.
- Bấm xác nhận đã thu.
- Hệ thống tạo vé/gói/khóa active.
- Hiện kết quả: mã thẻ, hạn/lượt/buổi.

### FR-06 — Dấu vết thao tác

- Ghi ai thu tiền.
- Ghi giờ thu.
- Ghi khách, dịch vụ, số tiền.
- Nếu hủy/điều chỉnh về sau phải có lý do.

## 7. Màn hình cần bản nháp

### S1 — Quầy bán vé/lớp

Một màn chính gồm 4 vùng:

1. Tìm khách bằng SĐT.
2. Hồ sơ khách và vé/gói/khóa đang có.
3. Các thẻ dịch vụ để bán.
4. Khung thanh toán và kích hoạt.

### S2 — Tạo khách nhanh

Có thể là khung nổi hoặc khối trong màn:

- Tên.
- SĐT.
- Loại khách.
- Nút tạo và bán tiếp.

### S3 — Kết quả sau khi thu tiền

- Dịch vụ đã kích hoạt.
- Mã thẻ/khóa.
- Gợi ý bước tiếp: in/gửi thông tin/check-in.

## 8. Tiêu chí nhận

- Lễ tân hiểu ngay nên bắt đầu ở đâu.
- Nhìn thấy tổng tiền không cần tìm.
- Dịch vụ bán nhiều nhất nằm trước mắt.
- Không phải mở nhiều màn để hoàn tất một lượt bán.
- Vibe sang xịn nhưng không làm mất tốc độ.
