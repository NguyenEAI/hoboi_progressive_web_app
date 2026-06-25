# CLAUDE.md — Hệ thống Quản lý Hồ Bơi Prosper Plaza

> Bản tóm tắt PRD **v2.5** (2026-06-24). Chi tiết đầy đủ: [`.agent/PRD.md`](.agent/PRD.md).
>
> **Thay đổi v2.5** (UAT round 6, xem §12.quinquies): CRUD khách hàng ở `/admin/customers` (Owner thêm/xoá, lễ tân/Owner sửa tên) + fix bug list chỉ hiện 2/5 số test do `orderBy("createdAt")` ẩn doc thiếu field · khoá khách hàng tự đổi tên (chỉ Owner/lễ tân đổi qua callable) · gợi ý SĐT autocomplete ở `/admin/checkin-assist` · bỏ check giờ học khi điểm danh khoá (cho phép sớm/muộn) · sửa bảng `CrossTable` lệch cột + bar chart Dashboard/Báo cáo không hiện cột.
>
> **Hotfix v2.4.1** (xem §12.quater): bỏ vé thời hạn khỏi flow check-in của khách (chỉ xuất trình thẻ ở `/cards`) · đảo lại E1: auto-create doc placeholder khi Auth có user nhưng Firestore không (thay vì báo lỗi "incomplete-profile") · thêm nút "Đồng bộ Auth" ở `/admin/customers` cho Owner bulk-sync test numbers · nhắc deploy functions sau khi pull v2.4.
>
> **Thay đổi v2.4** (UAT round 5, xem §12.ter): fix điểm danh hộ không tìm thấy khách (E1) · restructure màn check-in của khách: bỏ "Số người cùng vào", thêm bộ chọn thẻ (E2) · hoàn thiện màn HLV: ghi chú HV, báo nghỉ → push HV, highlight HV vắng ≥3 buổi liên tiếp (E3, E4).
>
> **Thay đổi v2.3** (xem §12.bis): xóa đơn không cần dialog · back button mọi trang · sửa logout ẩn ở Sản phẩm/Báo cáo · sửa wizard khóa học bug "Thiếu HLV/khung giờ/ngày" · lễ tân duyệt check-in vé lượt · bỏ chiều cao trẻ ở phần đăng ký (chọn lúc mua) · restructure flow Dịch vụ (Học bơi nổi bật đầu) · fix bug danh sách khách hàng rỗng · điểm danh hộ cho cả vé lượt.

## 1. Bối cảnh
- **Đơn vị**: CÔNG TY TNHH HT BẢO LÂM — Hồ bơi Chung cư Prosper Plaza (1 hồ, TP.HCM).
- **Quy mô**: 2.000–3.000 thành viên/năm · 50–150 check-in/ngày · B2C.
- **Owner**: thucludinh@gmail.com.
- **Mục tiêu**: số hóa 100% vận hành (vé/khóa/check-in/báo cáo), thẻ điện tử QR, doanh thu realtime, tuân thủ PDPL 2026.

## 2. Nguyên tắc thiết kế
1. **Mobile-first PWA** (không native).
2. **Đóng băng giá**: đơn lưu `productSnapshot`, Owner đổi giá chỉ ảnh hưởng đơn mới.
3. **Server is source of truth**: mọi ghi tài chính/thẻ qua Cloud Functions; client chỉ đọc.
4. **Tối thiểu hóa dữ liệu** (PDPL): chỉ SĐT + tên + chiều cao + FCM token. Không CMND/email.
5. **Audit append-only** mọi thay đổi tiền/role.
6. **Realtime** Firestore `onSnapshot`.
7. **Tiếng Việt 100%**, tiền `vi-VN` (`1.000.000 ₫`).

## 3. RBAC (5 vai trò)
Role lưu ở `users.role` + Firebase custom claims (sync qua callable `setUserRole`). Mặc định = `CUSTOMER`.

| Vai trò | Quyền |
|---|---|
| **OWNER** | Toàn quyền: sửa giá, hoàn tiền, phân/gỡ quyền, **xóa đơn (1 click, không dialog)**, báo cáo tài chính, **thêm/sửa/xoá khách hàng** ở `/admin/customers` (v2.5) |
| **RECEPTIONIST** | Xác nhận thanh toán, **duyệt mọi check-in vé lượt** (xem trước, chọn số lượt, bấm xác nhận), check-in hộ (cả khóa học **và** vé lượt), gia hạn, đăng ký khách mới, **sửa tên khách hàng** (không xoá — v2.5). KHÔNG xem báo cáo tài chính tổng, KHÔNG xóa cứng dữ liệu |
| **COACH** | Lịch dạy + HV của mình, **ghi chú riêng cho từng HV** (per enrollment), **báo nghỉ ca** (push toàn bộ HV ca đó), Zalo deeplink, highlight HV vắng ≥3 buổi liên tiếp. KHÔNG điểm danh (lễ tân duyệt) |
| **PARENT** | Mua cho con, quản lý hồ sơ trẻ. CHILD không có account riêng |
| **CUSTOMER** | Mua cho bản thân. **KHÔNG được tự đổi tên** sau khi đã set (v2.5 — INV-20). Muốn đổi tên → liên hệ lễ tân/Owner |

> **v1**: PARENT không phải tài khoản riêng — dùng `CUSTOMER` với `childrenIds[]` + subcollection `/users/{uid}/children`.

Sau khi đổi role, client gọi `getIdToken(true)` để refresh claim.

