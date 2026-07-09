# BLUEPRINT V2 — Hệ thống quản lý hồ bơi

> Mục tiêu: thiết kế lại lõi nghiệp vụ theo hướng **quầy-first**, dùng được thật tại hồ bơi, nhưng vẫn tận dụng nền PWA/Firebase hiện có.  
> Bối cảnh hiện tại: 1 hồ kinh doanh, ~150 khách/ngày thuộc nhóm vé tháng/vé lượt/học viên, 5 nhân viên, 2 HLV, vẫn dùng sổ giấy là chính.

---

## 1. Khuyến nghị điều hành

**Giữ hướng Web App / PWA làm nền tảng chính.**

Không nên chuyển ngay sang desktop app hoặc mobile native app.

### Vì sao PWA là hướng đúng hiện tại?

- Dùng được trên **máy quầy, laptop, tablet, điện thoại**.
- Không cần cài qua App Store / CH Play.
- Nhân viên chỉ cần mở trình duyệt.
- Khách có thể “Add to Home Screen” như app mobile.
- Dễ triển khai, sửa lỗi, cập nhật nhanh.
- App hiện tại đã có nền Next.js + Firebase + PWA và build/typecheck pass.

### Khi nào mới cần mobile native?

Chỉ nên cân nhắc sau khi hệ thống lõi chạy ổn và có thêm nhu cầu:

- Nhiều cơ sở/chi nhánh.
- Khách dùng app thường xuyên, không chỉ xem thẻ.
- Loyalty/tích điểm/marketing/push notification mạnh.
- Thanh toán online sâu.
- Cần trải nghiệm mobile rất mượt.

### Khi nào cần desktop app?

Desktop app chỉ đáng làm nếu có tích hợp phần cứng local:

- Máy in hóa đơn.
- Máy quét RFID/thẻ từ.
- Cổng xoay/check-in vật lý.
- Chạy offline nặng khi mất mạng.

Hiện tại: **PWA trước, native/desktop sau nếu thật sự có lý do.**

---

## 2. Nguyên tắc sản phẩm

### 2.1 Quầy-first

Hệ thống phải phục vụ người vận hành tại quầy trước:

- Tìm khách trong 1–3 giây.
- Tạo khách mới bằng SĐT nhanh.
- Bán vé/lớp ngay tại quầy.
- Thu tiền và kích hoạt ngay.
- Check-in ít bước, nút rõ, không bắt nhân viên suy nghĩ nhiều.

Nếu quầy dùng khổ, báo cáo đẹp cũng vô nghĩa.

### 2.2 Một nguồn dữ liệu thật

Không tách rời khách mua vé, học viên, phụ huynh thành các “thế giới” khác nhau. Một người có thể:

- Mua vé tháng.
- Mua vé lượt.
- Đăng ký học bơi.
- Là phụ huynh của trẻ em.
- Vừa là khách vừa là người thanh toán.

### 2.3 Giao dịch phải truy vết được

Liên quan đến tiền và số lượt thì không được sửa/xóa tùy tiện.

- Sai thì tạo phiếu hủy/điều chỉnh.
- Có người thao tác, thời gian, lý do.
- Owner xem được lịch sử.
- Lễ tân không xóa dấu vết tài chính.

### 2.4 UX theo vai trò

Mỗi vai trò chỉ thấy thứ họ cần:

- Lễ tân: bán, thu, check-in, tra khách.
- HLV: học viên, lịch, ghi chú, báo nghỉ.
- Owner: doanh thu, cấu hình, phân quyền, audit.
- Khách/phụ huynh: thẻ, lượt còn lại, khóa học, thông báo.

---

## 3. Vai trò & phân quyền

