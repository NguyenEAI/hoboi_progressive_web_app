"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { formatVND } from "@/lib/utils";
import { POOL_INFO } from "@/lib/constants";
import type { Order } from "@/types";
import { TrendingUp, Calendar, Coins, AlertCircle, ShieldOff, BookOpen, Ticket, PackageOpen } from "lucide-react";

export default function AdminDashboardPage() {
  const { profile } = useAuthUser();
  const isOwner = profile?.role === "OWNER";
  const today = new Date();
  const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthKey = today.toLocaleDateString("vi-VN", { year: "numeric", month: "long" });

  const [pending, setPending] = useState(0);
  const [paidToday, setPaidToday] = useState<Order[]>([]);
  const [paidMonth, setPaidMonth] = useState<Order[]>([]);

  useEffect(() => {
    const subs: (() => void)[] = [];
    subs.push(onSnapshot(query(collection(db, "orders"), where("status", "==", "PENDING_PAYMENT")),
      (s) => setPending(s.size)));
    if (isOwner) {
      subs.push(onSnapshot(
        query(collection(db, "orders"), where("status", "==", "PAID"),
          where("paidAt", ">=", Timestamp.fromDate(todayStart))),
        (s) => setPaidToday(s.docs.map((d) => d.data() as Order))));
      subs.push(onSnapshot(
        query(collection(db, "orders"), where("status", "==", "PAID"),
          where("paidAt", ">=", Timestamp.fromDate(monthStart))),
        (s) => setPaidMonth(s.docs.map((d) => d.data() as Order))));
    }
    return () => subs.forEach((u) => u());
  }, [isOwner]);

  const todayRevenue = paidToday.reduce((s, o) => s + (o.amountVND ?? 0), 0);
  const byType = paidMonth.reduce((acc, o) => {
    acc[o.productType] = (acc[o.productType] ?? 0) + (o.amountVND ?? 0);
    return acc;
  }, {} as Record<string, number>);
  const total = Object.values(byType).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-800">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className="capitalize">{today.toLocaleDateString("vi-VN", { weekday: "long" })}</span>
            {" · "}
            {today.toLocaleDateString("vi-VN")}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">📍 {POOL_INFO.address}</p>
        </div>
        <span className="chip-live">Realtime</span>
      </header>

      {/* Hôm nay */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Calendar className="size-3.5" /> Hôm nay
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            icon={<AlertCircle className="size-5" />}
            label="Đơn chờ thanh toán"
            value={pending}
            accent="warning"
          />
          {isOwner && (
            <KpiCard
              icon={<TrendingUp className="size-5" />}
              label="Đơn đã thu hôm nay"
              value={paidToday.length}
              accent="default"
            />
          )}
          {isOwner && (
            <KpiCard
              icon={<Coins className="size-5" />}
              label="Doanh thu hôm nay"
              value={formatVND(todayRevenue)}
              accent="primary"
            />
          )}
        </div>
      </section>

      {/* Tháng */}
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
            <TotalRevenueCard total={total} count={paidMonth.length} />
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

function KpiCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent: "primary" | "warning" | "default";
}) {
  if (accent === "primary") {
    return (
      <div className="card-premium relative overflow-hidden p-5">
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-brand-200/50 blur-2xl" />
        <div className="relative flex items-center gap-2 text-brand-700">
          {icon}
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <div className="relative mt-3 text-3xl font-extrabold text-brand-800 tab-nums">
          {value}
        </div>
      </div>
    );
  }
  return (
    <div className="card p-5">
      <div
        className={`flex items-center gap-2 ${
          accent === "warning" ? "text-amber-700" : "text-slate-600"
        }`}
      >
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div
        className={`mt-2 text-3xl font-extrabold tab-nums ${
          accent === "warning" ? "text-amber-600" : "text-slate-800"
        }`}
      >
        {value}
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
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon} {label}
      </div>
      <div className="mt-1.5 text-lg font-bold text-slate-800 tab-nums">{formatVND(value)}</div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-semibold text-slate-500 tab-nums">{pct}%</span>
      </div>
    </div>
  );
}

function TotalRevenueCard({ total, count }: { total: number; count: number }) {
  return (
    <div className="hero-mesh hero-aurora relative overflow-hidden rounded-2xl p-5 text-white shadow-elevated">
      <div className="text-xs uppercase tracking-widest opacity-90">Tổng doanh thu tháng</div>
      <div className="mt-1 text-3xl font-extrabold tracking-tight tab-nums">
        {formatVND(total)}
      </div>
      <div className="mt-1 text-xs opacity-85">
        {count} đơn đã thanh toán
      </div>
    </div>
  );
}
