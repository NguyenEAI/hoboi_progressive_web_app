"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { BackButton } from "@/components/BackButton";
import { CommandPalette } from "@/components/CommandPalette";
import { useAuthUser } from "@/lib/hooks/useAuthUser";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { profile, loading } = useAuthUser();
  const isRoot = pathname === "/admin";
  const isStaff = profile?.role === "OWNER" || profile?.role === "RECEPTIONIST";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Đóng drawer khi chuyển trang
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/signin");
    } else if (!isStaff) {
      router.replace(profile.role === "COACH" ? "/coach" : "/home");
    }
  }, [isStaff, loading, profile, router]);

  if (loading || !profile || !isStaff) {
    return <div className="min-h-screen bg-slate-50 p-6 text-sm font-semibold text-slate-500">Đang kiểm tra quyền truy cập…</div>;
  }

  return (
    <div className="flex min-h-screen items-start">
      <AdminSidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <main className="min-w-0 flex-1 bg-slate-50">
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200/70 bg-white/90 px-3 py-2 backdrop-blur lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Mở menu"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ☰
          </button>
          {!isRoot && (
            <>
              <BackButton fallback="/admin" />
            </>
          )}
          <div className="ml-auto"><CommandPalette /></div>
        </div>
        <div className="sticky top-0 z-10 hidden items-center gap-2 border-b border-slate-200/70 bg-white/90 px-4 py-2 backdrop-blur lg:flex">
          {!isRoot && (
            <>
              <BackButton fallback="/admin" />
              <span className="text-sm font-medium text-slate-600">Quay lại</span>
            </>
          )}
          <div className="ml-auto"><CommandPalette /></div>
        </div>
        <div className="p-3 md:p-6">{children}</div>
      </main>
    </div>
  );
}
