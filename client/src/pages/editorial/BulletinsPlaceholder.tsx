import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

export default function BulletinsPlaceholder() {
  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="BULLETINS"
        subtitle="Kaikki hälytykset, aikajärjestyksessä."
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Ticker-virta, päiväryhmiteltynä.
      </p>
    </EditorialShell>
  );
}
