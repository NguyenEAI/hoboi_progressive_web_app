# TEST PLAN — Màn quầy bán vé/lớp

> Tài liệu nội bộ trước khi kiểm thử đầy đủ.

## Đã kiểm tra nhanh

- [x] Kiểm tra phần giao diện không lỗi kiểu.
- [x] Kiểm tra phần phía sau không lỗi kiểu.
- [x] Màn mở đầu hiển thị đúng trên điện thoại.
- [x] Nút bắt đầu vào được màn đăng nhập.
- [x] Màn mở đầu không bị tràn ngang trên điện thoại.
- [x] Dòng bảo mật/PDPL còn hiển thị.
- [x] Smoke public vẫn chạy không cần đăng nhập.
- [ ] Đăng nhập live hiện dùng số điện thoại + mật khẩu (không còn OTP cho login). Bộ Playwright đã đổi sang credentials qua biến môi trường và sẽ skip rõ lý do nếu thiếu tài khoản/mật khẩu.

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

## Playwright live-role credentials

Không commit mật khẩu vào repo. Muốn chạy các bài live đăng nhập/phân quyền, set biến môi trường trước khi chạy:

```powershell
$env:E2E_CUSTOMER_PHONE="0xxxxxxxxx"; $env:E2E_CUSTOMER_PASSWORD="..."
$env:E2E_OWNER_PHONE="0xxxxxxxxx"; $env:E2E_OWNER_PASSWORD="..."
$env:E2E_RECEPTIONIST_PHONE="0xxxxxxxxx"; $env:E2E_RECEPTIONIST_PASSWORD="..."
$env:E2E_COACH_PHONE="0xxxxxxxxx"; $env:E2E_COACH_PASSWORD="..."
npm run test:e2e -- tests/e2e/signin.spec.ts tests/e2e/role-routing.spec.ts tests/e2e/customer-cards.spec.ts --project=mobile-chrome
```

Nếu biến môi trường thiếu, các bài role/customer live sẽ `skip` với lý do rõ ràng vì một số tài khoản cloud cũ chỉ có Phone provider và chưa có Password provider.

## Coverage mới cần giữ

- [ ] CUSTOMER đăng nhập bằng số + mật khẩu và vào `/home`.
- [ ] OWNER đăng nhập vào `/admin`, xem được báo cáo, kiểm tra route không dành cho owner theo hướng không phá dữ liệu.
- [ ] RECEPTIONIST đăng nhập vào `/admin`, vào được điểm danh hộ, bị chặn khỏi báo cáo owner-only.
- [ ] COACH đăng nhập vào `/coach`, xem được khu vực học viên, bị redirect khỏi `/admin`.
- [ ] Customer `/cards` hiển thị tên chủ thẻ/người học và course card khi account có dữ liệu mẫu.
- [ ] Customer `/my-courses` hiển thị tên học viên/trạng thái khi account có khóa học mẫu.
- [ ] UI mua vé thời hạn nhắc bắt buộc có ảnh thật trước khi xác nhận.

## Ghi chú

Sau vòng kiểm thử này mới nên cho chạy song song với sổ giấy.
