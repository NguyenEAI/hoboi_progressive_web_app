"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Child } from "@/types";
import { BackButton } from "@/components/BackButton";

export default function ChildrenPage() {
  const { profile } = useAuthUser();
  const [children, setChildren] = useState<(Child & { _id: string })[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", dob: "" });

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(collection(db, `users/${profile.id}/children`),
      (s) => setChildren(s.docs.map((d) => ({ _id: d.id, ...d.data() } as Child & { _id: string }))));
  }, [profile]);

  async function add() {
    if (!profile || !form.fullName.trim()) return;
    const ref = doc(collection(db, `users/${profile.id}/children`));
    await setDoc(ref, {
      id: ref.id,
      parentId: profile.id,
      fullName: form.fullName.trim(),
      dob: form.dob ? Timestamp.fromDate(new Date(form.dob)) : null,
    });
    setForm({ fullName: "", dob: "" });
    setOpen(false);
  }

  if (!profile) return <main className="p-6 text-slate-500">Đang tải…</main>;

  return (
    <main className="mx-auto max-w-md">
      <header className="flex items-center gap-1 border-b bg-white px-3 py-3">
        <BackButton fallback="/home" />
        <h1 className="flex-1 text-xl font-bold text-brand-700">Con của tôi</h1>
        <button onClick={() => setOpen(!open)} className="rounded-full bg-brand-600 px-4 py-1.5 text-sm text-white">+ Thêm</button>
      </header>

      {open && (
        <div className="space-y-2 border-b bg-brand-50 p-4">
          <input
            placeholder="Họ tên bé"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full rounded-xl border-2 border-slate-200 p-2.5"
          />
          <input
            type="date"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
            placeholder="Ngày sinh (không bắt buộc)"
            className="w-full rounded-xl border-2 border-slate-200 p-2.5"
          />
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            ℹ️ Chiều cao sẽ được xác định khi mua thẻ tại quầy lễ tân (chọn “áp dụng giá theo”). Không cần nhập trước.
          </p>
          <button onClick={add} disabled={!form.fullName.trim()} className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-white disabled:opacity-50">
            Lưu
          </button>
        </div>
      )}

      <div className="space-y-3 p-4">
        {children.map((c) => {
          const heightInfo = c.heightCm
            ? `${c.heightCm}cm · ${c.heightCm < 140 ? "Trẻ <1.4m" : "Trẻ ≥1.4m"}`
            : "Chiều cao chưa xác định";
          return (
            <div key={c._id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-xl">🧒</div>
              <div className="flex-1">
                <div className="font-semibold">{c.fullName}</div>
                <div className="text-xs text-slate-500">{heightInfo}</div>
              </div>
            </div>
          );
        })}
        {!children.length && !open && <p className="p-6 text-center text-slate-400">Chưa có bé nào. Bấm "+ Thêm".</p>}
      </div>
    </main>
  );
}
