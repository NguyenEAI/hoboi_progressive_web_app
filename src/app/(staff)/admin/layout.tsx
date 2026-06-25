"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { BackButton } from "@/components/BackButton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isRoot = pathname === "/admin";

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
