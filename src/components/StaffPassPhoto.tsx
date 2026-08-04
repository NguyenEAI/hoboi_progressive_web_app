"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { Camera, ImagePlus, RotateCcw } from "lucide-react";
import { storage } from "@/lib/firebase/client";
import { updateMembershipPassPhoto } from "@/lib/callable";
import { uploadPassPhoto, validatePassPhotoFile, type PassPhotoUpload } from "@/lib/passPhoto";
import type { Membership } from "@/types";

type PhotoState = {
  previewUrl: string;
  upload?: PassPhotoUpload;
  uploading: boolean;
  error?: string;
};

export function StaffPassPhoto({
  customerId,
  membership,
  onUpdated,
  compact = false,
}: {
  customerId: string;
  membership: Membership;
  onUpdated?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [replacement, setReplacement] = useState<PhotoState | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const path = membership.passPhoto?.storagePath;

  useEffect(() => {
    let alive = true;
    setCurrentUrl(null);
    setLoadError(false);
    if (!path) return;
    getDownloadURL(storageRef(storage, path))
      .then((url) => {
        if (alive) setCurrentUrl(url);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const invalid = validatePassPhotoFile(file);
    if (invalid) {
      setReplacement({ previewUrl: "", uploading: false, error: invalid });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setReplacement({ previewUrl, uploading: true });
    setMessage(undefined);
    try {
      const upload = await uploadPassPhoto({
        file,
        customerId,
        beneficiaryKind: membership.holderKind,
        beneficiaryId: membership.holderId,
      });
      setReplacement({ previewUrl, uploading: false, upload });
    } catch (error) {
      setReplacement({ previewUrl, uploading: false, error: (error as Error).message });
    }
  }

  async function save() {
    if (!replacement?.upload || reason.trim().length < 3) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await updateMembershipPassPhoto({
        customerId,
        membershipId: membership.id,
        reason: reason.trim(),
        passPhoto: { storagePath: replacement.upload.storagePath },
      });
      setMessage("Đã cập nhật ảnh thẻ.");
      setReason("");
      setReplacement(null);
      await onUpdated?.();
    } catch (error) {
      setReplacement((current) => current ? { ...current, error: (error as Error).message } : current);
    } finally {
      setSaving(false);
    }
  }

  const imageClass = compact ? "h-24 w-24" : "h-40 w-full";

  return (
    <div className={`rounded-xl border border-slate-100 bg-slate-50 p-3 ${compact ? "text-xs" : "text-sm"}`}>
      <div className={compact ? "flex gap-3" : "space-y-3"}>
        <div className={`overflow-hidden rounded-xl bg-white ${imageClass}`}>
          {replacement?.previewUrl ? (
            <img src={replacement.previewUrl} alt="Ảnh thẻ mới" className="h-full w-full object-cover" />
          ) : currentUrl && !loadError ? (
            <img src={currentUrl} alt={`Ảnh thẻ của ${membership.holderName || "khách"}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center font-semibold text-slate-400">
              <Camera className="mb-1 size-5" />
              {path ? "Không tải được ảnh" : "Chưa có ảnh"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-800">Ảnh vé thời hạn</div>
          <div className="mt-0.5 text-slate-500">MS{membership.memberCode} · {membership.holderName || "Khách"}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-2 font-bold text-white">
              {replacement ? <RotateCcw className="size-4" /> : <Camera className="size-4" />}
              {replacement ? "Chụp lại" : "Chụp"}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleFile} />
            </label>
            <label className="flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white px-2 font-bold text-brand-700 ring-1 ring-brand-100">
              <ImagePlus className="size-4" />
              Chọn ảnh
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
            </label>
          </div>
          {replacement?.uploading && <p className="mt-2 font-semibold text-brand-700">Đang upload ảnh...</p>}
          {replacement?.upload && (
            <div className="mt-2 space-y-2">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Lý do đổi ảnh (bắt buộc)"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              />
              <button
                type="button"
                onClick={save}
                disabled={saving || reason.trim().length < 3}
                className="w-full rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu ảnh mới"}
              </button>
            </div>
          )}
          {replacement?.error && <p className="mt-2 font-semibold text-red-600">{replacement.error}</p>}
          {message && <p className="mt-2 font-semibold text-emerald-700">{message}</p>}
        </div>
      </div>
    </div>
  );
}
