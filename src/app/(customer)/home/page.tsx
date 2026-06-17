"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Membership, TicketPackage, Enrollment } from "@/types";
import { Logo } from "@/components/Logo";
import { WavePattern, FloatingOrbs } from "@/components/Decorations";
import { SkeletonList } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatDate, daysUntil } from "@/lib/utils";
import { PASS_DURATIONS, SWIM_STYLES } from "@/lib/constants";
import Link from "next/link";
import {
  Camera, CreditCard, ShoppingBag, Bell, ChevronRight, Sparkles,
} from "lucide-react";

const passLabel = (d: string) => PASS_DURATIONS.find((x) => x.id === d)?.label ?? "Vé";
const styleLabel = (s: string) => SWIM_STYLES.find((x) => x.id === s)?.label ?? "Khóa học";
const styleEmoji = (s: string) => SWIM_STYLES.find((x) => x.id === s)?.emoji ?? "🏊";

export default function HomePage() {
  const { profile, loading } = useAuthUser();
  const [mems, setMems] = useState<Membership[]>([]);
  const [pkgs, setPkgs] = useState<TicketPackage[]>([]);
  const [enrolls, setEnrolls] = useState<Enrollment[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [servicesLoaded, setServicesLoaded] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let loaded = 0;
    const onLoaded = () => { loaded++; if (loaded >= 3) setServicesLoaded(true); };
    const subs = [
      onSnapshot(query(collection(db, "memberships"),
        where("userId", "==", profile.id), where("status", "==", "ACTIVE")),
        (s) => { setMems(s.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))); onLoaded(); }),
      onSnapshot(query(collection(db, "ticketPackages"),
        where("userId", "==", profile.id), where("status", "==", "ACTIVE")),
        (s) => { setPkgs(s.docs.map((d) => ({ id: d.id, ...d.data() } as TicketPackage))); onLoaded(); }),
      onSnapshot(query(collection(db, "enrollments"),
        where("studentId", "==", profile.id), where("status", "==", "ACTIVE")),
        (s) => { setEnrolls(s.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment))); onLoaded(); }),
      onSnapshot(query(collection(db, `users/${profile.id}/notifications`),
        where("read", "==", false)),
        (s) => setUnreadCount(s.size)),
    ];
    return () => subs.forEach((u) => u());
  }, [profile]);

  if (loading || !profile) {
    return (
      <main className="mx-auto max-w-md pb-24">
        <div className="hero-mesh h-44" />
        <div className="space-y-3 p-4"><SkeletonList /></div>
      </main>
    );
  }

  const hasServices = mems.length || pkgs.length || enrolls.length;
  const firstName = profile.fullName?.split(" ").slice(-1)[0] || profile.fullName || "bạn";
  const greeting = greetingByTime();

  return (
    <main className="mx-auto max-w-md pb-safe">
      {/* ============ HERO ============ */}
      <header className="hero-mesh hero-aurora relative overflow-hidden px-5 pb-12 pt-7 text-white">
        <FloatingOrbs />

        <div className="relative flex items-center gap-3">
          <Logo size={42} glow />
          <div className="flex-1 leading-tight">
            <div className="text-[10px] font-medium uppercase tracking-widest opacity-85">
              Prosper Plaza
            </div>
            <div className="text-base font-bold">
              {greeting}, <span className="text-amber-200">{firstName}</span> 👋
            </div>
          </div>
          {profile.role === "OWNER" || profile.role === "RECEPTIONIST" ? (
            <Link href="/admin" className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/30 backdrop-blur active:bg-white/30">
              Quản trị
            </Link>
          ) : profile.role === "COACH" ? (
            <Link href="/coach" className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/30 backdrop-blur active:bg-white/30">
              Huấn luyện
            </Link>
          ) : null}
        </div>

        <div className="relative mt-5 text-balance">
          <p className="text-xs opacity-90">
            {hasServices
              ? "Thẻ và khóa học đang hoạt động ⬇️"
              : "Bắt đầu hành trình bơi lội của bạn 🌊"}
          </p>
        </div>

        {/* Wave footer */}
        <div className="pointer-events-none absolute inset-x-0 -bottom-px text-slate-50">
          <WavePattern className="h-10 w-full" />
        </div>
      </header>

      {/* ============ ACTIVE SERVICES ============ */}
      <section className="-mt-4 space-y-3 px-4">
        {!servicesLoaded && <SkeletonList count={2} />}

        {servicesLoaded && mems.map((m, i) => {
          const days = Math.max(0, daysUntil(m.endDate));
          const isExpiring = days <= 7;
          return (
            <ServiceCard
              key={m.id}
              delay={i * 60}
              accent="from-brand-500 to-brand-700"
              icon="🎫"
              title={passLabel(m.duration)}
              primary={`${days} ngày còn lại`}
              secondary={`Hết hạn ${formatDate(m.endDate)}`}
              chip={isExpiring ? "warning" : "live"}
              chipLabel={isExpiring ? `Sắp hết hạn` : `Đang hoạt động`}
            />
          );
        })}

        {servicesLoaded && pkgs.map((p, i) => {
          const pct = Math.round((p.remainingSessions / p.totalSessions) * 100);
          return (
            <ServiceCard
              key={p.id}
              delay={(mems.length + i) * 60}
              accent="from-amber-500 to-amber-700"
              icon="🎟️"
              title={`Gói ${p.totalSessions} lượt`}
              primary={`${p.remainingSessions}/${p.totalSessions} lượt`}
              secondary={`${pct}% còn lại · chia sẻ được`}
              progress={pct}
              chip="live"
              chipLabel="Đang hoạt động"
            />
          );
        })}

        {servicesLoaded && enrolls.map((e, i) => {
          const pct = Math.round((e.attendedSessions / e.totalSessions) * 100);
          return (
            <ServiceCard
              key={e.id}
              delay={(mems.length + pkgs.length + i) * 60}
              accent="from-cyan-500 to-cyan-700"
              icon={styleEmoji(e.swimStyle)}
              title={`Khóa ${styleLabel(e.swimStyle)}`}
              primary={`${e.attendedSessions}/${e.totalSessions} buổi`}
              secondary={`HLV ${e.coachName} · hết hạn ${formatDate(e.expiryDate)}`}
              progress={pct}
              chip="info"
              chipLabel={`${pct}%`}
            />
          );
        })}

        {servicesLoaded && !hasServices && (
          <EmptyState
            icon="🌊"
            title="Chưa có dịch vụ nào"
            description="Bắt đầu với vé tháng hoặc khóa học bơi để vào hồ"
            actionLabel="Khám phá dịch vụ"
            actionHref="/services"
          />
        )}
      </section>

      {/* ============ QUICK ACTIONS ============ */}
      <section className="mt-7 px-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Sparkles className="size-3.5 text-brand-500" />
          Truy cập nhanh
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Shortcut
            href="/checkin"
            icon={<Camera className="size-7" />}
            label="Quét QR"
            sub="Check-in vào hồ"
            highlight
          />
          <Shortcut
            href="/cards"
            icon={<CreditCard className="size-7" />}
            label="Thẻ của tôi"
            sub="Hiển thị thẻ điện tử"
          />
          <Shortcut
            href="/services"
            icon={<ShoppingBag className="size-7" />}
            label="Mua vé"
            sub="Đăng ký dịch vụ"
          />
          <Shortcut
            href="/notifications"
            icon={<Bell className="size-7" />}
            label="Thông báo"
            sub={unreadCount ? `${unreadCount} chưa đọc` : "Tin tức"}
            badge={unreadCount}
          />
        </div>
      </section>
    </main>
  );
}

