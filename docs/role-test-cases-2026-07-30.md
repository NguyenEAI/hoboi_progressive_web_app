# Test cases theo vai — 2026-07-30

## Nguyên tắc

- Dùng tài khoản/dữ liệu test, không gửi thông báo diện rộng.
- Không xóa khách thật, đơn thật hoặc giao dịch thật.
- Các thao tác thay đổi tiền, lượt, hạn hoặc buổi phải ghi lại dữ liệu trước/sau.
- Mỗi test ghi: PASS / FAIL / BLOCKED / SKIPPED và bằng chứng.

## A. Chung và đăng nhập

| ID | Vai | Tình huống | Bước chính | Kết quả mong đợi |
|---|---|---|---|---|
| AUTH-01 | Tất cả | Đăng nhập đúng | Nhập SĐT + mật khẩu đúng | Điều hướng đúng khu của vai |
| AUTH-02 | Tất cả | Sai mật khẩu | Nhập mật khẩu sai | Báo lỗi tiếng Việt, không đăng nhập |
| AUTH-03 | Tất cả | Chặn sai khu | Mở trực tiếp khu không thuộc vai | Tự chuyển về khu hợp lệ |
| AUTH-04 | Tất cả | Đăng xuất | Bấm Đăng xuất | Trở về màn mở đầu/đăng nhập |
| AUTH-05 | Khách | Quên mật khẩu | Mở luồng quên mật khẩu | Hiện bước xác minh OTP, không lộ lỗi kỹ thuật |

## B. Khách hàng / phụ huynh

| ID | Tình huống | Bước chính | Kết quả mong đợi |
|---|---|---|---|
| CUS-01 | Trang chủ | Đăng nhập khách | Hiện lời chào, dịch vụ, thẻ/khóa đang có |
| CUS-02 | Ví thẻ đủ loại | Mở “Thẻ của tôi” | Hiện vé thời hạn, vé lượt và thẻ khóa học nếu có dữ liệu |
| CUS-03 | Tên người dùng/chủ thẻ | Quan sát từng thẻ | Có tên chính mình hoặc tên con; chữ đậm, rõ, tương phản với nền |
| CUS-04 | Ảnh vé tháng bắt buộc | Mở mua vé thời hạn, chưa chọn ảnh | Không cho xác nhận; có hướng dẫn chụp/chọn ảnh |
| CUS-05 | Ảnh vé tháng hiển thị | Mở vé thời hạn đã tạo có ảnh | Ảnh đúng người dùng thẻ, không vỡ/nhầm |
| CUS-06 | Thẻ khóa học | Mở ví, bấm thẻ khóa học | Hiện tên học viên, kiểu bơi, tiến độ và vào chi tiết được |
| CUS-07 | Vé lượt | Mở thẻ lượt | Hiện đúng tên người hưởng, lượt còn lại, hạn dùng và lịch sử check-in |
| CUS-08 | Mua cho bản thân | Mở từng dịch vụ | Giá/đối tượng và hóa đơn đúng người mua |
| CUS-09 | Mua cho con | Chọn từng bé | Tên bé đúng trên đơn và thẻ/khóa; nhóm giá gợi ý đúng chiều cao |
| CUS-10 | Quản lý con | Thêm/sửa/xóa hồ sơ test | Bắt buộc tên + chiều cao; chặn xóa khi còn dịch vụ hoạt động |
| CUS-11 | QR check-in vé lượt | Chọn thẻ, quét QR test | Trừ đúng số lượt; QR cũ/hết hạn/đã dùng bị chặn |
| CUS-12 | Thông báo | Mở danh sách | Hiện thông báo đúng người nhận; bấm đọc được |
| CUS-13 | Hồ sơ | Sửa tên/ảnh hồ sơ test | Lưu và hiển thị lại đúng |

## C. Lễ tân

| ID | Tình huống | Bước chính | Kết quả mong đợi |
|---|---|---|---|
| REC-01 | Vào khu quầy | Đăng nhập lễ tân | Hiện quầy/đơn/khách/điểm danh; không thấy phần tài chính chỉ Owner |
| REC-02 | Tìm khách | Tìm SĐT có/không có | Có khách thì hiện hồ sơ + dịch vụ; không có thì cho tạo nhanh |
| REC-03 | Tạo khách nhanh | Nhập tên + SĐT test mới | Tạo xong chọn được khách để bán ngay |
| REC-04 | Mua cho con | Tìm phụ huynh có con | Hiện bố/mẹ và từng bé trong “Mua cho ai?” |
| REC-05 | Bán vé thời hạn | Chọn người, loại vé, ảnh, thanh toán | Thiếu ảnh bị chặn; đủ ảnh tạo vé đúng tên/ảnh |
| REC-06 | Bán vé lượt | Chọn 15/30 lượt và người hưởng | Thu tiền xong thẻ có đúng tên/lượt/hạn |
| REC-07 | Bán khóa học | Chọn học viên/HLV/ca | Thu tiền xong khóa có 15 buổi và đúng học viên |
| REC-08 | Đơn hàng | Lọc ngày/trạng thái | Danh sách và tổng tiền đúng; xem trạng thái rõ |
| REC-09 | Giới hạn hoàn/xóa | Thử hoàn/xóa đơn đã thu | Lễ tân bị chặn theo quyền |
| REC-10 | Điểm danh hộ | Tìm khách, chọn dịch vụ | Bắt buộc lý do; trừ lượt/buổi đúng |
| REC-11 | Sửa sai lượt | Hoàn một phần/hủy lần test | Thiếu lý do bị chặn; không hoàn quá số đã trừ; số lượt khớp |
| REC-12 | Gia hạn | Mở gia hạn vé/khóa | Thiếu lý do hoặc số ngày/buổi bị chặn; lưu đúng khi hợp lệ |
| REC-13 | QR cổng | Chọn số lượt, tạo QR mới | QR mang đúng số lượt và có hạn dùng |
| REC-14 | Chặn phần Owner | Mở báo cáo/giá/nhân viên bằng URL | Bị chuyển hoặc báo không có quyền |

