"use client";

import { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  RecaptchaVerifier,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { WavePattern, FloatingOrbs } from "@/components/Decorations";
import { POOL_INFO } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { normalizeVNPhone, isValidVNPhone10 } from "@/lib/phone";
import { InstallAppCard } from "@/components/InstallAppCard";
import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  completeCustomerRegistration,
  prepareCustomerRegistration,
  resetCustomerPasswordAfterOtp,
} from "@/lib/callable";

type Mode = "login" | "signup" | "forgot" | "reset";

function phoneLoginEmail(phone: string) {
  return `phone-${normalizeVNPhone(phone).replace(/\D/g, "")}@login.hoboiapp.com`;
}

function passwordErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes("invalid-credential") || lower.includes("wrong-password") || lower.includes("user-not-found")) {
    return "Số điện thoại hoặc mật khẩu chưa đúng.";
  }
  if (lower.includes("email-already-in-use")) {
    return "Số điện thoại này đã có tài khoản. Vui lòng đăng nhập hoặc chọn Quên mật khẩu.";
  }
  if (lower.includes("already-exists")) {
    return raw.replace(/^FirebaseError:\s*/i, "") || "Số điện thoại này đã có tài khoản. Vui lòng đăng nhập hoặc chọn Quên mật khẩu.";
  }
  if (lower.includes("weak-password")) return "Mật khẩu cần có ít nhất 6 ký tự.";
  if (lower.includes("too-many-requests")) return "Bạn thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.";
  if (lower.includes("network")) return "Mạng đang chập chờn. Vui lòng kiểm tra mạng rồi thử lại.";
  return "Chưa thực hiện được lúc này. Vui lòng thử lại hoặc báo lễ tân hỗ trợ.";
}

