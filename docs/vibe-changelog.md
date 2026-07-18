# Sổ thay đổi app hồ bơi

## 2026-07-15

- Thêm kế hoạch chỉnh sửa app theo 6 đợt: hoàn lượt, mua hộ cho con, gia hạn, QR xác nhận lượt, màu thẻ/ảnh khách, khuyến mãi.
- Đợt 1: thêm xử lý hoàn lượt/hủy lần điểm danh sai cho thẻ lượt, bắt buộc có lý do và lưu lịch sử.
- Đợt 1: thêm phần sửa sai trên màn điểm danh hộ để lễ tân/owner xem các lần trừ lượt gần đây và hoàn lại khi thao tác sai.
- Đợt 1: thêm thông báo trong app cho khách khi được hoàn lại lượt.
- Cập nhật kế hoạch kiểm thử cho phần sửa sai điểm danh thẻ lượt.
- Đợt tiếp theo: thêm chọn bố/mẹ hoặc từng bé khi bán dịch vụ tại quầy.
- Đợt tiếp theo: thêm gia hạn có lý do cho vé thời hạn, vé lượt và khóa học; có lưu lịch sử.
- Đợt tiếp theo: phân màu thẻ người lớn/trẻ em và thêm ảnh khách trên hồ sơ/thẻ.
- Đợt tiếp theo: thêm màn owner tạo khuyến mãi/thông báo theo nhóm, mặc định có gửi thử theo SĐT.
- Đợt tiếp theo: thêm chọn số lượt trên màn QR và bắt buộc lý do khi lễ tân xác nhận hộ vé lượt.

- Th�m th? hu?ng d?n d? kh�ch/l? t�n d? dua app h? boi ra m�n h�nh di?n tho?i; c� n�t th�m nhanh v� hu?ng d?n tay cho iPhone/Android.

- Th�m m�n c�i app ri�ng d? kh�ch b?m m?t n�t; Android hi?n x�c nh?n th�m app, m�y Apple th?y hu?ng d?n ng?n ngay trong app.

## 2026-07-17

- Sửa lỗi khách bấm gửi mã OTP bị báo kiểm tra bảo mật đã hiện sẵn; app giờ tự dùng lại phần kiểm tra cũ và tránh bấm trùng.
- Khi khách mới hoàn tất đăng ký, hồ sơ được lưu đủ tên, SĐT và quyền khách hàng.

- Mở quyền gửi mã OTP cho địa chỉ web khách đang dùng; khách thật không còn bị chặn vì địa chỉ web chưa được cho phép.
- Thêm lời nhắc dễ hiểu hơn nếu việc gửi mã OTP bị chặn do địa chỉ web/chờ quá nhiều lần/số điện thoại chưa đúng.

- Thêm cảnh báo cho khách khi mở app trong TikTok/Facebook/Zalo; hướng dẫn mở bằng Safari/Chrome trước khi nhận mã OTP.
- Mở thêm các địa chỉ web dự phòng để tránh khách bị chặn gửi mã OTP khi dùng link app khác nhau.

- Khi gửi mã OTP bị chặn, app hiện luôn địa chỉ web đang bị chặn để lễ tân/hồ bơi mở quyền đúng địa chỉ, không còn đoán mò.

- Chốt link cố định để gửi khách: https://hoboi-progressive-web-app-seven.vercel.app; link này đã được mở quyền gửi mã OTP.

- Sửa lỗi gửi mã OTP hiện mã kỹ thuật lạ; khách sẽ thấy hướng dẫn tiếng Việt và app tự làm mới bước kiểm tra bảo mật trước khi báo lỗi.

- Làm rõ lỗi gửi OTP trong Zalo/Facebook/TikTok: app nhận diện lỗi bảo mật rộng hơn, tự thử lại, và hiện hướng dẫn mở bằng Safari/Chrome thay vì báo lỗi chung.

- Điều chỉnh lỗi OTP: không chặn nhầm Safari, giữ hướng dẫn mở trình duyệt ngoài và thêm mã hỗ trợ cho lỗi bảo mật gửi mã.

- Đổi bước bảo mật gửi OTP từ chạy ẩn sang hiển thị rõ trên màn đăng nhập để khách tick/xác nhận trước khi gửi mã, giảm lỗi kẹt bảo mật.
