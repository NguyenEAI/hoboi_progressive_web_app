# Hồ Bơi Prosper Plaza — Hệ thống quản lý hồ bơi (PWA)

CÔNG TY TNHH HT BẢO LÂM · 22/14 Phan Văn Hớn, P. Tân Đông Hưng Thuận, TP.HCM

PWA quản lý hồ bơi đơn lẻ: bán vé, học bơi, check-in QR, thông báo, doanh thu.
📄 Thiết kế đầy đủ: [THIET-KE-TONG-HOP.md](./THIET-KE-TONG-HOP.md) · Mockup UI: [mockups/index.html](./mockups/index.html)

> ⚠️ Máy hiện **chưa cài Node.js** — tải Node 20+ tại https://nodejs.org rồi mới `npm install` được.

## Stack
- Next.js 15 + TypeScript + TailwindCSS + Shadcn/UI + next-pwa
- Firebase Authentication / Firestore / Storage / FCM / Functions (asia-southeast1)
- Hosting frontend trên Vercel; backend ở Firebase

## Cấu trúc
```
src/                 Next.js App Router
  app/(public)       Landing, signin, signup
  app/(customer)     Khách hàng & phụ huynh
  app/(staff)/admin  Owner + Lễ tân
  app/(coach)/coach  HLV
  lib/firebase       Client SDK init
  types              Domain types
functions/           Firebase Functions (callable + schedule)
firestore/           Rules + indexes
seed/                Seed dữ liệu mẫu
```

## Chạy local
```bash
cp .env.example .env.local       # điền cấu hình Firebase
npm install
npm run dev

# (mở terminal khác) chạy emulator + functions
cd functions && npm install && npm run build && cd ..
npm run emulators
```

## Deploy
- Firebase: `npm run deploy:rules && npm run deploy:functions`
- Vercel: `vercel --prod` (đặt env NEXT_PUBLIC_FB_*)
