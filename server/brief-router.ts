// server/brief-router.ts
import { protectedProcedure, router } from "./_core/trpc";
import { selectLeadStory, computeProfileCompleteness } from "../shared/lib/brief-logic";
import { lintAgentNote } from "../shared/lib/voice-lint";
import type { MatchEntry, SignalEntry } from "../shared/lib/brief-logic";

export const briefRouter = router({
  // ── 1. Lead Story ────────────────────────────────────────────────────────
  leadStory: protectedProcedure.query(async ({ ctx }) => {
    const { getMatchesByUserId, getWatchlist, getProfileByUserId, getDb } = await import("./db");
    const { sql } = await import("drizzle-orm");

    const [rawMatches, watchlist, profile] = await Promise.all([
      getMatchesByUserId(ctx.user.id, 50),
      getWatchlist(ctx.user.id),
      getProfileByUserId(ctx.user.id),
    ]);

    const watchlistCompanyIds = new Set<number>((watchlist as any[]).map((w: any) => w.companyId));

    const matches: MatchEntry[] = (rawMatches as any[]).map(row => ({
      matchId: row.id,
      jobId: row.jobId,
      title: row.title,
      company: row.company,
      location: row.location ?? null,
      totalScore: row.totalScore,
      postedAt: row.postedAt ? new Date(row.postedAt) : null,
      matchedAt: new Date(row.matchedAt),
      isWatchlisted: watchlistCompanyIds.has(row.companyId),
      url: row.url ?? null,
    }));

    // Fetch recent watchlist signals (last 24h)
    let watchlistSignals: SignalEntry[] = [];
    if ((watchlist as any[]).length > 0) {
      const db = await getDb();
      if (db) {
        const companyIds = (watchlist as any[])
          .map((w: any) => parseInt(w.companyId, 10))
          .filter(n => !isNaN(n) && n > 0);
        if (companyIds.length === 0) {
          // watchlistSignals stays []
        } else {
          const result = await db.execute(sql`
            SELECT e.companyId, c.name as companyName, e.headline, e.summary,
                   e.eventType, e.publishedAt, e.impactStrength
            FROM events e
            JOIN companies c ON e.companyId = c.id
            WHERE e.companyId IN (${sql.join(companyIds.map(id => sql`${id}`), sql`, `)})
              AND e.publishedAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY e.impactStrength DESC
            LIMIT 10
          `);
          watchlistSignals = ((result[0] as any[]) || []).map(row => ({
            companyId: row.companyId,
            companyName: row.companyName,
            headline: row.headline,
            summary: row.summary,
            eventType: row.eventType,
            publishedAt: new Date(row.publishedAt),
            impactStrength: row.impactStrength ?? 0,
          }));
        }
      }
    }

    const completeness = computeProfileCompleteness(profile as any);
    return selectLeadStory({ matches, watchlistSignals, profileCompleteness: completeness });
  }),

  // ── 2. More Headlines ────────────────────────────────────────────────────
  moreHeadlines: protectedProcedure.query(async ({ ctx }) => {
    const { getMatchesByUserId } = await import("./db");
    const rows = (await getMatchesByUserId(ctx.user.id, 10)) as any[];
    return rows
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5)
      .map(row => ({
        matchId: row.id,
        jobId: row.jobId,
        title: row.title,
        company: row.company,
        location: row.location ?? null,
        totalScore: row.totalScore,
        postedAt: row.postedAt ?? null,
        url: row.url ?? null,
      }));
  }),

  // ── 3. The Beat ──────────────────────────────────────────────────────────
  theBeat: protectedProcedure.query(async ({ ctx }) => {
    const { getWatchlist, getEventsByCompanyId } = await import("./db");
    const watchlist = (await getWatchlist(ctx.user.id)) as any[];

    const entries = await Promise.all(
      watchlist.slice(0, 6).map(async (w: any) => {
        const events = (await getEventsByCompanyId(w.companyId, 3)) as any[];
        return {
          companyId: w.companyId,
          companyName: w.companyName,
          industry: w.industry ?? null,
          recentEventsCount: w.recentEventsCount ?? 0,
          latestEvents: events.map(e => ({
            headline: e.headline,
            summary: e.summary,
            eventType: e.eventType,
            publishedAt: e.publishedAt ?? null,
            impactStrength: e.impactStrength ?? 0,
          })),
        };
      })
    );

    return entries
      .filter(e => e.latestEvents.length > 0)
      .sort((a, b) => {
        const aDate = a.latestEvents[0]?.publishedAt ? new Date(a.latestEvents[0].publishedAt).getTime() : 0;
        const bDate = b.latestEvents[0]?.publishedAt ? new Date(b.latestEvents[0].publishedAt).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 3);
  }),

  // ── 4. Agent Notes ───────────────────────────────────────────────────────
  agentNotes: protectedProcedure.query(async ({ ctx }) => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const { getMatchesByUserId, getWatchlist, getProfileByUserId } = await import("./db");

    const [rawMatches, watchlist, profile] = await Promise.all([
      getMatchesByUserId(ctx.user.id, 5),
      getWatchlist(ctx.user.id),
      getProfileByUserId(ctx.user.id),
    ]);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const topMatch = (rawMatches as any[])[0];
    const topCompany = (watchlist as any[])[0];

    type AgentConfig = {
      agentId: "signal_scout" | "career_coach" | "job_analyzer";
      byline: string;
      prompt: string;
    };

    const configs: AgentConfig[] = [
      {
        agentId: "signal_scout",
        byline: "Väinö — kenttäraportti",
        prompt: `Kirjoita lyhyt kenttäraportti (2-3 virkettä) työnhakumarkkinan signaalista suomalaiselle työnhakijalle.
Konteksti: ${topCompany ? `${topCompany.companyName} seurantalistalla, ${topCompany.recentEventsCount ?? 0} signaalia 30 päivässä.` : "Ei watchlist-yrityksiä."}
Tyyli: kenttäreportteri, kolmannessa persoonassa, faktat edellä. Ei toisen persoonan puhuttelua (ei "sinun", ei "profiilistasi").
Vastaa pelkkä teksti, ei otsikoita.`,
      },
      {
        agentId: "career_coach",
        byline: "Kaisa — kolumni",
        prompt: `Kirjoita lyhyt kolumni (2-3 virkettä) CV-neuvona suomalaiselle työnhakijalle.
Konteksti: ${profile ? `Kokemus ${(profile as any).yearsOfExperience ?? "?"} vuotta, taidot: ${(profile as any).skills ?? "ei tiedossa"}.` : "Profiili puuttuu."}
Tyyli: kolumnisti, henkilökohtainen, käytä "sinun"/"profiilistasi" luontevasti. Ei kenttäraportteri-jargonia (ei "Signaali:", "Lähde:", "PRH-rekisteri").
Vastaa pelkkä teksti.`,
      },
      {
        agentId: "job_analyzer",
        byline: "Työpaikka-analyytikko — kritiikki",
        prompt: `Kirjoita lyhyt kriittinen analyysi (2-3 virkettä) yhdestä avoinna olevasta työpaikasta suomalaiselle työnhakijalle.
Konteksti: ${topMatch ? `Paras matchi: ${topMatch.title} @ ${topMatch.company}, ${topMatch.totalScore}% sopivuus.` : "Ei matcheja."}
Tyyli: kriitikko, analyyttinen, ei kehuvaa kieltä (ei "Hienoa", "Mahtavaa", "Erinomaisesti"). Nosta myös heikkoudet esiin.
Vastaa pelkkä teksti.`,
      },
    ];

    const results = await Promise.all(
      configs.map(async (cfg) => {
        try {
          const call = async (extraInstruction = "") => {
            const msg = await client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 200,
              messages: [{ role: "user", content: cfg.prompt + (extraInstruction ? "\n\n" + extraInstruction : "") }],
            });
            return (msg.content[0] as { type: string; text?: string }).text ?? "";
          };

          let text = await call();
          const lint = lintAgentNote(cfg.agentId, text);

          if (!lint.ok) {
            const correction = `Korjaus: ${lint.violations.join("; ")}. Kirjoita uudelleen ilman näitä ongelmia.`;
            text = await call(correction);
          }

          return { agentId: cfg.agentId, byline: cfg.byline, note: text };
        } catch (err) {
          console.error(`[agentNotes] ${cfg.agentId} failed:`, err);
          return { agentId: cfg.agentId, byline: cfg.byline, note: "" };
        }
      })
    );

    return results;
  }),

  // ── 5. Sidebar ───────────────────────────────────────────────────────────
  sidebar: protectedProcedure.query(async ({ ctx }) => {
    const { getMatchesByUserId, getSavedJobsByUserId, getWatchlist, getProfileByUserId, getDb } = await import("./db");
    const { sql } = await import("drizzle-orm");

    const [rawMatches, savedJobs, watchlist, profile] = await Promise.all([
      getMatchesByUserId(ctx.user.id, 100),
      getSavedJobsByUserId(ctx.user.id),
      getWatchlist(ctx.user.id),
      getProfileByUserId(ctx.user.id),
    ]);

    const completeness = computeProfileCompleteness(profile as any);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const matchesToday = (rawMatches as any[]).filter(
      r => r.matchedAt && new Date(r.matchedAt) >= today
    ).length;

    let recentSignals: { headline: string; companyName: string; publishedAt: string; eventType: string }[] = [];
    if ((watchlist as any[]).length > 0) {
      const db = await getDb();
      if (db) {
        const companyIds = (watchlist as any[])
          .map((w: any) => parseInt(w.companyId, 10))
          .filter(n => !isNaN(n) && n > 0);
        if (companyIds.length === 0) {
          // recentSignals stays []
        } else {
          const result = await db.execute(sql`
            SELECT e.headline, c.name as companyName, e.publishedAt, e.eventType
            FROM events e
            JOIN companies c ON e.companyId = c.id
            WHERE e.companyId IN (${sql.join(companyIds.map(id => sql`${id}`), sql`, `)})
              AND e.publishedAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY e.publishedAt DESC
            LIMIT 6
          `);
          recentSignals = ((result[0] as any[]) || []).map(row => ({
            headline: row.headline,
            companyName: row.companyName,
            publishedAt: row.publishedAt,
            eventType: row.eventType,
          }));
        }
      }
    }

    return {
      metrics: {
        matchesToday,
        savedJobsCount: (savedJobs as any[]).length,
        watchlistCount: (watchlist as any[]).length,
        profileCompleteness: completeness,
      },
      recentSignals,
    };
  }),
});
