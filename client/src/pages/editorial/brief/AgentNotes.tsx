import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const AGENT_TO_PATH: Record<string, string> = {
  signal_scout: "/agents/signal_scout",
  career_coach: "/agents/career_coach",
  job_analyzer: "/agents/job_analyzer",
};

export function AgentNotes() {
  const { data, isLoading } = trpc.brief.agentNotes.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  return (
    <section className="py-6">
      <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-4">FROM OUR AGENTS</p>

      {isLoading && (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="h-4 w-40 bg-slate-100 animate-pulse rounded mb-2" />
              <div className="h-12 bg-slate-100 animate-pulse rounded" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && data && (
        <div>
          {data.map((item, idx) => (
            <div key={item.agentId}>
              <div className="py-4">
                <p className="font-['DM_Sans'] italic text-slate-500 text-sm mb-2">{item.byline}</p>
                {item.note ? (
                  <p className="font-['DM_Sans'] text-base text-slate-800 leading-relaxed mb-3">{item.note}</p>
                ) : (
                  <p className="font-['DM_Sans'] italic text-slate-400 text-sm mb-3">Agentti ei vastannut tällä kertaa.</p>
                )}
                <Link href={AGENT_TO_PATH[item.agentId] ?? "/agents"}
                  className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-400 hover:text-slate-900 transition-colors">
                  Jatka keskustelua →
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
