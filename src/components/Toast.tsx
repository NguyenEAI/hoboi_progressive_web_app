"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string };
type Ctx = { show: (text: string, kind?: ToastKind) => void };

const ToastCtx = createContext<Ctx>({ show: () => {} });

export function useToast() { return useContext(ToastCtx); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const show = useCallback((text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto flex max-w-md flex-col gap-2 px-3">
        {items.map((t) => <ToastItem key={t.id} t={t} onClose={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ t, onClose }: { t: Toast; onClose: () => void }) {
  const [exit, setExit] = useState(false);
  useEffect(() => { const tm = setTimeout(() => setExit(true), 3200); return () => clearTimeout(tm); }, []);
  const styles =
    t.kind === "success" ? "bg-brand-700 text-white"
    : t.kind === "error" ? "bg-red-600 text-white"
    : "bg-slate-900 text-white";
  const icon = t.kind === "success" ? "✓" : t.kind === "error" ? "✕" : "ⓘ";
  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 rounded-xl px-3.5 py-3 shadow-elevated ${styles} ${exit ? "animate-fade-in opacity-0" : "animate-fade-up"}`}
      style={{ transition: "opacity 240ms ease" }}
      onClick={onClose}
    >
      <span className="mt-0.5 text-base leading-none">{icon}</span>
      <span className="flex-1 text-sm leading-snug">{t.text}</span>
    </div>
  );
}
