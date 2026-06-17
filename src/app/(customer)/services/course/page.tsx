"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { createOrder } from "@/lib/callable";
import { SWIM_STYLES, SLOT_CAPACITY, WEEKDAY_LABELS } from "@/lib/constants";
import { usePricing } from "@/lib/hooks/usePricing";
import { formatVND } from "@/lib/utils";
import type { Coach, CoachSlot, SwimStyle, Child } from "@/types";

export default function CourseWizard() {
  const router = useRouter();
  const { profile } = useAuthUser();
  const { pricing } = usePricing();
  const [step, setStep] = useState(1);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [slots, setSlots] = useState<CoachSlot[]>([]);

  const [style, setStyle] = useState<SwimStyle>();
  const [coachId, setCoachId] = useState<string>();
  const [slot, setSlot] = useState<CoachSlot>();
  const [startDate, setStartDate] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("self");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    getDocs(query(collection(db, "coaches"), where("active", "==", true)))
      .then((s) => setCoaches(s.docs.map((d) => d.data() as Coach)));
  }, []);
  useEffect(() => {
    if (!profile) return;
    getDocs(collection(db, `users/${profile.id}/children`))
      .then((s) => setChildren(s.docs.map((d) => ({ id: d.id, ...d.data() } as Child))));
  }, [profile]);
  useEffect(() => {
    if (!coachId) return;
    getDocs(collection(db, `coaches/${coachId}/slots`))
      .then((s) => setSlots(s.docs.map((d) => d.data() as CoachSlot).sort((a, b) => a.weekday - b.weekday || a.startHour - b.startHour)));
  }, [coachId]);

  const coach = coaches.find((c) => c.id === coachId);
  const slotsByDay = useMemo(() => {
    const m = new Map<number, CoachSlot[]>();
    slots.forEach((s) => { (m.get(s.weekday) ?? m.set(s.weekday, []).get(s.weekday)!).push(s); });
    return m;
  }, [slots]);

  async function submit() {
    if (!profile || !style || !coachId || !slot || !startDate) return;
    setBusy(true); setMsg(undefined);
    const child = children.find((c) => c.id === studentId);
    try {
      const { orderId } = await createOrder({
        productType: "SWIM_COURSE", swimStyle: style, coachId, slotId: slot.id, startDate,
        beneficiaryKind: child ? "CHILD" : "USER",
        beneficiaryId: child ? child.id : profile.id,
        beneficiaryName: child ? child.fullName : profile.fullName,
      });
      setMsg(`Đã tạo đơn (mã ${orderId.slice(0, 6)}). Vui lòng thanh toán tại quầy để kích hoạt khóa học.`);
      setStep(6);
    } catch (e) { setMsg("Lỗi: " + (e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-md pb-28">
      <header className="border-b bg-white p-4">
        <button onClick={() => (step > 1 && step < 6 ? setStep(step - 1) : router.back())}
          className="text-sm text-brand-700">← Đăng ký khóa học</button>
        {step < 6 && (
          <>
            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className={`h-1.5 flex-1 rounded ${n <= step ? "bg-brand-600" : "bg-slate-200"}`} />
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Bước {step}/5 — {["Chọn kiểu bơi", "Chọn HLV", "Chọn khung giờ", "Ngày bắt đầu", "Xác nhận"][step - 1]}
            </div>
          </>
        )}
      </header>

      <div className="p-4">
        {/* B1 kiểu bơi */}
        {step === 1 && (
          <div className="space-y-3">
            {SWIM_STYLES.map((s) => (
              <button key={s.id} onClick={() => { setStyle(s.id); setStep(2); }}
                className={`flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ${style === s.id ? "ring-2 ring-brand-500" : ""}`}>
                <span className="text-4xl">{s.emoji}</span>
                <div className="flex-1">
                  <div className="font-semibold">{s.label}</div>
                  {s.recommended && <div className="text-[11px] font-semibold text-emerald-700">⭐ Khuyên cho người mới</div>}
                </div>
                <div className="font-bold text-brand-700">{formatVND(pricing.swimCourse)}</div>
              </button>
            ))}
          </div>
        )}

        {/* B2 HLV */}
        {step === 2 && (
          <div className="space-y-3">
            {coaches.map((c) => (
              <button key={c.id} onClick={() => { setCoachId(c.id); setStep(3); }}
                className={`flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ${coachId === c.id ? "ring-2 ring-brand-500" : ""}`}>
                <span className="text-3xl">🏊</span>
                <div className="flex-1">
                  <div className="font-semibold">{c.fullName}</div>
                  <div className="text-xs text-slate-500">{c.weekdays.map((w) => WEEKDAY_LABELS[w]).join(" · ")}</div>
                </div>
              </button>
            ))}
            {!coaches.length && <p className="text-center text-slate-400">Chưa có HLV. (Cần seed dữ liệu)</p>}
          </div>
        )}

        {/* B3 khung giờ */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600">HLV: <b>{coach?.fullName}</b></div>
            {[...slotsByDay.entries()].map(([wd, list]) => (
              <div key={wd}>
                <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{WEEKDAY_LABELS[wd as 0]}</div>
                <div className="grid grid-cols-2 gap-2">
                  {list.map((s) => {
                    const full = s.enrolledCount >= s.capacity;
                    return (
                      <button key={s.id} disabled={full} onClick={() => { setSlot(s); setStep(4); }}
                        className={`rounded-xl border-2 p-3 text-left text-sm ${
                          full ? "border-slate-200 bg-slate-50 opacity-60"
                            : slot?.id === s.id ? "border-brand-500 bg-white" : "border-slate-200 bg-white"}`}>
                        <div className="font-semibold">{s.startHour}:00–{s.endHour}:00</div>
                        <div className={`text-xs ${full ? "text-red-600" : "text-green-600"}`}>
                          {s.enrolledCount}/{SLOT_CAPACITY}{full ? " · đầy" : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* B4 ngày bắt đầu + học cho ai */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Ngày bắt đầu</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-3" />
            </div>
            <div>
              <label className="text-sm font-medium">Học cho</label>
              <div className="mt-1 space-y-2">
                <Radio label={`${profile?.fullName} (bản thân)`} checked={studentId === "self"} onClick={() => setStudentId("self")} />
                {children.map((c) => (
                  <Radio key={c.id} label={`${c.fullName} (con)`} checked={studentId === c.id} onClick={() => setStudentId(c.id)} />
                ))}
              </div>
            </div>
            <button disabled={!startDate} onClick={() => setStep(5)}
              className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50">Tiếp tục →</button>
          </div>
        )}

        {/* B5 xác nhận */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <Sum l="Kiểu bơi" v={`${SWIM_STYLES.find((s) => s.id === style)?.emoji} ${SWIM_STYLES.find((s) => s.id === style)?.label}`} />
              <Sum l="HLV" v={coach?.fullName ?? ""} />
              <Sum l="Khung giờ" v={slot ? `${slot.startHour}:00–${slot.endHour}:00 (${WEEKDAY_LABELS[slot.weekday]})` : ""} />
              <Sum l="Ngày bắt đầu" v={startDate} />
              <Sum l="Học cho" v={children.find((c) => c.id === studentId)?.fullName ?? `${profile?.fullName} (bản thân)`} />
              <Sum l="Số buổi" v="15 buổi · hết hạn sau 90 ngày" />
              <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold text-brand-700">
                <span>Tổng</span><span>{formatVND(pricing.swimCourse)}</span>
              </div>
            </div>
            <button disabled={busy} onClick={submit}
              className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white disabled:opacity-50">
              {busy ? "Đang tạo đơn…" : "Xác nhận đăng ký"}
            </button>
            <p className="text-center text-xs text-slate-400">Đơn sẽ ở trạng thái chờ thanh toán tại quầy</p>
          </div>
        )}

        {/* B6 done */}
        {step === 6 && (
          <div className="rounded-2xl bg-brand-50 p-6 text-center">
            <div className="text-5xl">🎉</div>
            <div className="mt-2 font-semibold text-brand-800">Đăng ký thành công!</div>
            <p className="mt-1 text-sm text-slate-600">{msg}</p>
            <button onClick={() => router.push("/home")} className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white">Về trang chủ</button>
          </div>
        )}

        {msg && step !== 6 && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{msg}</p>}
      </div>
    </main>
  );
}

const Radio = ({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) => (
  <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left ${checked ? "border-brand-500 bg-white" : "border-slate-200 bg-white"}`}>
    <span className={`flex size-5 items-center justify-center rounded-full border-2 ${checked ? "border-brand-600" : "border-slate-300"}`}>
      {checked && <span className="size-2.5 rounded-full bg-brand-600" />}
    </span>
    {label}
  </button>
);
const Sum = ({ l, v }: { l: string; v: string }) => (
  <div className="flex justify-between py-0.5 text-sm"><span className="text-slate-500">{l}</span><b className="text-right">{v}</b></div>
);
