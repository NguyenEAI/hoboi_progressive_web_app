import Image from "next/image";
import type { Membership, TicketPackage } from "@/types";
import { formatDate, formatVND, daysUntil } from "@/lib/utils";
import { PASS_DURATIONS, AUDIENCES } from "@/lib/constants";
import { WavePattern } from "./Decorations";

const audienceLabel = (a?: string) => AUDIENCES.find((x) => x.id === a)?.label ?? "";
const durLabel = (d?: string) => PASS_DURATIONS.find((x) => x.id === d)?.label ?? "Vé";

// ===== HELPER: Header bar — logo + tên hồ =====
function CardHeader({ darkText = false }: { darkText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
        <Image src="/logo.png" alt="HT Bảo Lâm" width={34} height={34} className="object-contain" />
      </span>
      <div className={`leading-tight ${darkText ? "text-slate-900" : "text-white"}`}>
        <div className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-90">
          HT Bảo Lâm
        </div>
        <div className="text-[13px] font-extrabold tracking-tight">
          HỒ BƠI PROSPER PLAZA
        </div>
      </div>
    </div>
  );
}

// ===== MEMBERSHIP CARD (Apple-wallet style) =====
export function MembershipCard({ m, holderName }: { m: Membership; holderName: string }) {
  const days = Math.max(0, daysUntil(m.endDate));
  const isExpiring = days <= 7;

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-float border border-white/10">
      {/* Layered background */}
      <div className="absolute inset-0 hero-mesh" />
      <div className="absolute inset-0 holo-shine" />
      <div
        className="absolute inset-x-0 bottom-0 h-16 text-brand-800/60"
        aria-hidden
      >
        <WavePattern className="absolute inset-x-0 bottom-0 h-full w-full" />
      </div>

      <div className="relative px-6 py-6 text-white z-10">
        <div className="flex items-start justify-between gap-4">
          <CardHeader />
          <div className="text-right">
            <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-75">Mã số</div>
            <div className="text-lg font-black tabular-nums tracking-wide text-shadow-sm">
              #{m.memberCode}
            </div>
          </div>
        </div>

        {/* Card type pill */}
        <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ring-1 ring-white/20 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-350 animate-pulse" />
          {durLabel(m.duration)} · {audienceLabel(m.audience)}
        </div>

        {/* Holder name */}
        <div className="mt-4">
          <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-75">Chủ thẻ</div>
          <div className="text-2xl font-black tracking-tight text-shadow-md mt-0.5">
            {holderName.toUpperCase()}
          </div>
        </div>

        {/* Expiry banner */}
        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-75">Hiệu lực đến</div>
            <div className="text-base font-extrabold text-shadow-sm mt-0.5">{formatDate(m.endDate)}</div>
          </div>
          <div
            className={`rounded-2xl px-4 py-2 text-right shadow-md ring-1 backdrop-blur-md transition-all ${
              isExpiring
                ? "bg-amber-500/90 text-amber-950 ring-amber-300/40"
                : "bg-white/15 text-white ring-white/20"
            }`}
          >
            <div className="text-[9px] font-extrabold uppercase tracking-wider opacity-85">Còn lại</div>
            <div className="text-lg font-black tabular-nums">{days} ngày</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== TICKET PACKAGE CARD (front + back grid) =====
export function PackageCard({ p, holderName }: { p: TicketPackage; holderName: string }) {
  const used = p.totalSessions - p.remainingSessions;
  const pct = Math.round((p.remainingSessions / p.totalSessions) * 100);

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-float border border-slate-100 bg-white">
      {/* Front header bar with gradient background */}
      <div className="relative overflow-hidden px-6 py-6 text-white">
        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              "linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #78350f 100%)",
          }}
        />
        <div className="absolute inset-0 holo-shine z-0" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <CardHeader />
            <div className="text-right">
              <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-80">Mã số</div>
              <div className="text-lg font-black tabular-nums text-shadow-sm">#{p.memberCode}</div>
            </div>
          </div>

          <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ring-1 ring-white/20 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-350 animate-pulse" />
            Gói {p.totalSessions} lượt · {audienceLabel(p.audience)}
          </div>

          <div className="mt-4 flex items-baseline gap-2 text-shadow-sm">
            <span className="text-4xl font-black tabular-nums tracking-tight">
              {p.remainingSessions}
            </span>
            <span className="text-xs font-bold opacity-90">/ {p.totalSessions} lượt còn lại</span>
          </div>

          <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-white/20 shadow-inner">
            <div
              className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-4 text-[10px] font-extrabold tracking-wider opacity-85 uppercase">
            {holderName}
          </div>
        </div>
      </div>

      {/* Back check-off grid styled cleanly */}
      <div className="relative border-t border-slate-100 bg-slate-50/50 px-6 py-5 z-10">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
            Lịch sử lượt sử dụng
          </div>
          <div className="text-[10.5px] font-semibold text-slate-500">
            Đã dùng <b className="text-amber-700 font-extrabold">{used}</b>/{p.totalSessions} lượt
          </div>
        </div>
        <div className={`grid gap-1.5 ${p.totalSessions === 30 ? "grid-cols-10" : "grid-cols-[repeat(15,1fr)]"}`}>
          {Array.from({ length: p.totalSessions }).map((_, i) => {
            const isUsed = i < used;
            return (
              <div
                key={i}
                className={`flex aspect-square items-center justify-center rounded-lg border text-[10px] font-extrabold transition-all duration-300 ${
                  isUsed
                    ? "border-amber-600 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-350"
                }`}
              >
                {isUsed ? "✓" : i + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
