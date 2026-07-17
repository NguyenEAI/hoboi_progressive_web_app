# Đợt 1 — Hoàn lượt / hủy điểm danh sai

## Quy tắc nghiệp vụ

- Lễ tân và owner đều được sửa sai điểm danh vé lượt.
- Bắt buộc nhập lý do.
- Có 2 kiểu sửa:
  - Hoàn từng phần: lỡ trừ 3, đúng 2 thì hoàn 1.
  - Hủy cả lần: trả lại toàn bộ số lượt của lần điểm danh đó.
- Không cho hoàn quá số lượt đã trừ.
- Không cho sửa lần điểm danh không phải vé lượt.
- Không cho sửa lần điểm danh đã bị hủy hoàn toàn.
- Mỗi lần sửa phải lưu lịch sử: ai sửa, lúc nào, lý do, trả bao nhiêu lượt, trước/sau còn bao nhiêu lượt.

## Dữ liệu cần lưu thêm

Trong mỗi lần điểm danh vé lượt:

- `correctionStatus`: trạng thái sửa sai, mặc định không có hoặc `NONE`.
- `refundedCount`: tổng số lượt đã hoàn lại cho lần đó.
- `remainingAfterCorrection`: số lượt còn lại của thẻ sau lần sửa gần nhất.
- `corrections`: danh sách các lần sửa, gồm:
  - người sửa,
  - lý do,
  - số lượt hoàn,
  - kiểu sửa,
  - trước/sau còn bao nhiêu lượt,
  - thời điểm sửa.

Trong thẻ lượt:

- lịch sử dùng lượt vẫn giữ các lần check-in cũ.
- thêm lịch sử sửa sai để owner xem lại.

## Nút thao tác cần có ở quầy

Trong màn điểm danh hộ:

- Hiện danh sách điểm danh vé lượt gần đây của khách.
- Với mỗi dòng có nút “Sửa sai”.
- Bấm vào cho chọn:
  - Hoàn một phần.
  - Hủy cả lần.
- Nhập số lượt cần hoàn nếu hoàn một phần.
- Nhập lý do bắt buộc.

## Kiểm thử cần pass

- Trừ 3 lượt, hoàn 1 lượt → thẻ tăng lại 1.
- Trừ 3 lượt, hủy cả lần → thẻ tăng lại 3.
- Trừ 3 lượt, đã hoàn 1 rồi thì chỉ còn được hoàn tối đa 2.
- Thiếu lý do thì không cho sửa.
- Lễ tân và owner đều sửa được.
- Khách nhận được thông báo sau khi hoàn lượt.