## D. Owner

| ID | Tình huống | Bước chính | Kết quả mong đợi |
|---|---|---|---|
| OWN-01 | Trang tổng quan | Đăng nhập Owner | Hiện các mục quản trị đầy đủ |
| OWN-02 | Báo cáo | Chọn hôm nay/tuần/tháng/khoảng ngày | Tổng tiền, số đơn, loại dịch vụ và người thu khớp dữ liệu |
| OWN-03 | Xuất báo cáo | Bấm xuất file | Tải file có tiêu đề/các dòng đúng, tiếng Việt không lỗi |
| OWN-04 | Giá dịch vụ | Sửa một giá test rồi hoàn nguyên | Khách/quầy thấy giá mới; đơn cũ giữ giá cũ |
| OWN-05 | Nhân viên | Xem danh sách và gán quyền test | Quyền mới có hiệu lực; không tự gỡ Owner cuối cùng |
| OWN-06 | HLV | Thêm/sửa/khóa HLV test | Dữ liệu và lịch/ca cập nhật đúng |
| OWN-07 | Khách hàng | Tìm/thêm/sửa/xóa khách test không có dịch vụ | Đúng quyền; chặn xóa khách có vai nhân viên/HLV hoặc còn liên kết quan trọng |
| OWN-08 | Hoàn tiền | Hoàn đơn test với lý do | Bắt buộc lý do; trạng thái/tiền/dịch vụ và lịch sử khớp |
| OWN-09 | Xóa đơn test | Xóa đúng đơn test được phép | Đơn biến mất/đánh dấu đúng; không ảnh hưởng dịch vụ khác |
| OWN-10 | Hoàn lượt | Sửa sai một lần điểm danh test | Không hoàn quá số đã trừ; lịch sử có người/lý do/thời điểm |
| OWN-11 | Khuyến mãi | Gửi thử tới một SĐT test | Chỉ một người nhận; nội dung hiện trong app khách |
| OWN-12 | Gửi rộng an toàn | Chưa xác nhận gửi rộng | Mặc định vẫn là gửi thử hoặc có cảnh báo rõ |

## E. HLV

| ID | Tình huống | Bước chính | Kết quả mong đợi |
|---|---|---|---|
| COA-01 | Trang HLV | Đăng nhập HLV | Điều hướng vào khu HLV, không vào quầy/báo cáo Owner |
| COA-02 | Lịch dạy | Mở trang chính | Chỉ hiện ca/lịch của HLV đang đăng nhập |
| COA-03 | Danh sách học viên | Mở học viên | Chỉ hiện học viên thuộc lớp/ca của HLV |
| COA-04 | Chi tiết học viên | Chọn học viên | Hiện số buổi đã học/còn lại và lịch sử phù hợp |
| COA-05 | Ghi chú | Thêm ghi chú test | Lưu và hiển thị lại đúng học viên |
| COA-06 | Báo nghỉ | Chọn ca/ngày và nhập lý do | Thiếu lý do bị chặn; báo nghỉ hợp lệ được ghi nhận |
| COA-07 | Cảnh báo vắng | Mở học viên vắng nhiều | Có cảnh báo khi đủ điều kiện |
| COA-08 | Chặn điểm danh/quản trị | Mở khu quầy, giá, báo cáo | Không có quyền và bị chuyển về khu HLV |

## F. Kiểm tra liên vai

| ID | Tình huống | Kết quả mong đợi |
|---|---|---|
| CROSS-01 | Lễ tân bán dịch vụ → khách mở ví | Thẻ/khóa xuất hiện đúng tên người hưởng và dữ liệu |
| CROSS-02 | Lễ tân/Owner sửa sai lượt → khách mở thẻ | Số lượt và thông báo cập nhật đúng |
| CROSS-03 | Owner đổi giá → khách/quầy xem | Giá mới đồng bộ; đơn cũ không đổi |
| CROSS-04 | HLV báo nghỉ → khách/học viên xem thông báo | Đúng nhóm học viên nhận thông báo |
| CROSS-05 | Khách check-in → lễ tân/HLV xem lịch sử | Dữ liệu buổi/lượt khớp giữa các vai |
