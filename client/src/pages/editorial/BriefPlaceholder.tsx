import { useAuth } from "@/_core/hooks/useAuth";
import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";
import { useEditionNumber } from "@/hooks/useEditionNumber";

export default function BriefPlaceholder() {
  const { user } = useAuth();
  const first = user?.name?.split(" ")[0] ?? "Lukija";
  const issue = useEditionNumber();

  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        issueLabel={`Issue Nº ${issue}`}
        statusLabel="LIVE"
        title="JOBSCOUT BRIEFING"
        subtitle={`Kiertokirje työnhaun huipulta, ${first}.`}
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Lead story · More headlines · The Beat · From our agents.
      </p>
    </EditorialShell>
  );
}