| Vai trò | Quyền chính | Không nên được |
|---|---|---|
| Owner | Toàn quyền, cấu hình giá, nhân sự, báo cáo, audit, hoàn/hủy | — |
| Receptionist | Tạo/tìm khách, bán vé/lớp, thu tiền, check-in, điểm danh hộ | Xóa giao dịch, xem báo cáo tài chính tổng nếu không được phép |
| Coach | Xem lịch dạy, danh sách học viên, ghi chú, báo nghỉ | Thu tiền, sửa vé/lượt, xem tài chính |
| Customer/Parent | Xem thẻ, vé, khóa học, lịch sử, thông báo | Sửa giao dịch, tự kích hoạt dịch vụ |

### Gợi ý thêm về ca làm

Về sau nên có `staffShifts` để báo cáo doanh thu theo ca/người thu:

- Ca sáng / chiều / tối.
- Nhân viên mở ca, đóng ca.
- Tổng tiền mặt dự kiến.
- Chênh lệch nếu có.

Chưa cần làm ngay ở MVP đầu tiên nếu muốn đi nhanh.

---

## 4. Luồng nghiệp vụ lõi

## 4.1 Tạo/tìm khách tại quầy

**Mục tiêu:** khách chưa từng dùng app vẫn mua được dịch vụ ngay.

Luồng đề xuất:

1. Lễ tân nhập SĐT.
2. Hệ thống tìm khách.
3. Nếu chưa có:
   - Nhập tên.
   - Chọn loại: người lớn / trẻ em / phụ huynh.
   - Tạo hồ sơ khách tối thiểu.
4. Nếu có trẻ em:
   - Thêm trẻ vào hồ sơ phụ huynh.
5. Bắt đầu bán vé/lớp.

**Không nên bắt buộc khách tự đăng nhập OTP trước khi quầy bán được.** Khách có thể hoàn tất app sau.

---

## 4.2 Bán vé thời hạn tại quầy

Áp dụng cho:

- Vé tháng.
- Vé quý.
- Vé 6 tháng nếu giữ.
- Vé năm.

Luồng:

1. Chọn khách/người thụ hưởng.
2. Chọn loại vé.
3. Chọn đối tượng giá: trẻ <1.4m, trẻ >1.4m, người lớn.
4. Hệ thống tính giá.
5. Lễ tân thu tiền.
6. Xác nhận thanh toán.
7. Hệ thống tạo `TimePass`/`Membership` active.
8. Cấp mã thẻ/member code.

Quy tắc:

- Vé thời hạn là **cá nhân**, không cho mượn.
- Check-in chỉ cần xác nhận còn hạn.
- Có thể in/mở thẻ điện tử cho khách.

---

## 4.3 Bán vé lượt tại quầy

Áp dụng cho:

- Gói 15 lượt.
- Gói 30 lượt.

Luồng:

1. Chọn khách chủ gói.
2. Chọn gói 15/30.
3. Chọn đối tượng giá.
4. Thu tiền.
5. Kích hoạt `VisitPackage` với `remainingVisits`.

Quy tắc:

- Gói người lớn dùng được cho người lớn + trẻ em.
- Gói trẻ em không dùng cho người lớn.
- Check-in nhóm trừ N lượt.
- Mọi lần trừ lượt có lịch sử.

---

## 4.4 Bán khóa học bơi

Hiện tại nghiệp vụ chính:

- **1.800.000đ / 15 buổi / 1 kiểu bơi**.
- 1 học viên chọn 1 kiểu bơi.
- Có HLV và khung giờ.

Luồng:

1. Chọn học viên: bản thân hoặc trẻ em.
2. Chọn kiểu bơi.
3. Chọn HLV.
4. Chọn khung giờ/lịch học.
5. Kiểm tra sĩ số.
6. Thu tiền.
7. Kích hoạt `SwimEnrollment`.

Quy tắc đề xuất:

- Tổng buổi: 15.
- Hạn học: mặc định 90 ngày nếu vẫn phù hợp.
- Điểm danh mỗi ngày học tối đa 1 lần/khóa.
- Đủ 15 buổi → hoàn thành.
- Quá hạn → hết hạn, ghi rõ số buổi đã học.

