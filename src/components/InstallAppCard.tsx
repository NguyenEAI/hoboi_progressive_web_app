"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Share, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function isiPhoneOrIpad() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /android/.test(navigator.userAgent.toLowerCase());
}

export function InstallAppCard({ compact = false, forceShow = false }: { compact?: boolean; forceShow?: boolean }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    setInstalled(isStandalone());
    setDismissed(window.localStorage.getItem("install-card-dismissed") === "1");

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const phoneType = useMemo(() => {
    if (isiPhoneOrIpad()) return "ios";
    if (isAndroid()) return "android";
    return "other";
  }, []);

  if (installed && !forceShow) return null;
  if (dismissed && !forceShow) return null;

  async function installNow() {
    if (!installPrompt) {
      setExpanded(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  function hide() {
    window.localStorage.setItem("install-card-dismissed", "1");
    setDismissed(true);
  }

  const steps = phoneType === "ios"
    ? ["Bấm nút Chia sẻ ở thanh dưới Safari", "Chọn Thêm vào Màn hình chính", "Bấm Thêm là xong"]
    : phoneType === "android"
      ? ["Bấm nút Thêm app vào điện thoại", "Khi điện thoại hỏi, bấm Thêm", "Mở app từ màn hình điện thoại"]
      : ["Mở menu của trình duyệt", "Chọn Thêm vào màn hình chính hoặc Cài đặt app", "Mở app từ màn hình điện thoại"];

  return (
    <section className="rounded-3xl border border-brand-100 bg-white/90 p-4 shadow-sm ring-1 ring-white/60">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Smartphone className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold text-brand-900">Cài app vào điện thoại</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Bấm một nút, điện thoại nào hỗ trợ sẽ hỏi xác nhận để thêm app ngay.
              </p>
            </div>
            {compact && !forceShow && (
              <button onClick={hide} className="rounded-full p-1 text-slate-400 active:bg-slate-100" aria-label="Ẩn hướng dẫn">
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={installNow}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm active:scale-[0.98]"
            >
              <Download className="size-4" />
              Thêm app vào điện thoại
            </button>
            {compact && !expanded && (
              <Link href="/install" className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
                Mở màn cài app
              </Link>
            )}
          </div>

          {expanded && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-600">
                <Share className="size-4 text-brand-600" />
                Làm theo 3 bước
              </div>
              <ol className="space-y-2 text-xs leading-relaxed text-slate-600">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-brand-700 shadow-sm">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
