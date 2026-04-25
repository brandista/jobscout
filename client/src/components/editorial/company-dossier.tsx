import type { ReactNode } from "react";

export type DossierStatus = "active" | "quiet" | "cold";

const STATUS_LABEL_FI: Record<DossierStatus, string> = {
  active: "ACTIVE",
  quiet: "QUIET",
  cold: "COLD",
};

export function CompanyDossier({
  name,
  meta,
  status,
  interpretation,
  signals,
  talentScore,
  actions,
}: {
  name: string;
  meta: string;
  status: DossierStatus;
  interpretation?: ReactNode;
  signals?: Array<{ time: string; text: string }>;
  talentScore?: number;
  actions?: ReactNode;
}) {
  return (
    <article className="py-8 border-b border-slate-900/15">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-[32px] font-black tracking-tight text-slate-900 break-words min-w-0">
          {name}
        </h2>
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === "active"
                ? "bg-emerald-500"
                : status === "quiet"
                  ? "bg-slate-400"
                  : "bg-slate-300"
            }`}
          />
          {STATUS_LABEL_FI[status]}
        </span>
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500 tabular-nums">
        {meta}
        {typeof talentScore === "number" && (
          <>
            {" · Talent Score "}
            <span
              className={
                talentScore >= 80
                  ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 bg-clip-text text-transparent font-extrabold"
                  : "text-slate-900 font-extrabold"
              }
            >
              {talentScore}
            </span>
          </>
        )}
      </div>
      {interpretation && (
        <p className="mt-4 text-base md:text-[17px] text-slate-700 leading-relaxed max-w-prose">
          {interpretation}
        </p>
      )}
      {signals && signals.length > 0 && (
        <ul className="mt-4 space-y-2">
          {signals.slice(0, 3).map((s, i) => (
            <li key={i} className="flex gap-3 items-baseline">
              <time className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-400 tabular-nums flex-shrink-0 w-14">
                {s.time}
              </time>
              <span className="text-slate-700 leading-snug">{s.text}</span>
            </li>
          ))}
        </ul>
      )}
      {actions && (
        <div className="mt-5 flex items-center gap-5 text-[11px] uppercase tracking-[0.18em] font-bold text-slate-900">
          {actions}
        </div>
      )}
    </article>
  );
}
