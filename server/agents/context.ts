/**
 * JobScout Agent System - Context Builder
 * Builds unified context for agents from user data
 */

import type { UserContext, ProfileContext, JobContext, MatchContext, CompanyContext, EventContext } from "./types";

export async function buildUserContext(userId: number): Promise<UserContext> {
  const { 
    getProfileByUserId, 
    getSavedJobsByUserId, 
    getMatchesByUserId,
    getTopCompanyScores,
    getEventsByCompanyId 
  } = await import("../db");

  // Fetch data with error handling
  let profile = null;
  let savedJobsRaw: any[] = [];
  let matchesRaw: any[] = [];
  let companyScoresRaw: any[] = [];

  try {
    profile = await getProfileByUserId(userId);
  } catch (e) {
    console.error("[Context] Error fetching profile:", e);
  }

  try {
    savedJobsRaw = await getSavedJobsByUserId(userId) || [];
  } catch (e) {
    console.error("[Context] Error fetching saved jobs:", e);
  }

  try {
    matchesRaw = await getMatchesByUserId(userId, 20) || [];
  } catch (e) {
    console.error("[Context] Error fetching matches:", e);
  }

  try {
    companyScoresRaw = await getTopCompanyScores(userId, 10) || [];
  } catch (e) {
    console.error("[Context] Error fetching company scores:", e);
    // This is expected to fail if tables don't exist yet
  }

  // Transform profile
  const profileContext: ProfileContext | null = profile ? {
    currentTitle: profile.currentTitle,
    yearsOfExperience: profile.yearsOfExperience,
    skills: safeParseArray(profile.skills),
    languages: safeParseArray(profile.languages),
    certifications: safeParseArray(profile.certifications),
    degree: profile.degree,
    field: profile.field,
    preferredJobTitles: safeParseArray(profile.preferredJobTitles),
    preferredIndustries: safeParseArray(profile.preferredIndustries),
    preferredLocations: safeParseArray(profile.preferredLocations),
    employmentTypes: safeParseArray(profile.employmentTypes),
    salaryMin: profile.salaryMin,
    salaryMax: profile.salaryMax,
    remotePreference: profile.remotePreference,
    workHistory: safeParseArray(profile.workHistory),
    targetFunctions: safeParseArray(profile.targetFunctions),
  } : null;

  // Transform saved jobs
  const savedJobs: JobContext[] = savedJobsRaw.map((sj: any) => ({
    id: sj.job?.id || sj.id,
    title: sj.job?.title || sj.title,
    company: sj.job?.company || sj.company,
    location: sj.job?.location || sj.location,
    salaryMin: sj.job?.salaryMin || sj.salaryMin,
    salaryMax: sj.job?.salaryMax || sj.salaryMax,
    employmentType: sj.job?.employmentType || sj.employmentType,
    remoteType: sj.job?.remoteType || sj.remoteType,
    industry: sj.job?.industry || sj.industry,
    requiredSkills: safeParseArray(sj.job?.requiredSkills || sj.requiredSkills),
    url: sj.job?.url || sj.url,
  }));

  // Transform matches
  const topMatches: MatchContext[] = matchesRaw.map((m: any) => ({
    jobId: m.job?.id || m.jobId,
    jobTitle: m.job?.title || m.jobTitle || "Unknown",
    company: m.job?.company || m.company || "Unknown",
    totalScore: m.totalScore || 0,
    skillScore: m.skillScore || 0,
    experienceScore: m.experienceScore || 0,
    locationScore: m.locationScore || 0,
    matchCategory: m.matchCategory,
  }));

  // Transform company scores with events
  const recentCompanies: CompanyContext[] = [];
  for (const cs of companyScoresRaw) {
    try {
      const events = await getEventsByCompanyId(cs.company?.id || cs.companyId, 5);
      recentCompanies.push({
        id: cs.company?.id || cs.companyId,
        name: cs.company?.name || cs.companyName || "Unknown",
        industry: cs.company?.industry || cs.industry,
        talentNeedScore: cs.score?.talentNeedScore || cs.talentNeedScore,
        profileMatchScore: cs.score?.profileMatchScore || cs.profileMatchScore,
        combinedScore: cs.score?.combinedScore || cs.combinedScore,
        reasons: safeParseArray(cs.score?.scoreReasons || cs.scoreReasons),
        recentEvents: events.map((e: any): EventContext => ({
          eventType: e.eventType,
          headline: e.headline,
          summary: e.summary,
          impactStrength: e.impactStrength,
          publishedAt: e.publishedAt,
        })),
        openPositions: cs.jobs?.length || 0,
      });
    } catch (e) {
      console.error("[Context] Error processing company:", e);
    }
  }

  return {
    userId,
    profile: profileContext,
    savedJobs,
    topMatches,
    recentCompanies,
  };
}

