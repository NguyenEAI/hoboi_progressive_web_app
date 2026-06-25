"use client";

// v2.4.2 (Q1) — Trang chi tiết vé lượt: hiển thị thông tin gói + lịch sử usage (mỗi lần ai vào, mấy lượt).

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import type { TicketPackage } from "@/types";
import { formatDate, toDate } from "@/lib/utils";
import { BackButton } from "@/components/BackButton";
import { PackageCard } from "@/components/MemberCard";
import { Ticket, History, AlertCircle, TrendingDown } from "lucide-react";

const audienceLabel: Record<string, string> = {
  ADULT: "Người lớn",
  CHILD_UNDER_140: "Trẻ <1.4m",
  CHILD_OVER_140: "Trẻ ≥1.4m",
};

export default function PackageDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const { profile } = useAuthUser();
  const [pkg, setPkg] = useState<TicketPackage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, `ticketPackages/${id}`),
      (snap) => {
        if (snap.exists()) setPkg({ id: snap.id, ...snap.data() } as TicketPackage);
        else setPkg(null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="text-sm text-slate-400">Đang tải…</p>
      </main>
    );
  }

  if (!pkg) {
    return (
      <main className="mx-auto max-w-md p-4">
        <header className="mb-3 flex items-center gap-2">
          <BackButton fallback="/cards" />
          <h1 className="text-xl font-bold text-brand-800">Vé lượt</h1>
        </header>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mb-1 size-5" />
          Không tìm thấy vé này hoặc bạn không có quyền xem.
        </div>
      </main>
    );
  }

  const sortedHistory = [...(pkg.usageHistory ?? [])].sort((a, b) => {
    return toDate(b.at).getTime() - toDate(a.at).getTime();
  });
  const used = pkg.totalSessions - pkg.remainingSessions;
  const usedPct = Math.round((used / pkg.totalSessions) * 100);

  return (
    <main className="mx-auto max-w-md pb-safe">
      <header className="surface-glass sticky top-0 z-20 border-b border-slate-200/60 px-3 py-3">
        <div className="flex items-center gap-2">
          <BackButton fallback="/cards" />
          <div>
            <h1 className="text-xl font-bold text-brand-800">Vé lượt MS{pkg.memberCode}</h1>
            <p className="text-xs text-slate-500">
              {audienceLabel[pkg.audience] ?? pkg.audience} · còn {pkg.remainingSessions}/{pkg.totalSessions} lượt
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {/* Thẻ điện tử */}
        <div className="animate-fade-up">
          <PackageCard p={pkg} holderName={profile?.fullName ?? ""} />
        </div>

        {/* Thông tin tổng */}
        <section className="grid grid-cols-3 gap-2">
          <StatBox label="Đã dùng" value={`${used}`} sub={`${usedPct}%`} color="text-amber-600" />
          <StatBox label="Còn lại" value={`${pkg.remainingSessions}`} sub={`${100 - usedPct}%`} color="text-emerald-600" />
          <StatBox label="Tổng" value={`${pkg.totalSessions}`} sub="lượt" color="text-slate-700" />
        </section>

        {/* Lịch sử usage */}
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-slate-600">
            <History className="size-4" /> Lịch sử sử dụng ({sortedHistory.length})
          </h2>
          {sortedHistory.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
              <Ticket className="mx-auto size-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">Chưa có lần check-in nào</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sortedHistory.map((u, i) => {
                const t = toDate(u.at);
                return (
                  <li
                    key={`${u.checkinId ?? i}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <TrendingDown className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">
                        Trừ {u.count} lượt
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(t)} · {t.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    {u.count > 1 && (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                        Nhóm {u.count}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {pkg.remainingSessions <= 3 && pkg.remainingSessions > 0 && (
          <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
            ⚠️ Sắp hết — chỉ còn {pkg.remainingSessions} lượt
          </div>
        )}
      </div>
    </main>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-2xl font-extrabold tab-nums ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400">{sub}</div>
    </div>
  );
}
