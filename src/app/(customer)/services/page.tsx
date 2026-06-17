"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { usePricing } from "@/lib/hooks/usePricing";
import { createOrder } from "@/lib/callable";
import { formatVND } from "@/lib/utils";
import { AUDIENCES, PASS_DURATIONS, PACKAGE_SIZES } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import type { Audience, PassDuration, PackageSize, Child } from "@/types";
import { Plus, Sparkles, Info } from "lucide-react";

export default function ServicesPage() {
  const router = useRouter();
  const { profile } = useAuthUser();
  const { pricing } = usePricing();
  const toast = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [beneficiary, setBeneficiary] = useState("self");
  const [aud, setAud] = useState<Audience>("ADULT");
  const [busy, setBusy] = useState<string>();

  useEffect(() => {
    if (!profile) return;
    getDocs(collection(db, `users/${profile.id}/children`))
      .then((s) => setChildren(s.docs.map((d) => ({ id: d.id, ...d.data() } as Child))));
  }, [profile]);

  useEffect(() => {
    if (beneficiary === "self") { setAud("ADULT"); return; }
    const c = children.find((x) => x.id === beneficiary);
    if (c) setAud(c.heightCm < 140 ? "CHILD_UNDER_140" : "CHILD_OVER_140");
  }, [beneficiary, children]);

  const isChild = beneficiary !== "self";
  const child = children.find((c) => c.id === beneficiary);

  async function buy(
    args: Omit<Parameters<typeof createOrder>[0], "beneficiaryKind" | "beneficiaryId" | "beneficiaryName">,
    key: string,
  ) {
    if (!profile) return router.push("/signin");
    if (!profile.fullName?.trim() && !isChild) {
      toast.show("Vui lòng đặt tên của bạn trước (Hồ sơ → Sửa).", "error");
      return;
    }
    setBusy(key);
    try {
      const { orderId, amountVND } = await createOrder({
        ...args,
        beneficiaryKind: isChild ? "CHILD" : "USER",
        beneficiaryId: isChild ? beneficiary : profile.id,
        beneficiaryName: isChild ? (child?.fullName ?? "") : profile.fullName,
      });
      toast.show(
        `Đặt ${formatVND(amountVND)} thành công · mã ${orderId.slice(0, 6)}. Đến quầy thanh toán nhé.`,
        "success",
      );
    } catch (e) {
      toast.show("Lỗi: " + (e as Error).message, "error");
    } finally { setBusy(undefined); }
  }

  return (
    <main className="mx-auto max-w-md">
      <header className="surface-glass sticky top-0 z-20 border-b border-slate-200/70 px-5 py-4">
        <h1 className="text-xl font-bold text-brand-800">Dịch vụ trực tuyến</h1>
        <p className="text-xs text-slate-500">Vé lẻ vui lòng mua trực tiếp tại quầy lễ tân</p>
      </header>

      <div className="space-y-4 p-4">
        {/* Mua cho ai */}
        <div className="card animate-fade-up p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
            👤 Mua cho ai
          </div>
          <div className="grid gap-2 text-sm">
            <BeneficiaryButton
              active={beneficiary === "self"}
              onClick={() => setBeneficiary("self")}
              title={profile?.fullName || "(Chưa đặt tên)"}
              subtitle="Bản thân"
              emoji="🧔"
            />
            {children.map((c) => (
              <BeneficiaryButton
                key={c.id}
                active={beneficiary === c.id}
                onClick={() => setBeneficiary(c.id)}
                title={c.fullName}
                subtitle={`Con · ${c.heightCm}cm · ${c.heightCm < 140 ? "Trẻ <1.4m" : "Trẻ >1.4m"}`}
                emoji="🧒"
              />
            ))}
            <Link
              href="/children"
              className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/50 p-3 text-sm font-medium text-brand-700 active:bg-brand-100"
            >
              <Plus className="size-4" /> Thêm con
            </Link>
          </div>
        </div>

        {/* Đối tượng giá */}
        <div className="card animate-fade-up p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Áp dụng giá theo
            </div>
            {isChild && (
              <span className="chip-warning">Tự chọn theo chiều cao</span>
            )}
          </div>
          <div className="flex gap-2 text-xs">
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                onClick={() => !isChild && setAud(a.id)}
                disabled={isChild}
                className={`flex-1 rounded-xl py-2.5 transition-all ${
                  aud === a.id
                    ? "bg-brand-600 font-semibold text-white shadow-sm"
                    : "border-2 border-slate-200 bg-white text-slate-600"
                } ${isChild ? "opacity-60" : ""}`}
              >
                <div className="text-base">{a.emoji}</div>
                <div className="mt-0.5">{a.label.replace("Trẻ em ", "Trẻ ")}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Vé thời hạn */}
        <div className="space-y-2">
          <SectionTitle icon="🎫" title="Vé thời hạn" subtitle="Bơi không giới hạn lượt" />
          {PASS_DURATIONS.map((d, i) => (
            <ServiceCard
              key={d.id}
              name={d.label}
              sub={`Không giới hạn · ${d.days} ngày`}
              price={pricing.pass[aud][d.id as PassDuration]}
              busy={busy === `pass_${d.id}`}
              delay={i * 40}
              onBuy={() => buy({ productType: "PASS", duration: d.id, audience: aud }, `pass_${d.id}`)}
            />
          ))}
        </div>

        {/* Gói lượt */}
        <div className="space-y-2">
          <SectionTitle icon="🎟️" title="Gói lượt" subtitle="Trừ 1 lượt mỗi check-in · chia sẻ được" />
          {PACKAGE_SIZES.map((s, i) => (
            <ServiceCard
              key={s.id}
              name={s.label}
              sub={`${s.sessions} lượt · trừ dần`}
              price={pricing.package[aud][s.id as PackageSize]}
              busy={busy === `pack_${s.id}`}
              delay={i * 40}
              onBuy={() => buy({ productType: "PACKAGE", packageSize: s.id, audience: aud }, `pack_${s.id}`)}
            />
          ))}
        </div>

        {/* Khóa học */}
        <SectionTitle icon="🏊" title="Khóa học bơi" subtitle="15 buổi · 4 kiểu cùng giá" />
        <Link href="/services/course" className="card-interactive block animate-fade-up overflow-hidden">
          <div className="flex items-center gap-3 bg-gradient-to-r from-accent-400 to-accent-500 p-4 text-white">
            <Sparkles className="size-5" />
            <div className="flex-1">
              <div className="font-semibold">Khóa học bơi 15 buổi</div>
              <div className="text-xs opacity-90">90 ngày · chọn kiểu, HLV và giờ</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{formatVND(pricing.swimCourse)}</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 p-3 text-sm font-semibold text-brand-700">
            Chọn kiểu bơi <span>→</span>
          </div>
        </Link>

        {/* Vé lẻ tham khảo */}
        <div className="card mt-2 animate-fade-up bg-gradient-to-br from-brand-50 to-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
            <Info className="size-3.5" /> Vé lẻ (mua tại quầy)
          </div>
          <div className="mt-2 space-y-1 text-sm">
            <Line l="Trẻ em <1.4m" v={pricing.singleTicket.CHILD_UNDER_140} />
            <Line l="Trẻ em >1.4m" v={pricing.singleTicket.CHILD_OVER_140} />
            <Line l="Người lớn" v={pricing.singleTicket.ADULT} />
            <Line l="NL + bé <2 tuổi" v={pricing.singleTicket.ADULT_WITH_TODDLER} />
          </div>
        </div>
      </div>
    </main>
  );
}

