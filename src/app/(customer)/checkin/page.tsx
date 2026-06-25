"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { checkinByQr, requestCheckin, cancelCheckinRequest } from "@/lib/callable";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Child, Membership, TicketPackage, Enrollment, CheckinRequest } from "@/types";
import { SWIM_STYLES } from "@/lib/constants";
import { formatDate, toDate } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { Camera, X, RotateCw, AlertTriangle, Clock, BookOpen, Ticket, CheckCircle2, IdCard } from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";

// v2.4 (E2/INV-17): khách CHỌN thẻ trước khi quét QR (không có auto-pick theo giờ).
// v2.4.1: VÉ THỜI HẠN KHÔNG quét QR — khách chỉ xuất trình thẻ ở /cards cho lễ tân xem.
//   Chỉ check-in: khóa học (COURSE) + vé lượt (PACKAGE).
// - BỎ HOÀN TOÀN UI "Số người cùng vào" — lễ tân chốt số lượt khi duyệt vé lượt.
// - Khi quét: gửi forceKind + targetId lên server (COURSE) hoặc requestCheckin (PACKAGE).

type Result = { ok: boolean; message: string };
type CardKind = "COURSE" | "PACKAGE";
type Card = {
  kind: CardKind;
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  accent: string;
  icon: React.ReactNode;
};

const styleEmoji = (s: string) => SWIM_STYLES.find((x) => x.id === s)?.emoji ?? "🏊";

