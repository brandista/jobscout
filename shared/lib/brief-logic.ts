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
