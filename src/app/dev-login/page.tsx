"use client";
import { useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";

const ACCOUNTS = [
  { label: "Khách test", phone: "0900000001", code: "111111" },
  { label: "Phụ huynh test", phone: "0900000002", code: "222222" },
  { label: "Lễ tân test", phone: "0900000003", code: "333333" },
  { label: "Owner anh Nguyên", phone: "0947010978", code: "123456" },
  { label: "Khách 0857", phone: "0857906079", code: "123456" },
  { label: "Khách 0999", phone: "0999999999", code: "111111" },
];

function landingFor(role?: string) {
  if (role === "OWNER" || role === "RECEPTIONIST") return "/admin";
  if (role === "COACH") return "/coach";
  return "/home";
}

export default function DevLoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Chọn tài khoản test để vào app.");

  async function login(phone: string) {
    setMessage("Đang vào app...");
    const res = await fetch(`/api/dev-login?phone=${encodeURIComponent(phone)}`);
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Không vào được tài khoản test");
      return;
    }
    const cred = await signInWithCustomToken(auth, data.token);
    await cred.user.getIdToken(true);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    router.replace(landingFor((snap.data()?.role as string | undefined) ?? data.role));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <div>
        <div className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">Kiểm thử nội bộ</div>
        <h1 className="mt-1 text-3xl font-extrabold text-brand-900">Vào app bằng tài khoản test</h1>
        <p className="mt-2 text-sm text-slate-500">Trang này chỉ dùng trên máy test, không dành cho khách thật.</p>
      </div>
      <div className="space-y-3">
        {ACCOUNTS.map((a) => (
          <button key={a.phone} onClick={() => login(a.phone)} className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 hover:bg-brand-50">
            <div className="font-bold text-brand-900">{a.label}</div>
            <div className="text-sm text-slate-500">{a.phone} · mã {a.code}</div>
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{message}</div>
    </main>
  );
}
