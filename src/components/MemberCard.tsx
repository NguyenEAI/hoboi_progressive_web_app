"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import type { Enrollment, Membership, TicketPackage } from "@/types";
import { formatDate, daysUntil } from "@/lib/utils";
import { getPackageExpiryDate, isPackageExpired } from "@/lib/packageExpiry";
import { PASS_DURATIONS, AUDIENCES, SWIM_STYLES } from "@/lib/constants";
import { WavePattern } from "./Decorations";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  COMPLETED: "bg-blue-100 text-blue-800 ring-blue-200",
  EXPIRED: "bg-slate-100 text-slate-700 ring-slate-200",
  CANCELLED: "bg-red-100 text-red-800 ring-red-200",
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang học",
  COMPLETED: "Hoàn thành",
  EXPIRED: "Hết hạn",
  CANCELLED: "Đã hủy",
  PENDING: "Chờ kích hoạt",
};

export function resolvePackageHolderName(p: TicketPackage, fallbackName = "") {
  return p.holderName?.trim() || fallbackName.trim() || "Khách";
}

const audienceLabel = (a?: string) => AUDIENCES.find((x) => x.id === a)?.label ?? "";
const durLabel = (d?: string) => PASS_DURATIONS.find((x) => x.id === d)?.label ?? "Vé";

// ===== HELPER: Header bar — logo + tên hồ =====
function CardHeader({ darkText = false }: { darkText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
        <Image src="/logo.png" alt="HT Bảo Lâm" width={34} height={34} className="object-contain" />
      </span>
      <div className={`leading-tight ${darkText ? "text-slate-900" : "text-white"}`}>
        <div className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-90">
          HT Bảo Lâm
        </div>
        <div className="text-[13px] font-extrabold tracking-tight">
          HỒ BƠI PROSPER PLAZA
        </div>
      </div>
    </div>
  );
}

