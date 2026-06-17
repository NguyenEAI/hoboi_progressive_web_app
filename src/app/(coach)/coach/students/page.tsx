"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCoach, zaloLink } from "@/lib/hooks/useCoach";
import { SWIM_STYLES } from "@/lib/constants";
import type { Enrollment } from "@/types";

const styleEmoji = (s: string) => SWIM_STYLES.find((x) => x.id === s)?.emoji ?? "🏊";

export default function CoachStudentsPage() {
  const { coach, loading } = useCoach();
  const [enrolls, setEnrolls] = useState<Enrollment[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [kw, setKw] = useState("");

  useEffect(() => {
    if (!coach) return;
    getDocs(query(collection(db, "enrollments"), where("coachId", "==", coach.id), where("status", "==", "ACTIVE")))
      .then(async (s) => {
        const list = s.docs.map((d) => d.data() as Enrollment);
        setEnrolls(list);
        // lấy SĐT phụ huynh để nhắn Zalo
        const map: Record<string, string> = {};
        await Promise.all([...new Set(list.map((e) => e.parentId).filter(Boolean))].map(async (pid) => {
          const u = await getDoc(doc(db, `users/${pid}`));
          if (u.exists()) map[pid as string] = (u.data().phone as string) ?? "";
        }));
        setPhones(map);
      });
  }, [coach]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return k ? enrolls.filter((e) => e.studentName.toLowerCase().includes(k)) : enrolls;
  }, [enrolls, kw]);

  if (loading) return <main className="p-6 text-slate-500">Đang tải…</main>;
  if (!coach) return <main className="p-6 text-slate-500">Tài khoản chưa được gán làm HLV.</main>;

  return (
    <main>
      <header className="border-b bg-white px-5 py-4">
        <h1 className="text-xl font-bold text-brand-700">Học viên của tôi</h1>
        <p className="text-xs text-slate-500">{enrolls.length} đang học</p>
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="🔍 Tìm theo tên"
          className="mt-2 w-full rounded-xl border-2 border-slate-200 p-2 text-sm" />
      </header>

      <div className="divide-y">
        {filtered.map((e) => {
          const hour = e.slotId.split("_")[2];
          const phone = e.parentId ? phones[e.parentId] : "";
          return (
            <div key={e.id} className="flex items-center gap-3 p-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-brand-100 text-lg">{styleEmoji(e.swimStyle)}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{e.studentName}</div>
                <div className="text-[11px] text-slate-500">{hour}:00 · {e.attendedSessions}/{e.totalSessions} buổi</div>
              </div>
              {phone && (
                <a href={zaloLink(phone, `Chào phụ huynh, tôi là ${coach.fullName} (Hồ Bơi Prosper Plaza). `)}
                  target="_blank" rel="noreferrer"
                  className="rounded-lg bg-[#0068FF] px-3 py-1.5 text-xs font-bold text-white">💬 Zalo</a>
              )}
            </div>
          );
        })}
        {!filtered.length && <p className="p-8 text-center text-slate-400">Chưa có học viên</p>}
      </div>
    </main>
  );
}