## 4. Bảng giá (frozen at order time)

### 4.1 Vé lẻ — không bán qua app (chỉ tham khảo)
Trẻ <1.4m: 25k · Trẻ ≥1.4m: 30k · Người lớn: 35k · Người lớn dẫn trẻ <2t: 40k.

### 4.2 Vé thời hạn (không giới hạn lượt)
| Đối tượng | 1T | 3T | 6T | 1N |
|---|---|---|---|---|
| Trẻ <1.4m | 400k | 1.000k | 1.800k | 3.500k |
| Trẻ ≥1.4m | 450k | 1.150k | 2.150k | 4.200k |
| Người lớn | 500k | 1.300k | 2.300k | 4.400k |

### 4.3 Gói lượt (trừ 1/check-in)
| Đối tượng | 15 lượt | 30 lượt |
|---|---|---|
| Trẻ <1.4m | 300k | 550k |
| Trẻ ≥1.4m | 350k | 700k |
| Người lớn | 450k | 800k |

### 4.4 Khóa học bơi
**Giá phẳng 1.800.000₫** · 15 buổi · hiệu lực 90 ngày · 4 kiểu cùng giá (ếch/sải/ngửa/bướm).

## 5. Invariants (mã ổn định, không đổi số)

| Mã | Quy tắc |
|---|---|
| INV-1 | Khóa học KHÔNG thay vé vào hồ |
| INV-2 | Khóa hết hạn sau **90 ngày**, buổi chưa học → mất, không bảo lưu/bù |
| INV-3 | Mỗi ca tối đa **20 HV** (kiểm bằng Firestore transaction) |
| INV-4 | Lịch HLV: Tùng (T4/T6/CN), Tín (T3/T5/T7), T2 nghỉ |
| INV-5 | Khung dạy: Sáng 07–11h (4 ca) + Chiều 14–20h (6 ca) = **10 ca/ngày** × 60 phút |
| INV-6 | Đơn mặc định `PENDING_PAYMENT`, kích hoạt sau khi staff/Owner xác nhận PAID (tiền mặt) |
| INV-7 | Trẻ đi học một mình: lễ tân tra SĐT phụ huynh → chọn bé → điểm danh hộ (khóa học **hoặc** vé lượt) → push phụ huynh |
| INV-8 | QR nonce đổi mỗi **30s**, single-use, server cấp |
| INV-15 | **Vé lượt: khách quét QR chỉ tạo "yêu cầu chờ duyệt"; lễ tân xem thông tin vé + chọn số lượt + bấm xác nhận → mới trừ thực tế** (chống ăn gian số người vào). Vé thời hạn (membership) vẫn check-in trực tiếp 1 chạm. |
| INV-16 | Trẻ em đăng ký KHÔNG bắt buộc `heightCm`; **audience được chọn lúc mua thẻ** (radio trẻ <1.4m / trẻ ≥1.4m / người lớn). Nếu có nhập height thì auto-suggest, có thể override. |
| INV-17 | **Khách chọn loại thẻ trước khi quét QR**: không có logic preview auto-pick theo giờ. UI customer hiển thị mọi thẻ active (khóa học · vé thời hạn · vé lượt), khách bấm chọn 1 cái → quét QR → server xử lý đúng loại đó. Khi quét vé lượt, **client chỉ gửi suggestedCount = 1** — số lượt thật do lễ tân chốt. |
| INV-18 | **HLV báo nghỉ ca**: HLV chọn ngày + ca → server đánh dấu `/coaches/{id}/absences/{YYYY-MM-DD_H}` + push tất cả HV đang học ca đó. Không tự dời lịch — lễ tân/Owner xử lý lịch bù riêng. |
| INV-19 | **HV vắng ≥3 buổi liên tiếp** (xét theo `attendances` doc của 3 ngày dạy gần nhất từ enrollment startDate): UI HLV hiển thị badge cảnh báo đỏ trên HV đó. Tính client-side, không cần field denormalize. |
| INV-9 | Lễ tân KHÔNG xem báo cáo tổng, KHÔNG xóa dữ liệu (chỉ Owner) |
| INV-10 | Đóng băng giá qua `productSnapshot` |
| INV-11 | Mọi callable ghi tiền phải dùng Firestore **transaction** |
| INV-12 | Mọi đổi giá/role/refund ghi `/auditLogs` append-only (không update/delete) |
| INV-13 | OTP chỉ chấp nhận **+84** + reCAPTCHA SMS defense |
| INV-14 | Mọi callable bật `requireAppCheck` ở prod |
| INV-20 | **Khách hàng KHÔNG được tự đổi `fullName`** sau khi đã set. Firestore rules block self-update khi `resource.data.fullName != ''`. UI ẩn nút Pencil ở `/profile`. Đổi tên chỉ qua callable `updateCustomerName` (Owner + Lễ tân) tại `/admin/customers`. Lý do: tránh lễ tân tra SĐT bị nhầm khách do tự đổi tên. |
| INV-21 | **Điểm danh khoá học không kiểm giờ ca** — chỉ kiểm `weekday` (đúng ngày dạy). Khách đến sớm/muộn so với ca vẫn được điểm danh; số buổi `attendedSessions` không phụ thuộc giờ. Lý do: trải nghiệm flexible cho gia đình + lễ tân không cần giải thích "chưa đến giờ học". Vẫn block nếu sai weekday (tránh điểm danh ngày HLV nghỉ). |

## 6. Vòng đời

