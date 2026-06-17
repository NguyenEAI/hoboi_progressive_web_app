"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { issueQrToken } from "@/lib/callable";
import { POOL_INFO } from "@/lib/constants";

// Trang QR đặt tại cổng: tablet/laptop hiển thị mã QR đổi mỗi 30s.
// Khách quét bằng app trên điện thoại → backend xác thực (chống chụp màn hình QR cũ).
export default function QrGatePage() {
  const [token, setToken] = useState<string>();
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [err, setErr] = useState<string>();

  async function refresh() {
    try {
      const r = await issueQrToken({});
      setToken(r.token); setExpiresAt(r.expiresAt); setErr(undefined);
    } catch (e) { setErr((e as Error).message); }
  }

  useEffect(() => {
    refresh();
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  // Khi token sắp hết hạn (còn 2s) → đổi mới
  useEffect(() => {
    if (!expiresAt) return;
    if (expiresAt - now < 2000) refresh();
  }, [now, expiresAt]);

  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  return (
    <div className="-m-6 flex min-h-screen flex-col bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs opacity-80">CỔNG VÀO · {POOL_INFO.shortName}</div>
          <h1 className="text-3xl font-bold">Quét mã để check-in</h1>
        </div>
        <button onClick={() => document.documentElement.requestFullscreen()}
          className="rounded-lg bg-white/15 px-4 py-2 text-sm hover:bg-white/25">⛶ Toàn màn hình</button>
      </header>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="rounded-3xl bg-white p-8 shadow-2xl">
            {token ? (
              <QRCodeSVG value={token} size={420} level="M" />
            ) : (
              <div className="flex size-[420px] items-center justify-center text-slate-400">Đang tạo mã…</div>
            )}
          </div>
          <div className="mt-6 text-center">
            <div className="text-2xl font-bold">Mã đổi sau: <span className="tabular-nums">{secondsLeft}s</span></div>
            <div className="mt-2 max-w-md text-base opacity-90">
              Mở app <b>Hồ Bơi Prosper Plaza</b> trên điện thoại → mục <b>Check-in</b> → quét mã này
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center text-sm opacity-75">
        {err ? <span className="text-red-200">⚠ Lỗi: {err}</span> : <>Mã tự động làm mới mỗi 30 giây để bảo mật</>}
      </footer>
    </div>
  );
}
