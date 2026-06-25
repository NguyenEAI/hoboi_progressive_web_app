"use client";
import Link from "next/link";
import { usePricing } from "@/lib/hooks/usePricing";
import { formatVND } from "@/lib/utils";
import { Sparkles, ChevronRight, Info, Calendar, Ticket } from "lucide-react";
// Lưu ý: /services là tab root (BottomNav) — KHÔNG thêm BackButton.

// v2.3 (D7): Trang Dịch vụ rewrite — 3 lớn card chọn loại dịch vụ.
// Học bơi nổi bật ở đầu (gradient + badge), Vé thời hạn, Vé lượt.
// Vé lẻ chỉ tham khảo (bán tại quầy).
export default function ServicesPage() {
  const { pricing } = usePricing();

  return (
    <main className="mx-auto max-w-md">
      <header className="surface-glass sticky top-0 z-20 border-b border-slate-200/70 px-5 py-4">
        <h1 className="text-xl font-bold text-brand-800">Chọn dịch vụ</h1>
        <p className="text-xs text-slate-500">Vé lẻ vui lòng mua trực tiếp tại quầy lễ tân</p>
      </header>

      <div className="space-y-4 p-4">
        {/* Khóa học bơi — nổi bật nhất, đứng đầu */}
        <Link
          href="/services/course"
          className="card-interactive block animate-fade-up overflow-hidden shadow-elevated"
        >
          <div className="relative bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-5 text-white">
            <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              🔥 PHỔ BIẾN NHẤT
            </span>
            <div className="flex items-start gap-3">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/20 text-4xl backdrop-blur">
                🏊
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium opacity-90">
                  <Sparkles className="size-4" /> Học bơi
                </div>
                <div className="mt-0.5 text-xl font-extrabold">Khóa học bơi 15 buổi</div>
                <div className="mt-1 text-xs opacity-90">
                  Có HLV chuyên nghiệp · 4 kiểu bơi · 90 ngày
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wide opacity-80">Học phí</div>
                <div className="text-2xl font-bold">{formatVND(pricing.swimCourse)}</div>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-700">
                Chọn kiểu bơi <ChevronRight className="size-3.5" />
              </div>
            </div>
          </div>
        </Link>

        {/* Vé thời hạn */}
        <Link
          href="/services/pass"
          className="card-interactive block animate-fade-up overflow-hidden"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex items-center gap-3 p-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl">
              <Calendar className="size-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-800">Vé thời hạn</div>
              <div className="text-xs text-slate-500">
                Không giới hạn lượt · 1 / 3 / 6 tháng · 1 năm
              </div>
              <div className="mt-0.5 text-xs text-brand-700">
                Từ {formatVND(Math.min(...Object.values(pricing.pass.CHILD_UNDER_140)))}
              </div>
            </div>
            <ChevronRight className="size-5 text-slate-400" />
          </div>
        </Link>

        {/* Vé lượt */}
        <Link
          href="/services/package"
          className="card-interactive block animate-fade-up overflow-hidden"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-center gap-3 p-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
              <Ticket className="size-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-800">Vé lượt</div>
              <div className="text-xs text-slate-500">
                Gói 15 / 30 lượt · đi nhóm dùng chung được
              </div>
              <div className="mt-0.5 text-xs text-brand-700">
                Từ {formatVND(Math.min(...Object.values(pricing.package.CHILD_UNDER_140)))}
              </div>
            </div>
            <ChevronRight className="size-5 text-slate-400" />
          </div>
        </Link>

        {/* Vé lẻ tham khảo */}
        <div className="card mt-2 animate-fade-up bg-gradient-to-br from-brand-50 to-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
            <Info className="size-3.5" /> Vé lẻ (chỉ bán tại quầy)
          </div>
          <div className="mt-2 space-y-1 text-sm">
            <Line l="Trẻ em <1.4m" v={pricing.singleTicket.CHILD_UNDER_140} />
            <Line l="Trẻ em ≥1.4m" v={pricing.singleTicket.CHILD_OVER_140} />
            <Line l="Người lớn" v={pricing.singleTicket.ADULT} />
            <Line l="NL + bé <2 tuổi" v={pricing.singleTicket.ADULT_WITH_TODDLER} />
          </div>
        </div>
      </div>
    </main>
  );
}

const Line = ({ l, v }: { l: string; v: number }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-600">{l}</span>
    <b className="text-brand-800 tabular-nums">{formatVND(v)}</b>
  </div>
);
