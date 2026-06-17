// Decorative SVG components for hero sections + premium look.
// Pure SVG, không phụ thuộc lib ngoài. Inline để tránh extra HTTP request.

export function WavePattern({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M0 60 Q150 0 300 60 T600 60 T900 60 T1200 60 V120 H0 Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M0 80 Q150 30 300 80 T600 80 T900 80 T1200 80 V120 H0 Z"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        d="M0 100 Q150 60 300 100 T600 100 T900 100 T1200 100 V120 H0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function FloatingOrbs() {
  return (
    <div className="orb-bg">
      <span className="left-[-20%] top-[10%] h-40 w-40 bg-brand-300 animate-drift" />
      <span
        className="right-[-15%] top-[-10%] h-48 w-48 bg-emerald-300 animate-drift"
        style={{ animationDelay: "1.5s" }}
      />
      <span
        className="bottom-[-15%] left-[20%] h-32 w-32 bg-lime-300 animate-drift"
        style={{ animationDelay: "3s" }}
      />
    </div>
  );
}

export function DotGrid({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden className={className} width="100%" height="100%">
      <defs>
        <pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="currentColor" opacity="0.35" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  );
}

export function SwimmerIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" aria-hidden className={className}>
      <path
        d="M2 24 Q12 16 22 24 T42 24 T62 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M2 16 Q12 8 22 16 T42 16 T62 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}
