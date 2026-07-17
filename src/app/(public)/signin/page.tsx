"use client";
import { useEffect, useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { WavePattern, FloatingOrbs } from "@/components/Decorations";
import { POOL_INFO } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { normalizeVNPhone, isValidVNPhone10 } from "@/lib/phone";
import { InstallAppCard } from "@/components/InstallAppCard";
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
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [otpHelp, setOtpHelp] = useState<string>("");
  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const sendingOtpRef = useRef(false);

  useEffect(() => {
    if (step === "otp" && otpRef.current) otpRef.current.focus();
  }, [step]);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsInAppBrowser(/tiktok|bytedance|fbav|fb_iab|instagram|zalo|line|micromessenger/.test(ua));
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  function updatePhone(value: string) {
    const next = value.replace(/\D/g, "").slice(0, 10);
    setPhone(next);
    return next;
  }

  function getRecaptchaVerifier() {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha", { size: "invisible" });
    }
    return recaptchaRef.current;
  }

  function resetRecaptchaVerifier() {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  }

  function currentWebAddress() {
    if (typeof window === "undefined") return "không rõ";
    return window.location.hostname || window.location.origin || "không rõ";
  }

  function otpErrorMessage(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    const lower = raw.toLowerCase();
    if (lower.includes("auth/captcha-check-failed") || lower.includes("hostname match not found")) {
      const host = currentWebAddress();
      return `Địa chỉ web này chưa được mở quyền gửi mã OTP: ${host}. Vui lòng chụp màn hình này gửi lễ tân để hồ bơi mở quyền.`;
    }
    if (lower.includes("auth/too-many-requests")) return "Số này vừa yêu cầu mã quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.";
    if (lower.includes("auth/invalid-phone-number")) return "Số điện thoại chưa đúng. Vui lòng nhập đủ 10 số bắt đầu bằng 0.";
    if (lower.includes("auth/quota-exceeded")) return "Hôm nay hệ thống gửi mã quá nhiều. Vui lòng báo lễ tân để hồ bơi kiểm tra lại.";
    return raw;
  }

  async function sendOtp(retry = true) {
    if (sendingOtpRef.current) return;
    const currentPhone = updatePhone(phoneRef.current?.value ?? phone);
    if (!isValidVNPhone10(currentPhone)) {
      toast.show("Vui lòng nhập đủ 10 số bắt đầu bằng 0", "error");
      return;
    }
    sendingOtpRef.current = true;
    setOtpHelp("");
    setBusy(true);
    try {
      const e164 = normalizeVNPhone(currentPhone);
      setConfirm(await signInWithPhoneNumber(auth, e164, getRecaptchaVerifier()));
      setStep("otp");
      setResendIn(60);
      toast.show(`Đã gửi OTP đến ${e164}`, "success");
    } catch (e) {
      const message = otpErrorMessage(e);
      if (retry && message.toLowerCase().includes("recaptcha")) {
        resetRecaptchaVerifier();
        sendingOtpRef.current = false;
        setBusy(false);
        await sendOtp(false);
        return;
      }
      setOtpHelp(message);
      toast.show(message, "error");
    } finally {
      sendingOtpRef.current = false;
      setBusy(false);
    }
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
      const ref = doc(db, "users", uid);
      const before = await getDoc(ref);
      const previous = before.data();
      await setDoc(ref, {
        id: uid,
        fullName: name.trim(),
        phone: previous?.phone ?? normalizeVNPhone(phone),
        role: previous?.role ?? "CUSTOMER",
        active: previous?.active ?? true,
        createdAt: previous?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      const snap = await getDoc(ref);
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
                ref={phoneRef}
                value={phone}
                onChange={(e) => updatePhone(e.target.value)}
                onInput={(e) => updatePhone((e.target as HTMLInputElement).value)}
                onKeyUp={(e) => updatePhone((e.target as HTMLInputElement).value)}
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

            {isInAppBrowser && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-800">
                Nếu đang mở từ TikTok/Facebook/Zalo, hãy bấm dấu <b>…</b> rồi chọn <b>Mở bằng Safari/Chrome</b> trước khi nhận mã OTP.
              </div>
            )}

            {otpHelp && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-relaxed text-rose-800">
                {otpHelp}
              </div>
            )}

            <button
              onClick={() => sendOtp()}
              disabled={busy}
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
                <button onClick={() => sendOtp()} disabled={busy} className="text-brand-600 hover:text-brand-800 transition-colors disabled:text-slate-300">
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

      <div className="mt-4">
        <InstallAppCard compact />
      </div>

      <div id="recaptcha" />
    </main>
  );
}
