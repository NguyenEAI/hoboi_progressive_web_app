"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { SWIM_STYLES, WEEKDAY_LABELS } from "@/lib/constants";
import { toDate, daysUntil, formatDate } from "@/lib/utils";
import type { Enrollment, CoachSlot } from "@/types";
import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { BackButton } from "@/components/BackButton";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  EXPIRED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-red-100 text-red-700",
  PENDING: "bg-amber-100 text-amber-700",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang học", COMPLETED: "Hoàn thành",
  EXPIRED: "Hết hạn", CANCELLED: "Đã hủy", PENDING: "Chờ kích hoạt",
};

type EnrollWithSlot = Enrollment & { _slot?: CoachSlot };

export default function MyCoursesPage() {
  const { profile } = useAuthUser();
  const [items, setItems] = useState<EnrollWithSlot[]>([]);
  const [tab, setTab] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const [self, kids] = await Promise.all([
        getDocs(query(collection(db, "enrollments"), where("studentId", "==", profile.id))),
        getDocs(query(collection(db, "enrollments"), where("parentId", "==", profile.id))),
      ]);
      const map = new Map<string, EnrollWithSlot>();
      [...self.docs, ...kids.docs].forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as EnrollWithSlot));
      const list = [...map.values()];
      // Đọc slot cho mỗi enrollment để hiển thị weekday/giờ
      await Promise.all(list.map(async (e) => {
        if (!e.coachId || !e.slotId) return;
        const s = await getDoc(doc(db, `coaches/${e.coachId}/slots/${e.slotId}`));
        if (s.exists()) e._slot = s.data() as CoachSlot;
      }));
      // Sort: ACTIVE first (gần hết hạn lên đầu), rồi đến trạng thái khác
      list.sort((a, b) => {
        const rank = (s: string) => s === "ACTIVE" ? 0 : s === "COMPLETED" ? 1 : 2;
        if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
        return toDate(a.expiryDate).getTime() - toDate(b.expiryDate).getTime();
      });
      setItems(list);
      setLoading(false);
    })();
  }, [profile]);

  const filtered = useMemo(() =>
    tab === "ACTIVE" ? items.filter((e) => e.status === "ACTIVE") : items, [items, tab]);

  return (
    <main className="mx-auto max-w-md pb-24">
      <header className="border-b bg-white px-3 py-3">
        <div className="flex items-center gap-1">
          <BackButton fallback="/home" />
          <h1 className="text-xl font-bold text-brand-800 flex items-center gap-2">
            <BookOpen className="size-5" /> Khóa học của tôi
          </h1>
        </div>
        <p className="ml-12 -mt-1 text-xs text-slate-500">Theo dõi tiến độ, ngày hết hạn và lịch sử buổi học</p>
        <div className="mt-3 flex gap-2">
          {(["ACTIVE", "ALL"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-full px-4 py-1 text-xs font-semibold ${tab === k ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
              {k === "ACTIVE" ? "Đang học" : "Tất cả"}
            </button>
          ))}
          <span className="ml-auto self-center text-xs text-slate-400">{filtered.length} khóa</span>
        </div>
      </header>

      <div className="space-y-3 p-4">
        {loading && <p className="text-center text-sm text-slate-400">Đang tải…</p>}
        {!loading && !filtered.length && (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
            <Sparkles className="mx-auto size-8 text-brand-400" />
            <p className="mt-2 text-sm text-slate-500">Chưa có khóa học nào</p>
            <Link href="/services/course" className="mt-3 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
              Đăng ký khóa mới
            </Link>
          </div>
        )}
        {filtered.map((e) => <CourseCard key={e.id} e={e} />)}
      </div>
    </main>
  );
}

function CourseCard({ e }: { e: EnrollWithSlot }) {
  const style = SWIM_STYLES.find((s) => s.id === e.swimStyle);
  const remaining = e.totalSessions - (e.attendedSessions ?? 0);
  const daysLeft = daysUntil(e.expiryDate);
  const progress = Math.round(((e.attendedSessions ?? 0) / e.totalSessions) * 100);
  const slot = e._slot;
  const isChild = e.studentKind === "CHILD";

  return (
    <Link href={`/my-courses/${e.id}`}
      className="block rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-3xl">
          {style?.emoji ?? "🏊"}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800">{style?.label ?? "Khóa bơi"}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[e.status]}`}>
              {STATUS_LABEL[e.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {e.studentName} {isChild && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">Con</span>}
            {" · "}HLV {e.coachName}
          </p>
          {slot && (
            <p className="mt-0.5 text-xs text-slate-600">
              {WEEKDAY_LABELS[slot.weekday as 0]} · {slot.startHour}h–{slot.endHour}h
            </p>
          )}
        </div>
        <ChevronRight className="size-4 text-slate-300" />
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
          <span>{e.attendedSessions ?? 0}/{e.totalSessions} buổi</span>
          {e.status === "ACTIVE" && (
            <span className={daysLeft <= 7 ? "font-semibold text-red-600" : daysLeft <= 14 ? "font-semibold text-amber-600" : ""}>
              {daysLeft > 0 ? `Còn ${daysLeft} ngày` : `Hết hạn ${formatDate(e.expiryDate)}`}
            </span>
          )}
          {e.status === "COMPLETED" && <span className="text-emerald-600 font-semibold">Hoàn thành 🎉</span>}
          {e.status === "EXPIRED" && <span className="text-slate-500">Đã hết hạn</span>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${e.status === "COMPLETED" ? "bg-emerald-500" : e.status === "EXPIRED" ? "bg-slate-300" : "bg-brand-500"}`}
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      {e.status === "ACTIVE" && remaining <= 5 && remaining > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
          ⚠️ Sắp hết khóa — còn {remaining} buổi
        </p>
      )}
    </Link>
  );
}
