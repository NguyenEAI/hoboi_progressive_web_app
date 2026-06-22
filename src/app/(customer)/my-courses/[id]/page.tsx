"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { SWIM_STYLES, WEEKDAY_LABELS } from "@/lib/constants";
import { formatDate, daysUntil, toDate } from "@/lib/utils";
import type { Enrollment, CoachSlot, Coach, Attendance } from "@/types";
import { ArrowLeft, MessageCircle, Calendar, Clock, User2, GraduationCap } from "lucide-react";

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

export default function MyCourseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { profile } = useAuthUser();
  const [e, setE] = useState<Enrollment | null>(null);
  const [slot, setSlot] = useState<CoachSlot | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!params?.id || !profile) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "enrollments", params.id));
        if (!snap.exists()) { setError("Không tìm thấy khóa học"); setLoading(false); return; }
        const data = { id: snap.id, ...snap.data() } as Enrollment;
        // Kiểm tra quyền truy cập: phải là chủ enrollment hoặc parent
        if (data.studentId !== profile.id && data.parentId !== profile.id) {
          setError("Bạn không có quyền xem khóa học này");
          setLoading(false); return;
        }
        setE(data);
        const [slotSnap, coachSnap, attSnap] = await Promise.all([
          getDoc(doc(db, `coaches/${data.coachId}/slots/${data.slotId}`)),
          getDoc(doc(db, `coaches/${data.coachId}`)),
          getDocs(query(collection(db, `enrollments/${data.id}/attendances`), orderBy("date", "desc"), limit(15))),
        ]);
        if (slotSnap.exists()) setSlot(slotSnap.data() as CoachSlot);
        if (coachSnap.exists()) setCoach(coachSnap.data() as Coach);
        setAttendances(attSnap.docs.map((d) => ({ ...(d.data() as Attendance) })));
      } catch (err) {
        setError((err as Error).message);
      } finally { setLoading(false); }
    })();
  }, [params?.id, profile]);

  if (loading) return <main className="p-6 text-center text-slate-400">Đang tải…</main>;
  if (error) return (
    <main className="p-6 text-center">
      <p className="text-red-600">{error}</p>
      <button onClick={() => router.back()} className="mt-3 rounded-lg bg-slate-100 px-4 py-2 text-sm">Quay lại</button>
    </main>
  );
  if (!e) return null;

  const style = SWIM_STYLES.find((s) => s.id === e.swimStyle);
  const attended = e.attendedSessions ?? 0;
  const remaining = e.totalSessions - attended;
  const daysLeft = daysUntil(e.expiryDate);
  const progress = Math.round((attended / e.totalSessions) * 100);
  const zaloHref = coach?.phone ? `https://zalo.me/${coach.phone.replace(/\D/g, "")}` : null;

  return (
    <main className="mx-auto max-w-md pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white/95 px-4 py-3 backdrop-blur">
        <button onClick={() => router.back()} aria-label="Quay lại" className="-ml-1 rounded-lg p-1.5 hover:bg-slate-100">
          <ArrowLeft className="size-5 text-slate-700" />
        </button>
        <h1 className="text-base font-bold text-brand-800">Chi tiết khóa học</h1>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-500 to-brand-700 px-5 py-6 text-white">
        <div className="flex items-start gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white/20 text-4xl backdrop-blur">
            {style?.emoji ?? "🏊"}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-extrabold">{style?.label}</h2>
            <p className="text-xs opacity-90">Mã thẻ: {e.memberCode}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[e.status]}`}>
            {STATUS_LABEL[e.status]}
          </span>
        </div>

        {/* Tiến độ */}
        <div className="mt-5">
          <div className="flex justify-between text-xs opacity-90">
            <span>{attended}/{e.totalSessions} buổi</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      {/* Cảnh báo */}
      {e.status === "ACTIVE" && (daysLeft <= 7 || remaining <= 3) && (
        <div className="m-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ <b>Sắp hết</b>: {daysLeft <= 7 ? `còn ${Math.max(0, daysLeft)} ngày` : `còn ${remaining} buổi`}.
          Theo quy định, buổi chưa học sẽ <b>mất sau 90 ngày</b> không bảo lưu.
        </div>
      )}
      {e.status === "EXPIRED" && (
        <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ⛔ Khóa đã hết hạn sau 90 ngày. Đã học {attended}/{e.totalSessions} buổi. Số buổi còn lại không được bảo lưu.
        </div>
      )}
      {e.status === "COMPLETED" && (
        <div className="m-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          🎉 Chúc mừng đã hoàn thành 15/15 buổi! Cùng thử kiểu bơi khác nhé.
        </div>
      )}

      {/* Thông tin chi tiết */}
      <section className="mx-4 mt-2 space-y-2 rounded-2xl border border-slate-100 bg-white p-4">
        <InfoRow icon={<User2 className="size-4" />} label="Người học"
          value={`${e.studentName}${e.studentKind === "CHILD" ? " (con của bạn)" : ""}`} />
        <InfoRow icon={<GraduationCap className="size-4" />} label="HLV" value={e.coachName} />
        {slot && (
          <InfoRow icon={<Clock className="size-4" />} label="Lịch học"
            value={`${WEEKDAY_LABELS[slot.weekday as 0]} · ${slot.startHour}h–${slot.endHour}h`} />
        )}
        <InfoRow icon={<Calendar className="size-4" />} label="Bắt đầu" value={formatDate(e.startDate)} />
        <InfoRow icon={<Calendar className="size-4" />} label="Hết hạn"
          value={`${formatDate(e.expiryDate)}${e.status === "ACTIVE" && daysLeft > 0 ? ` (còn ${daysLeft} ngày)` : ""}`} />
      </section>

      {/* Zalo CTA */}
      {zaloHref && e.status === "ACTIVE" && (
        <a href={zaloHref} target="_blank" rel="noreferrer"
          className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#0068FF] py-3 text-sm font-bold text-white">
          <MessageCircle className="size-4" /> Nhắn Zalo HLV {coach?.fullName}
        </a>
      )}

      {/* Lịch sử buổi học */}
      <section className="mx-4 mt-4 rounded-2xl border border-slate-100 bg-white p-4">
        <h3 className="mb-2 text-sm font-bold text-slate-700">Lịch sử buổi học ({attendances.length})</h3>
        {!attendances.length ? (
          <p className="text-xs text-slate-400">Chưa có buổi học nào được điểm danh.</p>
        ) : (
          <ul className="divide-y">
            {attendances.map((a, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-slate-700">
                  {toDate(a.date).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.source === "QR" ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>
                  {a.source === "QR" ? "QR cổng" : "Lễ tân"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 px-4 text-center text-[11px] text-slate-400">
        Số buổi tự cập nhật khi check-in QR đúng ca. Mọi thắc mắc liên hệ lễ tân.
      </p>

      {(e.status === "EXPIRED" || e.status === "COMPLETED") && (
        <Link href="/services/course"
          className="mx-4 mt-4 block rounded-xl bg-brand-600 py-3 text-center text-sm font-semibold text-white">
          Đăng ký khóa mới
        </Link>
      )}
    </main>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-slate-500">{icon} {label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}
