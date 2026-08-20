"use client";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";

type Toast = {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  time: number;
};

// Hiện pop-up ở góc phải khi khách vừa quét QR / được điểm danh.
// Chỉ hiện các bản ghi tạo SAU khi component mount, để không đổ ào ạt lịch sử.
export function LiveCheckinToast() {
  const { profile } = useAuthUser();
  const isStaff = profile?.role === "OWNER" || profile?.role === "RECEPTIONIST";
  const [toasts, setToasts] = useState<Toast[]>([]);
  const mountedAtRef = useRef<Timestamp>(Timestamp.fromDate(new Date()));
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isStaff) return;
    const q = query(
      collection(db, "checkins"),
      where("at", ">=", mountedAtRef.current),
      where("result", "==", "ACCEPTED"),
      orderBy("at", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach(async (chg) => {
        if (chg.type !== "added") return;
        const cid = chg.doc.id;
        if (seenRef.current.has(cid)) return;
        seenRef.current.add(cid);
        const c = chg.doc.data() as {
          kind?: string;
          refId?: string;
          userId?: string;
          groupSize?: number;
          at?: Timestamp;
        };
        const t = await buildToast(cid, c);
        if (t) setToasts((prev) => [t, ...prev].slice(0, 4));
      });
    });
    return () => unsub();
  }, [isStaff]);

  // Auto-dismiss sau 6 giây
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.slice(0, prev.length - 1));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (!isStaff || toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[60] flex w-[92%] max-w-sm flex-col gap-2 md:right-6 md:top-20">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-brand-200 bg-white p-3 shadow-xl ring-1 ring-brand-100/60 animate-in slide-in-from-right"
        >
          <div className="text-2xl">{t.emoji}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-brand-800">{t.title}</div>
            <div className="mt-0.5 text-xs text-slate-600">{t.detail}</div>
            <div className="mt-1 text-[10px] text-slate-400">
              {new Date(t.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

async function buildToast(
  id: string,
  c: { kind?: string; refId?: string; userId?: string; groupSize?: number; at?: Timestamp },
): Promise<Toast | null> {
  const time = c.at?.toMillis?.() ?? Date.now();
  const group = Math.max(1, Number(c.groupSize ?? 1));

  let customerName = "Khách hàng";
  if (c.userId) {
    try {
      const u = await getDoc(doc(db, "users", c.userId));
      if (u.exists()) customerName = (u.data()?.fullName as string) || (u.data()?.phone as string) || customerName;
    } catch { /* ignore */ }
  }

  if (c.kind === "PACKAGE" && c.refId) {
    try {
      const p = await getDoc(doc(db, "ticketPackages", c.refId));
      if (p.exists()) {
        const d = p.data() as { remainingSessions?: number; totalSessions?: number; memberCode?: string; audience?: string };
        const audLabel = d.audience === "ADULT" ? "Người lớn" : d.audience === "CHILD_UNDER_140" ? "Trẻ <1.4m" : d.audience === "CHILD_OVER_140" ? "Trẻ ≥1.4m" : "";
        return {
          id,
          emoji: "🎟️",
          title: `${customerName} vừa vào cổng`,
          detail: `Trừ ${group} lượt · thẻ ${audLabel ? audLabel + " · " : ""}MS${d.memberCode ?? "?"} · còn ${d.remainingSessions ?? "?"}/${d.totalSessions ?? "?"} lượt`,
          time,
        };
      }
    } catch { /* ignore */ }
  }

  if (c.kind === "MEMBERSHIP" && c.refId) {
    try {
      const m = await getDoc(doc(db, "memberships", c.refId));
      if (m.exists()) {
        const d = m.data() as { memberCode?: string; audience?: string; endDate?: Timestamp };
        const audLabel = d.audience === "ADULT" ? "Người lớn" : d.audience === "CHILD_UNDER_140" ? "Trẻ <1.4m" : d.audience === "CHILD_OVER_140" ? "Trẻ ≥1.4m" : "";
        return {
          id,
          emoji: "🏊",
          title: `${customerName} vừa vào cổng`,
          detail: `Vé thời hạn ${audLabel ? audLabel + " · " : ""}MS${d.memberCode ?? "?"}${d.endDate ? " · HH " + d.endDate.toDate().toLocaleDateString("vi-VN") : ""}`,
          time,
        };
      }
    } catch { /* ignore */ }
  }

  if (c.kind === "COURSE" && c.refId) {
    try {
      const e = await getDoc(doc(db, "enrollments", c.refId));
      if (e.exists()) {
        const d = e.data() as { studentName?: string; attendedSessions?: number; totalSessions?: number; memberCode?: string };
        return {
          id,
          emoji: "📚",
          title: `${customerName} vừa vào lớp học`,
          detail: `${d.studentName ?? customerName} · MS${d.memberCode ?? "?"} · buổi ${(d.attendedSessions ?? 0)}/${d.totalSessions ?? "?"}`,
          time,
        };
      }
    } catch { /* ignore */ }
  }

  return {
    id,
    emoji: "✅",
    title: `${customerName} vừa check-in`,
    detail: "Ghi nhận thành công",
    time,
  };
}
