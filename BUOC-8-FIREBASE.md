# BƯỚC 8 — KẾT NỐI FIREBASE (chạy thật)

> Mục tiêu: app đăng nhập OTP được, có dữ liệu, check-in/đơn hàng chạy thật.
> Thời gian: ~15 phút. Cần: tài khoản Google + thẻ (kích hoạt gói Blaze — xem mục 0).

---

## 0. Vì sao cần gói Blaze (trả theo dùng)
Phone Auth (gửi SMS) và Cloud Functions **bắt buộc** gói Blaze. Với 2.000–3.000 hội viên/năm, chi phí thực tế rất thấp (chủ yếu là SMS OTP ~vài trăm nghìn/tháng). Vẫn có hạn mức miễn phí rộng rãi cho Firestore/Functions.

---

## 1. Tạo project Firebase
1. Vào https://console.firebase.google.com → **Add project**.
2. Đặt tên (vd `prosper-plaza`) → Continue → tắt Google Analytics (không cần) → Create.

## 2. Nâng gói Blaze
- Góc trái dưới Console → **Upgrade** → chọn **Blaze** → liên kết thẻ. (Đặt ngân sách cảnh báo vd 500k/tháng cho yên tâm.)

## 3. Bật Authentication (Phone)
1. **Build → Authentication → Get started**.
2. Tab **Sign-in method** → bật **Phone**.
3. (Khuyên dùng khi test) Mục **Phone numbers for testing** → thêm 1 số test + mã OTP cố định (vd `+84 912 345 678` / `123456`) để khỏi tốn SMS lúc thử.

## 4. Tạo Firestore
1. **Build → Firestore Database → Create database**.
2. Chọn **Production mode** → Location: **asia-southeast1 (Singapore)** → Enable.

## 5. Bật Storage
- **Build → Storage → Get started** → giữ mặc định (rules sẽ deploy sau).

## 6. Bật Cloud Messaging (thông báo đẩy)
- **Project settings (⚙️) → Cloud Messaging → Web Push certificates → Generate key pair** → copy chuỗi (VAPID key).

## 7. Lấy cấu hình Web + điền .env.local
1. **Project settings → General → Your apps → Web (</>)** → đăng ký app (tên bất kỳ) → copy đoạn `firebaseConfig`.
2. Mở `D:\Hoboi_version2\.env.local`, điền:
```
NEXT_PUBLIC_FB_API_KEY=...            (apiKey)
NEXT_PUBLIC_FB_AUTH_DOMAIN=...        (authDomain)
NEXT_PUBLIC_FB_PROJECT_ID=...         (projectId)
NEXT_PUBLIC_FB_STORAGE_BUCKET=...     (storageBucket)
NEXT_PUBLIC_FB_SENDER_ID=...          (messagingSenderId)
NEXT_PUBLIC_FB_APP_ID=...             (appId)
NEXT_PUBLIC_FB_VAPID_KEY=...          (VAPID key ở mục 6)
```

## 8. Cài & đăng nhập Firebase CLI
```powershell
npm install -g firebase-tools
firebase login            # mở trình duyệt đăng nhập Google
firebase use --add        # chọn project vừa tạo, đặt alias "default"
```

## 9. Deploy rules + indexes + functions
```powershell
cd D:\Hoboi_version2
cd functions; npm install; npm run build; cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```
> Lần đầu deploy functions có thể mất 3–5 phút (Google build container).

## 10. Tải Service Account key (để seed & gán quyền)
- **Project settings → Service accounts → Generate new private key** → lưu file vào `D:\Hoboi_version2\service-account.json` (KHÔNG commit/chia sẻ file này).

## 11. Nạp dữ liệu mẫu (products, HLV, ca học)
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\Hoboi_version2\service-account.json"
npx tsx seed/seed.ts
```

## 12. Tạo tài khoản & gán quyền
1. Chạy app, **đăng nhập 1 lần** bằng SĐT của bạn (để hệ thống tạo tài khoản).
2. Gán quyền OWNER:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\Hoboi_version2\service-account.json"
npx tsx seed/setRole.ts +84905xxxxxx OWNER
```
3. Gán HLV (liên kết với coaches/tin hoặc coaches/tung):
```powershell
npx tsx seed/setRole.ts +84903xxxxxx COACH tin
```
> Sau khi gán quyền, tài khoản đó phải **đăng xuất & đăng nhập lại** để claim mới có hiệu lực.

## 13. Chạy app
```powershell
# Dev (xem cập nhật code tức thì):
npm run dev
# hoặc Production (ổn định, ít RAM):
npm run build ; npm run start
```
Mở http://localhost:3000 → đăng nhập OTP → trải nghiệm thật.

---

## 14. Triển khai lên Vercel (khi sẵn sàng public)
1. Đẩy code lên GitHub.
2. Vào https://vercel.com → Import repo.
3. Mục **Environment Variables**: thêm tất cả biến `NEXT_PUBLIC_FB_*` (giống .env.local).
4. **KHÔNG** đặt `DISABLE_PWA`/`LOW_MEM` trên Vercel (để bật PWA + build kiểm tra đầy đủ).
5. Deploy → có URL `https://...vercel.app` dùng trên điện thoại như app PWA.

---

## Sự cố thường gặp
- **auth/invalid-app-credential khi gửi OTP**: đảm bảo domain `localhost` được phép (Authentication → Settings → Authorized domains đã có localhost) và reCAPTCHA hoạt động.
- **permission-denied khi đọc dữ liệu**: tài khoản chưa có claim đúng → chạy lại mục 12, đăng nhập lại.
- **Functions deploy lỗi quyền**: chắc chắn đã nâng Blaze (mục 2).
- **Tốn SMS khi test**: dùng số test ở mục 3.
