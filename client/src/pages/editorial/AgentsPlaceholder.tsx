import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

export default function AgentsPlaceholder() {
  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="AGENTS"
        subtitle="Toimituksen kuusi asiantuntijaa palveluksessasi."
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Kaisa · Väinö · Työpaikka-analyytikko · Yritystiedustelu · Haastattelu · Neuvottelu.
      </p>
    </EditorialShell>
  );
}
