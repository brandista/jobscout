import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

function relativeTime(date: string | null): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600_000);
  if (h < 1) return "juuri nyt";
  if (h < 24) return `${h} h sitten`;
  const d = Math.floor(h / 24);
  return `${d} pv sitten`;
}

export function MoreHeadlines() {
  const { data, isLoading } = trpc.brief.moreHeadlines.useQuery();

  return (
    <section className="py-6 border-b border-slate-900">
      <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-4">MORE HEADLINES</p>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-slate-100 animate-pulse rounded" />)}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <p className="font-['DM_Sans'] italic text-slate-400 text-sm">Ei uusia matcheja tänään.</p>
      )}

      {!isLoading && data && data.length > 0 && (
        <div>
          {data.slice(0, 4).map((item, idx) => (
            <div key={item.matchId}>
              <div className="py-3 group cursor-pointer"
                onClick={() => item.url && window.open(item.url, "_blank")}>
                <h3 className="font-['Sora'] text-2xl font-semibold tracking-tight text-slate-900 group-hover:opacity-70 transition-opacity">
                  {item.title}
                </h3>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 tabular-nums mt-1">
                  {[`${item.totalScore}%`, item.company, item.location, relativeTime(item.postedAt)]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
              {idx < Math.min(data.length, 4) - 1 && <div className="border-t border-slate-900/10" />}
            </div>
          ))}
        </div>
      )}

      <Link href="/jobs/matches"
        className="block mt-4 text-[11px] uppercase tracking-[0.16em] font-bold text-slate-400 hover:text-slate-900 transition-colors">
        Kaikki matchit →
      </Link>
    </section>
  );
}
