"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/coach", label: "Hôm nay", icon: "🏠" },
  { href: "/coach/students", label: "Học viên", icon: "👥" },
];

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
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
