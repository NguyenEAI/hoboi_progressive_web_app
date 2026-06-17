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
    <aside className="flex w-56 flex-col bg-brand-900 p-3 text-sm text-brand-100">
      <div className="mb-3 flex items-center gap-2 border-b border-brand-800 px-1 pb-3">
        <Logo size={40} />
        <div className="leading-tight">
          <div className="font-bold">Prosper Plaza</div>
          <div className="text-xs text-brand-300">Quản trị</div>
        </div>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-brand-400">{g.title}</div>
          {g.items.filter((i) => !i.ownerOnly || isOwner).map((i) => {
            const active = path === i.href;
            return (
              <Link key={i.href} href={i.href}
                className={cn("block rounded-lg px-3 py-2 transition", active ? "bg-brand-700 ring-2 ring-brand-400" : "hover:bg-brand-800")}>
                {i.label}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto border-t border-brand-800 px-1 pt-4 text-xs text-brand-300">
        <div className="font-semibold text-brand-100">{profile?.fullName} · {profile?.role}</div>
        <button onClick={async () => { await signOut(auth); router.replace("/"); }} className="hover:text-white">Đăng xuất →</button>
      </div>
    </aside>
  );
}
