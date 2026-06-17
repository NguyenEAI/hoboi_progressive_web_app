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
    <div className="relative overflow-hidden rounded-2.5xl shadow-elevated">
      {/* Layered background */}
      <div className="absolute inset-0 hero-mesh" />
      <div className="absolute inset-0 holo-shine" />
      <div
        className="absolute inset-x-0 bottom-0 h-16 text-brand-700/90"
        aria-hidden
      >
        <WavePattern className="absolute inset-x-0 bottom-0 h-full w-full" />
      </div>

      <div className="relative px-5 py-5 text-white">
        <div className="flex items-start justify-between">
          <CardHeader />
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest opacity-80">Mã số</div>
            <div className="text-base font-bold tabular-nums tracking-wide">
              #{m.memberCode}
            </div>
          </div>
        </div>

        {/* Card type pill */}
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-white/25 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {durLabel(m.duration)} · {audienceLabel(m.audience)}
        </div>

        {/* Holder name */}
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-widest opacity-80">Chủ thẻ</div>
          <div className="text-xl font-bold tracking-tight text-shadow-sm">
            {holderName.toUpperCase()}
          </div>
        </div>

        {/* Expiry banner */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">Hiệu lực đến</div>
            <div className="text-base font-semibold">{formatDate(m.endDate)}</div>
          </div>
          <div
            className={`rounded-xl px-3 py-1.5 text-right ring-1 ${
              isExpiring
                ? "bg-amber-400/90 text-amber-950 ring-amber-200/50"
                : "bg-white/20 text-white ring-white/25"
            }`}
          >
            <div className="text-[9px] uppercase tracking-wider opacity-90">Còn lại</div>
            <div className="text-lg font-extrabold tabular-nums">{days} ngày</div>
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
    <div className="relative overflow-hidden rounded-2.5xl shadow-elevated">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #f59e0b 0%, #d97706 55%, #92400e 100%)",
        }}
      />
      <div className="absolute inset-0 holo-shine" />

      <div className="relative px-5 py-5 text-white">
        <div className="flex items-start justify-between">
          <CardHeader />
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest opacity-80">Mã số</div>
            <div className="text-base font-bold tabular-nums">#{p.memberCode}</div>
          </div>
        </div>

        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-white/25 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Gói {p.totalSessions} lượt · {audienceLabel(p.audience)}
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tabular-nums tracking-tight">
            {p.remainingSessions}
          </span>
          <span className="text-sm opacity-90">/ {p.totalSessions} lượt còn lại</span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-3 text-[11px] opacity-90">
          {holderName.toUpperCase()}
        </div>
      </div>

      {/* Back grid - như thẻ cứng */}
      <div className="relative border-t border-amber-200/40 bg-white px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            Lịch sử lượt sử dụng
          </div>
          <div className="text-[10px] text-slate-500">
            Đã dùng <b className="text-amber-700">{used}</b>/{p.totalSessions}
          </div>
        </div>
        <div className={`grid gap-1 ${p.totalSessions === 30 ? "grid-cols-10" : "grid-cols-[repeat(15,1fr)]"}`}>
          {Array.from({ length: p.totalSessions }).map((_, i) => {
            const isUsed = i < used;
            return (
              <div
                key={i}
                className={`flex aspect-square items-center justify-center rounded-md border text-[10px] font-bold ${
                  isUsed
                    ? "border-amber-700 bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm"
                    : "border-amber-200 bg-amber-50/50 text-amber-300"
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
