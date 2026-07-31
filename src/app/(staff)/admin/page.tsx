"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  PackageOpen,
  ShieldOff,
  ShoppingBag,
  Ticket,
  TrendingDown,
  TrendingUp,
  Users,
  Waves,
} from "lucide-react";
import { CheckinQueue } from "@/components/CheckinQueue";
import { CrossTable, buildMatrix } from "@/components/CrossTable";
import { POOL_INFO } from "@/lib/constants";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { formatVND, toDate } from "@/lib/utils";
import type { CheckIn, Order, ProductType } from "@/types";

type Delta = { value: number; positive: boolean };
type ServiceStat = { type: ProductType; label: string; revenue: number; count: number; tone: string };

const PRODUCT_LABELS: Record<ProductType, string> = {
  SWIM_COURSE: "Khóa học bơi",
  PASS: "Vé thời hạn",
  PACKAGE: "Gói lượt",
};

export default function AdminDashboardPage() {
  const { profile } = useAuthUser();
  const isOwner = profile?.role === "OWNER";

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
  const [pendingRequests, setPendingRequests] = useState(0);
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
        query(collection(db, "checkinRequests"), where("status", "==", "PENDING")),
        (s) => setPendingRequests(s.size),
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
        (s) => setPaidToday(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
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
        (s) => setPaidYesterday(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
      ),
    );
    subs.push(
      onSnapshot(
        query(
          collection(db, "checkins"),
          where("at", ">=", Timestamp.fromDate(todayStart)),
          where("at", "<=", Timestamp.fromDate(todayEnd)),
        ),
        (s) => setCheckinsToday(s.docs.map((d) => ({ id: d.id, ...d.data() }) as CheckIn)),
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
          (s) => setPaidMonth(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
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
          (s) => setPaidLastMonth(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
        ),
      );
    }
    return () => subs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  const todayRevenue = paidToday.reduce((s, o) => s + (o.amountVND ?? 0), 0);
  const yesterdayRevenue = paidYesterday.reduce((s, o) => s + (o.amountVND ?? 0), 0);
  const todayUnique = new Set(paidToday.map((o) => o.customerId).filter(Boolean)).size;
  const yesterdayUnique = new Set(paidYesterday.map((o) => o.customerId).filter(Boolean)).size;
  const todayTraffic = checkinsToday.reduce((s, c) => s + (c.groupSize ?? 1), 0);
  const todayAov = paidToday.length > 0 ? Math.round(todayRevenue / paidToday.length) : 0;
  const monthRevenue = paidMonth.reduce((s, o) => s + (o.amountVND ?? 0), 0);
  const lastMonthRevenue = paidLastMonth.reduce((s, o) => s + (o.amountVND ?? 0), 0);
  const monthUnique = new Set(paidMonth.map((o) => o.customerId).filter(Boolean)).size;
  const todayMatrix = buildMatrix(paidToday);
  const monthMatrix = buildMatrix(paidMonth);

  const checkinsByHour = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    for (const c of checkinsToday) {
      const hour = toDate(c.at).getHours();
      if (hour >= 0 && hour < 24) hours[hour].count += c.groupSize ?? 1;
    }
    return hours;
  }, [checkinsToday]);

  const peakHour = useMemo(
    () => checkinsByHour.reduce((best, cur) => (cur.count > best.count ? cur : best), { hour: 0, count: 0 }),
    [checkinsByHour],
  );

  const serviceStats = useMemo<ServiceStat[]>(() => {
    const totals: Record<ProductType, { revenue: number; count: number }> = {
      SWIM_COURSE: { revenue: 0, count: 0 },
      PASS: { revenue: 0, count: 0 },
      PACKAGE: { revenue: 0, count: 0 },
    };
    for (const o of paidMonth) {
      totals[o.productType].revenue += o.amountVND ?? 0;
      totals[o.productType].count += 1;
    }
    return [
      { type: "SWIM_COURSE", label: PRODUCT_LABELS.SWIM_COURSE, ...totals.SWIM_COURSE, tone: "bg-cyan-500" },
      { type: "PASS", label: PRODUCT_LABELS.PASS, ...totals.PASS, tone: "bg-emerald-600" },
      { type: "PACKAGE", label: PRODUCT_LABELS.PACKAGE, ...totals.PACKAGE, tone: "bg-amber-500" },
    ];
  }, [paidMonth]);

  const alerts = buildAlerts({
    pending,
    pendingRequests,
    todayRevenue,
    todayTraffic,
    peakHourCount: peakHour.count,
  });

  const recentOrders = useMemo(
    () => [...paidToday].sort((a, b) => toDate(b.paidAt ?? b.createdAt).getTime() - toDate(a.paidAt ?? a.createdAt).getTime()).slice(0, 5),
    [paidToday],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              {isOwner ? "Bảng điều hành Owner" : "Dashboard vận hành"}
            </h1>
            <span className="chip-live">Realtime</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <span className="capitalize">{today.toLocaleDateString("vi-VN", { weekday: "long" })}</span>
            {" · "}
            {today.toLocaleDateString("vi-VN")}
            {" · "}
            {POOL_INFO.address}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <QuickLink href="/admin/orders" icon={<FileText className="size-4" />} label="Đơn hàng" />
          {isOwner && <QuickLink href="/admin/reports" icon={<BarChart3 className="size-4" />} label="Báo cáo" />}
          <QuickLink href="/admin/customers" icon={<Users className="size-4" />} label="Khách hàng" />
          {isOwner && <QuickLink href="/admin/products" icon={<Ticket className="size-4" />} label="Bảng giá" />}
        </div>
      </header>

      <CheckinQueue />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {isOwner && (
          <MetricCard
            icon={<Coins className="size-5" />}
            label="Doanh thu hôm nay"
            value={formatVND(todayRevenue)}
            helper="Đã thu tiền mặt"
            delta={delta(todayRevenue, yesterdayRevenue)}
            primary
          />
        )}
        <MetricCard
          icon={<ShoppingBag className="size-5" />}
          label="Đơn đã thu"
          value={paidToday.length}
          helper="So với hôm qua"
          delta={delta(paidToday.length, paidYesterday.length)}
        />
        <MetricCard
          icon={<Users className="size-5" />}
          label="Khách mua"
          value={todayUnique}
          helper="Khách unique"
          delta={delta(todayUnique, yesterdayUnique)}
        />
        <MetricCard
          icon={<Waves className="size-5" />}
          label="Check-in"
          value={`${todayTraffic} lượt`}
          helper={peakHour.count > 0 ? `Cao điểm ${peakHour.hour}h: ${peakHour.count} lượt` : "Chưa có lượt vào hồ"}
        />
        <MetricCard
          icon={<AlertCircle className="size-5" />}
          label="Cần xử lý"
          value={pending + pendingRequests}
          helper={`${pending} đơn chờ · ${pendingRequests} QR chờ`}
          warning={pending + pendingRequests > 0}
        />
      </section>

      {isOwner ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <ExecutiveCard
            title={`Bức tranh tháng ${monthKey}`}
            action={<Link href="/admin/reports" className="text-xs font-bold text-brand-700 hover:text-brand-800">Mở báo cáo</Link>}
          >
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">Tổng tháng</div>
                <div className="mt-2 text-3xl font-black tracking-tight tab-nums">{formatVND(monthRevenue)}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span>{paidMonth.length} đơn</span>
                  <span>·</span>
                  <span>{monthUnique} khách</span>
                  <span>·</span>
                  <span>{paidMonth.length > 0 ? formatVND(Math.round(monthRevenue / paidMonth.length)) : "—"} / đơn</span>
                </div>
                <DeltaBadge className="mt-4" delta={delta(monthRevenue, lastMonthRevenue)} suffix="so với tháng trước" inverseOnNegative />
              </div>
              <ServiceMix stats={serviceStats} total={monthRevenue} />
            </div>
          </ExecutiveCard>

          <ExecutiveCard
            title="Cảnh báo vận hành"
            action={<Link href="/admin/orders" className="text-xs font-bold text-brand-700 hover:text-brand-800">Xử lý đơn</Link>}
          >
            <div className="space-y-2">
              {alerts.map((alert) => (
                <AlertRow key={alert.title} {...alert} />
              ))}
            </div>
          </ExecutiveCard>
        </section>
      ) : (
        <RestrictedFinanceNotice />
      )}

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <ExecutiveCard title="Lưu lượng theo giờ hôm nay" subtitle="Tổng hợp từ collection checkins, không dùng dữ liệu giả.">
          {todayTraffic > 0 ? (
            <HourTrafficChart data={checkinsByHour} />
          ) : (
            <EmptyPanel
              icon={<Clock className="size-5" />}
              title="Chưa có check-in hôm nay"
              description="Khi khách vào hồ, biểu đồ giờ cao điểm sẽ tự cập nhật realtime."
            />
          )}
        </ExecutiveCard>

        <ExecutiveCard title="Giao dịch mới hôm nay" subtitle="5 đơn PAID gần nhất.">
          {recentOrders.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentOrders.map((order) => (
                <RecentOrderRow key={order.id} order={order} showAmount={isOwner} />
              ))}
            </div>
          ) : (
            <EmptyPanel
              icon={<ShoppingBag className="size-5" />}
              title="Chưa có đơn đã thu"
              description="Các giao dịch đã xác nhận thanh toán sẽ hiện ở đây."
            />
          )}
        </ExecutiveCard>
      </section>

      {isOwner && (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <ExecutiveCard title="Doanh thu hôm nay theo Loại × Đối tượng">
            <CrossTable matrix={todayMatrix} />
          </ExecutiveCard>
          <ExecutiveCard title="Doanh thu tháng theo Loại × Đối tượng">
            <CrossTable matrix={monthMatrix} />
          </ExecutiveCard>
        </section>
      )}
    </div>
  );
}

