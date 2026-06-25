"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { formatVND, toDate } from "@/lib/utils";
import type { Order } from "@/types";
import { CrossTable, buildMatrix } from "@/components/CrossTable";
import { TrendingUp, Coins, Users, ShoppingBag, Download, BookOpen, Ticket, PackageOpen, Trophy } from "lucide-react";

type Mode = "DAY" | "MONTH" | "YEAR" | "CUSTOM";

function rangeFor(mode: Mode, day: string, month: string, year: number, from: string, to: string): { start: Date; end: Date } {
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  if (mode === "DAY") {
    const d = new Date(day);
    return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate()), end: endOfDay(d) };
  }
  if (mode === "MONTH") {
    const [y, m] = month.split("-").map(Number);
    return { start: new Date(y, m - 1, 1), end: endOfDay(new Date(y, m, 0)) };
  }
  if (mode === "YEAR") {
    return { start: new Date(year, 0, 1), end: endOfDay(new Date(year, 11, 31)) };
  }
  return { start: new Date(from), end: endOfDay(new Date(to)) };
}

const PRODUCT_LABEL: Record<string, string> = {
  SWIM_COURSE: "Khóa học",
  PASS: "Vé thời hạn",
  PACKAGE: "Vé lượt",
};

export default function ReportsPage() {
  const { profile } = useAuthUser();
  const today = new Date();
  const [mode, setMode] = useState<Mode>("MONTH");
  const [day, setDay] = useState(today.toISOString().slice(0, 10));
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [year, setYear] = useState(today.getFullYear());
  const [from, setFrom] = useState(today.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (profile?.role !== "OWNER") return;
    const { start, end } = rangeFor(mode, day, month, year, from, to);
    const q = query(
      collection(db, "orders"),
      where("status", "==", "PAID"),
      where("paidAt", ">=", Timestamp.fromDate(start)),
      where("paidAt", "<=", Timestamp.fromDate(end)),
    );
    return onSnapshot(q, (s) => setOrders(s.docs.map((d) => d.data() as Order)),
      (e) => console.error("reports query error:", e));
  }, [mode, day, month, year, from, to, profile]);

  const matrix = useMemo(() => buildMatrix(orders), [orders]);

  // Bar chart: theo ngày (DAY/MONTH/CUSTOM) hoặc theo tháng (YEAR)
  const chart = useMemo(() => {
    if (mode === "YEAR") {
      const months: { key: string; label: string; value: number }[] = [];
      for (let m = 0; m < 12; m++) months.push({ key: String(m), label: `T${m + 1}`, value: 0 });
      for (const o of orders) {
        const d = toDate(o.paidAt ?? o.createdAt);
        months[d.getMonth()].value += o.amountVND ?? 0;
      }
      return months;
    }
    const map = new Map<string, number>();
    for (const o of orders) {
      const d = toDate(o.paidAt ?? o.createdAt);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      map.set(key, (map.get(key) ?? 0) + (o.amountVND ?? 0));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ key: k, label: k.slice(8), value: v }));
  }, [orders, mode]);

  const totalRevenue = orders.reduce((s, o) => s + (o.amountVND ?? 0), 0);
  const uniqueCustomers = new Set(orders.map((o) => o.customerId)).size;
  const aov = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const maxChart = Math.max(1, ...chart.map((c) => c.value));

  // Top khách hàng theo doanh thu
  const topCustomers = useMemo(() => {
    const m = new Map<string, { name: string; revenue: number; count: number }>();
    for (const o of orders) {
      const k = o.customerId;
      const existing = m.get(k);
      if (existing) {
        existing.revenue += o.amountVND ?? 0;
        existing.count += 1;
      } else {
        m.set(k, { name: o.beneficiaryName ?? "Khách", revenue: o.amountVND ?? 0, count: 1 });
      }
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [orders]);

  // Phân bố theo loại
  const byType = useMemo(() => {
    const m: Record<string, { count: number; revenue: number }> = {};
    for (const o of orders) {
      const t = o.productType;
      if (!m[t]) m[t] = { count: 0, revenue: 0 };
      m[t].count += 1;
      m[t].revenue += o.amountVND ?? 0;
    }
    return m;
  }, [orders]);

  if (profile && profile.role !== "OWNER")
    return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">🔒 Chỉ chủ hồ bơi (Owner) được xem báo cáo.</p>;

  const periodLabel = mode === "DAY" ? `Ngày ${new Date(day).toLocaleDateString("vi-VN")}`
    : mode === "MONTH" ? `Tháng ${month}`
    : mode === "YEAR" ? `Năm ${year}`
    : `Từ ${new Date(from).toLocaleDateString("vi-VN")} đến ${new Date(to).toLocaleDateString("vi-VN")}`;

  function exportCsv() {
    const rows = [
      ["Mã đơn", "Ngày thanh toán", "Khách hàng", "Người thụ hưởng", "Loại", "Số tiền (VND)"],
      ...orders.map((o) => [
        o.id,
        toDate(o.paidAt ?? o.createdAt).toLocaleString("vi-VN"),
        o.customerId,
        o.beneficiaryName,
        PRODUCT_LABEL[o.productType] ?? o.productType,
        String(o.amountVND ?? 0),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-${periodLabel.replace(/\s/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-800">
            Báo cáo doanh thu
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Realtime · {periodLabel}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!orders.length}
          className="flex items-center gap-1.5 rounded-xl border-2 border-brand-200 bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
        >
          <Download className="size-4" /> Xuất CSV
        </button>
      </header>

      {/* Mode selector */}
      <div className="flex flex-wrap items-center gap-2">
        {(["DAY", "MONTH", "YEAR", "CUSTOM"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${mode === m ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {m === "DAY" ? "Theo ngày" : m === "MONTH" ? "Theo tháng" : m === "YEAR" ? "Theo năm" : "Tùy chỉnh"}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{orders.length} đơn</span>
      </div>

      {/* Range input */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {mode === "DAY" && (
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
            className="rounded-xl border-2 border-slate-200 p-2" />
        )}
        {mode === "MONTH" && (
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border-2 border-slate-200 p-2" />
        )}
        {mode === "YEAR" && (
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border-2 border-slate-200 p-2">
            {Array.from({ length: 6 }).map((_, i) => {
              const y = today.getFullYear() - i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        )}
        {mode === "CUSTOM" && (
          <>
            <label>Từ:</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border-2 border-slate-200 p-2" />
            <label>Đến:</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border-2 border-slate-200 p-2" />
          </>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportKpi
          icon={<Coins className="size-5" />}
          label="Tổng doanh thu"
          value={formatVND(totalRevenue)}
          primary
        />
        <ReportKpi
          icon={<ShoppingBag className="size-5" />}
          label="Số đơn"
          value={String(orders.length)}
        />
        <ReportKpi
          icon={<Users className="size-5" />}
          label="Khách unique"
          value={String(uniqueCustomers)}
        />
        <ReportKpi
          icon={<TrendingUp className="size-5" />}
          label="Trung bình/đơn"
          value={aov > 0 ? formatVND(aov) : "—"}
        />
      </div>

      {/* Phân bố theo loại */}
      <section>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          Phân bố theo loại sản phẩm
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TypeBreakdown
            icon={<BookOpen className="size-4" />}
            label="Khóa học"
            count={byType.SWIM_COURSE?.count ?? 0}
            revenue={byType.SWIM_COURSE?.revenue ?? 0}
            total={totalRevenue}
            color="from-cyan-500 to-cyan-700"
          />
          <TypeBreakdown
            icon={<Ticket className="size-4" />}
            label="Vé thời hạn"
            count={byType.PASS?.count ?? 0}
            revenue={byType.PASS?.revenue ?? 0}
            total={totalRevenue}
            color="from-brand-500 to-brand-700"
          />
          <TypeBreakdown
            icon={<PackageOpen className="size-4" />}
            label="Vé lượt"
            count={byType.PACKAGE?.count ?? 0}
            revenue={byType.PACKAGE?.revenue ?? 0}
            total={totalRevenue}
            color="from-amber-500 to-amber-700"
          />
        </div>
      </section>

      {/* Cross-table */}
      <section>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          Doanh thu theo Loại sản phẩm × Đối tượng
        </h3>
        <CrossTable matrix={matrix} />
      </section>

      {/* Bar chart */}
      {chart.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            {mode === "YEAR" ? "Doanh thu theo tháng" : "Doanh thu theo ngày"}
          </h3>
          <div className="overflow-x-auto">
            <div className="flex h-44 flex-col gap-2" style={{ minWidth: Math.max(chart.length * 28, 240) }}>
              <div className="flex flex-1 items-end gap-1">
                {chart.map((c) => (
                  <div
                    key={c.key}
                    className="flex h-full flex-1 items-end"
                    style={{ minWidth: 24 }}
                    title={`${c.label}: ${formatVND(c.value)}`}
                  >
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400 transition-all hover:from-brand-700 hover:to-brand-500"
                      style={{ height: `${Math.max(2, (c.value / maxChart) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                {chart.map((c) => (
                  <div
                    key={c.key}
                    className="flex-1 text-center text-[10px] text-slate-500 tab-nums"
                    style={{ minWidth: 24 }}
                  >
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Top khách hàng */}
      {topCustomers.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Trophy className="size-4 text-amber-500" /> Top {topCustomers.length} khách hàng
          </h3>
          <ol className="space-y-2">
            {topCustomers.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5"
              >
                <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0 ? "bg-amber-200 text-amber-900"
                  : i === 1 ? "bg-slate-200 text-slate-700"
                  : i === 2 ? "bg-orange-200 text-orange-900"
                  : "bg-white text-slate-500 ring-1 ring-slate-200"
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.count} đơn</div>
                </div>
                <div className="text-sm font-bold tab-nums text-brand-700">
                  {formatVND(c.revenue)}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!orders.length && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
          Chưa có đơn nào được thanh toán trong kỳ này.
        </p>
      )}
    </div>
  );
}

function ReportKpi({
  icon, label, value, primary,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 shadow-sm ${
      primary
        ? "bg-gradient-to-br from-brand-600 to-brand-700 text-white"
        : "border border-slate-100 bg-white"
    }`}>
      {primary && (
        <span className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
      )}
      <div className={`relative flex items-center gap-1.5 text-xs ${primary ? "text-white/90" : "text-slate-600"}`}>
        {icon} {label}
      </div>
      <div className={`relative mt-1.5 text-2xl font-extrabold tab-nums ${primary ? "text-white" : "text-slate-800"}`}>
        {value}
      </div>
    </div>
  );
}

function TypeBreakdown({
  icon, label, count, revenue, total, color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  revenue: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((revenue / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon} {label}
      </div>
      <div className="mt-1.5 text-lg font-bold text-slate-800 tab-nums">{formatVND(revenue)}</div>
      <div className="text-xs text-slate-500">{count} đơn</div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-semibold text-slate-500 tab-nums">{pct}%</span>
      </div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
