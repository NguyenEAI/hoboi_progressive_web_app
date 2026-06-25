"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import {
  syncAllAuthUsersToFirestore,
  createCustomerByPhone,
  updateCustomerName,
  deleteCustomer,
} from "@/lib/callable";
import { useToast } from "@/components/Toast";
import { RefreshCw, Pencil, Trash2, UserPlus, X } from "lucide-react";
import type { User } from "@/types";
import { formatDate, toDate } from "@/lib/utils";

// v2.3 fix D8: list tất cả /users + filter client-side để không bỏ sót doc lệch role.
// v2.4.1: nút "Đồng bộ Auth" (Owner-only).
// v2.5:
//  - BỎ orderBy("createdAt") — Firestore loại các doc thiếu field createdAt (legacy/sync skip),
//    đó là lý do 0857906079 không hiện dù đã có doc. Sort client-side, doc thiếu createdAt
//    đẩy về cuối.
//  - Thêm CRUD: Owner = thêm/sửa/xóa; Lễ tân = chỉ sửa tên.
const NON_CUSTOMER_ROLES = new Set(["OWNER", "RECEPTIONIST", "COACH"]);

export default function CustomersPage() {
  const { profile } = useAuthUser();
  const toast = useToast();
  const isOwner = profile?.role === "OWNER";
  const isStaff = isOwner || profile?.role === "RECEPTIONIST";
  const [users, setUsers] = useState<User[]>([]);
  const [kw, setKw] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    try {
      const r = await syncAllAuthUsersToFirestore({});
      toast.show(
        r.created > 0
          ? `Đã tạo ${r.created} hồ sơ mới (quét ${r.scanned} tài khoản Auth).`
          : `Tất cả ${r.scanned} tài khoản Auth đã có hồ sơ Firestore. Không có gì để thêm.`,
        "success",
      );
    } catch (e) {
      toast.show("Đồng bộ thất bại: " + (e as Error).message, "error");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    // Bỏ orderBy — Firestore loại doc thiếu field. Sort client-side.
    const q = query(collection(db, "users"), limit(1000));
    return onSnapshot(
      q,
      (s) => {
        setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
        setLoading(false);
      },
      (e) => {
        console.error("[customers] query error:", e);
        setErr(e.message);
        setLoading(false);
      },
    );
  }, []);

  const customers = useMemo(() => {
    const list = users.filter((u) => !u.role || !NON_CUSTOMER_ROLES.has(u.role));
    // Sort: createdAt desc, doc thiếu createdAt đẩy cuối
    list.sort((a, b) => {
      const ta = toDate(a.createdAt).getTime() || 0;
      const tb = toDate(b.createdAt).getTime() || 0;
      return tb - ta;
    });
    return list;
  }, [users]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return k
      ? customers.filter(
          (u) =>
            u.fullName?.toLowerCase().includes(k) ||
            u.phone?.includes(k) ||
            u.phone?.replace(/^\+84/, "0").includes(k),
        )
      : customers;
  }, [customers, kw]);

  async function handleDelete(uid: string) {
    try {
      await deleteCustomer({ uid });
      toast.show("Đã xóa khách hàng.", "success");
      setDeletingUid(null);
    } catch (e) {
      toast.show("Xóa thất bại: " + (e as Error).message, "error");
    }
  }

  const deletingUser = deletingUid ? customers.find((u) => u.id === deletingUid) : null;

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">Khách hàng</h1>
          <p className="text-sm text-slate-500">
            {loading ? "Đang tải…" : `${customers.length} tài khoản · sắp xếp theo ngày đăng ký mới nhất`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <UserPlus className="size-4" /> Thêm khách
            </button>
          )}
          {isOwner && (
            <button
              onClick={handleSync}
              disabled={syncing}
              title="Tạo hồ sơ Firestore cho các user đã có trong Firebase Auth nhưng chưa hoàn tất bước nhập tên (vd: test numbers)."
              className="flex items-center gap-1.5 rounded-xl border-2 border-brand-200 bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Đang đồng bộ..." : "Đồng bộ Auth"}
            </button>
          )}
        </div>
      </header>

      {err && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Lỗi tải danh sách: {err}. Kiểm tra firestore.rules có cho phép staff list /users không.
        </div>
      )}

      <input
        value={kw}
        onChange={(e) => setKw(e.target.value)}
        placeholder="🔍 Tìm theo tên hoặc số điện thoại..."
        className="mt-4 w-full rounded-xl border-2 border-slate-200 p-3"
      />

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-brand-700">
            <tr>
              <th className="p-3">Khách hàng</th>
              <th className="p-3">SĐT</th>
              <th className="p-3">Loại</th>
              <th className="p-3">Đăng ký lúc</th>
              <th className="p-3">Trạng thái</th>
              {isStaff && <th className="p-3 text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50">
                <td className="p-3 font-medium">
                  {u.fullName || <span className="text-slate-400">(chưa đặt tên)</span>}
                </td>
                <td className="p-3 tabular-nums">{displayPhone(u.phone)}</td>
                <td className="p-3">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {u.role === "PARENT" ? "Phụ huynh" : "Khách lẻ"}
                  </span>
                </td>
                <td className="p-3 text-xs text-slate-500">
                  {u.createdAt ? (
                    <>
                      <div>{formatDate(u.createdAt)}</div>
                      <div className="text-[10px] text-slate-400">{relativeDays(u.createdAt)}</div>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="p-3">
                  {u.disabled ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      Đã khóa
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      Hoạt động
                    </span>
                  )}
                </td>
                {isStaff && (
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(u)}
                        title="Sửa tên"
                        className="rounded-lg p-1.5 text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                      >
                        <Pencil className="size-4" />
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => setDeletingUid(u.id)}
                          title="Xóa khách"
                          className="rounded-lg p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!loading && !filtered.length && (
              <tr>
                <td colSpan={isStaff ? 6 : 5} className="p-8 text-center text-slate-400">
                  {kw ? "Không tìm thấy khách hàng khớp từ khóa." : "Chưa có khách hàng nào."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditNameModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.show("Đã cập nhật tên.", "success");
          }}
          onError={(m) => toast.show(m, "error")}
        />
      )}

      {creating && (
        <CreateCustomerModal
          onClose={() => setCreating(false)}
          onCreated={(already) => {
            setCreating(false);
            toast.show(already ? "Khách đã tồn tại — đã cập nhật." : "Đã thêm khách mới.", "success");
          }}
          onError={(m) => toast.show(m, "error")}
        />
      )}

      {deletingUser && (
        <ConfirmDeleteModal
          user={deletingUser}
          onCancel={() => setDeletingUid(null)}
          onConfirm={() => handleDelete(deletingUser.id)}
        />
      )}
    </div>
  );
}