function BeneficiaryButton({
  active, onClick, title, subtitle, emoji,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  emoji: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all ${
        active ? "border-brand-500 bg-brand-50 shadow-sm" : "border-slate-200 bg-white"
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
          active ? "border-brand-600 bg-brand-600" : "border-slate-300"
        }`}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
    </button>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="px-1 pt-1">
      <div className="text-sm font-semibold text-slate-800">{icon} {title}</div>
      <div className="text-[11px] text-slate-500">{subtitle}</div>
    </div>
  );
}

function ServiceCard({
  name, sub, price, busy, delay = 0, onBuy,
}: {
  name: string;
  sub: string;
  price: number;
  busy: boolean;
  delay?: number;
  onBuy: () => void;
}) {
  return (
    <div
      className="card animate-fade-up p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="font-semibold">{name}</div>
          <div className="text-xs text-slate-500">{sub}</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-brand-700 tabular-nums">{formatVND(price)}</div>
        </div>
      </div>
      <button
        onClick={onBuy}
        disabled={busy}
        className="btn-primary mt-3 w-full py-2.5"
      >
        {busy ? "Đang xử lý…" : "Đăng ký"}
      </button>
    </div>
  );
}

const Line = ({ l, v }: { l: string; v: number }) => (
  <div className="flex items-center justify-between"><span className="text-slate-600">{l}</span><b className="text-brand-800 tabular-nums">{formatVND(v)}</b></div>
);
