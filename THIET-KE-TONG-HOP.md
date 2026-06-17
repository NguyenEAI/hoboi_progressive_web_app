# HỆ THỐNG QUẢN LÝ HỒ BƠI PROSPER PLAZA — THIẾT KẾ TỔNG HỢP (v1)

> Tài liệu chốt thiết kế trước khi code. Cập nhật: 2026-06-11.
> Đơn vị: CÔNG TY TNHH HT BẢO LÂM — Hồ Bơi Chung Cư Prosper Plaza.
> Địa chỉ: 22/14 Phan Văn Hớn, P. Tân Đông Hưng Thuận, TP. Hồ Chí Minh.

---

## 1. CÔNG NGHỆ

- **Frontend:** Next.js 15 + TypeScript + TailwindCSS + Shadcn/UI + PWA
- **Backend:** Firebase Auth (Phone OTP) · Firestore · Storage · Cloud Messaging (FCM) · Cloud Functions
- **Hosting:** Vercel
- **Quy mô:** ~2.000–3.000 thành viên/năm → Firebase dư sức. Chi phí chính là SMS OTP (giảm bằng session dài).

---

## 2. VAI TRÒ & PHÂN QUYỀN

| Vai trò | Quyền chính | Không được |
|---|---|---|
| OWNER | Toàn quyền: quản lý HLV, nhân viên, giá, khách, đơn, thẻ, báo cáo, cấu hình | — |
| RECEPTIONIST | Đăng ký khách, xác nhận thanh toán, check-in hộ, điểm danh hộ, gia hạn | Xem báo cáo tài chính tổng · Xóa dữ liệu |
| COACH | Xem lịch dạy, xem học viên (đầy đủ), ghi chú, báo nghỉ, nhắn Zalo, cảnh báo vắng | Điểm danh (đã bỏ — tự động qua QR) |
| CUSTOMER | Đăng ký/đăng nhập, xem dịch vụ, mua, xem thẻ, check-in, nhận thông báo | — |
| PARENT | Như Customer + quản lý nhiều trẻ em | — |

> CHILD (trẻ em) không phải tài khoản đăng nhập — quản lý qua PARENT.

---

## 3. SẢN PHẨM & BẢNG GIÁ (chính thức)

### Vé lẻ (bán tại quầy, KHÔNG qua app — chỉ hiển thị tham khảo)
| Đối tượng | Giá |
|---|---|
| Trẻ em < 1.4m | 25.000 |
| Trẻ em > 1.4m | 30.000 |
| Người lớn | 35.000 |
| Người lớn + trẻ < 2 tuổi | 40.000 |

### Vé thời hạn (không giới hạn lượt) — giá theo 3 đối tượng
| Đối tượng | 1 Tháng | 3 Tháng (Quý) | 6 Tháng | 1 Năm |
|---|---|---|---|---|
| Trẻ em < 1.4m | 400.000 | 1.000.000 | 1.800.000 | 3.500.000 |
| Trẻ em > 1.4m | 450.000 | 1.150.000 | 2.150.000 | 4.200.000 |
| Người lớn | 500.000 | 1.300.000 | 2.300.000 | 4.400.000 |

### Gói lượt (trừ 1 lượt/check-in) — giá theo 3 đối tượng
| Đối tượng | 15 Lượt | 30 Lượt |
|---|---|---|
| Trẻ em < 1.4m | 300.000 | 550.000 |
| Trẻ em > 1.4m | 350.000 | 700.000 |
| Người lớn | 450.000 | 800.000 |

### Khóa học bơi — GIÁ PHẲNG 1.800.000₫ (không chia đối tượng)
- 4 kiểu cùng giá: 🐸 Bơi cơ bản (ếch) · 🏊 Bơi sải · 🛟 Bơi ngửa · 🦋 Bơi bướm
- 15 buổi · hiệu lực 90 ngày · không yêu cầu điều kiện tiên quyết giữa các kiểu

---

## 4. QUY TẮC NGHIỆP VỤ (INVARIANTS — bắt buộc đúng)