// ===== MEMBERSHIP CARD (Apple-wallet style) =====
export function MembershipCard({ m, holderName }: { m: Membership; holderName: string }) {
  const days = Math.max(0, daysUntil(m.endDate));
  const isExpiring = days <= 7;
  const safeHolderName = holderName?.trim() || m.holderName?.trim() || "Khách";
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    const path = m.passPhoto?.storagePath;
    if (!path) {
      setPhotoUrl(null);
      setPhotoError(false);
      return;
    }
    let cancelled = false;
    setPhotoError(false);
    getDownloadURL(storageRef(storage, path))
      .then((url) => {
        if (!cancelled) setPhotoUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setPhotoUrl(null);
          setPhotoError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [m.passPhoto?.storagePath]);

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-float border border-white/10">
      {/* Layered background */}
      <div className="absolute inset-0 hero-mesh" />
      <div className="absolute inset-0 holo-shine" />
      <div
        className="absolute inset-x-0 bottom-0 h-16 text-brand-800/60"
        aria-hidden
      >
        <WavePattern className="absolute inset-x-0 bottom-0 h-full w-full" />
      </div>

      <div className="relative px-6 py-6 text-white z-10">
        <div className="flex items-start justify-between gap-4">
          <CardHeader />
          <div className="text-right">
            <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-75">Mã số</div>
            <div className="text-lg font-black tabular-nums tracking-wide text-shadow-sm">
              #{m.memberCode}
            </div>
          </div>
        </div>

        {/* Card type pill */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide text-brand-950 shadow-md ring-1 ring-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-350 animate-pulse" />
          {durLabel(m.duration)} · {audienceLabel(m.audience)}
        </div>

        <div className="mt-4 flex items-end gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black uppercase tracking-widest text-white/90">Người dùng thẻ</div>
            <div className="mt-1 break-words text-3xl font-black leading-tight tracking-tight text-white text-shadow-md">
              {safeHolderName.toUpperCase()}
            </div>
          </div>
          <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/18 text-center text-[10px] font-black uppercase leading-tight text-white ring-2 ring-white/50">
            {photoUrl && !photoError ? (
              <img src={photoUrl} alt={`Ảnh thẻ của ${safeHolderName}`} className="h-full w-full object-cover" />
            ) : (
              <span className="px-2">{m.passPhoto?.storagePath ? "Chưa tải ảnh" : "Thẻ cũ"}</span>
            )}
          </div>
        </div>

        {/* Expiry banner */}
        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-75">Hiệu lực đến</div>
            <div className="text-base font-extrabold text-shadow-sm mt-0.5">{formatDate(m.endDate)}</div>
          </div>
          <div
            className={`rounded-2xl px-4 py-2 text-right shadow-md ring-1 backdrop-blur-md transition-all ${
              isExpiring
                ? "bg-amber-500/90 text-amber-950 ring-amber-300/40"
                : "bg-white/15 text-white ring-white/20"
            }`}
          >
            <div className="text-[9px] font-extrabold uppercase tracking-wider opacity-85">Còn lại</div>
            <div className="text-lg font-black tabular-nums">{days} ngày</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== TICKET PACKAGE CARD (front + back grid) =====
export function PackageCard({ p, holderName }: { p: TicketPackage; holderName: string }) {
  const used = p.totalSessions - p.remainingSessions;
  const pct = Math.round((p.remainingSessions / p.totalSessions) * 100);
  const safeHolderName = resolvePackageHolderName(p, holderName);
  const expiry = getPackageExpiryDate(p);
  const expired = p.status === "EXPIRED" || isPackageExpired(p);
  const depleted = (p.remainingSessions ?? 0) <= 0 || p.status === "DEPLETED";
  const statusText = expired ? "Hết hạn" : depleted ? "Hết lượt" : "Đang dùng";

  return (
    <div className={`relative overflow-hidden rounded-3xl shadow-float border border-slate-100 bg-white ${expired ? "opacity-80 grayscale" : ""}`}>
      {/* Front header bar with gradient background */}
      <div className="relative overflow-hidden px-6 py-6 text-white">
        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              "linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #78350f 100%)",
          }}
        />
        <div className="absolute inset-0 holo-shine z-0" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <CardHeader />
            <div className="text-right">
              <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-80">Mã số</div>
              <div className="text-lg font-black tabular-nums text-shadow-sm">#{p.memberCode}</div>
            </div>
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide text-amber-950 shadow-md ring-1 ring-white/40">
            <span className={`h-1.5 w-1.5 rounded-full ${expired || depleted ? "bg-slate-400" : "bg-amber-350 animate-pulse"}`} />
            Gói {p.totalSessions} lượt · {audienceLabel(p.audience)}
          </div>

          <div className="mt-4">
            <div className="text-xs font-black uppercase tracking-widest text-white/90">Chủ thẻ</div>
            <div className="mt-1 break-words text-3xl font-black leading-tight tracking-tight text-white text-shadow-md">
              {safeHolderName.toUpperCase()}
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-2 text-shadow-sm">
            <span className="text-4xl font-black tabular-nums tracking-tight">
              {p.remainingSessions}
            </span>
            <span className="text-sm font-black opacity-95">/ {p.totalSessions} lượt còn lại</span>
          </div>

          <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-white/20 shadow-inner">
            <div
              className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-4 text-xs font-black uppercase tracking-wider text-white/90">
            MS{p.memberCode} · {statusText}
          </div>
        </div>
      </div>

      {/* Back check-off grid styled cleanly */}
      <div className="relative border-t border-slate-100 bg-slate-50/50 px-6 py-5 z-10">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
            HSD {expiry ? formatDate(expiry) : "-"}
          </div>
          <div className="text-[10.5px] font-semibold text-slate-500">
            Đã dùng <b className="text-amber-700 font-extrabold">{used}</b>/{p.totalSessions} lượt
          </div>
        </div>
        <div className={`grid gap-1.5 ${p.totalSessions === 30 ? "grid-cols-10" : "grid-cols-[repeat(15,1fr)]"}`}>
          {Array.from({ length: p.totalSessions }).map((_, i) => {
            const isUsed = i < used;
            return (
              <div
                key={i}
                className={`flex aspect-square items-center justify-center rounded-lg border text-[10px] font-extrabold transition-all duration-300 ${
                  isUsed
                    ? "border-amber-600 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-350"
                }`}
              >
                {isUsed ? "✓" : i + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CourseWalletCard({ e }: { e: Enrollment }) {
  const style = SWIM_STYLES.find((s) => s.id === e.swimStyle);
  const attended = e.attendedSessions ?? 0;
  const total = e.totalSessions || 15;
  const remaining = Math.max(0, total - attended);
  const pct = Math.min(100, Math.round((attended / total) * 100));
  const days = daysUntil(e.expiryDate);
  const statusClass = STATUS_BADGE[e.status] ?? STATUS_BADGE.PENDING;
  const studentName = e.studentName?.trim() || "Học viên";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-100 bg-white shadow-float">
      <div className="relative overflow-hidden px-6 py-6 text-white">
        <div
          className="absolute inset-0 z-0"
          style={{ background: "linear-gradient(135deg, #0891b2 0%, #0f766e 58%, #134e4a 100%)" }}
        />
        <div className="absolute inset-0 holo-shine z-0" />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <CardHeader />
            <div className="text-right">
              <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-80">Mã số</div>
              <div className="text-lg font-black tabular-nums text-shadow-sm">#{e.memberCode}</div>
            </div>
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide text-cyan-950 shadow-md ring-1 ring-white/40">
            <span className="text-base leading-none">{style?.emoji ?? "🏊"}</span>
            Khóa {style?.label ?? "bơi"}
          </div>

          <div className="mt-4">
            <div className="text-xs font-black uppercase tracking-widest text-white/90">Người học</div>
            <div className="mt-1 break-words text-3xl font-black leading-tight tracking-tight text-white text-shadow-md">
              {studentName.toUpperCase()}
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-white/90">Tiến độ</div>
              <div className="mt-0.5 text-2xl font-black tabular-nums text-shadow-sm">
                {attended}/{total} buổi
              </div>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${statusClass}`}>
              {STATUS_LABEL[e.status] ?? e.status}
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20 shadow-inner">
            <div className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-cyan-50/70 px-6 py-4 text-center">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wide text-cyan-700">Còn</div>
          <div className="mt-0.5 text-lg font-black tabular-nums text-cyan-950">{remaining}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-wide text-cyan-700">HLV</div>
          <div className="mt-0.5 truncate text-sm font-black text-cyan-950">{e.coachName || "—"}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-wide text-cyan-700">Hết hạn</div>
          <div className="mt-0.5 text-sm font-black text-cyan-950">{days > 0 ? `${days} ngày` : formatDate(e.expiryDate)}</div>
        </div>
      </div>
    </div>
  );
}
