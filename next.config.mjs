import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  // Tắt PWA khi dev hoặc khi đặt DISABLE_PWA=1 (build kiểm chứng trên máy ít RAM)
  disable: process.env.NODE_ENV === "development" || process.env.DISABLE_PWA === "1",
});

const lowMem = process.env.LOW_MEM === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // Trên máy ít RAM, bỏ bước lint/type trong build (đã chạy `npm run typecheck` riêng).
  // KHÔNG bật cờ này trên CI/Vercel — để build kiểm tra đầy đủ.
  eslint: { ignoreDuringBuilds: lowMem },
  typescript: { ignoreBuildErrors: lowMem },
  experimental: { webpackMemoryOptimizations: lowMem },
};

export default withPWA(nextConfig);
