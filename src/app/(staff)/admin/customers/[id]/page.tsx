"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  Baby,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileText,
  GraduationCap,
  History,
  KeyRound,
  Phone,
  ReceiptText,
  RefreshCw,
  Save,
  ShieldCheck,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase/client";
import { ownerUpdateCustomerProfile, ownerUpdateCustomerService, resetCustomerPasswordToDefault } from "@/lib/callable";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useToast } from "@/components/Toast";
import type {
  Attendance,
  AuditLog,
  CheckIn,
  Child,
  Enrollment,
  Membership,
  Order,
  Payment,
  TicketPackage,
  User,
} from "@/types";
import { formatDate, formatVND, toDate } from "@/lib/utils";
import { getPackageExpiryDate } from "@/lib/packageExpiry";

type ServiceKind = "MEMBERSHIP" | "PACKAGE" | "COURSE";
type ServiceRow =
  | { kind: "MEMBERSHIP"; id: string; data: Membership }
  | { kind: "PACKAGE"; id: string; data: TicketPackage }
  | { kind: "COURSE"; id: string; data: Enrollment; attendances: Attendance[] };

type Customer360 = {
  customer: User;
  children: Child[];
  memberships: Membership[];
  packages: TicketPackage[];
  enrollments: { data: Enrollment; attendances: Attendance[] }[];
  orders: Order[];
  payments: Payment[];
  checkins: CheckIn[];
  audits: AuditLog[];
};

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PAID: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  PENDING: "bg-amber-100 text-amber-700",
  PENDING_PAYMENT: "bg-amber-100 text-amber-700",
  EXPIRED: "bg-slate-100 text-slate-600",
  DEPLETED: "bg-slate-100 text-slate-600",
  SUSPENDED: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
};

