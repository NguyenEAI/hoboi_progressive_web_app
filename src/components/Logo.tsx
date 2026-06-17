import Image from "next/image";
import { cn } from "@/lib/utils";

// Logo HT BẢO LÂM. Tùy chọn `glow` cho hero (vành sáng), `flat` cho header tối giản.
export function Logo({
  size = 44,
  className,
  glow = false,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-2xl bg-white p-1 shadow-sm",
        glow && "ring-2 ring-white/40",
        className
      )}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span
          aria-hidden
          className="absolute -inset-2 -z-10 rounded-3xl bg-white/30 blur-xl"
        />
      )}
      <Image
        src="/logo.png"
        alt="HT Bảo Lâm"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        priority={glow}
      />
    </span>
  );
}
