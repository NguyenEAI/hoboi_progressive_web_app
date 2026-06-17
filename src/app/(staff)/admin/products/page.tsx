"use client";
import { useEffect, useState } from "react";
import { AUDIENCES, PASS_DURATIONS, PACKAGE_SIZES, SWIM_STYLES } from "@/lib/constants";
import { formatVND } from "@/lib/utils";
import { usePricing } from "@/lib/hooks/usePricing";
import { updatePricing } from "@/lib/callable";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import type { PricingSettings } from "@/types/pricing";
import type { Audience, PassDuration, PackageSize } from "@/types";

export default function ProductsPage() {
  const { profile } = useAuthUser();
  const { pricing, loading } = usePricing();
  const [draft, setDraft] = useState<PricingSettings>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  useEffect(() => { if (!draft && !loading) setDraft(structuredClone(pricing)); }, [pricing, loading, draft]);

  if (profile && profile.role !== "OWNER")
    return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">🔒 Chỉ Owner được sửa giá.</p>;

  if (!draft) return <p className="text-slate-500">Đang tải bảng giá…</p>;

  function setPass(a: Audience, d: PassDuration, v: number) {
    setDraft((prev) => prev && ({ ...prev, pass: { ...prev.pass, [a]: { ...prev.pass[a], [d]: v } } }));
  }
  function setPkg(a: Audience, s: PackageSize, v: number) {
    setDraft((prev) => prev && ({ ...prev, package: { ...prev.package, [a]: { ...prev.package[a], [s]: v } } }));
  }
  function setCourse(v: number) { setDraft((prev) => prev && ({ ...prev, swimCourse: v })); }
  function setSingle(key: keyof PricingSettings["singleTicket"], v: number) {
    setDraft((prev) => prev && ({ ...prev, singleTicket: { ...prev.singleTicket, [key]: v } }));
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(pricing);

  async function save() {
    if (!draft) return;
    setBusy(true); setMsg(undefined);
    try {
      await updatePricing({ pricing: draft });
      setMsg("✅ Đã lưu. Khách hàng thấy giá mới ngay lập tức.");
    } catch (e) { setMsg("❌ " + (e as Error).message); } finally { setBusy(false); }
  }
  function reset() { setDraft(structuredClone(pricing)); setMsg(undefined); }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">Sản phẩm &amp; Giá</h1>
          <p className="text-sm text-slate-500">Sửa giá ở đây — khách hàng thấy thay đổi ngay lập tức.</p>
        </div>
        <div className="flex gap-2">
          {dirty && <button onClick={reset} className="rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold">Hủy</button>}
          <button onClick={save} disabled={!dirty || busy}
            className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Đang lưu…" : dirty ? "💾 Lưu thay đổi" : "Đã đồng bộ"}
          </button>
        </div>
      </header>

      {msg && <div className="mt-3 rounded-xl bg-slate-100 p-3 text-sm">{msg}</div>}

      <Section title="Vé thời hạn (không giới hạn lượt)">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-brand-700">
            <tr><th className="p-3">Đối tượng</th>{PASS_DURATIONS.map((d) => <th key={d.id} className="p-3">{d.label}</th>)}</tr>
          </thead>
          <tbody>
            {AUDIENCES.map((a) => (
              <tr key={a.id} className="border-t border-slate-50">
                <td className="p-3 font-semibold">{a.emoji} {a.label}</td>
                {PASS_DURATIONS.map((d) => (
                  <td key={d.id} className="p-2">
                    <PriceInput value={draft.pass[a.id as Audience][d.id as PassDuration]}
                      onChange={(v) => setPass(a.id as Audience, d.id as PassDuration, v)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Gói lượt (trừ 1 lượt / lần)">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-brand-700">
            <tr><th className="p-3">Đối tượng</th>{PACKAGE_SIZES.map((s) => <th key={s.id} className="p-3">{s.label}</th>)}<th className="p-3">Ai được dùng</th></tr>
          </thead>
          <tbody>
            {AUDIENCES.map((a) => (
              <tr key={a.id} className="border-t border-slate-50">
                <td className="p-3 font-semibold">{a.emoji} {a.label}</td>
                {PACKAGE_SIZES.map((s) => (
                  <td key={s.id} className="p-2">
                    <PriceInput value={draft.package[a.id as Audience][s.id as PackageSize]}
                      onChange={(v) => setPkg(a.id as Audience, s.id as PackageSize, v)} />
                  </td>
                ))}
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${a.id === "ADULT" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                    {a.id === "ADULT" ? "Mọi đối tượng" : "Chỉ trẻ em"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Khóa học bơi (15 buổi · 90 ngày · giá phẳng cho 4 kiểu)">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <label className="text-sm">Giá khóa học:</label>
            <PriceInput value={draft.swimCourse} onChange={setCourse} className="w-40" />
            <span className="text-xs text-slate-500">áp dụng cho cả 4 kiểu: {SWIM_STYLES.map((s) => s.emoji).join(" ")}</span>
          </div>
        </div>
      </Section>

      <Section title="Vé lẻ (tham khảo, bán tại quầy)">
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
          <Field label="🧒 Trẻ <1.4m" value={draft.singleTicket.CHILD_UNDER_140} onChange={(v) => setSingle("CHILD_UNDER_140", v)} />
          <Field label="🧑 Trẻ >1.4m" value={draft.singleTicket.CHILD_OVER_140} onChange={(v) => setSingle("CHILD_OVER_140", v)} />
          <Field label="🧔 Người lớn" value={draft.singleTicket.ADULT} onChange={(v) => setSingle("ADULT", v)} />
          <Field label="NL + bé <2t" value={draft.singleTicket.ADULT_WITH_TODDLER} onChange={(v) => setSingle("ADULT_WITH_TODDLER", v)} />
        </div>
      </Section>

      <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        💡 Đơn hàng đã PAID giữ nguyên giá lúc mua (đóng băng). Chỉ đơn mới dùng giá mới.
      </p>
    </div>
  );
}

function PriceInput({ value, onChange, className = "" }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <div className={`flex items-center rounded-lg border-2 border-slate-200 bg-white px-2 ${className}`}>
      <input type="number" min={0} step={10000} value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-transparent p-1.5 text-right tabular-nums outline-none" />
      <span className="text-xs text-slate-400">₫</span>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <PriceInput value={value} onChange={onChange} />
      <div className="mt-0.5 text-[10px] text-slate-400">{formatVND(value)}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">{children}</div>
    </section>
  );
}
