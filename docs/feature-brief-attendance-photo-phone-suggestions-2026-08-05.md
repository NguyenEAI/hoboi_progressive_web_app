# Bổ sung vận hành quầy — 2026-08-05

## Đã triển khai trong mã nguồn

- Lễ tân/Owner dùng lại luồng `correctPackageCheckin` để hoàn lượt ngay sau check-in vé lượt khi khách không học/không xuống hồ. Callable bắt buộc lý do, chặn hoàn trùng/quá lượt, cập nhật số lượt còn, ghi `correctionHistory`, `corrections`, audit log và notification cho khách.
- Ảnh vé thời hạn hiển thị cho staff ở hồ sơ khách, điểm danh hộ và từng ngữ cảnh vé thời hạn; staff có thể chụp/chọn ảnh mới, nhập lý do và lưu qua callable `updateMembershipPassPhoto`.
- Tách `StaffPhoneAutocomplete` dùng chung cho các màn staff có nhập SĐT khách: điểm danh hộ, bán tại quầy, thêm khách, gán vai trò, gửi thử khuyến mãi và sửa SĐT hồ sơ Owner.

## Điều đã chốt

- Lễ tân được hoàn lượt ngay khi khách đã điểm danh nhưng không học; bắt buộc nhập lý do, có lịch sử và nhật ký hoạt động.
- Lễ tân xem ảnh khách trên thẻ thời hạn, trong điểm danh hộ và khi xem thông tin khách; lễ tân cũng được đổi ảnh khách.
- Mọi chỗ Owner hoặc Lễ tân nhập số điện thoại sẽ gợi ý khách bắt đầu từ ký tự thứ ba, giống trải nghiệm tại điểm danh hộ.

## Bảo vệ nghiệp vụ

- Chỉ hoàn các lần điểm danh có số lượt thực tế để tránh sai số dư dịch vụ.
- Không cho hoàn quá số lượt đã trừ hoặc hoàn trùng.
- Lịch sử hoàn ghi người thực hiện, thời gian và lý do.
- Gợi ý số điện thoại chỉ phục vụ các vai Owner/Lễ tân.

## Hoàn thành khi

- Các thao tác hoạt động ổn định ở các màn liên quan.
- Quyền Lễ tân phù hợp, không làm lộ ảnh hoặc dữ liệu cho khách/HLV.
- Có kiểm tra tự động, kiểm tra giao diện và thay đổi được lưu vào Git.