function EditNameModal({
  user,
  onClose,
  onSaved,
  onError,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(user.fullName ?? "");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await updateCustomerName({ uid: user.id, fullName: name.trim() });
      onSaved();
    } catch (e) {
      onError("Lưu thất bại: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Sửa tên khách hàng" onClose={onClose}>
      <p className="text-xs text-slate-500">SĐT: {user.phone}</p>
      <label className="mt-3 block text-sm font-medium">Họ và tên</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="mt-1 w-full rounded-xl border-2 border-slate-200 p-3"
        placeholder="Vd: Nguyễn Văn A"
      />
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2 font-semibold text-slate-600">
          Hủy
        </button>
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="flex-1 rounded-xl bg-brand-600 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </Modal>
  );
}

function CreateCustomerModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (alreadyExists: boolean) => void;
  onError: (m: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = /^0\d{9}$/.test(phone);
  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      const r = await createCustomerByPhone({ phone, fullName: name.trim() || undefined });
      onCreated(r.alreadyExists);
    } catch (e) {
      onError("Tạo thất bại: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Thêm khách hàng" onClose={onClose}>
      <label className="block text-sm font-medium">Số điện thoại *</label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
        inputMode="numeric"
        autoFocus
        className="mt-1 w-full rounded-xl border-2 border-slate-200 p-3 tabular-nums"
        placeholder="0947010978"
      />
      <p className="mt-1 text-[11px] text-slate-500">10 số bắt đầu bằng 0.</p>
      <label className="mt-3 block text-sm font-medium">Họ và tên (tùy chọn)</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-xl border-2 border-slate-200 p-3"
        placeholder="Có thể để trống — khách tự đặt khi mở app"
      />
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2 font-semibold text-slate-600">
          Hủy
        </button>
        <button
          onClick={submit}
          disabled={busy || !valid}
          className="flex-1 rounded-xl bg-brand-600 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Đang tạo..." : "Tạo khách"}
        </button>
      </div>
    </Modal>
  );
}

function ConfirmDeleteModal({
  user,
  onCancel,
  onConfirm,
}: {
  user: User;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    await onConfirm();
    setBusy(false);
  }
  return (
    <Modal title="Xóa khách hàng" onClose={onCancel}>
      <p className="text-sm text-slate-700">
        Xóa <b>{user.fullName || "(chưa đặt tên)"}</b> ({user.phone})?
      </p>
      <p className="mt-2 text-xs text-red-600">
        Hành động này xóa cả tài khoản Auth + hồ sơ Firestore. Đơn hàng / thẻ đã tạo vẫn giữ (theo uid). Audit log lưu vĩnh viễn.
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 py-2 font-semibold text-slate-600">
          Hủy
        </button>
        <button
          onClick={go}
          disabled={busy}
          className="flex-1 rounded-xl bg-red-600 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Đang xóa..." : "Xóa"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-800">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function displayPhone(p?: string): string {
  if (!p) return "—";
  const local = p.startsWith("+84") ? "0" + p.slice(3) : p;
  if (/^0\d{9}$/.test(local)) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return p;
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
