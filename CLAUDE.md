# CLAUDE.md — Hệ thống Quản lý Hồ Bơi Prosper Plaza

> Bản tóm tắt PRD v2.1 (2026-06-17). Chi tiết đầy đủ: [`.agent/PRD.md`](.agent/PRD.md).

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
| **OWNER** | Toàn quyền: sửa giá, hoàn tiền, phân/gỡ quyền, xóa đơn, báo cáo tài chính |
| **RECEPTIONIST** | Xác nhận thanh toán, check-in hộ, gia hạn, đăng ký khách mới. KHÔNG xem báo cáo tài chính tổng, KHÔNG xóa cứng dữ liệu |
| **COACH** | Lịch dạy + HV của mình, ghi chú, báo nghỉ, Zalo. KHÔNG điểm danh (QR xử lý) |
| **PARENT** | Mua cho con, quản lý hồ sơ trẻ. CHILD không có account riêng |
| **CUSTOMER** | Mua cho bản thân |

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
| INV-7 | Trẻ đi học một mình: lễ tân tra SĐT phụ huynh → chọn bé → điểm danh hộ → push phụ huynh |
| INV-8 | QR nonce đổi mỗi **30s**, single-use, server cấp |
| INV-9 | Lễ tân KHÔNG xem báo cáo tổng, KHÔNG xóa dữ liệu (chỉ Owner) |
| INV-10 | Đóng băng giá qua `productSnapshot` |
| INV-11 | Mọi callable ghi tiền phải dùng Firestore **transaction** |
| INV-12 | Mọi đổi giá/role/refund ghi `/auditLogs` append-only (không update/delete) |
| INV-13 | OTP chỉ chấp nhận **+84** + reCAPTCHA SMS defense |
| INV-14 | Mọi callable bật `requireAppCheck` ở prod |

## 6. Vòng đời

**Order**: `DRAFT → PENDING_PAYMENT → PAID → ACTIVE` (hoặc `CANCELLED` timeout 24h / staff; `PAID → REFUNDED` Owner only).

**Enrollment**: `ACTIVE` → `COMPLETED` (đủ 15) / `EXPIRED` (>90 ngày) / `CANCELLED` (Owner hoàn tiền). Đều push lý do + giải phóng slot.

## 7. Quy tắc thẻ
- **Vé thời hạn (membership)**: chỉ chủ thẻ, không mượn/dẫn miễn phí.
- **Gói lượt**: check-in nhóm — 1 quét = N người = trừ N lượt. Gói người lớn dùng cho mọi đối tượng; gói trẻ em chỉ trẻ em (người lớn đi cùng mua vé lẻ).

## 8. Tính năng v1 (chốt)

### Customer/Parent
- Đăng ký 3 bước: SĐT 10 số `0xxxxxxxxx` → OTP → tên. Helper `normalizeVNPhone()` convert sang E.164 trước khi gọi Firebase. UI hiển thị `0947 010 978`. Regex `/^0\d{9}$/`.
- Home: Mua thẻ · Mua khóa · Check-in · Thẻ của tôi · **Khóa học của tôi**.
- **Wizard khóa học 4 bước** (rút từ 5): Học cho ai → Kiểu → HLV → **Ca gộp theo khung giờ** (VD "14h–15h (T3-T5-T7) · Còn N chỗ") → Xác nhận. Server tự chọn `startDate` = ngày dạy gần nhất; nút ±tuần (giới hạn ±4).
- **`/my-courses`**: list enrollment (bản thân + con). Card: emoji + kiểu, người học (chip "Con"), HLV, lịch gộp, progress X/15, ngày còn lại, chip trạng thái. Sort: ACTIVE (gần hết hạn trước) → COMPLETED → EXPIRED/CANCELLED. Chi tiết: header + thông tin HV + Zalo HLV + lịch học + tiến độ + lịch sử buổi (`/enrollments/{id}/attendances`) + banner cảnh báo (≤10 buổi/≤7 ngày = cam, EXPIRED = đỏ) + 5 notification gần nhất.
- Ví thẻ điện tử (mặt trước + ô lượt).
- Check-in: chọn số người → preview "Sẽ dùng thẻ X, trừ Y lượt" → quét QR.
- CRUD trẻ em (tên/DOB/chiều cao → tự tính audience).
- FCM Web Push (iOS cần Add-to-Home-Screen).

### Receptionist
- Dashboard: đơn pending hôm nay · check-in hôm nay · doanh thu hôm nay **chia theo Loại × Đối tượng** (KHÔNG hiển thị tổng tháng/năm).
- Đăng ký khách mới, xác nhận thanh toán, check-in hộ, gia hạn.
- **Quản lý đơn**: filter trạng thái + loại + **date-range picker** (Hôm nay/Hôm qua/7 ngày/Tháng này/Tháng trước/Năm này/tùy chỉnh), nhóm theo ngày. Chỉ thấy "Hủy đơn" cho PENDING.

### Coach
- Lịch dạy hôm nay + số HV.
- HV: Zalo deeplink `zalo.me/{phone}`, ghi chú, đánh dấu vắng. Highlight HV vắng ≥3 buổi liên tiếp.
- Báo nghỉ → push HV.
- **Logout** ở header layout `(coach)` (v2.1).

### Owner
- Toàn bộ Lễ tân +
- **Báo cáo doanh thu realtime** từ `/orders` PAID: filter Ngày/Tháng/Năm/Tùy chỉnh (default = tháng hiện tại); **bảng chéo Loại × Đối tượng** + bar chart phụ + tổng + count unique khách. CSV optional.
- Sửa bảng giá `/admin/products` matrix → `/settings/pricing`.
- CRUD HLV `/admin/coaches` (tự tạo 10 ca/ngày dạy, không xóa HLV còn HV).
- **Phân quyền** `/admin/staff`: gán role + **"Gỡ quyền"** về CUSTOMER (clear claim + audit `REVOKE_ROLE`); KHÔNG cho Owner tự gỡ; phải còn ≥1 OWNER khác. Cột "Cấp ngày" từ auditLogs.
- **Xóa đơn**: PENDING xóa thường; PAID/CANCELLED/REFUNDED xóa cứng (confirm 2 lớp + lý do bắt buộc, audit `DELETE_ORDER`, các thẻ/payment giữ với cờ `orderDeleted: true`).
- Hoàn tiền PAID: bắt buộc lý do, khóa thẻ, push, audit.
- `/admin/qr-gate`: tablet cổng, QR rotation 30s, full-screen.

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
Slot ─< Enrollment (max 20)

Settings.pricing (singleton) ── realtime ─→ Customer pricing UI
AuditLog (append-only)
```

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