function buildAlerts({
  pending,
  pendingRequests,
  todayRevenue,
  todayTraffic,
  peakHourCount,
}: {
  pending: number;
  pendingRequests: number;
  todayRevenue: number;
  todayTraffic: number;
  peakHourCount: number;
}) {
  const alerts = [];
  if (pending > 0) {
    alerts.push({
      tone: "warning" as const,
      title: `${pending} đơn chờ thanh toán`,
      description: "Cần xác nhận tiền mặt hoặc hủy đơn pending.",
      href: "/admin/orders",
      action: "Mở đơn hàng",
    });
  }
  if (pendingRequests > 0) {
    alerts.push({
      tone: "warning" as const,
      title: `${pendingRequests} yêu cầu QR vé lượt đang chờ`,
      description: "Hàng đợi check-in đang cần lễ tân xử lý.",
      href: "/admin",
      action: "Xem hàng đợi",
    });
  }
  if (todayRevenue === 0) {
    alerts.push({
      tone: "info" as const,
      title: "Chưa có doanh thu hôm nay",
      description: "Không ghi nhận đơn PAID trong ngày hiện tại.",
      href: "/admin/counter-sale",
      action: "Mở quầy bán",
    });
  }
  if (todayTraffic === 0) {
    alerts.push({
      tone: "info" as const,
      title: "Chưa có lượt vào hồ",
      description: "Biểu đồ lưu lượng sẽ hiện sau check-in đầu tiên.",
      href: "/admin/qr-gate",
      action: "Mở QR cổng",
    });
  }
  if (peakHourCount >= 20) {
    alerts.push({
      tone: "success" as const,
      title: "Lưu lượng cao trong ngày",
      description: `Giờ cao điểm đạt ${peakHourCount} lượt, nên theo dõi nhân sự trực hồ.`,
      href: "/admin/reports",
      action: "Xem báo cáo",
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      tone: "success" as const,
      title: "Vận hành ổn định",
      description: "Không có đơn hoặc yêu cầu chờ xử lý nổi bật.",
      href: "/admin/orders",
      action: "Kiểm tra đơn",
    });
  }
  return alerts;
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  delta: change,
  primary,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  helper: string;
  delta?: Delta;
  primary?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        primary
          ? "border-emerald-700 bg-slate-950 text-white"
          : warning
            ? "border-amber-200 bg-amber-50 text-slate-900"
            : "border-slate-100 bg-white text-slate-900"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={`flex size-10 items-center justify-center rounded-xl ${primary ? "bg-emerald-400/15 text-emerald-200" : warning ? "bg-amber-100 text-amber-700" : "bg-brand-50 text-brand-700"}`}>
          {icon}
        </div>
        {change && <DeltaBadge delta={change} />}
      </div>
      <div className={`mt-4 text-[11px] font-black uppercase tracking-[0.16em] ${primary ? "text-emerald-100" : warning ? "text-amber-700" : "text-slate-500"}`}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-black tracking-tight tab-nums">{value}</div>
      <div className={`mt-1 text-xs ${primary ? "text-slate-300" : warning ? "text-amber-800" : "text-slate-500"}`}>{helper}</div>
    </div>
  );
}

