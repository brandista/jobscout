import { trpc } from "@/lib/trpc";
import type { ReactNode } from "react";
import type { MatchPayload, SignalPayload, ProfilePayload } from "../../../../../shared/lib/brief-logic";

function MetaRow({ items }: { items: (string | number | null | undefined | ReactNode)[] }) {
  const parts = items.filter(v => v !== null && v !== undefined && v !== "");
  return (
    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 tabular-nums mt-2 mb-4 flex items-baseline gap-2">
      {parts.map((p, i) => (
        <span key={i} className="flex items-baseline gap-2">
          {i > 0 && <span className="text-slate-300">·</span>}
          {p}
        </span>
      ))}
    </p>
  );
}

function ScoreGradient({ score }: { score: number }) {
  return (
    <span className="text-3xl font-extrabold tabular-nums tracking-[-0.02em] bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 bg-clip-text text-transparent">
      {score}%
    </span>
  );
}

export function LeadStory() {
  const { data, isLoading } = trpc.brief.leadStory.useQuery();

  if (isLoading) {
    return (
      <section className="pb-8 border-b border-slate-900">
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-4">LEAD STORY</p>
        <div className="h-16 bg-slate-100 animate-pulse rounded" />
      </section>
    );
  }

  if (!data) return null;
  const { kind, payload } = data;

  return (
    <section className="pb-8 border-b border-slate-900">
      <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-4">LEAD STORY</p>

      {kind === "match" && (() => {
        const p = payload as MatchPayload;
        return (
          <>
            <h2 className="font-['Sora'] text-5xl md:text-6xl font-black tracking-[-0.025em] leading-[0.95] text-slate-900">
              {p.title.toUpperCase()}
            </h2>
            <MetaRow items={[<ScoreGradient score={p.totalScore} />, p.company, p.location]} />
            <p className="font-['DM_Sans'] italic text-base md:text-lg text-slate-500 leading-relaxed mb-4">
              Vahva osuma profiiliisi — avaa ilmoitus ja arvioi sopivuus.
            </p>
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-900 hover:opacity-70 transition-opacity">
                Avaa juttu →
              </a>
            )}
          </>
        );
      })()}

      {kind === "signal" && (() => {
        const p = payload as SignalPayload;
        return (
          <>
            <h2 className="font-['Sora'] text-5xl md:text-6xl font-black tracking-[-0.025em] leading-[0.95] text-slate-900">
              {p.headline.toUpperCase()}
            </h2>
            <MetaRow items={[p.eventType.replace(/_/g, " ").toUpperCase(), p.companyName]} />
            <p className="font-['DM_Sans'] italic text-base md:text-lg text-slate-500 leading-relaxed mb-4">
              {p.summary}
            </p>
            <a href="/companies" className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-900 hover:opacity-70 transition-opacity">
              Avaa dossier →
            </a>
          </>
        );
      })()}

      {kind === "profile_prompt" && (() => {
        const p = payload as ProfilePayload;
        return (
          <>
            <h2 className="font-['Sora'] text-5xl md:text-6xl font-black tracking-[-0.025em] leading-[0.95] text-slate-900">
              PROFIILISI ON {p.completeness}% VALMIS
            </h2>
            <p className="font-['DM_Sans'] italic text-base md:text-lg text-slate-500 leading-relaxed mt-4 mb-4">
              Täydennä profiilisi saadaksesi parempia matchauksia.
            </p>
            <a href="/profile" className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-900 hover:opacity-70 transition-opacity">
              Täydennä profiili →
            </a>
          </>
        );
      })()}

      {kind === "welcome" && (
        <>
          <h2 className="font-['Sora'] text-5xl md:text-6xl font-black tracking-[-0.025em] leading-[0.95] text-slate-900">
            TERVETULOA EDITIONIIN
          </h2>
          <p className="font-['DM_Sans'] italic text-base md:text-lg text-slate-500 leading-relaxed mt-4 mb-4">
            Aloita täyttämällä profiilisi — löydämme sinulle sopivat paikat.
          </p>
          <a href="/profile" className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-900 hover:opacity-70 transition-opacity">
            Luo profiili →
          </a>
        </>
      )}
    </section>
  );
}
