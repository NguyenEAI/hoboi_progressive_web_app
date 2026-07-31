"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import {
  AlertCircle,
  Bell,
  BellOff,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  MessageSquare,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useCoach } from "@/lib/hooks/useCoach";
import { WEEKDAY_LABELS, SLOT_START_HOURS, SLOT_CAPACITY } from "@/lib/constants";
import type { Attendance, CoachAbsence, Enrollment } from "@/types";
import { reportCoachAbsence } from "@/lib/callable";
import { useToast } from "@/components/Toast";
import { cn, daysUntil, formatDate, toDate } from "@/lib/utils";
import {
  countConsecutiveAbsences,
  expectedSessionDates,
  isoDateKey,
  parseSlotId,
} from "@/lib/coachUtils";

type EnrollmentWithMeta = Enrollment & {
  consecutiveAbsences: number;
  attendances: Attendance[];
  expiryDays: number;
  remainingSessions: number;
  slotWeekday?: number;
  slotHour?: number;
  nextSessionAt?: Date | null;
};

type SlotSummary = {
  hour: number;
  students: EnrollmentWithMeta[];
  absence?: CoachAbsence;
};

type ReportTarget = {
  date: string;
  weekday: number;
  hour: number;
  students: EnrollmentWithMeta[];
} | null;

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function nextSessionForEnrollment(e: Enrollment, now: Date): Date | null {
  const slot = parseSlotId(e.slotId);
  if (!slot) return null;

  const remaining = Math.max(0, (e.totalSessions ?? 15) - (e.attendedSessions ?? 0));
  if (remaining <= 0) return null;

  const expiry = toDate(e.expiryDate);
  for (let offset = 0; offset <= 120; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    d.setHours(slot.startHour, 0, 0, 0);
    if (d.getDay() !== slot.weekday) continue;
    if (d.getTime() < now.getTime()) continue;
    if (!Number.isNaN(expiry.getTime()) && d.getTime() > expiry.getTime()) return null;
    return d;
  }
  return null;
}

