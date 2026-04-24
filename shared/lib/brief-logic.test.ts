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
    expect(result.tier).toBeGreaterThanOrEqual(4);
  });

  it("Tier 4: watchlist signal in last 24h wins when no good matches", () => {
    const input: BriefInput = {
      matches: [],
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

  it("Tier 3: score beats recency (higher score wins even if older)", () => {
    const input: BriefInput = {
      matches: [
        makeMatch({ matchId: 1, totalScore: 70, postedAt: HOURS(65) }), // older, higher score
        makeMatch({ matchId: 2, totalScore: 60, postedAt: HOURS(40) }), // newer, lower score
      ],
      watchlistSignals: [],
      profileCompleteness: 80,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBe(3);
    const payload = result.payload as { matchId: number };
    expect(payload.matchId).toBe(1); // higher score wins
  });

  it("Tier 3: null postedAt match is excluded", () => {
    const input: BriefInput = {
      matches: [makeMatch({ totalScore: 70, postedAt: null })],
      watchlistSignals: [],
      profileCompleteness: 80,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBeGreaterThanOrEqual(4); // null postedAt excluded from all tiers
  });

  it("Tier 5 boundary: completeness exactly 70 falls through to Tier 6", () => {
    const input: BriefInput = {
      matches: [],
      watchlistSignals: [],
      profileCompleteness: 70,
      now: NOW,
    };
    const result = selectLeadStory(input);
    expect(result.tier).toBe(6); // < 70 is the condition, so 70 → Tier 6
  });
});