**Order**: `DRAFT → PENDING_PAYMENT → PAID → ACTIVE` (hoặc `CANCELLED` timeout 24h / staff; `PAID → REFUNDED` Owner only). Owner có thể `DELETE` ở mọi trạng thái (v2.3 — không cần lý do, 1 click).

**Enrollment**: `ACTIVE` → `COMPLETED` (đủ 15) / `EXPIRED` (>90 ngày) / `CANCELLED` (Owner hoàn tiền). Đều push lý do + giải phóng slot.

**CheckinRequest (vé lượt, v2.3)**: `PENDING` (khách quét QR, lễ tân chưa duyệt) → `APPROVED` (lễ tân xác nhận, trừ lượt) / `REJECTED` (lễ tân từ chối, kèm lý do) / `CANCELLED` (khách tự huỷ trước khi lễ tân thao tác). **Không có TTL** — request giữ PENDING vô thời hạn cho đến khi có hành động. Khách nhận push realtime mỗi lần đổi trạng thái.

**CoachAbsence (v2.4)**: doc dạng `/coaches/{coachId}/absences/{YYYY-MM-DD_H}` (key = ngày + ca giờ). HLV tạo → server push tất cả HV đang học ca đó với `type:"COACH_OFF"`. Không có vòng đời — doc tồn tại = ca nghỉ. Lễ tân/Owner có thể xóa nếu HLV báo nhầm.

**CoachNote (v2.4)**: append vào `Enrollment.coachNotes[]` (đã có sẵn trong schema từ v1). HLV gọi `addCoachNote({ enrollmentId, text })` → server append `{ text, at }` vào array; KHÔNG cho xóa/sửa (chỉ append).

## 7. Quy tắc thẻ
- **Vé thời hạn (membership)**: chỉ chủ thẻ, không mượn/dẫn miễn phí. Check-in 1 chạm trừ ngày (không trừ lượt).
- **Gói lượt**: check-in nhóm — **lễ tân duyệt**: khách quét QR → màn lễ tân pop-up thông tin vé (chủ thẻ, lượt còn, audience) → lễ tân nhập số lượt cần trừ (default = khách gợi ý) → bấm "Xác nhận" → trừ thực tế + push khách. Gói người lớn dùng cho mọi đối tượng; gói trẻ em chỉ trẻ em (người lớn đi cùng mua vé lẻ).
- **Điểm danh hộ (khách quên điện thoại)**: lễ tân tra SĐT → chọn thẻ (vé lượt **hoặc** khóa học) → nhập số lượt (nếu vé lượt) → xác nhận → server trừ + push khách qua FCM/inbox.

## 8. Tính năng v1 (chốt)

### Customer/Parent
- Đăng ký 3 bước: SĐT 10 số `0xxxxxxxxx` → OTP → tên. Helper `normalizeVNPhone()` convert sang E.164 trước khi gọi Firebase. UI hiển thị `0947 010 978`. Regex `/^0\d{9}$/`.
- Home: Mua thẻ · Mua khóa · Check-in · Thẻ của tôi · **Khóa học của tôi**.
- **Flow Dịch vụ (v2.3)** — restructure: Bước 1 **chọn loại** (3 card lớn: **Học bơi** nổi bật/đứng đầu với gradient + "Phổ biến nhất" badge · **Vé thời hạn** · **Vé lượt**) → Bước 2 chọn gói cụ thể (vd "15 lượt" / "30 lượt" hoặc "1 tháng / 3 / 6 / 1 năm") → Bước 3 **chọn áp dụng giá theo** (radio: trẻ <1.4m · trẻ ≥1.4m · người lớn) → Bước 4 chọn người thụ hưởng (bản thân / con) → Bước 5 review tóm tắt giá + bấm "Xác nhận đặt" → đơn `PENDING_PAYMENT` chờ lễ tân xác nhận tiền mặt.
- **Wizard khóa học 4 bước**: Học cho ai → Kiểu → HLV → **Ca gộp theo khung giờ** (VD "14h–15h (T3-T5-T7) · Còn N chỗ") → Xác nhận. Server tự chọn `startDate` = ngày dạy gần nhất; nút ±tuần (giới hạn ±4). **Fix v2.3**: client phải gửi đủ `coachId + hourGroup + weekOffset`; nếu state bị reset khi chuyển bước → preserve qua React state thay vì query param.
- **`/my-courses`**: list enrollment (bản thân + con). Card: emoji + kiểu, người học (chip "Con"), HLV, lịch gộp, progress X/15, ngày còn lại, chip trạng thái. Sort: ACTIVE (gần hết hạn trước) → COMPLETED → EXPIRED/CANCELLED. Chi tiết: header + thông tin HV + Zalo HLV + lịch học + tiến độ + lịch sử buổi (`/enrollments/{id}/attendances`) + banner cảnh báo (≤10 buổi/≤7 ngày = cam, EXPIRED = đỏ) + 5 notification gần nhất.
- Ví thẻ điện tử (mặt trước + ô lượt).
- **Check-in (v2.5 cập nhật INV-21)** (INV-17 — restructure E2 + hotfix):
  - **Vé thời hạn KHÔNG quét QR**: chỉ là banner "Bạn có N vé thời hạn — xuất trình thẻ ở /cards cho lễ tân kiểm tra". Không vào bộ chọn thẻ.
  - **Bộ chọn thẻ** chỉ gồm: **khóa học** (mỗi enrollment 1 card) + **vé lượt** (mỗi ticketPackage 1 card). Khách bấm chọn 1 card → "Bắt đầu quét QR".
  - **Xử lý theo loại**:
    - **Khóa học** (`forceKind:"COURSE"`): server kiểm `weekday` đúng ngày dạy + chưa điểm danh hôm nay → ghi `/enrollments/{id}/attendances/{date}` + push. **Không kiểm `startHour/endHour` (INV-21, v2.5)** — khách đến sớm/muộn vẫn được tính buổi.
    - **Vé lượt**: server tạo `/checkinRequests/{id}` status `PENDING` với `suggestedCount=1` → UI khách hiển thị "Đang chờ lễ tân duyệt..." → khi lễ tân duyệt → "Đã trừ X lượt thành công · còn Y" (X do lễ tân chốt).
  - **Bỏ hoàn toàn UI "Số người cùng vào"** (Stepper + slider trẻ/người lớn) — số lượt thật do lễ tân chốt khi duyệt.
