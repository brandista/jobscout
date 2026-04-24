import { trpc } from "@/lib/trpc";
import { EditorialShell, Masthead } from "@/components/editorial";
import { useEditionNumber } from "@/hooks/useEditionNumber";
import { formatBriefDate } from "../../../../shared/lib/editorial-date";
import { LeadStory } from "./brief/LeadStory";
import { MoreHeadlines } from "./brief/MoreHeadlines";
import { TheBeat } from "./brief/TheBeat";
import { AgentNotes } from "./brief/AgentNotes";
import { BriefSidebar } from "./brief/BriefSidebar";

export function Brief() {
  const { data: user } = trpc.auth.me.useQuery();
  const issueNo = useEditionNumber();
  const dateStr = formatBriefDate(new Date(), "fi");
  const firstName = user?.name?.split(" ")[0] ?? "Lukija";

  return (
    <EditorialShell>
      <Masthead
        dateStr={dateStr}
        issueLabel={`Issue Nº ${issueNo}`}
        statusLabel="LIVE"
        title="JOBSCOUT BRIEFING"
        subtitle={`Kiertokirje työnhaun huipulta, ${firstName}.`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        <div className="lg:col-span-8 space-y-0">
          <LeadStory />
          <MoreHeadlines />
          <TheBeat />
          <AgentNotes />
        </div>
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20">
            <BriefSidebar />
          </div>
        </div>
      </div>
    </EditorialShell>
  );
}
