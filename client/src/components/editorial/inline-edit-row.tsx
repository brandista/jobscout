import type { ReactNode } from "react";

export function InlineEditRow({
  label,
  editLabel = "Muokkaa →",
  onEdit,
  children,
}: {
  label: string;
  editLabel?: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-5 pb-2 border-b border-slate-900">
        <h3 className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900">
          {label}
        </h3>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            {editLabel}
          </button>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}
