"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { usePricing } from "@/lib/hooks/usePricing";
import { createOrder } from "@/lib/callable";
import { formatVND } from "@/lib/utils";
import { AUDIENCES, PASS_DURATIONS } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { BackButton } from "@/components/BackButton";
import type { Audience, PassDuration, Child } from "@/types";
import { Plus, Check, Calendar } from "lucide-react";

type Step = "duration" | "audience" | "beneficiary" | "confirm";

export default function PassWizardPage() {
  const router = useRouter();
  const { profile } = useAuthUser();
  const { pricing } = usePricing();
  const toast = useToast();

  const [step, setStep] = useState<Step>("duration");
  const [duration, setDuration] = useState<PassDuration | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [beneficiary, setBeneficiary] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    getDocs(collection(db, `users/${profile.id}/children`)).then((s) =>
      setChildren(s.docs.map((d) => ({ id: d.id, ...d.data() } as Child))),
    );
  }, [profile]);

  const price = useMemo(
    () => (duration && audience ? pricing.pass[audience][duration] : 0),
    [duration, audience, pricing],
  );

  const isChild = beneficiary && beneficiary !== "self";
  const child = children.find((c) => c.id === beneficiary);
  const beneficiaryName = isChild ? child?.fullName ?? "" : profile?.fullName ?? "";

  async function confirm() {
    if (!profile || !duration || !audience || !beneficiary) return;
    setBusy(true);
    try {
      const { orderId, amountVND } = await createOrder({
        productType: "PASS",
        duration,
        audience,
        beneficiaryKind: isChild ? "CHILD" : "USER",
        beneficiaryId: isChild ? beneficiary : profile.id,
        beneficiaryName,
      });
      toast.show(
        `Đã đặt vé ${formatVND(amountVND)} · mã ${orderId.slice(0, 6)}. Đến quầy thanh toán nhé.`,
        "success",
      );
      router.replace("/home");
    } catch (e) {
      toast.show("Lỗi: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md pb-24">
      <header className="surface-glass sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200/70 px-2 py-2">
        <BackButton fallback="/services" />
        <div>
          <h1 className="text-lg font-bold text-brand-800">Vé thời hạn</h1>
          <p className="text-xs text-slate-500">Bơi không giới hạn lượt</p>
        </div>
      </header>

      <StepDots step={step} />

      {step === "duration" && (
        <Section title="Chọn thời hạn" subtitle="Càng dài càng tiết kiệm">
          {PASS_DURATIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDuration(d.id);
                setStep("audience");
              }}
              className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition ${
                duration === d.id ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Calendar className="size-4 text-brand-600" /> {d.label}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">Hiệu lực {d.days} ngày · không giới hạn lượt</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                Từ <span className="font-bold text-brand-700">{formatVND(pricing.pass.CHILD_UNDER_140[d.id])}</span>
              </div>
            </button>
          ))}
        </Section>
      )}

      {step === "audience" && (
        <Section
          title="Áp dụng giá theo"
          subtitle="Chọn nhóm đối tượng sử dụng vé này"
          onBack={() => setStep("duration")}
        >
          {AUDIENCES.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setAudience(a.id);
                setStep("beneficiary");
              }}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                audience === a.id ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"
              }`}
            >
              <span className="text-3xl">{a.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold text-slate-800">{a.label}</div>
                <div className="text-xs text-slate-500">
                  Giá {duration ? formatVND(pricing.pass[a.id][duration]) : "—"}
                </div>
              </div>
            </button>
          ))}
        </Section>
      )}

      {step === "beneficiary" && (
        <Section
          title="Mua cho ai"
          subtitle="Vé thời hạn là CÁ NHÂN — chỉ chủ thẻ dùng được"
          onBack={() => setStep("audience")}
        >
          <BeneficiaryOption
            active={beneficiary === "self"}
            onClick={() => {
              setBeneficiary("self");
              setStep("confirm");
            }}
            emoji="🧔"
            title={profile?.fullName || "(Chưa đặt tên)"}
            subtitle="Bản thân"
          />
          {children.map((c) => (
            <BeneficiaryOption
              key={c.id}
              active={beneficiary === c.id}
              onClick={() => {
                setBeneficiary(c.id);
                setStep("confirm");
              }}
              emoji="🧒"
              title={c.fullName}
              subtitle="Con"
            />
          ))}
          <Link
            href="/children"
            className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/50 p-3 text-sm font-medium text-brand-700"
          >
            <Plus className="size-4" /> Thêm con
          </Link>
        </Section>
      )}

      {step === "confirm" && duration && audience && beneficiary && (
        <Section
          title="Xác nhận đặt vé"
          subtitle="Kiểm tra thông tin trước khi gửi"
          onBack={() => setStep("beneficiary")}
        >
          <div className="space-y-2 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4 text-sm">
            <Row l="Loại" v="Vé thời hạn" />
            <Row l="Thời hạn" v={PASS_DURATIONS.find((d) => d.id === duration)?.label ?? duration} />
            <Row l="Áp dụng giá theo" v={AUDIENCES.find((a) => a.id === audience)?.label ?? audience} />
            <Row l="Người dùng vé" v={beneficiaryName + (isChild ? " (con)" : "")} />
            <div className="my-2 border-t border-brand-200" />
            <Row l="Tổng" v={<span className="text-lg font-extrabold text-brand-700">{formatVND(price)}</span>} />
          </div>

          <button onClick={confirm} disabled={busy} className="btn-primary w-full py-3.5 text-base">
            {busy ? "Đang gửi…" : (
              <>
                <Check className="size-5" /> Xác nhận đặt vé
              </>
            )}
          </button>
          <p className="text-center text-xs text-slate-500">
            Đơn ở trạng thái <b>chờ thanh toán</b> tại quầy lễ tân.
          </p>
        </Section>
      )}
    </main>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["duration", "audience", "beneficiary", "confirm"];
  const idx = order.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-1.5 py-3">
      {order.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all ${
            i === idx ? "w-6 bg-brand-600" : i < idx ? "w-1.5 bg-brand-400" : "w-1.5 bg-slate-200"
          }`}
        />
      ))}
    </div>
  );
}

function Section({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 px-4 pb-4 animate-fade-up">
      <div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
      {onBack && (
        <button onClick={onBack} className="text-xs font-medium text-slate-500 underline">
          ← Đổi lựa chọn trước
        </button>
      )}
    </section>
  );
}

function BeneficiaryOption({
  active,
  onClick,
  emoji,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${
        active ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
    </button>
  );
}

function Row({ l, v }: { l: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{l}</span>
      <b className="text-right">{v}</b>
    </div>
  );
}