---

## 4.5 Check-in

Check-in nên có 2 chế độ:

### A. Check-in tại quầy

Dành cho vận hành thực tế, nhanh và ít lỗi.

1. Lễ tân nhập SĐT hoặc quét mã thẻ.
2. Hệ thống hiển thị các quyền vào hồ đang active:
   - Vé thời hạn.
   - Vé lượt.
   - Khóa học hôm nay.
3. Lễ tân chọn quyền phù hợp.
4. Xác nhận.
5. Hệ thống ghi `CheckIn`.

### B. Khách tự check-in bằng QR

Dành cho trải nghiệm nâng cao.

- Khách mở app.
- Chọn thẻ/khóa/gói.
- Quét QR cổng.
- Với vé lượt nhóm: nên để lễ tân duyệt số lượt.

**Ưu tiên MVP:** làm check-in tại quầy thật chắc trước.

---

## 4.6 Hủy, hoàn, điều chỉnh

Không nên xóa dữ liệu thật.

Các hành động nên có:

- `cancelOrder`: hủy đơn chưa thanh toán.
- `refundPayment`: hoàn tiền đơn đã thanh toán.
- `adjustVisitPackage`: cộng/trừ lượt có lý do.
- `extendTimePass`: gia hạn có lý do.
- `adjustEnrollment`: chỉnh số buổi/hạn học có lý do.

Mọi thao tác ghi `AuditLog`.

---

## 5. Data model v2 đề xuất

> Tên collection có thể giữ gần với hiện tại để dễ migrate, nhưng tư duy nên rõ hơn: **Order/Payment tạo quyền sử dụng dịch vụ (entitlement)**.

## 5.1 Person / Customer

