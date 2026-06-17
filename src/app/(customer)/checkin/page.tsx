"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { checkinByQr } from "@/lib/callable";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Child, Membership, TicketPackage, Enrollment } from "@/types";
import { SWIM_STYLES } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { Camera, X, RotateCw, AlertTriangle } from "lucide-react";
import Link from "next/link";

type Result = { ok: boolean; message: string };

const styleEmoji = (s: string) => SWIM_STYLES.find((x) => x.id === s)?.emoji ?? "🏊";

export default function CheckinPage() {
  const { profile } = useAuthUser();
  const toast = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [who, setWho] = useState("self");
  const [group, setGroup] = useState(1);
  const [adults, setAdults] = useState(1);
  const [result, setResult] = useState<Result>();
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [mems, setMems] = useState<Membership[]>([]);
  const [pkgs, setPkgs] = useState<TicketPackage[]>([]);
  const [enrolls, setEnrolls] = useState<Enrollment[]>([]);

  useEffect(() => {
    if (!profile) return;
    getDocs(collection(db, `users/${profile.id}/children`))
      .then((s) => setChildren(s.docs.map((d) => ({ id: d.id, ...d.data() } as Child))));
    const subs = [
      onSnapshot(query(collection(db, "memberships"),
        where("userId", "==", profile.id), where("status", "==", "ACTIVE")),
        (s) => setMems(s.docs.map((d) => ({ id: d.id, ...d.data() } as Membership)))),
      onSnapshot(query(collection(db, "ticketPackages"),
        where("userId", "==", profile.id), where("status", "==", "ACTIVE")),
        (s) => setPkgs(s.docs.map((d) => ({ id: d.id, ...d.data() } as TicketPackage)))),
    ];
    return () => subs.forEach((u) => u());
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const subjectId = who === "self" ? profile.id : who;
    return onSnapshot(query(collection(db, "enrollments"),
      where("studentId", "==", subjectId), where("status", "==", "ACTIVE")),
      (s) => setEnrolls(s.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment))));
  }, [profile, who]);

  const preview = useMemo(() => {
    const now = new Date();
    const weekday = now.getDay();
    const hour = now.getHours();
    const courseNow = enrolls.find((e) => {
      const parts = (e.slotId ?? "").split("_");
      const wd = parts[parts.length - 2];
      const h = parts[parts.length - 1];
      return Number(wd) === weekday && Number(h) === hour;
    });
    if (courseNow) {
      return {
        kind: "COURSE" as const,
        title: "Điểm danh khóa học",
        detail: `${styleEmoji(courseNow.swimStyle)} ${courseNow.coachName} · ${hour}:00–${hour + 1}:00 · ${courseNow.attendedSessions}/15 buổi`,
        accent: "from-brand-600 to-brand-700",
      };
    }
    const pkg = pkgs.find((p) => p.remainingSessions > 0);
    if (pkg) {
      return {
        kind: "PACKAGE" as const,
        title: `Trừ lượt từ gói ${pkg.totalSessions}`,
        detail: `Còn ${pkg.remainingSessions}/${pkg.totalSessions} lượt`,
        accent: "from-accent-500 to-accent-600",
      };
    }
    const mem = mems.find((m) => {
      const end = m.endDate as { seconds?: number } | Date | string;
      const t = end instanceof Date ? end.getTime()
        : typeof end === "object" && end && "seconds" in end ? (end.seconds! * 1000)
          : new Date(end as string).getTime();
      return t >= Date.now();
    });
    if (mem) {
      return {
        kind: "MEMBERSHIP" as const,
        title: "Vào hồ bằng vé thời hạn",
        detail: "Không trừ lượt · không giới hạn",
        accent: "from-brand-500 to-brand-600",
      };
    }
    return null;
  }, [enrolls, pkgs, mems]);

  async function start() {
    setResult(undefined); setScanning(true);
    const qr = new Html5Qrcode("qr-reader");
    scannerRef.current = qr;
    try {
      await qr.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 },
        async (text) => {
          await stop();
          try {
            const r = await checkinByQr({
              qrPayload: text,
              beneficiaryId: who === "self" ? undefined : who,
              groupSize: group, adultsInGroup: adults,
            });
            setResult({ ok: true, message: r.message });
            toast.show("Check-in thành công 🎉", "success");
          } catch (e) {
            const m = (e as Error).message;
            setResult({ ok: false, message: m });
            toast.show(m, "error");
          }
        }, () => {});
    } catch (e) {
      const m = "Không mở được camera: " + (e as Error).message;
      setResult({ ok: false, message: m });
      toast.show(m, "error");
      setScanning(false);
    }
  }

  async function stop() {
    try { await scannerRef.current?.stop(); } catch {}
    scannerRef.current = null; setScanning(false);
  }
  useEffect(() => () => { stop(); }, []);

  const showGroupPicker = preview?.kind === "PACKAGE";

  return (
    <main className="mx-auto max-w-md">
      <header className="surface-glass sticky top-0 z-20 border-b border-slate-200/70 px-5 py-4">
        <h1 className="text-xl font-bold text-brand-800">Check-in</h1>
        <p className="text-xs text-slate-500">Quét mã QR <b className="text-slate-700">trên màn hình tablet ở cổng</b></p>
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
              {children.map((c) => <option key={c.id} value={c.id}>{c.fullName} (con)</option>)}
            </select>
          </div>
        )}

        {preview ? (
          <div className="overflow-hidden rounded-2xl shadow-card animate-scale-in">
            <div className={`bg-gradient-to-r ${preview.accent} p-4 text-white`}>
              <div className="text-[10px] font-semibold uppercase tracking-widest opacity-90">Khi quét sẽ</div>
              <div className="mt-1 text-lg font-bold">{preview.title}</div>
              <div className="mt-0.5 text-sm opacity-95">{preview.detail}</div>
            </div>
          </div>
        ) : (
          <div className="animate-scale-in rounded-2xl border-l-4 border-amber-400 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 flex-shrink-0 text-amber-600" />
              <div>
                <div className="text-sm font-semibold text-amber-900">Chưa có dịch vụ phù hợp</div>
                <div className="mt-1 text-sm text-amber-800">
                  {who === "self" ? "Bạn" : "Bé"} chưa có thẻ/khóa học đang hoạt động.
                  Vui lòng mua vé lẻ tại quầy, hoặc <Link href="/services" className="font-semibold underline">đăng ký dịch vụ</Link>.
                </div>
              </div>
            </div>
          </div>
        )}

        {showGroupPicker && (
          <div className="card animate-fade-up p-4">
            <div className="mb-1 text-xs font-semibold text-slate-600">Số người cùng vào</div>
            <div className="mb-3 text-[11px] text-slate-500">Gói lượt cho phép dẫn nhiều người · trừ 1 lượt/người</div>
            <div className="flex items-center justify-between">
              <Stepper value={group} setValue={(v) => { setGroup(v); setAdults(Math.min(adults, v)); }} min={1} max={Math.min(30, pkgs[0]?.remainingSessions ?? 30)} />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Sẽ trừ</div>
                <div className="text-lg font-bold text-brand-700">{group} lượt</div>
              </div>
            </div>
            {group > 1 && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Trong đó <b className="text-slate-900">{adults}</b> người lớn</span>
                  <span>{group - adults} trẻ em</span>
                </div>
                <input type="range" min={0} max={group} value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  className="mt-2 w-full accent-brand-600" />
              </div>
            )}
            <div className="mt-3 rounded-xl bg-brand-50 p-2.5 text-xs text-brand-800">
              Còn lại sau lần này: <b>{(pkgs[0]?.remainingSessions ?? 0) - group}</b> lượt
            </div>
          </div>
        )}

        <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-card">
          <div id="qr-reader" className="aspect-square w-full" />
          {!scanning && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400">
              <div className="relative">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500" />
                <Camera className="relative size-12 text-white" />
              </div>
              <div className="mt-3 text-sm">Sẵn sàng quét QR</div>
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

        {!scanning && !result && preview && (
          <button onClick={start} className="btn-primary w-full py-4 text-lg">
            <Camera className="size-5" /> Bắt đầu quét QR
          </button>
        )}
        {scanning && (
          <button onClick={stop} className="btn-secondary w-full">
            <X className="size-4" /> Dừng quét
          </button>
        )}

        {result && (
          <div className={`animate-scale-in rounded-2xl border-l-4 p-4 ${result.ok ? "border-brand-500 bg-brand-50" : "border-red-500 bg-red-50"}`}>
            <div className="text-3xl">{result.ok ? "✅" : "❌"}</div>
            <div className={`mt-1 font-bold ${result.ok ? "text-brand-800" : "text-red-800"}`}>
              {result.ok ? "Check-in thành công!" : "Không thành công"}
            </div>
            <div className={`text-sm ${result.ok ? "text-brand-700" : "text-red-700"}`}>{result.message}</div>
            <button onClick={() => setResult(undefined)} className="btn-secondary mt-3 w-full">
              <RotateCw className="size-4" /> Quét tiếp
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function Stepper({ value, setValue, min, max }: { value: number; setValue: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setValue(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex size-11 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700 disabled:opacity-40"
      >−</button>
      <span className="w-10 text-center text-2xl font-bold tabular-nums">{value}</span>
      <button
        onClick={() => setValue(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex size-11 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white disabled:opacity-40"
      >+</button>
    </div>
  );
}
