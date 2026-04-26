import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

// Aligns with `events.eventType` enum in drizzle/schema.ts.
// Keep in sync when adding new enum values.
const EVENT_TYPE_LABELS: Record<string, string> = {
  yt_layoff: "yt-irtisanomiset",
  yt_restructure: "yt-järjestely",
  funding: "rahoituskierros",
  new_unit: "uusi yksikkö",
  expansion: "laajennus",
  acquisition: "yritysosto",
  strategy_change: "strategiamuutos",
  leadership_change: "johtomuutos",
  other: "muu signaali",
};

export function TheBeat() {
  const { data, isLoading, isError } = trpc.brief.theBeat.useQuery();

  return (
    <section className="py-6 border-b border-slate-900">
      <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-4">THE BEAT</p>

      {isLoading && (
        <div className="space-y-6">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded" />)}
        </div>
      )}

      {!isLoading && isError && (
        <p className="font-['DM_Sans'] italic text-amber-700 text-sm">
          Signaaleja ei voitu ladata juuri nyt. Yritä uudelleen hetken kuluttua.
        </p>
      )}

      {!isLoading && !isError && (!data || data.length === 0) && (
        <p className="font-['DM_Sans'] italic text-slate-400 text-sm">
          Watchlistillä ei ole aktiivisia signaaleja. Lisää yrityksiä seurantaan.
        </p>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div>
          {data.map((entry, idx) => (
            <div key={entry.companyId}>
              <div className="py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-900 mb-1">
                  {entry.companyName}
                  {entry.latestEvents[0] && (
                    <span className="font-normal text-slate-400 ml-2 normal-case tracking-normal">
                      — {EVENT_TYPE_LABELS[entry.latestEvents[0].eventType] ?? entry.latestEvents[0].eventType}
                    </span>
                  )}
                </p>
                {entry.latestEvents[0] && (
                  <>
                    <p className="font-['Sora'] text-lg font-semibold text-slate-900 mb-1">
                      {entry.latestEvents[0].headline}
                    </p>
                    <p className="font-['DM_Sans'] text-sm text-slate-500 leading-relaxed mb-2">
                      {entry.latestEvents[0].summary}
                    </p>
                  </>
                )}
                <Link href="/companies"
                  className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-400 hover:text-slate-900 transition-colors">
                  Avaa dossier →
                </Link>
              </div>
              {idx < data.length - 1 && <div className="border-t border-slate-900/10" />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
