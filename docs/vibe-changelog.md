# Sổ thay đổi app hồ bơi

## 2026-07-19



- Nâng cấp màn “Con của tôi”: khách có thể thêm, sửa và xoá hồ sơ con ngay trong app; form mới bắt buộc nhập chiều cao theo cm, tự gợi ý nhóm trẻ dưới 1.4m hoặc từ 1.4m trở lên, và vẫn giữ ngày sinh nếu có.
- Khi xoá hồ sơ con, app kiểm tra vé thời hạn, vé lượt và khóa học đang hoạt động của chính khách trước; nếu bé còn được gắn với dịch vụ, app chặn xoá và hướng dẫn liên hệ lễ tân/Owner để xử lý an toàn.
- Hồ sơ con cũ chưa có chiều cao vẫn đọc được bình thường nhưng được nhắc bổ sung; các màn mua vé/khóa và bán tại quầy dùng chiều cao hoặc nhóm đã lưu để gợi ý đúng nhóm trẻ em, không thay đổi bảng giá.

- Vé thời hạn mới bắt buộc có ảnh thật của người dùng thẻ trước khi tạo đơn: khách có thể chụp bằng camera hoặc chọn ảnh trong máy, xem trước và chụp/chọn lại trước khi xác nhận.
- Nút xác nhận đặt vé thời hạn chỉ mở sau khi ảnh đã upload thành công; server cũng từ chối tạo/kích hoạt PASS nếu thiếu ảnh hoặc ảnh không nằm đúng vùng lưu trữ của khách/người hưởng.
- Bán vé thời hạn tại quầy cũng bắt buộc lễ tân chụp/chọn ảnh trước khi kích hoạt, bao gồm trường hợp mua cho con.
- Ảnh thẻ được lưu trên đơn PASS và sao chép sang membership khi kích hoạt; thẻ vé thời hạn hiển thị ảnh đã lưu, còn thẻ cũ chưa có ảnh sẽ hiển thị fallback rõ ràng.
- Làm thẻ vé thời hạn và vé lượt dễ đọc hơn: tên người dùng thẻ, loại thẻ và số lượt/ngày còn lại được tăng cỡ chữ, in đậm và tăng tương phản.
- Vé lượt mới giờ lưu thêm người đứng tên thẻ (`holderKind`, `holderId`, `holderName`) khi kích hoạt từ đơn khách đặt và khi bán trực tiếp tại quầy.
- Các vé lượt cũ không bị sửa dữ liệu; giao diện sẽ ưu tiên tên lưu trên vé, nếu thiếu thì đọc tên người hưởng từ đơn hàng cũ và cuối cùng mới fallback về tên hồ sơ khách.
- Trang “Thẻ của tôi” hiển thị thêm thẻ khóa học bơi, có tên học viên, tiến độ, trạng thái chính và bấm vào để mở chi tiết khóa học hiện có.
- Các màn xem thẻ/gói lượt/check-in/điểm danh hộ/bán tại quầy hiển thị rõ tên người hưởng để tránh nhầm giữa phụ huynh và con.

- Đổi luồng check-in vé lượt bằng QR: khách chọn thẻ lượt rồi quét mã cổng sẽ trừ lượt ngay theo số lượt đang lưu trong QR, không còn tạo màn chờ lễ tân duyệt.
- Backend vẫn kiểm tra đăng nhập, QR đúng nonce/chưa hết hạn/chưa dùng, thẻ thuộc đúng khách, còn hoạt động và đủ lượt trước khi trừ.
- Các yêu cầu check-in vé lượt cũ còn trạng thái chờ được giữ lại để xem lịch sử, nhưng không còn duyệt/trừ được; khi thao tác sẽ chuyển sang hết hiệu lực và yêu cầu khách quét QR mới.
- Màn khách và hàng đợi lễ tân được đổi chữ cho đúng luồng mới; công cụ điểm danh hộ và sửa sai/hoàn lượt vẫn giữ nguyên.

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

- Sửa luồng gửi OTP: nút gửi chỉ bật sau khi khách hoàn tất ô xác nhận bảo mật; hết hạn sẽ tự khoá lại; lỗi chỉ hiện một nơi để không bị trùng.

- Thêm lối vào app tạm cho khách không nhận được OTP: tạo phiên khách riêng, không truy cập lịch sử vé/đơn hàng/tài khoản cũ; lễ tân có thể hỗ trợ ghép lại sau.
