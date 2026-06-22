"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { setUserRole, revokeUserRole } from "@/lib/callable";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { normalizeVNPhone, isValidVNPhone10, displayVNPhone } from "@/lib/phone";
import type { User, Coach } from "@/types";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Chủ hồ bơi", RECEPTIONIST: "Lễ tân", COACH: "Huấn luyện viên",
  CUSTOMER: "Khách hàng", PARENT: "Phụ huynh",
};

export default function StaffPage() {
  const { profile } = useAuthUser();
  const [users, setUsers] = useState<User[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", role: "RECEPTIONIST", coachId: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  useEffect(() => onSnapshot(
    query(collection(db, "users"), where("role", "in", ["OWNER", "RECEPTIONIST", "COACH"])),
    (s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() } as User)))
  ), []);
  useEffect(() => onSnapshot(collection(db, "coaches"),
    (s) => setCoaches(s.docs.map((d) => d.data() as Coach))), []);

  if (profile && profile.role !== "OWNER")
    return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">🔒 Chỉ chủ hồ bơi (Owner) được quản lý nhân viên.</p>;

  async function submit() {
    if (!isValidVNPhone10(form.phone)) {
      setMsg("❌ Vui lòng nhập đủ 10 số bắt đầu bằng 0");
      return;
    }
    setBusy(true); setMsg(undefined);
    try {
      const phone = normalizeVNPhone(form.phone);
      const r = await setUserRole({
        phone,
        role: form.role as "RECEPTIONIST" | "COACH",
        coachId: form.role === "COACH" ? form.coachId || undefined : undefined,
      });
      setMsg(`✅ Đã gán ${ROLE_LABEL[r.role]} cho ${phone}. Người dùng cần ĐĂNG XUẤT và đăng nhập lại để có hiệu lực.`);
      setForm({ phone: "", role: "RECEPTIONIST", coachId: "" });
      setOpen(false);
    } catch (e) { setMsg("❌ " + (e as Error).message); } finally { setBusy(false); }
  }

  async function removeRole(u: User) {
    const display = displayVNPhone(u.phone) || u.phone;
    if (!confirm(
      `Gỡ quyền ${ROLE_LABEL[u.role]} của ${u.fullName || display}?\n\n` +
      `Tài khoản sẽ trở lại CUSTOMER và mất quyền truy cập trang quản trị/HLV ngay sau khi token refresh.`,
    )) return;
    try {
      const r = await revokeUserRole({ targetUid: u.id });
      setMsg(`✅ Đã gỡ quyền ${ROLE_LABEL[r.from]} của ${u.fullName || display}.`);
    } catch (e) { setMsg("❌ " + (e as Error).message); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">Nhân viên &amp; Phân quyền</h1>
          <p className="text-sm text-slate-500">Owner · Lễ tân · HLV</p>
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          + Gán vai trò
        </button>
      </header>

      {open && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <h3 className="font-semibold text-brand-800">Gán vai trò cho tài khoản</h3>
          <p className="text-xs text-slate-600">Người được gán <b>phải đăng nhập app ít nhất 1 lần</b> trước khi gán.</p>
          <div className="mt-3 space-y-2">
            <div>
              <label className="text-xs font-medium">Số điện thoại</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                inputMode="numeric" maxLength={10}
                placeholder="0947010978" className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-2.5 tab-nums" />
            </div>
            <div>
              <label className="text-xs font-medium">Vai trò</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-2.5">
                <option value="RECEPTIONIST">Lễ tân</option>
                <option value="COACH">Huấn luyện viên</option>
                <option value="OWNER">Chủ hồ bơi (Owner — toàn quyền!)</option>
              </select>
            </div>
            {form.role === "COACH" && (
              <div>
                <label className="text-xs font-medium">Liên kết với HLV (chọn 1 trong danh sách)</label>
                <select value={form.coachId} onChange={(e) => setForm({ ...form, coachId: e.target.value })}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-2.5">
                  <option value="">— chưa liên kết —</option>
                  {coaches.map((c) => <option key={c.id} value={c.id}>{c.fullName} ({c.id})</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border-2 border-slate-200 py-2 font-semibold">Hủy</button>
              <button onClick={submit} disabled={busy || !form.phone.trim()}
                className="flex-1 rounded-xl bg-brand-600 py-2 font-semibold text-white disabled:opacity-50">
                {busy ? "Đang gán…" : "Gán quyền"}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm">{msg}</div>}

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-brand-700">
            <tr><th className="p-3">Họ tên</th><th className="p-3">SĐT</th><th className="p-3">Vai trò</th><th className="p-3">Thao tác</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50">
                <td className="p-3 font-medium">{u.fullName || "—"}</td>
                <td className="p-3 tab-nums">{displayVNPhone(u.phone) || u.phone}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs ${u.role === "OWNER" ? "bg-red-100 text-red-700" : u.role === "COACH" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                  {ROLE_LABEL[u.role]}
                </span></td>
                <td className="p-3">
                  {u.id === profile?.id ? (
                    <span className="text-xs text-slate-400">(chính bạn)</span>
                  ) : (
                    <button onClick={() => removeRole(u)} className="rounded-lg border-2 border-red-200 px-3 py-1 text-xs font-semibold text-red-600">Gỡ quyền</button>
                  )}
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Chưa có nhân viên nào</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        ⚠️ Sau khi gán quyền, người đó <b>phải đăng xuất + đăng nhập lại</b> để token có hiệu lực.
      </div>
    </div>
  );
}
