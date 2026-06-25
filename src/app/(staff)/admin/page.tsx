"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { formatVND, toDate } from "@/lib/utils";
import { POOL_INFO } from "@/lib/constants";
import type { Order, CheckIn } from "@/types";
import {
  TrendingUp, TrendingDown, Calendar, Coins, AlertCircle, ShieldOff,
  BookOpen, Ticket, PackageOpen, Users, Clock,
} from "lucide-react";
import { CrossTable, buildMatrix } from "@/components/CrossTable";
import { CheckinQueue } from "@/components/CheckinQueue";

// v2.4.2 (Q4): dashboard chuyên nghiệp hơn:
// - Hôm nay: 4 KPI (pending / paid / revenue / khách unique) + so sánh với hôm qua
// - Bảng chéo Loại × Đối tượng
// - Lưu lượng check-in theo giờ (mini sparkline)
// - Tháng này: revenue by type + tổng + so sánh tháng trước (Owner only)

export default function AdminDashboardPage() {
  const { profile } = useAuthUser();
  const isOwner = profile?.role === "OWNER";

  // Date helpers
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const yesterdayStart = startOfDay(addDays(today, -1));
  const yesterdayEnd = endOfDay(addDays(today, -1));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = endOfDay(new Date(today.getFullYear(), today.getMonth(), 0));
  const monthKey = today.toLocaleDateString("vi-VN", { year: "numeric", month: "long" });

  const [pending, setPending] = useState(0);
  const [paidToday, setPaidToday] = useState<Order[]>([]);
  const [paidYesterday, setPaidYesterday] = useState<Order[]>([]);
  const [paidMonth, setPaidMonth] = useState<Order[]>([]);
  const [paidLastMonth, setPaidLastMonth] = useState<Order[]>([]);
  const [checkinsToday, setCheckinsToday] = useState<CheckIn[]>([]);

  useEffect(() => {
    const subs: (() => void)[] = [];
    subs.push(
      onSnapshot(
        query(collection(db, "orders"), where("status", "==", "PENDING_PAYMENT")),
        (s) => setPending(s.size),
      ),
    );
    subs.push(
      onSnapshot(
        query(
          collection(db, "orders"),
          where("status", "==", "PAID"),
          where("paidAt", ">=", Timestamp.fromDate(todayStart)),
          where("paidAt", "<=", Timestamp.fromDate(todayEnd)),
        ),
        (s) => setPaidToday(s.docs.map((d) => d.data() as Order)),
      ),
    );
    subs.push(
      onSnapshot(
        query(
          collection(db, "orders"),
          where("status", "==", "PAID"),
          where("paidAt", ">=", Timestamp.fromDate(yesterdayStart)),
          where("paidAt", "<=", Timestamp.fromDate(yesterdayEnd)),
        ),
        (s) => setPaidYesterday(s.docs.map((d) => d.data() as Order)),
      ),
    );
    subs.push(
      onSnapshot(
        query(
          collection(db, "checkins"),
          where("at", ">=", Timestamp.fromDate(todayStart)),
          where("at", "<=", Timestamp.fromDate(todayEnd)),
        ),
        (s) => setCheckinsToday(s.docs.map((d) => d.data() as CheckIn)),
      ),
    );
    if (isOwner) {
      subs.push(
        onSnapshot(
          query(
            collection(db, "orders"),
            where("status", "==", "PAID"),
            where("paidAt", ">=", Timestamp.fromDate(monthStart)),
            where("paidAt", "<=", Timestamp.fromDate(monthEnd)),
          ),
          (s) => setPaidMonth(s.docs.map((d) => d.data() as Order)),
        ),
      );
      subs.push(
        onSnapshot(
          query(
            collection(db, "orders"),
            where("status", "==", "PAID"),
            where("paidAt", ">=", Timestamp.fromDate(lastMonthStart)),
            where("paidAt", "<=", Timestamp.fromDate(lastMonthEnd)),
          ),
          (s) => setPaidLastMonth(s.docs.map((d) => d.data() as Order)),
        ),
      );
    }
    return () => subs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  const todayRevenue = paidToday.reduce((s, o) => s + (o.amountVND ?? 0), 0);
  const yesterdayRevenue = paidYesterday.reduce((s, o) => s + (o.amountVND ?? 0), 0);
  const todayUnique = new Set(paidToday.map((o) => o.customerId)).size;
  const yesterdayUnique = new Set(paidYesterday.map((o) => o.customerId)).size;
  const todayAOV = paidToday.length > 0 ? Math.round(todayRevenue / paidToday.length) : 0;
  const todayMatrix = buildMatrix(paidToday);

  // Check-in theo giờ (hôm nay)
  const checkinsByHour = useMemo(() => {
    const arr = Array(24).fill(0);
    for (const c of checkinsToday) {
      const h = toDate(c.at).getHours();
      arr[h] += c.groupSize ?? 1;
    }
    return arr;
  }, [checkinsToday]);
  const peakHour = useMemo(() => {
    let max = 0, h = 0;
    checkinsByHour.forEach((v, i) => { if (v > max) { max = v; h = i; } });
    return max > 0 ? { hour: h, count: max } : null;
  }, [checkinsByHour]);

  // Month aggregates
  const byType = paidMonth.reduce(
    (acc, o) => { acc[o.productType] = (acc[o.productType] ?? 0) + (o.amountVND ?? 0); return acc; },
    {} as Record<string, number>,
  );
  const total = Object.values(byType).reduce((a, b) => a + b, 0);
  const lastMonthTotal = paidLastMonth.reduce((s, o) => s + (o.amountVND ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-800">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className="capitalize">{today.toLocaleDateString("vi-VN", { weekday: "long" })}</span>
            {" · "}{today.toLocaleDateString("vi-VN")}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">📍 {POOL_INFO.address}</p>
        </div>
        <span className="chip-live">Realtime</span>
      </header>

      {/* Hàng đợi check-in vé lượt */}
      <CheckinQueue />

      {/* HÔM NAY: 4 KPI */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Calendar className="size-3.5" /> Hôm nay
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            icon={<AlertCircle className="size-5" />}
            label="Đơn chờ TT"
            value={pending}
            accent="warning"
          />
          <KpiCard
            icon={<TrendingUp className="size-5" />}
            label="Đơn đã thu"
            value={paidToday.length}
            delta={delta(paidToday.length, paidYesterday.length)}
            accent="default"
          />
          {isOwner && (
            <KpiCard
              icon={<Coins className="size-5" />}
              label="Doanh thu"
              value={formatVND(todayRevenue)}
              delta={delta(todayRevenue, yesterdayRevenue)}
              accent="primary"
            />
          )}
          <KpiCard
            icon={<Users className="size-5" />}
            label="Khách unique"
            value={todayUnique}
            delta={delta(todayUnique, yesterdayUnique)}
            accent="default"
          />
        </div>

        {/* Sub-row: AOV + peak hour + checkins today */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {isOwner && (
            <SubStat
              icon={<TrendingUp className="size-4" />}
              label="TB / đơn"
              value={todayAOV > 0 ? formatVND(todayAOV) : "—"}
            />
          )}
          <SubStat
            icon={<Users className="size-4" />}
            label="Check-in hôm nay"
            value={`${checkinsToday.reduce((s, c) => s + (c.groupSize ?? 1), 0)} lượt`}
          />
          <SubStat
            icon={<Clock className="size-4" />}
            label="Giờ cao điểm"
            value={peakHour ? `${peakHour.hour}h (${peakHour.count})` : "—"}
          />
        </div>

        {/* Sparkline check-in theo giờ */}
        {checkinsToday.length > 0 && (
          <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lưu lượng check-in theo giờ
              </span>
              <span className="text-xs text-slate-400">
                {checkinsToday.reduce((s, c) => s + (c.groupSize ?? 1), 0)} lượt
              </span>
            </div>
            <HourBars data={checkinsByHour} />
          </div>
        )}

        {/* Bảng chéo Loại × Đối tượng — hôm nay */}
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Doanh thu theo Loại × Đối tượng (hôm nay)
          </h3>
          <CrossTable matrix={todayMatrix} hideTotal={!isOwner} />
        </div>
      </section>

      {/* THÁNG NÀY (Owner only) */}
      {isOwner && (
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Calendar className="size-3.5" /> {monthKey}
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <RevenueByType
                icon={<BookOpen className="size-4" />}
                label="Khóa học bơi"
                value={byType.SWIM_COURSE ?? 0}
                total={total}
                color="from-cyan-500 to-cyan-700"
              />
              <RevenueByType
                icon={<Ticket className="size-4" />}
                label="Vé thời hạn"
                value={byType.PASS ?? 0}
                total={total}
                color="from-brand-500 to-brand-700"
              />
              <RevenueByType
                icon={<PackageOpen className="size-4" />}
                label="Gói lượt"
                value={byType.PACKAGE ?? 0}
                total={total}
                color="from-amber-500 to-amber-700"
              />
            </div>
            <TotalRevenueCard total={total} count={paidMonth.length} delta={delta(total, lastMonthTotal)} />
          </div>
        </section>
      )}

      {!isOwner && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldOff className="size-5 flex-shrink-0 text-amber-600" />
            <div>
              <div className="font-semibold text-amber-900">
                Báo cáo tài chính chỉ dành cho chủ hồ bơi
              </div>
              <p className="mt-1 text-sm text-amber-800">
                Lễ tân có thể xem đơn pending, xác nhận thanh toán và check-in hộ.
                Doanh thu tổng do Owner quản lý (INV-9).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Helpers ============
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function delta(now: number, prev: number): { value: number; positive: boolean } | undefined {
  if (prev === 0 && now === 0) return undefined;
  if (prev === 0) return { value: 100, positive: true };
  const pct = Math.round(((now - prev) / prev) * 100);
  return { value: Math.abs(pct), positive: pct >= 0 };
}

function KpiCard({
  icon, label, value, accent, delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent: "primary" | "warning" | "default";
  delta?: { value: number; positive: boolean };
}) {
  const isPrimary = accent === "primary";
  const isWarning = accent === "warning";
  
  return (
    <div
      className={`relative overflow-hidden rounded-2.5xl p-5 shadow-sm border transition-all duration-200 hover:shadow-md ${
        isPrimary
          ? "bg-gradient-to-br from-emerald-500 via-brand-600 to-brand-700 text-white border-brand-500/20 shadow-[0_12px_24px_-4px_rgba(5,150,105,0.25)]"
          : isWarning
          ? "border-amber-100 bg-amber-50/20 text-slate-800"
          : "border-slate-100 bg-white text-slate-800"
      }`}
    >
      {isPrimary && (
        <span className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      )}
      <div className="relative flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        <span className={isWarning ? "text-amber-600" : isPrimary ? "text-emerald-100" : "text-brand-600"}>
          {icon}
        </span>
        <span className={isWarning ? "text-amber-700" : isPrimary ? "text-emerald-100" : "text-slate-500"}>
          {label}
        </span>
      </div>
      <div className={`relative mt-2 text-2xl font-black tracking-tight tab-nums ${
        isWarning ? "text-amber-800" : isPrimary ? "text-white" : "text-slate-800"
      }`}>
        {value}
      </div>
      {delta && (
        <div className={`relative mt-2.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
          delta.positive
            ? isPrimary ? "bg-emerald-400/20 text-emerald-50" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
            : isPrimary ? "bg-rose-450/20 text-rose-50" : "bg-rose-50 text-rose-700 border border-rose-100"
        }`}>
          {delta.positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {delta.value}% so với hôm qua
        </div>
      )}
    </div>
  );
}

function SubStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100/70 bg-white p-3.5 shadow-sm hover:shadow-md transition-shadow">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100/20 shadow-inner">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="truncate text-[15px] font-black text-slate-800 mt-0.5 tab-nums">{value}</div>
      </div>
    </div>
  );
}

function HourBars({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex h-24 flex-col gap-1.5 pt-2">
      <div className="flex flex-1 items-end gap-1">
        {data.map((v, i) => (
          <div
            key={i}
            className="flex h-full flex-1 items-end"
            title={`${i}h: ${v} lượt`}
          >
            <div
              className={`w-full rounded-t-md transition-all duration-300 ${
                v > 0 ? "bg-gradient-to-t from-emerald-600 via-brand-500 to-brand-400" : "bg-slate-50"
              }`}
              style={{ height: `${Math.max(3, (v / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 border-t border-slate-100 pt-1">
        {data.map((_, i) => (
          <span key={i} className="flex-1 text-center text-[9px] font-bold text-slate-400/80">
            {i % 4 === 0 ? `${i}h` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function RevenueByType({
  icon, label, value, total, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-2.5xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        <span className="text-brand-600">{icon}</span> {label}
      </div>
      <div className="mt-2 text-xl font-black text-slate-800 tab-nums">{formatVND(value)}</div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-slate-500 tab-nums">{pct}%</span>
      </div>
    </div>
  );
}

function TotalRevenueCard({
  total, count, delta,
}: {
  total: number;
  count: number;
  delta?: { value: number; positive: boolean };
}) {
  return (
    <div className="hero-mesh hero-aurora relative overflow-hidden rounded-2.5xl p-6 text-white shadow-float border border-brand-500/20">
      <span className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-100">Tổng doanh thu tháng</div>
      <div className="mt-2 text-3xl font-black tracking-tight tab-nums text-shadow-md">
        {formatVND(total)}
      </div>
      <div className="mt-1 text-xs font-semibold text-emerald-100/90">{count} đơn đã hoàn tất thanh toán</div>
      {delta && (
        <div className={`mt-3 inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm ${
          delta.positive ? "bg-emerald-500/35 text-white ring-1 ring-emerald-300/20" : "bg-red-500/35 text-white ring-1 ring-red-300/20"
        }`}>
          {delta.positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {delta.value}% so với tháng trước
        </div>
      )}
    </div>
  );
}
