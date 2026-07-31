# Báo cáo kiểm thử theo vai — 2026-07-31 (đã hiệu chỉnh sau review)

## Cách đọc trạng thái

- **PASS:** đã thực hiện và có bằng chứng trực tiếp.
- **INCOMPLETE:** mới kiểm một phần; chưa đủ để kết luận toàn bộ nghiệp vụ.
- **BLOCKED:** chưa thể thực hiện vì thiếu dữ liệu test phù hợp hoặc vì chủ động tránh thay đổi dữ liệu thật.

## Phạm vi thực tế đã chạy

- Kiểm tra tự động: màn công khai, đăng nhập bằng SĐT + mật khẩu, điều hướng/phân quyền giao diện theo vai, ví thẻ và yêu cầu ảnh vé thời hạn.
- Kiểm tra built-in browser: đăng nhập và các màn chính của Khách hàng, Lễ tân, Owner, HLV; tìm khách tại quầy; chặn báo cáo đối với lễ tân; ví thẻ/khóa học của phụ huynh test.
- Không chạy giao dịch tiền thật, không gửi khuyến mãi rộng, không hoàn/xóa dữ liệu thật.

## Kết quả test tự động

- **PASS:** 15 bài.
- **SKIPPED hợp lệ:** đúng 1 bài `CARD-01` vì tài khoản khách test riêng chưa có thẻ/khóa mẫu.
- **FAIL:** 0 ở lần chạy sạch cuối cùng; cả bốn bài đăng nhập/điều hướng theo vai đều thực sự chạy, không vai nào bị skip.
- Một lỗi của chính bài test (kiểm trạng thái trống trước khi dữ liệu tải xong) đã được sửa và chạy lại đạt.
- Có một lần chạy trung gian màn điểm danh hộ của lễ tân rơi vào lỗi trang phía trình duyệt; chạy riêng trong phiên sạch và chạy lại toàn bộ đều đạt. Vì vậy ghi nhận đây là dấu hiệu chập chờn cần theo dõi, không dùng lần đạt sau để tuyên bố nghiệp vụ điểm danh đã được kiểm đầy đủ.

> Kết quả trên không có nghĩa là toàn bộ nghiệp vụ của app không có lỗi. Nó chỉ chứng minh các bài đã chạy không còn lỗi.

## Kết quả theo vai

### Khách hàng — PASS một phần / INCOMPLETE toàn vai

**PASS**
- Đăng nhập bằng SĐT + mật khẩu và vào đúng khu khách.
- Mở được trang chủ, dịch vụ, thẻ, khóa học, thông báo và check-in.
- Ví phụ huynh test hiển thị 2 thẻ lượt và 2 thẻ khóa học.
- Thẻ khóa học hiện tên người học, tiến độ, số buổi còn, HLV và hạn.
- Tên chủ thẻ/người học rất đậm, cỡ lớn, chữ trắng có bóng trên nền màu.
- Luồng mua vé thời hạn hiện yêu cầu ảnh và khóa nút tiếp tục khi chưa có ảnh.

**INCOMPLETE**
- Chưa tạo một vé thời hạn test mới để nhìn ảnh thật trên mặt thẻ sau khi kích hoạt.
- Chưa chạy mua dịch vụ hoàn chỉnh và thanh toán bằng khách test.
- Chưa chạy QR check-in thật trong vòng này.

### Lễ tân — PASS quyền/màn chính / INCOMPLETE nghiệp vụ

**PASS**
- Đăng nhập đúng vai và vào khu vận hành.
- Chỉ thấy menu vận hành; không thấy menu báo cáo/giá/quyền.
- Mở quầy bán vé/lớp được.
- Tìm khách test bằng SĐT thành công; hiện dịch vụ đang có.
- Mở trực tiếp báo cáo bị chặn với thông báo chỉ Owner được xem.

**INCOMPLETE**
- Chưa chạy trọn bán → thu tiền → kích hoạt thẻ/khóa.
- Chưa chạy điểm danh hộ, sửa sai lượt, hoàn quá số đã trừ hoặc gia hạn thật trong vòng này.
- Chưa chứng minh tất cả quyền phía server chỉ bằng việc ẩn/chặn màn hình.

### Owner — PASS quyền/màn chính / INCOMPLETE nghiệp vụ

**PASS**
- Đăng nhập đúng vai và thấy đủ các khu quản trị.
- Mở báo cáo và quản lý nhân viên/quyền được.
- Thấy đúng tài khoản lễ tân test và HLV test.

