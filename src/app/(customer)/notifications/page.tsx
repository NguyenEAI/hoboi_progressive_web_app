"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Notification } from "@/types";
import { formatDate } from "@/lib/utils";
import { BackButton } from "@/components/BackButton";

const ICONS: Record<string, string> = {
  CHILD_ATTENDED: "🎓", COURSE_REMAINING: "🎯", EXPIRY_WARNING: "⏰",
  COURSE_COMPLETED: "🎉", COURSE_EXPIRED: "📋", SERVICE_ACTIVATED: "✅",
  PENDING_PAYMENT: "💳", COACH_OFF: "🏊", GENERAL: "🔔",
};

export default function NotificationsPage() {
  const { profile } = useAuthUser();
  const [items, setItems] = useState<(Notification & { _id: string })[]>([]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, `users/${profile.id}/notifications`), orderBy("createdAt", "desc"));
    return onSnapshot(q, (s) => setItems(s.docs.map((d) => ({ _id: d.id, ...d.data() } as Notification & { _id: string }))));
  }, [profile]);

  if (!profile) return <main className="p-6 text-slate-500">Đang tải…</main>;

  return (
    <main className="mx-auto max-w-md">
      <header className="flex items-center gap-2 border-b bg-white px-3 py-3">
        <BackButton fallback="/home" />
        <h1 className="text-xl font-bold text-brand-700">Thông báo</h1>
      </header>
      <div className="divide-y">
        {items.map((n) => (
          <button key={n._id} onClick={() => !n.read && updateDoc(doc(db, `users/${profile.id}/notifications/${n._id}`), { read: true })}
            className={`flex w-full items-start gap-3 p-4 text-left ${n.read ? "" : "bg-brand-50"}`}>
            <span className="text-2xl">{ICONS[n.type] ?? "🔔"}</span>
            <div className="flex-1">
              <div className="font-semibold">{n.title}</div>
              <div className="text-sm text-slate-600">{n.body}</div>
              <div className="mt-1 text-xs text-slate-400">{formatDate(n.createdAt)}</div>
            </div>
            {!n.read && <span className="mt-1 size-2 rounded-full bg-red-500" />}
          </button>
        ))}
        {!items.length && <p className="p-8 text-center text-slate-400">Chưa có thông báo</p>}
      </div>
    </main>
  );
}
