# JobScout "The Brief" Content Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all content sections of "The Brief" editorial homepage: Lead Story (6-tier server-side selector), More Headlines, The Beat, From Our Agents (AI-generated, voice-linted), and the right sidebar.

**Architecture:** A new `server/brief-router.ts` handles all Brief data via 4 tRPC procedures. Pure selection logic lives in `shared/lib/brief-logic.ts` (unit-tested). Agent voice is enforced by `shared/lib/voice-lint.ts` (regex-based, unit-tested). The existing `BriefPlaceholder.tsx` is replaced by a real `Brief.tsx` page with a 2-column grid.

**Tech Stack:** TypeScript, tRPC v10 (`publicProcedure`/`protectedProcedure`/`router` from `server/_core/trpc`), Anthropic SDK (`@anthropic-ai/sdk`), Vitest, React 19, Tailwind CSS 4, editorial primitives from `client/src/components/editorial/`.

---

## File Structure

**Create:**
- `shared/lib/brief-logic.ts` — `selectLeadStory` pure function + types
- `shared/lib/brief-logic.test.ts` — 10 unit tests covering all 6 tiers + tiebreakers
- `shared/lib/voice-lint.ts` — `lintAgentNote` pure function
- `shared/lib/voice-lint.test.ts` — 9 unit tests (3 agents × valid + forbidden patterns)
- `server/brief-router.ts` — briefRouter with 4 tRPC procedures
- `client/src/pages/editorial/brief/LeadStory.tsx` — renders tier-aware lead
- `client/src/pages/editorial/brief/MoreHeadlines.tsx` — 4 match headlines
- `client/src/pages/editorial/brief/TheBeat.tsx` — 3 watchlist company entries
- `client/src/pages/editorial/brief/AgentNotes.tsx` — 3 AI notes with voice lint
- `client/src/pages/editorial/brief/BriefSidebar.tsx` — Key Numbers + Signal Ticker + Quick Actions
- `client/src/pages/editorial/Brief.tsx` — main page, 2-col grid

**Modify:**
- `server/routers.ts` — add `createdAt` to `auth.me`; import + register `briefRouter`
- `client/src/hooks/useEditionNumber.ts` — use real `createdAt` from auth
- `client/src/App.tsx` — swap `BriefPlaceholder` import for `Brief`

---

### Task 1: `selectLeadStory` pure function (TDD)

**Files:**
- Create: `shared/lib/brief-logic.ts`
- Create: `shared/lib/brief-logic.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// shared/lib/brief-logic.test.ts
import { describe, it, expect } from "vitest";
import { selectLeadStory, computeProfileCompleteness } from "./brief-logic";
import type { MatchEntry, SignalEntry, BriefInput } from "./brief-logic";

const NOW = new Date("2026-04-24T10:00:00Z");
const HOURS = (h: number) => new Date(NOW.getTime() - h * 3600_000);

function makeMatch(overrides: Partial<MatchEntry> = {}): MatchEntry {
  return {
    matchId: 1,
    jobId: 10,
    title: "Senior Developer",
    company: "Reaktor",
    location: "Helsinki",
    totalScore: 75,
    postedAt: HOURS(12),
    matchedAt: HOURS(1),
    isWatchlisted: false,
    url: "https://reaktor.fi/jobs/1",
    ...overrides,
  };
}

function makeSignal(overrides: Partial<SignalEntry> = {}): SignalEntry {
  return {
    companyId: 100,
    companyName: "Reaktor",
    headline: "Reaktor avasi kuusi paikkaa",
    summary: "Kasvua backend-tiimissä",
    eventType: "hiring_burst",
    publishedAt: HOURS(6),
    impactStrength: 4,
    ...overrides,
  };
}

describe("selectLeadStory", () => {
  it("Tier 1: returns match with score ≥ 90 posted within 24h", () => {
    const input: BriefInput = {
      matches: [makeMatch({ totalScore: 92, postedAt: HOURS(10) })],
      watchlistSignals: [],
      profileCompleteness: 80,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBe(1);
    expect(result.kind).toBe("match");
  });

  it("Tier 1 tiebreaker: watchlisted match wins over non-watchlisted", () => {
    const input: BriefInput = {
      matches: [
        makeMatch({ matchId: 1, totalScore: 91, postedAt: HOURS(10), isWatchlisted: false }),
        makeMatch({ matchId: 2, totalScore: 91, postedAt: HOURS(10), isWatchlisted: true }),
      ],
      watchlistSignals: [],
      profileCompleteness: 80,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBe(1);
    const payload = result.payload as { matchId: number };
    expect(payload.matchId).toBe(2);
  });

  it("Tier 2: returns match with score ≥ 80 posted within 24h", () => {
    const input: BriefInput = {
      matches: [makeMatch({ totalScore: 83, postedAt: HOURS(20) })],
      watchlistSignals: [],
      profileCompleteness: 80,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBe(2);
    expect(result.kind).toBe("match");
  });

  it("Tier 3: returns highest-scoring match posted within 72h", () => {
    const input: BriefInput = {
      matches: [
        makeMatch({ matchId: 1, totalScore: 70, postedAt: HOURS(60) }),
        makeMatch({ matchId: 2, totalScore: 65, postedAt: HOURS(60) }),
      ],
      watchlistSignals: [],
      profileCompleteness: 80,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBe(3);
    const payload = result.payload as { matchId: number };
    expect(payload.matchId).toBe(1);
  });

  it("Tier 3: match older than 72h is skipped", () => {
    const input: BriefInput = {
      matches: [makeMatch({ totalScore: 70, postedAt: HOURS(80) })],
      watchlistSignals: [],
      profileCompleteness: 80,
      now: NOW,
    };
    const result = selectLeadStory(input);
    // Falls through to Tier 5 (profile prompt < 70%) or Tier 6
    expect(result.tier).toBeGreaterThanOrEqual(4);
  });

  it("Tier 4: watchlist signal in last 24h wins when no good matches", () => {
    const input: BriefInput = {
      matches: [], // no matches
      watchlistSignals: [makeSignal()],
      profileCompleteness: 80,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBe(4);
    expect(result.kind).toBe("signal");
  });

  it("Tier 4: watchlist signal does NOT win when Tier 1 match exists", () => {
    const input: BriefInput = {
      matches: [makeMatch({ totalScore: 92, postedAt: HOURS(10) })],
      watchlistSignals: [makeSignal()],
      profileCompleteness: 80,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBe(1);
  });

  it("Tier 5: profile_prompt when completeness < 70", () => {
    const input: BriefInput = {
      matches: [],
      watchlistSignals: [],
      profileCompleteness: 50,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBe(5);
    expect(result.kind).toBe("profile_prompt");
  });

  it("Tier 6: welcome fallback when no data at all", () => {
    const input: BriefInput = {
      matches: [],
      watchlistSignals: [],
      profileCompleteness: 85,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBe(6);
    expect(result.kind).toBe("welcome");
  });

  it("computeProfileCompleteness returns 0 for null profile", () => {
    expect(computeProfileCompleteness(null)).toBe(0);
  });

  it("computeProfileCompleteness returns 100 when all 7 key fields present", () => {
    const profile = {
      currentTitle: "Developer",
      yearsOfExperience: 5,
      skills: '["TypeScript"]',
      preferredJobTitles: '["Senior Developer"]',
      preferredLocations: '["Helsinki"]',
      salaryMin: 4000,
      workHistory: '[{"company":"Reaktor","title":"Dev","duration":"2y","description":""}]',
    };
    expect(computeProfileCompleteness(profile)).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/tuukka/Downloads/Projects/AI-Agents/job_scout_agent/.worktrees/brief-content
npx vitest run shared/lib/brief-logic.test.ts 2>&1 | tail -5
```

