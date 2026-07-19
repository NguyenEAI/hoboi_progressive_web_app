"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { usePricing } from "@/lib/hooks/usePricing";
import { createOrder } from "@/lib/callable";
import { uploadPassPhoto, validatePassPhotoFile, type PassPhotoUpload } from "@/lib/passPhoto";
import { formatVND } from "@/lib/utils";
import { AUDIENCES, PASS_DURATIONS } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { BackButton } from "@/components/BackButton";
import type { Audience, PassDuration, Child } from "@/types";
import { Plus, Check, Calendar, Camera, ImagePlus, RotateCcw } from "lucide-react";

type Step = "duration" | "audience" | "beneficiary" | "photo" | "confirm";

type PhotoState = {
  previewUrl: string;
  upload?: PassPhotoUpload;
  uploading: boolean;
  error?: string;
};

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
  const [passPhoto, setPassPhoto] = useState<PhotoState | null>(null);

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
  const beneficiaryKind = isChild ? "CHILD" : "USER";
  const beneficiaryId = isChild ? beneficiary ?? "" : profile?.id ?? "";
  const canConfirm = !!passPhoto?.upload?.storagePath && !passPhoto.uploading && !busy;

  function chooseBeneficiary(next: string) {
    if (next === "self") setAudience("ADULT");
    const selectedChild = children.find((c) => c.id === next);
    const childAudience = audienceFromChild(selectedChild);
    if (childAudience) setAudience(childAudience);
    setBeneficiary(next);
    setPassPhoto(null);
    setStep("photo");
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profile || !beneficiaryId) return;
    const invalid = validatePassPhotoFile(file);
    if (invalid) {
      toast.show(invalid, "error");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPassPhoto({ previewUrl, uploading: true });
    try {
      const upload = await uploadPassPhoto({
        file,
        customerId: profile.id,
        beneficiaryKind,
        beneficiaryId,
      });
      setPassPhoto({ previewUrl, upload, uploading: false });
    } catch (e) {
      setPassPhoto({ previewUrl, uploading: false, error: (e as Error).message });
      toast.show("Upload ảnh thất bại: " + (e as Error).message, "error");
    }
  }

  async function confirm() {
    if (!profile || !duration || !audience || !beneficiary || !passPhoto?.upload?.storagePath) return;
    setBusy(true);
    try {
      const { orderId, amountVND } = await createOrder({
        productType: "PASS",
        duration,
        audience,
        beneficiaryKind,
        beneficiaryId,
        beneficiaryName,
        passPhoto: { storagePath: passPhoto.upload.storagePath },
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
            onClick={() => chooseBeneficiary("self")}
            emoji="🧔"
            title={profile?.fullName || "(Chưa đặt tên)"}
            subtitle="Bản thân"
          />
          {children.map((c) => (
            <BeneficiaryOption
              key={c.id}
              active={beneficiary === c.id}
              onClick={() => chooseBeneficiary(c.id)}
              emoji="🧒"
              title={c.fullName}
              subtitle={`Con · ${childCategoryText(c)}`}
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

      {step === "photo" && duration && audience && beneficiary && (
        <Section
          title="Chụp ảnh thẻ"
          subtitle="Ảnh thật của đúng người dùng vé, dùng để lễ tân đối chiếu trên thẻ"
          onBack={() => setStep("beneficiary")}
        >
          <div className="rounded-2xl border-2 border-brand-200 bg-white p-4">
            <div className="text-sm font-bold text-slate-800">{beneficiaryName + (isChild ? " (con)" : "")}</div>
            <div className="mt-3 overflow-hidden rounded-2xl bg-slate-100">
              {passPhoto?.previewUrl ? (
                <img src={passPhoto.previewUrl} alt="Ảnh thẻ đã chọn" className="h-64 w-full object-cover" />
              ) : (
                <div className="flex h-64 flex-col items-center justify-center px-6 text-center text-sm text-slate-500">
                  <Camera className="mb-2 size-9 text-brand-500" />
                  Cần có ảnh trước khi xác nhận đặt vé thời hạn.
                </div>
              )}
            </div>
            {passPhoto?.uploading && <p className="mt-2 text-sm font-semibold text-brand-700">Đang upload ảnh…</p>}
            {passPhoto?.upload && <p className="mt-2 text-sm font-semibold text-emerald-700">Ảnh đã upload thành công.</p>}
            {passPhoto?.error && <p className="mt-2 text-sm font-semibold text-red-600">{passPhoto.error}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/20">
                {passPhoto ? <RotateCcw className="size-4" /> : <Camera className="size-4" />}
                {passPhoto ? "Chụp lại" : "Chụp ảnh"}
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handlePhotoChange} />
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-brand-100 bg-white px-3 py-3 text-sm font-bold text-brand-700">
                <ImagePlus className="size-4" />
                Chọn từ máy
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
          </div>
          <button
            onClick={() => setStep("confirm")}
            disabled={!passPhoto?.upload?.storagePath || passPhoto.uploading}
            className="btn-primary w-full py-3.5 text-base disabled:opacity-50"
          >
            Tiếp tục xác nhận
          </button>
        </Section>
      )}

      {step === "confirm" && duration && audience && beneficiary && (
        <Section
          title="Xác nhận đặt vé"
          subtitle="Kiểm tra thông tin trước khi gửi"
          onBack={() => setStep("photo")}
        >
          <div className="space-y-2 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4 text-sm">
            <Row l="Loại" v="Vé thời hạn" />
            <Row l="Thời hạn" v={PASS_DURATIONS.find((d) => d.id === duration)?.label ?? duration} />
            <Row l="Áp dụng giá theo" v={AUDIENCES.find((a) => a.id === audience)?.label ?? audience} />
            <Row l="Người dùng vé" v={beneficiaryName + (isChild ? " (con)" : "")} />
            <Row l="Ảnh thẻ" v={passPhoto?.upload?.storagePath ? "Đã có" : "Chưa có"} />
            <div className="my-2 border-t border-brand-200" />
            <Row l="Tổng" v={<span className="text-lg font-extrabold text-brand-700">{formatVND(price)}</span>} />
          </div>

          <button onClick={confirm} disabled={!canConfirm} className="btn-primary w-full py-3.5 text-base disabled:opacity-50">
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
  const order: Step[] = ["duration", "audience", "beneficiary", "photo", "confirm"];
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

function audienceFromChild(child?: Child): Audience | null {
  if (!child) return null;
  if (child.audience === "CHILD_UNDER_140" || child.audience === "CHILD_OVER_140") return child.audience;
  if (typeof child.heightCm === "number") return child.heightCm < 140 ? "CHILD_UNDER_140" : "CHILD_OVER_140";
  return null;
}

function childCategoryText(child: Child) {
  const audience = audienceFromChild(child);
  if (audience === "CHILD_UNDER_140") return `${child.heightCm ?? "<140"} cm · trẻ dưới 1.4m`;
  if (audience === "CHILD_OVER_140") return `${child.heightCm ?? "≥140"} cm · trẻ từ 1.4m`;
  return "chưa có chiều cao";
}
