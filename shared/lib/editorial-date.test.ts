import { describe, it, expect } from "vitest";
import { formatBriefDate, issueNumber } from "./editorial-date";

describe("formatBriefDate", () => {
  it("formats Finnish date uppercase with weekday", () => {
    const d = new Date("2026-04-24T10:00:00Z");
    expect(formatBriefDate(d, "fi")).toBe("PERJANTAI 24. HUHTIKUUTA");
  });

  it("formats English date uppercase with weekday", () => {
    const d = new Date("2026-04-24T10:00:00Z");
    expect(formatBriefDate(d, "en")).toBe("FRIDAY, APRIL 24");
  });

  it("falls back to English for unknown language code", () => {
    const d = new Date("2026-04-24T10:00:00Z");
    expect(formatBriefDate(d, "sv")).toBe("FRIDAY, APRIL 24");
  });
});

describe("issueNumber", () => {
  it("returns 1 for the same day as account creation", () => {
    const createdAt = new Date("2026-04-24T08:00:00Z");
    const now = new Date("2026-04-24T20:00:00Z");
    expect(issueNumber(createdAt, now)).toBe(1);
  });

  it("returns 2 the day after creation", () => {
    const createdAt = new Date("2026-04-23T08:00:00Z");
    const now = new Date("2026-04-24T09:00:00Z");
    expect(issueNumber(createdAt, now)).toBe(2);
  });

  it("returns 142 after 141 days", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-05-22T00:00:00Z");
    expect(issueNumber(createdAt, now)).toBe(142);
  });

  it("returns 1 if createdAt is in the future (clock skew)", () => {
    const createdAt = new Date("2026-05-01T00:00:00Z");
    const now = new Date("2026-04-24T00:00:00Z");
    expect(issueNumber(createdAt, now)).toBe(1);
  });
});
