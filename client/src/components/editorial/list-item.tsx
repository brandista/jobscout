import type { ReactNode } from "react";

export function EditorialListItem({
  headline,
  meta,
  ingress,
  actions,
  onClick,
}: {
  headline: ReactNode;
  meta: ReactNode;
  ingress?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
}) {
  const clickable = typeof onClick === "function";
  return (
    <article
      onClick={onClick}
      className={`group py-6 border-b border-slate-900/15 ${
        clickable
          ? "cursor-pointer hover:bg-slate-900/[0.02] -mx-2 px-2 transition-colors"
          : ""
      }`}
    >
      <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-[28px] font-semibold tracking-tight text-slate-900 leading-tight break-words">
        {headline}
      </h2>
      <div className="mt-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-400 tabular-nums">
        {meta}
      </div>
      {ingress && (
        <p className="mt-3 text-base md:text-[17px] italic text-slate-600 leading-relaxed max-w-prose">
          {ingress}
        </p>
      )}
      {actions && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.18em] font-bold text-slate-900">
          {actions}
        </div>
      )}
    </article>
  );
}
