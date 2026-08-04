"use client";
import { useState } from "react";
import { sendPromotion } from "@/lib/callable";
import { StaffPhoneAutocomplete } from "@/components/StaffPhoneAutocomplete";

const AUDIENCES = [
  { id: "TEST_PHONE", label: "Gửi thử theo SĐT" },
  { id: "ALL", label: "Tất cả khách" },
  { id: "PACKAGE", label: "Khách có vé lượt" },
  { id: "PASS", label: "Khách có vé tháng/quý/năm" },
  { id: "PARENTS", label: "Phụ huynh có bé" },
  { id: "COURSE", label: "Học viên khóa bơi" },
] as const;

export default function PromotionsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["id"]>("TEST_PHONE");
  const [testPhone, setTestPhone] = useState("0900000002");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [err, setErr] = useState<string>();
  const canSend = title.trim() && body.trim() && (audience !== "TEST_PHONE" || testPhone.trim());

  async function submit() {
    if (!canSend) return;
    setBusy(true); setMsg(undefined); setErr(undefined);
    try {
      const r = await sendPromotion({ title: title.trim(), body: body.trim(), audience, testPhone: testPhone.trim() || undefined });
      setMsg(`Đã gửi ${r.notified} thông báo.`);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <h1 className="text-2xl font-bold text-brand-800">Khuyến mãi / thông báo</h1>
        <p className="text-sm text-slate-500">Tạo nội dung, chọn nhóm nhận, xem trước rồi gửi. Khi test nên dùng gửi thử theo SĐT.</p>
      </header>
      <section className="mt-5 rounded-3xl border border-white/80 bg-white p-5 shadow-sm">
        <label className="block text-sm font-bold text-slate-600">Tiêu đề</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 p-3" placeholder="Ví dụ: Ưu đãi cuối tuần" />
        <label className="mt-4 block text-sm font-bold text-slate-600">Nội dung</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="mt-1 w-full rounded-xl border-2 border-slate-200 p-3" placeholder="Nhập nội dung khách sẽ thấy trong app" />
        <label className="mt-4 block text-sm font-bold text-slate-600">Nhóm nhận</label>
        <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className="mt-1 w-full rounded-xl border-2 border-slate-200 p-3">
          {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        {audience === "TEST_PHONE" && (
          <>
            <label className="mt-4 block text-sm font-bold text-slate-600">SĐT gửi thử</label>
            <StaffPhoneAutocomplete value={testPhone} onChange={setTestPhone} className="mt-1 w-full rounded-xl border-2 border-slate-200 p-3" />
          </>
        )}
        <div className="mt-5 rounded-2xl bg-brand-50 p-4">
          <div className="text-xs font-bold uppercase text-brand-700">Xem trước</div>
          <div className="mt-2 rounded-2xl bg-white p-4 shadow-sm">
            <div className="font-extrabold text-slate-900">{title || "Tiêu đề khuyến mãi"}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{body || "Nội dung khách sẽ đọc trong app."}</div>
          </div>
        </div>
        {msg && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{msg}</div>}
        {err && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{err}</div>}
        <button onClick={submit} disabled={!canSend || busy} className="mt-5 w-full rounded-2xl bg-brand-600 py-3 font-extrabold text-white disabled:opacity-50">
          {busy ? "Đang gửi..." : "Gửi thông báo"}
        </button>
      </section>
    </div>
  );
}
