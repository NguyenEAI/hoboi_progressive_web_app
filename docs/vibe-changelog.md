# Sổ thay đổi app hồ bơi

## 2026-08-19 (chiều)

- Sửa lỗi gán quyền: trước đây khách đã có trong danh sách nhưng chưa từng đăng nhập app thì báo "Không tìm thấy tài khoản". Giờ callable `setUserRole` fallback tra Firestore `users` bằng SĐT (3 biến thể), tự tạo tài khoản đăng nhập với mật khẩu mặc định `123456` nếu chưa có, giữ nguyên `uid` để không mất liên kết dữ liệu. Chủ chỉ cần khách xuất hiện trong mục Khách hàng là gán quyền được ngay.
- Cập nhật chỉ dẫn ở màn Nhân viên & Phân quyền cho khớp thực tế.

## 2026-08-19

- Tăng tốc app cho khách: bật **bộ nhớ tạm nội bộ** (IndexedDB, đa tab) cho toàn bộ truy vấn dữ liệu. Lần đầu vẫn tải qua mạng; các lần mở lại trang (vé, khoá học, hồ sơ...) hiển thị gần như tức thì rồi đồng bộ ngầm với server. Giảm cảm giác chờ 1-3 giây xuống ~0.1 giây. Nếu trình duyệt không hỗ trợ (Safari private mode) sẽ tự rơi về chế độ cũ, không lỗi.

## 2026-08-17 (chiều)

- Khu quản trị dễ dùng hơn trên điện thoại: thanh menu bên trái tự ẩn trên màn nhỏ, có nút ☰ ở đầu trang để mở/đóng (nền mờ chạm ngoài để đóng, tự đóng khi chuyển trang).
- Các bảng (khách hàng, HLV, nhân viên, sản phẩm, đơn hàng) được bọc cuộn ngang trong khung riêng để không đẩy tràn cả trang trên điện thoại.
- Bớt lề nội dung khu quản trị trên màn nhỏ để tận dụng không gian.

## 2026-08-17

- Thêm màn hình **Chi tiêu của hồ** cho Chủ + Lễ tân ở `/admin/expenses`. Form ghi khoản chi có: ngày, số tiền, loại chi (14 loại), ghi chú, hình thức trả (tiền mặt/CK/thẻ), người trả (Chủ/Lễ tân/Khác), ảnh hoá đơn không bắt buộc. Có xác nhận khi ghi số > 5.000.000₫.
- Danh sách hôm nay, lọc theo khoảng ngày + đa loại chi. Bảng tổng tháng có tổng chung, so với tháng trước và phân tích theo từng loại (%).
- Chi cố định hằng tháng (Chủ quản lý qua `expenseTemplates`): mỗi đầu tháng nếu template chưa được ghi, app hiện chip nhắc "Chưa ghi X — Ghi ngay" để điền sẵn.
- Callable mới trong Cloud Functions: `createExpense`, `updateExpense`, `deleteExpense`, `upsertExpenseTemplate`, `deleteExpenseTemplate`. Chủ sửa/xoá tất cả; Lễ tân chỉ sửa/xoá khoản mình ghi trong vòng 24 giờ. Mọi thao tác ghi audit log kèm mô tả tiếng Việt (`EXPENSE_CREATED`, `EXPENSE_UPDATED`, `EXPENSE_DELETED`, `EXPENSE_TEMPLATE_*`).
- Firestore rules: `expenses` + `expenseTemplates` chỉ Chủ/Lễ tân đọc, ghi qua callable. Storage rules: `expenseReceipts/{uid}/**` giới hạn ảnh JPG/PNG/WebP ≤ 5MB, chỉ Chủ/Lễ tân xem.
- Có unit test cho validate + phân quyền sửa/xoá (`functions/src/expenses.test.ts`).

## 2026-08-05

- Sửa lỗi autocomplete SĐT ở các màn quầy: khi bấm gợi ý, handler tìm kiếm nhận trực tiếp số đã chọn đầy đủ thay vì chờ React state cập nhật, tránh trường hợp chỉ tìm bằng tiền tố như `093`.
- Thêm callable `correctCourseAttendance` cho Owner/Lễ tân hủy đúng 1 buổi điểm danh khóa học đã ghi khi học viên rời hồ trước khi học. Luồng bắt buộc lý do, chặn hủy trùng, giảm `attendedSessions`, ghi lịch sử trên attendance/enrollment/checkin, audit log và notification cho khách/phụ huynh.
- Bổ sung ngữ cảnh đầy đủ cho hủy điểm danh khóa học: thẻ trong `/admin/checkin-assist`, thông báo thành công, audit log, `courseAttendanceUndo`, lịch sử correction và notification đều có học viên, phụ huynh/khách, HLV, giờ check-in, lịch học, mã MS, tiến độ và lý do khi có dữ liệu. Dữ liệu legacy thiếu `slotId`, `coachId`, `completedAt`, timestamp hoặc `present` cũ được xử lý bằng fallback rõ ràng thay vì lỗi `internal`.
- Nếu buổi bị hủy là buổi đã làm khóa học chuyển `COMPLETED`, hệ thống mở lại enrollment về `ACTIVE` và tăng lại slot `enrolledCount` trong transaction; nếu slot đã đầy thì chặn để không vượt sức chứa.

