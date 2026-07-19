"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, query, where, getDocs, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { staffCheckinByPhone, searchCustomerByPhone, correctPackageCheckin, extendService } from "@/lib/callable";
import type { User, Child, Membership, TicketPackage, Enrollment, CheckIn } from "@/types";
import { formatDate } from "@/lib/utils";
import { Ticket, Calendar, GraduationCap, Search } from "lucide-react";

// v2.3 (D9): điểm danh hộ mở rộng cho VÉ LƯỢT (chọn số lượt) + khóa học + vé thời hạn.
// v2.4 (E1): dùng callable searchCustomerByPhone — server normalize SĐT + 2-stage lookup
// (Firestore → Auth chẩn đoán). Hiển thị error rõ theo prefix incomplete-profile/not-found.
// Lễ tân tra SĐT → hiển thị mọi thẻ ACTIVE của khách → bấm "Điểm danh" trên thẻ tương ứng.

type Tickets = {
  memberships: Membership[];
  packages: TicketPackage[];
  enrollments: Enrollment[];
};

// v2.5: autocomplete SĐT. Load tất cả /users (rules cho staff list) + filter prefix client-side.
// Đủ cho quy mô 2-3k khách. Khi lớn hơn có thể chuyển sang callable trả top-N từ index.
type PhoneEntry = { uid: string; phone: string; local: string; fullName: string };