- **Profile (v2.5)**: nút Pencil ẩn nếu `fullName` đã set; banner "ℹ️ Để đổi tên trên thẻ, vui lòng liên hệ lễ tân tại hồ bơi." Khách mới đăng ký (fullName rỗng) vẫn cho set lần đầu. Firestore rules block diff `fullName` ở self-update (INV-20).
- CRUD trẻ em (tên/DOB **không bắt buộc chiều cao**; audience sẽ chọn lúc mua thẻ). Trường `heightCm` ẩn ở form đăng ký, vẫn giữ optional trong data model.
- **Back button**: mọi trang chi tiết/wizard (không phải tab root: Home/Thẻ/Dịch vụ/Hồ sơ) có nút ← ở header trái → router.back().
- FCM Web Push (iOS cần Add-to-Home-Screen).

### Receptionist
- Dashboard: đơn pending hôm nay · check-in hôm nay · doanh thu hôm nay **chia theo Loại × Đối tượng** (KHÔNG hiển thị tổng tháng/năm) · **Hàng đợi check-in vé lượt** (realtime list các request chờ duyệt — đã có UI nhập count + Duyệt/Từ chối + audio beep khi có request mới — v2.4). **Bảng chéo + bar chart fix v2.5** (xem §12.quinquies G3).
- Đăng ký khách mới, xác nhận thanh toán, **duyệt check-in vé lượt** (xem thông tin vé + chỉnh số lượt + xác nhận), **check-in hộ cho cả vé lượt và khóa học** (chọn loại thẻ → nhập số lượt nếu vé lượt → xác nhận → push khách), gia hạn, **sửa tên khách hàng** ở `/admin/customers` (Pencil icon — v2.5).
- **`/admin/checkin-assist` autocomplete SĐT (v2.5, G4)**: load realtime danh bạ khách (CUSTOMER/PARENT, limit 2000) qua `onSnapshot`; khi gõ ≥3 chữ số → dropdown gợi ý tối đa 8 match (theo prefix `local` hoặc raw); click suggestion = tự fill input + trigger search.
- **Điểm danh hộ (v2.4.1 — đảo lại E1)**: tra SĐT khách. Server normalize SĐT → query Firestore → **nếu rỗng, fallback `admin.auth().getUserByPhoneNumber`**:
  - **Auth có user**: server **AUTO-CREATE doc placeholder** trong Firestore (`role:"CUSTOMER"`, `fullName:""`, `_synced:true`) + audit log `AUTO_CREATE_USER_FROM_AUTH` → lễ tân thao tác ngay; UI hiển thị thông báo nhẹ "Đã tạo hồ sơ tạm — khách có thể đổi tên sau khi mở app".
  - **Auth không có**: throw `not-found` → toast đỏ "Khách chưa từng đăng ký với SĐT này".
  - Trade-off: chấp nhận risk doc placeholder nếu Owner gõ nhầm (audit log đủ để rollback). Lợi ích: lễ tân không bị chặn, test numbers ở Firebase Console cũng tra được.
- **Quản lý đơn**: filter trạng thái + loại + **date-range picker** (Hôm nay/Hôm qua/7 ngày/Tháng này/Tháng trước/Năm này/tùy chỉnh), nhóm theo ngày. Chỉ thấy "Hủy đơn" cho PENDING.

### Coach (v2.4 — hoàn thiện E3 + E4)
- **Hôm nay**: lịch dạy theo ca (sáng/chiều) + đếm số HV/ca, badge "Đầy" khi đạt cap 20. Nút "Báo nghỉ" ở mỗi ca → bottom sheet xác nhận → callable `reportCoachAbsence` → push tất cả HV ca đó.
- **Học viên của tôi** (cải thiện UI):
  - List HV ACTIVE của HLV (query `enrollments.coachId == self.coachId && status == "ACTIVE"`).
  - Mỗi row: emoji kiểu bơi · tên HV · ca · `attended/15` · **badge cảnh báo đỏ "Vắng N buổi"** nếu HV vắng ≥3 buổi liên tiếp (tính client-side từ `attendances` doc) · Zalo deeplink · nút "Ghi chú" mở chi tiết.
  - Tap row → bottom sheet/modal chi tiết HV: thông tin + lịch sử buổi học (10 gần nhất) + **textarea ghi chú** + list `coachNotes` cũ (read-only). Submit → `addCoachNote` callable → append vào `Enrollment.coachNotes[]`.
