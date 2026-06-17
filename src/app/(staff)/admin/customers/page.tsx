"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { User } from "@/types";
import { formatDate, toDate } from "@/lib/utils";

export default function CustomersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [kw, setKw] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "users"), where("role", "in", ["CUSTOMER", "PARENT"]), limit(500)))
      .then((s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() } as User))));
  }, []);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    const list = k ? users.filter((u) => u.fullName?.toLowerCase().includes(k) || u.phone?.includes(k)) : users;
    // Sắp xếp theo thời gian đăng ký mới nhất
    return [...list].sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
  }, [users, kw]);

  return (
    <div>
      <header><h1 className="text-2xl font-bold text-brand-800">Khách hàng</h1>
      <p className="text-sm text-slate-500">{users.length} tài khoản · sắp xếp theo ngày đăng ký mới nhất</p></header>

      <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="🔍 Tìm theo tên hoặc số điện thoại..."
        className="mt-4 w-full rounded-xl border-2 border-slate-200 p-3" />

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-brand-700">
            <tr><th className="p-3">Khách hàng</th><th className="p-3">SĐT</th><th className="p-3">Loại</th><th className="p-3">Đăng ký lúc</th><th className="p-3">Trạng thái</th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50">
                <td className="p-3 font-medium">{u.fullName || <span className="text-slate-400">(chưa đặt tên)</span>}</td>
                <td className="p-3">{u.phone}</td>
                <td className="p-3"><span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{u.role === "PARENT" ? "Phụ huynh" : "Khách lẻ"}</span></td>
                <td className="p-3 text-xs text-slate-500">
                  <div>{formatDate(u.createdAt)}</div>
                  <div className="text-[10px] text-slate-400">{relativeDays(u.createdAt)}</div>
                </td>
                <td className="p-3">{u.disabled
                  ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Đã khóa</span>
                  : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Hoạt động</span>}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Chưa có khách hàng</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function relativeDays(ts: unknown): string {
  const d = toDate(ts);
  if (isNaN(d.getTime())) return "";
  const diff = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  if (diff < 7) return `${diff} ngày trước`;
  if (diff < 30) return `${Math.floor(diff / 7)} tuần trước`;
  if (diff < 365) return `${Math.floor(diff / 30)} tháng trước`;
  return `${Math.floor(diff / 365)} năm trước`;
}