export default function CheckinAssistPage() {
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<User>();
  const [children, setChildren] = useState<Child[]>([]);
  const [tickets, setTickets] = useState<Tickets>({ memberships: [], packages: [], enrollments: [] });
  const [recentCheckins, setRecentCheckins] = useState<CheckIn[]>([]);
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [allPhones, setAllPhones] = useState<PhoneEntry[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestBoxRef = useRef<HTMLDivElement>(null);

  // Load danh bạ khách (chỉ CUSTOMER/PARENT) cho autocomplete
  useEffect(() => {
    const q = query(collection(db, "users"), limit(2000));
    return onSnapshot(q, (s) => {
      const list: PhoneEntry[] = [];
      s.docs.forEach((d) => {
        const u = d.data();
        const role = u.role as string | undefined;
        if (role && ["OWNER", "RECEPTIONIST", "COACH"].includes(role)) return;
        const phoneStr = (u.phone as string) ?? "";
        if (!phoneStr) return;
        const local = phoneStr.startsWith("+84") ? "0" + phoneStr.slice(3) : phoneStr;
        list.push({ uid: d.id, phone: phoneStr, local, fullName: (u.fullName as string) ?? "" });
      });
      setAllPhones(list);
    });
  }, []);

  const suggestions = useMemo(() => {
    const k = phone.trim().replace(/\D/g, "");
    if (k.length < 3) return [];
    return allPhones
      .filter((e) => e.local.includes(k) || e.phone.includes(k))
      .slice(0, 8);
  }, [phone, allPhones]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (suggestBoxRef.current && !suggestBoxRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function search() {
    setMsg(undefined);
    setError(undefined);
    setCustomer(undefined);
    setChildren([]);
    setTickets({ memberships: [], packages: [], enrollments: [] });
    setRecentCheckins([]);

    const raw = phone.trim();
    if (!raw) return;

    try {
      // v2.4 (E1) + v2.4.1 — server normalize + Auth fallback auto-create doc
      const result = await searchCustomerByPhone({ phone: raw });
      if (!result.found) {
        setError("Không tìm thấy khách với SĐT này.");
        return;
      }
      const p = {
        id: result.id,
        fullName: (result.fullName as string) ?? "",
        phone: (result.phone as string) ?? raw,
        role: (result.role as User["role"]) ?? "CUSTOMER",
        fcmTokens: (result.fcmTokens as string[]) ?? [],
        disabled: (result.disabled as boolean) ?? false,
        createdAt: result.createdAt,
      } as unknown as User;
      setCustomer(p);
      if (result.autoCreated) {
        setMsg(
          "ℹ️ Khách chưa hoàn tất hồ sơ (chưa nhập tên). Đã tạo hồ sơ tạm — khách có thể đổi tên sau khi mở app.",
        );
      }

      // Tải các loại thẻ ACTIVE (vẫn dùng Firestore — rules cho phép staff đọc)
      const [cs, mems, pkgs, enrs] = await Promise.all([
        getDocs(collection(db, `users/${p.id}/children`)),
        getDocs(query(collection(db, "memberships"), where("userId", "==", p.id), where("status", "==", "ACTIVE"))),
        getDocs(query(collection(db, "ticketPackages"), where("userId", "==", p.id), where("status", "==", "ACTIVE"))),
        Promise.all([
          getDocs(query(collection(db, "enrollments"), where("studentId", "==", p.id), where("status", "==", "ACTIVE"))),
          getDocs(query(collection(db, "enrollments"), where("parentId", "==", p.id), where("status", "==", "ACTIVE"))),
        ]).then(([a, b]) => ({ docs: [...a.docs, ...b.docs] })),
      ]);

      setChildren(cs.docs.map((d) => ({ id: d.id, ...d.data() } as Child)));
      setTickets({
        memberships: mems.docs.map((d) => ({ id: d.id, ...d.data() } as Membership)),
        packages: pkgs.docs.map((d) => ({ id: d.id, ...d.data() } as TicketPackage)),
        enrollments: enrs.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment)),
      });
      await loadRecentCheckins(p.id);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.startsWith("not-found:")) {
        setError(
          "❌ Khách chưa từng đăng ký với SĐT này. Hãy yêu cầu khách mở app + đăng nhập 1 lần trước.",
        );
      } else if (msg.toLowerCase().includes("sđt không hợp lệ") || msg.toLowerCase().includes("invalid")) {
        setError("⚠️ SĐT không hợp lệ. Vui lòng nhập 10 số bắt đầu bằng 0 (vd: 0905123456).");
      } else {
        setError(msg);
      }
    }
  }

  async function checkinMembership(m: Membership) {
    if (!customer) return;
    setBusy("mem-" + m.id);
    setMsg(undefined);
    setError(undefined);
    try {
      const beneficiaryId = m.holderKind === "CHILD" ? m.holderId : undefined;
      const r = await staffCheckinByPhone({
        phone: customer.phone,
        beneficiaryId,
        forceKind: "MEMBERSHIP",
        targetId: m.id,
      });
      setMsg(`✅ ${r.message} — đã gửi thông báo cho khách.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function loadRecentCheckins(userId: string) {
    const snap = await getDocs(query(collection(db, "checkins"), where("userId", "==", userId)));
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CheckIn))
      .filter((c) => c.kind === "PACKAGE" && c.result === "ACCEPTED")
      .sort((a, b) => timeMs(b.at) - timeMs(a.at))
      .slice(0, 8);
    setRecentCheckins(list);
  }

  async function checkinPackage(p: TicketPackage, count: number, reason: string) {
    if (!customer || count < 1 || count > p.remainingSessions || !reason.trim()) return;
    setBusy("pkg-" + p.id);
    setMsg(undefined);
    setError(undefined);
    try {
      const r = await staffCheckinByPhone({
        phone: customer.phone,
        groupSize: count,
        forceKind: "PACKAGE",
        targetId: p.id,
        reason: reason.trim(),
      });
      setMsg(`✅ ${r.message} — đã gửi thông báo cho khách.`);
      await loadRecentCheckins(customer.id);
      await search();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function correctCheckin(checkinId: string, mode: "PARTIAL" | "CANCEL", refundCount: number, reason: string) {
    if (!customer) return;
    setBusy("correct-" + checkinId);
    setMsg(undefined);
    setError(undefined);
    try {
      const r = await correctPackageCheckin({ checkinId, mode, refundCount, reason });
      setMsg(`✅ Đã hoàn ${r.refundCount} lượt. Thẻ hiện còn ${r.remaining} lượt.`);
      await search();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }


  async function extendTicket(kind: "MEMBERSHIP" | "COURSE", serviceId: string, addDays: number, addSessions: number, reason: string) {
    if (!customer) return;
    setBusy("extend-" + serviceId);
    setMsg(undefined);
    setError(undefined);
    try {
      await extendService({ kind, serviceId, addDays, addSessions, reason });
      setMsg("✅ Đã gia hạn và lưu lý do.");
      await search();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function checkinEnrollment(e: Enrollment) {
    if (!customer) return;
    setBusy("enr-" + e.id);
    setMsg(undefined);
    setError(undefined);
    try {
      const beneficiaryId = e.studentKind === "CHILD" ? e.studentId : undefined;
      const r = await staffCheckinByPhone({
        phone: customer.phone,
        beneficiaryId,
        forceKind: "COURSE",
        targetId: e.id,
      });
      setMsg(`✅ ${r.message} — đã gửi thông báo cho khách.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <h1 className="text-2xl font-bold text-brand-800">Điểm danh hộ</h1>
        <p className="text-sm text-slate-500">
          Dành cho khách quên điện thoại. Tra SĐT → chọn thẻ → bấm "Điểm danh". Khách sẽ nhận thông báo trong app.
        </p>
      </header>

      <div className="mt-5">
        <label className="text-sm font-medium">SĐT khách</label>
        <div className="relative mt-1 flex gap-2" ref={suggestBoxRef}>
          <div className="relative flex-1">
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowSuggest(false);
                  search();
                } else if (e.key === "Escape") {
                  setShowSuggest(false);
                }
              }}
              placeholder="0905 xxx xxx"
              autoComplete="off"
              className="w-full rounded-xl border-2 border-slate-200 p-3"
            />
            {showSuggest && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.uid}>
                    <button
                      type="button"
                      onClick={() => {
                        setPhone(s.local);
                        setShowSuggest(false);
                        setTimeout(() => search(), 0);
                      }}
                      className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-brand-50"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800">
                          {s.fullName || <span className="text-slate-400">(chưa đặt tên)</span>}
                        </div>
                        <div className="truncate text-xs text-slate-500 tabular-nums">{formatPhone(s.local)}</div>
                      </div>
                      <span className="text-[10px] uppercase text-brand-600">chọn</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={() => { setShowSuggest(false); search(); }} className="flex items-center gap-1 rounded-xl bg-brand-600 px-6 font-semibold text-white">
            <Search className="size-4" /> Tìm
          </button>
        </div>
        {phone.replace(/\D/g, "").length >= 3 && suggestions.length === 0 && allPhones.length > 0 && (
          <p className="mt-1 text-[11px] text-slate-400">Không có SĐT khớp tiền tố trong danh bạ. Vẫn có thể bấm Tìm để tra Auth.</p>
        )}
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {msg && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}

      {customer && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-xl">👤</span>
            <div>
              <div className="font-semibold">{customer.fullName || "(chưa đặt tên)"}</div>
              <div className="text-xs text-slate-500">
                📞 {customer.phone} · {children.length} con
              </div>
            </div>
          </div>

          {/* Vé thời hạn */}
          {tickets.memberships.length > 0 && (
            <Section title="Vé thời hạn" icon={<Calendar className="size-4 text-blue-600" />}>
              {tickets.memberships.map((m) => (
                <TicketCard
                  key={m.id}
                  emoji="📅"
                  title={`MS${m.memberCode} · ${m.holderName}`}
                  subtitle={`Hết hạn ${formatDate(m.endDate)} · ${m.audience}`}
                  action={
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => checkinMembership(m)}
                        disabled={busy === "mem-" + m.id}
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {busy === "mem-" + m.id ? "..." : "Điểm danh"}
                      </button>
                      <ExtensionPanel kind="MEMBERSHIP" serviceId={m.id} busy={busy === "extend-" + m.id} allowDays onExtend={extendTicket} />
                    </div>
                  }
                />
              ))}
            </Section>
          )}

          {/* Vé lượt — chọn số lượt */}
          {tickets.packages.length > 0 && (
            <Section title="Vé lượt" icon={<Ticket className="size-4 text-amber-600" />}>
              {tickets.packages.map((p) => (
                <PackageCheckin
                  key={p.id}
                  pkg={p}
                  busy={busy === "pkg-" + p.id}
                  onCheckin={(count, reason) => checkinPackage(p, count, reason)}
                />
              ))}
            </Section>
          )}

          {recentCheckins.length > 0 && (
            <Section title="Sửa sai điểm danh vé lượt" icon={<Ticket className="size-4 text-red-600" />}>
              {recentCheckins.map((c) => (
                <CorrectionCard
                  key={c.id}
                  checkin={c}
                  busy={busy === "correct-" + c.id}
                  onCorrect={(mode, count, reason) => correctCheckin(c.id, mode, count, reason)}
                />
              ))}
            </Section>
          )}

          {/* Khóa học */}
          {tickets.enrollments.length > 0 && (
            <Section title="Khóa học" icon={<GraduationCap className="size-4 text-emerald-600" />}>
              {tickets.enrollments.map((e) => (
                <TicketCard
                  key={e.id}
                  emoji="🏊"
                  title={`MS${e.memberCode} · ${e.studentName}`}
                  subtitle={`HLV ${e.coachName} · ${e.attendedSessions ?? 0}/${e.totalSessions} buổi · HH ${formatDate(e.expiryDate)}`}
                  action={
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => checkinEnrollment(e)}
                        disabled={busy === "enr-" + e.id}
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {busy === "enr-" + e.id ? "..." : "Điểm danh"}
                      </button>
                      <ExtensionPanel kind="COURSE" serviceId={e.id} busy={busy === "extend-" + e.id} allowDays allowSessions onExtend={extendTicket} />
                    </div>
                  }
                />
              ))}
            </Section>
          )}

          {!tickets.memberships.length && !tickets.packages.length && !tickets.enrollments.length && (
            <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
              Khách không có thẻ/khóa học đang hoạt động. Vui lòng mua vé lẻ tại quầy.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatPhone(local: string): string {
  if (/^0\d{9}$/.test(local)) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return local;
}

function timeMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") return new Date(value).getTime() || 0;
  if (typeof value === "object" && value && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return ((value as { toMillis: () => number }).toMillis());
  }
  return 0;
}


function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        {icon} {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function TicketCard({
  emoji,
  title,
  subtitle,
  action,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{title}</div>
        <div className="truncate text-xs text-slate-500">{subtitle}</div>
      </div>
      {action}
    </div>
  );
}

function PackageCheckin({
  pkg,
  busy,
  onCheckin,
}: {
  pkg: TicketPackage;
  busy: boolean;
  onCheckin: (count: number, reason: string) => void;
}) {
  const [count, setCount] = useState(1);
  const [reason, setReason] = useState("");
  const max = pkg.remainingSessions;
  const audLabel =
    pkg.audience === "ADULT"
      ? "Người lớn"
      : pkg.audience === "CHILD_UNDER_140"
        ? "Trẻ <1.4m"
        : "Trẻ ≥1.4m";

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎟️</span>
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">
            MS{pkg.memberCode} · {pkg.holderName || "Khách"} · Còn {pkg.remainingSessions}/{pkg.totalSessions} lượt
          </div>
          <div className="truncate text-xs text-slate-500">
            {audLabel} · Tạo {formatDate(pkg.createdAt)}
          </div>
        </div>
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Lý do xác nhận hộ (bắt buộc)"
        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Số lượt cần trừ:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCount(Math.max(1, count - 1))}
              disabled={count <= 1}
              className="flex size-8 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-600 ring-1 ring-slate-200 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-8 text-center font-bold tabular-nums">{count}</span>
            <button
              onClick={() => setCount(Math.min(max, count + 1))}
              disabled={count >= max}
              className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
        <button
          onClick={() => onCheckin(count, reason)}
          disabled={busy || count < 1 || count > max || !reason.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "..." : `Trừ ${count} lượt`}
        </button>
      </div>
    </div>
  );
}



