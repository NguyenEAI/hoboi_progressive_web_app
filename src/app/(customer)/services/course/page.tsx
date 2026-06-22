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

type HourGroup = { startHour: number; endHour: number; remainingMin: number; weekdays: number[] };

function nextOccurrence(weekdays: number[], startHour: number, weekOffset: number): Date {
  const base = new Date();
  base.setDate(base.getDate() + weekOffset * 7);
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const wd = d.getDay();
    if (!weekdays.includes(wd)) continue;
    if (i === 0 && weekOffset === 0 && new Date().getHours() >= startHour) continue;
    d.setHours(startHour, 0, 0, 0);
    return d;
  }
  return new Date(NaN);
}

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
  const [hour, setHour] = useState<HourGroup>();
  const [weekOffset, setWeekOffset] = useState(0);
  const [studentId, setStudentId] = useState<string>("self");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [orderId, setOrderId] = useState<string>();

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
      .then((s) => setSlots(s.docs.map((d) => d.data() as CoachSlot)));
  }, [coachId]);

  const coach = coaches.find((c) => c.id === coachId);

  // Gộp slots theo startHour. HLV dạy 3 weekday giống nhau ở mỗi giờ → 1 dòng/giờ.
  const hourGroups: HourGroup[] = useMemo(() => {
    const m = new Map<number, HourGroup>();
    for (const s of slots) {
      const g = m.get(s.startHour) ?? {
        startHour: s.startHour, endHour: s.endHour,
        remainingMin: SLOT_CAPACITY, weekdays: [],
      };
      g.weekdays.push(s.weekday);
      g.remainingMin = Math.min(g.remainingMin, Math.max(0, (s.capacity ?? SLOT_CAPACITY) - (s.enrolledCount ?? 0)));
      m.set(s.startHour, g);
    }
    return [...m.values()].sort((a, b) => a.startHour - b.startHour);
  }, [slots]);

  const suggestedDate = useMemo(() =>
    hour && coach ? nextOccurrence(coach.weekdays, hour.startHour, weekOffset) : null,
    [hour, coach, weekOffset]);

  async function submit() {
    if (!profile || !style || !coachId || !hour) return;
    setBusy(true); setMsg(undefined);
    const child = children.find((c) => c.id === studentId);
    try {
      const { orderId } = await createOrder({
        productType: "SWIM_COURSE", swimStyle: style, coachId,
        startHour: hour.startHour, weekOffset,
        beneficiaryKind: child ? "CHILD" : "USER",
        beneficiaryId: child ? child.id : profile.id,
        beneficiaryName: child ? child.fullName : profile.fullName,
      });
      setOrderId(orderId);
      setMsg(`Đã tạo đơn (mã ${orderId.slice(0, 6)}). Vui lòng thanh toán tại quầy để kích hoạt khóa học.`);
      setStep(5);
    } catch (e) { setMsg("Lỗi: " + (e as Error).message); } finally { setBusy(false); }
  }

  const stepLabels = ["Chọn kiểu bơi", "Chọn HLV", "Chọn khung giờ", "Xác nhận"];

  return (
    <main className="mx-auto max-w-md pb-28">
      <header className="border-b bg-white p-4">
        <button onClick={() => (step > 1 && step < 5 ? setStep(step - 1) : router.back())}
          className="text-sm text-brand-700">← Đăng ký khóa học</button>
        {step < 5 && (
          <>
            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className={`h-1.5 flex-1 rounded ${n <= step ? "bg-brand-600" : "bg-slate-200"}`} />
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Bước {step}/4 — {stepLabels[step - 1]}
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
                  <div className="text-xs text-slate-500">{c.weekdays.map((w) => WEEKDAY_LABELS[w as 0]).join(" · ")}</div>
                </div>
              </button>
            ))}
            {!coaches.length && <p className="text-center text-slate-400">Chưa có HLV.</p>}
          </div>
        )}

        {/* B3 khung giờ — gộp theo startHour, hiển thị weekday chung */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
              HLV: <b>{coach?.fullName}</b> · Lịch: {coach?.weekdays.map((w) => WEEKDAY_LABELS[w as 0]).join(" · ")}
            </div>
            <p className="text-xs text-slate-500">
              Khóa học diễn ra cùng giờ vào các ngày cố định của thầy. Chọn 1 khung giờ phù hợp với bạn.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {hourGroups.map((g) => {
                const full = g.remainingMin <= 0;
                const selected = hour?.startHour === g.startHour;
                return (
                  <button key={g.startHour} disabled={full}
                    onClick={() => { setHour(g); setStep(4); }}
                    className={`rounded-xl border-2 p-3 text-left text-sm ${
                      full ? "border-slate-200 bg-slate-50 opacity-60"
                        : selected ? "border-brand-500 bg-white" : "border-slate-200 bg-white"}`}>
                    <div className="text-base font-bold">{g.startHour}h–{g.endHour}h</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {g.weekdays.sort().map((w) => WEEKDAY_LABELS[w as 0]).join(" · ")}
                    </div>
                    <div className={`mt-1 text-xs ${full ? "text-red-600" : "text-green-600"}`}>
                      {full ? "Hết chỗ" : `Còn ${g.remainingMin} chỗ`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* B4 xác nhận — có student select + ±1 tuần */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Học cho</label>
              <div className="mt-1 space-y-2">
                <Radio label={`${profile?.fullName} (bản thân)`} checked={studentId === "self"} onClick={() => setStudentId("self")} />
                {children.map((c) => (
                  <Radio key={c.id} label={`${c.fullName} (con)`} checked={studentId === c.id} onClick={() => setStudentId(c.id)} />
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <Sum l="Kiểu bơi" v={`${SWIM_STYLES.find((s) => s.id === style)?.emoji} ${SWIM_STYLES.find((s) => s.id === style)?.label}`} />
              <Sum l="HLV" v={coach?.fullName ?? ""} />
              <Sum l="Khung giờ" v={hour ? `${hour.startHour}h–${hour.endHour}h · ${coach?.weekdays.map((w) => WEEKDAY_LABELS[w as 0]).join(" · ")}` : ""} />
              <Sum l="Số buổi" v="15 buổi · hết hạn sau 90 ngày" />
              <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold text-brand-700">
                <span>Tổng</span><span>{formatVND(pricing.swimCourse)}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Ngày học đầu tiên</div>
                  <div className="font-semibold text-amber-900">
                    {suggestedDate && !isNaN(suggestedDate.getTime())
                      ? suggestedDate.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
                      : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button disabled={weekOffset === 0}
                    onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                    className="rounded-lg border-2 border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 disabled:opacity-40">−1 tuần</button>
                  <button disabled={weekOffset >= 4}
                    onClick={() => setWeekOffset((w) => Math.min(4, w + 1))}
                    className="rounded-lg border-2 border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 disabled:opacity-40">+1 tuần</button>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Hệ thống tự chọn ngày dạy gần nhất. Nếu muốn lùi, dùng nút ±tuần (giới hạn 4 tuần).
              </p>
            </div>

            <button disabled={busy} onClick={submit}
              className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white disabled:opacity-50">
              {busy ? "Đang tạo đơn…" : "Xác nhận đăng ký"}
            </button>
            <p className="text-center text-xs text-slate-400">Đơn ở trạng thái chờ thanh toán tại quầy</p>
          </div>
        )}

        {/* B5 done */}
        {step === 5 && (
          <div className="rounded-2xl bg-brand-50 p-6 text-center">
            <div className="text-5xl">🎉</div>
            <div className="mt-2 font-semibold text-brand-800">Đăng ký thành công!</div>
            <p className="mt-1 text-sm text-slate-600">{msg}</p>
            {orderId && (
              <p className="mt-2 text-xs text-slate-500">Mã đơn: <b className="font-mono">{orderId.slice(0, 6)}</b></p>
            )}
            <button onClick={() => router.push("/home")} className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white">Về trang chủ</button>
          </div>
        )}

        {msg && step !== 5 && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{msg}</p>}
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
