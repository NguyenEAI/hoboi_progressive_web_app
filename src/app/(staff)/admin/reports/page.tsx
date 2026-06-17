"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { formatVND, toDate } from "@/lib/utils";
import type { Order } from "@/types";

export default function ReportsPage() {
  const { profile } = useAuthUser();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (profile?.role !== "OWNER") return;
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const q = query(collection(db, "orders"),
      where("status", "==", "PAID"),
      where("paidAt", ">=", Timestamp.fromDate(start)),
      where("paidAt", "<", Timestamp.fromDate(end)));
    return onSnapshot(q, (s) => setOrders(s.docs.map((d) => d.data() as Order)),
      (e) => console.error("reports query error:", e));
  }, [month, profile]);

  const stats = useMemo(() => {
    let total = 0;
    const byType: Record<string, number> = {};
    const byAudience: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    for (const o of orders) {
      total += o.amountVND ?? 0;
      byType[o.productType] = (byType[o.productType] ?? 0) + (o.amountVND ?? 0);
      const aud = (o.productSnapshot?.audience as string) ?? "—";
      byAudience[aud] = (byAudience[aud] ?? 0) + (o.amountVND ?? 0);
      const d = toDate(o.paidAt ?? o.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      byDay[key] = (byDay[key] ?? 0) + (o.amountVND ?? 0);
    }
    return { total, byType, byAudience, byDay };
  }, [orders]);

  if (profile && profile.role !== "OWNER")
    return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">🔒 Chỉ chủ hồ bơi (Owner) được xem báo cáo.</p>;

  const typeRows = [
    { label: "Khóa học bơi", key: "SWIM_COURSE" },
    { label: "Vé thời hạn", key: "PASS" },
    { label: "Gói lượt", key: "PACKAGE" },
  ];
  const audRows = [
    { label: "🧒 Trẻ <1.4m", key: "CHILD_UNDER_140" },
    { label: "🧑 Trẻ >1.4m", key: "CHILD_OVER_140" },
    { label: "🧔 Người lớn", key: "ADULT" },
  ];
  const maxType = Math.max(1, ...typeRows.map((x) => stats.byType[x.key] ?? 0));
  const maxAud = Math.max(1, ...audRows.map((x) => stats.byAudience[x.key] ?? 0));
  const sortedDays = Object.entries(stats.byDay).sort(([a], [b]) => a.localeCompare(b));
  const maxDay = Math.max(1, ...sortedDays.map(([, v]) => v));

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex items-end justify-between">
        <div><h1 className="text-2xl font-bold text-brand-800">Báo cáo doanh thu</h1>
        <p className="text-sm text-slate-500">Tính trực tiếp từ đơn đã thanh toán · cập nhật ngay khi có đơn mới</p></div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border-2 border-slate-200 p-2" />
      </header>

      <div className="mt-5 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white">
        <div className="text-sm opacity-80">Tổng doanh thu tháng {month}</div>
        <div className="mt-1 text-3xl font-bold">{formatVND(stats.total)}</div>
        <div className="mt-1 text-xs opacity-80">{orders.length} đơn đã thu</div>
      </div>

      {/* Theo loại */}
      <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-white p-5">
        <h3 className="font-semibold text-slate-700">Doanh thu theo loại sản phẩm</h3>
        {typeRows.map((x) => {
          const v = stats.byType[x.key] ?? 0;
          return (
            <div key={x.key}>
              <div className="mb-1 flex justify-between text-sm"><span>{x.label}</span><b>{formatVND(v)}</b></div>
              <div className="h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-brand-600" style={{ width: `${(v / maxType) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>

      {/* Theo đối tượng */}
      <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-white p-5">
        <h3 className="font-semibold text-slate-700">Doanh thu theo đối tượng (vé/gói)</h3>
        {audRows.map((x) => {
          const v = stats.byAudience[x.key] ?? 0;
          return (
            <div key={x.key}>
              <div className="mb-1 flex justify-between text-sm"><span>{x.label}</span><b>{formatVND(v)}</b></div>
              <div className="h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${(v / maxAud) * 100}%` }} /></div>
            </div>
          );
        })}
        {!stats.byAudience.ADULT && !stats.byAudience.CHILD_UNDER_140 && !stats.byAudience.CHILD_OVER_140 && (
          <p className="text-xs text-slate-400">Chưa có dữ liệu (khóa học không chia theo đối tượng)</p>
        )}
      </div>

      {/* Theo ngày */}
      {sortedDays.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5">
          <h3 className="mb-3 font-semibold text-slate-700">Doanh thu theo ngày</h3>
          <div className="flex h-32 items-end gap-1 overflow-x-auto">
            {sortedDays.map(([day, v]) => (
              <div key={day} className="flex flex-1 flex-col items-center" style={{ minWidth: 20 }} title={`${day}: ${formatVND(v)}`}>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${(v / maxDay) * 100}%` }} />
                <div className="mt-1 text-[9px] text-slate-400">{day.slice(8)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!orders.length && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
          Chưa có đơn nào được thanh toán trong tháng này.
        </p>
      )}
    </div>
  );
}
