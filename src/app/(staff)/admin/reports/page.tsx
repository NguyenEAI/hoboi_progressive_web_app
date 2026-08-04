"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Coins,
  Download,
  FileText,
  Lock,
  PackageOpen,
  Search,
  ShoppingBag,
  Ticket,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Waves,
} from "lucide-react";
import { CrossTable, buildMatrix } from "@/components/CrossTable";
import { ActivityLog } from "@/components/ActivityLog";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { formatVND, toDate } from "@/lib/utils";
import type { CheckIn, Order, ProductType } from "@/types";

type Mode = "DAY" | "MONTH" | "YEAR" | "CUSTOM";
type Range = { start: Date; end: Date };
type Delta = { value: number; positive: boolean };
type ChartPoint = { key: string; label: string; value: number };

const PRODUCT_LABELS: Record<ProductType, string> = {
  SWIM_COURSE: "Khóa học bơi",
  PASS: "Vé thời hạn",
  PACKAGE: "Gói lượt",
};

const PRODUCT_ICONS: Record<ProductType, React.ReactNode> = {
  SWIM_COURSE: <BookOpen className="size-4" />,
  PASS: <Ticket className="size-4" />,
  PACKAGE: <PackageOpen className="size-4" />,
};

export default function ReportsPage() {
  const { profile } = useAuthUser();
  const isOwner = profile?.role === "OWNER";
  const isStaff = profile?.role === "OWNER" || profile?.role === "RECEPTIONIST";
  const today = new Date();
  const [mode, setMode] = useState<Mode>("MONTH");
  const [day, setDay] = useState(today.toISOString().slice(0, 10));
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [year, setYear] = useState(today.getFullYear());
  const [from, setFrom] = useState(today.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [orders, setOrders] = useState<Order[]>([]);
  const [previousOrders, setPreviousOrders] = useState<Order[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [search, setSearch] = useState("");

  const range = useMemo(() => rangeFor(mode, day, month, year, from, to), [mode, day, month, year, from, to]);
  const previousRange = useMemo(() => previousRangeFor(mode, range), [mode, range]);

  useEffect(() => {
    if (!isStaff) return;
    const q = query(
      collection(db, "orders"),
      where("status", "==", "PAID"),
      where("paidAt", ">=", Timestamp.fromDate(range.start)),
      where("paidAt", "<=", Timestamp.fromDate(range.end)),
    );
    return onSnapshot(
      q,
      (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
      (e) => console.error("reports query error:", e),
    );
  }, [isStaff, range.start, range.end]);

  useEffect(() => {
    if (!isStaff) return;
    const q = query(
      collection(db, "orders"),
      where("status", "==", "PAID"),
      where("paidAt", ">=", Timestamp.fromDate(previousRange.start)),
      where("paidAt", "<=", Timestamp.fromDate(previousRange.end)),
    );
    return onSnapshot(
      q,
      (s) => setPreviousOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
      (e) => console.error("reports previous query error:", e),
    );
  }, [isStaff, previousRange.start, previousRange.end]);

  useEffect(() => {
    if (!isStaff) return;
    const q = query(
      collection(db, "checkins"),
      where("at", ">=", Timestamp.fromDate(range.start)),
      where("at", "<=", Timestamp.fromDate(range.end)),
    );
    return onSnapshot(
      q,
      (s) => setCheckins(s.docs.map((d) => ({ id: d.id, ...d.data() }) as CheckIn)),
      (e) => console.error("reports checkins query error:", e),
    );
  }, [isStaff, range.start, range.end]);

  const periodLabel = labelFor(mode, range, day, month, year, from, to);
  const previousLabel = `${previousRange.start.toLocaleDateString("vi-VN")} - ${previousRange.end.toLocaleDateString("vi-VN")}`;
  const matrix = buildMatrix(orders);
  const totalRevenue = orders.reduce((s, o) => s + (o.amountVND ?? 0), 0);
  const previousRevenue = previousOrders.reduce((s, o) => s + (o.amountVND ?? 0), 0);
  const uniqueCustomers = new Set(orders.map((o) => o.customerId).filter(Boolean)).size;
  const previousUnique = new Set(previousOrders.map((o) => o.customerId).filter(Boolean)).size;
  const aov = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const previousAov = previousOrders.length > 0 ? Math.round(previousRevenue / previousOrders.length) : 0;
  const traffic = checkins.reduce((s, c) => s + (c.groupSize ?? 1), 0);

  const chart = useMemo(() => buildRevenueChart(orders, mode, range), [orders, mode, range]);
  const serviceStats = useMemo(() => buildServiceStats(orders), [orders]);
  const topCustomers = useMemo(() => buildTopCustomers(orders), [orders]);
  const busiest = useMemo(() => buildBusiestTraffic(checkins), [checkins]);
  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sorted = [...orders].sort((a, b) => toDate(b.paidAt ?? b.createdAt).getTime() - toDate(a.paidAt ?? a.createdAt).getTime());
    if (!needle) return sorted;
    return sorted.filter((o) =>
      [
        o.id,
        o.customerId,
        o.beneficiaryName,
        PRODUCT_LABELS[o.productType],
        o.productSnapshot?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [orders, search]);

  // Phải đặt sau toàn bộ hook ở trên: khi hồ sơ tải xong và là lễ tân,
  // React vẫn nhận đúng số hook như lúc trạng thái đang tải.
  if (profile && !isStaff) return <OwnerOnlyState />;

  function exportCsv() {
    const rows = [
      ["Mã đơn", "Ngày thanh toán", "Khách hàng", "Người thụ hưởng", "Loại", "Sản phẩm", "Số tiền (VND)"],
      ...filteredOrders.map((o) => [
        o.id,
        toDate(o.paidAt ?? o.createdAt).toLocaleString("vi-VN"),
        o.customerId,
        o.beneficiaryName,
        PRODUCT_LABELS[o.productType] ?? o.productType,
        o.productSnapshot?.name ?? "",
        String(o.amountVND ?? 0),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-${periodLabel.replace(/\s/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Báo cáo Owner</h1>
            <span className="chip-live">Realtime</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {periodLabel} · so sánh với kỳ trước: {previousLabel}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={exportCsv}
            disabled={!filteredOrders.length}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-sm hover:bg-brand-50 disabled:opacity-50"
          >
            <Download className="size-4" />
            Xuất CSV
          </button>
        )}
      </header>

      <PeriodSelector
        mode={mode}
        setMode={setMode}
        day={day}
        setDay={setDay}
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ReportMetric
          icon={<Coins className="size-5" />}
          label="Doanh thu"
          value={isOwner ? formatVND(totalRevenue) : "Chỉ Owner"}
          delta={isOwner ? delta(totalRevenue, previousRevenue) : undefined}
          primary
        />
        <ReportMetric
          icon={<ShoppingBag className="size-5" />}
          label="Số đơn"
          value={orders.length}
          delta={delta(orders.length, previousOrders.length)}
        />
        <ReportMetric
          icon={<Users className="size-5" />}
          label="Khách unique"
          value={uniqueCustomers}
          delta={delta(uniqueCustomers, previousUnique)}
        />
        <ReportMetric
          icon={<TrendingUp className="size-5" />}
          label="Trung bình/đơn"
          value={isOwner && aov > 0 ? formatVND(aov) : "—"}
          delta={isOwner ? delta(aov, previousAov) : undefined}
        />
        <ReportMetric
          icon={<Waves className="size-5" />}
          label="Lưu lượng"
          value={`${traffic} lượt`}
          helper={busiest.count > 0 ? `Cao điểm ${busiest.label}: ${busiest.count}` : "Chưa có check-in"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title={mode === "YEAR" ? "Xu hướng doanh thu theo tháng" : "Xu hướng doanh thu theo ngày"}
          subtitle="Mỗi cột là doanh thu PAID trong kỳ đang chọn."
        >
          {orders.length > 0 ? (
            isOwner ? <RevenueChart data={chart} /> : (
              <EmptyPanel
                icon={<Lock className="size-5" />}
                title="Doanh thu chỉ dành cho Owner"
                description="Lễ tân vẫn dùng bộ lọc kỳ để xem lưu lượng, số đơn và hoạt động vận hành."
              />
            )
          ) : (
            <EmptyPanel
              icon={<BarChart3 className="size-5" />}
              title="Chưa có doanh thu trong kỳ"
              description="Hãy đổi kỳ lọc hoặc xác nhận thanh toán đơn để biểu đồ có dữ liệu."
            />
          )}
        </Panel>

        <Panel title="Cơ cấu dịch vụ" subtitle="Tỷ trọng theo doanh thu và số đơn.">
          <div className="space-y-3">
            {serviceStats.map((s) => (
              <ServiceCard key={s.type} stat={s} total={totalRevenue} showAmount={isOwner} />
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Loại dịch vụ × Đối tượng" subtitle={isOwner ? "Khóa học dùng giá phẳng nên không chia đối tượng." : "Lễ tân xem số lượng vận hành; doanh thu chỉ Owner xem."}>
          {isOwner ? <CrossTable matrix={matrix} /> : (
            <EmptyPanel
              icon={<Lock className="size-5" />}
              title="Bảng doanh thu đã ẩn"
              description="Bộ lọc vẫn áp dụng cho giao dịch, lưu lượng và activity log bên dưới."
            />
          )}
        </Panel>

        <Panel title="Top khách hàng" subtitle="Xếp theo doanh thu trong kỳ.">
          {topCustomers.length > 0 ? (
            <ol className="space-y-2">
              {topCustomers.map((customer, index) => (
                <TopCustomerRow key={customer.id} customer={customer} index={index} showAmount={isOwner} />
              ))}
            </ol>
          ) : (
            <EmptyPanel
              icon={<Trophy className="size-5" />}
              title="Chưa có khách trong kỳ"
              description="Top khách sẽ xuất hiện khi có đơn PAID."
            />
          )}
        </Panel>
      </section>

      <Panel
        title="Danh sách giao dịch"
        subtitle={`${filteredOrders.length}/${orders.length} đơn trong kỳ đang chọn.`}
        action={
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input h-11 pl-9"
              placeholder="Tìm mã đơn, khách, dịch vụ..."
            />
          </div>
        }
      >
        {filteredOrders.length > 0 ? (
          <TransactionTable orders={filteredOrders.slice(0, 50)} showAmount={isOwner} />
        ) : (
          <EmptyPanel
            icon={<FileText className="size-5" />}
            title={orders.length > 0 ? "Không khớp bộ lọc tìm kiếm" : "Chưa có giao dịch"}
            description={orders.length > 0 ? "Hãy thử tên khách, mã đơn hoặc loại dịch vụ khác." : "Các đơn PAID trong kỳ sẽ hiển thị tại đây và có thể xuất CSV."}
          />
        )}
      </Panel>

      <ActivityLog title="Activity log vận hành" max={20} />
    </div>
  );
}

function PeriodSelector({
  mode,
  setMode,
  day,
  setDay,
  month,
  setMonth,
  year,
  setYear,
  from,
  setFrom,
  to,
  setTo,
}: {
  mode: Mode;
  setMode: (mode: Mode) => void;
  day: string;
  setDay: (day: string) => void;
  month: string;
  setMonth: (month: string) => void;
  year: number;
  setYear: (year: number) => void;
  from: string;
  setFrom: (from: string) => void;
  to: string;
  setTo: (to: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-slate-700">
        <CalendarDays className="size-4 text-brand-700" />
        Chọn kỳ báo cáo
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {(["DAY", "MONTH", "YEAR", "CUSTOM"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                mode === m ? "bg-slate-950 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m === "DAY" ? "Ngày" : m === "MONTH" ? "Tháng" : m === "YEAR" ? "Năm" : "Tùy chỉnh"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {mode === "DAY" && (
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input h-11 w-auto" />
          )}
          {mode === "MONTH" && (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input h-11 w-auto" />
          )}
          {mode === "YEAR" && (
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input h-11 w-auto">
              {Array.from({ length: 7 }).map((_, i) => {
                const y = currentYear - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          )}
          {mode === "CUSTOM" && (
            <>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Từ</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input h-11 w-auto" />
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Đến</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input h-11 w-auto" />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ReportMetric({
  icon,
  label,
  value,
  delta: change,
  helper,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  delta?: Delta;
  helper?: string;
  primary?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${primary ? "border-emerald-700 bg-slate-950 text-white" : "border-slate-100 bg-white text-slate-900"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex size-10 items-center justify-center rounded-xl ${primary ? "bg-emerald-400/15 text-emerald-200" : "bg-brand-50 text-brand-700"}`}>
          {icon}
        </div>
        {change && <DeltaBadge delta={change} />}
      </div>
      <div className={`mt-4 text-[11px] font-black uppercase tracking-[0.16em] ${primary ? "text-emerald-100" : "text-slate-500"}`}>{label}</div>
      <div className="mt-1 text-2xl font-black tracking-tight tab-nums">{value}</div>
      {helper && <div className={`mt-1 text-xs ${primary ? "text-slate-300" : "text-slate-500"}`}>{helper}</div>}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RevenueChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="overflow-x-auto">
      <div className="flex h-64 flex-col gap-2" style={{ minWidth: Math.max(data.length * 38, 320) }}>
        <div className="flex flex-1 items-end gap-2">
          {data.map((point) => (
            <div key={point.key} className="flex h-full flex-1 items-end" title={`${point.label}: ${formatVND(point.value)}`}>
              <div className="flex h-full w-full items-end rounded-t bg-slate-50">
                <div
                  className={`w-full rounded-t transition-all ${point.value > 0 ? "bg-gradient-to-t from-emerald-700 to-teal-400" : "bg-slate-200"}`}
                  style={{ height: `${Math.max(3, (point.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-slate-100 pt-2">
          {data.map((point) => (
            <div key={point.key} className="flex-1 truncate text-center text-[10px] font-semibold text-slate-500">
              {point.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({
  stat,
  total,
  showAmount,
}: {
  stat: { type: ProductType; revenue: number; count: number };
  total: number;
  showAmount: boolean;
}) {
  const pct = total > 0 ? Math.round((stat.revenue / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm">
            {PRODUCT_ICONS[stat.type]}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">{PRODUCT_LABELS[stat.type]}</div>
            <div className="text-xs text-slate-500">{stat.count} đơn · {pct}%</div>
          </div>
        </div>
        <div className="text-right text-sm font-black text-slate-900 tab-nums">{showAmount ? formatVND(stat.revenue) : `${stat.count} đơn`}</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TopCustomerRow({
  customer,
  index,
  showAmount,
}: {
  customer: { id: string; name: string; revenue: number; count: number };
  index: number;
  showAmount: boolean;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-amber-200 text-amber-900" : index === 1 ? "bg-slate-200 text-slate-700" : index === 2 ? "bg-orange-200 text-orange-900" : "bg-white text-slate-500"}`}>
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-slate-800">{customer.name}</div>
        <div className="text-xs text-slate-500">{customer.count} đơn</div>
      </div>
      <div className="text-right text-sm font-black text-brand-700 tab-nums">{showAmount ? formatVND(customer.revenue) : `${customer.count} đơn`}</div>
    </li>
  );
}

function TransactionTable({ orders, showAmount }: { orders: Order[]; showAmount: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="rounded-l-xl p-3">Thời gian</th>
            <th className="p-3">Khách / người hưởng</th>
            <th className="p-3">Dịch vụ</th>
            <th className="p-3">Mã đơn</th>
            {showAmount && <th className="rounded-r-xl p-3 text-right">Số tiền</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-slate-50/70">
              <td className="p-3 text-xs text-slate-500 tab-nums">{toDate(order.paidAt ?? order.createdAt).toLocaleString("vi-VN")}</td>
              <td className="p-3">
                <div className="font-bold text-slate-800">{order.beneficiaryName || "Khách"}</div>
                <div className="text-xs text-slate-500">{order.customerId}</div>
              </td>
              <td className="p-3">
                <div className="font-semibold text-slate-700">{PRODUCT_LABELS[order.productType]}</div>
                <div className="text-xs text-slate-500">{order.productSnapshot?.name ?? "—"}</div>
              </td>
              <td className="p-3 text-xs text-slate-500">{order.id}</td>
              {showAmount && <td className="p-3 text-right font-black text-brand-700 tab-nums">{formatVND(order.amountVND ?? 0)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length >= 50 && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">
          Đang hiển thị 50 giao dịch mới nhất. File CSV vẫn xuất theo bộ lọc tìm kiếm hiện tại.
        </div>
      )}
    </div>
  );
}

function OwnerOnlyState() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <Lock className="size-5 flex-shrink-0 text-amber-600" />
        <div>
          <div className="font-semibold text-amber-900">Chỉ Owner được xem báo cáo tài chính</div>
          <p className="mt-1 text-sm text-amber-800">
            Quyền lễ tân không bao gồm doanh thu tổng theo INV-9. Hãy dùng màn đơn hàng/check-in cho nghiệp vụ vận hành.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">{icon}</div>
      <div className="mt-3 text-sm font-bold text-slate-800">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function DeltaBadge({ delta: change }: { delta?: Delta }) {
  if (!change) return <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Không đổi</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${change.positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {change.positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {change.value}%
    </span>
  );
}

function buildServiceStats(orders: Order[]) {
  const stats: Record<ProductType, { type: ProductType; revenue: number; count: number }> = {
    SWIM_COURSE: { type: "SWIM_COURSE", revenue: 0, count: 0 },
    PASS: { type: "PASS", revenue: 0, count: 0 },
    PACKAGE: { type: "PACKAGE", revenue: 0, count: 0 },
  };
  for (const order of orders) {
    stats[order.productType].revenue += order.amountVND ?? 0;
    stats[order.productType].count += 1;
  }
  return [stats.SWIM_COURSE, stats.PASS, stats.PACKAGE];
}

function buildTopCustomers(orders: Order[]) {
  const map = new Map<string, { name: string; revenue: number; count: number }>();
  for (const order of orders) {
    const id = order.customerId || "unknown";
    const current = map.get(id) ?? { name: order.beneficiaryName || "Khách", revenue: 0, count: 0 };
    current.revenue += order.amountVND ?? 0;
    current.count += 1;
    if (!current.name || current.name === "Khách") current.name = order.beneficiaryName || "Khách";
    map.set(id, current);
  }
  return [...map.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
}

function buildBusiestTraffic(checkins: CheckIn[]) {
  const byHour = new Map<number, number>();
  for (const checkin of checkins) {
    const hour = toDate(checkin.at).getHours();
    if (hour >= 0 && hour < 24) byHour.set(hour, (byHour.get(hour) ?? 0) + (checkin.groupSize ?? 1));
  }
  const best = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? { label: `${best[0]}h`, count: best[1] } : { label: "—", count: 0 };
}

function buildRevenueChart(orders: Order[], mode: Mode, range: Range): ChartPoint[] {
  if (mode === "YEAR") {
    const months = Array.from({ length: 12 }, (_, index) => ({
      key: String(index),
      label: `T${index + 1}`,
      value: 0,
    }));
    for (const order of orders) {
      const d = toDate(order.paidAt ?? order.createdAt);
      if (!isNaN(d.getTime())) months[d.getMonth()].value += order.amountVND ?? 0;
    }
    return months;
  }

  const days = daysBetween(range.start, range.end);
  const shouldFillDays = days <= 45;
  const map = new Map<string, ChartPoint>();
  if (shouldFillDays) {
    for (let i = 0; i < days; i++) {
      const d = addDays(range.start, i);
      const key = dateKey(d);
      map.set(key, { key, label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, value: 0 });
    }
  }
  for (const order of orders) {
    const d = toDate(order.paidAt ?? order.createdAt);
    if (isNaN(d.getTime())) continue;
    const key = dateKey(d);
    const current = map.get(key) ?? { key, label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, value: 0 };
    current.value += order.amountVND ?? 0;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function rangeFor(mode: Mode, day: string, month: string, year: number, from: string, to: string): Range {
  if (mode === "DAY") {
    const d = parseLocalDate(day);
    return { start: startOfDay(d), end: endOfDay(d) };
  }
  if (mode === "MONTH") {
    const [y, m] = month.split("-").map(Number);
    return { start: new Date(y, m - 1, 1), end: endOfDay(new Date(y, m, 0)) };
  }
  if (mode === "YEAR") {
    return { start: new Date(year, 0, 1), end: endOfDay(new Date(year, 11, 31)) };
  }
  const start = startOfDay(parseLocalDate(from));
  const end = endOfDay(parseLocalDate(to));
  return start.getTime() <= end.getTime() ? { start, end } : { start: startOfDay(end), end: endOfDay(start) };
}

function previousRangeFor(mode: Mode, range: Range): Range {
  if (mode === "DAY") {
    const start = addDays(range.start, -1);
    return { start: startOfDay(start), end: endOfDay(start) };
  }
  if (mode === "MONTH") {
    return {
      start: new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1),
      end: endOfDay(new Date(range.start.getFullYear(), range.start.getMonth(), 0)),
    };
  }
  if (mode === "YEAR") {
    return {
      start: new Date(range.start.getFullYear() - 1, 0, 1),
      end: endOfDay(new Date(range.start.getFullYear() - 1, 11, 31)),
    };
  }
  const duration = range.end.getTime() - range.start.getTime();
  const end = new Date(range.start.getTime() - 1);
  const start = new Date(end.getTime() - duration);
  return { start: startOfDay(start), end: endOfDay(end) };
}

function labelFor(mode: Mode, range: Range, day: string, month: string, year: number, from: string, to: string) {
  if (mode === "DAY") return `Ngày ${parseLocalDate(day).toLocaleDateString("vi-VN")}`;
  if (mode === "MONTH") {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  }
  if (mode === "YEAR") return `Năm ${year}`;
  return `Từ ${range.start.toLocaleDateString("vi-VN")} đến ${range.end.toLocaleDateString("vi-VN")}`;
}

function delta(now: number, prev: number): Delta | undefined {
  if (prev === 0 && now === 0) return undefined;
  if (prev === 0) return { value: 100, positive: true };
  const pct = Math.round(((now - prev) / prev) * 100);
  return { value: Math.abs(pct), positive: pct >= 0 };
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000) + 1);
}

const pad = (n: number) => String(n).padStart(2, "0");
