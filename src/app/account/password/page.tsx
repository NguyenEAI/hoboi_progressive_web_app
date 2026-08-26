"use client";

import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { authPersistenceReady } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useToast } from "@/components/Toast";

function changePasswordError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes("wrong-password") || lower.includes("invalid-credential")) {
    return "Mật khẩu hiện tại chưa đúng.";
  }
  if (lower.includes("weak-password")) return "Mật khẩu mới cần có ít nhất 6 ký tự.";
  if (lower.includes("too-many-requests")) return "Bạn thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.";
  if (lower.includes("requires-recent-login")) return "Phiên đăng nhập đã quá lâu. Vui lòng đăng xuất, đăng nhập lại rồi đổi mật khẩu.";
  if (lower.includes("network")) return "Mạng đang chập chờn. Vui lòng kiểm tra mạng rồi thử lại.";
  return "Chưa đổi được mật khẩu. Vui lòng thử lại hoặc dùng Quên mật khẩu ở màn đăng nhập.";
}

function backPath(role?: string) {
  if (role === "OWNER" || role === "RECEPTIONIST") return "/admin";
  if (role === "COACH") return "/coach";
  return "/profile";
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const { fbUser, profile, loading } = useAuthUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState("");

  useEffect(() => {
    if (!loading && !fbUser) router.replace("/signin");
  }, [fbUser, loading, router]);

  async function submit() {
    if (!fbUser) return;
    if (!currentPassword) {
      setHelp("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (newPassword.length < 6) {
      setHelp("Mật khẩu mới cần có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setHelp("Hai lần nhập mật khẩu mới chưa giống nhau.");
      return;
    }
    if (newPassword === currentPassword) {
      setHelp("Mật khẩu mới cần khác mật khẩu hiện tại.");
      return;
    }
    if (!fbUser.email) {
      setHelp("Tài khoản này chưa có mật khẩu để xác nhận. Vui lòng đăng xuất và dùng Quên mật khẩu.");
      return;
    }

    setBusy(true);
    setHelp("");
    try {
      await authPersistenceReady;
      const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
      await reauthenticateWithCredential(fbUser, credential);
      await updatePassword(fbUser, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      toast.show("Đã đổi mật khẩu thành công", "success");
      router.replace(backPath(profile?.role));
    } catch (error) {
      setHelp(changePasswordError(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !fbUser || !profile) {
    return <main className="p-6 text-center text-sm text-slate-500">Đang tải tài khoản…</main>;
  }

  const inputType = showPassword ? "text" : "password";

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-slate-50 px-5 py-6">
      <button onClick={() => router.replace(backPath(profile.role))} className="btn-ghost -ml-2 text-brand-700">
        <ArrowLeft className="size-4" /> Quay lại
      </button>

      <section className="mt-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-float">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <KeyRound className="size-6" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-900">Đổi mật khẩu</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Tài khoản: <b className="text-slate-700">{profile.fullName || profile.phone}</b>
        </p>

        <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-slate-500">Mật khẩu hiện tại</label>
        <input
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          type={inputType}
          autoComplete="current-password"
          className="input mt-1.5 py-4"
          placeholder="Nhập mật khẩu đang dùng"
        />

        <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">Mật khẩu mới</label>
        <input
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          type={inputType}
          autoComplete="new-password"
          className="input mt-1.5 py-4"
          placeholder="Ít nhất 6 ký tự"
        />

        <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">Nhập lại mật khẩu mới</label>
        <input
          value={newPasswordConfirm}
          onChange={(event) => setNewPasswordConfirm(event.target.value)}
          type={inputType}
          autoComplete="new-password"
          className="input mt-1.5 py-4"
          placeholder="Nhập lại mật khẩu mới"
        />

        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="mt-3 flex items-center gap-2 text-xs font-bold text-brand-700"
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        </button>

        {help && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-relaxed text-rose-800">{help}</div>}

        <button onClick={submit} disabled={busy} className="btn-primary mt-6 w-full py-4 font-bold">
          {busy ? "Đang đổi mật khẩu…" : "Đổi mật khẩu"}
        </button>

        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" />
          Mật khẩu chỉ được đổi khi bạn nhập đúng mật khẩu hiện tại. Nếu quên, hãy dùng “Quên mật khẩu?” ở màn đăng nhập để nhận OTP.
        </p>
      </section>
    </main>
  );
}
