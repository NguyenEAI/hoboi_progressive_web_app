"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { GraduationCap } from "lucide-react";
import { issueQrToken } from "@/lib/callable";
import { POOL_INFO } from "@/lib/constants";

/** Mã QR riêng cho điểm danh khóa học; không dùng để trừ vé lượt. */
export default function CourseQrPage() {
  const [token, setToken] = useState<string>();
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string>();

  async function refresh() {
    try {
      const result = await issueQrToken({ purpose: "COURSE" });
      setToken(result.token);
      setExpiresAt(result.expiresAt);
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (expiresAt && expiresAt - now < 2000) void refresh();
  }, [now, expiresAt]);

  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  return (
    <div className="-m-6 flex min-h-screen flex-col bg-gradient-to-br from-cyan-600 via-sky-700 to-brand-900 p-6 text-white">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
            <GraduationCap className="size-4" /> Điểm danh khóa học · {POOL_INFO.shortName}
          </div>
          <h1 className="mt-3 text-3xl font-black">Quét mã để điểm danh buổi học</h1>
          <p className="mt-1 max-w-xl text-sm opacity-90">
            Mã này chỉ dùng cho khóa học bơi. Hệ thống sẽ không dùng mã này để trừ vé lượt hoặc kiểm vé thời hạn.
          </p>
        </div>
        <button
          onClick={() => document.documentElement.requestFullscreen()}
          className="rounded-lg bg-white/15 px-4 py-2 text-sm font-bold hover:bg-white/25"
        >
          Toàn màn hình
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="rounded-[2rem] bg-white p-8 shadow-2xl ring-8 ring-cyan-200/30">
            {token ? (
              <QRCodeSVG value={token} size={420} level="M" />
            ) : (
              <div className="flex size-[420px] items-center justify-center text-slate-400">Đang tạo mã…</div>
            )}
          </div>
          <div className="mt-6 text-center">
            <div className="rounded-2xl bg-white/15 p-4 text-lg font-bold">
              Mã chỉ điểm danh khóa học · đổi sau <span className="tabular-nums">{secondsLeft}s</span>
            </div>
            <div className="mt-3 max-w-lg text-base opacity-90">
              Học viên mở app → <b>Check-in</b> → chọn <b>Khóa học</b> → quét mã này.
              Nếu chọn vé lượt rồi quét mã này, app sẽ báo lỗi và không trừ lượt.
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center text-sm opacity-80">
        {error ? <span className="text-red-200">Lỗi: {error}</span> : <>Mã khóa học tự đổi mới mỗi 30 giây để bảo mật</>}
      </footer>
    </div>
  );
}