export default function CheckinPage() {
  const { profile } = useAuthUser();
  const toast = useToast();

  const [children, setChildren] = useState<Child[]>([]);
  const [who, setWho] = useState("self");
  const [result, setResult] = useState<Result>();
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [mems, setMems] = useState<Membership[]>([]);
  const [pkgs, setPkgs] = useState<TicketPackage[]>([]);
  const [enrolls, setEnrolls] = useState<Enrollment[]>([]);

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // v2.3 (D5): request đang chờ lễ tân duyệt (vé lượt)
  const [pendingRequest, setPendingRequest] = useState<CheckinRequest | null>(null);

  useEffect(() => {
    if (!profile) return;
    getDocs(collection(db, `users/${profile.id}/children`)).then((s) =>
      setChildren(s.docs.map((d) => ({ id: d.id, ...d.data() } as Child))),
    );
    const subs = [
      onSnapshot(
        query(collection(db, "memberships"),
          where("userId", "==", profile.id),
          where("status", "==", "ACTIVE")),
        (s) => setMems(s.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))),
      ),
      onSnapshot(
        query(collection(db, "ticketPackages"),
          where("userId", "==", profile.id),
          where("status", "==", "ACTIVE")),
        (s) => setPkgs(s.docs.map((d) => ({ id: d.id, ...d.data() } as TicketPackage))),
      ),
    ];
    return () => subs.forEach((u) => u());
  }, [profile]);

  // Enrollments: theo subjectId (self hoặc child); reload khi đổi "Check-in cho"
  useEffect(() => {
    if (!profile) return;
    const subjectId = who === "self" ? profile.id : who;
    return onSnapshot(
      query(collection(db, "enrollments"),
        where("studentId", "==", subjectId),
        where("status", "==", "ACTIVE")),
      (s) => setEnrolls(s.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment))),
    );
  }, [profile, who]);

  // Reset chọn thẻ khi đổi "Check-in cho"
  useEffect(() => {
    setSelectedCard(null);
  }, [who]);

  // Build danh sách thẻ check-in được (chỉ COURSE + PACKAGE)
  const cards: Card[] = useMemo(() => {
    const list: Card[] = [];
    // 1) Khóa học bơi
    for (const e of enrolls) {
      list.push({
        kind: "COURSE",
        id: e.id,
        title: `Khóa học ${styleEmoji(e.swimStyle)} ${e.studentName}`,
        subtitle: `HLV ${e.coachName} · ${e.attendedSessions ?? 0}/${e.totalSessions} buổi`,
        meta: `Hết hạn ${formatDate(e.expiryDate)}`,
        accent: "from-cyan-500 to-cyan-700",
        icon: <BookOpen className="size-5" />,
      });
    }
    // 2) Vé lượt
    for (const p of pkgs) {
      if ((p.remainingSessions ?? 0) <= 0) continue;
      list.push({
        kind: "PACKAGE",
        id: p.id,
        title: `Vé lượt MS${p.memberCode}`,
        subtitle: `${audienceLabel(p.audience)} · Còn ${p.remainingSessions}/${p.totalSessions} lượt`,
        meta: "Lễ tân sẽ chốt số lượt khi xác nhận",
        accent: "from-amber-500 to-amber-700",
        icon: <Ticket className="size-5" />,
      });
    }
    return list;
  }, [enrolls, pkgs]);

  // Banner riêng cho vé thời hạn — KHÔNG cần quét QR
  const activeMemberships = useMemo(
    () => mems.filter((m) => toDate(m.endDate).getTime() >= Date.now()),
    [mems],
  );

  async function start() {
    if (!selectedCard) {
      toast.show("Vui lòng chọn 1 thẻ trước khi quét QR", "info");
      return;
    }
    setResult(undefined);
    setScanning(true);
    const qr = new Html5Qrcode("qr-reader");
    scannerRef.current = qr;
    try {
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        async (text) => {
          await stop();
          try {
            // v2.4 E2: 3 nhánh xử lý theo loại thẻ khách chọn
            if (selectedCard.kind === "PACKAGE") {
              // Vé lượt → tạo request chờ lễ tân duyệt; suggestedCount = 1 (lễ tân chốt)
              const r = await requestCheckin({
                qrPayload: text,
                ticketPackageId: selectedCard.id,
                suggestedCount: 1,
              });
              const unsub = onSnapshot(
                doc(db, `checkinRequests/${r.requestId}`),
                (snap) => {
                  if (!snap.exists()) return;
                  const data = { id: snap.id, ...snap.data() } as CheckinRequest;
                  setPendingRequest(data);
                  if (data.status === "APPROVED") {
                    const pkg = pkgs.find((p) => p.id === selectedCard.id);
                    const remaining = (pkg?.remainingSessions ?? 0) - (data.approvedCount ?? 0);
                    setResult({
                      ok: true,
                      message: `Lễ tân đã duyệt · trừ ${data.approvedCount} lượt · còn ${Math.max(0, remaining)} lượt`,
                    });
                    toast.show("Check-in thành công 🎉", "success");
                    unsub();
                    setPendingRequest(null);
                  } else if (data.status === "REJECTED") {
                    setResult({ ok: false, message: "Bị từ chối: " + (data.rejectReason ?? "") });
                    toast.show("Lễ tân từ chối check-in", "error");
                    unsub();
                    setPendingRequest(null);
                  } else if (data.status === "CANCELLED") {
                    unsub();
                    setPendingRequest(null);
                  }
                },
              );
              toast.show("Đang gửi yêu cầu đến lễ tân...", "info");
              return;
            }

            // COURSE / MEMBERSHIP — trực tiếp với targetId + forceKind
            const r = await checkinByQr({
              qrPayload: text,
              forceKind: selectedCard.kind,
              targetId: selectedCard.id,
              beneficiaryId: who === "self" ? undefined : who,
            });
            setResult({ ok: true, message: r.message });
            toast.show("Check-in thành công 🎉", "success");
          } catch (e) {
            const m = (e as Error).message;
            setResult({ ok: false, message: m });
            toast.show(m, "error");
          }
        },
        () => {},
      );
    } catch (e) {
      const m = "Không mở được camera: " + (e as Error).message;
      setResult({ ok: false, message: m });
      toast.show(m, "error");
      setScanning(false);
    }
  }

  async function cancelRequest() {
    if (!pendingRequest) return;
    try {
      await cancelCheckinRequest({ requestId: pendingRequest.id });
      setPendingRequest(null);
      toast.show("Đã hủy yêu cầu", "info");
    } catch (e) {
      toast.show("Không hủy được: " + (e as Error).message, "error");
    }
  }

  async function stop() {
    try { await scannerRef.current?.stop(); } catch {}
    scannerRef.current = null;
    setScanning(false);
  }
  useEffect(() => () => { stop(); }, []);

  return (
    <main className="mx-auto max-w-md">
      <header className="surface-glass sticky top-0 z-20 border-b border-slate-200/70 px-3 py-3">
        <div className="flex items-center gap-2">
          <BackButton fallback="/home" />
          <div>
            <h1 className="text-xl font-bold text-brand-800">Check-in</h1>
            <p className="text-xs text-slate-500">
              Chọn thẻ → quét mã QR <b className="text-slate-700">trên màn hình tablet ở cổng</b>
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {children.length > 0 && (
          <div className="card animate-fade-up p-3">
            <div className="mb-2 text-xs font-semibold text-slate-600">Check-in cho</div>
            <select
              value={who}
              onChange={(e) => setWho(e.target.value)}
              className="input"
            >
              <option value="self">{profile?.fullName || "Bản thân"}</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName} (con)</option>
              ))}
            </select>
          </div>
        )}

        {/* Banner Vé thời hạn — KHÔNG quét QR (v2.4.1) */}
        {activeMemberships.length > 0 && (
          <div className="animate-fade-up rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                <IdCard className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-brand-800">
                  Bạn có {activeMemberships.length} vé thời hạn
                </div>
                <div className="mt-0.5 text-xs text-brand-700">
                  Vé thời hạn <b>không cần quét QR</b> — đến quầy xuất trình thẻ trong app để lễ
                  tân kiểm tra.
                </div>
                <Link
                  href="/cards"
                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <IdCard className="size-3.5" /> Xem thẻ
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Bộ chọn thẻ — chỉ COURSE + PACKAGE */}
        {cards.length > 0 ? (
          <div className="space-y-2">
            <div className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Chọn thẻ để check-in ({cards.length})
            </div>
            <div className="space-y-2">
              {cards.map((c) => {
                const isSelected = selectedCard?.kind === c.kind && selectedCard.id === c.id;
                return (
                  <button
                    key={`${c.kind}-${c.id}`}
                    onClick={() => setSelectedCard(c)}
                    className={`group relative w-full overflow-hidden rounded-2xl text-left shadow-card transition-all ${
                      isSelected
                        ? "ring-2 ring-brand-600 ring-offset-2"
                        : "ring-1 ring-slate-200 hover:ring-brand-300"
                    }`}
                  >
                    <div className={`flex items-start gap-3 bg-gradient-to-r ${c.accent} p-4 text-white`}>
                      <div className="mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-white/25">
                        {c.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{c.title}</div>
                        <div className="truncate text-xs opacity-95">{c.subtitle}</div>
                        {c.meta && (
                          <div className="mt-0.5 truncate text-[10px] opacity-80">{c.meta}</div>
                        )}
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="size-6 flex-shrink-0 text-white drop-shadow" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : activeMemberships.length === 0 ? (
          <div className="animate-scale-in rounded-2xl border-l-4 border-amber-400 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 flex-shrink-0 text-amber-600" />
              <div>
                <div className="text-sm font-semibold text-amber-900">Chưa có thẻ phù hợp</div>
                <div className="mt-1 text-sm text-amber-800">
                  {who === "self" ? "Bạn" : "Bé"} chưa có thẻ/khóa học đang hoạt động.{" "}
                  <Link href="/services" className="font-semibold underline">
                    Đăng ký dịch vụ
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* QR scanner area — chỉ hiển thị khi có thẻ check-in được */}
        {cards.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-card">
          <div id="qr-reader" className="aspect-square w-full" />
          {!scanning && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400">
              <div className="relative">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500" />
                <Camera className="relative size-12 text-white" />
              </div>
              <div className="mt-3 text-sm">
                {selectedCard ? "Sẵn sàng quét QR" : "Chọn 1 thẻ ở trên trước"}
              </div>
            </div>
          )}
          {scanning && (
            <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/60">
              <span className="absolute -left-px -top-px h-6 w-6 rounded-tl-2xl border-l-4 border-t-4 border-brand-400" />
              <span className="absolute -right-px -top-px h-6 w-6 rounded-tr-2xl border-r-4 border-t-4 border-brand-400" />
              <span className="absolute -bottom-px -left-px h-6 w-6 rounded-bl-2xl border-b-4 border-l-4 border-brand-400" />
              <span className="absolute -bottom-px -right-px h-6 w-6 rounded-br-2xl border-b-4 border-r-4 border-brand-400" />
            </div>
          )}
        </div>
        )}

        {cards.length > 0 && !scanning && !result && selectedCard && (
          <button onClick={start} className="btn-primary w-full py-4 text-lg">
            <Camera className="size-5" /> Bắt đầu quét QR
          </button>
        )}
        {scanning && (
          <button onClick={stop} className="btn-secondary w-full">
            <X className="size-4" /> Dừng quét
          </button>
        )}

        {pendingRequest && pendingRequest.status === "PENDING" && (
          <div className="animate-scale-in rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-center">
            <Clock className="mx-auto size-10 animate-pulse text-amber-600" />
            <div className="mt-2 font-bold text-amber-900">Đang chờ lễ tân duyệt...</div>
            <div className="mt-1 text-sm text-amber-800">
              Lễ tân sẽ kiểm tra thông tin vé + chốt số lượt rồi xác nhận.
            </div>
            <button onClick={cancelRequest} className="btn-secondary mt-3 w-full">
              <X className="size-4" /> Hủy yêu cầu
            </button>
          </div>
        )}

        {result && (
          <div
            className={`animate-scale-in rounded-2xl border-l-4 p-4 ${
              result.ok ? "border-brand-500 bg-brand-50" : "border-red-500 bg-red-50"
            }`}
          >
            <div className="text-3xl">{result.ok ? "✅" : "❌"}</div>
            <div className={`mt-1 font-bold ${result.ok ? "text-brand-800" : "text-red-800"}`}>
              {result.ok ? "Check-in thành công!" : "Không thành công"}
            </div>
            <div className={`text-sm ${result.ok ? "text-brand-700" : "text-red-700"}`}>
              {result.message}
            </div>
            <button
              onClick={() => {
                setResult(undefined);
                setSelectedCard(null);
              }}
              className="btn-secondary mt-3 w-full"
            >
              <RotateCw className="size-4" /> Quét tiếp
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function audienceLabel(a: string): string {
  if (a === "ADULT") return "Người lớn";
  if (a === "CHILD_UNDER_140") return "Trẻ <1.4m";
  if (a === "CHILD_OVER_140") return "Trẻ ≥1.4m";
  return a;
}
