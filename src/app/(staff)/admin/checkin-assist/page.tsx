"use client";
import { useState } from "react";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { staffCheckinByPhone } from "@/lib/callable";
import type { User, Child } from "@/types";

export default function CheckinAssistPage() {
  const [phone, setPhone] = useState("");
  const [parent, setParent] = useState<User>();
  const [children, setChildren] = useState<Child[]>([]);
  const [pick, setPick] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function search() {
    setMsg(undefined); setParent(undefined); setChildren([]); setPick(undefined);
    const e164 = phone.startsWith("+") ? phone : "+84" + phone.replace(/\D/g, "").replace(/^0/, "");
    // thử cả định dạng đã lưu (phone có thể lưu dạng +84 hoặc 0...)
    const q = query(collection(db, "users"), where("phone", "in", [e164, phone, "0" + phone.replace(/\D/g, "").replace(/^0/, "")]), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) { setMsg("Không tìm thấy phụ huynh với SĐT này"); return; }
    const p = { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
    setParent(p);
    const cs = await getDocs(collection(db, `users/${p.id}/children`));
    setChildren(cs.docs.map((d) => ({ id: d.id, ...d.data() } as Child)));
  }

  async function doCheckin() {
    if (!parent) return;
    setBusy(true); setMsg(undefined);
    try {
      const r = await staffCheckinByPhone({ phone: parent.phone, beneficiaryId: pick });
      setMsg("✅ " + r.message + " — đã gửi thông báo cho phụ huynh.");
    } catch (e) { setMsg("❌ " + (e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-xl">
      <header><h1 className="text-2xl font-bold text-brand-800">Điểm danh hộ trẻ em</h1>
      <p className="text-sm text-slate-500">Trẻ đi học một mình — tra SĐT phụ huynh</p></header>

      <div className="mt-5">
        <label className="text-sm font-medium">SĐT phụ huynh</label>
        <div className="mt-1 flex gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0905 xxx xxx"
            className="flex-1 rounded-xl border-2 border-slate-200 p-3" />
          <button onClick={search} className="rounded-xl bg-brand-600 px-6 font-semibold text-white">Tìm</button>
        </div>
      </div>

      {parent && (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b pb-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-xl">👤</span>
            <div>
              <div className="font-semibold">{parent.fullName}</div>
              <div className="text-xs text-slate-500">📞 {parent.phone} · {children.length} con</div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <Opt label={`${parent.fullName} (bản thân)`} checked={!pick} onClick={() => setPick(undefined)} />
            {children.map((c) => (
              <Opt key={c.id} label={`${c.fullName} (${c.heightCm < 140 ? "Trẻ <1.4m" : "Trẻ >1.4m"})`}
                checked={pick === c.id} onClick={() => setPick(c.id)} />
            ))}
          </div>

          <button disabled={busy} onClick={doCheckin}
            className="mt-5 w-full rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white disabled:opacity-50">
            {busy ? "Đang xử lý…" : "✅ Điểm danh"}
          </button>
        </div>
      )}

      {msg && <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm">{msg}</div>}
    </div>
  );
}

function Opt({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left ${checked ? "border-brand-500 bg-white" : "border-slate-200 bg-white"}`}>
      <span className={`flex size-5 items-center justify-center rounded-full border-2 ${checked ? "border-brand-600" : "border-slate-300"}`}>
        {checked && <span className="size-2.5 rounded-full bg-brand-600" />}
      </span>
      {label}
    </button>
  );
}
