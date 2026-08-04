"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Activity, Clock } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { formatDate, toDate } from "@/lib/utils";
import type { AuditLog, User } from "@/types";

type AuditWithDescription = AuditLog & { description?: string };

const ACTION_LABELS: Record<string, string> = {
  CUSTOMER_REGISTERED: "Khách đăng ký tài khoản",
  CREATE_CUSTOMER: "Nhân viên tạo khách hàng",
  UPDATE_CUSTOMER_NAME: "Đổi tên khách hàng",
  DELETE_CUSTOMER: "Xóa khách hàng",
  RESET_CUSTOMER_PASSWORD: "Đặt lại mật khẩu khách",
  CUSTOMER_PASSWORD_RESET_BY_OTP: "Khách tự đặt lại mật khẩu",
  ORDER_CREATED: "Đăng ký dịch vụ mới",
  SERVICE_ACTIVATED: "Kích hoạt dịch vụ",
  COUNTER_SALE: "Bán tại quầy",
  QR_CHECKIN_ACCEPTED: "Check-in QR",
  STAFF_CHECKIN_ON_BEHALF: "Lễ tân điểm danh hộ",
  CANCEL_ORDER: "Hủy đơn",
  REFUND_ORDER: "Hoàn tiền",
  EXTEND_SERVICE: "Gia hạn dịch vụ",
  OWNER_UPDATE_CUSTOMER_PROFILE: "Owner sửa hồ sơ khách",
  OWNER_UPDATE_CUSTOMER_SERVICE: "Owner sửa dịch vụ khách",
  SET_USER_ROLE: "Phân quyền nhân sự",
  REVOKE_ROLE: "Gỡ quyền nhân sự",
  SYNC_AUTH_USERS: "Đồng bộ Auth",
};

export function ActivityLog({ title = "Hoạt động realtime", max = 12 }: { title?: string; max?: number }) {
  const [logs, setLogs] = useState<AuditWithDescription[]>([]);
  const [users, setUsers] = useState<Record<string, Pick<User, "fullName" | "phone" | "role">>>({});
  const [error, setError] = useState<string>();

  useEffect(() => {
    const q = query(collection(db, "auditLogs"), orderBy("at", "desc"), limit(max));
    return onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditWithDescription));
        setError(undefined);
      },
      (e) => setError(e.message),
    );
  }, [max]);

  useEffect(() => {
    const ids = [...new Set(logs.flatMap((log) => [log.actorId, log.targetType === "user" ? log.targetId : ""]).filter(Boolean))];
    const missing = ids.filter((id) => !users[id]);
    if (!missing.length) return;
    const unsubscribers = missing.slice(0, 20).map((id) =>
      onSnapshot(doc(db, "users", id), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as User;
        setUsers((current) => ({ ...current, [id]: { fullName: data.fullName, phone: data.phone, role: data.role } }));
      }),
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [logs, users]);

  const rows = useMemo(() => logs.map((log) => ({
    ...log,
    actorName: displayUser(users[log.actorId], log.actorId),
    targetName: log.targetType === "user" ? displayUser(users[log.targetId], log.targetId) : `${log.targetType}/${shortId(log.targetId)}`,
    description: log.description || describe(log),
  })), [logs, users]);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-slate-700">
            <Activity className="size-4 text-brand-700" />
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">Đăng ký, dịch vụ, check-in và thao tác nhân viên.</p>
        </div>
        <span className="chip-live">Live</span>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          Chưa đọc được activity log: {error}
        </div>
      ) : rows.length ? (
        <div className="space-y-2">
          {rows.map((log) => (
            <article key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1 text-sm font-bold text-slate-900">{log.description}</div>
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <Clock className="size-3.5" />
                  {formatDateTime(log.at)}
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Actor: <b>{log.actorName}</b> · Target: <b>{log.targetName}</b>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">
          Chưa có hoạt động nào trong log.
        </div>
      )}
    </section>
  );
}

function describe(log: AuditWithDescription) {
  if (ACTION_LABELS[log.action]) return ACTION_LABELS[log.action];
  return log.action.replace(/_/g, " ").toLowerCase();
}

function displayUser(user: Pick<User, "fullName" | "phone" | "role"> | undefined, fallback: string) {
  if (!user) return shortId(fallback);
  return user.fullName || displayPhone(user.phone) || shortId(fallback);
}

function displayPhone(phone?: string) {
  if (!phone) return "";
  return phone.startsWith("+84") ? `0${phone.slice(3)}` : phone;
}

function shortId(value?: string) {
  return value ? value.slice(0, 10) : "—";
}

function formatDateTime(value: unknown) {
  const d = toDate(value);
  if (Number.isFinite(d.getTime())) {
    return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  return formatDate(value);
}
