/**
 * Company Scoring - laskee yrityskohtaiset pisteet
 */
import type { Company, Event, Job, Profile } from "../drizzle/schema";

export interface ScoredCompany {
  company: Company;
  talentNeedScore: number; // 0-100
  profileMatchScore: number; // 0-100
  combinedScore: number; // 0-100
  reasons: string[];
  recentEvents: Event[];
  openJobs: Job[];
}

/**
 * Laske yrityksen talent need score
 * 
 * Positiiviset signaalit:
 * - Rahoitus (+30)
 * - Kasvuuutiset (+25)
 * - Avoimet paikat (+5 per paikka, max +30)
 * - Uusi yksikkö (+20)
 * - Johdon muutos (+10)
 * 
 * Negatiiviset/neutraalit:
 * - YT layoff: voi olla positiivinen jos iso (uudelleenrakennus)
 * - YT restructure: +5 (uudet paikat?)
 */
export function calculateTalentNeedScore(
  company: Company,
  events: Event[],
  jobs: Job[]
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Analysoi tapahtumat
  for (const event of events) {
    switch (event.eventType) {
      case "funding":
        const fundingBonus = 20 + (event.impactStrength || 3) * 5;
        score += fundingBonus;
        reasons.push(`💰 Rahoituskierros (vaikutus: ${event.impactStrength}/5)`);
        break;

      case "expansion":
        const expansionBonus = 15 + (event.impactStrength || 3) * 4;
        score += expansionBonus;
        reasons.push(`📈 Kasvussa`);
        break;

      case "new_unit":
        const newUnitBonus = 15 + (event.impactStrength || 3) * 3;
        score += newUnitBonus;
        reasons.push(`🏢 Uusi yksikkö/markkina`);
        break;

      case "acquisition":
        const acqBonus = 10 + (event.impactStrength || 3) * 3;
        score += acqBonus;
        reasons.push(`🤝 Yrityskauppa - integraatiorekryt mahdollisia`);
        break;

      case "leadership_change":
        score += 10;
        reasons.push(`👔 Johdon muutos - uudet tuulet?`);
        break;

      case "yt_layoff":
        if ((event.impactStrength || 3) >= 4) {
          score += 5;
          reasons.push(`⚠️ Iso YT - uudelleenrakennus tulossa?`);
        } else {
          score -= 5;
          reasons.push(`⚠️ YT-neuvottelut käynnissä`);
        }
        break;

      case "yt_restructure":
        score += 5;
        reasons.push(`🔄 Uudelleenjärjestelyt - uusia rooleja syntyy`);
        break;
    }
  }

  // Avoimet paikat
  const jobCount = jobs.length;
  if (jobCount > 0) {
    const jobBonus = Math.min(30, jobCount * 5);
    score += jobBonus;
    reasons.push(`📋 ${jobCount} avointa paikkaa`);
  }

  // Normalisoi 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, reasons };
}

/**
 * Laske profile match score
 */
export function calculateProfileMatchScore(
  company: Company,
  events: Event[],
  jobs: Job[],
  profile: Profile | null
): { score: number; reasons: string[] } {
  if (!profile) {
    return { score: 0, reasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];

  // Parse profile preferences
  let targetFunctions: string[] = [];
  let targetLocations: string[] = [];
  let targetSeniority: string[] = [];

  try {
    if (profile.targetFunctions) targetFunctions = JSON.parse(profile.targetFunctions);
    if (profile.preferredLocations) targetLocations = JSON.parse(profile.preferredLocations);
    // Assume senior/lead as default if not specified
    targetSeniority = ["senior", "lead"];
  } catch {}

  // Normalize for comparison
  targetFunctions = targetFunctions.map(f => f.toLowerCase());
  targetLocations = targetLocations.map(l => l.toLowerCase());

  // Check events - do they affect target functions?
  for (const event of events) {
    if (event.functionFocus) {
      try {
        const eventFunctions: string[] = JSON.parse(event.functionFocus);
        const matching = eventFunctions.filter(f => targetFunctions.includes(f.toLowerCase()));
        if (matching.length > 0) {
          score += 15;
          reasons.push(`🎯 Tapahtuma koskee: ${matching.join(", ")}`);
        }
      } catch {}
    }
  }

  // Check jobs
  let matchingJobs = 0;
  for (const job of jobs) {
    let jobMatch = 0;

    // Function match
    if (job.functionType && targetFunctions.includes(job.functionType.toLowerCase())) {
      jobMatch += 10;
    }

    // Location match
    if (job.location) {
      const jobLoc = job.location.toLowerCase();
      if (targetLocations.some(loc => jobLoc.includes(loc))) {
        jobMatch += 5;
      }
      if (jobLoc.includes("remote") || jobLoc.includes("etä")) {
        jobMatch += 3;
      }
    }

    // Seniority match
    if (job.seniorityLevel && targetSeniority.includes(job.seniorityLevel.toLowerCase())) {
      jobMatch += 10;
    }

    if (jobMatch > 0) {
      matchingJobs++;
      score += jobMatch;
    }
  }

  if (matchingJobs > 0) {
    reasons.push(`✅ ${matchingJobs} sopivaa avointa paikkaa`);
  }

  // Industry match
  let targetIndustries: string[] = [];
  try {
    if (profile.preferredIndustries) targetIndustries = JSON.parse(profile.preferredIndustries);
  } catch {}

  if (company.industry && targetIndustries.length > 0) {
    if (targetIndustries.some(i => i.toLowerCase() === company.industry?.toLowerCase())) {
      score += 15;
      reasons.push(`🏭 Toimiala sopii: ${company.industry}`);
    }
  }

  // Normalize 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, reasons };
}

/**
 * Laske combined score
 */
export function calculateCombinedScore(
  talentNeedScore: number,
  profileMatchScore: number,
  hasProfile: boolean
): number {
  if (hasProfile) {
    return talentNeedScore * 0.5 + profileMatchScore * 0.5;
  }
  return talentNeedScore;
}

/**
 * Muotoile yritysraportti
 */
export function formatCompanyReport(scored: ScoredCompany): string {
  const lines = [
    `${"=".repeat(60)}`,
    `🏢 ${scored.company.name}`,
    `${"=".repeat(60)}`,
    ``,
    `📊 PISTEET:`,
    `   Talent Need Score:   ${scored.talentNeedScore.toFixed(0)}/100`,
    `   Profile Match Score: ${scored.profileMatchScore.toFixed(0)}/100`,
    `   Combined Score:      ${scored.combinedScore.toFixed(0)}/100`,
    ``,
    `💡 MIKSI LISTALLA:`,
  ];

  for (const reason of scored.reasons) {
    lines.push(`   • ${reason}`);
  }

  if (scored.recentEvents.length > 0) {
    lines.push(``);
    lines.push(`📰 VIIMEAIKAISET TAPAHTUMAT:`);
    for (const event of scored.recentEvents.slice(0, 3)) {
      lines.push(`   • [${event.eventType}] ${event.headline.slice(0, 60)}...`);
    }
  }

  if (scored.openJobs.length > 0) {
    lines.push(``);
    lines.push(`📋 AVOIMET PAIKAT (${scored.openJobs.length}):`);
    for (const job of scored.openJobs.slice(0, 5)) {
      lines.push(`   • ${job.title} (${job.location || "N/A"})`);
    }
  }

  lines.push(``);
  return lines.join("\n");
}
