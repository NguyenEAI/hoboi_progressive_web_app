"use client";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useToast } from "@/components/Toast";
import { CreditCard, Baby, Bell, ShoppingBag, LogOut, ChevronRight, Pencil, Share, Plus } from "lucide-react";

export default function ProfilePage() {
  const { profile, loading } = useAuthUser();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    setIsIOS(/iPhone|iPad|iPod/i.test(ua));
    const standalone = typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
       // @ts-expect-error iOS Safari property
       window.navigator.standalone);
    setIsStandalone(!!standalone);
  }, []);

  if (loading || !profile) {
    return <main className="p-6 text-slate-500">Đang tải…</main>;
  }

  async function saveName() {
    if (!profile || !name.trim()) return;
    try {
      await setDoc(doc(db, "users", profile.id), { fullName: name.trim() }, { merge: true });
      toast.show("Đã cập nhật tên 👍", "success");
      setEditing(false);
    } catch (e) { toast.show((e as Error).message, "error"); }
  }

  return (
    <main className="mx-auto max-w-md">
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 px-5 py-7 text-white">
        <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-white/20 text-3xl ring-1 ring-white/30 backdrop-blur">
            👤
          </span>
          <div className="flex-1">
            <div className="text-lg font-bold">{profile.fullName || <span className="opacity-70">(Chưa đặt tên)</span>}</div>
            <div className="text-sm opacity-80">{profile.phone}</div>
            <div className="mt-1 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-white/30">
              {profile.role}
            </div>
          </div>
          {!editing && (
            <button
              onClick={() => { setName(profile.fullName ?? ""); setEditing(true); }}
              className="rounded-xl bg-white/20 px-2.5 py-1.5 text-xs ring-1 ring-white/30 active:bg-white/30"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
        </div>
        {editing && (
          <div className="relative mt-3 animate-fade-up rounded-2xl bg-white p-3 text-slate-900">
            <label className="text-xs font-medium text-slate-600">Họ và tên</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="input mt-1" placeholder="Vd: Nguyễn Văn A" />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditing(false)} className="btn-secondary flex-1 py-2">Hủy</button>
              <button onClick={saveName} disabled={!name.trim()}
                className="btn-primary flex-1 py-2">Lưu</button>
            </div>
          </div>
        )}
      </header>

      <div className="space-y-2 p-4">
        <Item href="/cards" icon={<CreditCard className="size-5" />} label="Thẻ của tôi" />
        <Item href="/children" icon={<Baby className="size-5" />} label="Con của tôi" />
        <Item href="/notifications" icon={<Bell className="size-5" />} label="Thông báo" />
        <Item href="/services" icon={<ShoppingBag className="size-5" />} label="Mua vé / Đăng ký" />

        {isIOS && !isStandalone && (
          <div className="card mt-4 animate-fade-up border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-800">
              📱 Cài app vào màn hình chính
            </div>
            <ol className="mt-2 space-y-1.5 text-xs text-slate-600">
              <li>1. Bấm nút <Share className="inline size-3.5" /> <b>Chia sẻ</b> trong Safari</li>
              <li>2. Cuộn xuống tìm <Plus className="inline size-3.5" /> <b>Thêm vào màn hình chính</b></li>
              <li>3. Mở app từ icon mới để nhận thông báo</li>
            </ol>
          </div>
        )}

        <button
          onClick={async () => { await signOut(auth); router.replace("/"); }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-white p-4 font-semibold text-red-600 active:bg-red-50"
        >
          <LogOut className="size-4" /> Đăng xuất
        </button>

        <div className="mt-8 flex flex-col items-center text-center text-xs text-slate-400">
          <Logo size={36} />
          <div className="mt-2">Hồ Bơi Prosper Plaza</div>
          <div>CÔNG TY TNHH HT BẢO LÂM</div>
        </div>
      </div>
    </main>
  );
}

function Item({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="card-interactive flex items-center gap-3 p-4">
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</span>
      <span className="flex-1 font-medium text-slate-800">{label}</span>
      <ChevronRight className="size-4 text-slate-300" />
    </Link>
  );
}
