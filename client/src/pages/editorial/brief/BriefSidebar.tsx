import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { BriefMetricRow, BriefActionRow, BriefTickerItem } from "@/components/editorial";
import { Search, FileText, MessageSquare } from "lucide-react";

function formatTime(raw: string | null): string {
  if (!raw) return "";
  return new Date(raw).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" });
}

export function BriefSidebar() {
  const { data, isLoading } = trpc.brief.sidebar.useQuery();
  const [, navigate] = useLocation();

  return (
    <aside className="space-y-8">
      {/* KEY NUMBERS */}
      <section>
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-3">KEY NUMBERS</p>
        {isLoading && <div className="h-24 bg-slate-100 animate-pulse rounded" />}
        {!isLoading && data && (
          <div className="divide-y divide-slate-900/10">
            <BriefMetricRow label="Matchit tänään" value={data.metrics.matchesToday} />
            <BriefMetricRow label="Tallennetut" value={data.metrics.savedJobsCount} />
            <BriefMetricRow label="Watchlistillä" value={data.metrics.watchlistCount} />
            <BriefMetricRow label="Profiili" value={`${data.metrics.profileCompleteness}%`} />
          </div>
        )}
      </section>

      {/* SIGNAL TICKER */}
      <section>
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-3">SIGNAL TICKER</p>
        {isLoading && <div className="h-20 bg-slate-100 animate-pulse rounded" />}
        {!isLoading && data && (
          <>
            {data.recentSignals.length === 0 && (
              <p className="font-['DM_Sans'] italic text-slate-400 text-xs">Ei signaaleja tänään.</p>
            )}
            <ul className="space-y-1">
              {data.recentSignals.map((s, i) => (
                <BriefTickerItem
                  key={i}
                  time={formatTime(s.publishedAt)}
                  text={`${s.companyName} — ${s.headline}`}
                />
              ))}
            </ul>
            <Link href="/bulletins"
              className="block mt-3 text-[11px] uppercase tracking-[0.16em] font-bold text-slate-400 hover:text-slate-900 transition-colors">
              Kaikki signaalit →
            </Link>
          </>
        )}
      </section>

      {/* QUICK ACTIONS */}
      <section>
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-3">QUICK ACTIONS</p>
        <div className="divide-y divide-slate-900/10">
          <BriefActionRow icon={Search} label="Aloita Scout" desc="Hae uusia työpaikkoja" onClick={() => navigate("/jobs")} />
          <BriefActionRow icon={FileText} label="Päivitä CV" desc="Lataa tai muokkaa ansioluetteloa" onClick={() => navigate("/profile")} />
          <BriefActionRow icon={MessageSquare} label="Keskustele Kaisan kanssa" desc="Uravalmentaja käytettävissäsi" onClick={() => navigate("/agents/career_coach")} />
        </div>
      </section>
    </aside>
  );
}