```ts
type Person = {
  id: string;
  fullName: string;
  phone?: string;
  kind: 'ADULT' | 'CHILD';
  parentId?: string;
  dob?: Timestamp;
  heightCm?: number;
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Gợi ý:

- Người lớn và trẻ em đều là `Person`.
- Trẻ em link tới phụ huynh bằng `parentId`.
- Tài khoản đăng nhập là lớp khác, không đồng nhất tuyệt đối với “người sử dụng dịch vụ”.

## 5.2 Account

```ts
type Account = {
  id: string; // Firebase uid
  phone: string;
  role: 'OWNER' | 'RECEPTIONIST' | 'COACH' | 'CUSTOMER' | 'PARENT';
  personId?: string;
  disabled: boolean;
  fcmTokens: string[];
}
```

Lợi ích:

- Quầy có thể tạo khách chưa đăng nhập.
- Sau này khách đăng nhập bằng SĐT thì link vào `personId`.

Nếu chưa muốn refactor lớn, có thể giữ `users` hiện tại nhưng thêm khái niệm `personId`/`createdAtCounter` dần.

## 5.3 Product / Pricing

```ts
type Product = {
  id: string;
  type: 'TIME_PASS' | 'VISIT_PACKAGE' | 'SWIM_COURSE' | 'SINGLE_TICKET';
  name: string;
  active: boolean;
  config: Record<string, unknown>;
}
```

Pricing nên lưu ở `settings/pricing` hoặc `pricingVersions`.

Quan trọng:

- Đơn hàng phải snapshot giá.
- Đổi giá không ảnh hưởng đơn cũ.

## 5.4 Order / Payment / Receipt

```ts
type Order = {
  id: string;
  buyerPersonId: string;
  beneficiaryPersonId: string;
  productType: string;
  productSnapshot: object;
  amountVND: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  source: 'COUNTER' | 'CUSTOMER_APP';
  createdBy: string;
  paidAt?: Timestamp;
  createdAt: Timestamp;
}
```

```ts
type Payment = {
  id: string;
  orderId: string;
  amountVND: number;
  method: 'CASH' | 'BANK_TRANSFER' | 'OTHER';
  receivedBy: string;
  shiftId?: string;
  at: Timestamp;
}
```

Về sau có thể thêm `Receipt` nếu cần in hóa đơn/biên nhận.

## 5.5 Entitlements

Nên gom tư duy thành “quyền sử dụng dịch vụ”. Có thể giữ collection riêng cho dễ query.

### TimePass

```ts
type TimePass = {
  id: string;
  memberCode: string;
  ownerPersonId: string;
  holderPersonId: string;
  orderId: string;
  duration: 'MONTH_1' | 'MONTH_3' | 'MONTH_6' | 'YEAR_1';
  audience: 'CHILD_UNDER_140' | 'CHILD_OVER_140' | 'ADULT';
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
}
```

### VisitPackage

```ts
type VisitPackage = {
  id: string;
  memberCode: string;
  ownerPersonId: string;
  orderId: string;
  packageSize: 15 | 30;
  audience: 'CHILD_UNDER_140' | 'CHILD_OVER_140' | 'ADULT';
  totalVisits: number;
  remainingVisits: number;
  status: 'ACTIVE' | 'DEPLETED' | 'SUSPENDED';
}
```

### SwimEnrollment

```ts
type SwimEnrollment = {
  id: string;
  memberCode: string;
  studentPersonId: string;
  buyerPersonId: string;
  orderId: string;
  swimStyle: 'BREASTSTROKE' | 'FREESTYLE' | 'BACKSTROKE' | 'BUTTERFLY';
  coachId: string;
  slotId: string;
  startDate: Timestamp;
  expiryDate: Timestamp;
  totalLessons: 15;
  attendedLessons: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
}
```

## 5.6 CheckIn / Attendance

```ts
type CheckIn = {
  id: string;
  personId: string;
  kind: 'TIME_PASS' | 'VISIT_PACKAGE' | 'SWIM_COURSE' | 'SINGLE_TICKET';
  entitlementId?: string;
  groupSize: number;
  result: 'ACCEPTED' | 'REJECTED';
  reason?: string;
  source: 'COUNTER' | 'QR' | 'STAFF_ASSIST';
  createdBy?: string;
  at: Timestamp;
}
```

Với khóa học, attendance có thể là subcollection:

`swimEnrollments/{id}/attendances/{yyyy-mm-dd}`

## 5.7 AuditLog

```ts
type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: object;
  after?: object;
  reason?: string;
  at: Timestamp;
}
```

## 5.8 Multi-branch tương lai

Nếu sau này có nhiều hồ/cơ sở, thêm `poolId`/`branchId` từ sớm vào collection chính:

- orders
- payments
- checkins
- entitlements
- staff shifts
- reports

Hiện tại có thể default `poolId = 'main'`.

---

## 6. Firestore collections đề xuất

Có thể giữ tên hiện tại nhưng định hướng v2 như sau:

```txt
/accounts/{uid}
/persons/{personId}
/products/{productId}
/settings/pricing
/orders/{orderId}
/payments/{paymentId}
/timePasses/{id}
/visitPackages/{id}
/swimEnrollments/{id}
/swimEnrollments/{id}/attendances/{date}
/checkins/{id}
/adjustments/{id}
/auditLogs/{id}
/coaches/{coachId}
/coaches/{coachId}/slots/{slotId}
/staffShifts/{shiftId}
/dailyStats/{date}
/monthlyStats/{month}
```

Nếu không muốn migrate lớn ngay:

- `users` hiện tại ≈ `accounts + person` tạm thời.
- `memberships` ≈ `timePasses`.
- `ticketPackages` ≈ `visitPackages`.
- `enrollments` ≈ `swimEnrollments`.

## 6.1 Query/index quan trọng

Cần tối ưu cho các màn hình thật dùng:

### Tìm khách

- `persons.phoneNormalized == phone`
- `accounts.phone == phone`

Không nên load toàn bộ khách khi dữ liệu tăng.

### Quầy bán hàng

- `orders.status == PENDING_PAYMENT orderBy createdAt desc`
- `orders.paidAt between start/end`
- `orders.createdBy == staffId + createdAt range`

### Check-in

- `timePasses.holderPersonId == personId && status == ACTIVE`
- `visitPackages.ownerPersonId == personId && status == ACTIVE`
- `swimEnrollments.studentPersonId == personId && status == ACTIVE`

### Báo cáo

- `payments.at` range.
- `orders.status == PAID && paidAt range`.
- `checkins.at` range.

---

## 7. Giữ / refactor / viết lại từ app hiện tại

## 7.1 Nên giữ

- Next.js + Firebase + PWA.
- Firebase callable functions cho thao tác nhạy cảm.
- Firestore rules phân quyền.
- Các type domain hiện tại làm nền.
- Order/payment activation logic.
- QR/check-in token logic nếu vẫn dùng QR.
- Coach/enrollment/attendance logic cơ bản.
- Reports page làm bản đầu.

## 7.2 Nên refactor

- Flow tạo khách: cho quầy tạo khách trước, app login sau.
- Flow bán hàng: thêm chế độ **counter sale** trực tiếp.
- Check-in assist: biến thành màn hình check-in trung tâm, ít bước hơn.
- Orders: tách rõ order, payment, refund, adjustment.
- Customer model: tránh phụ thuộc hoàn toàn Firebase Auth cho khách do quầy tạo.
- Reports: bổ sung theo người thu/ca trực khi có shift.

## 7.3 Có thể viết lại

- Màn hình quầy bán vé/lớp nếu UI hiện tại quá thiên về khách tự mua.
- Màn hình check-in tại quầy.
- Data access layer cho search khách và entitlement lookup.
- Một số admin CRUD nếu đang rải logic trực tiếp trong component.

---

## 8. Roadmap MVP

## Phase 0 — An toàn & chuẩn bị

- Đảm bảo `.env.local`, `service-account.json` không bị commit/public.
- Backup Firestore trước khi chạy thật.
- Tạo Owner dự phòng.
- Chốt bảng giá thật.
- Chốt quy tắc nghiệp vụ bằng tài liệu.

## Phase 1 — Quầy bán hàng

Mục tiêu: thay sổ giấy phần bán vé/lớp.

Tickets:

1. Tạo màn hình `Counter Sale`.
2. Tìm/tạo khách bằng SĐT.
3. Bán vé thời hạn.
4. Bán vé lượt.
5. Bán khóa học bơi.
6. Thu tiền/kích hoạt ngay.
7. In/xem biên nhận đơn giản hoặc xuất mã đơn.

## Phase 2 — Check-in station

Mục tiêu: vào hồ nhanh và có lịch sử.

Tickets:

1. Màn hình check-in tại quầy.
2. Tìm khách bằng SĐT/mã thẻ.
3. Hiển thị quyền active.
4. Trừ lượt cho gói lượt.
5. Xác nhận vé thời hạn.
6. Điểm danh khóa học.
7. Lưu check-in log.

## Phase 3 — Khóa học bơi

Mục tiêu: quản lý học viên rõ ràng.

Tickets:

1. Danh sách học viên theo HLV/ca.
2. Điểm danh buổi học.
3. Ghi chú học viên.
4. Hoàn thành 15 buổi.
5. Hết hạn 90 ngày.
6. Cảnh báo còn ít buổi/sắp hết hạn.

## Phase 4 — Báo cáo

Mục tiêu: Owner đối soát được.

Tickets:

1. Doanh thu ngày/tháng.
2. Doanh thu theo loại dịch vụ.
3. Doanh thu theo nhân viên thu tiền.
4. Vé/lượt đang active.
5. Khóa học đang active/sắp hết hạn.
6. Xuất CSV/Excel.

## Phase 5 — Vận hành & scale

- Ca trực.
- Bảo trì/vệ sinh/hóa chất.
- Nhiều cơ sở.
- Mobile native nếu đủ nhu cầu.
- Tích hợp thiết bị nếu cần.

---

## 9. Kế hoạch mở rộng theo lượng khách

## 150 khách/ngày

PWA + Firebase hiện tại ổn.

Cần tập trung:

- UX quầy.
- Dữ liệu đúng.
- Đối soát tiền mặt.
- Backup.

## 500 khách/ngày

Cần thêm:

- Search server-side, không load toàn bộ khách.
- Phân trang đơn/khách.
- Index đầy đủ.
- Check-in screen tối ưu thao tác.
- Báo cáo theo ca/người thu.

## 1000+ khách/ngày

Cần thêm:

- Queue/check-in request tốt hơn.
- Cloud Functions transaction cẩn thận tránh double-spend lượt.
- Monitoring lỗi.
- Export/backup định kỳ.
- Có thể tách read model cho báo cáo.

## Nhiều chi nhánh

Cần thêm:

- `poolId`/`branchId`.
- Phân quyền theo chi nhánh.
- Pricing theo chi nhánh nếu cần.
- Báo cáo tổng và từng cơ sở.

---

## 10. Pilot validation checklist

Chạy song song sổ giấy 1–2 tuần.

Mỗi ngày kiểm tra:

- Tổng tiền thu trong app có khớp tiền mặt/chuyển khoản không?
- Số vé tháng/lượt bán ra có khớp không?
- Vé lượt trừ có đúng không?
- Học viên điểm danh có đúng buổi không?
- Nhân viên có thao tác được trong giờ cao điểm không?
- Có trường hợp khách trùng SĐT/tên không?
- Có ai bị mất quyền vào hồ vì lỗi hệ thống không?
- Cuối ngày xuất báo cáo có dễ hiểu không?

Chỉ bỏ sổ giấy khi dữ liệu khớp ổn định.

---

## 11. Next tickets cụ thể

### Ticket 1 — Counter customer search/create

- Màn hình tìm SĐT.
- Nếu chưa có, tạo khách tối thiểu.
- Không bắt khách login OTP trước.

### Ticket 2 — Counter sale service selector

- Chọn khách.
- Chọn dịch vụ: vé thời hạn / vé lượt / khóa học.
- Tính giá tự động.

### Ticket 3 — Direct payment activation

- Lễ tân bấm “Đã thu tiền”.
- Tạo payment.
- Kích hoạt entitlement.
- Ghi audit log.

### Ticket 4 — Unified check-in screen

- Tìm SĐT/mã thẻ.
- Hiển thị tất cả quyền active.
- Chọn quyền để check-in.
- Ghi log.

### Ticket 5 — Adjustment ledger

- Hủy/hoàn/điều chỉnh lượt/hạn học.
- Bắt buộc lý do.
- Owner xem audit.

### Ticket 6 — Pilot dashboard

- Doanh thu hôm nay.
- Số lượt check-in.
- Vé/lớp bán hôm nay.
- Danh sách thao tác gần nhất.

---

## 12. Kết luận

Hướng đúng không phải làm lại toàn bộ, cũng không phải vá lặt vặt.

Hướng đúng là:

1. Giữ nền **Web App / PWA**.
2. Thiết kế lại lõi theo tư duy **quầy-first**.
3. Tách rõ **khách/người học/người thanh toán/quyền sử dụng dịch vụ**.
4. Làm bán vé + check-in thật chắc.
5. Chạy song song sổ giấy.
6. Sau đó mới mở rộng báo cáo, vận hành, mobile/native.

Nói ngắn gọn: **xương app hiện tại dùng được, nhưng cần dựng lại “quầy thu ngân + check-in” cho bén trước khi đem ra trận.**