- **Báo nghỉ ca** (INV-18): nút "Báo nghỉ" trên màn "Hôm nay" → chọn ca → confirm → push HV ca đó với title "HLV báo nghỉ" + ngày/giờ ca + tên HLV. Server đánh dấu `/coaches/{coachId}/absences/{YYYY-MM-DD_H}`.
- **Highlight HV vắng ≥3 buổi liên tiếp** (INV-19): query `attendances` 5 buổi gần nhất, đếm số buổi liên tiếp `present === false` (hoặc thiếu doc khi đáng lẽ phải có) tính từ now lùi về. Nếu ≥3 → badge đỏ. Tap badge xem chi tiết các buổi.
- **Logout** ở header layout `(coach)` (v2.1) — giữ nguyên.

### Owner
- Toàn bộ Lễ tân +
- **Báo cáo doanh thu realtime** từ `/orders` PAID: filter Ngày/Tháng/Năm/Tùy chỉnh (default = tháng hiện tại); **bảng chéo Loại × Đối tượng** + bar chart phụ + tổng + count unique khách. CSV optional. **Fix v2.5 (G3)**: hàng "Khóa học bơi" cell merge `colSpan={3}` (giá phẳng note) — không còn nhồi số vào "Trẻ <1.4M"; hàng TỔNG `colSpan={audiences.length+1}` căn phải đúng; bar chart tách 2 hàng (bar + label) + parent `h-full` để `height: %` resolve được.
- Sửa bảng giá `/admin/products` matrix → `/settings/pricing`.
- CRUD HLV `/admin/coaches` (tự tạo 10 ca/ngày dạy, không xóa HLV còn HV).
- **Phân quyền** `/admin/staff`: gán role + **"Gỡ quyền"** về CUSTOMER (clear claim + audit `REVOKE_ROLE`); KHÔNG cho Owner tự gỡ; phải còn ≥1 OWNER khác. Cột "Cấp ngày" từ auditLogs.
- **Xóa đơn (v2.3)**: 1 click — không dialog confirm, không yêu cầu lý do; xóa **document `orders/{id}`** + payment + audit log `DELETE_ORDER` (giữ thông tin cũ để recovery). Thẻ/membership/package/enrollment đã sinh **vẫn còn** (gắn `orderDeleted:true`, vận hành bình thường). Áp dụng cho mọi trạng thái: PENDING/PAID/CANCELLED/REFUNDED.
- Hoàn tiền PAID: bắt buộc lý do, khóa thẻ, push, audit.
- `/admin/qr-gate`: tablet cổng, QR rotation 30s, full-screen.
- **Khách hàng `/admin/customers`** (fix v2.3 + v2.4.1 + v2.5):
  - List **mọi user có `role=CUSTOMER`** (sửa từ v2.3: list `/users` rồi filter client-side, không phụ thuộc where).
  - **Fix v2.5 (G1)**: bỏ `orderBy("createdAt","desc")` ở query — Firestore loại doc thiếu field này → trước đó số `0857906079` (legacy doc không có `createdAt`) không hiện. Sort client-side, doc thiếu ngày đẩy cuối.
  - **CRUD v2.5 (G1)**:
    - **Thêm khách** (Owner): callable `createCustomerByPhone({phone, fullName?})` — normalize SĐT, `getUserByPhoneNumber` (tạo Auth user mới nếu chưa có) + tạo doc Firestore `role:CUSTOMER` + `_createdByOwner:true` + audit `CREATE_CUSTOMER`. Từ chối nếu doc đã có role OWNER/RECEPTIONIST/COACH (chống biến staff thành customer).
    - **Sửa tên** (Owner + Lễ tân): callable `updateCustomerName({uid, fullName})` — validate 1..60 ký tự, update + audit `UPDATE_CUSTOMER_NAME` (from/to).
    - **Xoá khách** (Owner-only): callable `deleteCustomer({uid})` — block self-delete + block role-holders; xoá doc Firestore + `admin.auth().deleteUser(uid)` + audit `DELETE_CUSTOMER`. Modal xác nhận trước khi xoá (1 click không an toàn vì Auth user mất luôn).
  - **Nút "Đồng bộ Auth" (v2.4.1, Owner-only)**: gọi callable `syncAllAuthUsersToFirestore` → server liệt kê tối đa 1000 user/page từ Firebase Auth → tạo doc placeholder cho ai chưa có `/users/{uid}` (gắn `_synced:true`). Toast hiển thị `{created} hồ sơ mới / {scanned} quét`. Dùng khi: Owner tạo test number ở Console nhưng chưa thấy khách trong list; hoặc khôi phục data sau khi xóa Firestore.
- **Layout admin (fix v2.3)**: nút "Đăng xuất" ở footer sidebar (desktop) **và** ở header (mobile) phải luôn hiển thị trên mọi route con (`/admin/products`, `/admin/reports`, …), không bị ẩn khi chuyển sub-page. Bug do component remount hoặc CSS overflow ẩn nút.

## 9. NFR
- Lighthouse mobile ≥90 (LCP ≤2.5s 4G, TTI ≤4s).
- Owner đổi giá → khách thấy <3s.
- Uptime ≥99%. Offline xem được thẻ (Firestore cache).
- App Check + SMS region +84 only.
- Cloud Functions cold start ≤2s p95, ≤$20/tháng.
- Tap target ≥44×44, contrast AA.

## 10. Data Model

