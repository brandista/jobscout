import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  EditorialShell,
  Masthead,
  BriefSectionLabel,
  CompanyDossier,
  TabRail,
} from "@/components/editorial";
import type { DossierStatus } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";
import { toast } from "sonner";

type TabId = "seurannassa" | "loyda" | "prh";

function tabFromPath(path: string): TabId {
  if (path === "/companies/discover") return "loyda";
  if (path === "/companies/prh") return "prh";
  return "seurannassa";
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "seurannassa", label: "SEURANNASSA" },
  { id: "loyda", label: "LÖYDÄ" },
  { id: "prh", label: "PRH-HAKU" },
];

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 24) return `${diffH} h sitten`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} pv sitten`;
  return d.toLocaleDateString("fi-FI", { day: "numeric", month: "numeric" });
}

function dossierStatus(recentEventsCount: number): DossierStatus {
  if (recentEventsCount >= 3) return "active";
  if (recentEventsCount >= 1) return "quiet";
  return "cold";
}

// ─── SEURANNASSA tab ──────────────────────────────────────────────────────────

function SeurannassaTab() {
  const { data: watchlist, isLoading, refetch } = trpc.watchlist.list.useQuery();
  const eventsQuery = trpc.events.recent.useQuery({ daysBack: 30, limit: 100 });
  const remove = trpc.watchlist.remove.useMutation({
    onSuccess: () => { toast.success("Poistettu seurantalistalta"); refetch(); },
    onError: () => toast.error("Poisto epäonnistui"),
  });

  if (isLoading) {
    return <p className="py-16 text-slate-400 italic text-sm">Ladataan seurantalistaa…</p>;
  }

  if (!watchlist || watchlist.length === 0) {
    return (
      <p className="py-16 text-slate-500 italic text-base">
        Seurantalistasi on tyhjä. Lisää yrityksiä Löydä-välilehdeltä tai PRH-hausta.
      </p>
    );
  }

  const allEvents = eventsQuery.data ?? [];

  return (
    <div>
      {watchlist.map((item: any) => {
        const companyEvents = allEvents
          .filter((e: any) => e.companyId === item.companyId)
          .slice(0, 3)
          .map((e: any) => ({
            time: timeAgo(e.createdAt),
            text: e.description ?? e.eventType,
          }));

        const status = dossierStatus(item.recentEventsCount ?? 0);
        const metaParts = [
          item.industry,
          item.domain,
        ].filter(Boolean);

        return (
          <CompanyDossier
            key={item.companyId}
            name={item.companyName}
            meta={metaParts.join(" · ")}
            status={status}
            talentScore={item.talentNeedScore ?? undefined}
            signals={companyEvents}
            actions={
              <button
                onClick={() => remove.mutate({ companyId: item.companyId })}
                disabled={remove.isPending}
                className="text-slate-500 hover:text-slate-900 transition-colors"
              >
                Poista seurannasta →
              </button>
            }
          />
        );
      })}
    </div>
  );
}

// ─── LÖYDÄ tab ────────────────────────────────────────────────────────────────

function LoydaTab() {
  const { data: companies, isLoading } = trpc.companies.topScored.useQuery({ limit: 20 });
  const addToWatchlist = trpc.watchlist.add.useMutation({
    onSuccess: () => toast.success("Lisätty seurantalistalle"),
    onError: () => toast.error("Lisäys epäonnistui"),
  });

  if (isLoading) {
    return <p className="py-16 text-slate-400 italic text-sm">Ladataan suosituksia…</p>;
  }

  if (!companies || companies.length === 0) {
    return (
      <p className="py-16 text-slate-500 italic text-base">
        Ei suosituksia vielä. Päivitä profiilisi saadaksesi yrityssuosituksia.
      </p>
    );
  }

  return (
    <div>
      {companies.map((item: any) => {
        const c = item.company;
        const events = (item.events ?? []).slice(0, 3).map((e: any) => ({
          time: timeAgo(e.createdAt),
          text: e.description ?? e.eventType,
        }));
        const metaParts = [c.industry, c.city ?? c.domain].filter(Boolean);
        const status = dossierStatus(item.events?.length ?? 0);

        return (
          <CompanyDossier
            key={c.id}
            name={c.name}
            meta={metaParts.join(" · ")}
            status={status}
            talentScore={c.talentNeedScore ?? undefined}
            signals={events}
            actions={
              <button
                onClick={() => addToWatchlist.mutate({ companyId: c.id })}
                disabled={addToWatchlist.isPending}
                className="hover:opacity-70 transition-opacity"
              >
                + Lisää seurantalistalle →
              </button>
            }
          />
        );
      })}
    </div>
  );
}

// ─── PRH-HAKU tab ────────────────────────────────────────────────────────────

function PrhTab() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const { data: results, isLoading } = trpc.prh.searchByName.useQuery(
    { name: submitted },
    { enabled: submitted.length >= 2 },
  );
  const addToWatchlist = trpc.watchlist.add.useMutation({
    onSuccess: () => toast.success("Lisätty seurantalistalle"),
    onError: () => toast.error("Lisäys epäonnistui"),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(query.trim());
  }

  return (
    <div className="max-w-4xl">
      <form onSubmit={handleSearch}>
        <p className="text-base italic text-slate-500 mb-3">Mitä yritystä etsit?</p>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Y-tunnus, nimi tai osoite"
          className="w-full bg-transparent border-b border-slate-900 text-slate-900 placeholder:text-slate-400 placeholder:italic text-sm py-2 outline-none"
        />
        <button
          type="submit"
          disabled={query.trim().length < 2}
          className="mt-3 text-[11px] uppercase tracking-[0.18em] font-bold text-slate-900 hover:opacity-70 transition-opacity disabled:opacity-30"
        >
          Hae →
        </button>
      </form>

      {isLoading && <p className="mt-8 text-slate-400 italic text-sm">Haetaan PRH:sta…</p>}

      {results && results.length === 0 && submitted && (
        <p className="mt-8 text-slate-500 italic text-base">Ei tuloksia haulle "{submitted}".</p>
      )}

      {results && results.length > 0 && (
        <div className="mt-8">
          {results.map((r: any, i: number) => (
            <article key={r.yTunnus ?? i} className="py-6 border-b border-slate-900/15">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-tight text-slate-900">
                  {r.companyName}
                </h2>
                <span className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-500">
                  Y-tunnus {r.yTunnus}
                </span>
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500">
                {[r.businessLine, r.status].filter(Boolean).join(" · ")}
              </div>
              {r.address && (
                <p className="mt-2 text-sm text-slate-600">{r.address}</p>
              )}
              <div className="mt-4 text-[11px] uppercase tracking-[0.18em] font-bold text-slate-900">
                <button
                  onClick={() => {
                    // We add by y-tunnus after enriching. For now add to watchlist requires companyId.
                    // Show a toast explaining to use Löydä tab instead.
                    toast.info("Hae yritys ensin Löydä-välilehdeltä lisätäksesi sen seurantaan");
                  }}
                  className="hover:opacity-70 transition-opacity"
                >
                  + Lisää seurantalistalle →
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function CompaniesSidebar() {
  const [sort, setSort] = useState<"talent" | "recent" | "alpha">("talent");
  const [filters, setFilters] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setFilters((f) => ({ ...f, [key]: !f[key] }));

  return (
    <div className="space-y-8">
      <div>
        <BriefSectionLabel>Suodata signaalin mukaan</BriefSectionLabel>
        <div className="space-y-2">
          {["Hakemassa", "Rahoitus", "Johtomuutos", "YTJ-muutos", "Uusi toimisto"].map((opt) => (
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

      <div>
        <BriefSectionLabel>Järjestä</BriefSectionLabel>
        <div className="space-y-2">
          {[
            { id: "talent" as const, label: "Talent Score" },
            { id: "recent" as const, label: "Viimeisin signaali" },
            { id: "alpha" as const, label: "Aakkosellinen" },
          ].map(({ id, label }) => (
            <label key={id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="sort"
                checked={sort === id}
                onChange={() => setSort(id)}
                className="accent-slate-900"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Companies() {
  const [location, navigate] = useLocation();
  const activeTab = tabFromPath(location);

  function handleTabSelect(id: TabId) {
    if (id === "seurannassa") navigate("/companies");
    else if (id === "loyda") navigate("/companies/discover");
    else navigate("/companies/prh");
  }

  const showSidebar = activeTab !== "prh";

  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="COMPANIES"
        subtitle="Yritykset, joita seuraat, ja joita et vielä."
      />
      <TabRail tabs={TABS} active={activeTab} onSelect={handleTabSelect} />

      <div className={`grid grid-cols-1 gap-8 mt-8 ${showSidebar ? "lg:grid-cols-12" : ""}`}>
        <div className={showSidebar ? "lg:col-span-8" : ""}>
          {activeTab === "seurannassa" && <SeurannassaTab />}
          {activeTab === "loyda" && <LoydaTab />}
          {activeTab === "prh" && <PrhTab />}
        </div>
        {showSidebar && (
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-20">
              <CompaniesSidebar />
            </div>
          </div>
        )}
      </div>
    </EditorialShell>
  );
}
