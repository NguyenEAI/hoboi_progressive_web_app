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

  function normalizePhone(input: string) {
    if (input.startsWith("+")) return input;
    return "+84" + input.replace(/\D/g, "").replace(/^0/, "");
  }

  async function sendOtp() {
    setBusy(true);
    try {
      const verifier = new RecaptchaVerifier(auth, "recaptcha", { size: "invisible" });
      const e164 = normalizePhone(phone);
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
        <div className="pointer-events-none absolute inset-x-0 -bottom-px text-slate-50">
          <WavePattern className="h-12 w-full" />
        </div>
      </div>

      {step !== "name" && (
        <button
          onClick={() => (step === "otp" ? setStep("phone") : router.push("/"))}
          className="btn-ghost -ml-1.5 self-start text-brand-700"
        >
          <ArrowLeft className="size-4" /> Quay lại
        </button>
      )}

      <div className="mt-4 flex flex-col items-center text-center animate-fade-up">
        <Logo size={68} glow />
        <div className="mt-3 text-sm font-semibold text-slate-700">{POOL_INFO.shortName}</div>
        <div className="text-[11px] text-slate-500">HT Bảo Lâm</div>
      </div>

      {/* Step indicator */}
      <div className="mx-auto mt-6 flex w-40 items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i <= stepIndex ? "bg-brand-500" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      <div className="card-glass mt-4 flex-1 p-5 animate-fade-up">
        <div className="flex items-center gap-2 text-brand-700">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100">
            <StepIcon className="size-4" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Bước {stepIndex + 1}/3
          </span>
        </div>

        {step === "phone" && (
          <>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-brand-800">
              Đăng nhập
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Nhập số điện thoại để nhận mã OTP
            </p>

            <label className="mt-6 block text-sm font-medium">Số điện thoại</label>
            <div className="mt-1 flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-3 transition-colors focus-within:border-brand-400">
              <span className="flex items-center gap-1.5 border-r border-slate-200 pr-2.5 text-slate-600">
                <span aria-hidden>🇻🇳</span>
                <span className="font-medium">+84</span>
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                className="w-full bg-transparent p-3 outline-none placeholder:text-slate-400"
                placeholder="905 xxx xxx"
              />
            </div>

            <button
              onClick={sendOtp}
              disabled={busy || phone.replace(/\D/g, "").length < 8}
              className="btn-primary mt-5 w-full"
            >
              {busy ? "Đang gửi…" : "Gửi mã OTP"}
            </button>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="size-3.5 text-brand-500" />
              Bảo mật bằng OTP · Không lưu mật khẩu
            </p>
          </>
        )}

        {step === "otp" && (
          <>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-brand-800">
              Nhập mã OTP
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Mã 6 số đã gửi đến <b className="text-slate-700">{normalizePhone(phone)}</b>
            </p>

            <input
              ref={otpRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="mt-6 w-full rounded-2xl border-2 border-slate-200 bg-white p-4 text-center text-3xl font-bold tracking-[0.5em] outline-none transition-colors focus:border-brand-400"
              placeholder="• • • • • •"
            />

            <button
              onClick={verifyOtp}
              disabled={busy || code.length < 6}
              className="btn-primary mt-5 w-full"
            >
              {busy ? "Đang xác nhận…" : "Xác nhận"}
            </button>

            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                onClick={() => { setStep("phone"); setConfirm(null); setCode(""); }}
                className="text-slate-500"
              >
                Đổi số điện thoại
              </button>
              {resendIn > 0 ? (
                <span className="text-slate-400">Gửi lại sau {resendIn}s</span>
              ) : (
                <button onClick={sendOtp} className="font-semibold text-brand-700">
                  Gửi lại mã
                </button>
              )}
            </div>
          </>
        )}

        {step === "name" && (
          <>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-brand-800">
              Hoàn tất hồ sơ
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cho chúng tôi biết tên để hiển thị trên thẻ hội viên
            </p>

            <label className="mt-6 block text-sm font-medium">Họ và tên</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="input mt-1"
              placeholder="Vd: Nguyễn Văn A"
            />

            <button
              onClick={saveName}
              disabled={busy || !name.trim()}
              className="btn-primary mt-5 w-full"
            >
              {busy ? "Đang lưu…" : "Hoàn tất"}
            </button>
          </>
        )}
      </div>

      <div id="recaptcha" />
    </main>
  );
}
