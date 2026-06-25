"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCoach } from "@/lib/hooks/useCoach";
import { Logo } from "@/components/Logo";
import { WEEKDAY_LABELS, SLOT_START_HOURS, SLOT_CAPACITY } from "@/lib/constants";
import type { Enrollment, CoachAbsence } from "@/types";
import { reportCoachAbsence } from "@/lib/callable";
import { useToast } from "@/components/Toast";
import { Bell, BellOff, X } from "lucide-react";

// v2.4 (E4/INV-18) — HLV báo nghỉ ca: tap nút trên slot → confirm → push HV ca đó.

export default function CoachTodayPage() {
  const { coach, loading } = useCoach();
  const toast = useToast();
  const [enrolls, setEnrolls] = useState<Enrollment[]>([]);
  const [absences, setAbsences] = useState<CoachAbsence[]>([]);
  const [reportingHour, setReportingHour] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const today = useMemo(() => new Date(), []);
  const weekday = today.getDay();
  const dateKey = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  }, [today]);

  useEffect(() => {
    if (!coach) return;
    getDocs(
      query(
        collection(db, "enrollments"),
        where("coachId", "==", coach.id),
        where("status", "==", "ACTIVE"),
      ),
    ).then((s) => setEnrolls(s.docs.map((d) => d.data() as Enrollment)));
    getDocs(collection(db, `coaches/${coach.id}/absences`)).then((s) =>
      setAbsences(s.docs.map((d) => ({ id: d.id, ...d.data() } as CoachAbsence))),
    );
  }, [coach]);

  async function refreshAbsences() {
    if (!coach) return;
    const s = await getDocs(collection(db, `coaches/${coach.id}/absences`));
    setAbsences(s.docs.map((d) => ({ id: d.id, ...d.data() } as CoachAbsence)));
  }

  async function confirmReport() {
    if (!coach || reportingHour == null) return;
    setBusy(true);
    try {
      const res = await reportCoachAbsence({
        coachId: coach.id,
        date: dateKey,
        startHour: reportingHour,
        reason: reason.trim() || undefined,
      });
      toast.show(
        `Đã báo nghỉ ca ${reportingHour}h. ${res.notified} HV đã nhận thông báo.`,
        "success",
      );
      setReportingHour(null);
      setReason("");
      await refreshAbsences();
    } catch (e) {
      toast.show("Báo nghỉ thất bại: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const teachesToday = coach?.weekdays.includes(weekday as 0);
  const countBySlotHour = useMemo(() => {
    const m = new Map<number, number>();
    enrolls.forEach((e) => {
      const hour = Number(e.slotId.split("_")[2]);
      if (Number.isInteger(hour)) m.set(hour, (m.get(hour) ?? 0) + 1);
    });
    return m;
  }, [enrolls]);

  // Map todayHour → absence doc (nếu có)
  const absentByHour = useMemo(() => {
    const m = new Map<number, CoachAbsence>();
    for (const a of absences) if (a.date === dateKey) m.set(a.startHour, a);
    return m;
  }, [absences, dateKey]);

  if (loading) return <main className="p-6 text-slate-500">Đang tải…</main>;
  if (!coach) return <main className="p-6 text-slate-500">Tài khoản này chưa được gán làm HLV.</main>;

  const morning = SLOT_START_HOURS.filter((h) => h < 12);
  const afternoon = SLOT_START_HOURS.filter((h) => h >= 12);

  return (
    <main>
      <header className="bg-gradient-to-r from-emerald-700 to-brand-600 px-5 py-5 text-white">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <div className="text-[10px] uppercase opacity-80">
              Hôm nay · {WEEKDAY_LABELS[weekday as 0]}
            </div>
            <div className="text-lg font-bold">{coach.fullName}</div>
          </div>
        </div>
        <div className="mt-2 text-xs opacity-80">{enrolls.length} học viên đang theo học</div>
      </header>

      {!teachesToday ? (
        <p className="p-6 text-center text-slate-500">
          Hôm nay bạn không có lịch dạy.<br />
          Lịch: {coach.weekdays.map((w) => WEEKDAY_LABELS[w]).join(" · ")}
        </p>
      ) : (
        <div className="p-3">
          <SlotGroup
            title="Buổi sáng"
            hours={morning}
            counts={countBySlotHour}
            absentByHour={absentByHour}
            onReport={(h) => setReportingHour(h)}
          />
          <SlotGroup
            title="Buổi chiều"
            hours={afternoon}
            counts={countBySlotHour}
            absentByHour={absentByHour}
            onReport={(h) => setReportingHour(h)}
          />
        </div>
      )}

      {/* Dialog báo nghỉ */}
      {reportingHour != null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
          onClick={() => !busy && setReportingHour(null)}
        >
          <div
            className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-5 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Báo nghỉ ca học</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Ca {reportingHour}h–{reportingHour + 1}h · {WEEKDAY_LABELS[weekday as 0]} {dateKey}
                </p>
              </div>
              <button
                onClick={() => !busy && setReportingHour(null)}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <b>{countBySlotHour.get(reportingHour) ?? 0}</b> học viên ca này sẽ nhận thông báo nghỉ qua app.
            </div>

            <label className="mt-4 block text-xs font-semibold text-slate-600">
              Lý do (không bắt buộc)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Ốm đột xuất, kẹt xe..."
              rows={2}
              maxLength={200}
              className="mt-1 w-full rounded-xl border-2 border-slate-200 p-2 text-sm"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setReportingHour(null)}
                disabled={busy}
                className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Hủy
              </button>
              <button
                onClick={confirmReport}
                disabled={busy}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Đang gửi..." : "Xác nhận báo nghỉ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SlotGroup({
  title,
  hours,
  counts,
  absentByHour,
  onReport,
}: {
  title: string;
  hours: readonly number[];
  counts: Map<number, number>;
  absentByHour: Map<number, unknown>;
  onReport: (hour: number) => void;
}) {
  return (
    <>
      <div className="px-1 pb-2 pt-3 text-xs font-semibold uppercase text-slate-500">{title}</div>
      <div className="space-y-2">
        {hours.map((h) => {
          const n = counts.get(h) ?? 0;
          const reported = absentByHour.has(h);
          return (
            <div
              key={h}
              className={`flex items-center justify-between rounded-xl p-3 shadow-sm ${
                reported ? "bg-red-50 border border-red-200" : "bg-white"
              }`}
            >
              <div>
                <div className="text-sm font-semibold">
                  {h}:00 – {h + 1}:00
                </div>
                <div className="text-[11px] text-slate-500">
                  {n}/{SLOT_CAPACITY} học viên
                </div>
              </div>
              <div className="flex items-center gap-2">
                {n >= SLOT_CAPACITY && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                    Đầy
                  </span>
                )}
                {reported ? (
                  <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                    <BellOff className="size-3" /> Đã báo nghỉ
                  </span>
                ) : n > 0 ? (
                  <button
                    onClick={() => onReport(h)}
                    className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Bell className="size-3" /> Báo nghỉ
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
