# RESEARCH — Nâng cấp màn quầy hồ bơi

> Tài liệu nội bộ cho vibe-builder. Không đưa thô cho người dùng.

## Nguồn đã xem

1. `DISCOVERY.md`
   - Anh Nguyên chốt: không làm lại từ trắng, dùng giao diện có sẵn làm nền.
   - Nghẽn nhất: tìm khách.
   - Người dùng chính: lễ tân.
   - Vibe: sang xịn.
   - Ưu tiên màn đầu: bán vé/lớp.

2. `BLUEPRINT-V2.md`
   - Hướng quầy-first.
   - Quầy phải tìm/tạo khách bằng SĐT, bán vé/lớp, thu tiền, kích hoạt ngay.
   - Không phụ thuộc khách đăng nhập app trước.

3. Source hiện tại
   - `/admin/orders`: có danh sách đơn và xác nhận thanh toán.
   - `/admin/checkin-assist`: có tìm khách bằng SĐT và điểm danh hộ.
   - `/admin/customers`: có quản lý khách.
   - `/services/*`: có luồng khách tự chọn vé/lớp.
   - Functions hiện có: tạo đơn, xác nhận thanh toán, tìm/tạo khách, check-in.

4. Mockup hiện tại
   - `mockups/index.html` đã có nhiều giao diện public/customer/staff/coach.
   - Màn lễ tân hiện tại tách đơn hàng và điểm danh hộ; chưa có màn quầy gom tìm khách + bán vé/lớp + thu tiền.

## Ghi chú về nguồn ngoài

Đã thử tìm web nhưng công cụ tìm kiếm trên máy chưa cấu hình khóa tìm kiếm. Vì vậy vòng này dùng nguồn nội bộ + nghiệp vụ đã xác nhận. Khi cần đối chiếu thêm với phần mềm hồ bơi/POS ngoài thị trường, cấu hình tìm kiếm rồi bổ sung sau.

## Quyết định thiết kế

### D1 — Không làm lại từ trắng

Dùng giao diện hiện có làm nền, nhất là style xanh/trắng, thẻ bo góc, bố cục admin.

### D2 — Tạo màn quầy bán vé/lớp riêng

Không nên bắt lễ tân nhảy qua nhiều màn:

- Khách hàng
- Dịch vụ
- Đơn hàng
- Thanh toán

Màn quầy nên gom một luồng:

1. Nhập SĐT.
2. Chọn hoặc tạo khách.
3. Chọn vé/lớp.
4. Thu tiền.
5. Kích hoạt.

### D3 — Sang xịn nhưng không màu mè

Vibe nên là:

- Nền sáng, sạch.
- Xanh ngọc/xanh hồ bơi làm màu chính.
- Thẻ dịch vụ rõ giá.
- Nút chính nổi bật.
- Thông tin tiền/lượt/hạn phải cực dễ đọc.

### D4 — Lễ tân cần tốc độ hơn hiệu ứng

Ưu tiên:

- Ô nhập SĐT lớn.
- Gợi ý khách ngay.
- Dịch vụ hay bán nằm sẵn.
- Tổng tiền luôn hiện rõ.
- Sau khi thu tiền có trạng thái “đã kích hoạt”.

### D5 — Khách tự chọn vẫn giữ

Khách vẫn có thể tự chọn trên điện thoại, nhưng quầy phải làm hộ trọn vẹn được.

## Rủi ro cần kiểm soát

- Tạo khách tại quầy nhưng sau này khách đăng nhập bằng SĐT phải nối đúng hồ sơ.
- Bán khóa học cần kiểm tra HLV/ca còn chỗ.
- Thu tiền xong phải tạo đúng vé/gói/khóa.
- Điều chỉnh/hủy phải có lý do và dấu vết.
- Không để lễ tân xóa giao dịch tài chính.