1. **Khóa học KHÔNG thay thế vé vào hồ.** Học 08:00, quay lại 15:00 phải có vé/thẻ riêng.
2. **Khóa học hết hiệu lực sau đúng 90 ngày** kể từ ngày kích hoạt, bất kể học bao nhiêu buổi. Buổi chưa học **bị mất**, không bảo lưu, không hoàn tiền, không học bù tự động.
3. **Mỗi ca tối đa 20 học viên.** Đủ 20/20 → không cho đăng ký.
4. **Lịch HLV cố định:** Thầy Tùng (T4, T6, CN) · Thầy Tín (T3, T5, T7).
5. **Khung giờ dạy:** Sáng 07–11h (4 ca), Chiều 14–20h (6 ca) = 10 ca/ngày. Mỗi ca 60 phút.
6. **Đơn mặc định PENDING_PAYMENT**, chỉ kích hoạt dịch vụ sau khi lễ tân/Owner xác nhận PAID (tiền mặt tại quầy).
7. **Trẻ đi học một mình:** lễ tân tra SĐT phụ huynh → chọn bé → điểm danh hộ → tự push cho phụ huynh.
8. **Check-in QR** dùng mã QR luân phiên của hồ (đổi ~30s) để chống chụp màn hình.
9. **Lễ tân không xem báo cáo tài chính tổng, không xóa dữ liệu.**
10. **Đóng băng giá:** đơn đã mua giữ giá lúc mua; Owner đổi giá chỉ ảnh hưởng đơn mới.

### Quy tắc dùng thẻ
- **Vé thời hạn (tháng/quý/6th/năm):** chỉ chủ thẻ dùng. KHÔNG cho mượn, KHÔNG dẫn người vào miễn phí.
- **Gói lượt — check-in nhóm:** 1 lần quét trừ N ô = N người.
  - Gói **người lớn**: mọi đối tượng dùng được (người lớn + trẻ em).
  - Gói **trẻ em** (cả <1.4m và >1.4m): chỉ trẻ em dùng. Người lớn phải mua vé lẻ (KHÔNG phụ thu).

---

## 5. LUỒNG CHÍNH

### 5.1 Mua dịch vụ (vé/gói/khóa)
```
Khách chọn sản phẩm (+ đối tượng) trên app → Order PENDING_PAYMENT
→ Đến quầy trả tiền mặt → Lễ tân "Xác nhận đã thu" → PAID
→ Cloud Function kích hoạt: tạo Membership/TicketPackage/Enrollment + phát hành thẻ điện tử (số MS tự tăng)
→ Push "Đã kích hoạt"
```

### 5.2 Đăng ký khóa học (Wizard 5 bước)
```
1. Chọn kiểu bơi (ếch/sải/ngửa/bướm)
2. Chọn HLV (Tùng/Tín)
3. Chọn khung giờ (hiện sĩ số x/20, đầy thì khóa)
4. Chọn ngày bắt đầu
5. Xác nhận (học cho bản thân / chọn bé) → Order PENDING_PAYMENT
   (giữ chỗ tạm; nếu 24h không thanh toán → cron hủy, trả slot)
```

### 5.3 Check-in vào hồ
```
Mở app → quét QR cổng → server xác thực:
- Khóa học + đúng ca giờ này → điểm danh
- Gói lượt → hỏi số người → trừ N lượt (kiểm tra đối tượng)
- Vé thời hạn → kiểm tra còn hạn (chỉ chủ thẻ)
- Không có gì hợp lệ → từ chối
```

### 5.4 Kết thúc khóa học
```
- Đủ 15 buổi → COMPLETED → push chúc mừng + đề xuất kiểu bơi khác → giải phóng slot
- Hết 90 ngày chưa đủ → EXPIRED → push kèm LÝ DO rõ ràng → giải phóng slot
- KHÔNG cấp chứng nhận, KHÔNG ưu đãi khóa mới (theo yêu cầu chủ)
```

### 5.5 Thông báo tự động (FCM)
- Khóa học: còn 10 / 5 / 1 buổi.
- Hết hạn (vé & khóa): còn 30 / 7 / 1 ngày.
- Điểm danh con thành công. Đơn chưa thanh toán. Kích hoạt dịch vụ.

---

## 6. DATA MODEL (Firestore collections)

