import Link from "next/link";

export function EmptyState({
  icon = "🌊",
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="card animate-fade-up px-5 py-10 text-center">
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl">
        {icon}
      </div>
      <div className="font-semibold text-slate-800">{title}</div>
      {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary mt-4">{actionLabel}</Link>
      )}
    </div>
  );
}
