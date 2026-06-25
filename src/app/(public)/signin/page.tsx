"use client";
import { useEffect, useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { WavePattern, FloatingOrbs } from "@/components/Decorations";
import { POOL_INFO } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { normalizeVNPhone, isValidVNPhone10 } from "@/lib/phone";
import { ArrowLeft, ShieldCheck, Phone, KeyRound, User as UserIcon } from "lucide-react";

type Step = "phone" | "otp" | "name";

export default function SignInPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [uid, setUid] = useState<string>();
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "otp" && otpRef.current) otpRef.current.focus();
  }, [step]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendOtp() {
    if (!isValidVNPhone10(phone)) {
      toast.show("Vui lòng nhập đủ 10 số bắt đầu bằng 0", "error");
      return;
    }
    setBusy(true);
    try {
      const verifier = new RecaptchaVerifier(auth, "recaptcha", { size: "invisible" });
      const e164 = normalizeVNPhone(phone);
      setConfirm(await signInWithPhoneNumber(auth, e164, verifier));
      setStep("otp");
      setResendIn(60);
      toast.show(`Đã gửi OTP đến ${e164}`, "success");
    } catch (e) {
      toast.show((e as Error).message, "error");
    } finally { setBusy(false); }
  }

  function landingFor(role?: string) {
    if (role === "OWNER" || role === "RECEPTIONIST") return "/admin";
    if (role === "COACH") return "/coach";
    return "/home";
  }

  async function verifyOtp() {
    setBusy(true);
    try {
      const cred = await confirm!.confirm(code);
      const u = cred.user;
      setUid(u.uid);
      await u.getIdToken(true);
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const existingName = (snap.data().fullName as string) ?? "";
        const role = snap.data().role as string;
        if (existingName.trim()) {
          toast.show("Chào mừng trở lại! 🌊", "success");
          router.replace(landingFor(role));
          return;
        }
      }
      setStep("name");
    } catch (e) { toast.show((e as Error).message, "error"); } finally { setBusy(false); }
  }

  async function saveName() {
    if (!uid || !name.trim()) return;
    setBusy(true);
    try {
      await setDoc(doc(db, "users", uid), { fullName: name.trim() }, { merge: true });
      const snap = await getDoc(doc(db, "users", uid));
      toast.show("Tạo tài khoản thành công 🎉", "success");
      router.replace(landingFor(snap.data()?.role));
    } catch (e) { toast.show((e as Error).message, "error"); } finally { setBusy(false); }
  }

  const stepIndex = step === "phone" ? 0 : step === "otp" ? 1 : 2;
  const stepIcon = step === "phone" ? Phone : step === "otp" ? KeyRound : UserIcon;
  const StepIcon = stepIcon;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 pt-8">
      {/* Animated decoration */}
      <div className="absolute inset-x-0 top-0 -z-10 h-[300px] overflow-hidden">
        <div className="hero-mesh hero-aurora absolute inset-0 opacity-20" />
        <FloatingOrbs />
        <div className="pointer-events-none absolute inset-x-0 -bottom-px text-[#f8fafc]">
          <WavePattern className="h-12 w-full" />
        </div>
      </div>

      {step !== "name" && (
        <button
          onClick={() => (step === "otp" ? setStep("phone") : router.push("/"))}
          className="btn-ghost -ml-1.5 self-start text-brand-700 font-bold hover:bg-brand-50"
        >
          <ArrowLeft className="size-4" strokeWidth={2.5} /> Quay lại
        </button>
      )}

      <div className="mt-4 flex flex-col items-center text-center animate-fade-up">
        <Logo size={68} glow />
        <div className="mt-3.5 text-sm font-extrabold tracking-tight text-slate-800">{POOL_INFO.shortName}</div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">HT Bảo Lâm</div>
      </div>

      {/* Step indicator */}
      <div className="mx-auto mt-6 flex w-44 items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              i <= stepIndex ? "bg-brand-500 shadow-[0_0_8px_rgba(5,150,105,0.4)]" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      <div className="card-glass mt-5 flex-1 p-6 border border-brand-100/30 shadow-float bg-white/80">
        <div className="flex items-center gap-2 text-brand-700">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 shadow-sm border border-brand-100">
            <StepIcon className="size-4 text-brand-600" />
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
            Bước {stepIndex + 1}/3
          </span>
        </div>

        {step === "phone" && (
          <div className="animate-fade-up">
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-800">
              Đăng nhập
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Nhập số điện thoại để nhận mã OTP xác thực
            </p>

            <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-slate-500">Số điện thoại</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 shadow-sm transition-all focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
              <span className="flex items-center gap-1.5 border-r border-slate-100 pr-3 text-slate-400 text-sm font-semibold">
                <span aria-hidden>🇻🇳</span>
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                className="w-full bg-transparent py-4 outline-none placeholder:text-slate-300 text-base font-semibold tracking-wide text-slate-800 tab-nums"
                placeholder="0947010978"
              />
            </div>
            <p className="mt-2 text-[11px] font-medium text-slate-400">
              Nhập đủ 10 số bắt đầu bằng 0 (ví dụ: 0947010978)
            </p>

            <button
              onClick={sendOtp}
              disabled={busy || !isValidVNPhone10(phone)}
              className="btn-primary mt-6 w-full py-4 text-sm font-bold tracking-wide"
            >
              {busy ? "Đang gửi OTP…" : "Gửi mã OTP"}
            </button>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
              <ShieldCheck className="size-3.5 text-brand-500" />
              Bảo mật bằng OTP · Không lưu mật khẩu
            </p>
          </div>
        )}

        {step === "otp" && (
          <div className="animate-fade-up">
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-800">
              Nhập mã OTP
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Mã xác nhận 6 số đã được gửi tới <b className="text-slate-700 font-semibold">{normalizeVNPhone(phone)}</b>
            </p>

            <input
              ref={otpRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="mt-6 w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-center text-3xl font-extrabold tracking-[0.5em] text-brand-800 outline-none transition-all focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
              placeholder="••••••"
            />

            <button
              onClick={verifyOtp}
              disabled={busy || code.length < 6}
              className="btn-primary mt-6 w-full py-4 text-sm font-bold tracking-wide"
            >
              {busy ? "Đang xác nhận…" : "Xác nhận & Tiếp tục"}
            </button>

            <div className="mt-5 flex items-center justify-between text-xs font-semibold">
              <button
                onClick={() => { setStep("phone"); setConfirm(null); setCode(""); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                Đổi số điện thoại
              </button>
              {resendIn > 0 ? (
                <span className="text-slate-400">Gửi lại sau {resendIn}s</span>
              ) : (
                <button onClick={sendOtp} className="text-brand-600 hover:text-brand-800 transition-colors">
                  Gửi lại mã OTP
                </button>
              )}
            </div>
          </div>
        )}

        {step === "name" && (
          <div className="animate-fade-up">
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-800">
              Hoàn tất hồ sơ
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Vui lòng cho biết họ và tên để in lên thẻ hội viên
            </p>

            <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-slate-500">Họ và tên</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="input mt-1.5 py-4 font-semibold text-slate-800"
              placeholder="Vd: Nguyễn Văn A"
            />

            <button
              onClick={saveName}
              disabled={busy || !name.trim()}
              className="btn-primary mt-6 w-full py-4 text-sm font-bold tracking-wide"
            >
              {busy ? "Đang hoàn tất…" : "Hoàn tất đăng ký"}
            </button>
          </div>
        )}
      </div>

      <div id="recaptcha" />
    </main>
  );
}
