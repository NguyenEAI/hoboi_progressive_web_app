# Kiểm thử browser built-in — 2026-07-17

## Tài khoản dùng để test

- Lễ tân test: 0900000003.
- Khách/phụ huynh test: 0900000002.

## Kết quả

- Mở được app bằng browser built-in.
- Vào được khu lễ tân bằng tài khoản test.
- Mở được màn điểm danh hộ.
- Tìm được khách/phụ huynh test 0900000002.
- Thấy được thẻ lượt MS131 còn 27/30 lượt trước khi hoàn.
- Thấy được khu “Sửa sai điểm danh vé lượt”.
- Nhập lý do thì nút hoàn/hủy mới mở; khi chưa nhập lý do thì nút bị khóa.
- Hoàn 1 lượt thành công: thẻ MS131 từ 27 lên 28 lượt, dòng check-in chuyển sang “đã hoàn một phần”.
- Hủy cả lần thành công: dòng trừ 9 lượt chuyển sang “đã hoàn/hủy hết”, thẻ MS111 hiện lại 9/15 lượt.

## Ghi chú

- Browser built-in có lúc không bấm được nút ở màn đăng nhập OTP thường, nên em dùng cửa test nội bộ chỉ bật trong chế độ kiểm thử để vào tài khoản test.
- Phần xử lý hoàn lượt đã được đưa lên server để browser test được đúng luồng thật.
- Chưa test riêng bằng vai owner; đã test bằng vai lễ tân.
