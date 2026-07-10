"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { BackButton } from "@/components/BackButton";
import { useAuthUser } from "@/lib/hooks/useAuthUser";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { profile, loading } = useAuthUser();
  const isRoot = pathname === "/admin";
  const isStaff = profile?.role === "OWNER" || profile?.role === "RECEPTIONIST";

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
      <AdminSidebar />
      <main className="min-w-0 flex-1 bg-slate-50">
        {!isRoot && (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200/70 bg-white/90 px-3 py-2 backdrop-blur">
            <BackButton fallback="/admin" />
            <span className="text-sm font-medium text-slate-600">Quay lại</span>
          </div>
        )}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
