"use client";
import { useState } from "react";
import { collection, doc, getDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { staffCheckinByPhone, searchCustomerByPhone, correctPackageCheckin, correctCourseAttendance, extendService } from "@/lib/callable";
import type { User, Child, Membership, TicketPackage, Enrollment, CheckIn, CourseAttendanceContext } from "@/types";
import { formatDate, toDate } from "@/lib/utils";
import { getPackageExpiryDate, isPackageExpired } from "@/lib/packageExpiry";
import { Ticket, Calendar, GraduationCap, Search } from "lucide-react";
import { StaffPassPhoto } from "@/components/StaffPassPhoto";
import { StaffPhoneAutocomplete } from "@/components/StaffPhoneAutocomplete";

// v2.3 (D9): điểm danh hộ mở rộng cho VÉ LƯỢT (chọn số lượt) + khóa học + vé thời hạn.
// v2.4 (E1): dùng callable searchCustomerByPhone — server normalize SĐT + 2-stage lookup
// (Firestore → Auth chẩn đoán). Hiển thị error rõ theo prefix incomplete-profile/not-found.
// Lễ tân tra SĐT → hiển thị mọi thẻ ACTIVE của khách → bấm "Điểm danh" trên thẻ tương ứng.

type Tickets = {
  memberships: Membership[];
  packages: TicketPackage[];
  enrollments: Enrollment[];
};

export default function CheckinAssistPage() {
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<User>();
  const [children, setChildren] = useState<Child[]>([]);
  const [tickets, setTickets] = useState<Tickets>({ memberships: [], packages: [], enrollments: [] });
  const [recentCheckins, setRecentCheckins] = useState<CheckIn[]>([]);
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  async function search(selectedPhone?: string) {
    setMsg(undefined);
    setError(undefined);
    setCustomer(undefined);
    setChildren([]);
    setTickets({ memberships: [], packages: [], enrollments: [] });
    setRecentCheckins([]);

    const raw = (selectedPhone ?? phone).trim();
    if (!raw) return;
    if (selectedPhone) setPhone(selectedPhone);

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
        getDocs(query(collection(db, "ticketPackages"), where("userId", "==", p.id))),
        Promise.all([
          getDocs(query(collection(db, "enrollments"), where("studentId", "==", p.id), where("status", "==", "ACTIVE"))),
          getDocs(query(collection(db, "enrollments"), where("parentId", "==", p.id), where("status", "==", "ACTIVE"))),
        ]).then(([a, b]) => ({ docs: [...a.docs, ...b.docs] })),
      ]);

      const childList = cs.docs.map((d) => ({ id: d.id, ...d.data() } as Child));
      const packageList = pkgs.docs
        .map((d) => ({ id: d.id, ...d.data() } as TicketPackage))
        .filter((p) => p.status !== "SUSPENDED")
        .sort((a, b) => Number(isPackageExpired(a)) - Number(isPackageExpired(b)));
      const enrollmentList = enrs.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
      setChildren(childList);
      setTickets({
        memberships: mems.docs.map((d) => ({ id: d.id, ...d.data() } as Membership)),
        packages: packageList,
        enrollments: enrollmentList,
      });
      await loadRecentCheckins(p.id, p, childList, enrollmentList);
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
      setMsg(`✅ ${r.message} — đã gửi thông báo cho khách. Nếu khách không xuống hồ/học, dùng mục hoàn lượt ngay bên dưới.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function loadRecentCheckins(
    userId: string,
    currentCustomer?: User,
    currentChildren: Child[] = [],
    currentEnrollments: Enrollment[] = [],
  ) {
    const snap = await getDocs(query(collection(db, "checkins"), where("userId", "==", userId)));
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CheckIn))
      .filter((c) => (c.kind === "PACKAGE" || c.kind === "COURSE") && c.result === "ACCEPTED")
      .sort((a, b) => timeMs(b.at) - timeMs(a.at))
      .slice(0, 8);
    setRecentCheckins(await enrichCourseCheckins(list, currentCustomer, currentChildren, currentEnrollments));
  }

  async function checkinPackage(p: TicketPackage, count: number, reason: string) {
    if (!customer || count < 1 || count > p.remainingSessions || !reason.trim()) return;
    if (isPackageExpired(p)) {
      setError("Vé lượt đã hết hạn sau 365 ngày từ ngày kích hoạt. Vui lòng mua gói mới tại quầy.");
      return;
    }
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
      await loadRecentCheckins(customer.id, customer, children, tickets.enrollments);
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

  async function undoCourseAttendance(checkinId: string, reason: string) {
    if (!customer) return;
    setBusy("undo-course-" + checkinId);
    setMsg(undefined);
    setError(undefined);
    try {
      const r = await correctCourseAttendance({ checkinId, reason });
      await search();
      const detail = [
        r.studentName ? `HV ${r.studentName}` : null,
        r.coachName ? `HLV ${r.coachName}` : null,
        r.checkinTimeText ? `check-in ${r.checkinTimeText}` : null,
        r.scheduledTimeText ? `lịch ${r.scheduledTimeText}` : null,
      ].filter(Boolean).join(" · ");
      setMsg(`✅ Đã hủy 1 buổi điểm danh khóa học${detail ? `: ${detail}` : ""}. Còn ${r.attendedSessions}/${r.totalSessions} buổi.`);
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
      await loadRecentCheckins(customer.id, customer, children, tickets.enrollments);
      await search();
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
        <div className="mt-1 flex gap-2">
          <StaffPhoneAutocomplete
            value={phone}
            onChange={setPhone}
            onSelect={(entry) => void search(entry.local)}
            onEnter={() => void search()}
            placeholder="0905 xxx xxx"
            containerClassName="flex-1"
            className="w-full rounded-xl border-2 border-slate-200 p-3"
          />
          <button onClick={() => void search()} className="flex items-center gap-1 rounded-xl bg-brand-600 px-6 font-semibold text-white">
            <Search className="size-4" /> Tìm
          </button>
        </div>
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
                <div key={m.id} className="rounded-xl border border-slate-100 bg-white p-3">
                  <TicketCard
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
                  {customer && (
                    <div className="mt-3">
                      <StaffPassPhoto customerId={customer.id} membership={m} compact onUpdated={search} />
                    </div>
                  )}
                </div>
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

          {recentCheckins.filter((c) => c.kind === "PACKAGE").length > 0 && (
            <Section title="Hoàn lượt vừa trừ / sửa sai vé lượt" icon={<Ticket className="size-4 text-red-600" />}>
              {recentCheckins.filter((c) => c.kind === "PACKAGE").map((c) => (
                <CorrectionCard
                  key={c.id}
                  checkin={c}
                  busy={busy === "correct-" + c.id}
                  onCorrect={(mode, count, reason) => correctCheckin(c.id, mode, count, reason)}
                />
              ))}
            </Section>
          )}

          {recentCheckins.filter((c) => c.kind === "COURSE").length > 0 && (
            <Section title="Hủy điểm danh khóa học vừa ghi" icon={<GraduationCap className="size-4 text-red-600" />}>
              {recentCheckins.filter((c) => c.kind === "COURSE").map((c) => (
                <CourseAttendanceUndoCard
                  key={c.id}
                  checkin={c}
                  busy={busy === "undo-course-" + c.id}
                  onUndo={(reason) => undoCourseAttendance(c.id, reason)}
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

function timeMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime() || 0;
  if (typeof value === "object" && value && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return ((value as { toMillis: () => number }).toMillis());
  }
  if (typeof value === "object" && value && "seconds" in value) {
    return Number((value as { seconds?: unknown }).seconds ?? 0) * 1000;
  }
  return 0;
}

type CourseSlotData = {
  weekday?: number;
  startHour?: number;
  endHour?: number;
};

async function enrichCourseCheckins(
  list: CheckIn[],
  currentCustomer?: User,
  currentChildren: Child[] = [],
  currentEnrollments: Enrollment[] = [],
): Promise<CheckIn[]> {
  const enrollmentMap = new Map(currentEnrollments.map((e) => [e.id, e]));
  const childMap = new Map(currentChildren.map((c) => [c.id, c]));

  return Promise.all(list.map(async (checkin) => {
    if (checkin.kind !== "COURSE") return checkin;
    const storedContext = checkin.courseAttendanceContext ?? checkin.courseAttendanceUndo?.context;
    if (storedContext) return { ...checkin, courseAttendanceContext: storedContext };

    let enrollment = enrollmentMap.get(checkin.refId);
    if (!enrollment && checkin.refId) {
      const enrollmentSnap = await getDoc(doc(db, "enrollments", checkin.refId));
      if (enrollmentSnap.exists()) {
        enrollment = { id: enrollmentSnap.id, ...enrollmentSnap.data() } as Enrollment;
        enrollmentMap.set(enrollment.id, enrollment);
      }
    }
    if (!enrollment) return checkin;

    let slot: CourseSlotData | undefined;
    if (enrollment.coachId && enrollment.slotId) {
      const slotSnap = await getDoc(doc(db, "coaches", enrollment.coachId, "slots", enrollment.slotId));
      if (slotSnap.exists()) slot = slotSnap.data() as CourseSlotData;
    }

    return {
      ...checkin,
      courseAttendanceContext: buildClientCourseContext(checkin, enrollment, slot, currentCustomer, childMap),
    };
  }));
}

function buildClientCourseContext(
  checkin: CheckIn,
  enrollment: Enrollment,
  slot: CourseSlotData | undefined,
  currentCustomer: User | undefined,
  childMap: Map<string, Child>,
): CourseAttendanceContext {
  const parsedSlot = parseSlotSchedule(enrollment.slotId);
  const scheduledWeekday = numberOrNull(slot?.weekday) ?? parsedSlot.weekday;
  const scheduledStartHour = numberOrNull(slot?.startHour) ?? parsedSlot.startHour;
  const scheduledEndHour = numberOrNull(slot?.endHour) ?? parsedSlot.endHour;
  const child = childMap.get(enrollment.studentId);
  const studentName = safeText(enrollment.studentName) ?? safeText(child?.fullName) ?? "Học viên";
  const customerName = safeText(currentCustomer?.fullName);
  const checkinTimeText = formatDateTime(checkin.at);

  return {
    enrollmentId: enrollment.id,
    attendanceId: safeText(checkin.attendanceId) ?? safeText(checkin.attendancePath)?.split("/").pop() ?? isoDateFromUnknown(checkin.at) ?? "chưa rõ",
    memberCode: safeText(enrollment.memberCode),
    studentId: safeText(enrollment.studentId) ?? safeText(checkin.beneficiaryId),
    studentKind: enrollment.studentKind ?? null,
    studentName,
    customerId: safeText(checkin.userId),
    customerName,
    customerPhone: safeText(currentCustomer?.phone),
    parentId: safeText(enrollment.parentId),
    parentName: enrollment.parentId ? customerName : null,
    coachId: safeText(enrollment.coachId),
    coachName: safeText(enrollment.coachName),
    slotId: safeText(enrollment.slotId),
    scheduledWeekday,
    scheduledStartHour,
    scheduledEndHour,
    scheduledTimeText: formatLessonTime(scheduledWeekday, scheduledStartHour, scheduledEndHour),
    checkinAt: checkin.at,
    checkinTimeText,
    attendedSessions: numberOrNull(enrollment.attendedSessions),
    totalSessions: numberOrNull(enrollment.totalSessions),
  };
}

function safeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseSlotSchedule(slotId: unknown) {
  const parts = String(slotId ?? "").split("_");
  const weekday = numberOrNull(parts[parts.length - 2]);
  const startHour = numberOrNull(parts[parts.length - 1]);
  return {
    weekday,
    startHour,
    endHour: startHour === null ? null : startHour + 1,
  };
}

function formatLessonTime(weekday: number | null, startHour: number | null, endHour: number | null): string | null {
  if (weekday === null || startHour === null) return null;
  const day = weekday === 0 ? "CN" : weekday >= 1 && weekday <= 6 ? `T${weekday + 1}` : null;
  if (!day) return null;
  return `${day}, ${String(startHour).padStart(2, "0")}:00-${String(endHour ?? startHour + 1).padStart(2, "0")}:00`;
}

function formatDateTime(value: unknown): string | null {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isoDateFromUnknown(value: unknown): string | null {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const expiry = getPackageExpiryDate(pkg);
  const expired = pkg.status === "EXPIRED" || isPackageExpired(pkg);
  const depleted = max <= 0 || pkg.status === "DEPLETED";
  const audLabel =
    pkg.audience === "ADULT"
      ? "Người lớn"
      : pkg.audience === "CHILD_UNDER_140"
        ? "Trẻ <1.4m"
        : "Trẻ ≥1.4m";

  return (
    <div className={`rounded-xl border p-3 ${expired ? "border-red-200 bg-red-50" : "border-slate-100 bg-white"}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎟️</span>
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">
            MS{pkg.memberCode} · {pkg.holderName || "Khách"} · Còn {pkg.remainingSessions}/{pkg.totalSessions} lượt
          </div>
          <div className="truncate text-xs text-slate-500">
            {audLabel} · HSD {expiry ? formatDate(expiry) : "đang cập nhật"}
          </div>
        </div>
      </div>
      {expired && (
        <div className="mt-3 rounded-lg bg-white/70 p-2 text-xs font-medium text-red-700">
          Vé lượt đã hết hạn sau 365 ngày từ ngày kích hoạt. Không thể điểm danh bằng gói này.
        </div>
      )}
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={expired || depleted}
        placeholder="Lý do xác nhận hộ (bắt buộc)"
        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Số lượt cần trừ:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCount(Math.max(1, count - 1))}
              disabled={expired || depleted || count <= 1}
              className="flex size-8 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-600 ring-1 ring-slate-200 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-8 text-center font-bold tabular-nums">{count}</span>
            <button
              onClick={() => setCount(Math.min(max, count + 1))}
              disabled={expired || depleted || count >= max}
              className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
        <button
          onClick={() => onCheckin(count, reason)}
          disabled={busy || expired || depleted || count < 1 || count > max || !reason.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {expired ? "Hết hạn" : depleted ? "Hết lượt" : busy ? "..." : `Trừ ${count} lượt`}
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

function CourseAttendanceUndoCard({
  checkin,
  busy,
  onUndo,
}: {
  checkin: CheckIn;
  busy: boolean;
  onUndo: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const undone = checkin.correctionStatus === "ATTENDANCE_UNDONE" || Boolean(checkin.courseAttendanceUndo);
  const disabled = busy || undone || !reason.trim();
  const undo = checkin.courseAttendanceUndo;
  const context = checkin.courseAttendanceContext ?? undo?.context;
  const memberCode = context?.memberCode ?? undo?.memberCode;
  const studentName = context?.studentName ?? undo?.studentName ?? "Học viên";
  const accountName = context?.parentName
    ? `Phụ huynh: ${context.parentName}`
    : context?.customerName
      ? `Khách: ${context.customerName}`
      : "Khách/phụ huynh: chưa rõ";
  const accountPhone = context?.customerPhone ? ` · ${context.customerPhone}` : "";
  const coachName = context?.coachName ?? undo?.coachName ?? "chưa rõ";
  const checkinTime = context?.checkinTimeText ?? undo?.checkinTimeText ?? formatDateTime(checkin.at) ?? "chưa rõ";
  const scheduledTime = context?.scheduledTimeText ?? undo?.scheduledTimeText ?? "chưa có lịch";
  const progressNow = undo
    ? `${undo.afterAttended}/${undo.totalSessions} buổi sau khi hủy`
    : context?.attendedSessions !== null && context?.attendedSessions !== undefined && context?.totalSessions
      ? `${context.attendedSessions}/${context.totalSessions} buổi hiện tại`
      : "đang cập nhật";
  const statusText = undone ? "Đã hủy điểm danh" : "Chưa hủy · chỉ được hủy 1 lần cho buổi này";

  return (
    <div className="rounded-xl border border-red-100 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-900">
            {memberCode ? `MS${memberCode} · ` : ""}{studentName}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {accountName}{accountPhone}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${undone ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>
          {undone ? "Đã hủy" : "Có thể hủy"}
        </span>
      </div>
      <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 sm:grid-cols-2">
        <InfoLine label="HLV" value={coachName} />
        <InfoLine label="Tiến độ" value={progressNow} />
        <InfoLine label="Giờ check-in" value={checkinTime} />
        <InfoLine label="Lịch học" value={scheduledTime} />
        <InfoLine label="Mã check-in" value={checkin.id} />
        <InfoLine label="Trạng thái" value={statusText} />
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Lý do hủy điểm danh (VD: học viên rời hồ trước khi học)"
        disabled={undone}
        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
      />
      <button
        onClick={() => onUndo(reason)}
        disabled={disabled}
        className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "..." : undone ? "Đã hủy" : "Hủy 1 buổi điểm danh"}
      </button>
      {checkin.courseAttendanceUndo && (
        <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          {formatDateTime(checkin.courseAttendanceUndo.at) ?? formatDate(checkin.courseAttendanceUndo.at)} · còn {checkin.courseAttendanceUndo.afterAttended}/{checkin.courseAttendanceUndo.totalSessions} buổi. Lý do: {checkin.courseAttendanceUndo.reason}
        </div>
      )}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="font-semibold text-slate-500">{label}: </span>
      <span className="break-words text-slate-800">{value}</span>
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
          placeholder="Lý do hoàn lượt (VD: khách không học/không xuống hồ)"
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
          Hoàn hết lượt này
        </button>
      </div>
      {Boolean(checkin.corrections?.length) && (
        <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          <div className="font-bold">Lịch sử hoàn lượt</div>
          <div className="mt-1 space-y-1">
            {checkin.corrections!.slice(-3).map((item, index) => (
              <div key={`${checkin.id}-${index}`}>
                {formatDate(item.at)} · hoàn {item.refundCount} lượt · còn {item.afterRemaining}. Lý do: {item.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
