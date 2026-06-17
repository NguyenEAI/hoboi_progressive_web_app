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
      {/* Floating CTA */}
      <Link
        href="/checkin"
        aria-label="Quét QR check-in"
        className="absolute left-1/2 -top-6 z-10 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-elevated ring-4 ring-white"
      >
        {p.startsWith("/checkin") && <span aria-hidden className="nav-halo" />}
        <QrCode className="size-7" strokeWidth={2.3} />
      </Link>

      {/* Bar */}
      <div className="border-t border-slate-200/60 surface-glass">
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
          "relative flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-medium transition-colors",
          active ? "text-brand-700" : "text-slate-400 hover:text-slate-600"
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-2xl transition-all",
            active && "bg-brand-100 shadow-sm"
          )}
        >
          <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
        </span>
        {item.label}
        {active && (
          <span className="absolute -top-px h-0.5 w-6 rounded-full bg-brand-600" />
        )}
      </Link>
    </li>
  );
}