export default function SignInPage() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [help, setHelp] = useState("");
  const phoneRef = useRef<HTMLInputElement>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const needsOtp = mode === "forgot";
  const isPasswordMode = mode === "login" || mode === "signup" || mode === "reset";

  useEffect(() => {
    if (!needsOtp) return;
    const timer = window.setTimeout(() => getRecaptchaVerifier(), 0);
    return () => window.clearTimeout(timer);
  }, [needsOtp]);

  useEffect(() => () => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  }, []);

  function updatePhone(value: string) {
    const next = value.replace(/\D/g, "").slice(0, 10);
    setPhone(next);
    return next;
  }

  function resetCaptcha() {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
    setCaptchaVerified(false);
  }

  function getRecaptchaVerifier() {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha", {
        size: "normal",
        callback: () => {
          setCaptchaVerified(true);
          setHelp("");
        },
        "expired-callback": () => {
          setCaptchaVerified(false);
          setHelp("Ô xác nhận bảo mật đã hết hạn. Vui lòng tick lại.");
        },
        "error-callback": () => {
          setCaptchaVerified(false);
          setHelp("Ô xác nhận bảo mật chưa tải được. Vui lòng tải lại trang rồi thử lại.");
        },
      });
      recaptchaRef.current.render().catch(() => setCaptchaVerified(false));
    }
    return recaptchaRef.current;
  }

  function changeMode(next: Mode) {
    resetCaptcha();
    setMode(next);
    setHelp("");
    setCode("");
    setConfirm(null);
    setOtpVerified(false);
    setPassword("");
    setPasswordConfirm("");
  }

  function checkPhone() {
    const currentPhone = updatePhone(phoneRef.current?.value ?? phone);
    if (!isValidVNPhone10(currentPhone)) {
      setHelp("Vui lòng nhập đủ 10 số điện thoại bắt đầu bằng 0.");
      return null;
    }
    return currentPhone;
  }

  async function ensureCustomerProfile(user: User, currentPhone: string) {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: user.uid,
        fullName: "",
        phone: normalizeVNPhone(currentPhone),
        role: "CUSTOMER",
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  async function loginWithPassword() {
    const currentPhone = checkPhone();
    if (!currentPhone) return;
    if (!password) {
      setHelp("Vui lòng nhập mật khẩu.");
      return;
    }
    setBusy(true);
    setHelp("");
    try {
      const { user } = await signInWithEmailAndPassword(auth, phoneLoginEmail(currentPhone), password);
      await ensureCustomerProfile(user, currentPhone);
      const profile = await getDoc(doc(db, "users", user.uid));
      const role = profile.data()?.role;
      toast.show("Chào mừng trở lại! 🌊", "success");
      router.replace(role === "OWNER" || role === "RECEPTIONIST" ? "/admin" : role === "COACH" ? "/coach" : "/home");
    } catch (e) {
      setHelp(passwordErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function createPasswordAccount() {
    const currentPhone = checkPhone();
    if (!currentPhone) return;
    if (password.length < 6) {
      setHelp("Mật khẩu cần có ít nhất 6 ký tự.");
      return;
    }
    if (password !== passwordConfirm) {
      setHelp("Hai lần nhập mật khẩu chưa giống nhau.");
      return;
    }
    setBusy(true);
    setHelp("");
    let createdForCleanup: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>["user"] | null = null;
    try {
      await prepareCustomerRegistration({ phone: currentPhone });
      const created = await createUserWithEmailAndPassword(auth, phoneLoginEmail(currentPhone), password);
      createdForCleanup = created.user;
      await completeCustomerRegistration({ phone: currentPhone });
      toast.show("Tạo tài khoản thành công", "success");
      router.replace("/profile");
    } catch (e) {
      if (createdForCleanup) {
        await deleteUser(createdForCleanup).catch(() => undefined);
        await signOut(auth).catch(() => undefined);
      }
      setHelp(passwordErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendResetOtp() {
    const currentPhone = checkPhone();
    if (!currentPhone) return;
    if (!captchaVerified) {
      setHelp("Vui lòng tick vào ô xác nhận bảo mật trước khi gửi mã.");
      return;
    }
    setBusy(true);
    setHelp("");
    try {
      const result = await signInWithPhoneNumber(auth, normalizeVNPhone(currentPhone), getRecaptchaVerifier());
      setConfirm(result);
      resetCaptcha();
      setHelp("Nhập mã 6 số đã gửi đến điện thoại để đặt mật khẩu mới.");
    } catch (e) {
      resetCaptcha();
      window.setTimeout(() => getRecaptchaVerifier(), 300);
      setHelp("Chưa gửi được mã xác nhận. Vui lòng thử lại sau hoặc dùng lối vào tạm thời.");
      console.error("Password reset OTP failed", e);
    } finally {
      setBusy(false);
    }
  }

  async function verifyResetOtp() {
    if (!confirm || code.length !== 6) {
      setHelp("Vui lòng nhập đủ 6 số trong mã xác nhận.");
      return;
    }
    setBusy(true);
    try {
      await confirm.confirm(code);
      setOtpVerified(true);
      setMode("reset");
      setCode("");
      setHelp("Đặt mật khẩu mới cho số điện thoại này.");
    } catch {
      setHelp("Mã xác nhận chưa đúng hoặc đã hết hạn.");
    } finally {
      setBusy(false);
    }
  }

  async function finishPasswordReset() {
    const currentPhone = checkPhone();
    if (!currentPhone || !otpVerified) return;
    if (password.length < 6) {
      setHelp("Mật khẩu cần có ít nhất 6 ký tự.");
      return;
    }
    if (password !== passwordConfirm) {
      setHelp("Hai lần nhập mật khẩu chưa giống nhau.");
      return;
    }
    setBusy(true);
    try {
      await resetCustomerPasswordAfterOtp({ phone: currentPhone, password });
      await signOut(auth).catch(() => undefined);
      const { user } = await signInWithEmailAndPassword(auth, phoneLoginEmail(currentPhone), password);
      await ensureCustomerProfile(user, currentPhone);
      toast.show("Đã đặt mật khẩu mới", "success");
      router.replace("/home");
    } catch (e) {
      setHelp(passwordErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function enterTemporaryAccess() {
    const currentPhone = checkPhone();
    if (!currentPhone) return;
    setBusy(true);
    setHelp("");
    try {
      const { user } = await signInAnonymously(auth);
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        fullName: "",
        phone: normalizeVNPhone(currentPhone),
        role: "CUSTOMER",
        active: true,
        temporaryAccess: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      router.replace("/home");
    } catch {
      setHelp("Chưa vào tạm được. Vui lòng báo lễ tân hỗ trợ.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Đăng nhập" : mode === "signup" ? "Tạo tài khoản" : mode === "forgot" ? "Quên mật khẩu" : "Đặt mật khẩu mới";
  const subtitle = mode === "login"
    ? "Dùng số điện thoại và mật khẩu để vào app"
    : mode === "signup"
      ? "Tạo mật khẩu một lần, lần sau không cần chờ mã OTP"
      : mode === "forgot"
        ? "Mã OTP chỉ dùng để xác nhận khi đặt lại mật khẩu"
        : "Mật khẩu mới sẽ dùng cho các lần đăng nhập sau";
  const Icon = isPasswordMode ? LockKeyhole : KeyRound;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 pt-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-[300px] overflow-hidden">
        <div className="hero-mesh hero-aurora absolute inset-0 opacity-20" />
        <FloatingOrbs />
        <div className="pointer-events-none absolute inset-x-0 -bottom-px text-[#f8fafc]"><WavePattern className="h-12 w-full" /></div>
      </div>

      <button onClick={() => mode === "login" ? router.push("/") : changeMode("login")} className="btn-ghost -ml-1.5 self-start text-brand-700 font-bold hover:bg-brand-50">
        <ArrowLeft className="size-4" strokeWidth={2.5} /> Quay lại
      </button>

      <div className="mt-4 flex flex-col items-center text-center animate-fade-up">
        <Logo size={68} glow />
        <div className="mt-3.5 text-sm font-extrabold tracking-tight text-slate-800">{POOL_INFO.shortName}</div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">HT Bảo Lâm</div>
      </div>

      <div className="card-glass mt-8 flex-1 p-6 border border-brand-100/30 shadow-float bg-white/80">
        <div className="flex items-center gap-2 text-brand-700">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 shadow-sm border border-brand-100"><Icon className="size-4 text-brand-600" /></span>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Tài khoản khách</span>
        </div>
        <div className="animate-fade-up">
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-800">{title}</h1>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{subtitle}</p>

          {mode !== "reset" && (
            <>
              <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-slate-500">Số điện thoại</label>
              <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 shadow-sm transition-all focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
                <span className="flex items-center gap-1.5 border-r border-slate-100 pr-3 text-slate-400 text-sm font-semibold">🇻🇳</span>
                <input ref={phoneRef} value={phone} onChange={(e) => updatePhone(e.target.value)} inputMode="numeric" autoComplete="tel" maxLength={10} className="w-full bg-transparent py-4 outline-none placeholder:text-slate-300 text-base font-semibold tracking-wide text-slate-800 tab-nums" placeholder="0947010978" />
              </div>
              <p className="mt-2 text-[11px] font-medium text-slate-400">Nhập đủ 10 số bắt đầu bằng 0</p>
            </>
          )}

          {isPasswordMode && (
            <>
              <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-slate-500">Mật khẩu</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="input mt-1.5 py-4 font-semibold text-slate-800" placeholder="Ít nhất 6 ký tự" />
              {(mode === "signup" || mode === "reset") && <>
                <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">Nhập lại mật khẩu</label>
                <input value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} type="password" autoComplete="new-password" className="input mt-1.5 py-4 font-semibold text-slate-800" placeholder="Nhập lại mật khẩu" />
              </>}
            </>
          )}

          {mode === "forgot" && (
            <>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <p className="mb-2 text-[11px] font-semibold leading-relaxed text-slate-500">Tick ô xác nhận bảo mật trước khi gửi mã đặt lại mật khẩu.</p>
                <div className="flex min-h-[78px] justify-center overflow-hidden rounded-xl bg-slate-50 px-1 py-2"><div id="recaptcha" /></div>
              </div>
              {confirm && <>
                <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-slate-500">Mã xác nhận</label>
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-center text-3xl font-extrabold tracking-[0.5em] text-brand-800 outline-none transition-all focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10" placeholder="••••••" />
              </>}
            </>
          )}

          {help && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-relaxed text-rose-800">{help}</div>}

          {mode === "login" && <button onClick={loginWithPassword} disabled={busy} className="btn-primary mt-6 w-full py-4 text-sm font-bold tracking-wide">{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>}
          {mode === "signup" && <button onClick={createPasswordAccount} disabled={busy} className="btn-primary mt-6 w-full py-4 text-sm font-bold tracking-wide">{busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</button>}
          {mode === "forgot" && !confirm && <button onClick={sendResetOtp} disabled={busy || !captchaVerified} className="btn-primary mt-6 w-full py-4 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-45">{busy ? "Đang gửi mã…" : captchaVerified ? "Gửi mã đặt lại mật khẩu" : "Tick xác nhận bảo mật trước"}</button>}
          {mode === "forgot" && confirm && <button onClick={verifyResetOtp} disabled={busy || code.length < 6} className="btn-primary mt-6 w-full py-4 text-sm font-bold tracking-wide">{busy ? "Đang xác nhận…" : "Xác nhận mã"}</button>}
          {mode === "reset" && <button onClick={finishPasswordReset} disabled={busy} className="btn-primary mt-6 w-full py-4 text-sm font-bold tracking-wide">{busy ? "Đang lưu mật khẩu…" : "Lưu mật khẩu mới"}</button>}

          {mode === "login" && <div className="mt-5 flex items-center justify-between text-xs font-bold">
            <button onClick={() => changeMode("signup")} className="text-brand-700 hover:text-brand-900">Tạo tài khoản mới</button>
            <button onClick={() => changeMode("forgot")} className="text-brand-700 hover:text-brand-900">Quên mật khẩu?</button>
          </div>}
          {mode === "forgot" && <button onClick={enterTemporaryAccess} disabled={busy} className="mt-5 w-full text-center text-xs font-bold text-brand-700 underline decoration-brand-300 underline-offset-4 disabled:text-slate-300">OTP vẫn lỗi? Vào app tạm thời</button>}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400"><ShieldCheck className="size-3.5 text-brand-500" /> Mật khẩu được bảo vệ · Không lưu trong hồ sơ khách</p>
        </div>
      </div>

      <div className="mt-4"><InstallAppCard compact /></div>
    </main>
  );
}
