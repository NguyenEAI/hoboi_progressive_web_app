"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";

const tabs = [
  { href: "/coach", label: "Hôm nay", icon: "🏠" },
  { href: "/coach/students", label: "Học viên", icon: "👥" },
];

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  async function handleLogout() {
    if (!confirm("Đăng xuất khỏi tài khoản HLV?")) return;
    await signOut(auth);
    router.replace("/");
  }

  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="text-sm font-bold text-brand-700">HLV</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          aria-label="Đăng xuất"
        >
          <LogOut className="size-3.5" /> Đăng xuất
        </button>
      </header>
      {children}
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md border-t bg-white">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href}
            className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-xs", path === t.href ? "text-brand-700" : "text-slate-400")}>
            <span className="text-lg">{t.icon}</span>{t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
