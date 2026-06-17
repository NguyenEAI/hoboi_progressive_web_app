"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { upsertCoach, setCoachActive } from "@/lib/callable";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import type { Coach, Weekday } from "@/types";
import { WEEKDAY_LABELS, SLOT_START_HOURS } from "@/lib/constants";

const ALL_WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export default function CoachesPage() {
  const { profile } = useAuthUser();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", weekdays: [] as Weekday[] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  useEffect(() => onSnapshot(collection(db, "coaches"),
    (s) => setCoaches(s.docs.map((d) => d.data() as Coach))), []);

  if (profile && profile.role !== "OWNER")
    return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">🔒 Chỉ Owner được quản lý HLV.</p>;

  function newCoach() {
    setEditing(null);
    setForm({ fullName: "", phone: "", weekdays: [] });
    setOpen(true);
  }
  function editCoach(c: Coach) {
    setEditing(c);
    setForm({ fullName: c.fullName, phone: c.phone ?? "", weekdays: [...c.weekdays] });
    setOpen(true);
  }
  function toggleDay(d: Weekday) {
    setForm((f) => ({ ...f, weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort() }));
  }
  async function save() {
    setBusy(true); setMsg(undefined);
    try {
      await upsertCoach({
        id: editing?.id, fullName: form.fullName,
        phone: form.phone, weekdays: form.weekdays,
      });
      setMsg(`✅ Đã ${editing ? "cập nhật" : "tạo"} HLV ${form.fullName}.`);
      setOpen(false);
    } catch (e) { setMsg("❌ " + (e as Error).message); } finally { setBusy(false); }
  }
  async function toggleActive(c: Coach) {
    const action = c.active ? "khoá" : "mở khoá lại";
    if (!confirm(`${c.active ? "Khoá" : "Mở khoá"} HLV ${c.fullName}?\n${c.active ? "Học viên hiện tại vẫn giữ khóa cũ. Lớp mới sẽ không thấy thầy này." : ""}`)) return;
    try {
      await setCoachActive({ id: c.id, active: !c.active });
      setMsg(`✅ Đã ${action} ${c.fullName}.`);
    } catch (e) { setMsg("❌ " + (e as Error).message); }
  }

  return (
    <div>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">Huấn luyện viên</h1>
          <p className="text-sm text-slate-500">{coaches.filter((c) => c.active).length} HLV đang hoạt động · {SLOT_START_HOURS.length} ca/ngày</p>
        </div>
        <button onClick={newCoach} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          + Thêm HLV
        </button>
      </header>

      {msg && <div className="mt-3 rounded-xl bg-slate-100 p-3 text-sm">{msg}</div>}

      {open && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <h3 className="font-semibold text-brand-800">{editing ? "Sửa HLV" : "Thêm HLV mới"}</h3>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Họ và tên</label>
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Vd: Thầy Nam" className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-2.5" />
              </div>
              <div>
                <label className="text-xs font-medium">Số điện thoại</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0903..." className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-2.5" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Ngày dạy trong tuần</label>
              <div className="mt-2 flex gap-2">
                {ALL_WEEKDAYS.map((d) => (
                  <button key={d} onClick={() => toggleDay(d)}
                    className={`flex h-10 w-12 items-center justify-center rounded-lg border-2 text-sm font-semibold ${
                      form.weekdays.includes(d) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600"
                    }`}>
                    {WEEKDAY_LABELS[d].replace("Thứ ", "T").replace("Chủ nhật", "CN")}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Mỗi ngày dạy có {SLOT_START_HOURS.length} ca (07–11h + 14–20h) · sức chứa 20 HV/ca
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border-2 border-slate-200 py-2 font-semibold">Hủy</button>
              <button onClick={save} disabled={busy || !form.fullName.trim() || form.weekdays.length === 0}
                className="flex-1 rounded-xl bg-brand-600 py-2 font-semibold text-white disabled:opacity-50">
                {busy ? "Đang lưu…" : editing ? "Cập nhật" : "Tạo HLV"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-brand-700">
            <tr><th className="p-3">HLV</th><th className="p-3">SĐT</th><th className="p-3">Lịch dạy</th><th className="p-3">Số ca/tuần</th><th className="p-3">Trạng thái</th><th className="p-3">Thao tác</th></tr>
          </thead>
          <tbody>
            {coaches.map((c) => (
              <tr key={c.id} className={`border-t border-slate-50 hover:bg-slate-50 ${c.active ? "" : "opacity-50"}`}>
                <td className="p-3"><div className="flex items-center gap-2"><span className="text-xl">🏊</span><b>{c.fullName}</b></div></td>
                <td className="p-3 text-xs text-slate-500">{c.phone || "—"}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {c.weekdays.map((w) => <span key={w} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{WEEKDAY_LABELS[w].replace("Thứ ", "T")}</span>)}
                  </div>
                </td>
                <td className="p-3">{c.weekdays.length * SLOT_START_HOURS.length} ca</td>
                <td className="p-3">{c.active
                  ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">● Hoạt động</span>
                  : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Đã khóa</span>}</td>
                <td className="p-3 space-x-1">
                  <button onClick={() => editCoach(c)} className="rounded-lg border-2 border-brand-200 px-3 py-1 text-xs text-brand-700">Sửa</button>
                  <button onClick={() => toggleActive(c)} className={`rounded-lg border-2 px-3 py-1 text-xs ${c.active ? "border-red-200 text-red-600" : "border-green-200 text-green-700"}`}>
                    {c.active ? "Khoá" : "Mở khoá"}
                  </button>
                </td>
              </tr>
            ))}
            {!coaches.length && <tr><td colSpan={6} className="p-8 text-center text-slate-400">Chưa có HLV. Bấm "+ Thêm HLV".</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
        💡 Khi sửa ngày dạy: nếu bỏ một ngày mà ngày đó còn HV đang theo học → không bị xóa. Chỉ ngày trống mới gỡ được.
        Khoá HLV (không xóa hẳn) để giữ lịch sử các khóa đã hoàn thành.
      </p>
    </div>
  );
}
