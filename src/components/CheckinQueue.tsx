"use client";

import { useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { approveCheckin, rejectCheckin } from "@/lib/callable";
import type { CheckinRequest, TicketPackage } from "@/types";
import { Bell, BellOff, Check, X, AlertTriangle } from "lucide-react";

// v2.3 (D5/INV-15) — hàng đợi check-in vé lượt chờ lễ tân duyệt.
// v2.4 (E3) — thêm audio beep + visual flash khi có request mới + mute toggle (localStorage).
// Hiển thị trên dashboard `/admin` cho cả OWNER và RECEPTIONIST.

const MUTE_KEY = "checkin-queue-mute";

// Beep tone đơn (880Hz · 0.3s) — không cần asset
function beep() {
  try {
    const AudioCtor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* silent */
  }
}

export function CheckinQueue() {
  const [items, setItems] = useState<CheckinRequest[]>([]);
  const [pkgCache, setPkgCache] = useState<Record<string, TicketPackage>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reasonOpen, setReasonOpen] = useState<string>();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string>();
  const [muted, setMuted] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  // Load mute preference from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
  }, []);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  useEffect(() => {
    const q = query(
      collection(db, "checkinRequests"),
      where("status", "==", "PENDING"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(q, (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() } as CheckinRequest));
      setItems(list);
      // Initialize counts với suggestedCount cho request mới
      setCounts((prev) => {
        const next = { ...prev };
        for (const r of list) if (next[r.id] === undefined) next[r.id] = r.suggestedCount ?? 1;
        return next;
      });

      // Detect request mới (id chưa từng có trong prev) → beep + flash
      const currentIds = new Set(list.map((r) => r.id));
      const newIds: string[] = [];
      for (const id of currentIds) if (!prevIdsRef.current.has(id)) newIds.push(id);

      if (!firstLoadRef.current && newIds.length > 0) {
        if (!muted) beep();
        setFlashIds(new Set(newIds));
        setTimeout(() => setFlashIds(new Set()), 1500);
      }
      prevIdsRef.current = currentIds;
      firstLoadRef.current = false;
    });
  }, [muted]);

  // Load thông tin ticket package cho mỗi request (cache)
  useEffect(() => {
    items.forEach(async (r) => {
      if (pkgCache[r.ticketPackageId]) return;
      const snap = await getDoc(doc(db, "ticketPackages", r.ticketPackageId));
      if (snap.exists())
        setPkgCache((prev) => ({ ...prev, [r.ticketPackageId]: { id: snap.id, ...snap.data() } as TicketPackage }));
    });
  }, [items, pkgCache]);

  async function approve(r: CheckinRequest) {
    setBusy(r.id);
    try {
      await approveCheckin({ requestId: r.id, approvedCount: counts[r.id] ?? r.suggestedCount });
    } catch (e) {
      alert("Lỗi: " + (e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function reject(r: CheckinRequest) {
    if (!reason.trim()) {
      alert("Vui lòng nhập lý do từ chối");
      return;
    }
    setBusy(r.id);
    try {
      await rejectCheckin({ requestId: r.id, reason: reason.trim() });
      setReasonOpen(undefined);
      setReason("");
    } catch (e) {
      alert("Lỗi: " + (e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  if (!items.length) return null;

  return (
    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative">
          <Bell className="size-5 text-amber-600" />
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {items.length}
          </span>
        </span>
        <h2 className="font-bold text-amber-900">Hàng đợi check-in vé lượt</h2>
        <span className="ml-auto text-xs text-amber-700">{items.length} chờ duyệt</span>
        <button
          onClick={toggleMute}
          className="ml-1 flex size-7 items-center justify-center rounded-full text-amber-700 hover:bg-amber-200"
          aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
          title={muted ? "Bật âm thanh thông báo" : "Tắt âm thanh thông báo"}
        >
          {muted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
        </button>
      </div>

      <div className="space-y-2">
        {items.map((r) => {
          const pkg = pkgCache[r.ticketPackageId];
          const count = counts[r.id] ?? r.suggestedCount;
          const remaining = pkg?.remainingSessions ?? r.ticketRemaining;
          const max = Math.min(remaining, 30);
          const audLabel = pkg
            ? pkg.audience === "ADULT"
              ? "Người lớn"
              : pkg.audience === "CHILD_UNDER_140"
                ? "Trẻ <1.4m"
                : "Trẻ ≥1.4m"
            : "—";

          const isFlash = flashIds.has(r.id);
          return (
            <div
              key={r.id}
              className={`rounded-xl border bg-white p-3 transition-all ${
                isFlash
                  ? "border-red-400 ring-2 ring-red-400 ring-offset-2 animate-pulse shadow-lg"
                  : "border-amber-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800">
                    {r.userName || "(khách)"} <span className="text-xs font-normal text-slate-500">· {r.userPhone}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {pkg ? `MS${pkg.memberCode}` : "—"} · {audLabel} · còn {remaining}/{pkg?.totalSessions ?? "?"} lượt
                  </div>
                  <div className="mt-0.5 text-xs text-amber-700">
                    Khách đề xuất: <b>{r.suggestedCount} người</b>
                    {(r.adultsInGroup ?? 0) > 0 && (
                      <span className="text-slate-500"> ({r.adultsInGroup} người lớn, {r.suggestedCount - (r.adultsInGroup ?? 0)} trẻ)</span>
                    )}
                  </div>
                </div>
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  CHỜ
                </span>
              </div>

              {reasonOpen === r.id ? (
                <div className="mt-3 rounded-lg bg-red-50 p-2">
                  <input
                    autoFocus
                    placeholder="Lý do từ chối..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-lg border border-red-200 bg-white p-2 text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => reject(r)}
                      disabled={busy === r.id || !reason.trim()}
                      className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy === r.id ? "..." : "Xác nhận từ chối"}
                    </button>
                    <button
                      onClick={() => {
                        setReasonOpen(undefined);
                        setReason("");
                      }}
                      className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Số lượt trừ:</span>
                    <button
                      onClick={() => setCounts({ ...counts, [r.id]: Math.max(1, count - 1) })}
                      disabled={count <= 1}
                      className="flex size-8 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-600 ring-1 ring-slate-200 disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-bold tabular-nums">{count}</span>
                    <button
                      onClick={() => setCounts({ ...counts, [r.id]: Math.min(max, count + 1) })}
                      disabled={count >= max}
                      className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white disabled:opacity-40"
                    >
                      +
                    </button>
                    {count !== r.suggestedCount && (
                      <span className="ml-1 text-[10px] font-semibold text-red-600">
                        ≠ {r.suggestedCount} đề xuất
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => approve(r)}
                      disabled={busy === r.id}
                      className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <Check className="size-4" /> Duyệt
                    </button>
                    <button
                      onClick={() => setReasonOpen(r.id)}
                      disabled={busy === r.id}
                      className="flex items-center gap-1 rounded-lg border-2 border-red-200 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                    >
                      <X className="size-4" /> Từ chối
                    </button>
                  </div>
                </div>
              )}

              {pkg && count > remaining && (
                <div className="mt-2 flex items-center gap-1 text-xs text-red-700">
                  <AlertTriangle className="size-3.5" /> Vé chỉ còn {remaining} lượt, không đủ cho {count}.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