function ExecutiveCard({
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
      <div className="mb-4 flex items-start justify-between gap-3">
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

function ServiceMix({ stats, total }: { stats: ServiceStat[]; total: number }) {
  return (
    <div className="space-y-3">
      {stats.map((s) => {
        const pct = total > 0 ? Math.round((s.revenue / total) * 100) : 0;
        return (
          <div key={s.type} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-800">{s.label}</div>
                <div className="text-xs text-slate-500">{s.count} đơn · {pct}% doanh thu tháng</div>
              </div>
              <div className="text-right text-sm font-black text-slate-900 tab-nums">{formatVND(s.revenue)}</div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className={`h-full rounded-full ${s.tone}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HourTrafficChart({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="overflow-x-auto">
      <div className="flex h-56 min-w-[640px] flex-col gap-2">
        <div className="flex flex-1 items-end gap-1">
          {data.map((d) => (
            <div key={d.hour} className="flex h-full flex-1 items-end" title={`${d.hour}h: ${d.count} lượt`}>
              <div
                className={`w-full rounded-t ${d.count > 0 ? "bg-gradient-to-t from-emerald-700 to-teal-400" : "bg-slate-100"}`}
                style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 border-t border-slate-100 pt-2">
          {data.map((d) => (
            <div key={d.hour} className="flex-1 text-center text-[10px] font-semibold text-slate-400">
              {d.hour % 3 === 0 ? `${d.hour}h` : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecentOrderRow({ order, showAmount }: { order: Order; showAmount: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        {order.productType === "SWIM_COURSE" ? <BookOpen className="size-4" /> : order.productType === "PASS" ? <Ticket className="size-4" /> : <PackageOpen className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-slate-800">{order.beneficiaryName || "Khách"}</div>
        <div className="truncate text-xs text-slate-500">
          {PRODUCT_LABELS[order.productType]} · {toDate(order.paidAt ?? order.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      {showAmount && <div className="text-right text-sm font-black text-brand-700 tab-nums">{formatVND(order.amountVND ?? 0)}</div>}
    </div>
  );
}

function AlertRow({
  tone,
  title,
  description,
  href,
  action,
}: {
  tone: "warning" | "info" | "success";
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  const toneClass = tone === "warning" ? "bg-amber-50 text-amber-700" : tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
        {tone === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-slate-800">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{description}</div>
      </div>
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800">
        {action}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 shadow-sm hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
    >
      {icon}
      {label}
    </Link>
  );
}

function DeltaBadge({
  delta: change,
  suffix,
  className = "",
}: {
  delta?: Delta;
  suffix?: string;
  inverseOnNegative?: boolean;
  className?: string;
}) {
  if (!change) {
    return <span className={`inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 ${className}`}>Chưa có kỳ so sánh</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
        change.positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      } ${className}`}
    >
      {change.positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {change.value}% {suffix ?? ""}
    </span>
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

function RestrictedFinanceNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <ShieldOff className="size-5 flex-shrink-0 text-amber-600" />
        <div>
          <div className="font-semibold text-amber-900">Báo cáo tài chính chỉ dành cho chủ hồ bơi</div>
          <p className="mt-1 text-sm text-amber-800">
            Lễ tân vẫn xem được vận hành trong ngày, đơn pending và hàng đợi check-in. Doanh thu tổng do Owner quản lý theo INV-9.
          </p>
        </div>
      </div>
    </div>
  );
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

function delta(now: number, prev: number): Delta | undefined {
  if (prev === 0 && now === 0) return undefined;
  if (prev === 0) return { value: 100, positive: true };
  const pct = Math.round(((now - prev) / prev) * 100);
  return { value: Math.abs(pct), positive: pct >= 0 };
}
