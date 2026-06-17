"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { WavePattern, FloatingOrbs, DotGrid } from "@/components/Decorations";
import { POOL_INFO } from "@/lib/constants";
import { formatVND } from "@/lib/utils";
import { usePricing } from "@/lib/hooks/usePricing";
import { MapPin, ShieldCheck, Sparkles, ArrowRight, Star } from "lucide-react";

export default function LandingPage() {
  const { pricing } = usePricing();
  const singleTickets = [
    { label: "Trẻ em dưới 1.4m", value: pricing.singleTicket.CHILD_UNDER_140, emoji: "🧒" },
    { label: "Trẻ em trên 1.4m", value: pricing.singleTicket.CHILD_OVER_140, emoji: "🧑" },
    { label: "Người lớn", value: pricing.singleTicket.ADULT, emoji: "🧔" },
    { label: "Người lớn + bé < 2 tuổi", value: pricing.singleTicket.ADULT_WITH_TODDLER, emoji: "👨‍👶" },
  ];
  const services = [
    { name: "Vé tháng", from: pricing.pass.CHILD_UNDER_140.MONTH_1, icon: "🎫", desc: "Bơi không giới hạn", grad: "from-emerald-500 to-emerald-700" },
    { name: "Vé 3·6·12 tháng", from: pricing.pass.CHILD_UNDER_140.MONTH_3, icon: "🗓️", desc: "Tiết kiệm tới 35%", grad: "from-teal-500 to-teal-700" },
    { name: "Gói 15·30 lượt", from: pricing.package.CHILD_UNDER_140.PACK_15, icon: "🎟️", desc: "Chia sẻ được", grad: "from-amber-500 to-amber-700" },
    { name: "Khóa học bơi", from: pricing.swimCourse, flat: true, icon: "🏊", desc: "15 buổi · 4 kiểu", grad: "from-cyan-500 to-cyan-700" },
  ];

  return (
    <main className="mx-auto max-w-md pb-12">
      {/* ========== HERO ========== */}
      <header className="hero-mesh hero-aurora relative overflow-hidden px-6 pb-16 pt-10 text-white">
        <FloatingOrbs />
        <div className="absolute inset-0 opacity-25 text-white">
          <DotGrid className="absolute inset-0" />
        </div>

        <div className="relative flex items-center gap-3 animate-fade-in">
          <Logo size={52} glow />
          <div className="leading-tight">
            <div className="text-[11px] font-medium uppercase tracking-widest opacity-90">
              Chào mừng đến với
            </div>
            <div className="text-2xl font-extrabold tracking-tight">
              {POOL_INFO.shortName}
            </div>
          </div>
        </div>

        <h1 className="relative mt-6 text-3xl font-extrabold leading-tight text-balance text-shadow-md animate-fade-up">
          Trải nghiệm hồ bơi
          <br />
          <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
            đẳng cấp 5★
          </span>{" "}
          ngay tại nhà
        </h1>

        <p
          className="relative mt-3 flex items-start gap-1.5 text-sm opacity-95 animate-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          <MapPin className="mt-0.5 size-4 flex-shrink-0" />
          <span className="text-balance">{POOL_INFO.address}</span>
        </p>

        <div
          className="relative mt-5 flex flex-wrap gap-2 text-xs animate-fade-up"
          style={{ animationDelay: "160ms" }}
        >
          <Pill icon={<Sparkles className="size-3" />}>Đặt vé online</Pill>
          <Pill>🏊 Học bơi 1:20</Pill>
          <Pill>📷 Check-in QR</Pill>
          <Pill>
            <Star className="size-3 fill-amber-300 text-amber-300" />
            2.000+ thành viên
          </Pill>
        </div>

        {/* Wave footer */}
        <div className="pointer-events-none absolute inset-x-0 -bottom-px text-slate-50">
          <WavePattern className="h-12 w-full" />
        </div>
      </header>

      {/* ========== STATS ========== */}
      <section className="-mt-8 px-4">
        <div className="card-premium flex items-stretch justify-around divide-x divide-brand-100 px-2 py-3 text-center text-xs">
          <Stat label="Khách / năm" value="2.000+" />
          <Stat label="Sức chứa" value="20 / ca" />
          <Stat label="Khóa học" value="15 buổi" />
        </div>
      </section>

      {/* ========== SERVICES ========== */}
      <section className="mt-6 px-4">
        <SectionTitle title="Dịch vụ trực tuyến" hint="Đăng ký nhanh, thanh toán tại quầy" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          {services.map((s, i) => (
            <div
              key={s.name}
              className="card-premium relative animate-fade-up overflow-hidden p-4"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div
                className={`absolute -right-6 -top-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${s.grad} text-2xl opacity-90 shadow-lg`}
              >
                {s.icon}
              </div>
              <div className="relative mt-10">
                <div className="text-xs text-slate-500">{s.name}</div>
                <div className="text-lg font-bold text-brand-800 tab-nums">
                  {s.flat ? formatVND(s.from) : `từ ${formatVND(s.from)}`}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========== SINGLE TICKETS ========== */}
      <section className="mt-7 px-4">
        <SectionTitle
          title="Bảng giá vé lẻ"
          hint="Mua trực tiếp tại quầy lễ tân"
        />
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-100">
          {singleTickets.map((p, i) => (
            <li
              key={p.label}
              className="flex items-center gap-3 p-4 animate-fade-in"
              style={{ animationDelay: `${100 + i * 40}ms` }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-xl">
                {p.emoji}
              </span>
              <span className="flex-1 text-sm font-medium text-slate-700">{p.label}</span>
              <span className="font-bold text-brand-700 tab-nums">{formatVND(p.value)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ========== CTA ========== */}
      <section className="mt-8 px-4 animate-fade-up">
        <div className="card-glass relative overflow-hidden p-5">
          <div className="text-balance">
            <div className="text-base font-bold text-brand-800">
              Sẵn sàng bơi cùng chúng tôi?
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Đăng nhập bằng số điện thoại, không cần mật khẩu.
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Link href="/signin" className="btn-primary flex-1 py-3.5">
              Bắt đầu ngay
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[10.5px] text-slate-500">
            <ShieldCheck className="size-3.5 text-brand-500" />
            Bảo mật bằng mã OTP SMS · Tuân thủ PDPL VN 2026
          </p>
        </div>
      </section>
    </main>
  );
}

function Pill({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20 backdrop-blur">
      {icon}
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-2">
      <div className="text-base font-extrabold text-brand-700 tab-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-sm font-bold tracking-tight text-slate-800">{title}</h2>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}
