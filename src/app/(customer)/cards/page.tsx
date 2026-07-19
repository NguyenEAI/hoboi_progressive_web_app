"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Enrollment, Membership, TicketPackage } from "@/types";
import Link from "next/link";
import { CourseWalletCard, MembershipCard, PackageCard, resolvePackageHolderName } from "@/components/MemberCard";
import { SkeletonList } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Wallet } from "lucide-react";

export default function CardsPage() {
  const { profile, loading } = useAuthUser();
  const [mems, setMems] = useState<Membership[]>([]);
  const [pkgs, setPkgs] = useState<TicketPackage[]>([]);
  const [enrollSelf, setEnrollSelf] = useState<Enrollment[]>([]);
  const [enrollKids, setEnrollKids] = useState<Enrollment[]>([]);
  const [orderBeneficiaryNames, setOrderBeneficiaryNames] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let count = 0;
    const onLoaded = () => { count++; if (count >= 4) setLoaded(true); };
    const subs = [
      onSnapshot(query(collection(db, "memberships"),
        where("userId", "==", profile.id), where("status", "==", "ACTIVE")),
        (s) => { setMems(s.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))); onLoaded(); }),
      onSnapshot(query(collection(db, "ticketPackages"),
        where("userId", "==", profile.id), where("status", "==", "ACTIVE")),
        (s) => { setPkgs(s.docs.map((d) => ({ id: d.id, ...d.data() } as TicketPackage))); onLoaded(); }),
      onSnapshot(query(collection(db, "enrollments"),
        where("studentId", "==", profile.id)),
        (s) => { setEnrollSelf(s.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment))); onLoaded(); }),
      onSnapshot(query(collection(db, "enrollments"),
        where("parentId", "==", profile.id)),
        (s) => { setEnrollKids(s.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment))); onLoaded(); }),
    ];
    return () => subs.forEach((u) => u());
  }, [profile]);

  const enrolls = useMemo(() => {
    const map = new Map<string, Enrollment>();
    for (const e of enrollSelf) map.set(e.id, e);
    for (const e of enrollKids) map.set(e.id, e);
    return [...map.values()]
      .filter((e) => e.status !== "CANCELLED")
      .sort((a, b) => {
        const rank = (s: string) => s === "ACTIVE" ? 0 : s === "PENDING" ? 1 : s === "COMPLETED" ? 2 : 3;
        if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
        return String(a.studentName).localeCompare(String(b.studentName), "vi");
      });
  }, [enrollSelf, enrollKids]);

  useEffect(() => {
    if (!profile) return;
    const ids = [...mems, ...pkgs]
      .filter((item) => !item.holderName?.trim() && item.orderId && !(item.orderId in orderBeneficiaryNames))
      .map((item) => item.orderId);
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return;

    let cancelled = false;
    Promise.all(uniqueIds.map(async (orderId) => {
      try {
        const snap = await getDoc(doc(db, "orders", orderId));
        const name = snap.exists() ? String(snap.data().beneficiaryName ?? "").trim() : "";
        return [orderId, name] as const;
      } catch {
        return [orderId, ""] as const;
      }
    })).then((entries) => {
      if (cancelled) return;
      setOrderBeneficiaryNames((cur) => {
        const next = { ...cur };
        for (const [orderId, name] of entries) next[orderId] = name;
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [mems, orderBeneficiaryNames, pkgs, profile]);

  if (loading || !profile) {
    return (
      <main className="mx-auto max-w-md pb-safe">
        <Header />
        <div className="space-y-4 p-4"><SkeletonList /></div>
      </main>
    );
  }

  const empty = !mems.length && !pkgs.length && !enrolls.length;
  const total = mems.length + pkgs.length + enrolls.length;

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
            <MembershipCard m={m} holderName={m.holderName || orderBeneficiaryNames[m.orderId] || profile.fullName || ""} />
          </div>
        ))}

        {loaded && pkgs.map((p, i) => (
          <Link
            key={p.id}
            href={`/cards/package/${p.id}`}
            className="block animate-fade-up transition active:scale-[0.98]"
            style={{ animationDelay: `${(mems.length + i) * 80}ms` }}
          >
            <PackageCard p={p} holderName={resolvePackageHolderName(p, orderBeneficiaryNames[p.orderId] || profile.fullName || "")} />
            <p className="mt-1 text-center text-[11px] text-slate-500">Tap để xem lịch sử check-in →</p>
          </Link>
        ))}

        {loaded && enrolls.map((e, i) => (
          <Link
            key={e.id}
            href={`/my-courses/${e.id}`}
            className="block animate-fade-up transition active:scale-[0.98]"
            style={{ animationDelay: `${(mems.length + pkgs.length + i) * 80}ms` }}
          >
            <CourseWalletCard e={e} />
            <p className="mt-1 text-center text-[11px] text-slate-500">Tap để xem chi tiết khóa học →</p>
          </Link>
        ))}

        {loaded && empty && (
          <EmptyState
            icon="💳"
            title="Chưa có thẻ hoặc khóa học"
            description="Mua vé thời hạn, gói lượt hoặc khóa học để có thẻ điện tử"
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
              <>Bạn có <b className="text-slate-700">{total}</b> thẻ/khóa trong ví</>
            ) : (
              <>Bật thẻ lên cho nhân viên kiểm tra khi vào hồ</>
            )}
          </p>
        </div>
      </div>
    </header>
  );
}