```
User ─┬─< Child
      ├─< Order ─┬─> Payment (1-1)
      │          └─> Membership | TicketPackage | Enrollment
      ├─< Checkin
      ├─< Notification
      └─< Coach (1-0..1, chỉ COACH)

Coach ─< Slot (max 10 × 7 weekday)
Coach ─< Absence (v2.4, /coaches/{id}/absences/{YYYY-MM-DD_H})
Slot ─< Enrollment (max 20)
Enrollment.coachNotes[]  (v2.4 — append-only via callable)

Settings.pricing (singleton) ── realtime ─→ Customer pricing UI
AuditLog (append-only)
CheckinRequest (v2.3, vé lượt, không TTL) ── realtime ─→ Lễ tân duyệt
```

**CheckinRequest** `/checkinRequests/{id}` (mới v2.3):
```
userId, beneficiaryKind, beneficiaryId, beneficiaryName
ticketPackageId            (vé đề xuất dùng)
suggestedCount             (v2.4: luôn = 1, không cho khách tự khai)
approvedCount              (lễ tân chốt; null khi PENDING)
status: "PENDING"|"APPROVED"|"REJECTED"|"CANCELLED"
qrTokenId                  (single-use, đã consume khi tạo request)
createdAt                  (không có expiresAt — không TTL)
resolvedAt?, resolvedBy?   (uid lễ tân, hoặc uid khách nếu CANCELLED)
rejectReason?
checkinId?                 (link sang /checkins khi APPROVED)
```

**CoachAbsence** `/coaches/{coachId}/absences/{YYYY-MM-DD_H}` (mới v2.4):
```
coachId, date (YYYY-MM-DD), startHour (number)
reason?           (HLV nhập optional)
createdAt, createdBy (= coachId của HLV)
notifiedCount     (số HV đã push thành công)
```

**CoachNote** — append vào `Enrollment.coachNotes[]`:
```
{ text: string (1..500), at: Timestamp }
```
Chỉ HLV đứng lớp được thêm (callable check `coachId == enrollment.coachId`); chỉ append, không update/delete cá nhân note.

**Convention** (khớp `src/types/index.ts`):
- `ProductType`: `"PASS" | "PACKAGE" | "SWIM_COURSE"`
- `beneficiaryKind` / `holderKind` / `studentKind`: `"USER" | "CHILD"`
- `SwimStyle`: `"BREASTSTROKE" | "FREESTYLE" | "BACKSTROKE" | "BUTTERFLY"`
- Lượt: `totalSessions` / `remainingSessions`
- Khóa học: `totalSessions=15` / `attendedSessions`
- `fcmTokens: string[]`
- Slot ID: `${coachId}_${weekday}_${startHour}`
- Member code: counter `/counters/memberCode` bắt đầu từ 100

**Bất biến dữ liệu**:
- `Order.productSnapshot` đóng băng giá (INV-10)
- `Membership.endDate = startDate + PASS_DAYS[duration]`
- `TicketPackage.remainingSessions = totalSessions - sum(usageHistory.count)` (transaction)
- `Enrollment.attendedSessions ≤ 15`, `expiryDate = startDate + 90 days`
- `CheckinRequest.status` chỉ chuyển từ `PENDING` sang `APPROVED/REJECTED/EXPIRED` 1 lần (transaction); `approvedCount > 0 && approvedCount ≤ remainingSessions` (INV-15)
- `Enrollment.coachNotes[]` chỉ append, không update/delete cá nhân (INV-12). Mỗi note 1..500 ký tự.
- `CoachAbsence` doc tồn tại = ca nghỉ; không có status, không vòng đời.

## 11. Phạm vi

✅ **v1**: 5 role + RBAC claim · bán/kích hoạt vé tháng/gói lượt/khóa · thẻ điện tử · QR rotation 30s · báo cáo realtime · pricing động · CRUD HLV/role qua UI · hoàn tiền + audit · FCM Web Push · PWA · 100% tiếng Việt.

⏸ **Hoãn**: lịch nghỉ hồ, giờ mở cửa cấu hình, quên mật khẩu/đổi SĐT, đánh giá HLV, biên lai VAT, marketing/voucher, cổng thanh toán online (VNPay/MoMo), audit log UI nâng cao, offline-first đầy đủ, native iOS/Android, multi-tenant.

## 12. Rủi ro chính
- Screenshot QR → INV-8 rotation + nonce single-use.
- SMS pumping → INV-13 region +84 + reCAPTCHA + App Check.
- Race booking slot → INV-11 transaction.
- Sai giá hàng loạt → INV-10 freeze + INV-12 audit.
- Mất Firebase giờ cao điểm → cache + lễ tân ghi sổ tay backup.
- Mất data → `firestore:backups` daily, giữ 30 ngày.

## 12.bis Changelog v2.3 (2026-06-22) — UAT round 4

9 chỉnh sửa từ feedback Owner sau khi dùng thử trên máy local:

| # | Mã | Mô tả tóm tắt | Loại |
|---|---|---|---|
| 1 | D1 | Xóa đơn 1-click không dialog, xóa thẳng Firestore | Owner UX |
| 2 | D2 | Back button ở mọi trang chi tiết/wizard (header trái ←) | Toàn cục UX |
| 3 | D3 | Fix logout ẩn khi vào `/admin/products`, `/admin/reports` (layout admin) | Bugfix |
| 4 | D4 | Fix wizard khóa học báo "Thiếu HLV/khung giờ/ngày bắt đầu" dù đã chọn | Bugfix |
| 5 | D5 | Vé lượt: khách quét QR → request `PENDING` → lễ tân duyệt + chỉnh số lượt (INV-15) | Tính năng mới |
| 6 | D6 | Bỏ trường chiều cao ở form đăng ký trẻ; audience chọn lúc mua thẻ (INV-16) | UX |
| 7 | D7 | Restructure flow Dịch vụ: Học bơi (nổi bật, đầu) / Vé thời hạn / Vé lượt → gói → audience → người thụ hưởng → xác nhận | UX |
| 8 | D8 | Fix `/admin/customers` không hiển thị khách (query/rules bug) | Bugfix |
| 9 | D9 | Điểm danh hộ mở rộng cho vé lượt (hiện chỉ khóa học) | Tính năng mới |

