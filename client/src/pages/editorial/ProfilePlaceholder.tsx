import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

export default function ProfilePlaceholder() {
  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="PUBLISHED"
        title="PROFILE"
        subtitle="By-line — sinun editorial-identiteettisi."
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Taidot · Kokemus · Koulutus · Kielet · Preferenssit.
      </p>
    </EditorialShell>
  );
}
