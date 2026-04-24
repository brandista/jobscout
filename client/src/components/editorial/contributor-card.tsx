import type { ReactNode } from "react";

export type ContributorStatus = "available" | "busy" | "off";

const STATUS_LABEL_FI: Record<ContributorStatus, string> = {
  available: "KÄYTÖSSÄ",
  busy: "VARATTU",
  off: "LOMALLA",
};

export function ContributorCard({
  name,
  role,
  status,
  mission,
  expertise,
  conversations,
  lastSeen,
  action,
}: {
  name: string;
  role: string;
  status: ContributorStatus;
  mission: string;
  expertise: string[];
  conversations: number;
  lastSeen: string;
  action: ReactNode;
}) {
  return (
    <article className="p-6 border border-slate-900/15 bg-white/40 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-slate-900/15">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-[28px] font-black tracking-tight text-slate-900">
            {name}
            <span className="ml-2 text-[11px] uppercase tracking-[0.22em] font-bold text-slate-500">
              — {role}
            </span>
          </h2>
        </div>
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === "available"
                ? "bg-emerald-500"
                : status === "busy"
                  ? "bg-amber-500"
                  : "bg-slate-300"
            }`}
          />
          {STATUS_LABEL_FI[status]}
        </span>
      </div>
      <p className="mt-4 flex items-start gap-3 text-[17px] italic text-slate-700 leading-relaxed max-w-prose">
        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 flex-shrink-0" />
        <span>&ldquo;{mission}&rdquo;</span>
      </p>
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex gap-3">
          <dt className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 w-32 flex-shrink-0 pt-0.5">
            Asiantuntemus
          </dt>
          <dd className="text-slate-900">{expertise.join(" · ")}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 w-32 flex-shrink-0 pt-0.5">
            Keskusteluja
          </dt>
          <dd className="text-slate-900 tabular-nums">{conversations}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 w-32 flex-shrink-0 pt-0.5">
            Viimeisin
          </dt>
          <dd className="text-slate-900">{lastSeen}</dd>
        </div>
      </dl>
      <div className="mt-6 pt-4 border-t border-slate-900/15 text-[11px] uppercase tracking-[0.18em] font-bold text-slate-900">
        {action}
      </div>
    </article>
  );
}
