"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { formatVND, toDate } from "@/lib/utils";
import type { Order } from "@/types";
import { CrossTable, buildMatrix } from "@/components/CrossTable";

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
    const q = query(collection(db, "orders"),
      where("status", "==", "PAID"),
      where("paidAt", ">=", Timestamp.fromDate(start)),
      where("paidAt", "<=", Timestamp.fromDate(end)));
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
  const maxChart = Math.max(1, ...chart.map((c) => c.value));

  if (profile && profile.role !== "OWNER")
    return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">🔒 Chỉ chủ hồ bơi (Owner) được xem báo cáo.</p>;

  const periodLabel = mode === "DAY" ? `Ngày ${new Date(day).toLocaleDateString("vi-VN")}`
    : mode === "MONTH" ? `Tháng ${month}`
    : mode === "YEAR" ? `Năm ${year}`
    : `Từ ${new Date(from).toLocaleDateString("vi-VN")} đến ${new Date(to).toLocaleDateString("vi-VN")}`;

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold text-brand-800">Báo cáo doanh thu</h1>
        <p className="text-sm text-slate-500">Realtime · chia theo Loại sản phẩm × Đối tượng</p>
      </header>

      {/* Mode selector */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["DAY", "MONTH", "YEAR", "CUSTOM"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${mode === m ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {m === "DAY" ? "Theo ngày" : m === "MONTH" ? "Theo tháng" : m === "YEAR" ? "Theo năm" : "Tùy chỉnh"}
          </button>
        ))}
      </div>

      {/* Range input */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
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

      {/* Tổng */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white sm:col-span-2">
          <div className="text-xs uppercase tracking-widest opacity-80">{periodLabel}</div>
          <div className="mt-1 text-3xl font-bold tab-nums">{formatVND(totalRevenue)}</div>
          <div className="mt-1 text-xs opacity-80">{orders.length} đơn · {uniqueCustomers} khách</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="text-xs text-slate-500">Trung bình/đơn</div>
          <div className="mt-1 text-2xl font-bold tab-nums text-slate-800">
            {orders.length > 0 ? formatVND(Math.round(totalRevenue / orders.length)) : "—"}
          </div>
        </div>
      </div>

      {/* Cross-table */}
      <section className="mt-5">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          Doanh thu theo Loại sản phẩm × Đối tượng
        </h3>
        <CrossTable matrix={matrix} />
      </section>

      {/* Bar chart */}
      {chart.length > 0 && (
        <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            {mode === "YEAR" ? "Doanh thu theo tháng" : "Doanh thu theo ngày"}
          </h3>
          <div className="flex h-40 items-end gap-1 overflow-x-auto">
            {chart.map((c) => (
              <div key={c.key} className="flex flex-1 flex-col items-center" style={{ minWidth: 24 }}
                title={`${c.label}: ${formatVND(c.value)}`}>
                <div className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400"
                  style={{ height: `${(c.value / maxChart) * 100}%` }} />
                <div className="mt-1 text-[10px] text-slate-500 tab-nums">{c.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!orders.length && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
          Chưa có đơn nào được thanh toán trong kỳ này.
        </p>
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
