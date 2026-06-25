"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const GROUPS: { title: string; items: { href: string; label: string; ownerOnly?: boolean }[] }[] = [
  { title: "Vận hành", items: [
    { href: "/admin", label: "🏠 Dashboard" },
    { href: "/admin/orders", label: "📋 Đơn hàng" },
    { href: "/admin/qr-gate", label: "🚪 Màn hình QR cổng" },
    { href: "/admin/checkin-assist", label: "📷 Điểm danh hộ" },
  ]},
  { title: "Quản lý", items: [
    { href: "/admin/customers", label: "👥 Khách hàng" },
    { href: "/admin/coaches", label: "🏊 Huấn luyện viên", ownerOnly: true },
    { href: "/admin/staff", label: "⚙️ Nhân viên & Quyền", ownerOnly: true },
    { href: "/admin/products", label: "📦 Sản phẩm & Giá", ownerOnly: true },
  ]},
  { title: "Phân tích", items: [
    { href: "/admin/reports", label: "📊 Báo cáo", ownerOnly: true },
  ]},
];

export function AdminSidebar() {
  const path = usePathname();
  const router = useRouter();
  const { profile } = useAuthUser();
  const isOwner = profile?.role === "OWNER";

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto bg-brand-900 p-4 text-sm text-brand-100 shadow-[4px_0_24px_rgba(2,44,34,0.15)] border-r border-brand-800/40">
      <div className="mb-4 flex items-center gap-3 border-b border-brand-800/50 px-1 pb-4">
        <Logo size={42} glow />
        <div className="leading-tight">
          <div className="font-extrabold tracking-tight text-white text-[15px]">Prosper Plaza</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Quản trị viên</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {GROUPS.map((g) => (
          <div key={g.title} className="space-y-1">
            <div className="px-3 pb-1.5 pt-4 text-[9px] font-black uppercase tracking-[0.18em] text-brand-400/80">{g.title}</div>
            {g.items.filter((i) => !i.ownerOnly || isOwner).map((i) => {
              const active = path === i.href;
              return (
                <Link key={i.href} href={i.href}
                  className={cn(
                    "block rounded-xl px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200",
                    active 
                      ? "bg-brand-700/80 text-white shadow-md border border-brand-500/20 ring-1 ring-brand-400/20" 
                      : "text-brand-300 hover:text-white hover:bg-brand-800/55"
                  )}>
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-4 shrink-0 border-t border-brand-800/50 px-1 pt-4 text-xs text-brand-300">
        <div className="mb-2 font-bold text-brand-100 text-[11px] uppercase tracking-wider">{profile?.fullName} <span className="opacity-60">· {profile?.role}</span></div>
        <button
          onClick={async () => { await signOut(auth); router.replace("/"); }}
          className="w-full rounded-xl bg-brand-800/60 px-3.5 py-2.5 text-center font-bold text-[11.5px] uppercase tracking-wider text-rose-200 hover:bg-rose-900/40 hover:text-white transition-all border border-rose-950/20"
        >
          Đăng xuất →
        </button>
      </div>
    </aside>
  );
}
