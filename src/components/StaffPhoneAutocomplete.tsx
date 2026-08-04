"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type StaffPhoneSuggestion = {
  uid: string;
  phone: string;
  local: string;
  fullName: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (entry: StaffPhoneSuggestion) => void;
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  maxLength?: number;
  normalize?: (value: string) => string;
  emptyHint?: string;
};

const STAFF_ROLES = new Set(["OWNER", "RECEPTIONIST", "COACH"]);

export function StaffPhoneAutocomplete({
  value,
  onChange,
  onSelect,
  onEnter,
  placeholder = "0905 123 456",
  className,
  containerClassName,
  autoFocus,
  disabled,
  maxLength = 13,
  normalize = defaultNormalize,
  emptyHint = "Không có SĐT khớp trong danh bạ. Vẫn có thể nhập tay.",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [entries, setEntries] = useState<StaffPhoneSuggestion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users"), limit(2000));
    return onSnapshot(q, (snap) => {
      const next: StaffPhoneSuggestion[] = [];
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.role && STAFF_ROLES.has(String(data.role))) return;
        const phone = String(data.phone ?? "");
        if (!phone) return;
        const local = toLocalPhone(phone);
        next.push({
          uid: doc.id,
          phone,
          local,
          fullName: String(data.fullName ?? ""),
        });
      });
      setEntries(next);
    });
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const digits = value.replace(/\D/g, "");
  const normalizedQuery = value.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (digits.length < 3) return [];
    return entries
      .filter((entry) => {
        const entryDigits = entry.local.replace(/\D/g, "");
        return (
          entryDigits.includes(digits) ||
          entry.phone.replace(/\D/g, "").includes(digits) ||
          (!!normalizedQuery && entry.fullName.toLowerCase().includes(normalizedQuery))
        );
      })
      .slice(0, 8);
  }, [digits, entries, normalizedQuery]);

  return (
    <div ref={rootRef} className={`relative ${containerClassName ?? ""}`}>
      <input
        value={value}
        onChange={(event) => {
          onChange(normalize(event.target.value).slice(0, maxLength));
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            setOpen(false);
            onEnter?.();
          }
          if (event.key === "Escape") setOpen(false);
        }}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listboxId}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {suggestions.map((entry) => (
            <li key={entry.uid} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onChange(entry.local);
                  setOpen(false);
                  onSelect?.(entry);
                }}
                className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {entry.fullName || <span className="text-slate-400">(chưa đặt tên)</span>}
                  </span>
                  <span className="block truncate text-xs text-slate-500 tabular-nums">{formatPhone(entry.local)}</span>
                </span>
                <span className="shrink-0 text-[10px] font-bold uppercase text-brand-600">Chọn</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && digits.length >= 3 && suggestions.length === 0 && entries.length > 0 && (
        <p className="mt-1 text-[11px] text-slate-400">{emptyHint}</p>
      )}
    </div>
  );
}

export function defaultNormalize(value: string) {
  return value.replace(/[^0-9+]/g, "");
}

export function normalizeLocalPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function toLocalPhone(phone: string) {
  return phone.startsWith("+84") ? `0${phone.slice(3)}` : phone;
}

function formatPhone(local: string): string {
  if (/^0\d{9}$/.test(local)) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return local;
}
