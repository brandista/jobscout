import type { Profile, Job } from "../drizzle/schema";

/**
 * Matchaus-algoritmi työpaikkojen ja käyttäjäprofiilin välillä
 * Palauttaa scoring-tulokset eri kategorioissa
 */

export interface MatchScores {
  totalScore: number;
  skillScore: number;
  experienceScore: number;
  locationScore: number;
  salaryScore: number;
  industryScore: number;
  companyScore: number;
  matchCategory: "perfect" | "good" | "fair" | "possible" | "weak";
}

/**
 * Laskee matchaus-scoren profiilin ja työpaikan välillä
 */
export function calculateMatch(profile: Profile, job: Job): MatchScores {
  const skillScore = calculateSkillMatch(profile, job);
  const experienceScore = calculateExperienceMatch(profile, job);
  const locationScore = calculateLocationMatch(profile, job);
  const salaryScore = calculateSalaryMatch(profile, job);
  const industryScore = calculateIndustryMatch(profile, job);
  const companyScore = calculateCompanyMatch(job);

  // Painotettu kokonaisscore
  const totalScore = Math.round(
    skillScore * 0.30 +
    experienceScore * 0.20 +
    locationScore * 0.15 +
    salaryScore * 0.15 +
    industryScore * 0.10 +
    companyScore * 0.10
  );

  const matchCategory = getMatchCategory(totalScore);

  return {
    totalScore,
    skillScore,
    experienceScore,
    locationScore,
    salaryScore,
    industryScore,
    companyScore,
    matchCategory,
  };
}

/**
 * Taidot-matchaus (30%)
 */
function calculateSkillMatch(profile: Profile, job: Job): number {
  if (!profile.skills || !job.requiredSkills) return 50; // Neutraali score jos ei dataa

  try {
    const userSkills = JSON.parse(profile.skills) as string[];
    const requiredSkills = JSON.parse(job.requiredSkills) as string[];

    if (requiredSkills.length === 0) return 70; // Jos ei vaatimuksia, kohtuullinen score

    const normalizedUserSkills = userSkills.map(s => s.toLowerCase().trim());
    const normalizedRequired = requiredSkills.map(s => s.toLowerCase().trim());

    const matchedSkills = normalizedRequired.filter(skill =>
      normalizedUserSkills.some(userSkill => 
        userSkill.includes(skill) || skill.includes(userSkill)
      )
    );

    const matchPercentage = (matchedSkills.length / normalizedRequired.length) * 100;
    return Math.min(100, Math.round(matchPercentage));
  } catch {
    return 50;
  }
}

/**
 * Kokemus-matchaus (20%)
 */
function calculateExperienceMatch(profile: Profile, job: Job): number {
  if (!profile.yearsOfExperience || !job.experienceRequired) return 70;

  const userExp = profile.yearsOfExperience;
  const requiredExp = job.experienceRequired;

  if (userExp >= requiredExp) {
    // Täyttää tai ylittää vaatimuksen
    const excess = userExp - requiredExp;
    if (excess <= 2) return 100; // Täydellinen match
    if (excess <= 5) return 90; // Hieman ylipätevä
    return 80; // Merkittävästi ylipätevä
  } else {
    // Alittaa vaatimuksen
    const deficit = requiredExp - userExp;
    if (deficit <= 1) return 80; // Lähes riittävä
    if (deficit <= 2) return 60; // Jonkin verran puutetta
    return 40; // Merkittävä puute
  }
}

/**
 * Sijainti-matchaus (15%)
 */
function calculateLocationMatch(profile: Profile, job: Job): number {
  // Etätyö-preferenssi
  if (profile.remotePreference === "remote" && job.remoteType === "remote") return 100;
  if (profile.remotePreference === "hybrid" && (job.remoteType === "hybrid" || job.remoteType === "remote")) return 90;
  if (profile.remotePreference === "on-site" && job.remoteType === "on-site") return 100;

  // Maantieteellinen sijainti
  if (!profile.preferredLocations || !job.location) return 50;

  try {
    const preferredLocs = JSON.parse(profile.preferredLocations) as string[];
    const normalizedPreferred = preferredLocs.map(l => l.toLowerCase().trim());
    const jobLocation = job.location.toLowerCase().trim();

    const isMatch = normalizedPreferred.some(loc => 
      jobLocation.includes(loc) || loc.includes(jobLocation)
    );

    return isMatch ? 90 : 30;
  } catch {
    return 50;
  }
}

/**
 * Palkka-matchaus (15%)
 */
function calculateSalaryMatch(profile: Profile, job: Job): number {
  if (!profile.salaryMin || !job.salaryMin) return 70; // Neutraali jos ei dataa

  const userMin = profile.salaryMin;
  const userMax = profile.salaryMax || userMin * 1.5;
  const jobMin = job.salaryMin;
  const jobMax = job.salaryMax || jobMin * 1.2;

  // Tarkista päällekkäisyys
  if (jobMax >= userMin && jobMin <= userMax) {
    // Palkat menevät päällekkäin
    const overlapStart = Math.max(jobMin, userMin);
    const overlapEnd = Math.min(jobMax, userMax);
    const overlapSize = overlapEnd - overlapStart;
    const userRange = userMax - userMin;
    
    const overlapPercentage = (overlapSize / userRange) * 100;
    return Math.min(100, Math.round(overlapPercentage));
  } else if (jobMin > userMax) {
    // Työpaikka tarjoaa enemmän kuin odotetaan
    return 100;
  } else {
    // Työpaikka tarjoaa vähemmän
    const deficit = userMin - jobMax;
    const deficitPercentage = (deficit / userMin) * 100;
    return Math.max(0, Math.round(100 - deficitPercentage));
  }
}

/**
 * Ala-matchaus (10%)
 */
function calculateIndustryMatch(profile: Profile, job: Job): number {
  if (!profile.preferredIndustries || !job.industry) return 60;

  try {
    const preferredIndustries = JSON.parse(profile.preferredIndustries) as string[];
    const normalizedPreferred = preferredIndustries.map(i => i.toLowerCase().trim());
    const jobIndustry = job.industry.toLowerCase().trim();

    const isMatch = normalizedPreferred.some(industry => 
      jobIndustry.includes(industry) || industry.includes(jobIndustry)
    );

    return isMatch ? 100 : 40;
  } catch {
    return 60;
  }
}

/**
 * Yritys-matchaus (10%)
 */
function calculateCompanyMatch(job: Job): number {
  // Yrityksen rating (jos saatavilla)
  if (job.companyRating) {
    return job.companyRating;
  }

  // Oletusarvo jos ei ratingia
  return 70;
}

/**
 * Määrittää match-kategorian scoren perusteella
 */
function getMatchCategory(score: number): "perfect" | "good" | "fair" | "possible" | "weak" {
  if (score >= 90) return "perfect";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  if (score >= 30) return "possible";
  return "weak";
}
