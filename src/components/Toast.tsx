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
    t.kind === "success"
      ? "bg-emerald-600/95 border-emerald-500/30 text-white shadow-[0_12px_24px_-4px_rgba(5,150,105,0.3)]"
      : t.kind === "error"
      ? "bg-rose-600/95 border-rose-500/30 text-white shadow-[0_12px_24px_-4px_rgba(225,29,72,0.3)]"
      : "bg-slate-900/95 border-slate-700/30 text-white shadow-soft";
      
  const icon = t.kind === "success" ? "✓" : t.kind === "error" ? "✕" : "ⓘ";
  
  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3.5 backdrop-blur-md transition-all active:scale-[0.98] cursor-pointer ${styles} ${
        exit ? "opacity-0 translate-y-[-8px] scale-95" : "animate-fade-down"
      }`}
      style={{ transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      onClick={onClose}
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-black shadow-inner">
        {icon}
      </span>
      <span className="flex-1 text-[13px] font-semibold leading-snug">{t.text}</span>
    </div>
  );
}