Expected: `Cannot find module './brief-logic'`

- [ ] **Step 3: Implement `brief-logic.ts`**

```typescript
// shared/lib/brief-logic.ts

export interface MatchEntry {
  matchId: number;
  jobId: number;
  title: string;
  company: string;
  location: string | null;
  totalScore: number;
  postedAt: Date | null;
  matchedAt: Date;
  isWatchlisted: boolean;
  url: string | null;
}

export interface SignalEntry {
  companyId: number;
  companyName: string;
  headline: string;
  summary: string;
  eventType: string;
  publishedAt: Date;
  impactStrength: number;
}

export interface BriefInput {
  matches: MatchEntry[];
  watchlistSignals: SignalEntry[];
  profileCompleteness: number;
  now?: Date;
}

export type LeadKind = "match" | "signal" | "profile_prompt" | "welcome";

export type MatchPayload = {
  matchId: number; jobId: number; title: string; company: string;
  location: string | null; totalScore: number; url: string | null;
};
export type SignalPayload = {
  companyId: number; companyName: string; headline: string;
  summary: string; eventType: string;
};
export type ProfilePayload = { completeness: number };
export type WelcomePayload = Record<string, never>;

export interface LeadStoryResult {
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  kind: LeadKind;
  payload: MatchPayload | SignalPayload | ProfilePayload | WelcomePayload;
}

function hoursAgo(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / 3600_000;
}

function toMatchPayload(m: MatchEntry): MatchPayload {
  return { matchId: m.matchId, jobId: m.jobId, title: m.title, company: m.company,
    location: m.location, totalScore: m.totalScore, url: m.url };
}

function sortMatches(matches: MatchEntry[]): MatchEntry[] {
  return [...matches].sort((a, b) => {
    if (a.isWatchlisted !== b.isWatchlisted) return a.isWatchlisted ? -1 : 1;
    const aPosted = a.postedAt?.getTime() ?? 0;
    const bPosted = b.postedAt?.getTime() ?? 0;
    if (aPosted !== bPosted) return bPosted - aPosted;
    return b.totalScore - a.totalScore;
  });
}

export function selectLeadStory(input: BriefInput): LeadStoryResult {
  const now = input.now ?? new Date();
  const { matches, watchlistSignals, profileCompleteness } = input;

  const fresh24 = matches.filter(m => m.postedAt && hoursAgo(m.postedAt, now) <= 24);
  const fresh72 = matches.filter(m => m.postedAt && hoursAgo(m.postedAt, now) <= 72);

  // Tier 1: score ≥ 90, within 24h
  const tier1 = sortMatches(fresh24.filter(m => m.totalScore >= 90));
  if (tier1.length > 0) return { tier: 1, kind: "match", payload: toMatchPayload(tier1[0]) };

  // Tier 2: score ≥ 80, within 24h
  const tier2 = sortMatches(fresh24.filter(m => m.totalScore >= 80));
  if (tier2.length > 0) return { tier: 2, kind: "match", payload: toMatchPayload(tier2[0]) };

  // Tier 3: highest-scoring within 72h
  const tier3 = sortMatches(fresh72);
  if (tier3.length > 0) return { tier: 3, kind: "match", payload: toMatchPayload(tier3[0]) };

  // Tier 4: watchlist signal in last 24h
  const recentSignals = watchlistSignals
    .filter(s => hoursAgo(s.publishedAt, now) <= 24)
    .sort((a, b) => b.impactStrength - a.impactStrength);
  if (recentSignals.length > 0) {
    const s = recentSignals[0];
    return { tier: 4, kind: "signal", payload: { companyId: s.companyId,
      companyName: s.companyName, headline: s.headline, summary: s.summary,
      eventType: s.eventType } };
  }

  // Tier 5: incomplete profile
  if (profileCompleteness < 70) {
    return { tier: 5, kind: "profile_prompt", payload: { completeness: profileCompleteness } };
  }

  // Tier 6: welcome
  return { tier: 6, kind: "welcome", payload: {} };
}

const COMPLETENESS_FIELDS = [
  "currentTitle", "yearsOfExperience", "skills", "preferredJobTitles",
  "preferredLocations", "salaryMin", "workHistory",
] as const;

export function computeProfileCompleteness(profile: Record<string, unknown> | null): number {
  if (!profile) return 0;
  const filled = COMPLETENESS_FIELDS.filter(f => {
    const v = profile[f];
    if (v === null || v === undefined || v === "") return false;
    if (typeof v === "string" && (v === "[]" || v === "null")) return false;
    return true;
  });
  return Math.round((filled.length / COMPLETENESS_FIELDS.length) * 100);
}
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
npx vitest run shared/lib/brief-logic.test.ts 2>&1 | tail -5
```

