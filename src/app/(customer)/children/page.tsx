"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Child, Audience } from "@/types";

function audienceFromHeight(cm: number): Audience {
  return cm < 140 ? "CHILD_UNDER_140" : "CHILD_OVER_140";
}

export default function ChildrenPage() {
  const { profile } = useAuthUser();
  const [children, setChildren] = useState<(Child & { _id: string })[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", dob: "", heightCm: "" });

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(collection(db, `users/${profile.id}/children`),
      (s) => setChildren(s.docs.map((d) => ({ _id: d.id, ...d.data() } as Child & { _id: string }))));
  }, [profile]);

  async function add() {
    if (!profile || !form.fullName || !form.heightCm) return;
    const ref = doc(collection(db, `users/${profile.id}/children`));
    const cm = Number(form.heightCm);
    await setDoc(ref, {
      id: ref.id, parentId: profile.id, fullName: form.fullName,
      dob: form.dob ? Timestamp.fromDate(new Date(form.dob)) : Timestamp.now(),
      heightCm: cm, audience: audienceFromHeight(cm),
    });
    setForm({ fullName: "", dob: "", heightCm: "" }); setOpen(false);
  }

  if (!profile) return <main className="p-6 text-slate-500">Đang tải…</main>;

  return (
    <main className="mx-auto max-w-md">
      <header className="flex items-center justify-between border-b bg-white px-5 py-4">
        <h1 className="text-xl font-bold text-brand-700">Con của tôi</h1>
        <button onClick={() => setOpen(!open)} className="rounded-full bg-brand-600 px-4 py-1.5 text-sm text-white">+ Thêm</button>
      </header>

      {open && (
        <div className="space-y-2 border-b bg-brand-50 p-4">
          <input placeholder="Họ tên bé" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full rounded-xl border-2 border-slate-200 p-2.5" />
          <div className="flex gap-2">
            <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })}
              className="flex-1 rounded-xl border-2 border-slate-200 p-2.5" />
            <input type="number" placeholder="Chiều cao (cm)" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
              className="w-36 rounded-xl border-2 border-slate-200 p-2.5" />
          </div>
          <button onClick={add} className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-white">Lưu</button>
        </div>
      )}

      <div className="space-y-3 p-4">
        {children.map((c) => (
          <div key={c._id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-xl">{c.heightCm < 140 ? "🧒" : "🧑"}</div>
            <div className="flex-1">
              <div className="font-semibold">{c.fullName}</div>
              <div className="text-xs text-slate-500">{c.heightCm}cm · {c.heightCm < 140 ? "Trẻ <1.4m" : "Trẻ >1.4m"}</div>
            </div>
          </div>
        ))}
        {!children.length && !open && <p className="p-6 text-center text-slate-400">Chưa có bé nào. Bấm "+ Thêm".</p>}
      </div>
    </main>
  );
}