Chi tiết kỹ thuật xem [`.agent/IMPLEMENTATION-PLAN.md`](.agent/IMPLEMENTATION-PLAN.md) §18.

## 12.ter Changelog v2.4 (2026-06-23) — UAT round 5

4 chỉnh sửa từ feedback Owner sau khi dùng thử v2.3:

| # | Mã | Mô tả tóm tắt | Loại |
|---|---|---|---|
| 1 | E1 | Fix bug điểm danh hộ không tìm thấy khách (vd 0900000002): server normalize SĐT + query Firestore; nếu rỗng → fallback tra Firebase Auth chỉ để chẩn đoán + trả error code rõ (`not-found` / `incomplete-profile`); UI hiển thị hướng dẫn cụ thể cho lễ tân. KHÔNG auto-create doc. | Bugfix |
| 2 | E2 | Customer check-in restructure (INV-17): bỏ hoàn toàn UI "Số người cùng vào" + slider trẻ/người lớn; thay bằng **bộ chọn thẻ** (radio list mọi thẻ active: khóa học · vé thời hạn · vé lượt); khách chọn 1 thẻ → quét QR → server xử lý đúng loại (`forceKind`); vé lượt luôn gửi `suggestedCount=1`, lễ tân chốt số thật khi duyệt | UX |
| 3 | E3 | Dashboard lễ tân — Hàng đợi check-in vé lượt: thêm audio beep + visual highlight khi có request mới (request đầu tiên + request thêm vào); verify UI nhập count + Duyệt/Từ chối hoạt động ổn | UX |
| 4 | E4 | Màn HLV hoàn thiện: **Ghi chú HV** (callable `addCoachNote` append vào `Enrollment.coachNotes[]`; UI bottom sheet chi tiết HV); **Báo nghỉ ca** (callable `reportCoachAbsence` tạo `/coaches/{id}/absences/{date_hour}` + push toàn bộ HV ca đó với type `COACH_OFF`); **Highlight HV vắng ≥3 buổi liên tiếp** (badge đỏ tính client-side từ `attendances`) | Tính năng mới |

INV mới: INV-17, INV-18, INV-19.
Callable mới: `addCoachNote`, `reportCoachAbsence`, `searchCustomerByPhone` (E1 fallback).
Collection mới: `/coaches/{coachId}/absences/{YYYY-MM-DD_H}`.

Chi tiết kỹ thuật xem [`.agent/IMPLEMENTATION-PLAN.md`](.agent/IMPLEMENTATION-PLAN.md) §19.

## 12.quater Changelog v2.4.1 (2026-06-23 hotfix) — Owner feedback ngay sau v2.4

4 sửa lỗi nhanh sau khi Owner test bản v2.4 trên local:

| # | Mã | Mô tả tóm tắt | Loại |
|---|---|---|---|
| 1 | F1 | Vé thời hạn KHÔNG còn quét QR — chỉ banner "Xem thẻ" link `/cards` ở trang `/checkin`. Bộ chọn thẻ chỉ còn COURSE + PACKAGE | UX |
| 2 | F2 | Đảo lại E1: `searchCustomerByPhone` + `findUserUidByPhone` AUTO-CREATE doc placeholder khi Auth có user nhưng Firestore không (thay vì throw `incomplete-profile`). Audit `AUTO_CREATE_USER_FROM_AUTH`. UI badge nhẹ "Đã tạo hồ sơ tạm" | Bugfix |
| 3 | F3 | Thêm callable `syncAllAuthUsersToFirestore` (Owner-only) + nút "Đồng bộ Auth" ở `/admin/customers` → bulk tạo doc cho test numbers / user Auth-only | Tính năng mới |
| 4 | F4 | Lỗi "Lưu thất bại: internal" khi thêm ghi chú HV ở v2.4 = callable `addCoachNote` chưa được deploy. Nhắc rõ trong README: phải chạy `firebase deploy --only functions,firestore:rules` sau khi pull bản v2.4+. Không phải bug code | Vận hành |

**Lệnh deploy bắt buộc sau khi pull v2.4 / v2.4.1**:
```powershell
firebase deploy --only functions,firestore:rules
```
Nếu skip → các callable mới (`searchCustomerByPhone`, `addCoachNote`, `reportCoachAbsence`, `syncAllAuthUsersToFirestore`) trả `internal` error vì chưa tồn tại trên server.

Chi tiết kỹ thuật xem [`.agent/IMPLEMENTATION-PLAN.md`](.agent/IMPLEMENTATION-PLAN.md) §19.6.

## 12.quinquies Changelog v2.5 (2026-06-24) — UAT round 6

6 chỉnh sửa từ feedback Owner sau khi dùng thử v2.4.1:

