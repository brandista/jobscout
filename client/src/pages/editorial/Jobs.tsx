import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { EditorialShell, Masthead, BriefSectionLabel, EditorialListItem, TabRail } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";
import { toast } from "sonner";

type TabId = "haut" | "tallennetut" | "matchatut";

function tabFromPath(path: string): TabId {
  if (path === "/jobs/saved") return "tallennetut";
  if (path === "/jobs/matches") return "matchatut";
  return "haut";
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "haut", label: "HAUT" },
  { id: "tallennetut", label: "TALLENNETUT" },
  { id: "matchatut", label: "MATCHATUT" },
];

function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  if (min && max) return `${min.toLocaleString("fi")}–${max.toLocaleString("fi")} €`;
  if (min) return `${min.toLocaleString("fi")} €+`;
  return null;
}

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "juuri nyt";
  if (diffH < 24) return `${diffH} h sitten`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} pv sitten`;
  return d.toLocaleDateString("fi-FI");
}

// ─── HAUT tab ────────────────────────────────────────────────────────────────

function HautTab() {
  const { data: jobs, isLoading } = trpc.jobs.list.useQuery({ limit: 50 });
  const save = trpc.savedJobs.save.useMutation({
    onSuccess: () => toast.success("Tallennettu"),
    onError: () => toast.error("Tallennus epäonnistui"),
  });

  if (isLoading) {
    return <p className="py-16 text-slate-400 italic text-sm">Ladataan hakuja…</p>;
  }

  if (!jobs || jobs.length === 0) {
    return (
      <p className="py-16 text-slate-500 italic text-base">
        Ei hakutuloksia. Aja uusi Scout-haku löytääksesi työpaikkoja.
      </p>
    );
  }

  return (
    <div>
      {jobs.map((job: any) => (
        <EditorialListItem
          key={job.id}
          headline={job.title}
          meta={[job.company, job.location, formatSalary(job.salaryMin, job.salaryMax), timeAgo(job.postedAt)].filter(Boolean).join(" · ")}
          actions={
            <>
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-70 transition-opacity"
                >
                  Lue koko ilmoitus →
                </a>
              )}
              <button
                onClick={() => save.mutate({ jobId: job.id })}
                disabled={save.isPending}
                className="text-slate-500 hover:text-slate-900 transition-colors"
              >
                Tallenna
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}

// ─── TALLENNETUT tab ─────────────────────────────────────────────────────────

function TallennetutTab() {
  const { data: saved, isLoading, refetch } = trpc.savedJobs.list.useQuery();
  const unsave = trpc.savedJobs.unsave.useMutation({
    onSuccess: () => { toast.success("Poistettu tallennetuista"); refetch(); },
    onError: () => toast.error("Poisto epäonnistui"),
  });

  if (isLoading) {
    return <p className="py-16 text-slate-400 italic text-sm">Ladataan tallennettuja…</p>;
  }

  if (!saved || saved.length === 0) {
    return (
      <p className="py-16 text-slate-500 italic text-base">
        Et ole tallentanut yhtään työpaikkaa vielä.
      </p>
    );
  }

  return (
    <div>
      {saved.map(({ savedJob, job }: any) => (
        <EditorialListItem
          key={savedJob.id}
          headline={job.title}
          meta={[job.company, job.location, formatSalary(job.salaryMin, job.salaryMax), timeAgo(savedJob.savedAt)].filter(Boolean).join(" · ")}
          actions={
            <>
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-70 transition-opacity"
                >
                  Lue koko ilmoitus →
                </a>
              )}
              <button
                onClick={() => unsave.mutate({ jobId: job.id })}
                disabled={unsave.isPending}
                className="text-slate-500 hover:text-slate-900 transition-colors"
              >
                Poista
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}

// ─── MATCHATUT tab ────────────────────────────────────────────────────────────

function MatchatutTab() {
  const { data: matches, isLoading } = trpc.matches.list.useQuery({ limit: 50 });
  const save = trpc.savedJobs.save.useMutation({
    onSuccess: () => toast.success("Tallennettu"),
    onError: () => toast.error("Tallennus epäonnistui"),
  });

  if (isLoading) {
    return <p className="py-16 text-slate-400 italic text-sm">Ladataan matcheja…</p>;
  }

  if (!matches || matches.length === 0) {
    return (
      <p className="py-16 text-slate-500 italic text-base">
        Ei matcheja vielä. Aja Scout-haku löytääksesi sopivia paikkoja.
      </p>
    );
  }

  return (
    <div>
      {matches.map(({ match, job }: any) => (
        <EditorialListItem
          key={match.id}
          headline={job.title}
          meta={[
            `${match.totalScore}%`,
            job.company,
            job.location,
            formatSalary(job.salaryMin, job.salaryMax),
            timeAgo(job.postedAt),
          ].filter(Boolean).join(" · ")}
          actions={
            <>
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-70 transition-opacity"
                >
                  Lue koko ilmoitus →
                </a>
              )}
              <button
                onClick={() => save.mutate({ jobId: job.id })}
                disabled={save.isPending}
                className="text-slate-500 hover:text-slate-900 transition-colors"
              >
                Tallenna
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function JobsSidebar() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setFilters((f) => ({ ...f, [key]: !f[key] }));

  const activeFilters = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <div className="space-y-8">
      <div>
        <BriefSectionLabel>Haku</BriefSectionLabel>
        <p className="text-base italic text-slate-500 mb-3">Mitä etsit tänään?</p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rooli, yritys tai kaupunki"
          className="w-full bg-transparent border-b border-slate-900 text-slate-900 placeholder:text-slate-400 placeholder:italic text-sm py-2 outline-none"
        />

        <div className="mt-6 space-y-5">
          {[
            { label: "SIJAINTI", options: ["Helsinki", "Espoo", "Remote", "Ulkomaat"] },
            { label: "KOKEMUS", options: ["Junior", "Mid", "Senior", "Lead"] },
            { label: "TYYPPI", options: ["Vakituinen", "Määräaikainen", "Freelance"] },
          ].map(({ label, options }) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate-500 mb-2">{label}</p>
              <div className="space-y-1.5">
                {options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!filters[opt]}
                      onChange={() => toggle(opt)}
                      className="accent-slate-900"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div>
          <BriefSectionLabel>Aktiiviset suodattimet</BriefSectionLabel>
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((f) => (
              <button
                key={f}
                onClick={() => toggle(f)}
                className="text-[10px] uppercase tracking-[0.18em] font-bold px-2 py-1 border border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white transition-colors flex items-center gap-1"
              >
                {f} <span>×</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Jobs() {
  const [location, navigate] = useLocation();
  const activeTab = tabFromPath(location);

  function handleTabSelect(id: TabId) {
    if (id === "haut") navigate("/jobs");
    else if (id === "tallennetut") navigate("/jobs/saved");
    else navigate("/jobs/matches");
  }

  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="JOBS"
        subtitle="Klassifioitu työtarjonta, päivittyy elävänä."
      />
      <TabRail tabs={TABS} active={activeTab} onSelect={handleTabSelect} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        <div className="lg:col-span-8">
          {activeTab === "haut" && <HautTab />}
          {activeTab === "tallennetut" && <TallennetutTab />}
          {activeTab === "matchatut" && <MatchatutTab />}
        </div>
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20">
            <JobsSidebar />
          </div>
        </div>
      </div>
    </EditorialShell>
  );
}