Expected: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add shared/lib/brief-logic.ts shared/lib/brief-logic.test.ts
git commit -m "feat: add selectLeadStory pure function with 6-tier logic"
```

---

### Task 2: `lintAgentNote` pure function (TDD)

**Files:**
- Create: `shared/lib/voice-lint.ts`
- Create: `shared/lib/voice-lint.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// shared/lib/voice-lint.test.ts
import { describe, it, expect } from "vitest";
import { lintAgentNote } from "./voice-lint";

describe("lintAgentNote — signal_scout (Väinö)", () => {
  it("passes a valid kenttäraportti note", () => {
    const result = lintAgentNote("signal_scout",
      "Reaktor kirjasi osoitteenmuutoksen PRH-rekisteriin — siirtyi Espooseen viime viikolla.");
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("flags second-person pronoun 'sinun'", () => {
    const result = lintAgentNote("signal_scout",
      "Reaktor avasi paikkoja, mutta sinun kannattaa tarkistaa palkka.");
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatch(/toisen persoonan/);
  });

  it("flags 'profiilistasi'", () => {
    const result = lintAgentNote("signal_scout",
      "Reaktor kasvaa. Päivitä profiilistasi taidot ensin.");
    expect(result.ok).toBe(false);
  });
});

describe("lintAgentNote — career_coach (Kaisa)", () => {
  it("passes a valid kolumni note", () => {
    const result = lintAgentNote("career_coach",
      "Profiilistasi puuttuu ainoa asia jonka Reaktorin rekrytoijat etsivät — projektikokemusta. Lisää se nyt.");
    expect(result.ok).toBe(true);
  });

  it("flags field-reporter label 'Signaali:'", () => {
    const result = lintAgentNote("career_coach",
      "Signaali: Reaktor avasi paikkoja. Kannattaa hakea.");
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatch(/kenttäraportteri/);
  });

  it("flags 'PRH-rekisteri' jargon", () => {
    const result = lintAgentNote("career_coach",
      "PRH-rekisteristä näkyy kasvu. Päivitä CV.");
    expect(result.ok).toBe(false);
  });
});

describe("lintAgentNote — job_analyzer (Kriitikko)", () => {
  it("passes a valid kritiikki note", () => {
    const result = lintAgentNote("job_analyzer",
      "Woltin uusi ilmoitus on geneerinen — vaatimukset epämääräiset, palkka ei näy. Ohita.");
    expect(result.ok).toBe(true);
  });

  it("flags cheerful opener 'Hienoa'", () => {
    const result = lintAgentNote("job_analyzer",
      "Hienoa — Reaktorin ilmoitus sopii sinulle erinomaisesti!");
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatch(/kehuvaa kieltä/);
  });

  it("flags 'Mahtavaa'", () => {
    const result = lintAgentNote("job_analyzer", "Mahtavaa, löysit erinomaisen paikan.");
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run shared/lib/voice-lint.test.ts 2>&1 | tail -5
```

Expected: `Cannot find module './voice-lint'`

- [ ] **Step 3: Implement `voice-lint.ts`**

```typescript
// shared/lib/voice-lint.ts

export type AgentId = "signal_scout" | "career_coach" | "job_analyzer";

export interface LintResult {
  ok: boolean;
  violations: string[];
}

type Rule = { pattern: RegExp; message: string };

const RULES: Record<AgentId, Rule[]> = {
  signal_scout: [
    { pattern: /\bsinun\b/i,       message: "signal_scout ei käytä toisen persoonan puhuttelua" },
    { pattern: /\bprofiilistasi\b/i, message: "signal_scout ei käytä toisen persoonan puhuttelua" },
    { pattern: /\bSinä\b/i,        message: "signal_scout ei käytä toisen persoonan puhuttelua" },
  ],
  career_coach: [
    { pattern: /\bSignaali:/i,     message: "career_coach ei käytä kenttäraportteri-jargonia" },
    { pattern: /\bLähde:/i,        message: "career_coach ei käytä kenttäraportteri-jargonia" },
    { pattern: /\bPRH-rekisteri\b/i, message: "career_coach ei käytä kenttäraportteri-jargonia" },
  ],
  job_analyzer: [
    { pattern: /\bHienoa\b/i,      message: "job_analyzer ei käytä kehuvaa kieltä" },
    { pattern: /\bMahtavaa\b/i,    message: "job_analyzer ei käytä kehuvaa kieltä" },
    { pattern: /\bErinomaisesti\b/i, message: "job_analyzer ei käytä kehuvaa kieltä" },
  ],
};

export function lintAgentNote(agentId: AgentId, text: string): LintResult {
  const rules = RULES[agentId] ?? [];
  const violations = rules
    .filter(r => r.pattern.test(text))
    .map(r => r.message);
  return { ok: violations.length === 0, violations };
}
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
npx vitest run shared/lib/voice-lint.test.ts 2>&1 | tail -5
```

Expected: `9 passed`

- [ ] **Step 5: Run all shared tests together to confirm no regressions**

```bash
npx vitest run shared/ 2>&1 | tail -8
```

Expected: `26 passed` (7 editorial-date + 10 brief-logic + 9 voice-lint)

- [ ] **Step 6: Commit**

```bash
git add shared/lib/voice-lint.ts shared/lib/voice-lint.test.ts
git commit -m "feat: add lintAgentNote voice enforcement for 3 agent personas"
```

---

### Task 3: `server/brief-router.ts` — 4 tRPC procedures

**Files:**
- Create: `server/brief-router.ts`

- [ ] **Step 1: Create the file**

```typescript
// server/brief-router.ts
import { protectedProcedure, router } from "./_core/trpc";
import { selectLeadStory, computeProfileCompleteness } from "../shared/lib/brief-logic";
import { lintAgentNote } from "../shared/lib/voice-lint";
import type { MatchEntry, SignalEntry } from "../shared/lib/brief-logic";

export const briefRouter = router({

  // ── LEAD STORY ────────────────────────────────────────────────────────────
  leadStory: protectedProcedure.query(async ({ ctx }) => {
    const { getMatchesByUserId, getWatchlist, getProfileByUserId, getDb } = await import("./db");
    const { sql } = await import("drizzle-orm");

    const [rawMatches, watchlist, profile] = await Promise.all([
      getMatchesByUserId(ctx.user.id, 50),
      getWatchlist(ctx.user.id),
      getProfileByUserId(ctx.user.id),
    ]);

    const watchlistCompanyIds = new Set<number>(watchlist.map((w: any) => w.companyId));

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
    if (watchlist.length > 0) {
      const db = await getDb();
      if (db) {
        const companyIds = watchlist.map((w: any) => w.companyId);
        const result = await db.execute(sql`
          SELECT e.companyId, c.name as companyName, e.headline, e.summary,
                 e.eventType, e.publishedAt, e.impactStrength
          FROM events e
          JOIN companies c ON e.companyId = c.id
          WHERE e.companyId IN (${sql.raw(companyIds.join(","))})
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

    const completeness = computeProfileCompleteness(profile as any);
    return selectLeadStory({ matches, watchlistSignals, profileCompleteness: completeness });
  }),

  // ── MORE HEADLINES ────────────────────────────────────────────────────────
  moreHeadlines: protectedProcedure.query(async ({ ctx }) => {
    const { getMatchesByUserId } = await import("./db");
    const rows = (await getMatchesByUserId(ctx.user.id, 10)) as any[];
    // Return top 4 non-lead matches sorted by score desc
    return rows
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5) // slice 5 so caller can drop lead (first) → 4 headlines
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

  // ── THE BEAT ──────────────────────────────────────────────────────────────
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

    // Sort by recency of latest event
    return entries
      .filter(e => e.latestEvents.length > 0)
      .sort((a, b) => {
        const aDate = a.latestEvents[0]?.publishedAt ? new Date(a.latestEvents[0].publishedAt).getTime() : 0;
        const bDate = b.latestEvents[0]?.publishedAt ? new Date(b.latestEvents[0].publishedAt).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 3);
  }),

  // ── AGENT NOTES ───────────────────────────────────────────────────────────
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
        prompt: `Kirjoita lyhyt kenttäraportti (2-3 virkettä) työnhakumarkkinan signaalista suomalaisella työnhakijalle.
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
      })
    );

    return results;
  }),

  // ── SIDEBAR ───────────────────────────────────────────────────────────────
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

    // Recent signals (last 24h) from watchlist
    let recentSignals: { headline: string; companyName: string; publishedAt: string; eventType: string }[] = [];
    if ((watchlist as any[]).length > 0) {
      const db = await getDb();
      if (db) {
        const companyIds = (watchlist as any[]).map((w: any) => w.companyId);
        const result = await db.execute(sql`
          SELECT e.headline, c.name as companyName, e.publishedAt, e.eventType
          FROM events e
          JOIN companies c ON e.companyId = c.id
          WHERE e.companyId IN (${sql.raw(companyIds.join(","))})
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
```

- [ ] **Step 2: Verify TypeScript compiles (no import errors)**

```bash
cd /Users/tuukka/Downloads/Projects/AI-Agents/job_scout_agent/.worktrees/brief-content
node -e "import('./server/brief-router.ts')" 2>&1 | head -10
```

Expected: No output or only ESM import notice (Vite handles transpilation; this step just checks for obvious syntax errors).

- [ ] **Step 3: Commit**

```bash
git add server/brief-router.ts
git commit -m "feat: add briefRouter with leadStory/moreHeadlines/theBeat/agentNotes/sidebar"
```

---

### Task 4: Wire up `brief-router.ts` into `server/routers.ts` + add `createdAt` to `auth.me`

**Files:**
- Modify: `server/routers.ts`

- [ ] **Step 1: Add `createdAt` to `auth.me`**

In `server/routers.ts`, find the `auth.me` procedure (line ~10):
```typescript
me: publicProcedure.query(opts => opts.ctx.user),
```

The `ctx.user` comes from session middleware. Check how the session is created and what fields are returned. Find the session handler in `server/_core/index.ts`.

```bash
grep -n "ctx.user\|user:" /Users/tuukka/Downloads/Projects/AI-Agents/job_scout_agent/.worktrees/brief-content/server/_core/index.ts | head -20
```

- [ ] **Step 2: Locate the session user shape and add `createdAt`**

The goal is for `auth.me` to return `createdAt`. Find where `ctx.user` is built (likely in middleware reading a JWT or session cookie). Modify the user object to include `createdAt` from the `users` DB table.

Read the middleware file found in Step 1:

```bash
grep -n "createdAt\|ctx.user\|userId" /Users/tuukka/Downloads/Projects/AI-Agents/job_scout_agent/.worktrees/brief-content/server/_core/index.ts | head -30
```

- [ ] **Step 3: Add `createdAt` to the session user**

In `server/_core/index.ts`, find where the user record is fetched from DB after auth (typically after JWT verification). Add `createdAt` to the returned user object. The exact change depends on what Step 2 reveals.

If the middleware does:
```typescript
ctx.user = { id: user.id, openId: user.openId, name: user.name, email: user.email };
```

Change it to:
```typescript
ctx.user = { id: user.id, openId: user.openId, name: user.name, email: user.email, createdAt: user.createdAt };
```

- [ ] **Step 4: Import and register `briefRouter` in `server/routers.ts`**

At the top of `server/routers.ts`, after the existing imports, add:
```typescript
import { briefRouter } from "./brief-router";
```

Inside `appRouter = router({ ... })`, before the closing `})`, add:
```typescript
  brief: briefRouter,
```

- [ ] **Step 5: Commit**

```bash
git add server/routers.ts server/_core/index.ts
git commit -m "feat: register briefRouter; expose createdAt in auth.me"
```

---

### Task 5: Update `useEditionNumber` to use real `createdAt`

**Files:**
- Modify: `client/src/hooks/useEditionNumber.ts`

- [ ] **Step 1: Read current file**

```bash
cat /Users/tuukka/Downloads/Projects/AI-Agents/job_scout_agent/.worktrees/brief-content/client/src/hooks/useEditionNumber.ts
```

- [ ] **Step 2: Update to use real createdAt**

Replace the entire file content:

```typescript
// client/src/hooks/useEditionNumber.ts
import { trpc } from "@/lib/trpc";
import { issueNumber } from "../../../shared/lib/editorial-date";

export function useEditionNumber(): number {
  const { data: user } = trpc.auth.me.useQuery();
  if (!user?.createdAt) return 1;
  return issueNumber(new Date(user.createdAt), new Date());
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useEditionNumber.ts
git commit -m "feat: useEditionNumber uses real createdAt from auth.me"
```

---

### Task 6: `LeadStory.tsx` component

**Files:**
- Create: `client/src/pages/editorial/brief/LeadStory.tsx`

- [ ] **Step 1: Create the component**

```typescript
// client/src/pages/editorial/brief/LeadStory.tsx
import { trpc } from "@/lib/trpc";
import { formatBriefDate } from "../../../../../shared/lib/editorial-date";
import type { MatchPayload, SignalPayload, ProfilePayload } from "../../../../../shared/lib/brief-logic";

function MetaRow({ items }: { items: (string | number | null | undefined)[] }) {
  const parts = items.filter(Boolean);
  return (
    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 tabular-nums mt-2 mb-4">
      {parts.join(" · ")}
    </p>
  );
}

function ScoreGradient({ score }: { score: number }) {
  return (
    <span className="text-3xl font-extrabold tabular-nums tracking-[-0.02em] bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 bg-clip-text text-transparent">
      {score}%
    </span>
  );
}

export function LeadStory() {
  const { data, isLoading } = trpc.brief.leadStory.useQuery();

  if (isLoading) {
    return (
      <section className="pb-8 border-b border-slate-900">
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-4">
          LEAD STORY
        </p>
        <div className="h-16 bg-slate-100 animate-pulse rounded" />
      </section>
    );
  }

  if (!data) return null;

  const { kind, payload } = data;

  return (
    <section className="pb-8 border-b border-slate-900">
      <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-4">
        LEAD STORY
      </p>

      {kind === "match" && (() => {
        const p = payload as MatchPayload;
        return (
          <>
            <h2 className="font-['Sora'] text-5xl md:text-6xl font-black tracking-[-0.025em] leading-[0.95] text-slate-900">
              {p.title.toUpperCase()}
            </h2>
            <MetaRow items={[<ScoreGradient score={p.totalScore} />, p.company, p.location]} />
            <p className="font-['DM_Sans'] italic text-base md:text-lg text-slate-500 leading-relaxed mb-4">
              Vahva osuma profiiliisi — avaa ilmoitus ja arvioi sopivuus.
            </p>
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-900 hover:opacity-70 transition-opacity">
                Avaa juttu →
              </a>
            )}
          </>
        );
      })()}

      {kind === "signal" && (() => {
        const p = payload as SignalPayload;
        return (
          <>
            <h2 className="font-['Sora'] text-5xl md:text-6xl font-black tracking-[-0.025em] leading-[0.95] text-slate-900">
              {p.headline.toUpperCase()}
            </h2>
            <MetaRow items={[p.eventType.replace("_", " ").toUpperCase(), p.companyName]} />
            <p className="font-['DM_Sans'] italic text-base md:text-lg text-slate-500 leading-relaxed mb-4">
              {p.summary}
            </p>
            <a href="/companies" className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-900 hover:opacity-70 transition-opacity">
              Avaa dossier →
            </a>
          </>
        );
      })()}

      {kind === "profile_prompt" && (() => {
        const p = payload as ProfilePayload;
        return (
          <>
            <h2 className="font-['Sora'] text-5xl md:text-6xl font-black tracking-[-0.025em] leading-[0.95] text-slate-900">
              PROFIILISI ON {p.completeness}% VALMIS
            </h2>
            <p className="font-['DM_Sans'] italic text-base md:text-lg text-slate-500 leading-relaxed mt-4 mb-4">
              Täydennä profiilisi saadaksesi parempia matchauksia.
            </p>
            <a href="/profile" className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-900 hover:opacity-70 transition-opacity">
              Täydennä profiili →
            </a>
          </>
        );
      })()}

      {kind === "welcome" && (
        <>
          <h2 className="font-['Sora'] text-5xl md:text-6xl font-black tracking-[-0.025em] leading-[0.95] text-slate-900">
            TERVETULOA EDITIONIIN
          </h2>
          <p className="font-['DM_Sans'] italic text-base md:text-lg text-slate-500 leading-relaxed mt-4 mb-4">
            Aloita täyttämällä profiilisi — löydämme sinulle sopivat paikat.
          </p>
          <a href="/profile" className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-900 hover:opacity-70 transition-opacity">
            Luo profiili →
          </a>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/editorial/brief/LeadStory.tsx
git commit -m "feat: add LeadStory component with 4 kind renderers"
```

---

### Task 7: `MoreHeadlines.tsx` component

**Files:**
- Create: `client/src/pages/editorial/brief/MoreHeadlines.tsx`

- [ ] **Step 1: Create the component**

```typescript
// client/src/pages/editorial/brief/MoreHeadlines.tsx
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

function relativeTime(date: string | null): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600_000);
  if (h < 1) return "juuri nyt";
  if (h < 24) return `${h} h sitten`;
  const d = Math.floor(h / 24);
  return `${d} pv sitten`;
}

export function MoreHeadlines() {
  const { data, isLoading } = trpc.brief.moreHeadlines.useQuery();

  return (
    <section className="py-6 border-b border-slate-900">
      <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-4">
        MORE HEADLINES
      </p>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-8 bg-slate-100 animate-pulse rounded" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <p className="font-['DM_Sans'] italic text-slate-400 text-sm">
          Ei uusia matcheja tänään.
        </p>
      )}

      {!isLoading && data && data.length > 0 && (
        <div>
          {data.slice(0, 4).map((item, idx) => (
            <div key={item.matchId}>
              <div className="py-3 group cursor-pointer"
                onClick={() => item.url && window.open(item.url, "_blank")}>
                <h3 className="font-['Sora'] text-2xl font-semibold tracking-tight text-slate-900 group-hover:opacity-70 transition-opacity">
                  {item.title}
                </h3>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 tabular-nums mt-1">
                  {[`${item.totalScore}%`, item.company, item.location, relativeTime(item.postedAt)]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
              {idx < Math.min(data.length, 4) - 1 && (
                <div className="border-t border-slate-900/10" />
              )}
            </div>
          ))}
        </div>
      )}

      <Link href="/jobs/matches"
        className="block mt-4 text-[11px] uppercase tracking-[0.16em] font-bold text-slate-400 hover:text-slate-900 transition-colors">
        Kaikki matchit →
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/editorial/brief/MoreHeadlines.tsx
git commit -m "feat: add MoreHeadlines component (4 match headlines)"
```

---

### Task 8: `TheBeat.tsx` component

**Files:**
- Create: `client/src/pages/editorial/brief/TheBeat.tsx`

- [ ] **Step 1: Create the component**

```typescript
// client/src/pages/editorial/brief/TheBeat.tsx
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const EVENT_TYPE_LABELS: Record<string, string> = {
  hiring_burst: "rekrytointipiikki",
  funding: "rahoituskierros",
  leadership_change: "johtomuutos",
  expansion: "laajennus",
  ytj_change: "YTJ-muutos",
  layoffs: "irtisanomiset",
};

export function TheBeat() {
  const { data, isLoading } = trpc.brief.theBeat.useQuery();

  return (
    <section className="py-6 border-b border-slate-900">
      <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-4">
        THE BEAT
      </p>

      {isLoading && (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 animate-pulse rounded" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <p className="font-['DM_Sans'] italic text-slate-400 text-sm">
          Watchlistillä ei ole aktiivisia signaaleja. Lisää yrityksiä seurantaan.
        </p>
      )}

      {!isLoading && data && data.length > 0 && (
        <div>
          {data.map((entry, idx) => (
            <div key={entry.companyId}>
              <div className="py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-900 mb-1">
                  {entry.companyName}
                  {entry.latestEvents[0] && (
                    <span className="font-normal text-slate-400 ml-2 normal-case tracking-normal">
                      — {EVENT_TYPE_LABELS[entry.latestEvents[0].eventType] ?? entry.latestEvents[0].eventType}
                    </span>
                  )}
                </p>
                {entry.latestEvents[0] && (
                  <>
                    <p className="font-['Sora'] text-lg font-semibold text-slate-900 mb-1">
                      {entry.latestEvents[0].headline}
                    </p>
                    <p className="font-['DM_Sans'] text-sm text-slate-500 leading-relaxed mb-2">
                      {entry.latestEvents[0].summary}
                    </p>
                  </>
                )}
                <Link href={`/companies`}
                  className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-400 hover:text-slate-900 transition-colors">
                  Avaa dossier →
                </Link>
              </div>
              {idx < data.length - 1 && <div className="border-t border-slate-900/10" />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/editorial/brief/TheBeat.tsx
git commit -m "feat: add TheBeat component (watchlist company signals)"
```

---

### Task 9: `AgentNotes.tsx` component

**Files:**
- Create: `client/src/pages/editorial/brief/AgentNotes.tsx`

- [ ] **Step 1: Create the component**

```typescript
// client/src/pages/editorial/brief/AgentNotes.tsx
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const AGENT_TO_PATH: Record<string, string> = {
  signal_scout: "/agents/signal_scout",
  career_coach: "/agents/career_coach",
  job_analyzer: "/agents/job_analyzer",
};

export function AgentNotes() {
  const { data, isLoading } = trpc.brief.agentNotes.useQuery(undefined, {
    staleTime: 5 * 60_000, // don't re-generate on every render
  });

  return (
    <section className="py-6">
      <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-4">
        FROM OUR AGENTS
      </p>

      {isLoading && (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="h-4 w-40 bg-slate-100 animate-pulse rounded mb-2" />
              <div className="h-12 bg-slate-100 animate-pulse rounded" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && data && (
        <div>
          {data.map((item, idx) => (
            <div key={item.agentId}>
              <div className="py-4">
                <p className="font-['DM_Sans'] italic text-slate-500 text-sm mb-2">
                  {item.byline}
                </p>
                <p className="font-['DM_Sans'] text-base text-slate-800 leading-relaxed mb-3">
                  {item.note}
                </p>
                <Link href={AGENT_TO_PATH[item.agentId] ?? "/agents"}
                  className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-400 hover:text-slate-900 transition-colors">
                  Jatka keskustelua →
                </Link>
              </div>
              {idx < data.length - 1 && <div className="border-t border-slate-900/10" />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/editorial/brief/AgentNotes.tsx
git commit -m "feat: add AgentNotes component (AI-generated, voice-linted)"
```

---

### Task 10: `BriefSidebar.tsx` component

**Files:**
- Create: `client/src/pages/editorial/brief/BriefSidebar.tsx`

- [ ] **Step 1: Create the component**

```typescript
// client/src/pages/editorial/brief/BriefSidebar.tsx
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { BriefMetricRow, BriefActionRow, BriefTickerItem } from "@/components/editorial";
import { Search, FileText, MessageSquare } from "lucide-react";

function formatPublishedAt(raw: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  return d.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" });
}

export function BriefSidebar() {
  const { data, isLoading } = trpc.brief.sidebar.useQuery();
  const navigate = useLocation()[1]; // wouter setLocation

  return (
    <aside className="space-y-8">
      {/* KEY NUMBERS */}
      <section>
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-3">
          KEY NUMBERS
        </p>
        {isLoading && <div className="h-24 bg-slate-100 animate-pulse rounded" />}
        {!isLoading && data && (
          <div className="divide-y divide-slate-900/10">
            <BriefMetricRow label="Matchit tänään" value={data.metrics.matchesToday} />
            <BriefMetricRow label="Tallennetut" value={data.metrics.savedJobsCount} />
            <BriefMetricRow label="Watchlistillä" value={data.metrics.watchlistCount} />
            <BriefMetricRow label="Profiili" value={`${data.metrics.profileCompleteness}%`} />
          </div>
        )}
      </section>

      {/* SIGNAL TICKER */}
      <section>
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-3">
          SIGNAL TICKER
        </p>
        {isLoading && <div className="h-20 bg-slate-100 animate-pulse rounded" />}
        {!isLoading && data && (
          <>
            {data.recentSignals.length === 0 && (
              <p className="font-['DM_Sans'] italic text-slate-400 text-xs">Ei signaaleja tänään.</p>
            )}
            <ul className="space-y-1">
              {data.recentSignals.map((s, i) => (
                <BriefTickerItem
                  key={i}
                  time={formatPublishedAt(s.publishedAt)}
                  text={`${s.companyName} — ${s.headline}`}
                />
              ))}
            </ul>
            <Link href="/bulletins"
              className="block mt-3 text-[11px] uppercase tracking-[0.16em] font-bold text-slate-400 hover:text-slate-900 transition-colors">
              Kaikki signaalit →
            </Link>
          </>
        )}
      </section>

      {/* QUICK ACTIONS */}
      {/* BriefActionRow takes icon: ElementType (not ReactNode), desc (not description), onClick only.
          We wrap each in a Link from wouter and call navigate() inside onClick. */}
      <section>
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-3">
          QUICK ACTIONS
        </p>
        <div className="divide-y divide-slate-900/10">
          <BriefActionRow
            icon={Search}
            label="Aloita Scout"
            desc="Hae uusia työpaikkoja"
            onClick={() => navigate("/jobs")}
          />
          <BriefActionRow
            icon={FileText}
            label="Päivitä CV"
            desc="Lataa tai muokkaa ansioluetteloa"
            onClick={() => navigate("/profile")}
          />
          <BriefActionRow
            icon={MessageSquare}
            label="Keskustele Kaisan kanssa"
            desc="Uravalmentaja käytettävissäsi"
            onClick={() => navigate("/agents/career_coach")}
          />
        </div>
      </section>
    </aside>
  );
}
```

- [ ] **Step 2: Verify `BriefActionRow` interface (already confirmed, no changes needed)**

`BriefActionRow` in `primitives.tsx` accepts `icon: ElementType`, `label`, `desc`, `onClick?`. The plan uses this exact interface — passing the icon component (e.g. `Search`) not a JSX node, and using `onClick` with wouter's `navigate` instead of an `href`.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/editorial/brief/BriefSidebar.tsx client/src/components/editorial/primitives.tsx
git commit -m "feat: add BriefSidebar with Key Numbers, Signal Ticker, Quick Actions"
```

---

### Task 11: `Brief.tsx` main page

**Files:**
- Create: `client/src/pages/editorial/Brief.tsx`

- [ ] **Step 1: Create the main page**

```typescript
// client/src/pages/editorial/Brief.tsx
import { EditorialShell, Masthead } from "@/components/editorial";
import { useEditionNumber } from "@/hooks/useEditionNumber";
import { trpc } from "@/lib/trpc";
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
        {/* Main column — 8/12 */}
        <div className="lg:col-span-8 space-y-0">
          <LeadStory />
          <MoreHeadlines />
          <TheBeat />
          <AgentNotes />
        </div>

        {/* Sidebar — 4/12, sticky */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20">
            <BriefSidebar />
          </div>
        </div>
      </div>
    </EditorialShell>
  );
}
```

- [ ] **Step 2: Verify `Masthead` props (already confirmed, no changes needed)**

`Masthead` in `primitives.tsx` accepts `dateStr`, `issueLabel`, `statusLabel`, `title`, `subtitle` — exactly what `Brief.tsx` passes. No changes to the primitive needed.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/editorial/Brief.tsx
git commit -m "feat: add Brief.tsx main page with 2-col layout"
```

---

### Task 12: Wire `Brief` into `App.tsx` + final integration

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Swap BriefPlaceholder for Brief**

In `client/src/App.tsx`, find the import:
```typescript
import { BriefPlaceholder } from "@/pages/editorial/BriefPlaceholder";
```

Replace with:
```typescript
import { Brief } from "@/pages/editorial/Brief";
```

Find all usages of `<BriefPlaceholder />` in the editorial routing block and replace with `<Brief />`.

- [ ] **Step 2: Run all tests to confirm no regressions**

```bash
cd /Users/tuukka/Downloads/Projects/AI-Agents/job_scout_agent/.worktrees/brief-content
npx vitest run 2>&1 | tail -10
```

Expected: `26 passed` (all shared tests)

- [ ] **Step 3: Build to verify no compile errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build completes without errors. Vite tree-shakes and bundles successfully.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: wire Brief page into editorial App routing"
```

---

### Task 13: Finish development branch

- [ ] **Step 1: Run all tests one final time**

```bash
cd /Users/tuukka/Downloads/Projects/AI-Agents/job_scout_agent/.worktrees/brief-content
npx vitest run 2>&1 | tail -10
```

Expected: all passing.

- [ ] **Step 2: Use superpowers:finishing-a-development-branch skill**

Follow the finishing-a-development-branch skill to present options and complete the branch.

---

## Notes on limitations

- **No "seen" tracking**: matches have no `seen`/`opened` column. Lead story + More Headlines show all matches, not just "unseen". This is tracked as a TODO for a future plan.
- **No cooldown persistence**: the 48h company-cooldown rule from the spec is not implemented (would require a new DB column or table). Tier 4 signals can lead multiple consecutive days.
- **Agent notes are ephemeral**: generated fresh on each page visit (with 5min stale-time cache in React Query). Not persisted to DB.
- **TypeScript check broken in this environment**: `npm run check` fails due to a pre-existing `node_modules/typescript/` truncation. Use `npm run build` (Vite transpiles correctly) as the verification step.