export default function Customer360Page() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { profile, loading: authLoading } = useAuthUser();
  const customerId = params?.id;
  const isOwner = profile?.role === "OWNER";
  const [data, setData] = useState<Customer360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [serviceEdit, setServiceEdit] = useState<ServiceRow | null>(null);

  const load = useCallback(async () => {
    if (!customerId || !isOwner) return;
    setLoading(true);
    setError(undefined);
    try {
      const customerSnap = await getDoc(doc(db, "users", customerId));
      if (!customerSnap.exists()) throw new Error("Không tìm thấy khách hàng");
      const customer = { id: customerSnap.id, ...customerSnap.data() } as User;

      const [childrenSnap, membershipsSnap, packagesSnap, selfCourseSnap, childCourseSnap, ordersSnap, checkinsSnap] =
        await Promise.all([
          getDocs(collection(db, `users/${customerId}/children`)),
          getDocs(query(collection(db, "memberships"), where("userId", "==", customerId))),
          getDocs(query(collection(db, "ticketPackages"), where("userId", "==", customerId))),
          getDocs(query(collection(db, "enrollments"), where("studentId", "==", customerId))),
          getDocs(query(collection(db, "enrollments"), where("parentId", "==", customerId))),
          getDocs(query(collection(db, "orders"), where("customerId", "==", customerId), limit(500))),
          getDocs(query(collection(db, "checkins"), where("userId", "==", customerId), limit(500))),
        ]);

      const children = mapDocs<Child>(childrenSnap.docs);
      const memberships = mapDocs<Membership>(membershipsSnap.docs).sort((a, b) => timeMs(b.createdAt) - timeMs(a.createdAt));
      const packages = mapDocs<TicketPackage>(packagesSnap.docs).sort((a, b) => timeMs(b.createdAt) - timeMs(a.createdAt));
      const courseMap = new Map<string, Enrollment>();
      [...selfCourseSnap.docs, ...childCourseSnap.docs].forEach((d) => courseMap.set(d.id, { id: d.id, ...d.data() } as Enrollment));
      const enrollmentsRaw = [...courseMap.values()].sort((a, b) => timeMs(b.createdAt) - timeMs(a.createdAt));
      const enrollments = await Promise.all(
        enrollmentsRaw.map(async (e) => {
          const attSnap = await getDocs(collection(db, `enrollments/${e.id}/attendances`));
          const attendances = mapDocs<Attendance>(attSnap.docs).sort((a, b) => timeMs(b.date || b.at) - timeMs(a.date || a.at));
          return { data: e, attendances };
        }),
      );
      const orders = mapDocs<Order>(ordersSnap.docs).sort((a, b) => timeMs(b.createdAt) - timeMs(a.createdAt));
      const checkins = mapDocs<CheckIn>(checkinsSnap.docs).sort((a, b) => timeMs(b.at) - timeMs(a.at));
      const payments = await loadPayments(orders.map((o) => o.id));
      const serviceIds = [
        customerId,
        ...memberships.map((s) => s.id),
        ...packages.map((s) => s.id),
        ...enrollments.map((s) => s.data.id),
      ];
      const audits = await loadAudits(serviceIds);

      setData({ customer, children, memberships, packages, enrollments, orders, payments, checkins, audits });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [customerId, isOwner]);

  useEffect(() => {
    if (authLoading) return;
    if (!isOwner) {
      router.replace("/admin/customers");
      return;
    }
    load();
  }, [authLoading, isOwner, load, router]);

  const services = useMemo<ServiceRow[]>(() => {
    if (!data) return [];
    return [
      ...data.memberships.map((s) => ({ kind: "MEMBERSHIP" as const, id: s.id, data: s })),
      ...data.packages.map((s) => ({ kind: "PACKAGE" as const, id: s.id, data: s })),
      ...data.enrollments.map((s) => ({ kind: "COURSE" as const, id: s.data.id, data: s.data, attendances: s.attendances })),
    ].sort((a, b) => timeMs((b.data as { createdAt?: unknown }).createdAt) - timeMs((a.data as { createdAt?: unknown }).createdAt));
  }, [data]);

  const paidTotal = useMemo(() => data?.orders.filter((o) => o.status === "PAID").reduce((sum, o) => sum + (o.amountVND ?? 0), 0) ?? 0, [data]);
  const activeServices = services.filter((s) => s.data.status === "ACTIVE").length;

  async function afterSaved(message: string) {
    toast.show(message, "success");
    setProfileOpen(false);
    setServiceEdit(null);
    await load();
  }

  async function resetPassword() {
    if (!data) return;
    if (!confirm(`Đặt lại mật khẩu của ${data.customer.fullName || displayPhone(data.customer.phone)} về 123456?`)) return;
    try {
      await resetCustomerPasswordToDefault({ uid: data.customer.id });
      toast.show("Đã đặt lại mật khẩu về 123456.", "success");
      await load();
    } catch (e) {
      toast.show("Đặt lại mật khẩu thất bại: " + (e as Error).message, "error");
    }
  }

  if (authLoading || loading) {
    return <LoadingView />;
  }
  if (!isOwner) return null;
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error ?? "Không tải được hồ sơ khách hàng."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-brand-600">
            <ShieldCheck className="size-4" />
            Owner Customer 360
          </div>
          <h1 className="text-2xl font-bold text-brand-900">
            {data.customer.fullName || "(chưa đặt tên)"}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Phone className="size-4" />
            {displayPhone(data.customer.phone)}
            <span>·</span>
            {data.customer.role === "PARENT" ? "Phụ huynh" : "Khách hàng"}
            <span>·</span>
            tạo {formatDate(data.customer.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="size-4" /> Tải lại
          </button>
          <button
            onClick={() => setProfileOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Edit3 className="size-4" /> Sửa hồ sơ
          </button>
          <button
            onClick={resetPassword}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
          >
            <KeyRound className="size-4" /> Reset mật khẩu 123456
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={<Ticket className="size-5" />} label="Dịch vụ active" value={String(activeServices)} tone="emerald" />
        <Metric icon={<ReceiptText className="size-5" />} label="Đơn hàng" value={String(data.orders.length)} tone="blue" />
        <Metric icon={<CreditCard className="size-5" />} label="Đã thu" value={formatVND(paidTotal)} tone="amber" />
        <Metric icon={<Activity className="size-5" />} label="Check-in" value={String(data.checkins.length)} tone="slate" />
      </div>

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Panel title="Hồ sơ liên hệ" icon={<UserRound className="size-4" />}>
            <InfoGrid
              rows={[
                ["UID", data.customer.id],
                ["SĐT", displayPhone(data.customer.phone)],
                ["Email", data.customer.email || "—"],
                ["Địa chỉ", data.customer.address || "—"],
                ["Ngày sinh", formatDate(data.customer.dob)],
                ["Chiều cao", data.customer.heightCm ? `${data.customer.heightCm} cm` : "—"],
                ["Nhóm giá", audienceLabel(data.customer.audience)],
                ["FCM token", `${data.customer.fcmTokens?.length ?? 0}`],
                ["Trạng thái", data.customer.disabled ? "Đã khóa" : "Hoạt động"],
              ]}
            />
          </Panel>

          <Panel title={`Trẻ em (${data.children.length})`} icon={<Baby className="size-4" />}>
            {data.children.length ? (
              <div className="space-y-2">
                {data.children.map((child) => (
                  <div key={child.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="font-semibold text-slate-900">{child.fullName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDate(child.dob)} · {child.heightCm ? `${child.heightCm} cm` : "chưa có chiều cao"} · {audienceLabel(child.audience)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyText>Khách chưa có hồ sơ trẻ em.</EmptyText>
            )}
          </Panel>
        </div>

        <Panel title={`Dịch vụ (${services.length})`} icon={<Ticket className="size-4" />}>
          {services.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {services.map((service) => (
                <ServiceCard key={`${service.kind}-${service.id}`} service={service} onEdit={() => setServiceEdit(service)} />
              ))}
            </div>
          ) : (
            <EmptyText>Chưa có vé, gói lượt hoặc khóa học.</EmptyText>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title={`Đơn hàng & thanh toán (${data.orders.length})`} icon={<FileText className="size-4" />}>
          <OrdersTable orders={data.orders} payments={data.payments} />
        </Panel>
        <Panel title={`Check-in (${data.checkins.length})`} icon={<Activity className="size-4" />}>
          <CheckinsTable checkins={data.checkins} />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Lịch sử điểm danh khóa học" icon={<GraduationCap className="size-4" />}>
          <AttendanceHistory enrollments={data.enrollments} />
        </Panel>
        <Panel title="Audit gần đây" icon={<History className="size-4" />}>
          <AuditList audits={data.audits} />
        </Panel>
      </section>

      {profileOpen && (
        <ProfileModal
          customer={data.customer}
          onClose={() => setProfileOpen(false)}
          onSave={async (patch, reason) => {
            await ownerUpdateCustomerProfile({ uid: data.customer.id, patch, reason });
            await afterSaved("Đã cập nhật hồ sơ và ghi audit.");
          }}
        />
      )}

      {serviceEdit && (
        <ServiceModal
          customerId={data.customer.id}
          service={serviceEdit}
          onClose={() => setServiceEdit(null)}
          onSave={async (payload) => {
            await ownerUpdateCustomerService(payload);
            await afterSaved("Đã cập nhật dịch vụ và ghi audit.");
          }}
        />
      )}
    </div>
  );
}

function ServiceCard({ service, onEdit }: { service: ServiceRow; onEdit: () => void }) {
  const data = service.data;
  const title =
    service.kind === "MEMBERSHIP"
      ? `Vé thời hạn MS${data.memberCode}`
      : service.kind === "PACKAGE"
        ? `Gói lượt MS${data.memberCode}`
        : `Khóa học MS${data.memberCode}`;
  const person =
    service.kind === "COURSE"
      ? service.data.studentName
      : (service.data as Membership | TicketPackage).holderName || "Khách";
  const detail =
    service.kind === "MEMBERSHIP"
      ? `HSD ${formatDate((data as Membership).endDate)}`
      : service.kind === "PACKAGE"
        ? `${(data as TicketPackage).remainingSessions}/${(data as TicketPackage).totalSessions} lượt · HSD ${formatDate(getPackageExpiryDate(data as TicketPackage))}`
        : `${(data as Enrollment).attendedSessions}/${(data as Enrollment).totalSessions} buổi · HLV ${(data as Enrollment).coachName || "—"}`;
  const icon = service.kind === "MEMBERSHIP" ? <CalendarDays className="size-5" /> : service.kind === "PACKAGE" ? <Ticket className="size-5" /> : <GraduationCap className="size-5" />;
  return (
    <article className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{title}</div>
            <div className="mt-1 truncate text-sm text-slate-500">{person}</div>
          </div>
        </div>
        <Status value={data.status} />
      </div>
      <div className="mt-3 text-sm text-slate-600">{detail}</div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>Order {data.orderId?.slice(0, 8) || "—"}</span>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Edit3 className="size-3.5" /> Sửa
        </button>
      </div>
    </article>
  );
}

function OrdersTable({ orders, payments }: { orders: Order[]; payments: Payment[] }) {
  if (!orders.length) return <EmptyText>Chưa có đơn hàng.</EmptyText>;
  const paymentByOrder = new Map(payments.map((p) => [p.orderId, p]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2 pr-3">Ngày</th>
            <th className="py-2 pr-3">Sản phẩm</th>
            <th className="py-2 pr-3">Người dùng</th>
            <th className="py-2 pr-3">Tiền</th>
            <th className="py-2 pr-3">Trạng thái</th>
            <th className="py-2 pr-3">Thanh toán</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const payment = paymentByOrder.get(o.id);
            return (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="py-3 pr-3 text-xs text-slate-500">{formatDate(o.createdAt)}</td>
                <td className="py-3 pr-3 font-medium">{o.productSnapshot?.name || o.productType}</td>
                <td className="py-3 pr-3">{o.beneficiaryName || "—"}</td>
                <td className="py-3 pr-3 font-semibold">{formatVND(o.amountVND ?? 0)}</td>
                <td className="py-3 pr-3"><Status value={o.status} /></td>
                <td className="py-3 pr-3 text-xs text-slate-500">
                  {payment ? `${payment.method} · ${formatDate(payment.at)}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CheckinsTable({ checkins }: { checkins: CheckIn[] }) {
  if (!checkins.length) return <EmptyText>Chưa có lịch sử check-in.</EmptyText>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2 pr-3">Thời gian</th>
            <th className="py-2 pr-3">Loại</th>
            <th className="py-2 pr-3">Số lượt</th>
            <th className="py-2 pr-3">Kết quả</th>
            <th className="py-2 pr-3">Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {checkins.slice(0, 80).map((c) => (
            <tr key={c.id} className="border-t border-slate-100">
              <td className="py-3 pr-3 text-xs text-slate-500">{formatDate(c.at)}</td>
              <td className="py-3 pr-3">{serviceKindLabel(c.kind)}</td>
              <td className="py-3 pr-3 font-semibold tabular-nums">{c.groupSize ?? 1}</td>
              <td className="py-3 pr-3"><Status value={c.result} /></td>
              <td className="py-3 pr-3 text-xs text-slate-500">{c.reason || c.correctionStatus || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceHistory({ enrollments }: { enrollments: { data: Enrollment; attendances: Attendance[] }[] }) {
  const rows = enrollments.flatMap((e) =>
    e.attendances.map((a) => ({ enrollment: e.data, attendance: a })),
  ).sort((a, b) => timeMs(b.attendance.date || b.attendance.at) - timeMs(a.attendance.date || a.attendance.at));
  if (!rows.length) return <EmptyText>Chưa có điểm danh khóa học.</EmptyText>;
  return (
    <div className="space-y-2">
      {rows.slice(0, 80).map((row, index) => (
        <div key={`${row.enrollment.id}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900">{row.enrollment.studentName}</div>
            <div className="text-xs text-slate-500">{formatDate(row.attendance.date || row.attendance.at)} · {row.attendance.source}</div>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${row.attendance.present ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            {row.attendance.present ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
            {row.attendance.present ? "Có mặt" : "Vắng"}
          </span>
        </div>
      ))}
    </div>
  );
}

function AuditList({ audits }: { audits: AuditLog[] }) {
  if (!audits.length) return <EmptyText>Chưa có audit liên quan trong phạm vi hồ sơ này.</EmptyText>;
  return (
    <div className="space-y-2">
      {audits.slice(0, 80).map((a) => (
        <div key={a.id} className="rounded-xl border border-slate-100 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-slate-900">{a.action}</div>
            <div className="text-xs text-slate-500">{formatDate(a.at)}</div>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {a.targetType}/{a.targetId?.slice(0, 10)} · actor {a.actorId?.slice(0, 10)}
          </div>
          {Boolean(a.detail?.reason) && <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">Lý do: {String(a.detail?.reason)}</div>}
        </div>
      ))}
    </div>
  );
}

function ProfileModal({
  customer,
  onClose,
  onSave,
}: {
  customer: User;
  onClose: () => void;
  onSave: (patch: Parameters<typeof ownerUpdateCustomerProfile>[0]["patch"], reason: string) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(customer.fullName ?? "");
  const [phone, setPhone] = useState(toLocalPhone(customer.phone));
  const [address, setAddress] = useState(customer.address ?? "");
  const [dob, setDob] = useState(inputDate(customer.dob));
  const [heightCm, setHeightCm] = useState(customer.heightCm ? String(customer.heightCm) : "");
  const [audience, setAudience] = useState(customer.audience ?? "");
  const [disabled, setDisabled] = useState(Boolean(customer.disabled));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = fullName.trim().length > 0 && reason.trim().length >= 3;

  async function submit() {
    setBusy(true);
    try {
      await onSave({
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        dob: dob || null,
        heightCm: heightCm ? Number(heightCm) : null,
        audience: audience || null,
        disabled,
      }, reason.trim());
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Sửa hồ sơ khách hàng" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Họ tên"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" /></Field>
        <Field label="SĐT"><input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 12))} className="input tabular-nums" /></Field>
        <Field label="Ngày sinh"><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input" /></Field>
        <Field label="Chiều cao"><input type="number" min={60} max={220} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="input" /></Field>
        <Field label="Nhóm giá">
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="input">
            <option value="">Chưa chọn</option>
            <option value="CHILD_UNDER_140">Trẻ dưới 1.4m</option>
            <option value="CHILD_OVER_140">Trẻ từ 1.4m</option>
            <option value="ADULT">Người lớn</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} className="size-4" />
          Khóa hồ sơ
        </label>
        <Field label="Địa chỉ"><input value={address} onChange={(e) => setAddress(e.target.value)} className="input" /></Field>
        <Field label="Lý do bắt buộc"><input value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="VD: sửa SĐT nhập sai" /></Field>
      </div>
      <ModalActions onClose={onClose} onSubmit={submit} busy={busy} disabled={!canSubmit} />
    </Modal>
  );
}

function ServiceModal({
  customerId,
  service,
  onClose,
  onSave,
}: {
  customerId: string;
  service: ServiceRow;
  onClose: () => void;
  onSave: (payload: Parameters<typeof ownerUpdateCustomerService>[0]) => Promise<void>;
}) {
  const data = service.data as unknown as Record<string, unknown>;
  const [status, setStatus] = useState(String(data.status ?? ""));
  const [endDate, setEndDate] = useState(inputDate(data.endDate));
  const [startDate, setStartDate] = useState(inputDate(data.startDate));
  const [expiryDate, setExpiryDate] = useState(inputDate((service.kind === "MEMBERSHIP" ? data.endDate : data.expiryDate)));
  const [totalSessions, setTotalSessions] = useState(String(data.totalSessions ?? ""));
  const [remainingSessions, setRemainingSessions] = useState(String(data.remainingSessions ?? ""));
  const [attendedSessions, setAttendedSessions] = useState(String(data.attendedSessions ?? ""));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const statuses = service.kind === "MEMBERSHIP"
    ? ["ACTIVE", "EXPIRED", "SUSPENDED"]
    : service.kind === "PACKAGE"
      ? ["ACTIVE", "DEPLETED", "EXPIRED", "SUSPENDED"]
      : ["PENDING", "ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED"];

  async function submit() {
    const patch: Record<string, unknown> = { status };
    if (service.kind === "MEMBERSHIP" && endDate) patch.endDate = endDate;
    if (service.kind === "PACKAGE") {
      if (startDate) patch.startDate = startDate;
      if (expiryDate) patch.expiryDate = expiryDate;
      patch.totalSessions = Number(totalSessions);
      patch.remainingSessions = Number(remainingSessions);
    }
    if (service.kind === "COURSE") {
      if (startDate) patch.startDate = startDate;
      if (expiryDate) patch.expiryDate = expiryDate;
      patch.totalSessions = Number(totalSessions);
      patch.attendedSessions = Number(attendedSessions);
    }
    setBusy(true);
    try {
      await onSave({ customerId, kind: service.kind, serviceId: service.id, patch, reason: reason.trim() });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Sửa ${serviceKindLabel(service.kind)}`} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Trạng thái">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        {service.kind === "MEMBERSHIP" && <Field label="Ngày hết hạn"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" /></Field>}
        {service.kind !== "MEMBERSHIP" && <Field label="Ngày kích hoạt"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" /></Field>}
        {service.kind !== "MEMBERSHIP" && <Field label="Ngày hết hạn"><input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="input" /></Field>}
        {service.kind === "PACKAGE" && <Field label="Tổng lượt"><input type="number" min={0} value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} className="input" /></Field>}
        {service.kind === "PACKAGE" && <Field label="Lượt còn lại"><input type="number" min={0} value={remainingSessions} onChange={(e) => setRemainingSessions(e.target.value)} className="input" /></Field>}
        {service.kind === "COURSE" && <Field label="Tổng buổi"><input type="number" min={0} value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} className="input" /></Field>}
        {service.kind === "COURSE" && <Field label="Buổi đã học"><input type="number" min={0} value={attendedSessions} onChange={(e) => setAttendedSessions(e.target.value)} className="input" /></Field>}
        <Field label="Lý do bắt buộc"><input value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="VD: chỉnh sai ngày hết hạn" /></Field>
      </div>
      <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
        Lịch sử đơn hàng, thanh toán, check-in và điểm danh không bị xóa khi sửa trạng thái/dữ liệu dịch vụ.
      </div>
      <ModalActions onClose={onClose} onSubmit={submit} busy={busy} disabled={reason.trim().length < 3} />
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-brand-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onClose, onSubmit, busy, disabled }: { onClose: () => void; onSubmit: () => void; busy: boolean; disabled: boolean }) {
  return (
    <div className="mt-5 flex flex-wrap justify-end gap-2">
      <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Hủy</button>
      <button onClick={onSubmit} disabled={busy || disabled} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        <Save className="size-4" /> {busy ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">{icon}{title}</h2>
      {children}
    </section>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "emerald" | "blue" | "amber" | "slate" }) {
  const color = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "blue" ? "bg-blue-50 text-blue-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex size-10 items-center justify-center rounded-xl ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[110px_1fr] gap-2">
          <dt className="text-slate-500">{label}</dt>
          <dd className="min-w-0 break-words font-medium text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<span className="mt-1 block">{children}</span></label>;
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">{children}</div>;
}

function Status({ value }: { value?: string }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[value ?? ""] ?? "bg-slate-100 text-slate-600"}`}>{value || "—"}</span>;
}

function LoadingView() {
  return (
    <div className="space-y-4">
      <div className="h-20 animate-pulse rounded-2xl bg-white" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}

async function loadPayments(orderIds: string[]) {
  if (!orderIds.length) return [];
  const chunks = chunk(orderIds, 30);
  const snaps = await Promise.all(chunks.map((ids) => getDocs(query(collection(db, "payments"), where("orderId", "in", ids)))));
  return snaps.flatMap((s) => mapDocs<Payment>(s.docs)).sort((a, b) => timeMs(b.at) - timeMs(a.at));
}

async function loadAudits(targetIds: string[]) {
  const unique = [...new Set(targetIds.filter(Boolean))];
  if (!unique.length) return [];
  const chunks = chunk(unique, 30);
  const snaps = await Promise.all(chunks.map((ids) => getDocs(query(collection(db, "auditLogs"), where("targetId", "in", ids), limit(100)))));
  return snaps.flatMap((s) => mapDocs<AuditLog>(s.docs)).sort((a, b) => timeMs(b.at) - timeMs(a.at));
}

function mapDocs<T>(docs: QueryDocumentSnapshot[]) {
  return docs.map((d) => ({ id: d.id, ...d.data() } as T & { id: string }));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function timeMs(value: unknown): number {
  const d = toDate(value);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

function displayPhone(phone?: string) {
  if (!phone) return "—";
  const local = toLocalPhone(phone);
  if (/^0\d{9}$/.test(local)) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return phone;
}

function toLocalPhone(phone?: string) {
  return phone?.startsWith("+84") ? `0${phone.slice(3)}` : (phone ?? "");
}

function inputDate(value: unknown) {
  const d = toDate(value);
  if (!Number.isFinite(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function audienceLabel(audience?: string) {
  if (audience === "CHILD_UNDER_140") return "Trẻ dưới 1.4m";
  if (audience === "CHILD_OVER_140") return "Trẻ từ 1.4m";
  if (audience === "ADULT") return "Người lớn";
  return "—";
}

function serviceKindLabel(kind?: string) {
  if (kind === "MEMBERSHIP") return "Vé thời hạn";
  if (kind === "PACKAGE") return "Vé lượt";
  if (kind === "COURSE") return "Khóa học";
  return kind || "—";
}
