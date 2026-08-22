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
      {/* Floating CTA Check-in QR — nút chính, nổi bật */}
      <Link
        href="/checkin"
        aria-label="Quét QR check-in"
        className="group absolute left-1/2 -top-8 z-10 flex flex-col items-center -translate-x-1/2"
      >
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-brand-600 to-brand-800 text-white shadow-[0_10px_25px_-4px_rgba(5,150,105,0.55)] ring-[5px] ring-white transition-all duration-200 group-active:scale-90 group-hover:shadow-[0_14px_30px_-4px_rgba(5,150,105,0.7)]">
          <span aria-hidden className="absolute inset-0 rounded-full bg-white/10 animate-ping opacity-40" />
          <QrCode className="relative size-8 text-white drop-shadow" strokeWidth={2.5} />
        </span>
        <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-brand-700">
          Quét QR
        </span>
      </Link>

      {/* Bar with smooth glassmorphism */}
      <div className="border-t border-slate-100/70 bg-white/90 backdrop-blur-md shadow-[0_-8px_30px_rgba(15,23,42,0.06)]">
        <ul className="grid grid-cols-5 items-end">
          {left.map((it) => (
            <NavItem key={it.href} item={it} active={p.startsWith(it.href)} />
          ))}
          <li aria-hidden className="h-16" />
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