| # | Mã | Mô tả tóm tắt | Loại |
|---|---|---|---|
| 1 | G1 | `/admin/customers` chỉ hiện 2/5 số test (`0857906079` ẩn). Root cause: `orderBy("createdAt","desc")` loại doc thiếu field. Bỏ orderBy, sort client-side (doc thiếu createdAt đẩy cuối). | Bugfix |
| 2 | G2 | CRUD khách hàng từ `/admin/customers`: callable `createCustomerByPhone` (Owner — tạo Auth user nếu chưa có + doc Firestore + audit `CREATE_CUSTOMER`); `updateCustomerName` (Owner + Lễ tân — validate 1..60 ký tự + audit `UPDATE_CUSTOMER_NAME`); `deleteCustomer` (Owner — block self + role-holders, xoá Auth + doc + audit `DELETE_CUSTOMER`). UI: nút "Thêm khách" + Pencil + Trash, 3 modal (Create / EditName / ConfirmDelete). | Tính năng mới |
| 3 | G2b | Khoá khách hàng tự đổi `fullName` (INV-20): Firestore rules block self-update khi `resource.data.fullName != ''`; UI `/profile` ẩn nút Pencil + banner "Liên hệ lễ tân để đổi tên". Cho phép set lần đầu khi `fullName` rỗng (khách mới đăng ký). | Bugfix |
| 4 | G3 | Sửa bảng `CrossTable` (Dashboard + Báo cáo): hàng `Khóa học bơi` colSpan(3) (giá phẳng), không nhồi số vào cột "Trẻ <1.4M"; hàng TỔNG colSpan(`audiences.length+1`) căn phải đúng; bar chart không hiện cột do `height: %` áp vào div không có chiều cao xác định → tách thành 2 hàng (bars + labels) + parent `h-full`. Fix luôn `HourBars` ở Dashboard. | Bugfix UI |
| 5 | G4 | `/admin/checkin-assist` autocomplete SĐT: load realtime danh bạ khách (CUSTOMER/PARENT, limit 2000) qua `onSnapshot`; khi gõ ≥3 chữ số → dropdown gợi ý tối đa 8 match (theo prefix `local` hoặc raw); click suggestion = tự fill input + trigger search; click-outside đóng dropdown qua `useRef`. | UX |
| 6 | G5 | Bỏ check `hour < s.startHour ∥ hour >= s.endHour` ở `processCheckin` (cả nhánh `forceKind:"COURSE"+targetId` lẫn auto-search): cho phép điểm danh khoá học bất kỳ thời điểm nào trong ngày dạy (INV-21). Vẫn giữ check `weekday`. Lý do: khách đến sớm/muộn so với ca vẫn được tính buổi, lễ tân không cần giải thích "Chưa đến giờ học". | Tính năng/UX |

INV mới: INV-20 (khách không tự đổi tên), INV-21 (không kiểm giờ ca khi điểm danh khoá).
Callable mới: `createCustomerByPhone`, `updateCustomerName`, `deleteCustomer`.
Audit log mới: `CREATE_CUSTOMER`, `UPDATE_CUSTOMER_NAME`, `DELETE_CUSTOMER`.

**Lệnh deploy sau khi pull v2.5**:
```powershell
firebase deploy --only functions,firestore:rules
```

Chi tiết kỹ thuật xem [`.agent/IMPLEMENTATION-PLAN.md`](.agent/IMPLEMENTATION-PLAN.md) §20.

## 13. PDPL 2026 (Luật 91/2025/QH15 + NĐ 356/2025, hiệu lực 01/01/2026)

**Thu thập** (cơ bản): SĐT, tên, chiều cao trẻ, FCM token, lịch sử check-in/giao dịch. **KHÔNG**: CMND, email, địa chỉ, sinh trắc, GPS.

**Checklist còn lại trước launch**:
- Trang `/privacy` (mục đích, thời gian lưu, quyền chủ thể).
- Callable `deleteAccount`: ẩn danh hóa SĐT/tên, giữ giao dịch (kế toán 10 năm).
- Template báo Cục An ninh mạng trong 72h khi vi phạm.
- Firebase asia-southeast1 (Singapore) = cross-border → ghi rõ trong privacy + consent.
- Đăng ký Cục nếu ≥10.000 chủ thể VN (hiện 2–3k → theo dõi).

**Lưu trữ**: account active → vô thời hạn · yêu cầu xóa → ẩn danh · audit log → vĩnh viễn · FCM token tự xóa sau 30 ngày inactive.

## 14. Definition of Done (v1)

**Chức năng**: đăng ký → mua vé → thanh toán → thẻ → check-in OK · gói lượt nhóm 3 người trừ đúng · PARENT mua khóa cho con + điểm danh hộ · đổi giá 500k→600k áp đúng đơn mới + giữ đơn cũ · Lễ tân chặn `/admin/reports` · hoàn tiền có lý do + khóa thẻ + audit · HLV thấy đúng HV + Zalo · cron `cancelUnpaidOrdersHourly` chạy 24h.

**Phi-chức-năng**: Lighthouse ≥90 · App Check 12 callable · SMS +84 · backups daily 30d · transaction verified · `/privacy` đầy đủ.

**Vận hành**: Owner active · ≥1 Lễ tân train · 2 HLV (Tùng, Tín) · tablet ghim `/admin/qr-gate` · số test +84900000001–003 active.

## Tài liệu liên quan
- [`.agent/PRD.md`](.agent/PRD.md) — PRD đầy đủ
- [`.agent/IMPLEMENTATION-PLAN.md`](.agent/IMPLEMENTATION-PLAN.md) — kỹ thuật
- [`.agent/TASKS.md`](.agent/TASKS.md) — task list
- `memory/pricing-matrix.md` — bảng giá tham chiếu nhanh
- `memory/build-environment.md` — quirks máy dev RAM thấp
