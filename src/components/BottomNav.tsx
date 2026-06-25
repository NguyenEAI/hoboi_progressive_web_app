"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CreditCard, QrCode, User, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const left = [
  { href: "/home", label: "Trang chủ", icon: Home },
  { href: "/cards", label: "Thẻ", icon: CreditCard },
];
const right = [
  { href: "/services", label: "Dịch vụ", icon: ShoppingBag },
  { href: "/profile", label: "Hồ sơ", icon: User },
];

export function BottomNav() {
  const p = usePathname() ?? "";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Floating CTA Check-in QR */}
      <Link
        href="/checkin"
        aria-label="Quét QR check-in"
        className="absolute left-1/2 -top-7 z-10 flex h-15 w-15 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-brand-600 to-brand-700 text-white shadow-[0_8px_20px_rgba(5,150,105,0.4)] ring-4 ring-white transition-all duration-200 active:scale-90"
      >
        <span aria-hidden className="nav-halo" />
        <QrCode className="size-6.5 text-white" strokeWidth={2.4} />
      </Link>

      {/* Bar with smooth glassmorphism */}
      <div className="border-t border-slate-100/70 bg-white/90 backdrop-blur-md shadow-[0_-8px_30px_rgba(15,23,42,0.06)]">
        <ul className="grid grid-cols-5 items-end">
          {left.map((it) => (
            <NavItem key={it.href} item={it} active={p.startsWith(it.href)} />
          ))}
          <li aria-hidden className="h-12" />
          {right.map((it) => (
            <NavItem key={it.href} item={it} active={p.startsWith(it.href)} />
          ))}
        </ul>
      </div>
    </nav>
  );
}

function NavItem({
  item,
  active,
}: {
  item: { href: string; label: string; icon: typeof Home };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "relative flex flex-col items-center gap-1.5 py-3 text-[10px] font-extrabold uppercase tracking-wider transition-colors",
          active ? "text-brand-700 font-extrabold" : "text-slate-400 hover:text-slate-600 font-semibold"
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-2xl transition-all",
            active && "bg-brand-50 shadow-sm border border-brand-100/30 text-brand-600"
          )}
        >
          <Icon className="size-[17px]" strokeWidth={active ? 2.6 : 2} />
        </span>
        <span className="text-[9.5px] tracking-wide">{item.label}</span>
        {active && (
          <span className="absolute -top-px h-[3px] w-6 rounded-b-full bg-brand-600 shadow-[0_1px_4px_rgba(5,150,105,0.4)]" />
        )}
      </Link>
    </li>
  );
}