export function formatContextForPrompt(context: UserContext): string {
  const parts: string[] = [];

  // Profile summary
  if (context.profile) {
    const p = context.profile;
    parts.push(`## Käyttäjän profiili
- Nykyinen titteli: ${p.currentTitle || "Ei määritelty"}
- Kokemus: ${p.yearsOfExperience || "?"} vuotta
- Taidot: ${p.skills.join(", ") || "Ei määritelty"}
- Kielet: ${p.languages.join(", ") || "Ei määritelty"}
- Koulutus: ${p.degree || "?"} - ${p.field || "?"}
- Tavoite tittelit: ${p.preferredJobTitles.join(", ") || "Ei määritelty"}
- Toivotut sijainnit: ${p.preferredLocations.join(", ") || "Ei määritelty"}
- Palkkatoive: ${p.salaryMin ? `${p.salaryMin}€` : "?"} - ${p.salaryMax ? `${p.salaryMax}€` : "?"}
- Etätyötoive: ${p.remotePreference || "Ei määritelty"}`);

    if (p.workHistory.length > 0) {
      parts.push(`\n### Työhistoria`);
      p.workHistory.slice(0, 3).forEach(wh => {
        parts.push(`- ${wh.title} @ ${wh.company} (${wh.duration})`);
      });
    }
  } else {
    parts.push(`## Käyttäjän profiili\nProfiilia ei ole vielä täytetty.`);
  }

  // Top matches
  if (context.topMatches.length > 0) {
    parts.push(`\n## Parhaat työpaikkamatchit (top ${context.topMatches.length})`);
    context.topMatches.slice(0, 5).forEach(m => {
      parts.push(`- ${m.jobTitle} @ ${m.company} - Score: ${m.totalScore}% (${m.matchCategory || "?"})`);
    });
  }

  // Saved jobs
  if (context.savedJobs.length > 0) {
    parts.push(`\n## Tallennetut työpaikat (${context.savedJobs.length} kpl)`);
    context.savedJobs.slice(0, 5).forEach(j => {
      const salary = j.salaryMin && j.salaryMax 
        ? `${j.salaryMin}-${j.salaryMax}€` 
        : "Palkka ei tiedossa";
      parts.push(`- ${j.title} @ ${j.company} (${j.location || "?"}) - ${salary}`);
    });
  }

  // Companies with signals
  if (context.recentCompanies.length > 0) {
    parts.push(`\n## Kiinnostavat yritykset signaalien perusteella`);
    context.recentCompanies.slice(0, 5).forEach(c => {
      parts.push(`- ${c.name} (${c.industry || "?"}) - Score: ${c.combinedScore || "?"}%`);
      if (c.recentEvents.length > 0) {
        parts.push(`  Viimeisimmät signaalit:`);
        c.recentEvents.slice(0, 2).forEach(e => {
          parts.push(`  • [${e.eventType}] ${e.headline}`);
        });
      }
    });
  }

  return parts.join("\n");
}

function safeParseArray(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
