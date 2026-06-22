"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, limit, Timestamp, type QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { confirmPayment, refundOrder, deleteOrder } from "@/lib/callable";
import { formatVND, formatDate, toDate } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";

const TABS: { key: OrderStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING_PAYMENT", label: "Chờ TT" },
  { key: "PAID", label: "Đã thu" },
  { key: "CANCELLED", label: "Hủy" },
  { key: "REFUNDED", label: "Hoàn" },
];
const BADGE: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-700", PAID: "bg-green-100 text-green-700",
  CANCELLED: "bg-slate-100 text-slate-600", REFUNDED: "bg-red-100 text-red-700",
};

type RangePreset = "TODAY" | "YESTERDAY" | "LAST_7" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "CUSTOM" | "ALL";

function rangeOf(preset: RangePreset, customFrom?: string, customTo?: string): { from: Date; to: Date } | null {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  switch (preset) {
    case "ALL": return null;
    case "TODAY": return { from: startOfDay(now), to: endOfDay(now) };
    case "YESTERDAY": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "LAST_7": {
      const from = new Date(now); from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "THIS_MONTH":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case "LAST_MONTH":
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "THIS_YEAR":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(new Date(now.getFullYear(), 11, 31)) };
    case "CUSTOM": {
      if (!customFrom || !customTo) return null;
      return { from: startOfDay(new Date(customFrom)), to: endOfDay(new Date(customTo)) };
    }
  }
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "TODAY", label: "Hôm nay" },
  { key: "YESTERDAY", label: "Hôm qua" },
  { key: "LAST_7", label: "7 ngày" },
  { key: "THIS_MONTH", label: "Tháng này" },
  { key: "LAST_MONTH", label: "Tháng trước" },
  { key: "THIS_YEAR", label: "Năm này" },
  { key: "CUSTOM", label: "Tùy chỉnh" },
];

