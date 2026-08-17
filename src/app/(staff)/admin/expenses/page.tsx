"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp, where } from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { formatVND, formatDate } from "@/lib/utils";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  upsertExpenseTemplate,
  deleteExpenseTemplate,
} from "@/lib/callable";
import {
  uploadExpenseReceipt,
  validateExpenseReceiptFile,
  type ExpenseReceiptUpload,
} from "@/lib/expenseReceipt";
import type {
  Expense,
  ExpenseCategory,
  ExpensePaidBy,
  ExpensePaymentMethod,
  ExpenseTemplate,
} from "@/types";

// ============ Cấu hình loại chi ============
const CATEGORY_META: Record<ExpenseCategory, { label: string; emoji: string }> = {
  ELECTRICITY: { label: "Điện", emoji: "⚡" },
  WATER: { label: "Nước", emoji: "💧" },
  CHEMICALS: { label: "Hoá chất xử lý nước", emoji: "🧪" },
  STAFF_SALARY: { label: "Lương nhân viên", emoji: "👥" },
  COACH_SALARY: { label: "Lương HLV", emoji: "🏊" },
  SUPPLIES: { label: "Vật tư – dụng cụ", emoji: "🛠️" },
  MAINTENANCE: { label: "Sửa chữa – bảo trì", emoji: "🔧" },
  CLEANING: { label: "Vệ sinh", emoji: "🧹" },
  MARKETING: { label: "Marketing / quảng cáo", emoji: "📣" },
  RENT: { label: "Thuê mặt bằng", emoji: "🏠" },
  TELECOM: { label: "Internet / điện thoại", emoji: "📶" },
  TAX: { label: "Thuế – phí", emoji: "🧾" },
  HOSPITALITY: { label: "Ăn uống – tiếp khách", emoji: "🍽️" },
  OTHER: { label: "Khác", emoji: "📌" },
};
const CATEGORY_KEYS = Object.keys(CATEGORY_META) as ExpenseCategory[];

const PAYMENT_LABEL: Record<ExpensePaymentMethod, string> = {
  CASH: "Tiền mặt",
  TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
};

const PAID_BY_LABEL: Record<ExpensePaidBy, string> = {
  OWNER: "Chủ",
  RECEPTIONIST: "Lễ tân",
  OTHER: "Khác",
};

const HIGH_AMOUNT_THRESHOLD = 5_000_000;

