import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  EditorialShell,
  Masthead,
  TabRail,
} from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

type TabId = "kaikki" | "lukematta" | "arkistoitu";

function tabFromPath(path: string): TabId {
  if (path === "/bulletins/unread") return "lukematta";
  if (path === "/bulletins/archived") return "arkistoitu";
  return "kaikki";
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "kaikki", label: "KAIKKI" },
  { id: "lukematta", label: "LUKEMATTA" },
  { id: "arkistoitu", label: "ARKISTOITU" },
];

const READ_KEY = "bulletins_read";
const ARCHIVED_KEY = "bulletins_archived";

function getSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

function saveSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("fi-FI", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).toUpperCase();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" });
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Build a unified feed item from either a signal event or a match
interface FeedItem {
  id: string;
  date: Date;
  headline: string;
  sub: string;
  url?: string;
}

function useReadState() {
  const [read, setRead] = useState<Set<string>>(() => getSet(READ_KEY));
  const [archived, setArchived] = useState<Set<string>>(() => getSet(ARCHIVED_KEY));

  function markRead(id: string) {
    setRead((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSet(READ_KEY, next);
      return next;
    });
  }

  function archive(id: string) {
    markRead(id);
    setArchived((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSet(ARCHIVED_KEY, next);
      return next;
    });
  }

  return { read, archived, markRead, archive };
}

export default function Bulletins() {
  const [location, navigate] = useLocation();
  const activeTab = tabFromPath(location);
  const { read, archived, markRead, archive } = useReadState();

  const { data: signals } = trpc.signalFeed.recent.useQuery({ limit: 50 });
  const { data: matches } = trpc.matches.list.useQuery({ limit: 20 });

  function handleTabSelect(id: TabId) {
    if (id === "kaikki") navigate("/bulletins");
    else if (id === "lukematta") navigate("/bulletins/unread");
    else navigate("/bulletins/archived");
  }

  // Build unified feed
  const items: FeedItem[] = [];

  if (signals) {
    for (const s of signals as any[]) {
      items.push({
        id: `sig-${s.id}`,
        date: new Date(s.createdAt),
        headline: s.description ?? s.eventType ?? "Signaali",
        sub: [s.companyName, s.industry].filter(Boolean).join("  ·  "),
      });
    }
  }

  if (matches) {
    for (const { match, job } of matches as any[]) {
      const date = new Date(match.matchedAt ?? match.createdAt ?? Date.now());
      items.push({
        id: `match-${match.id}`,
        date,
        headline: `${job.title} — ${match.totalScore}% match`,
        sub: [job.company, job.location].filter(Boolean).join("  ·  "),
        url: job.url,
      });
    }
  }

  // Sort by date desc
  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Filter by tab
  const filtered = items.filter((item) => {
    const isArchived = archived.has(item.id);
    const isRead = read.has(item.id);
    if (activeTab === "arkistoitu") return isArchived;
    if (activeTab === "lukematta") return !isRead && !isArchived;
    return !isArchived;
  });

  // Group by day
  const days: Map<string, FeedItem[]> = new Map();
  for (const item of filtered) {
    const k = dayKey(item.date);
    if (!days.has(k)) days.set(k, []);
    days.get(k)!.push(item);
  }

  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="BULLETINS"
        subtitle="Kaikki hälytykset, aikajärjestyksessä."
      />
      <TabRail tabs={TABS} active={activeTab} onSelect={handleTabSelect} />

      <div className="mt-8 max-w-3xl">
        {filtered.length === 0 && (
          <p className="py-16 text-slate-500 italic text-base">
            {activeTab === "lukematta"
              ? "Kaikki on luettu."
              : activeTab === "arkistoitu"
                ? "Arkisto on tyhjä."
                : "Ei hälytyksiä vielä."}
          </p>
        )}

        {Array.from(days.entries()).map(([key, dayItems]) => {
          const dayDate = new Date(key + "T12:00:00");
          return (
            <div key={key}>
              {/* Day header */}
              <div className="py-3">
                <div className="border-t border-slate-900/40" />
                <p className="py-2 text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900">
                  {formatDay(dayDate)}
                </p>
                <div className="border-b border-slate-900/40" />
              </div>

              {/* Items */}
              {dayItems.map((item) => {
                const isRead = read.has(item.id);
                const isArchived = archived.has(item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => markRead(item.id)}
                    className="group py-4 border-b border-slate-900/15 flex gap-4 hover:bg-slate-900/[0.025] -mx-2 px-2 transition-colors cursor-pointer"
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 w-4 flex items-start pt-[5px]">
                      {!isRead && !isArchived && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <time className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-400 tabular-nums flex-shrink-0">
                          {formatTime(item.date)}
                        </time>
                        <p className="text-base text-slate-900 leading-snug">{item.headline}</p>
                      </div>
                      {item.sub && (
                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-slate-400">{item.sub}</p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-[11px] uppercase tracking-[0.18em] font-bold text-slate-900">
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:opacity-60 transition-opacity"
                          >
                            Avaa ilmoitus →
                          </a>
                        )}
                        {!isArchived && (
                          <button
                            onClick={(e) => { e.stopPropagation(); archive(item.id); }}
                            className="text-slate-400 hover:text-slate-900 transition-colors"
                          >
                            Arkistoi
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </EditorialShell>
  );
}