export default function OrdersPage() {
  const { profile } = useAuthUser();
  const isOwner = profile?.role === "OWNER";
  const [tab, setTab] = useState<OrderStatus | "ALL">("ALL");
  const [preset, setPreset] = useState<RangePreset>("TODAY");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState<string>();
  const [err, setErr] = useState<string>();

  const range = useMemo(() => rangeOf(preset, customFrom, customTo), [preset, customFrom, customTo]);

  useEffect(() => {
    setErr(undefined); setOrders([]);
    const base = collection(db, "orders");
    const constraints: QueryConstraint[] = [];
    if (tab !== "ALL") constraints.push(where("status", "==", tab));
    if (range) {
      constraints.push(where("createdAt", ">=", Timestamp.fromDate(range.from)));
      constraints.push(where("createdAt", "<=", Timestamp.fromDate(range.to)));
    }
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(500));
    return onSnapshot(query(base, ...constraints),
      (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() } as Order))),
      (e) => { console.error("orders query error:", e); setErr(e.message); });
  }, [tab, range]);

  const grouped = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of orders) {
      const d = toDate(o.createdAt);
      const key = isNaN(d.getTime()) ? "—" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const arr = m.get(key) ?? [];
      arr.push(o);
      m.set(key, arr);
    }
    return [...m.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [orders]);

  const totalAmount = orders.filter((o) => o.status === "PAID").reduce((s, o) => s + (o.amountVND ?? 0), 0);

  async function pay(id: string) {
    setBusy(id);
    try { await confirmPayment({ orderId: id }); } catch (e) { alert((e as Error).message); } finally { setBusy(undefined); }
  }
  async function refund(id: string) {
    const reason = prompt("Lý do hoàn tiền (bắt buộc):");
    if (!reason?.trim()) return;
    setBusy(id);
    try { await refundOrder({ orderId: id, reason }); } catch (e) { alert((e as Error).message); } finally { setBusy(undefined); }
  }
  async function del(o: Order) {
    let reason: string | undefined;
    if (o.status === "PENDING_PAYMENT") {
      if (!confirm("Xóa đơn chưa thanh toán này?")) return;
    } else {
      reason = prompt(
        `Bạn đang XÓA CỨNG đơn ${o.status}. Hành động này không hoàn tác.\n` +
        `Thẻ/payment đã sinh sẽ được gắn cờ "orderDeleted" để loại khỏi báo cáo mới.\n\n` +
        `Lý do (bắt buộc):`,
      )?.trim();
      if (!reason) return;
      if (!confirm(`Xác nhận xóa cứng đơn ${o.id.slice(0, 6)}? Không thể hoàn tác.`)) return;
    }
    setBusy(o.id);
    try { await deleteOrder({ orderId: o.id, reason }); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(undefined); }
  }

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold text-brand-800">Đơn hàng</h1>
        <p className="text-sm text-slate-500">Xác nhận thanh toán tiền mặt · lịch sử theo ngày/tháng/năm</p>
      </header>

      {/* Tab trạng thái */}
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${tab === t.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Range preset */}
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${preset === p.key ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
            {p.label}
          </button>
        ))}
      </div>
      {preset === "CUSTOM" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <label>Từ:</label>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg border-2 border-slate-200 px-2 py-1" />
          <label>Đến:</label>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border-2 border-slate-200 px-2 py-1" />
        </div>
      )}

      {/* Tổng kỳ */}
      <div className="mt-3 rounded-xl bg-brand-50 px-4 py-2 text-sm text-brand-800">
        <b>{orders.length}</b> đơn trong kỳ · <b>{formatVND(totalAmount)}</b> đã thu (PAID)
        {range && <span className="text-xs text-slate-500"> · {fmtRange(range)}</span>}
      </div>

      {err && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">Lỗi truy vấn: {err}</p>}

      <div className="mt-4 space-y-4">
        {grouped.map(([day, items]) => (
          <section key={day} className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 bg-brand-50 px-4 py-2">
              <div>
                <div className="text-sm font-semibold text-brand-800">{niceDay(day)}</div>
                <div className="text-xs text-slate-500">{items.length} đơn · {formatVND(items.filter((o) => o.status === "PAID").reduce((s, o) => s + (o.amountVND ?? 0), 0))} đã thu</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-2">Giờ</th><th className="px-4 py-2">Mã</th><th className="px-4 py-2">Khách</th><th className="px-4 py-2">Sản phẩm</th><th className="px-4 py-2">Số tiền</th><th className="px-4 py-2">Trạng thái</th><th className="px-4 py-2">Thao tác</th></tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs text-slate-500">{toDate(o.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-2 font-mono text-xs">{o.id.slice(0, 6)}</td>
                    <td className="px-4 py-2">{o.beneficiaryName || "—"}</td>
                    <td className="px-4 py-2">{o.productSnapshot?.name}{o.productSnapshot?.audience ? ` · ${audShort(o.productSnapshot.audience)}` : ""}</td>
                    <td className="px-4 py-2 font-semibold">{formatVND(o.amountVND)}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${BADGE[o.status] ?? ""}`}>{o.status}</span></td>
                    <td className="px-4 py-2 space-x-1">
                      {o.status === "PENDING_PAYMENT" && (
                        <button disabled={busy === o.id} onClick={() => pay(o.id)}
                          className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">✓ Đã thu</button>
                      )}
                      {o.status === "PAID" && isOwner && (
                        <button disabled={busy === o.id} onClick={() => refund(o.id)}
                          className="rounded-lg border-2 border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 disabled:opacity-50">↩ Hoàn</button>
                      )}
                      {isOwner && (
                        <button disabled={busy === o.id} onClick={() => del(o)}
                          className="rounded-lg border-2 border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 disabled:opacity-50">🗑 Xóa</button>
                      )}
                      {o.status === "PAID" && !isOwner && <span className="text-xs text-slate-400">{formatDate(o.paidAt)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {!grouped.length && <p className="rounded-2xl bg-white p-8 text-center text-slate-400">Không có đơn nào trong kỳ này</p>}
      </div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const audShort = (a: string) => a === "ADULT" ? "Người lớn" : a === "CHILD_UNDER_140" ? "Trẻ <1.4m" : "Trẻ >1.4m";

function niceDay(key: string): string {
  if (key === "—") return "Không xác định";
  const d = new Date(key);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dayStart.getTime()) / 86_400_000);
  const base = d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  if (diff === 0) return `Hôm nay · ${base}`;
  if (diff === 1) return `Hôm qua · ${base}`;
  return base;
}

function fmtRange(r: { from: Date; to: Date }): string {
  return `${r.from.toLocaleDateString("vi-VN")} → ${r.to.toLocaleDateString("vi-VN")}`;
}
