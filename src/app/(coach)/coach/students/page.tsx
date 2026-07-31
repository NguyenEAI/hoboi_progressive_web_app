"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import {
  AlertCircle,
  CalendarClock,
  ChevronRight,
  Clock3,
  Eye,
  MessageSquare,
  Phone,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useCoach, zaloLink } from "@/lib/hooks/useCoach";
import { SWIM_STYLES, WEEKDAY_LABELS } from "@/lib/constants";
import type { Attendance, Enrollment } from "@/types";
import { addCoachNote } from "@/lib/callable";
import { useToast } from "@/components/Toast";
import { cn, daysUntil, formatDate, toDate } from "@/lib/utils";
import {
  countConsecutiveAbsences,
  expectedSessionDates,
  isoDateKey,
  parseSlotId,
} from "@/lib/coachUtils";

const styleEmoji = (s: string) => SWIM_STYLES.find((x) => x.id === s)?.emoji ?? "🏊";

type EnrollmentWithMeta = Enrollment & {
  consecutiveAbsences: number;
  attendances: Attendance[];
  expiryDays: number;
  remainingSessions: number;
};

export default function CoachStudentsPage() {
  const { coach, loading } = useCoach();
  const toast = useToast();
  const [enrolls, setEnrolls] = useState<EnrollmentWithMeta[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [kw, setKw] = useState("");
  const [selected, setSelected] = useState<EnrollmentWithMeta | null>(null);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    if (!coach) return;
    let alive = true;
    setDataLoading(true);

    (async () => {
      const s = await getDocs(
        query(
          collection(db, "enrollments"),
          where("coachId", "==", coach.id),
          where("status", "==", "ACTIVE"),
        ),
      );
      const baseList = s.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));

      const now = new Date();
      const withMeta = await Promise.all(
        baseList.map(async (e) => {
          const attSnap = await getDocs(
            query(
              collection(db, `enrollments/${e.id}/attendances`),
              orderBy("date", "desc"),
            ),
          );
          const attendances = attSnap.docs.map((d) => d.data() as Attendance);
          const slotInfo = parseSlotId(e.slotId);
          let consecutive = 0;
          if (slotInfo) {
            const attendedKeys = new Set(
              attendances.filter((a) => a.present).map((a) => isoDateKey(toDate(a.date))),
            );
            const expected = expectedSessionDates(
              e.startDate,
              slotInfo.weekday,
              now,
              e.totalSessions ?? 15,
            );
            consecutive = countConsecutiveAbsences(expected, attendedKeys);
          }
          return {
            ...e,
            consecutiveAbsences: consecutive,
            attendances,
            expiryDays: daysUntil(e.expiryDate),
            remainingSessions: Math.max(0, (e.totalSessions ?? 15) - (e.attendedSessions ?? 0)),
          };
        }),
      );

      const phoneMap: Record<string, string> = {};
      await Promise.all(
        [...new Set(withMeta.map((e) => e.parentId).filter(Boolean))].map(async (pid) => {
          const u = await getDoc(doc(db, `users/${pid}`));
          if (u.exists()) phoneMap[pid as string] = (u.data().phone as string) ?? "";
        }),
      );

      if (!alive) return;
      setEnrolls(withMeta);
      setPhones(phoneMap);
      setDataLoading(false);
    })().catch((e) => {
      if (!alive) return;
      toast.show("Không tải được danh sách học viên: " + (e as Error).message, "error");
      setDataLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [coach]);

  useEffect(() => {
    if (deepLinkHandled || !enrolls.length || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const studentId = params.get("student");
    if (q) setKw(q);
    if (studentId) {
      const target = enrolls.find((e) => e.id === studentId);
      if (target) setSelected(target);
    }
    setDeepLinkHandled(true);
  }, [deepLinkHandled, enrolls]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    const sorted = [...enrolls].sort(
      (a, b) =>
        b.consecutiveAbsences - a.consecutiveAbsences ||
        a.remainingSessions - b.remainingSessions ||
        a.expiryDays - b.expiryDays,
    );
    return k ? sorted.filter((e) => e.studentName.toLowerCase().includes(k)) : sorted;
  }, [enrolls, kw]);

  const absenceCount = enrolls.filter((e) => e.consecutiveAbsences >= 3).length;
  const finishingCount = enrolls.filter(
    (e) =>
      e.remainingSessions <= 3 ||
      (Number.isFinite(e.expiryDays) && e.expiryDays >= 0 && e.expiryDays <= 10),
  ).length;
  const noteCount = enrolls.reduce((sum, e) => sum + (e.coachNotes?.length ?? 0), 0);

  async function saveNote() {
    if (!selected) return;
    const t = newNote.trim();
    if (!t) return;
    setSavingNote(true);
    try {
      await addCoachNote({ enrollmentId: selected.id, text: t });
      toast.show("Đã lưu ghi chú", "success");
      const newNoteObj = { text: t, at: new Date() };
      setSelected((prev) =>
        prev ? { ...prev, coachNotes: [...(prev.coachNotes ?? []), newNoteObj] } : prev,
      );
      setEnrolls((prev) =>
        prev.map((e) =>
          e.id === selected.id ? { ...e, coachNotes: [...(e.coachNotes ?? []), newNoteObj] } : e,
        ),
      );
      setNewNote("");
    } catch (e) {
      toast.show("Lưu thất bại: " + (e as Error).message, "error");
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) return <main className="p-6 text-slate-500">Đang tải...</main>;
  if (!coach) return <main className="p-6 text-slate-500">Tài khoản chưa được gán làm HLV.</main>;

  return (
    <main className="bg-slate-50">
      <header className="border-b bg-white px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase text-brand-700">Danh sách học viên</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Theo dõi lớp của tôi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Xem tiến độ, lịch sử điểm danh và ghi chú riêng. HLV không thao tác điểm danh trên màn này.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SummaryPill label="Đang học" value={enrolls.length} />
          <SummaryPill label="Vắng nhiều" value={absenceCount} tone={absenceCount ? "red" : "slate"} />
          <SummaryPill label="Gần mốc" value={finishingCount} tone={finishingCount ? "amber" : "slate"} />
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="Tìm theo tên học viên"
            className="w-full rounded-xl border-2 border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
      </header>

      <section className="space-y-3 p-4">
        {dataLoading && (
          <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
            Đang cập nhật học viên, ghi chú và lịch sử điểm danh...
          </div>
        )}

        {!dataLoading && !enrolls.length && (
          <EmptyStudents message="Chưa có học viên ACTIVE nào được gán cho HLV này." />
        )}

        {!dataLoading && enrolls.length > 0 && !filtered.length && (
          <EmptyStudents message="Không tìm thấy học viên khớp từ khóa đang nhập." />
        )}

        {filtered.map((e) => (
          <StudentRow
            key={e.id}
            enrollment={e}
            phone={e.parentId ? phones[e.parentId] : ""}
            coachName={coach.fullName}
            onOpen={() => setSelected(e)}
          />
        ))}

        {!dataLoading && enrolls.length > 0 && (
          <div className="rounded-xl bg-white p-3 text-xs text-slate-500 shadow-sm">
            Tổng {noteCount} ghi chú HLV. Lịch sử điểm danh chỉ phản ánh dữ liệu QR/lễ tân đã ghi nhận.
          </div>
        )}
      </section>

      {selected && (
        <StudentDetailSheet
          enrollment={selected}
          phone={selected.parentId ? phones[selected.parentId] : ""}
          coachName={coach.fullName}
          newNote={newNote}
          savingNote={savingNote}
          onNoteChange={setNewNote}
          onSaveNote={saveNote}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function SummaryPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "amber" | "red";
}) {
  return (
    <div className={cn("rounded-xl px-3 py-2", tone === "red" ? "bg-red-50" : tone === "amber" ? "bg-amber-50" : "bg-slate-50")}>
      <div className={cn("text-lg font-bold", tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-slate-800")}>
        {value}
      </div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

function EmptyStudents({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <UserRound className="mx-auto size-8 text-slate-300" />
      <p className="mt-2 text-sm font-medium text-slate-600">{message}</p>
      <p className="mt-1 text-xs text-slate-400">
        Khi lễ tân/Owner kích hoạt khóa học cho HLV này, danh sách sẽ tự hiện ở đây.
      </p>
    </div>
  );
}

function StudentRow({
  enrollment,
  phone,
  coachName,
  onOpen,
}: {
  enrollment: EnrollmentWithMeta;
  phone: string;
  coachName: string;
  onOpen: () => void;
}) {
  const slotInfo = parseSlotId(enrollment.slotId);
  const hour = slotInfo?.startHour ?? 0;
  const wdLabel = slotInfo ? WEEKDAY_LABELS[slotInfo.weekday as 0] : "?";
  const progress = Math.min(
    100,
    Math.round(((enrollment.attendedSessions ?? 0) / (enrollment.totalSessions || 15)) * 100),
  );

  return (
    <button
      onClick={onOpen}
      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-200 hover:bg-brand-50/30"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl">
          {styleEmoji(enrollment.swimStyle)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">{enrollment.studentName}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock3 className="size-3" />
                  {wdLabel} · {hour}:00
                </span>
                <span>MS{enrollment.memberCode}</span>
              </div>
            </div>
            <ChevronRight className="mt-1 size-4 shrink-0 text-slate-400" />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {enrollment.consecutiveAbsences >= 3 && (
              <Badge tone="red">Vắng {enrollment.consecutiveAbsences} buổi</Badge>
            )}
            {enrollment.remainingSessions <= 3 && <Badge tone="amber">Còn {enrollment.remainingSessions} buổi</Badge>}
            {Number.isFinite(enrollment.expiryDays) && enrollment.expiryDays >= 0 && enrollment.expiryDays <= 10 && (
              <Badge tone="amber">Còn {enrollment.expiryDays} ngày</Badge>
            )}
            {(enrollment.coachNotes?.length ?? 0) > 0 && (
              <Badge tone="slate">{enrollment.coachNotes?.length} ghi chú</Badge>
            )}
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Tiến độ</span>
              <span>
                {enrollment.attendedSessions ?? 0}/{enrollment.totalSessions} buổi
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {phone && (
            <a
              onClick={(ev) => ev.stopPropagation()}
              href={zaloLink(phone, `Chào phụ huynh, tôi là ${coachName} (Hồ Bơi Prosper Plaza). `)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0068FF] px-3 py-1.5 text-xs font-bold text-white"
            >
              <Phone className="size-3.5" />
              Nhắn Zalo
            </a>
          )}
        </div>
      </div>
    </button>
  );
}

function StudentDetailSheet({
  enrollment,
  phone,
  coachName,
  newNote,
  savingNote,
  onNoteChange,
  onSaveNote,
  onClose,
}: {
  enrollment: EnrollmentWithMeta;
  phone: string;
  coachName: string;
  newNote: string;
  savingNote: boolean;
  onNoteChange: (v: string) => void;
  onSaveNote: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-md animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-5 shadow-elevated sm:max-h-[80vh] sm:rounded-3xl sm:mb-6"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">
              {styleEmoji(enrollment.swimStyle)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-900">{enrollment.studentName}</div>
              <div className="text-xs text-slate-500">
                MS{enrollment.memberCode} · {enrollment.attendedSessions ?? 0}/{enrollment.totalSessions} buổi
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        {enrollment.consecutiveAbsences >= 3 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="size-4 flex-shrink-0" />
            <span>
              Học viên vắng <b>{enrollment.consecutiveAbsences}</b> buổi liên tiếp gần đây. Nên liên hệ phụ huynh để nắm tình hình.
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <Info
            label="Kiểu bơi"
            value={SWIM_STYLES.find((x) => x.id === enrollment.swimStyle)?.label ?? enrollment.swimStyle}
          />
          <Info label="Ngày bắt đầu" value={formatDate(enrollment.startDate)} />
          <Info label="Hết hạn" value={formatDate(enrollment.expiryDate)} />
          <Info
            label="Lịch học"
            value={(() => {
              const slot = parseSlotId(enrollment.slotId);
              return slot ? `${WEEKDAY_LABELS[slot.weekday as 0]} · ${slot.startHour}:00` : "—";
            })()}
          />
        </div>

        {phone && (
          <a
            href={zaloLink(phone, `Chào phụ huynh, tôi là ${coachName} (Hồ Bơi Prosper Plaza). `)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#0068FF] px-4 py-2.5 text-sm font-bold text-white"
          >
            <Phone className="size-4" />
            Nhắn phụ huynh qua Zalo
          </a>
        )}

        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500">
            <Eye className="size-3.5" />
            Lịch sử điểm danh (chỉ xem)
          </h3>
          {enrollment.attendances.length > 0 ? (
            <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-100">
              <ul className="divide-y divide-slate-50">
                {enrollment.attendances.slice(0, 10).map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <CalendarClock className="size-3.5 text-slate-400" />
                      {formatDate(a.date)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        a.present ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                      )}
                    >
                      {a.present ? "Có mặt" : "Vắng"} · {a.source === "STAFF" ? "Lễ tân" : "QR"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
              Chưa có lịch sử điểm danh. HLV chỉ xem dữ liệu sau khi khách quét QR hoặc lễ tân điểm danh hộ.
            </div>
          )}
        </section>

        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500">
            <MessageSquare className="size-3.5" />
            Ghi chú của HLV ({enrollment.coachNotes?.length ?? 0})
          </h3>
          {(enrollment.coachNotes ?? []).length > 0 ? (
            <ul className="mb-3 max-h-40 space-y-2 overflow-y-auto">
              {[...(enrollment.coachNotes ?? [])]
                .sort((a, b) => toDate(b.at).getTime() - toDate(a.at).getTime())
                .map((n, i) => (
                  <li key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                    <p className="text-sm text-slate-700">{n.text}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{formatDate(n.at)}</p>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="mb-3 rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
              Chưa có ghi chú. Ghi chú chỉ append, không sửa/xóa từng dòng.
            </div>
          )}
          <textarea
            value={newNote}
            onChange={(ev) => onNoteChange(ev.target.value)}
            placeholder="Ví dụ: đã biết thở nước, cần tập thêm chân..."
            maxLength={500}
            rows={2}
            className="w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-brand-500"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">{newNote.length}/500</span>
            <button
              onClick={onSaveNote}
              disabled={!newNote.trim() || savingNote}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {savingNote ? "Đang lưu..." : "Thêm ghi chú"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "red" | "amber" | "slate" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold",
        tone === "red"
          ? "bg-red-100 text-red-700"
          : tone === "amber"
            ? "bg-amber-100 text-amber-700"
            : "bg-slate-100 text-slate-600",
      )}
    >
      {children}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}