**INCOMPLETE**
- Chưa đổi giá rồi hoàn nguyên để kiểm đồng bộ giá.
- Chưa hoàn tiền, xóa đơn, sửa quyền hoặc gửi khuyến mãi test trong vòng này.
- Việc Owner có được phép xem khu HLV như một HLV hay không chưa có yêu cầu nghiệp vụ rõ; bài test không được dùng để khẳng định quyền này.

### HLV — PASS quyền/màn trống / BLOCKED nghiệp vụ có học viên

**PASS**
- Đăng nhập đúng vai, vào trang Hôm nay và Học viên.
- Mở trực tiếp khu quản trị bị chuyển về khu HLV.
- Thấy lịch HLV test và trạng thái trống hợp lệ.

**BLOCKED**
- HLV test chưa có khóa/học viên mẫu nên chưa kiểm ghi chú, cảnh báo vắng, báo nghỉ và thông báo liên vai.

## Đối chiếu yêu cầu trong ảnh

1. **Thêm khóa học bơi vào “Thẻ của tôi” — PASS trực tiếp.**
2. **Tên chủ thẻ là chính khách hoặc con — PASS trực tiếp trên dữ liệu phụ huynh.**
3. **Tên in đậm, tương phản với nền — PASS trực tiếp và đã đọc kiểu hiển thị.**
4. **Vé tháng bắt buộc ảnh — PASS ở bước chặn mua khi thiếu ảnh; INCOMPLETE ở bước nhìn ảnh trên thẻ đã kích hoạt.**

## Dữ liệu cloud đã thay đổi

- Tạo 3 tài khoản riêng có tiền tố TEST: khách, lễ tân, HLV.
- Tạo 1 hồ sơ HLV TEST và liên kết tài khoản HLV TEST.
- Thêm cách đăng nhập bằng mật khẩu cho phụ huynh test 0900000002; không đổi role hoặc dịch vụ của tài khoản này.
- Các mật khẩu khách/lễ tân/HLV/phụ huynh test đã được xoay sau review và file môi trường riêng đã cập nhật.
- Bộ test đã chạy lại với mật khẩu mới: 15 PASS, 1 SKIPPED hợp lệ, 0 FAIL trong phạm vi bài test.
- Không thay đổi mật khẩu Owner thật.

## An toàn trang đăng nhập nội bộ

- Đã gọi trực tiếp endpoint trên bản công khai: trả 403 với thông báo chỉ mở trong chế độ kiểm thử nội bộ.
- Ba tài khoản test mới đã được gỡ khỏi danh sách trang đăng nhập nội bộ.
- Mã nguồn đã bổ sung chặn cả giao diện: mọi bản production chỉ hiện “Không mở trang kiểm thử”, không hiện danh sách tài khoản.
- Endpoint dùng cờ server-only và luôn trả 403 khi chạy ở production, kể cả khi cấu hình test bị đặt nhầm.
- Thay đổi chặn giao diện/API đã qua kiểm tra kiểu dữ liệu và tạo bản chạy; chưa đưa lên bản công khai trong vòng này vì việc đưa bản mới cần anh xác nhận riêng.

## Vòng kiểm thử sâu còn cần

1. Quầy bán cho bản thân và cho con → thu tiền → thẻ/khóa xuất hiện.
2. Check-in vé lượt/khóa học → kiểm lịch sử ở khách, lễ tân và HLV.
3. Sửa sai/hoàn lượt, chặn hoàn quá số đã trừ và gia hạn có lý do.
4. Owner đổi giá rồi hoàn nguyên; kiểm đơn cũ giữ giá cũ.
5. Tạo lớp/học viên mẫu cho HLV TEST; kiểm ghi chú, báo nghỉ, cảnh báo vắng và thông báo.
6. Tạo vé thời hạn TEST có ảnh; kiểm ảnh trên mặt thẻ sau kích hoạt.

## Kết luận hiệu chỉnh

- Không phát hiện lỗi trong **phạm vi 15 bài tự động và các màn/luồng trực tiếp đã thực hiện**.
- Chưa đủ bằng chứng để tuyên bố app đã được kiểm đầy đủ mọi nghiệp vụ của bốn vai.
- Trạng thái đúng: **các luồng đăng nhập, điều hướng, quyền giao diện và yêu cầu thẻ chính đã đạt; nghiệp vụ thay đổi tiền/lượt/buổi còn cần vòng test dữ liệu riêng.**
