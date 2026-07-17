# Ghi nhận kiểm tra hoàn thiện — 2026-07-15

## Đã xác nhận

- Xoá bản sinh tự động cũ và tạo lại bản chạy sạch.
- Bản chạy mới mở được ở cổng kiểm tra thay thế.
- Các đường dẫn chính trả về HTTP 200: trang đầu, đăng nhập, quản trị, điểm danh, dịch vụ, bán tại quầy, đơn hàng, báo cáo.

## Chưa thể xác nhận

- Sau khi bật phiên, trình duyệt tích hợp đã nhận địa chỉ app nhưng trang vẫn chỉ hiện nền trống; chưa có nội dung để click/nhập dữ liệu/chụp màn hình có ý nghĩa.
- Các luồng cần Firebase và OTP chưa được nghiệm thu bằng thao tác thật.

## Blocker môi trường

- Cổng mặc định 3000 đang bị một tiến trình Node cũ chiếm và request bị timeout.
- Bản kiểm tra thay thế đã chạy ổn định ở cổng khác; chưa dừng tiến trình lạ ở cổng 3000 để tránh ảnh hưởng phiên của người dùng.

## Kiểm tra trình duyệt tích hợp

- Sau khi khởi động lại đúng tiến trình, trang đầu và màn hình đăng nhập đã hiển thị đúng bằng ảnh chụp.
- Công cụ chụp ảnh hoạt động, nhưng công cụ đọc nút/ô nhập không nhận được danh sách trang ổn định; vì vậy chưa thể click hoặc nhập dữ liệu tự động.

## Quyết định

- Chưa sửa mã nghiệp vụ vì chưa tái hiện được lỗi chức năng sau khi bản chạy sạch hoạt động.
- Cần khắc phục việc đọc tương tác của trình duyệt tích hợp, sau đó chạy lại click/nhập theo TEST_PLAN.md.
