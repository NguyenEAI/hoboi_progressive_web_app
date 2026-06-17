# Hướng dẫn chạy Playwright E2E

> Áp dụng cho **Phương án B** trong TEST-PLAN.md — kiểm thử tự động qua trình duyệt.

---

## 1. Cài đặt 1 lần duy nhất

```powershell
# 1) Refresh PATH (Node v24 mới cài qua winget)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 2) Cài Playwright (dev dep) + Chromium engine
npm install -D @playwright/test
npx playwright install chromium

# (tùy chọn) cài thêm firefox/webkit nếu muốn test cross-browser
# npx playwright install
```

> **RAM thấp lưu ý**: chỉ cài `chromium` (~150MB), bỏ qua firefox/webkit.

---

## 2. Tiền đề trong Firebase Console (1 lần)

Vào https://console.firebase.google.com → project `hoboiapp` → Authentication → Sign-in method → Phone → "Phone numbers for testing":

| Phone | OTP |
|---|---|
| `+84900000001` | `111111` |
| `+84900000002` | `222222` |
| `+84900000003` | `333333` |

Sau đó (1 lần) dùng app thường: đăng nhập `+84900000001` rồi đặt fullName "Khách Test" trong `/profile` → để các test signin không bị stuck ở step "name".

Để test admin pricing: gán `+84900000003` role OWNER (qua `/admin/staff` từ tài khoản Owner thật).

---

## 3. Chạy test

### 3.1 Khởi động server trước (khuyến nghị với máy RAM thấp)

Mở **1 terminal riêng** chạy server:
```powershell
# Cách 1: production build (RAM thấp dùng cái này)
$env:DISABLE_PWA = "1"; $env:LOW_MEM = "1"
npm run build
npm run start

# Cách 2: dev server
$env:E2E_USE_DEV = "1"; npm run dev
```

### 3.2 Chạy test ở terminal khác

```powershell
# Chạy tất cả test
npm run test:e2e

# Chạy file cụ thể
npm run test:e2e -- smoke
npm run test:e2e -- signin

# Test 1 case duy nhất
npm run test:e2e -- -g "SM-01"

# Headed mode (mở Chrome thật để xem chạy)
npm run test:e2e:headed

# UI mode interactive (debug, replay từng step)
npm run test:e2e:ui

# Mở report sau khi chạy xong
npm run test:e2e:report
```

### 3.3 Test pricing realtime (destructive — đổi giá thật)

```powershell
$env:E2E_DESTRUCTIVE = "1"
npm run test:e2e -- admin-pricing
```

Test này tự rollback giá về ban đầu sau khi xong. Nếu fail giữa chừng, vào `/admin/products` chỉnh tay.

---

## 4. Cấu trúc các file test đã tạo

```
tests/e2e/
├ helpers/
│  └ auth.ts                  TEST_USERS, signIn, signOut helpers
├ smoke.spec.ts               SM-01..05 (Landing không cần đăng nhập)
├ signin.spec.ts              SI-01, SI-02, SI-05, SI-06, SI-09
├ customer-buy.spec.ts        CB-01, CB-05 (mua thẻ + audience auto)
└ admin-pricing.spec.ts       OW-02 (realtime pricing — destructive)
```

---

## 5. Coverage hiện tại