function ExtensionPanel({
  kind,
  serviceId,
  busy,
  allowDays = false,
  allowSessions = false,
  onExtend,
}: {
  kind: "MEMBERSHIP" | "COURSE";
  serviceId: string;
  busy: boolean;
  allowDays?: boolean;
  allowSessions?: boolean;
  onExtend: (kind: "MEMBERSHIP" | "COURSE", serviceId: string, addDays: number, addSessions: number, reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(0);
  const [sessions, setSessions] = useState(0);
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= 3 && ((allowDays && days > 0) || (allowSessions && sessions > 0));
  if (!open) return <button onClick={() => setOpen(true)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">Gia hạn</button>;
  return (
    <div className="w-56 rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-xs">
      <div className="font-bold text-emerald-900">Gia hạn</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {allowDays && <label className="text-slate-600">Ngày<input type="number" min={0} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white p-2" /></label>}
        {allowSessions && <label className="text-slate-600">Buổi<input type="number" min={0} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white p-2" /></label>}
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do bắt buộc" className="mt-2 w-full rounded-lg border border-white p-2" />
      <div className="mt-2 flex gap-2">
        <button onClick={() => onExtend(kind, serviceId, days, sessions, reason.trim())} disabled={!canSubmit || busy} className="flex-1 rounded-lg bg-emerald-600 px-2 py-2 font-bold text-white disabled:opacity-50">{busy ? "..." : "Lưu"}</button>
        <button onClick={() => setOpen(false)} className="rounded-lg bg-white px-2 py-2 font-bold text-slate-500">Đóng</button>
      </div>
    </div>
  );
}

function CorrectionCard({
  checkin,
  busy,
  onCorrect,
}: {
  checkin: CheckIn;
  busy: boolean;
  onCorrect: (mode: "PARTIAL" | "CANCEL", count: number, reason: string) => void;
}) {
  const original = checkin.groupSize ?? 1;
  const refunded = checkin.refundedCount ?? 0;
  const left = Math.max(0, original - refunded);
  const [count, setCount] = useState(Math.max(1, Math.min(1, left)));
  const [reason, setReason] = useState("");
  const disabled = busy || left <= 0 || !reason.trim();

  return (
    <div className="rounded-xl border border-red-100 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-slate-900">
            Đã trừ {original} lượt · còn có thể hoàn {left} lượt
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {formatDate(checkin.at)} · {checkin.correctionStatus === "CANCELLED_OR_FULLY_REFUNDED" ? "Đã hoàn/hủy hết" : checkin.correctionStatus === "PARTIALLY_REFUNDED" ? "Đã hoàn một phần" : "Chưa sửa"}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]">
        <input
          type="number"
          min={1}
          max={left || 1}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(left || 1, Number(e.target.value) || 1)))}
          disabled={left <= 0}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:bg-slate-50"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lý do sửa sai (bắt buộc)"
          disabled={left <= 0}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onCorrect("PARTIAL", count, reason)}
          disabled={disabled || count > left}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "..." : `Hoàn ${count} lượt`}
        </button>
        <button
          onClick={() => onCorrect("CANCEL", left, reason)}
          disabled={disabled}
          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Hủy cả lần
        </button>
      </div>
    </div>
  );
}