function greetingByTime() {
  const h = new Date().getHours();
  if (h < 11) return "Chào buổi sáng";
  if (h < 14) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function ServiceCard({
  delay, accent, icon, title, primary, secondary, progress, chip, chipLabel,
}: {
  delay: number;
  accent: string;
  icon: string;
  title: string;
  primary: string;
  secondary: string;
  progress?: number;
  chip: "live" | "warning" | "info";
  chipLabel: string;
}) {
  return (
    <div
      className="card-premium relative animate-fade-up p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-2xl shadow-md`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {title}
            </div>
            <span
              className={
                chip === "warning" ? "chip-warning" : chip === "info" ? "chip-info" : "chip-live"
              }
            >
              {chipLabel}
            </span>
          </div>
          <div className="mt-0.5 text-lg font-extrabold text-slate-900 tab-nums">{primary}</div>
          <div className="truncate text-[11px] text-slate-500">{secondary}</div>
          {progress !== undefined && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${accent} transition-all duration-700`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Shortcut({
  href, icon, label, sub, highlight, badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  highlight?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`card-interactive relative overflow-hidden p-4 ${
        highlight
          ? "bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 text-white ring-1 ring-brand-300/40"
          : ""
      }`}
    >
      {highlight && (
        <span
          aria-hidden
          className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/15 blur-xl"
        />
      )}
      <div
        className={`relative flex items-center justify-between ${
          highlight ? "text-white" : "text-brand-700"
        }`}
      >
        {icon}
        <ChevronRight
          className={`size-4 ${highlight ? "opacity-70" : "text-slate-300"}`}
        />
      </div>
      <div
        className={`relative mt-2 font-bold ${
          highlight ? "text-white" : "text-slate-800"
        }`}
      >
        {label}
      </div>
      <div
        className={`relative text-[11px] ${
          highlight ? "text-white/80" : "text-slate-500"
        }`}
      >
        {sub}
      </div>
      {badge ? (
        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