export default function CoachTodayPage() {
  const { coach, loading } = useCoach();
  const toast = useToast();
  const [enrolls, setEnrolls] = useState<EnrollmentWithMeta[]>([]);
  const [absences, setAbsences] = useState<CoachAbsence[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState<ReportTarget>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dateKey(today), [today]);
  const weekday = today.getDay();

  useEffect(() => {
    if (!coach) return;
    let alive = true;
    setDataLoading(true);

    (async () => {
      const enrollSnap = await getDocs(
        query(
          collection(db, "enrollments"),
          where("coachId", "==", coach.id),
          where("status", "==", "ACTIVE"),
        ),
      );
      const baseList = enrollSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
      const withMeta = await Promise.all(
        baseList.map(async (e) => {
          const attSnap = await getDocs(
            query(
              collection(db, `enrollments/${e.id}/attendances`),
              orderBy("date", "desc"),
            ),
          );
          const attendances = attSnap.docs.map((d) => d.data() as Attendance);
          const slot = parseSlotId(e.slotId);
          let consecutiveAbsences = 0;
          if (slot) {
            const attendedKeys = new Set(
              attendances.filter((a) => a.present).map((a) => isoDateKey(toDate(a.date))),
            );
            const expected = expectedSessionDates(
              e.startDate,
              slot.weekday,
              today,
              e.totalSessions ?? 15,
            );
            consecutiveAbsences = countConsecutiveAbsences(expected, attendedKeys);
          }
          return {
            ...e,
            attendances,
            consecutiveAbsences,
            expiryDays: daysUntil(e.expiryDate),
            remainingSessions: Math.max(0, (e.totalSessions ?? 15) - (e.attendedSessions ?? 0)),
            slotWeekday: slot?.weekday,
            slotHour: slot?.startHour,
            nextSessionAt: nextSessionForEnrollment(e, today),
          };
        }),
      );

      const absenceSnap = await getDocs(collection(db, `coaches/${coach.id}/absences`));
      const absenceList = absenceSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as CoachAbsence),
      );

      if (!alive) return;
      setEnrolls(withMeta);
      setAbsences(absenceList);
      setDataLoading(false);
    })().catch((e) => {
      if (!alive) return;
      toast.show("Không tải được dữ liệu HLV: " + (e as Error).message, "error");
      setDataLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [coach, today]);

  async function refreshAbsences() {
    if (!coach) return;
    const s = await getDocs(collection(db, `coaches/${coach.id}/absences`));
    setAbsences(s.docs.map((d) => ({ id: d.id, ...d.data() } as CoachAbsence)));
  }

  async function confirmReport() {
    if (!coach || !reportTarget) return;
    setBusy(true);
    try {
      const res = await reportCoachAbsence({
        coachId: coach.id,
        date: reportTarget.date,
        startHour: reportTarget.hour,
        reason: reason.trim() || undefined,
      });
      toast.show(
        `Đã báo nghỉ ca ${reportTarget.hour}h. ${res.notified} học viên đã nhận thông báo.`,
        "success",
      );
      setReportTarget(null);
      setReason("");
      await refreshAbsences();
    } catch (e) {
      toast.show("Báo nghỉ thất bại: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const absenceByKey = useMemo(() => {
    const m = new Map<string, CoachAbsence>();
    for (const a of absences) m.set(`${a.date}_${a.startHour}`, a);
    return m;
  }, [absences]);

  const slotsToday = useMemo<SlotSummary[]>(
    () =>
      SLOT_START_HOURS.map((hour) => ({
        hour,
        students: enrolls.filter((e) => e.slotWeekday === weekday && e.slotHour === hour),
        absence: absenceByKey.get(`${todayKey}_${hour}`),
      })),
    [absenceByKey, enrolls, todayKey, weekday],
  );

  const nextClass = useMemo(() => {
    const upcoming = enrolls
      .filter((e) => e.nextSessionAt)
      .sort((a, b) => a.nextSessionAt!.getTime() - b.nextSessionAt!.getTime());
    const first = upcoming[0];
    if (!first?.nextSessionAt || first.slotHour == null) return null;
    const sameSlotStudents = upcoming.filter(
      (e) => e.nextSessionAt && dateKey(e.nextSessionAt) === dateKey(first.nextSessionAt!) && e.slotHour === first.slotHour,
    );
    return {
      at: first.nextSessionAt,
      hour: first.slotHour,
      students: sameSlotStudents,
      absence: absenceByKey.get(`${dateKey(first.nextSessionAt)}_${first.slotHour}`),
    };
  }, [absenceByKey, enrolls]);

  const absenceAlerts = useMemo(
    () =>
      enrolls
        .filter((e) => e.consecutiveAbsences >= 3)
        .sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences),
    [enrolls],
  );

  const courseAlerts = useMemo(
    () =>
      enrolls
        .filter(
          (e) =>
            e.remainingSessions <= 3 ||
            (Number.isFinite(e.expiryDays) && e.expiryDays >= 0 && e.expiryDays <= 10),
        )
        .sort((a, b) => a.remainingSessions - b.remainingSessions || a.expiryDays - b.expiryDays),
    [enrolls],
  );

  const reportedAbsences = useMemo(
    () =>
      absences
        .filter((a) => a.date >= todayKey)
        .sort((a, b) => `${a.date}_${a.startHour}`.localeCompare(`${b.date}_${b.startHour}`)),
    [absences, todayKey],
  );

  const teachesToday = coach?.weekdays.includes(weekday as 0);
  const todayStudentCount = slotsToday.reduce((sum, slot) => sum + slot.students.length, 0);
  const attentionCount = reportedAbsences.length + absenceAlerts.length + courseAlerts.length;

  if (loading) return <main className="p-6 text-slate-500">Đang tải...</main>;
  if (!coach) return <main className="p-6 text-slate-500">Tài khoản này chưa được gán làm HLV.</main>;

  return (
    <main className="bg-slate-50">
      <section className="border-b bg-white px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-700">
              {WEEKDAY_LABELS[weekday as 0]} · {formatDate(today)}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{coach.fullName}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Lịch dạy và theo dõi học viên. Điểm danh là dữ liệu chỉ xem.
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
            <div className="text-xl font-bold text-emerald-700">{enrolls.length}</div>
            <div className="text-[11px] font-medium text-emerald-800">học viên</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric label="Hôm nay" value={todayStudentCount} suffix="HV" />
          <Metric label="Cần chú ý" value={attentionCount} suffix="mục" tone={attentionCount ? "amber" : "slate"} />
          <Metric label="Ca đã báo nghỉ" value={reportedAbsences.length} suffix="ca" tone={reportedAbsences.length ? "red" : "slate"} />
        </div>
      </section>

      <section className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/coach/students"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm"
          >
            <Search className="size-4 text-brand-600" />
            Tìm học viên
          </Link>
          <button
            disabled={!nextClass || !!nextClass.absence}
            onClick={() =>
              nextClass &&
              setReportTarget({
                date: dateKey(nextClass.at),
                weekday: nextClass.at.getDay(),
                hour: nextClass.hour,
                students: nextClass.students,
              })
            }
            className="flex items-center gap-2 rounded-xl border border-red-100 bg-white px-3 py-3 text-sm font-semibold text-red-700 shadow-sm disabled:text-slate-400"
          >
            <Bell className="size-4" />
            Báo nghỉ ca
          </button>
        </div>

        <NextClassCard nextClass={nextClass} />

        <ActionNeeded
          reportedAbsences={reportedAbsences}
          absenceAlerts={absenceAlerts}
          courseAlerts={courseAlerts}
        />

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Lịch hôm nay</h2>
            <span className="text-xs text-slate-500">
              {teachesToday ? `${todayStudentCount} học viên` : "Không có lịch dạy"}
            </span>
          </div>

          {!teachesToday ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
              Hôm nay không có ca dạy. Lịch cố định:{" "}
              {coach.weekdays.map((w) => WEEKDAY_LABELS[w]).join(" · ")}.
            </div>
          ) : (
            <div className="space-y-2">
              {slotsToday.map((slot) => (
                <SlotCard
                  key={slot.hour}
                  slot={slot}
                  onReport={() =>
                    setReportTarget({
                      date: todayKey,
                      weekday,
                      hour: slot.hour,
                      students: slot.students,
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>
      </section>

      {dataLoading && (
        <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-md px-4">
          <div className="rounded-xl bg-slate-900 px-4 py-2 text-center text-sm text-white shadow-elevated">
            Đang cập nhật dữ liệu lớp học...
          </div>
        </div>
      )}

      {reportTarget && (
        <ReportAbsenceDialog
          target={reportTarget}
          reason={reason}
          busy={busy}
          onReasonChange={setReason}
          onClose={() => !busy && setReportTarget(null)}
          onConfirm={confirmReport}
        />
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  suffix,
  tone = "slate",
}: {
  label: string;
  value: number;
  suffix: string;
  tone?: "slate" | "amber" | "red";
}) {
  return (
    <div className={cn("rounded-xl px-3 py-2", tone === "amber" ? "bg-amber-50" : tone === "red" ? "bg-red-50" : "bg-slate-50")}>
      <div className={cn("text-lg font-bold", tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-700" : "text-slate-800")}>
        {value}
      </div>
      <div className="text-[11px] font-medium text-slate-500">
        {label} · {suffix}
      </div>
    </div>
  );
}

function NextClassCard({
  nextClass,
}: {
  nextClass: {
    at: Date;
    hour: number;
    students: EnrollmentWithMeta[];
    absence?: CoachAbsence;
  } | null;
}) {
  if (!nextClass) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarClock className="size-4 text-slate-400" />
          Chưa có ca học kế tiếp
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Khi có khóa đang hoạt động và còn buổi học, ca gần nhất sẽ hiện tại đây.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700">
            <CalendarClock className="size-4" />
            Ca kế tiếp
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {WEEKDAY_LABELS[nextClass.at.getDay() as 0]} {formatShortDate(nextClass.at)} ·{" "}
            {nextClass.hour}:00-{nextClass.hour + 1}:00
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {nextClass.students.length}/{SLOT_CAPACITY} học viên trong ca
          </p>
        </div>
        {nextClass.absence ? (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
            Đã báo nghỉ
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            Sẵn sàng
          </span>
        )}
      </div>
      {nextClass.absence && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          Nhắc nội bộ: ca này đã báo nghỉ, cần lễ tân/Owner theo dõi lịch bù với học viên.
        </div>
      )}
    </section>
  );
}

function ActionNeeded({
  reportedAbsences,
  absenceAlerts,
  courseAlerts,
}: {
  reportedAbsences: CoachAbsence[];
  absenceAlerts: EnrollmentWithMeta[];
  courseAlerts: EnrollmentWithMeta[];
}) {
  const hasItems = reportedAbsences.length || absenceAlerts.length || courseAlerts.length;

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <AlertCircle className={cn("size-4", hasItems ? "text-amber-600" : "text-emerald-600")} />
          Cần theo dõi
        </h2>
        <Link href="/coach/students" className="text-xs font-semibold text-brand-700">
          Xem học viên
        </Link>
      </div>

      {!hasItems ? (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Chưa có cảnh báo vắng liên tiếp, báo nghỉ hoặc khóa gần hết buổi/hết hạn.
        </div>
      ) : (
        <div className="space-y-2">
          {reportedAbsences.slice(0, 2).map((a) => (
            <div key={a.id} className="rounded-lg border border-red-100 bg-red-50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <BellOff className="size-4" />
                Đã báo nghỉ {formatDate(a.date)} · {a.startHour}:00
              </div>
              <p className="mt-1 text-xs text-red-700">
                Nhắc nội bộ: theo dõi với lễ tân/Owner để sắp lịch bù sau, không tạo lịch bù tự động.
              </p>
            </div>
          ))}

          {absenceAlerts.slice(0, 3).map((e) => (
            <Link
              key={`absence-${e.id}`}
              href={`/coach/students?student=${encodeURIComponent(e.id)}`}
              className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 p-3"
            >
              <div>
                <div className="text-sm font-semibold text-amber-900">
                  {e.studentName} vắng {e.consecutiveAbsences} buổi liên tiếp
                </div>
                <div className="text-xs text-amber-700">Mở chi tiết để xem lịch sử và ghi chú.</div>
              </div>
              <ChevronRight className="size-4 text-amber-700" />
            </Link>
          ))}

          {courseAlerts.slice(0, 3).map((e) => (
            <Link
              key={`course-${e.id}`}
              href={`/coach/students?student=${encodeURIComponent(e.id)}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {e.studentName}: còn {e.remainingSessions} buổi
                </div>
                <div className="text-xs text-slate-500">
                  Hết hạn: {formatDate(e.expiryDate)}
                  {Number.isFinite(e.expiryDays) && e.expiryDays >= 0 ? ` · còn ${e.expiryDays} ngày` : ""}
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-400" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function SlotCard({ slot, onReport }: { slot: SlotSummary; onReport: () => void }) {
  const count = slot.students.length;
  const percent = Math.min(100, Math.round((count / SLOT_CAPACITY) * 100));
  const reported = !!slot.absence;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm",
        reported ? "border-red-200 bg-red-50" : count ? "border-slate-200" : "border-slate-100",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-900">
              {slot.hour}:00-{slot.hour + 1}:00
            </span>
            {count >= SLOT_CAPACITY && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                Đầy
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <UsersRound className="size-3.5" />
            {count ? `${count}/${SLOT_CAPACITY} học viên` : "Chưa có học viên trong ca này"}
          </div>
        </div>

        {reported ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
            <BellOff className="size-3" />
            Đã báo nghỉ
          </span>
        ) : count ? (
          <button
            onClick={onReport}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50"
          >
            <Bell className="size-3" />
            Báo nghỉ
          </button>
        ) : null}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full", reported ? "bg-red-400" : "bg-emerald-500")}
          style={{ width: `${percent}%` }}
        />
      </div>

      {count > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {slot.students.slice(0, 4).map((e) => (
            <Link
              key={e.id}
              href={`/coach/students?student=${encodeURIComponent(e.id)}`}
              className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
            >
              {e.studentName}
            </Link>
          ))}
          {count > 4 && (
            <Link
              href="/coach/students"
              className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500"
            >
              +{count - 4} học viên
            </Link>
          )}
        </div>
      )}

      {reported && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 p-2 text-xs text-red-700">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
          Cần nhắc lễ tân/Owner theo dõi lịch bù sau buổi nghỉ này.
        </div>
      )}
    </div>
  );
}

function ReportAbsenceDialog({
  target,
  reason,
  busy,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  target: NonNullable<ReportTarget>;
  reason: string;
  busy: boolean;
  onReasonChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Báo nghỉ ca học</h3>
            <p className="mt-1 text-sm text-slate-500">
              {WEEKDAY_LABELS[target.weekday as 0]} {formatDate(target.date)} · {target.hour}:00-
              {target.hour + 1}:00
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <GraduationCap className="size-4" />
            {target.students.length} học viên ca này sẽ nhận thông báo nghỉ qua app.
          </div>
          <div className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            Sau khi báo nghỉ, màn HLV chỉ hiện nhắc nội bộ để follow-up lịch bù. App không tự tạo lịch bù hay đề xuất ca thay thế.
          </div>
        </div>

        <label className="mt-4 block text-xs font-semibold text-slate-600">
          Lý do (không bắt buộc)
        </label>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Ví dụ: nghỉ đột xuất, bận việc gia đình..."
          rows={2}
          maxLength={200}
          className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-brand-500"
        />

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Đang gửi..." : "Xác nhận báo nghỉ"}
          </button>
        </div>
      </div>
    </div>
  );
}