- Lễ tân/Owner có thể hoàn lượt ngay sau một lần check-in vé lượt khi khách không học/không xuống hồ; hệ thống bắt buộc lý do, chặn hoàn trùng/quá số lượt, cập nhật lượt còn, ghi lịch sử sửa sai/audit và gửi thông báo cho khách.
- Staff xem được ảnh vé thời hạn trong hồ sơ khách, điểm danh hộ và từng thẻ vé thời hạn; lễ tân/Owner có thể thay ảnh bằng ảnh mới đã upload đúng vùng lưu trữ của khách/người dùng vé.
- Dùng chung autocomplete SĐT cho các màn staff nhập số khách: gợi ý từ ký tự thứ ba theo tên/SĐT, chọn là điền số vào form, giữ khả năng nhập tay để tra Auth khi chưa có hồ sơ Firestore.

## 2026-07-31

- Nâng cấp màn HLV `/coach` thành bảng vận hành mobile-first: hiển thị tổng học viên, lịch hôm nay, ca kế tiếp, các mục cần theo dõi và lối tắt tìm học viên/báo nghỉ ca.
- HLV vẫn chỉ xem lịch sử điểm danh, không có nút tự điểm danh hay đánh dấu vắng học viên. Luồng QR/check-in và quyền lễ tân/Owner không thay đổi.
- Khi HLV báo nghỉ ca, app chỉ ghi nhận báo nghỉ và nhắc nội bộ cần lễ tân/Owner follow-up lịch bù sau; không tạo luồng đề xuất hoặc tự sắp lịch bù.
- Trang `Học viên` của HLV được làm lại dễ đọc hơn: tìm kiếm rõ, badge học viên vắng liên tiếp/gần hết buổi/gần hết hạn, mở chi tiết từ cảnh báo, giữ ghi chú append-only và lịch sử điểm danh chỉ xem.

- Thiết kế lại Dashboard Owner tại `/admin` theo hướng điều hành dày thông tin hơn: KPI hôm nay, so sánh hôm qua, doanh thu tháng, cơ cấu dịch vụ, lưu lượng theo giờ, giao dịch mới và cảnh báo cần xử lý.
- Dashboard chỉ dùng dữ liệu thật từ `orders`, `checkins`, `checkinRequests`; khi chưa có dữ liệu sẽ hiện trạng thái trống rõ ràng thay vì để màn hình loãng.
- Thiết kế lại `/admin/reports` cho Owner với bộ chọn kỳ dễ đọc, KPI so với kỳ trước, biểu đồ xu hướng, bảng Loại × Đối tượng, top khách hàng, danh sách giao dịch và xuất CSV theo bộ lọc.
- Giữ nguyên giới hạn quyền: báo cáo tài chính vẫn Owner-only, lễ tân không thấy tổng doanh thu. Không thay đổi QR/check-in, khách hàng, HLV, auth hoặc deploy.

- Thêm hồ sơ khách hàng 360 cho Owner từ màn `Khách hàng`: xem toàn bộ hồ sơ liên hệ, trẻ em, dịch vụ đang dùng và đã qua, đơn hàng/thanh toán, check-in, điểm danh khóa học và audit liên quan.
- Owner có thể sửa hồ sơ khách và chỉnh trạng thái/chi tiết dịch vụ trong phạm vi dữ liệu hiện có; mỗi lần sửa bắt buộc nhập lý do, lưu trước/sau và ghi audit bền vững. Lễ tân vẫn chỉ được sửa tên khách như trước.
- Các lịch sử đơn hàng, thanh toán, check-in và điểm danh chỉ xem, không có thao tác xóa. Phần này không thay đổi QR/check-in, dashboard/báo cáo, màn HLV, auth hoặc cấu hình deploy.

- Thêm màn quản trị `QR điểm danh khóa học` riêng cho lễ tân/Owner. Mã này được phát với mục đích COURSE, ghi rõ chỉ dùng để điểm danh khóa học và tự đổi mỗi 30 giây.
- Mã QR cổng hiện được giữ riêng cho vé lượt tại cổng. Backend chặn dùng QR khóa học để trừ vé lượt/vé thời hạn, đồng thời chặn dùng QR cổng để điểm danh khóa học.
- Luồng khách khi chọn thẻ khóa học vẫn dùng enrollment đang hoạt động, kiểm đúng người học/phụ huynh, đúng ngày học, chưa hết hạn và không cho điểm danh trùng trong cùng ngày.
- Thêm kiểm thử nhỏ cho phần phân loại QR COURSE/VISIT và chạy lại typecheck/build thành công.
- Viết lại bộ kiểm tra đăng nhập theo SĐT + mật khẩu, bổ sung kiểm tra phân quyền đủ bốn vai và kiểm trực tiếp các yêu cầu về thẻ khóa học, tên người dùng thẻ và ảnh vé thời hạn.
- Tạo bộ tài khoản test riêng cho khách, lễ tân và HLV để các lần kiểm tra sau không phải đổi quyền tài khoản khách cũ.
- Hiệu chỉnh báo cáo kiểm thử thành đạt/chưa đủ/bị chặn theo đúng bằng chứng; không còn dùng kết luận “đã kiểm đầy đủ bốn vai” cho các nghiệp vụ chưa chạy.
- Gỡ tài khoản mới khỏi trang đăng nhập nội bộ, xác nhận lối này mặc định bị khóa và xoay lại mật khẩu các tài khoản test.

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
