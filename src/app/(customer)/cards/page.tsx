"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Membership, TicketPackage } from "@/types";
import Link from "next/link";
import { MembershipCard, PackageCard } from "@/components/MemberCard";
import { SkeletonList } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Wallet } from "lucide-react";

export default function CardsPage() {
  const { profile, loading } = useAuthUser();
  const [mems, setMems] = useState<Membership[]>([]);
  const [pkgs, setPkgs] = useState<TicketPackage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let count = 0;
    const onLoaded = () => { count++; if (count >= 2) setLoaded(true); };
    const subs = [
      onSnapshot(query(collection(db, "memberships"),
        where("userId", "==", profile.id), where("status", "==", "ACTIVE")),
        (s) => { setMems(s.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))); onLoaded(); }),
      onSnapshot(query(collection(db, "ticketPackages"),
        where("userId", "==", profile.id), where("status", "==", "ACTIVE")),
        (s) => { setPkgs(s.docs.map((d) => ({ id: d.id, ...d.data() } as TicketPackage))); onLoaded(); }),
    ];
    return () => subs.forEach((u) => u());
  }, [profile]);

  if (loading || !profile) {
    return (
      <main className="mx-auto max-w-md pb-safe">
        <Header />
        <div className="space-y-4 p-4"><SkeletonList /></div>
      </main>
    );
  }

  const empty = !mems.length && !pkgs.length;
  const total = mems.length + pkgs.length;

  return (
    <main className="mx-auto max-w-md pb-safe">
      <Header total={total} />

      <div className="space-y-5 p-4">
        {!loaded && <SkeletonList />}

        {loaded && mems.map((m, i) => (
          <div
            key={m.id}
            className="animate-fade-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <MembershipCard m={m} holderName={m.holderName} />
          </div>
        ))}

        {loaded && pkgs.map((p, i) => (
          <Link
            key={p.id}
            href={`/cards/package/${p.id}`}
            className="block animate-fade-up transition active:scale-[0.98]"
            style={{ animationDelay: `${(mems.length + i) * 80}ms` }}
          >
            <PackageCard p={p} holderName={profile.fullName} />
            <p className="mt-1 text-center text-[11px] text-slate-500">Tap để xem lịch sử check-in →</p>
          </Link>
        ))}

        {loaded && empty && (
          <EmptyState
            icon="💳"
            title="Chưa có thẻ nào"
            description="Mua vé tháng hoặc gói lượt để có thẻ điện tử"
            actionLabel="Mua thẻ ngay"
            actionHref="/services"
          />
        )}
      </div>
    </main>
  );
}

function Header({ total }: { total?: number }) {
  return (
    <header className="surface-glass sticky top-0 z-20 border-b border-slate-200/60 px-5 py-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Wallet className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-brand-800">
            Thẻ của tôi
          </h1>
          <p className="text-[11px] text-slate-500">
            {total ? (
              <>Bạn có <b className="text-slate-700">{total}</b> thẻ đang hoạt động</>
            ) : (
              <>Bật thẻ lên cho nhân viên kiểm tra khi vào hồ</>
            )}
          </p>
        </div>
      </div>
    </header>
  );
}