```
/users/{uid}                        role, fullName, phone, heightCm, fcmTokens, childrenIds
/users/{uid}/children/{childId}     fullName, dob, heightCm
/users/{uid}/notifications/{id}
/coaches/{coachId}                  fullName, weekdays[], active
/coaches/{coachId}/slots/{slotId}   weekday, startHour, endHour, capacity=20, enrolledCount
/products/{id}                      type, name, audience-priced matrix, active(toggle)
/pricingRules/{id}                  vé lẻ 4 mức (tham khảo)
/orders/{id}                        customerId, productSnapshot, audience, amount, status, coach/slot/startDate
/payments/{id}
/memberships/{id}                   type(MONTH_1/3/6/YEAR), audience, ownerUserId, start/end, status
/ticketPackages/{id}                size(15/30), audience, remaining, usageHistory[], status
/enrollments/{id}                   swimStyle, studentId, coachId, slotId, attended, expiryDate, status
/enrollments/{id}/attendances/{date}
/checkins/{id}                      kind, refId, groupSize, result, at
/qrTokens/{id}                      nonce, expiresAt, used
/auditLogs/{id}
/dailyStats/{YYYY-MM-DD}  /monthlyStats/{YYYY-MM}
```

Audience type: `CHILD_UNDER_140 | CHILD_OVER_140 | ADULT` (3 tier).

---

## 7. DANH SÁCH MÀN HÌNH (đã mockup)

**Public:** Landing · Sign-in OTP
**Khách/Phụ huynh:** Home · Dịch vụ (chọn đối tượng) · Wizard khóa học (5 bước) · Check-in QR · Con của tôi · Thông báo · Ví thẻ · Chi tiết thẻ tháng · Thẻ lượt (mặt trước/sau) · Modal check-in nhóm · Hero hoàn thành · Màn hết hạn
**Lễ tân:** Đơn hàng · Điểm danh hộ
**HLV:** Hôm nay (10 ca) · Danh sách ca · Chi tiết học viên · Báo nghỉ dạy · Tổng học viên · Học viên vắng · Preview Zalo
**Owner — Vận hành (Nhóm 1):** Quản lý HLV + Form HLV · Nhân viên · Sản phẩm & Giá · Khách hàng · Đơn hàng nâng cao · Thẻ hoạt động
**Owner — Báo cáo (Nhóm 2):** Doanh thu tổng · Theo sản phẩm & đối tượng · HLV & Khóa học · Lưu lượng vào hồ
**Owner — Dashboard:** KPI hôm nay + tháng + biểu đồ

---

## 8. PHẠM VI v1 vs HOÃN

### Trong v1
- Toàn bộ mục 5, 6, 7 ở trên.
- Thông báo tự động (nội dung + mốc nhắc **hardcode**).
- Giá/giờ/thông tin hồ/bảng vé lẻ: **hardcode** (chưa có UI sửa).

### Hoãn sau launch (Nhóm 3–8)
- Nhóm 3: Lịch nghỉ hồ, giờ mở cửa, sức chứa, thông tin hồ, cấu hình thông báo, sửa bảng giá vé lẻ.
- Quên mật khẩu/đổi SĐT, đánh giá HLV, biên lai, marketing (sinh nhật/giới thiệu), audit nâng cao, offline PWA, cổng thanh toán online.
- Tạm thời: hồ nghỉ Tết/bảo trì → dùng "thông báo hàng loạt" hoặc HLV "báo nghỉ".

---

## 9. CÁC QUYẾT ĐỊNH ĐÃ CHỐT

- ✅ Vé lẻ không vào hệ thống (bán quầy), giữ bảng giá tham khảo.
- ✅ Tone xanh lá, logo HT BAO LAM (nhúng base64).
- ✅ Thẻ điện tử mô phỏng thẻ cứng (mặt trước + mặt sau ô lượt).
- ✅ 3 tier đối tượng + thêm mốc 6 tháng.
- ✅ Khóa học giá phẳng 1.800.000, 4 kiểu, không điều kiện tiên quyết.
- ✅ HLV không điểm danh; check-in QR tự ghi nhận.
- ✅ HLV: báo nghỉ (không gợi ý bù), nhắn Zalo, cảnh báo vắng.
- ✅ Kết thúc khóa: không chứng nhận, không ưu đãi, có gửi lý do khi hết hạn.
- ✅ Giải phóng slot khi COMPLETED/EXPIRED/CANCEL: **ngay lập tức**, không giữ chỗ cho học viên cũ (first-come).
- ✅ Đơn khóa chưa thanh toán giữ chỗ slot **24 giờ** rồi cron tự hủy + trả slot.
- ✅ QR cổng đổi mã mỗi **30 giây** (chống chụp màn hình).
- ✅ Hoàn tiền: chỉ **Owner**, **bắt buộc nhập lý do**, tự khóa thẻ liên quan, ghi audit log.
- ✅ Gia hạn thẻ thủ công: Owner **chọn từ gói có sẵn** (+1 tháng / +15 lượt...), không nhập tay tự do.
```
