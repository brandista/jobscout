import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  EditorialShell,
  Masthead,
  ContributorCard,
} from "@/components/editorial";
import type { ContributorStatus } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

// Static editorial agent config — spec §4.4
const AGENT_CONFIG: Array<{
  id: string;
  name: string;
  role: string;
  mission: string;
  expertise: string[];
  status: ContributorStatus;
}> = [
  {
    id: "career_coach",
    name: "KAISA",
    role: "Kolumnisti",
    mission: "Kirjoitan profiilisi niin että rekrytoija lukee sen loppuun.",
    expertise: ["ATS-optimointi", "Henkilöbrandi", "Neuvottelu"],
    status: "available",
  },
  {
    id: "signal_scout",
    name: "VÄINÖ",
    role: "Kenttäreportteri",
    mission: "Avasi, ilmoitti, muutti — kentältä suoraan, ilman tulkintaa.",
    expertise: ["PRH/YTJ", "Rekrytointisignaalit", "Markkinatiedustelu"],
    status: "available",
  },
  {
    id: "job_analyzer",
    name: "TYÖPAIKKA-ANALYYTIKKO",
    role: "Kriitikko",
    mission: "Tuomio ensin, perustelu sen jälkeen.",
    expertise: ["Match-analyysi", "Piilovaatimukset", "Red flagit"],
    status: "available",
  },
  {
    id: "company_intel",
    name: "YRITYSTIEDUSTELU",
    role: "Tutkiva toimittaja",
    mission: "Kun X ja Y tapahtui yhdessä, se viittaa Z:aan — ja siksi kannattaa katsoa.",
    expertise: ["Yritystutkimus", "Kulttuurianalyysi", "Kasvusignaalit"],
    status: "available",
  },
  {
    id: "interview_prep",
    name: "HAASTATTELUVALMENNUS",
    role: "Toimittaja",
    mission: "Kerro — ja sitten kerro se uudelleen vaikeammalla kysymyksellä.",
    expertise: ["STAR-metodi", "Mock-haastattelut", "Painekysymykset"],
    status: "available",
  },
  {
    id: "negotiator",
    name: "NEUVOTTELUAPU",
    role: "Taloustoimittaja",
    mission: "Ei haarukka — numero. Täsmällinen vastatarjous.",
    expertise: ["Palkkatiedot", "Tarjousten vertailu", "Vastaehdotukset"],
    status: "available",
  },
];

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "Juuri nyt";
  if (diffH < 24) return `Tänään ${d.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffH < 48) return `Eilen ${d.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("fi-FI", { day: "numeric", month: "numeric" });
}

export default function Agents() {
  const [, navigate] = useLocation();
  const { data: conversations } = trpc.agent.conversations.useQuery({ limit: 100 });

  // Count conversations per agent type
  const countByAgent: Record<string, number> = {};
  const lastByAgent: Record<string, string | null> = {};

  if (conversations) {
    for (const c of conversations as any[]) {
      const type = c.agentType as string;
      countByAgent[type] = (countByAgent[type] ?? 0) + 1;
      if (!lastByAgent[type]) {
        lastByAgent[type] = c.updatedAt ?? c.createdAt ?? null;
      }
    }
  }

  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="AGENTS"
        subtitle="Toimituksen kuusi asiantuntijaa palveluksessasi."
      />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {AGENT_CONFIG.map((agent) => (
          <ContributorCard
            key={agent.id}
            name={agent.name}
            role={agent.role}
            status={agent.status}
            mission={agent.mission}
            expertise={agent.expertise}
            conversations={countByAgent[agent.id] ?? 0}
            lastSeen={timeAgo(lastByAgent[agent.id])}
            action={
              <button
                onClick={() => navigate(`/agents/${agent.id}`)}
                className="hover:opacity-70 transition-opacity"
              >
                Aloita keskustelu →
              </button>
            }
          />
        ))}
      </div>
    </EditorialShell>
  );
}
