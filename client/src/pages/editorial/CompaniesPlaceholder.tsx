import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

export default function CompaniesPlaceholder() {
  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="COMPANIES"
        subtitle="Yritykset joita seuraat, ja joita et vielä."
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Seurannassa · Löydä · PRH-haku.
      </p>
    </EditorialShell>
  );
}
