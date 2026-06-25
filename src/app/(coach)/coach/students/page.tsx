"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCoach, zaloLink } from "@/lib/hooks/useCoach";
import { SWIM_STYLES, WEEKDAY_LABELS } from "@/lib/constants";
import type { Attendance, Enrollment } from "@/types";
import { addCoachNote } from "@/lib/callable";
import { useToast } from "@/components/Toast";
import { formatDate, toDate } from "@/lib/utils";
import {
  countConsecutiveAbsences,
  expectedSessionDates,
  isoDateKey,
  parseSlotId,
} from "@/lib/coachUtils";
import { X, MessageSquare, AlertCircle, ChevronRight } from "lucide-react";

const styleEmoji = (s: string) => SWIM_STYLES.find((x) => x.id === s)?.emoji ?? "🏊";

type EnrollmentWithMeta = Enrollment & {
  consecutiveAbsences: number;
  attendances: Attendance[];
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

  useEffect(() => {
    if (!coach) return;
    (async () => {
      const s = await getDocs(
        query(
          collection(db, "enrollments"),
          where("coachId", "==", coach.id),
          where("status", "==", "ACTIVE"),
        ),
      );
      const baseList = s.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));

      // Load attendances + tính vắng liên tiếp cho mỗi HV
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
              attendances
                .filter((a) => a.present)
                .map((a) => isoDateKey(toDate(a.date))),
            );
            const expected = expectedSessionDates(
              e.startDate,
              slotInfo.weekday,
              now,
              e.totalSessions ?? 15,
            );
            consecutive = countConsecutiveAbsences(expected, attendedKeys);
          }
          return { ...e, consecutiveAbsences: consecutive, attendances };
        }),
      );
      setEnrolls(withMeta);

      // Load SĐT phụ huynh cho Zalo deeplink
      const map: Record<string, string> = {};
      await Promise.all(
        [...new Set(withMeta.map((e) => e.parentId).filter(Boolean))].map(async (pid) => {
          const u = await getDoc(doc(db, `users/${pid}`));
          if (u.exists()) map[pid as string] = (u.data().phone as string) ?? "";
        }),
      );
      setPhones(map);
    })();
  }, [coach]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    const sorted = [...enrolls].sort(
      (a, b) => b.consecutiveAbsences - a.consecutiveAbsences,
    );
    return k ? sorted.filter((e) => e.studentName.toLowerCase().includes(k)) : sorted;
  }, [enrolls, kw]);

  async function saveNote() {
    if (!selected) return;
    const t = newNote.trim();
    if (!t) return;
    setSavingNote(true);
    try {
      await addCoachNote({ enrollmentId: selected.id, text: t });
      toast.show("Đã lưu ghi chú", "success");
      // Cập nhật local state để hiển thị ngay
      const newNoteObj = { text: t, at: new Date() };
      setSelected((prev) =>
        prev
          ? { ...prev, coachNotes: [...(prev.coachNotes ?? []), newNoteObj] }
          : prev,
      );
      setEnrolls((prev) =>
        prev.map((e) =>
          e.id === selected.id
            ? { ...e, coachNotes: [...(e.coachNotes ?? []), newNoteObj] }
            : e,
        ),
      );
      setNewNote("");
    } catch (e) {
      toast.show("Lưu thất bại: " + (e as Error).message, "error");
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) return <main className="p-6 text-slate-500">Đang tải…</main>;
  if (!coach) return <main className="p-6 text-slate-500">Tài khoản chưa được gán làm HLV.</main>;

  return (
    <main>
      <header className="border-b bg-white px-5 py-4">
        <h1 className="text-xl font-bold text-brand-700">Học viên của tôi</h1>
        <p className="text-xs text-slate-500">
          {enrolls.length} đang học · tap để xem chi tiết, ghi chú
        </p>
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="🔍 Tìm theo tên"
          className="mt-2 w-full rounded-xl border-2 border-slate-200 p-2 text-sm"
        />
      </header>

      <div className="divide-y">
        {filtered.map((e) => {
          const slotInfo = parseSlotId(e.slotId);
          const hour = slotInfo?.startHour ?? 0;
          const wdLabel = slotInfo ? WEEKDAY_LABELS[slotInfo.weekday as 0] : "?";
          const phone = e.parentId ? phones[e.parentId] : "";
          const absent = e.consecutiveAbsences;
          return (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-brand-100 text-lg">
                {styleEmoji(e.swimStyle)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{e.studentName}</span>
                  {absent >= 3 && (
                    <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                      <AlertCircle className="size-3" /> Vắng {absent}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {wdLabel} {hour}:00 · {e.attendedSessions ?? 0}/{e.totalSessions} buổi
                </div>
              </div>
              {phone && (
                <a
                  onClick={(ev) => ev.stopPropagation()}
                  href={zaloLink(
                    phone,
                    `Chào phụ huynh, tôi là ${coach.fullName} (Hồ Bơi Prosper Plaza). `,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[#0068FF] px-3 py-1.5 text-xs font-bold text-white"
                >
                  💬 Zalo
                </a>
              )}
              <ChevronRight className="size-4 text-slate-400" />
            </button>
          );
        })}
        {!filtered.length && (
          <p className="p-8 text-center text-slate-400">Chưa có học viên</p>
        )}
      </div>

      {/* Bottom sheet chi tiết HV */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-md animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-5 shadow-elevated sm:max-h-[80vh] sm:rounded-3xl sm:mb-6"
            onClick={(ev) => ev.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-2xl">
                  {styleEmoji(selected.swimStyle)}
                </div>
                <div>
                  <div className="font-bold text-slate-800">{selected.studentName}</div>
                  <div className="text-xs text-slate-500">
                    MS{selected.memberCode} · {selected.attendedSessions ?? 0}/
                    {selected.totalSessions} buổi
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            {selected.consecutiveAbsences >= 3 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="size-4 flex-shrink-0" />
                <span>
                  HV vắng <b>{selected.consecutiveAbsences}</b> buổi liên tiếp gần đây — nên
                  liên hệ phụ huynh.
                </span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <Info label="Kiểu bơi" value={
                SWIM_STYLES.find((x) => x.id === selected.swimStyle)?.label ?? selected.swimStyle
              } />
              <Info label="Ngày bắt đầu" value={formatDate(selected.startDate)} />
              <Info label="Hết hạn" value={formatDate(selected.expiryDate)} />
              <Info
                label="Lịch học"
                value={(() => {
                  const slot = parseSlotId(selected.slotId);
                  return slot
                    ? `${WEEKDAY_LABELS[slot.weekday as 0]} · ${slot.startHour}h`
                    : "—";
                })()}
              />
            </div>

            {/* Lịch sử buổi học */}
            <section className="mt-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Lịch sử buổi học (gần đây)
              </h3>
              {selected.attendances.length > 0 ? (
                <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-100">
                  <ul className="divide-y divide-slate-50">
                    {selected.attendances.slice(0, 10).map((a, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between px-3 py-2 text-xs"
                      >
                        <span className="text-slate-700">
                          {formatDate(a.date)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            a.present
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {a.present ? "Có mặt" : "Vắng"} ·{" "}
                          {a.source === "STAFF" ? "Lễ tân" : "QR"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-xs text-slate-400">Chưa có buổi nào</div>
              )}
            </section>

            {/* Ghi chú */}
            <section className="mt-5">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                <MessageSquare className="size-3.5" />
                Ghi chú của HLV ({selected.coachNotes?.length ?? 0})
              </h3>
              {(selected.coachNotes ?? []).length > 0 && (
                <ul className="mb-3 max-h-40 space-y-2 overflow-y-auto">
                  {[...(selected.coachNotes ?? [])]
                    .sort((a, b) => {
                      const ta = toDate(a.at).getTime();
                      const tb = toDate(b.at).getTime();
                      return tb - ta;
                    })
                    .map((n, i) => (
                      <li
                        key={i}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-2.5"
                      >
                        <p className="text-sm text-slate-700">{n.text}</p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {formatDate(n.at)}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
              <textarea
                value={newNote}
                onChange={(ev) => setNewNote(ev.target.value)}
                placeholder="VD: HV tiến bộ tốt, đã biết thở..."
                maxLength={500}
                rows={2}
                className="w-full rounded-xl border-2 border-slate-200 p-2 text-sm"
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {newNote.length}/500
                </span>
                <button
                  onClick={saveNote}
                  disabled={!newNote.trim() || savingNote}
                  className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {savingNote ? "Đang lưu..." : "Thêm ghi chú"}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}
