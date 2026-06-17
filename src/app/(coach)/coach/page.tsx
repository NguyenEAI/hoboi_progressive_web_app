"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCoach } from "@/lib/hooks/useCoach";
import { Logo } from "@/components/Logo";
import { WEEKDAY_LABELS, SLOT_START_HOURS, SLOT_CAPACITY } from "@/lib/constants";
import type { Enrollment } from "@/types";

export default function CoachTodayPage() {
  const { coach, loading } = useCoach();
  const [enrolls, setEnrolls] = useState<Enrollment[]>([]);
  const weekday = new Date().getDay();

  useEffect(() => {
    if (!coach) return;
    getDocs(query(collection(db, "enrollments"), where("coachId", "==", coach.id), where("status", "==", "ACTIVE")))
      .then((s) => setEnrolls(s.docs.map((d) => d.data() as Enrollment)));
  }, [coach]);

  const teachesToday = coach?.weekdays.includes(weekday as 0);
  const countBySlotHour = useMemo(() => {
    const m = new Map<number, number>();
    enrolls.forEach((e) => {
      const hour = Number(e.slotId.split("_")[2]);
      m.set(hour, (m.get(hour) ?? 0) + 1);
    });
    return m;
  }, [enrolls]);

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
            <div className="text-[10px] uppercase opacity-80">Hôm nay · {WEEKDAY_LABELS[weekday as 0]}</div>
            <div className="text-lg font-bold">{coach.fullName}</div>
          </div>
        </div>
        <div className="mt-2 text-xs opacity-80">{enrolls.length} học viên đang theo học</div>
      </header>

      {!teachesToday ? (
        <p className="p-6 text-center text-slate-500">Hôm nay bạn không có lịch dạy.<br />Lịch: {coach.weekdays.map((w) => WEEKDAY_LABELS[w]).join(" · ")}</p>
      ) : (
        <div className="p-3">
          <SlotGroup title="Buổi sáng" hours={morning} counts={countBySlotHour} />
          <SlotGroup title="Buổi chiều" hours={afternoon} counts={countBySlotHour} />
        </div>
      )}
    </main>
  );
}

function SlotGroup({ title, hours, counts }: { title: string; hours: readonly number[]; counts: Map<number, number> }) {
  return (
    <>
      <div className="px-1 pb-2 pt-3 text-xs font-semibold uppercase text-slate-500">{title}</div>
      <div className="space-y-2">
        {hours.map((h) => {
          const n = counts.get(h) ?? 0;
          return (
            <div key={h} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
              <div>
                <div className="text-sm font-semibold">{h}:00 – {h + 1}:00</div>
                <div className="text-[11px] text-slate-500">{n}/{SLOT_CAPACITY} học viên</div>
              </div>
              {n >= SLOT_CAPACITY && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">Đầy</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}