// ============ Helpers thời gian ============
function todayIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function isoOf(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10);
}
function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function toJsDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof v === "object" && "seconds" in (v as { seconds?: number })) {
    return new Date(((v as { seconds: number }).seconds) * 1000);
  }
  if (typeof v === "string") return new Date(v);
  return new Date(NaN);
}
function timeOf(v: unknown): string {
  const d = toJsDate(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
function firstOfThisMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function firstOfNextMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function firstOfPrevMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

// Định dạng số với dấu chấm ngàn cho input
function formatMoneyInput(s: string): string {
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

// ============ Component ảnh hoá đơn (có download URL) ============
function ReceiptThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getDownloadURL(storageRef(storage, path))
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return <div className="h-14 w-14 rounded-lg bg-slate-200" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt="hoá đơn" className="h-14 w-14 rounded-lg object-cover border border-slate-200" />
    </a>
  );
}

// ============ Trang ============
export default function ExpensesPage() {
  const { profile } = useAuthUser();
  const isStaff = profile?.role === "OWNER" || profile?.role === "RECEPTIONIST";
  const isOwner = profile?.role === "OWNER";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [prevMonthExpenses, setPrevMonthExpenses] = useState<Expense[]>([]);
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);

  // ---- Form state ----
  const [date, setDate] = useState<string>(todayIso());
  const [amountText, setAmountText] = useState<string>("");
  const [category, setCategory] = useState<ExpenseCategory>("ELECTRICITY");
  const [note, setNote] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>("CASH");
  const [paidBy, setPaidBy] = useState<ExpensePaidBy>(isOwner ? "OWNER" : "RECEPTIONIST");
  const [paidByName, setPaidByName] = useState<string>("");
  const [receipt, setReceipt] = useState<ExpenseReceiptUpload | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmHigh, setConfirmHigh] = useState(false);

  // ---- Filter state ----
  const [filterFrom, setFilterFrom] = useState<string>(isoOf(firstOfThisMonth()));
  const [filterTo, setFilterTo] = useState<string>(todayIso());
  const [filterCats, setFilterCats] = useState<Set<ExpenseCategory>>(new Set());

  // ---- Delete state ----
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ---- Template editor state ----
  const [showTplEditor, setShowTplEditor] = useState(false);
  const [tplForm, setTplForm] = useState<{ id?: string; name: string; category: ExpenseCategory; typicalAmount: string; note: string }>({
    name: "",
    category: "ELECTRICITY",
    typicalAmount: "",
    note: "",
  });
  const [tplBusy, setTplBusy] = useState(false);

  // ---- Load expenses (this month) & previous month & templates ----
  useEffect(() => {
    if (!isStaff) return;
    const startTs = Timestamp.fromDate(firstOfThisMonth());
    const endTs = Timestamp.fromDate(firstOfNextMonth());
    const q = query(
      collection(db, "expenses"),
      where("at", ">=", startTs),
      where("at", "<", endTs),
      orderBy("at", "desc"),
    );
    return onSnapshot(
      q,
      (s) => {
        setExpenses(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Expense));
        setLoaded(true);
      },
      (err) => {
        console.error("expenses load error", err);
        setLoaded(true);
      },
    );
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;
    const startTs = Timestamp.fromDate(firstOfPrevMonth());
    const endTs = Timestamp.fromDate(firstOfThisMonth());
    const q = query(
      collection(db, "expenses"),
      where("at", ">=", startTs),
      where("at", "<", endTs),
      orderBy("at", "desc"),
    );
    return onSnapshot(
      q,
      (s) => setPrevMonthExpenses(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Expense)),
      (err) => console.error("prev-month expenses error", err),
    );
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;
    return onSnapshot(
      collection(db, "expenseTemplates"),
      (s) => setTemplates(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as ExpenseTemplate)),
      (err) => console.error("templates error", err),
    );
  }, [isStaff]);

  // ---- Derived data ----
  const visible = useMemo(() => expenses.filter((e) => !e.deletedAt), [expenses]);
  const prevVisible = useMemo(() => prevMonthExpenses.filter((e) => !e.deletedAt), [prevMonthExpenses]);

  const today = todayIso();
  const todayList = useMemo(
    () => visible.filter((e) => isoOf(toJsDate(e.at)) === today),
    [visible, today],
  );

  const filtered = useMemo(() => {
    const from = new Date(filterFrom + "T00:00:00");
    const to = new Date(filterTo + "T23:59:59");
    return visible.filter((e) => {
      const d = toJsDate(e.at);
      if (d < from || d > to) return false;
      if (filterCats.size > 0 && !filterCats.has(e.category)) return false;
      return true;
    });
  }, [visible, filterFrom, filterTo, filterCats]);

  const monthTotal = useMemo(() => visible.reduce((s, e) => s + Number(e.amount || 0), 0), [visible]);
  const prevMonthTotal = useMemo(() => prevVisible.reduce((s, e) => s + Number(e.amount || 0), 0), [prevVisible]);
  const deltaVsPrev = prevMonthTotal > 0 ? ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100 : null;

  const perCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of visible) map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount || 0));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [visible]);

  // Templates chưa được ghi tháng này
  const thisMonthKey = monthOf(new Date());
  const templateSuggestions = useMemo(() => {
    return templates
      .filter((t) => t.active !== false)
      .filter((t) => !visible.some((e) => monthOf(toJsDate(e.at)) === thisMonthKey && e.category === t.category && (e.note ?? "").includes(t.name)));
  }, [templates, visible, thisMonthKey]);

  // ---- Reset form ----
  function resetForm() {
    setDate(todayIso());
    setAmountText("");
    setCategory("ELECTRICITY");
    setNote("");
    setPaymentMethod("CASH");
    setPaidBy(isOwner ? "OWNER" : "RECEPTIONIST");
    setPaidByName("");
    setReceipt(null);
    setReceiptPreview(null);
    setEditingId(null);
    setConfirmHigh(false);
  }

  // ---- Upload receipt ----
  async function handleReceipt(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = validateExpenseReceiptFile(file);
    if (invalid) {
      setMsg({ tone: "err", text: `❌ ${invalid}` });
      return;
    }
    setReceiptUploading(true);
    setMsg(null);
    try {
      const preview = URL.createObjectURL(file);
      setReceiptPreview(preview);
      const uploaded = await uploadExpenseReceipt(file);
      setReceipt(uploaded);
    } catch (err) {
      setMsg({ tone: "err", text: `❌ Không lưu được ảnh: ${(err as Error).message}` });
      setReceiptPreview(null);
    } finally {
      setReceiptUploading(false);
    }
  }

  // ---- Submit ----
  async function submit() {
    const amount = Number(amountText.replace(/\D/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg({ tone: "err", text: "❌ Nhập số tiền hợp lệ" });
      return;
    }
    if (amount > HIGH_AMOUNT_THRESHOLD && !confirmHigh) {
      setConfirmHigh(true);
      setMsg({ tone: "err", text: `⚠️ Số tiền lớn hơn ${HIGH_AMOUNT_THRESHOLD.toLocaleString("vi-VN")}₫ — bấm Lưu lần nữa để xác nhận` });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        date,
        amount,
        category,
        note,
        paymentMethod,
        paidBy,
        paidByName: paidBy === "OTHER" ? paidByName : undefined,
        receiptPhoto: receipt ?? null,
      };
      if (editingId) {
        await updateExpense({ id: editingId, ...payload });
        setMsg({ tone: "ok", text: "✅ Đã cập nhật khoản chi" });
      } else {
        await createExpense(payload);
        setMsg({ tone: "ok", text: "✅ Đã ghi khoản chi" });
      }
      resetForm();
    } catch (err) {
      setMsg({ tone: "err", text: `❌ ${(err as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  // ---- Bắt đầu sửa ----
  function beginEdit(e: Expense) {
    setEditingId(e.id);
    setDate(isoOf(toJsDate(e.at)));
    setAmountText(Number(e.amount).toLocaleString("vi-VN"));
    setCategory(e.category);
    setNote(e.note ?? "");
    setPaymentMethod(e.paymentMethod);
    setPaidBy(e.paidBy);
    setPaidByName(e.paidByName ?? "");
    setReceipt(e.receiptPhoto ? { storagePath: e.receiptPhoto.storagePath, contentType: e.receiptPhoto.contentType ?? "image/jpeg", sizeBytes: e.receiptPhoto.sizeBytes ?? 0 } : null);
    setReceiptPreview(null);
    setConfirmHigh(false);
    setMsg({ tone: "ok", text: `Đang sửa khoản chi ngày ${formatDate(e.at)}` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Quick fill từ template ----
  function useTemplate(t: ExpenseTemplate) {
    resetForm();
    setCategory(t.category);
    setNote(t.name);
    if (t.typicalAmount) setAmountText(Number(t.typicalAmount).toLocaleString("vi-VN"));
    setMsg({ tone: "ok", text: `Đã điền sẵn "${t.name}" — kiểm tra số tiền rồi Lưu` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Xoá ----
  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteReason.trim().length < 3) {
      setMsg({ tone: "err", text: "❌ Vui lòng nhập lý do xoá (tối thiểu 3 ký tự)" });
      return;
    }
    setDeleting(true);
    try {
      await deleteExpense({ id: deleteTarget.id, reason: deleteReason.trim() });
      setMsg({ tone: "ok", text: "✅ Đã xoá khoản chi" });
      setDeleteTarget(null);
      setDeleteReason("");
    } catch (err) {
      setMsg({ tone: "err", text: `❌ ${(err as Error).message}` });
    } finally {
      setDeleting(false);
    }
  }

  // ---- Template ----
  async function saveTemplate() {
    if (!tplForm.name.trim()) {
      setMsg({ tone: "err", text: "❌ Nhập tên khoản chi cố định" });
      return;
    }
    setTplBusy(true);
    try {
      await upsertExpenseTemplate({
        id: tplForm.id,
        name: tplForm.name.trim(),
        category: tplForm.category,
        typicalAmount: Number(tplForm.typicalAmount.replace(/\D/g, "")) || 0,
        note: tplForm.note.trim(),
        active: true,
      });
      setTplForm({ name: "", category: "ELECTRICITY", typicalAmount: "", note: "" });
      setShowTplEditor(false);
      setMsg({ tone: "ok", text: "✅ Đã lưu chi cố định" });
    } catch (err) {
      setMsg({ tone: "err", text: `❌ ${(err as Error).message}` });
    } finally {
      setTplBusy(false);
    }
  }

  async function removeTemplate(t: ExpenseTemplate) {
    if (!confirm(`Xoá chi cố định "${t.name}"?`)) return;
    try {
      await deleteExpenseTemplate({ id: t.id });
    } catch (err) {
      setMsg({ tone: "err", text: `❌ ${(err as Error).message}` });
    }
  }

  if (!profile) return <p className="p-4 text-sm text-slate-500">Đang tải...</p>;
  if (!isStaff)
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        🔒 Chỉ Chủ hoặc Lễ tân được xem chi tiêu của hồ.
      </p>
    );

  // ============ RENDER ============
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-black text-brand-900">💸 Chi tiêu của hồ</h1>
        <p className="text-sm text-slate-600">Ghi lại các khoản chi hằng ngày để biết hồ đang tiêu vào đâu.</p>
      </header>

      {msg && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            msg.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ============ NHẮC CHI CỐ ĐỊNH ============ */}
      {templateSuggestions.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 text-sm font-bold text-amber-900">📌 Tháng này chưa ghi</div>
          <div className="flex flex-wrap gap-2">
            {templateSuggestions.map((t) => (
              <button
                key={t.id}
                onClick={() => useTemplate(t)}
                className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                {CATEGORY_META[t.category]?.emoji} {t.name}
                {t.typicalAmount ? ` · ~${Number(t.typicalAmount).toLocaleString("vi-VN")}₫` : ""} — Ghi ngay
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ============ FORM ============ */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">
            {editingId ? "✏️ Sửa khoản chi" : "➕ Ghi khoản chi mới"}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
              Bỏ sửa
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Ngày chi</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Số tiền (₫)</span>
            <input
              inputMode="numeric"
              value={amountText}
              onChange={(e) => {
                setAmountText(formatMoneyInput(e.target.value));
                setConfirmHigh(false);
              }}
              placeholder="0"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold tabular-nums"
            />
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">Loại chi</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              {CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {CATEGORY_META[k].emoji} {CATEGORY_META[k].label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">Ghi chú (mua gì, ở đâu)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Mua clo ở tiệm Ba Nam"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Hình thức trả</span>
            <div className="flex gap-2">
              {(Object.keys(PAYMENT_LABEL) as ExpensePaymentMethod[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPaymentMethod(k)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                    paymentMethod === k
                      ? "border-brand-500 bg-brand-50 text-brand-900"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {PAYMENT_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Người trả</span>
            <div className="flex gap-2">
              {(Object.keys(PAID_BY_LABEL) as ExpensePaidBy[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPaidBy(k)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                    paidBy === k
                      ? "border-brand-500 bg-brand-50 text-brand-900"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {PAID_BY_LABEL[k]}
                </button>
              ))}
            </div>
            {paidBy === "OTHER" && (
              <input
                value={paidByName}
                onChange={(e) => setPaidByName(e.target.value)}
                placeholder="Tên người trả"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            )}
          </div>

          <div className="text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">Ảnh hoá đơn (không bắt buộc)</span>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                📷 {receipt ? "Đổi ảnh khác" : "Chọn ảnh"}
                <input type="file" accept="image/*" className="hidden" onChange={handleReceipt} />
              </label>
              {receiptUploading && <span className="text-xs text-slate-500">Đang tải ảnh...</span>}
              {(receiptPreview || receipt) && (
                <div className="flex items-center gap-2">
                  {receiptPreview ? (
                    <img src={receiptPreview} alt="hoá đơn" className="h-14 w-14 rounded-lg object-cover" />
                  ) : receipt ? (
                    <ReceiptThumb path={receipt.storagePath} />
                  ) : null}
                  <button
                    type="button"
                    className="text-xs text-rose-600 hover:underline"
                    onClick={() => { setReceipt(null); setReceiptPreview(null); }}
                  >
                    Bỏ ảnh
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={submit}
            disabled={saving || receiptUploading}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : editingId ? "💾 Cập nhật" : "💾 Lưu khoản chi"}
          </button>
        </div>
      </section>

      {/* ============ TỔNG THÁNG ============ */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-slate-800">📊 Tổng tháng {monthOf(new Date())}</h2>
          <div className="text-2xl font-black text-brand-700">{formatVND(monthTotal)}</div>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Tháng trước: {formatVND(prevMonthTotal)}
          {deltaVsPrev !== null && (
            <span className={`ml-2 font-semibold ${deltaVsPrev > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {deltaVsPrev > 0 ? "▲" : "▼"} {Math.abs(deltaVsPrev).toFixed(0)}%
            </span>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {perCategory.length === 0 && (
            <div className="text-sm text-slate-400">Chưa có khoản chi nào trong tháng này.</div>
          )}
          {perCategory.map(([cat, amt]) => {
            const pct = monthTotal > 0 ? (amt / monthTotal) * 100 : 0;
            return (
              <div key={cat} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-slate-700">
                    {CATEGORY_META[cat]?.emoji} {CATEGORY_META[cat]?.label}
                  </span>
                  <span className="tabular-nums text-slate-700">
                    {formatVND(amt)} <span className="text-xs text-slate-400">({pct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ HÔM NAY ============ */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-bold text-slate-800">📅 Hôm nay</h2>
          <div className="text-sm font-semibold text-slate-700">
            {formatVND(todayList.reduce((s, e) => s + Number(e.amount || 0), 0))} · {todayList.length} khoản
          </div>
        </div>
        {!loaded ? (
          <div className="text-sm text-slate-400">Đang tải...</div>
        ) : todayList.length === 0 ? (
          <div className="text-sm text-slate-400">Hôm nay chưa ghi khoản chi nào.</div>
        ) : (
          <ul className="space-y-2">
            {todayList.map((e) => (
              <ExpenseRow
                key={e.id}
                e={e}
                canModify={isOwner || (e.createdBy === profile?.id && !isTooOld(e))}
                onEdit={() => beginEdit(e)}
                onDelete={() => { setDeleteTarget(e); setDeleteReason(""); }}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ============ LỌC + DANH SÁCH ============ */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-slate-800">🔎 Lọc theo ngày & loại</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Từ ngày</span>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Đến ngày</span>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <div className="text-sm md:col-span-1">
            <span className="mb-1 block font-semibold text-slate-700">Loại chi</span>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-auto rounded-xl border border-slate-200 p-2">
              {CATEGORY_KEYS.map((k) => {
                const on = filterCats.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      const next = new Set(filterCats);
                      if (on) next.delete(k); else next.add(k);
                      setFilterCats(next);
                    }}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {CATEGORY_META[k].emoji} {CATEGORY_META[k].label}
                  </button>
                );
              })}
              {filterCats.size > 0 && (
                <button onClick={() => setFilterCats(new Set())} className="text-[11px] text-rose-600 hover:underline">
                  Bỏ lọc
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold text-slate-700">
            Kết quả: {filtered.length} khoản · {formatVND(filtered.reduce((s, e) => s + Number(e.amount || 0), 0))}
          </div>
          {filtered.length === 0 ? (
            <div className="text-sm text-slate-400">Không có khoản chi nào khớp bộ lọc.</div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((e) => (
                <ExpenseRow
                  key={e.id}
                  e={e}
                  canModify={isOwner || (e.createdBy === profile?.id && !isTooOld(e))}
                  onEdit={() => beginEdit(e)}
                  onDelete={() => { setDeleteTarget(e); setDeleteReason(""); }}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ============ TEMPLATES (Owner) ============ */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">📌 Chi cố định hằng tháng</h2>
          {isOwner && (
            <button
              onClick={() => { setShowTplEditor(true); setTplForm({ name: "", category: "ELECTRICITY", typicalAmount: "", note: "" }); }}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
            >
              + Thêm
            </button>
          )}
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có khoản nào. {isOwner ? "Thêm 'Tiền điện', 'Tiền nước', 'Thuê mặt bằng'... để app nhắc anh mỗi tháng." : ""}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <div className="text-sm">
                  <div className="font-semibold text-slate-800">{CATEGORY_META[t.category]?.emoji} {t.name}</div>
                  <div className="text-xs text-slate-500">
                    {CATEGORY_META[t.category]?.label}
                    {t.typicalAmount ? ` · ~${Number(t.typicalAmount).toLocaleString("vi-VN")}₫/tháng` : ""}
                    {t.note ? ` · ${t.note}` : ""}
                  </div>
                </div>
                {isOwner && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setTplForm({
                          id: t.id,
                          name: t.name,
                          category: t.category,
                          typicalAmount: t.typicalAmount ? Number(t.typicalAmount).toLocaleString("vi-VN") : "",
                          note: t.note ?? "",
                        });
                        setShowTplEditor(true);
                      }}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Sửa
                    </button>
                    <button onClick={() => removeTemplate(t)} className="text-xs font-semibold text-rose-600 hover:underline">
                      Xoá
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ============ MODAL XÁC NHẬN XOÁ ============ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">🗑️ Xoá khoản chi</h3>
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-800">
                {CATEGORY_META[deleteTarget.category]?.emoji} {formatVND(Number(deleteTarget.amount || 0))}
              </div>
              <div className="text-xs text-slate-600">
                {CATEGORY_META[deleteTarget.category]?.label} · {formatDate(deleteTarget.at)} · {deleteTarget.note || "—"}
              </div>
            </div>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-semibold text-slate-700">Lý do xoá</span>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                placeholder="Ví dụ: ghi trùng, nhập sai số tiền..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteReason(""); }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Không xoá
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? "Đang xoá..." : "Xoá"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL TEMPLATE ============ */}
      {showTplEditor && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">📌 {tplForm.id ? "Sửa" : "Thêm"} chi cố định</h3>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Tên khoản (VD: Tiền điện)</span>
                <input value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Loại chi</span>
                <select value={tplForm.category} onChange={(e) => setTplForm({ ...tplForm, category: e.target.value as ExpenseCategory })} className="w-full rounded-xl border border-slate-300 px-3 py-2">
                  {CATEGORY_KEYS.map((k) => (
                    <option key={k} value={k}>{CATEGORY_META[k].emoji} {CATEGORY_META[k].label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Số tiền dự kiến/tháng (không bắt buộc)</span>
                <input
                  inputMode="numeric"
                  value={tplForm.typicalAmount}
                  onChange={(e) => setTplForm({ ...tplForm, typicalAmount: formatMoneyInput(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right tabular-nums"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Ghi chú</span>
                <input value={tplForm.note} onChange={(e) => setTplForm({ ...tplForm, note: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowTplEditor(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Đóng
              </button>
              <button onClick={saveTemplate} disabled={tplBusy} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60">
                {tplBusy ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Sub-component: 1 dòng khoản chi ============
function ExpenseRow({
  e,
  canModify,
  onEdit,
  onDelete,
}: {
  e: Expense;
  canModify: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = CATEGORY_META[e.category] ?? { label: e.category, emoji: "📌" };
  return (
    <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      {e.receiptPhoto?.storagePath ? (
        <ReceiptThumb path={e.receiptPhoto.storagePath} />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-2xl">
          {meta.emoji}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate text-sm font-bold text-slate-800">
            {meta.emoji} {meta.label}
          </div>
          <div className="shrink-0 text-sm font-black tabular-nums text-brand-700">{formatVND(Number(e.amount || 0))}</div>
        </div>
        {e.note && <div className="mt-0.5 truncate text-xs text-slate-600">{e.note}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
          <span>{formatDate(e.at)}</span>
          <span>·</span>
          <span>{PAYMENT_LABEL[e.paymentMethod]}</span>
          <span>·</span>
          <span>Trả: {PAID_BY_LABEL[e.paidBy]}{e.paidByName ? ` (${e.paidByName})` : ""}</span>
          <span>·</span>
          <span>Ghi: {e.createdByName ?? "—"} lúc {timeOf(e.createdAt)}</span>
        </div>
      </div>
      {canModify && (
        <div className="flex flex-col gap-1">
          <button onClick={onEdit} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
            Sửa
          </button>
          <button onClick={onDelete} className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">
            Xoá
          </button>
        </div>
      )}
    </li>
  );
}

function isTooOld(e: Expense): boolean {
  const t = toJsDate(e.createdAt);
  if (isNaN(t.getTime())) return false;
  return Date.now() - t.getTime() > 24 * 60 * 60 * 1000;
}
