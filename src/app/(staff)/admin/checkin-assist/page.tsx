"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, query, where, getDocs, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { staffCheckinByPhone, searchCustomerByPhone } from "@/lib/callable";
import type { User, Child, Membership, TicketPackage, Enrollment } from "@/types";
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

  async function checkinPackage(p: TicketPackage, count: number) {
    if (!customer || count < 1 || count > p.remainingSessions) return;
    setBusy("pkg-" + p.id);
    setMsg(undefined);
    setError(undefined);
    try {
      const r = await staffCheckinByPhone({
        phone: customer.phone,
        groupSize: count,
        forceKind: "PACKAGE",
        targetId: p.id,
      });
      setMsg(`✅ ${r.message} — đã gửi thông báo cho khách.`);
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
                    <button
                      onClick={() => checkinMembership(m)}
                      disabled={busy === "mem-" + m.id}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy === "mem-" + m.id ? "..." : "Điểm danh"}
                    </button>
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
                  onCheckin={(count) => checkinPackage(p, count)}
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
                    <button
                      onClick={() => checkinEnrollment(e)}
                      disabled={busy === "enr-" + e.id}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy === "enr-" + e.id ? "..." : "Điểm danh"}
                    </button>
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
  onCheckin: (count: number) => void;
}) {
  const [count, setCount] = useState(1);
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
            MS{pkg.memberCode} · Còn {pkg.remainingSessions}/{pkg.totalSessions} lượt
          </div>
          <div className="truncate text-xs text-slate-500">
            {audLabel} · Tạo {formatDate(pkg.createdAt)}
          </div>
        </div>
      </div>
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
          onClick={() => onCheckin(count)}
          disabled={busy || count < 1 || count > max}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "..." : `Trừ ${count} lượt`}
        </button>
      </div>
    </div>
  );
}
