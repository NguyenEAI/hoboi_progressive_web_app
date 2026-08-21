"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, where, Timestamp } from "firebase/firestore";
import { Activity, Clock, Calendar } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { formatDate, formatVND, toDate } from "@/lib/utils";
import type { AuditLog, User } from "@/types";

type AuditWithDescription = AuditLog & { description?: string; detail?: Record<string, unknown> };

const ACTION_LABELS: Record<string, string> = {
  CUSTOMER_REGISTERED: "Khách đăng ký tài khoản",
  CREATE_CUSTOMER: "Nhân viên tạo khách hàng",
  UPDATE_CUSTOMER_NAME: "Đổi tên khách hàng",
  DELETE_CUSTOMER: "Xoá khách hàng",
  RESET_CUSTOMER_PASSWORD: "Đặt lại mật khẩu khách",
  CUSTOMER_PASSWORD_RESET_BY_OTP: "Khách tự đặt lại mật khẩu",
  ORDER_CREATED: "Đăng ký dịch vụ mới",
  SERVICE_ACTIVATED: "Kích hoạt dịch vụ",
  COUNTER_SALE: "Bán tại quầy",
  QR_CHECKIN_ACCEPTED: "Khách check-in bằng QR",
  STAFF_CHECKIN_ON_BEHALF: "Lễ tân điểm danh hộ",
  CHECKIN_CANCELLED: "Huỷ toàn bộ lượt điểm danh",
  CHECKIN_PARTIALLY_REFUNDED: "Hoàn một phần lượt điểm danh",
  COURSE_ATTENDANCE_UNDONE: "Huỷ 1 buổi khoá học",
  CANCEL_ORDER: "Huỷ đơn",
  REFUND_ORDER: "Hoàn tiền đơn",
  DELETE_ORDER: "Xoá đơn",
  EXTEND_SERVICE: "Gia hạn dịch vụ",
  OWNER_UPDATE_CUSTOMER_PROFILE: "Owner sửa hồ sơ khách",
  OWNER_UPDATE_CUSTOMER_SERVICE: "Owner sửa dịch vụ khách",
  SET_USER_ROLE: "Phân quyền nhân sự",
  REVOKE_ROLE: "Gỡ quyền nhân sự",
  SYNC_AUTH_USERS: "Đồng bộ Auth",
  AUTO_CREATE_USER_FROM_AUTH: "Tự tạo hồ sơ khách từ Auth",
  DELETE_COACH: "Xoá HLV",
  SET_COACH_ACTIVE: "Đổi trạng thái HLV",
  EXPENSE_CREATED: "Ghi khoản chi",
  EXPENSE_UPDATED: "Sửa khoản chi",
  EXPENSE_DELETED: "Xoá khoản chi",
};

function todayIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function ActivityLog({ title = "Hoạt động realtime", max = 50 }: { title?: string; max?: number }) {
  const [dateIso, setDateIso] = useState<string>(todayIso());
  const [showAllDays, setShowAllDays] = useState<boolean>(false);
  const [logs, setLogs] = useState<AuditWithDescription[]>([]);
  const [users, setUsers] = useState<Record<string, Pick<User, "fullName" | "phone" | "role">>>({});
  const [error, setError] = useState<string>();

  useEffect(() => {
    setError(undefined);
    if (showAllDays) {
      const q = query(collection(db, "auditLogs"), orderBy("at", "desc"), limit(max));
      return onSnapshot(
        q,
        (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditWithDescription)),
        (e) => setError(e.message),
      );
    }
    const day = new Date(dateIso + "T00:00:00");
    const next = new Date(day); next.setDate(next.getDate() + 1);
    const q = query(
      collection(db, "auditLogs"),
      where("at", ">=", Timestamp.fromDate(day)),
      where("at", "<", Timestamp.fromDate(next)),
      orderBy("at", "desc"),
      limit(200),
    );
    return onSnapshot(
      q,
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditWithDescription)),
      (e) => setError(e.message),
    );
  }, [dateIso, showAllDays, max]);

  useEffect(() => {
    const ids = [...new Set(logs.flatMap((log) => [log.actorId, log.targetType === "user" ? log.targetId : ""]).filter(Boolean))];
    const missing = ids.filter((id) => !users[id]);
    if (!missing.length) return;
    const unsubscribers = missing.slice(0, 40).map((id) =>
      onSnapshot(doc(db, "users", id), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as User;
        setUsers((current) => ({ ...current, [id]: { fullName: data.fullName, phone: data.phone, role: data.role } }));
      }),
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [logs, users]);

  const rows = useMemo(() => logs.map((log) => {
    const actorUser = users[log.actorId];
    const actorName = displayUser(actorUser, log.actorId);
    const actorRole = roleLabel(actorUser?.role);
    const targetUser = log.targetType === "user" ? users[log.targetId] : undefined;
    const detailText = buildDetail(log, actorName, targetUser ? displayUser(targetUser, log.targetId) : undefined);
    return {
      ...log,
      actorName,
      actorRole,
      humanLine: log.description || detailText || ACTION_LABELS[log.action] || log.action.replace(/_/g, " ").toLowerCase(),
    };
  }), [logs, users]);

  const dayCount = logs.length;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-slate-700">
            <Activity className="size-4 text-brand-700" />
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {showAllDays ? `Xem ${dayCount} hoạt động gần nhất (mọi ngày).` : `Xem hoạt động ngày ${new Date(dateIso).toLocaleDateString("vi-VN")} · ${dayCount} bản ghi.`}
          </p>
        </div>
        <span className="chip-live shrink-0">Live</span>
      </div>

      {/* Bộ lọc ngày */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Calendar className="size-3.5" />
          Ngày:
        </label>
        <input
          type="date"
          value={dateIso}
          disabled={showAllDays}
          onChange={(e) => setDateIso(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400"
        />
        <div className="flex gap-1">
          {[
            { label: "Hôm nay", d: todayIso() },
            { label: "Hôm qua", d: (() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(12); return d.toISOString().slice(0, 10); })() },
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              disabled={showAllDays}
              onClick={() => setDateIso(btn.d)}
              className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${dateIso === btn.d && !showAllDays ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600"} disabled:opacity-50`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={showAllDays}
            onChange={(e) => setShowAllDays(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Xem tất cả (bỏ lọc ngày)
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          Chưa đọc được: {error}
        </div>
      ) : rows.length ? (
        <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          {rows.map((log) => (
            <article key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 text-sm font-bold text-slate-900">{log.humanLine}</div>
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 shrink-0">
                  <Clock className="size-3.5" />
                  {formatDateTime(log.at)}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {log.actorRole && <span className="mr-1 rounded-full bg-slate-200 px-1.5 py-0.5 font-bold text-slate-700">{log.actorRole}</span>}
                {log.actorName}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">
          Không có hoạt động nào trong ngày này.
        </div>
      )}
    </section>
  );
}

// Xây dòng mô tả chi tiết dựa vào action + detail
function buildDetail(log: AuditWithDescription, actorName: string, targetName?: string): string {
  const d = (log.detail ?? {}) as Record<string, any>;
  const action = log.action;

  switch (action) {
    case "QR_CHECKIN_ACCEPTED": {
      const kindLabel = kindText(d.kind);
      const grp = d.groupSize ? ` (${d.groupSize} lượt)` : "";
      return `${actorName} tự check-in ${kindLabel}${grp}`;
    }
    case "STAFF_CHECKIN_ON_BEHALF": {
      const kindLabel = kindText(d.kind);
      const grp = d.groupSize ? ` (${d.groupSize} lượt)` : "";
      const who = targetName ? ` cho ${targetName}` : "";
      return `${actorName} điểm danh hộ ${kindLabel}${who}${grp}`;
    }
    case "CHECKIN_CANCELLED":
    case "CHECKIN_PARTIALLY_REFUNDED": {
      const cnt = d.refundCount ?? 0;
      const rem = d.afterRemaining;
      return `${actorName} hoàn ${cnt} lượt · còn ${rem} · lý do: ${d.reason ?? "—"}`;
    }
    case "COUNTER_SALE": {
      const amt = d.amountVND ? ` · ${formatVND(Number(d.amountVND))}` : "";
      return `${actorName} bán ${prodText(d.productType)}${amt} cho ${d.beneficiaryName ?? "khách"}`;
    }
    case "ORDER_CREATED": {
      const amt = d.amountVND ? ` · ${formatVND(Number(d.amountVND))}` : "";
      return `${actorName} tạo đơn ${prodText(d.productType)}${amt}`;
    }
    case "SERVICE_ACTIVATED": {
      return `${actorName} kích hoạt ${prodText(d.productType)}${d.beneficiaryName ? ` cho ${d.beneficiaryName}` : ""}`;
    }
    case "EXPENSE_CREATED":
    case "EXPENSE_UPDATED":
    case "EXPENSE_DELETED": {
      const amt = d.amount ? formatVND(Number(d.amount)) : "";
      const cat = d.category ? categoryText(d.category) : "";
      const verb = action === "EXPENSE_CREATED" ? "ghi khoản chi" : action === "EXPENSE_UPDATED" ? "sửa khoản chi" : "xoá khoản chi";
      return `${actorName} ${verb} ${cat} ${amt}${d.reason ? ` · lý do: ${d.reason}` : ""}`.trim();
    }
    case "EXTEND_SERVICE": {
      const days = d.addDays ? `+${d.addDays} ngày` : "";
      const sess = d.addSessions ? `+${d.addSessions} lượt/buổi` : "";
      return `${actorName} gia hạn dịch vụ ${[days, sess].filter(Boolean).join(", ")} · lý do: ${d.reason ?? "—"}`;
    }
    case "REFUND_ORDER": {
      return `${actorName} hoàn tiền đơn · lý do: ${d.reason ?? "—"}`;
    }
    case "CANCEL_ORDER": {
      return `${actorName} huỷ đơn${d.reason ? ` · lý do: ${d.reason}` : ""}`;
    }
    case "SET_USER_ROLE": {
      return `${actorName} phân quyền ${d.phone ?? ""} → ${d.role ?? ""}`;
    }
    case "REVOKE_ROLE": {
      return `${actorName} gỡ quyền ${targetName ?? ""} (từ ${d.from ?? "—"} về khách)`;
    }
    case "DELETE_COACH": {
      return `${actorName} xoá HLV ${d.fullName ?? ""}${d.reason ? ` · lý do: ${d.reason}` : ""}`;
    }
    case "AUTO_CREATE_USER_FROM_AUTH": {
      return `${actorName} tự tạo hồ sơ khách từ Auth (${d.phone ?? ""})`;
    }
    default:
      return "";
  }
}

function kindText(kind?: string): string {
  return kind === "PACKAGE" ? "vé lượt" : kind === "MEMBERSHIP" ? "vé thời hạn" : kind === "COURSE" ? "khoá học bơi" : "dịch vụ";
}
function prodText(t?: string): string {
  return t === "PASS" ? "vé thời hạn" : t === "PACKAGE" ? "vé lượt" : t === "SWIM_COURSE" ? "khoá học bơi" : "sản phẩm";
}
function categoryText(c?: string): string {
  const m: Record<string, string> = {
    ELECTRICITY: "tiền điện", WATER: "tiền nước", CHEMICALS: "hoá chất",
    STAFF_SALARY: "lương nhân viên", COACH_SALARY: "lương HLV",
    SUPPLIES: "vật tư", MAINTENANCE: "bảo trì", CLEANING: "vệ sinh",
    MARKETING: "marketing", RENT: "thuê mặt bằng", TELECOM: "internet/ĐT",
    TAX: "thuế/phí", HOSPITALITY: "tiếp khách", OTHER: "khác",
  };
  return c ? (m[c] ?? c) : "";
}
function roleLabel(r?: string): string {
  return r === "OWNER" ? "Chủ" : r === "RECEPTIONIST" ? "Lễ tân" : r === "COACH" ? "HLV" : r === "CUSTOMER" ? "Khách" : "";
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
  return value ? value.slice(0, 6) : "—";
}
function formatDateTime(value: unknown) {
  const d = toDate(value);
  if (Number.isFinite(d.getTime())) {
    return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  return formatDate(value);
}