| TEST-PLAN section | Coverage | Còn thiếu |
|---|---|---|
| §3 Smoke | ✅ SM-01..05 | — |
| §4.1 Public | ✅ PUB-04, 05 | PUB-02, 03 |
| §4.2 Sign-in | ✅ SI-01, 02, 05, 06, 09 | SI-03 (role redirect), SI-07 (region), SI-08 (bug ghi đè role) |
| §4.3 Customer mua | ⚠️ CB-01, 05 | CB-02 (khóa học), CB-03 (realtime giá), CB-04 (đóng băng), CB-08 (slot đầy), CB-09 (race) |
| §4.4 Check-in | ❌ Chưa | CK-* cần mock QR token (không dùng camera Playwright) |
| §4.5 Profile | ❌ Chưa | PR-* |
| §4.6 Receptionist | ❌ Chưa | RC-* (cần seed đơn PENDING) |
| §4.7 Owner | ⚠️ OW-02 | OW-04 (refund), OW-08 (CRUD HLV), OW-13 (gán role) |
| §4.8 Coach | ❌ Chưa | CO-* |
| §5 Cron | ❌ Không phù hợp E2E | Dùng emulator + node script |
| §6 Security | ❌ Không phù hợp E2E | Dùng `@firebase/rules-unit-testing` |

**Tôi đã viết 4 file đầu để bạn chạy ngay**. Các test còn lại sẽ viết nốt khi bạn confirm 4 file này pass — vì cần biết app chạy không lỗi trước khi mở rộng.

---

## 6. Mẹo debug khi test fail

| Triệu chứng | Cách xử lý |
|---|---|
| `Timeout 30000ms exceeded` | Tăng `timeout` trong `playwright.config.ts`; hoặc server chưa lên (check `localhost:3000` thủ công) |
| `reCAPTCHA failed` ở signin | Firebase chưa whitelist `localhost` cho domain. Vào Console → Auth → Settings → Authorized domains, add `localhost` |
| Test number "auth/invalid-verification-code" | OTP không khớp Firebase Console. Re-add đúng `111111`/`222222`/`333333` |
| `permission-denied` ở Firestore | Test user chưa có role phù hợp. Login bằng Owner thật + `/admin/staff` gán role |
| Screenshot/video không tạo | Test pass thì không lưu. Force fail bằng `expect(false).toBe(true)` để xem |
| Test trên CI Vercel fail mà local pass | Vercel preview URL khác `localhost`. Set `E2E_BASE_URL=https://prosperplaza-pr-XX.vercel.app` |

Reports lưu ở `playwright-report/index.html` — mở bằng `npm run test:e2e:report`.

---

## 7. Mở rộng test (làm tiếp khi 4 file đầu pass)

Để cover hết §4.4 (check-in QR) — vì Playwright không quét được camera thật:

```typescript
// Pattern: gọi callable trực tiếp với mock QR token thay vì scan
import { getApps, initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

const issueQrToken = httpsCallable(getFunctions(getApps()[0], "asia-southeast1"), "issueQrToken");
const checkinByQr = httpsCallable(getFunctions(getApps()[0], "asia-southeast1"), "checkinByQr");

// 1. Owner-context: lấy 1 token mới
const { data } = await issueQrToken({});
// 2. Customer-context: gọi checkinByQr với token.qrPayload
const result = await checkinByQr({ qrPayload: data.token });
```

Để cover §6 (security rules):
```powershell
npm install -D @firebase/rules-unit-testing
# Viết tests/rules/firestore-rules.spec.ts dùng initializeTestEnvironment
# Chạy với emulator: firebase emulators:exec "npm run test:rules"
```

---

## 8. Checklist trước commit test

- [ ] Đã chạy `npm run test:e2e` — tất cả test pass HOẶC `test.skip` có lý do
- [ ] Không commit `playwright-report/` (đã trong .gitignore mặc định)
- [ ] Không commit `test-results/` (screenshots/videos fail)
- [ ] Không hard-code OTP/SĐT thật vào test — chỉ dùng `TEST_USERS` từ `helpers/auth.ts`
- [ ] Test destructive (sửa giá, refund) phải có guard `process.env.E2E_DESTRUCTIVE`

---

## 9. Tài liệu liên quan
- [`TEST-PLAN.md`](./TEST-PLAN.md) — Test cases gốc với ID ổn định
- [Playwright docs](https://playwright.dev/) — API reference
- `../playwright.config.ts` — cấu hình project
- `../tests/e2e/` — source code test
