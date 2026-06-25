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
  // v2.5: khách KHÔNG được tự đổi tên. Chỉ owner/lễ tân đổi qua /admin/customers.
  // Trường hợp đặc biệt: nếu fullName trống (mới đăng nhập chưa qua bước Tên), cho phép set lần đầu.
  const canEditName = !profile?.fullName?.trim();

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
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-5 py-8 text-white shadow-md">
        <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-white/10 text-3xl ring-1 ring-white/20 backdrop-blur shadow-inner">
            👤
          </span>
          <div className="flex-1">
            <div className="text-xl font-extrabold tracking-tight text-shadow-sm">{profile.fullName || <span className="opacity-75 font-normal">(Chưa đặt tên)</span>}</div>
            <div className="text-xs font-semibold text-emerald-100/80 mt-0.5 tracking-wide">{profile.phone}</div>
            <div className="mt-2 inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest ring-1 ring-white/20">
              {profile.role}
            </div>
          </div>
          {!editing && canEditName && (
            <button
              onClick={() => { setName(profile.fullName ?? ""); setEditing(true); }}
              className="rounded-xl bg-white/15 px-3 py-2 text-xs ring-1 ring-white/25 active:bg-white/35 transition-all shadow-sm"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
        </div>
        {editing && (
          <div className="relative mt-4 animate-fade-up rounded-2xl bg-white p-4 text-slate-900 shadow-float">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Họ và tên</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="input mt-1.5" placeholder="Vd: Nguyễn Văn A" />
            <div className="mt-4 flex gap-2.5">
              <button onClick={() => setEditing(false)} className="btn-secondary flex-1 py-2.5 text-xs">Hủy</button>
              <button onClick={saveName} disabled={!name.trim()}
                className="btn-primary flex-1 py-2.5 text-xs">Lưu</button>
            </div>
          </div>
        )}
      </header>

      <div className="space-y-3.5 p-4 mt-2">
        {!canEditName && (
          <div className="rounded-xl border border-slate-100 bg-white/50 p-3.5 text-[11px] font-semibold text-slate-500 shadow-sm flex gap-2">
            <span>ℹ️</span>
            <span>Để đổi tên hiển thị trên thẻ, vui lòng liên hệ trực tiếp lễ tân tại hồ bơi.</span>
          </div>
        )}
        <Item href="/cards" icon={<CreditCard className="size-5" />} label="Thẻ của tôi" />
        <Item href="/children" icon={<Baby className="size-5" />} label="Con của tôi" />
        <Item href="/notifications" icon={<Bell className="size-5" />} label="Thông báo" />
        <Item href="/services" icon={<ShoppingBag className="size-5" />} label="Mua dịch vụ & khóa bơi" />

        {isIOS && !isStandalone && (
          <div className="card mt-5 animate-fade-up border border-brand-100 bg-gradient-to-br from-brand-50/50 to-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-extrabold text-brand-800">
              📱 Cài app vào màn hình chính
            </div>
            <ol className="mt-3.5 space-y-2 text-xs font-medium text-slate-600">
              <li className="flex items-start gap-1.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-brand-100 text-brand-700 font-bold text-[10px]">1</span>
                <span>Bấm nút <Share className="inline size-3.5 mx-0.5 text-slate-500" /> <b>Chia sẻ</b> trong Safari</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-brand-100 text-brand-700 font-bold text-[10px]">2</span>
                <span>Cuộn xuống chọn <Plus className="inline size-3.5 mx-0.5 text-slate-500" /> <b>Thêm vào MH chính</b></span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-brand-100 text-brand-700 font-bold text-[10px]">3</span>
                <span>Mở ứng dụng từ icon ngoài màn hình chính</span>
              </li>
            </ol>
          </div>
        )}

        <button
          onClick={async () => { await signOut(auth); router.replace("/"); }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/40 p-4 font-bold text-rose-600 active:bg-rose-50 transition-colors"
        >
          <LogOut className="size-4" strokeWidth={2.5} /> Đăng xuất tài khoản
        </button>

        <div className="mt-10 flex flex-col items-center text-center text-xs text-slate-400 font-semibold">
          <Logo size={36} />
          <div className="mt-3 text-slate-600">Hồ Bơi Prosper Plaza</div>
          <div className="text-[10px] text-slate-400 font-normal mt-0.5">CÔNG TY TNHH HT BẢO LÂM</div>
        </div>
      </div>
    </main>
  );
}

function Item({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="card-interactive flex items-center gap-3.5 p-4.5 border border-slate-100 bg-white">
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shadow-sm border border-brand-100/20">{icon}</span>
      <span className="flex-1 font-bold text-slate-700 text-sm">{label}</span>
      <ChevronRight className="size-4 text-slate-300" strokeWidth={2.5} />
    </Link>
  );
}
