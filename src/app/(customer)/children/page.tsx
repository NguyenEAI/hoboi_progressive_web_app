"use client";

import { BackButton } from "@/components/BackButton";
import { useToast } from "@/components/Toast";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import type { Audience, Child, Enrollment, Membership, Order, TicketPackage, TS } from "@/types";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Baby, Pencil, Plus, Ruler, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ChildRow = Child & { _id: string };
type Mode = "create" | "edit";
type FormState = {
  fullName: string;
  dob: string;
  heightCm: string;
};
type Blocker = {
  label: string;
  detail: string;
};

const EMPTY_FORM: FormState = { fullName: "", dob: "", heightCm: "" };
const MIN_HEIGHT_CM = 60;
const MAX_HEIGHT_CM = 220;

export default function ChildrenPage() {
  const { profile } = useAuthUser();
  const toast = useToast();
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [mode, setMode] = useState<Mode>("create");
  const [editing, setEditing] = useState<ChildRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChildRow | null>(null);
  const [deleteBlockers, setDeleteBlockers] = useState<Blocker[]>([]);
  const [checkingDelete, setCheckingDelete] = useState(false);

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(collection(db, `users/${profile.id}/children`), (snap) => {
      setChildren(snap.docs.map((d) => ({ _id: d.id, ...d.data() } as ChildRow)));
    });
  }, [profile]);

  const parsedHeight = Number(form.heightCm);
  const heightAudience = Number.isFinite(parsedHeight) ? audienceFromHeight(parsedHeight) : null;
  const validation = useMemo(() => validateForm(form), [form]);
  const canSave = !validation && !busy;

  function openCreate() {
    setMode("create");
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(child: ChildRow) {
    setMode("edit");
    setEditing(child);
    setForm({
      fullName: child.fullName ?? "",
      dob: dateInputValue(child.dob),
      heightCm: typeof child.heightCm === "number" ? String(child.heightCm) : "",
    });
    setFormOpen(true);
  }

  function closeForm() {
    if (busy) return;
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function saveChild() {
    if (!profile || validation) {
      if (validation) toast.show(validation, "error");
      return;
    }
    setBusy(true);
    try {
      const heightCm = Number(form.heightCm);
      const payload = {
        parentId: profile.id,
        fullName: form.fullName.trim(),
        dob: form.dob ? Timestamp.fromDate(new Date(`${form.dob}T00:00:00`)) : null,
        heightCm,
        audience: audienceFromHeight(heightCm),
      };

      if (mode === "edit" && editing) {
        await updateDoc(doc(db, `users/${profile.id}/children/${editing._id}`), {
          id: editing._id,
          ...payload,
          updatedAt: serverTimestamp(),
        });
        toast.show("Đã cập nhật hồ sơ của bé.", "success");
      } else {
        const ref = doc(collection(db, `users/${profile.id}/children`));
        await setDoc(ref, {
          id: ref.id,
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.show("Đã thêm bé vào hồ sơ.", "success");
      }
      closeForm();
    } catch (e) {
      toast.show("Lưu thất bại: " + errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function prepareDelete(child: ChildRow) {
    if (!profile) return;
    setDeleteTarget(child);
    setDeleteBlockers([]);
    setCheckingDelete(true);
    try {
      setDeleteBlockers(await findActiveChildReferences(profile.id, child._id));
    } catch (e) {
      setDeleteBlockers([
        {
          label: "Không kiểm tra được dữ liệu đang dùng",
          detail: errorText(e),
        },
      ]);
    } finally {
      setCheckingDelete(false);
    }
  }

  function closeDelete() {
    if (busy) return;
    setDeleteTarget(null);
    setDeleteBlockers([]);
    setCheckingDelete(false);
  }

  async function confirmDelete() {
    if (!profile || !deleteTarget || deleteBlockers.length > 0) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, `users/${profile.id}/children/${deleteTarget._id}`));
      toast.show("Đã xoá hồ sơ của bé.", "success");
      closeDelete();
    } catch (e) {
      toast.show("Xoá thất bại: " + errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return <main className="p-6 text-slate-500">Đang tải...</main>;

  return (
    <main className="mx-auto max-w-md pb-24">
      <header className="surface-glass sticky top-0 z-20 border-b border-slate-200/70 px-3 py-3">
        <div className="flex items-center gap-2">
          <BackButton fallback="/profile" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-brand-800">Con của tôi</h1>
            <p className="text-xs text-slate-500">Quản lý hồ sơ bé dùng khi mua vé, khóa học và điểm danh.</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-brand-600 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-brand-600/20"
          >
            <Plus className="size-4" /> Thêm
          </button>
        </div>
      </header>

      <section className="space-y-3 p-4">
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-3 text-sm text-brand-900">
          <div className="font-bold">Chiều cao dùng để gợi ý nhóm trẻ em</div>
          <div className="mt-1 text-xs text-brand-800">
            Dưới 140 cm = trẻ dưới 1.4m. Từ 140 cm trở lên = trẻ từ 1.4m. Khi mua vé, bạn vẫn chọn nhóm giá ở bước xác nhận như hiện tại.
          </div>
        </div>

        {children.map((child) => (
          <article key={child._id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Baby className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900">{child.fullName || "(Chưa đặt tên)"}</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                    {heightSummary(child)}
                  </span>
                  {child.dob && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                      Sinh: {formatDate(child.dob)}
                    </span>
                  )}
                </div>
                {typeof child.heightCm !== "number" && (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    Hồ sơ cũ chưa có chiều cao. Bấm sửa để bổ sung trước khi mua dịch vụ mới cho bé.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => openEdit(child)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-brand-100 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700"
              >
                <Pencil className="size-4" /> Sửa
              </button>
              <button
                onClick={() => void prepareDelete(child)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
              >
                <Trash2 className="size-4" /> Xoá
              </button>
            </div>
          </article>
        ))}

        {!children.length && !formOpen && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <Baby className="mx-auto size-10 text-brand-500" />
            <p className="mt-2 font-semibold text-slate-700">Chưa có bé nào</p>
            <p className="mt-1 text-sm text-slate-500">Thêm hồ sơ bé để mua vé hoặc đăng ký khóa học cho con.</p>
            <button onClick={openCreate} className="btn-primary mt-4 w-full">
              <Plus className="size-4" /> Thêm bé đầu tiên
            </button>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 px-4 py-6">
          <div className="mx-auto max-w-md rounded-3xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {mode === "edit" ? "Sửa hồ sơ bé" : "Thêm hồ sơ bé"}
                </h2>
                <p className="text-xs text-slate-500">Tên và chiều cao là bắt buộc. Ngày sinh có thể để trống.</p>
              </div>
              <button onClick={closeForm} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Họ tên bé</span>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((cur) => ({ ...cur, fullName: e.target.value }))}
                  maxLength={60}
                  placeholder="Ví dụ: Nguyễn Minh Anh"
                  className="input mt-1"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Chiều cao hiện tại</span>
                <div className="mt-1 flex items-center rounded-2xl border-2 border-slate-200 bg-white px-3 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                  <Ruler className="size-5 text-brand-600" />
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.heightCm}
                    onChange={(e) => setForm((cur) => ({ ...cur, heightCm: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                    placeholder="135"
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-2xl font-extrabold outline-none"
                  />
                  <span className="text-sm font-bold text-slate-500">cm</span>
                </div>
              </label>

              <div className={`rounded-2xl px-3 py-2 text-sm font-semibold ${heightAudience ? "bg-brand-50 text-brand-800" : "bg-slate-50 text-slate-500"}`}>
                {heightAudience ? (
                  <>
                    Nhóm gợi ý: <b>{audienceLabel(heightAudience)}</b>
                  </>
                ) : (
                  "Nhập chiều cao để hiện nhóm gợi ý."
                )}
              </div>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Ngày sinh</span>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm((cur) => ({ ...cur, dob: e.target.value }))}
                  className="input mt-1"
                />
              </label>

              {validation && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{validation}</p>}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={closeForm} disabled={busy} className="btn-secondary min-h-12">
                  Huỷ
                </button>
                <button onClick={() => void saveChild()} disabled={!canSave} className="btn-primary min-h-12 disabled:opacity-50">
                  {busy ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 px-4 py-6">
          <div className="mx-auto max-w-md rounded-3xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Xoá hồ sơ bé?</h2>
                <p className="text-sm text-slate-500">Bé: <b>{deleteTarget.fullName}</b></p>
              </div>
              <button onClick={closeDelete} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
                <X className="size-5" />
              </button>
            </div>

            {checkingDelete ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                Đang kiểm tra vé, gói lượt và khóa học đang dùng...
              </p>
            ) : deleteBlockers.length > 0 ? (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-extrabold">Không thể xoá hồ sơ này trong app</div>
                <p className="mt-1">
                  Hồ sơ của bé đang được liên kết với dịch vụ còn hoạt động. Vui lòng liên hệ lễ tân/Owner để xử lý hoặc chuyển dữ liệu trước khi xoá.
                </p>
                <ul className="mt-3 space-y-2">
                  {deleteBlockers.map((b, index) => (
                    <li key={`${b.label}-${index}`} className="rounded-xl bg-white px-3 py-2">
                      <b>{b.label}</b>
                      <div className="text-xs text-amber-800">{b.detail}</div>
                    </li>
                  ))}
                </ul>
                <button onClick={closeDelete} className="btn-secondary mt-4 w-full">
                  Đã hiểu
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                  Hồ sơ này chưa có vé, gói lượt hoặc khóa học đang hoạt động. Sau khi xoá, thông tin bé sẽ không còn trong danh sách của bạn.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={closeDelete} disabled={busy} className="btn-secondary min-h-12">
                    Huỷ
                  </button>
                  <button
                    onClick={() => void confirmDelete()}
                    disabled={busy}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                  >
                    <Trash2 className="size-4" /> {busy ? "Đang xoá..." : "Xác nhận xoá"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function validateForm(form: FormState) {
  const name = form.fullName.trim();
  if (!name) return "Nhập họ tên bé.";
  if (name.length > 60) return "Họ tên tối đa 60 ký tự.";
  if (!/^\d+$/.test(form.heightCm)) return "Nhập chiều cao bằng số cm.";
  const height = Number(form.heightCm);
  if (height < MIN_HEIGHT_CM || height > MAX_HEIGHT_CM) return `Chiều cao phải từ ${MIN_HEIGHT_CM} đến ${MAX_HEIGHT_CM} cm.`;
  return "";
}

function audienceFromHeight(heightCm: number): Audience {
  return heightCm < 140 ? "CHILD_UNDER_140" : "CHILD_OVER_140";
}

function audienceLabel(audience: Audience) {
  if (audience === "CHILD_UNDER_140") return "Trẻ dưới 1.4m";
  if (audience === "CHILD_OVER_140") return "Trẻ từ 1.4m trở lên";
  return "Người lớn";
}

function heightSummary(child: Child) {
  if (typeof child.heightCm !== "number") return "Chưa có chiều cao";
  return `${child.heightCm} cm · ${audienceLabel(audienceFromHeight(child.heightCm))}`;
}

function dateInputValue(value?: TS | null) {
  const date = toDate(value);
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(value?: TS | null) {
  const date = toDate(value);
  return date ? date.toLocaleDateString("vi-VN") : "";
}

function toDate(value?: TS | null) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if ("toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate() as Date;
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value.seconds === "number") {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

async function findActiveChildReferences(parentId: string, childId: string): Promise<Blocker[]> {
  const [membershipSnap, packageSnap, enrollmentSnap, orderSnap] = await Promise.all([
    getDocs(query(collection(db, "memberships"), where("userId", "==", parentId), where("status", "==", "ACTIVE"))),
    getDocs(query(collection(db, "ticketPackages"), where("userId", "==", parentId), where("status", "==", "ACTIVE"))),
    getDocs(query(collection(db, "enrollments"), where("parentId", "==", parentId), where("status", "==", "ACTIVE"))),
    getDocs(query(collection(db, "orders"), where("customerId", "==", parentId))),
  ]);

  const ordersById = new Map(orderSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Order]));
  const blockers: Blocker[] = [];
  membershipSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Membership))
    .filter((m) => isChildService(m.holderKind, m.holderId, childId, ordersById.get(m.orderId)))
    .forEach((m) => blockers.push({ label: "Vé thời hạn đang hoạt động", detail: `MS${m.memberCode} · ${m.holderName || "Bé"}` }));

  packageSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as TicketPackage))
    .filter((p) => isChildService(p.holderKind, p.holderId, childId, ordersById.get(p.orderId)) && (p.remainingSessions ?? 0) > 0)
    .forEach((p) => blockers.push({ label: "Vé lượt đang còn lượt", detail: `MS${p.memberCode} · còn ${p.remainingSessions}/${p.totalSessions} lượt` }));

  enrollmentSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Enrollment))
    .filter((e) => e.studentKind === "CHILD" && e.studentId === childId)
    .forEach((e) => blockers.push({ label: "Khóa học bơi đang hoạt động", detail: `${e.studentName} · ${e.attendedSessions}/${e.totalSessions} buổi` }));

  return blockers;
}

function isChildService(kind: "USER" | "CHILD" | undefined, id: string | undefined, childId: string, order?: Order) {
  if (kind === "CHILD" && id === childId) return true;
  return !kind && order?.beneficiaryKind === "CHILD" && order.beneficiaryId === childId;
}

function errorText(error: unknown) {
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message.trim() ? message : "Lỗi không xác định.";
}
