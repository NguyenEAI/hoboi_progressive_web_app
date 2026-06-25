"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function BackButton({
  fallback = "/",
  className,
  label = "Quay lại",
}: {
  fallback?: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();

  const onClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-black/5 active:scale-95",
        className,
      )}
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
