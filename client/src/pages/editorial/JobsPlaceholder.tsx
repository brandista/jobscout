import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

export default function JobsPlaceholder() {
  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="JOBS"
        subtitle="Klassifioitu työtarjonta, päivittyy elävänä."
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Haut · Tallennetut · Matchatut.
      </p>
    </EditorialShell>
  );
}
