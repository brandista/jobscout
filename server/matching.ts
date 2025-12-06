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
  titleScore: number;
  matchCategory: "perfect" | "good" | "fair" | "possible" | "weak";
  category?: string;
  reasons?: string[];
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
  const titleScore = calculateTitleMatch(profile, job);

  // Painotettu kokonaisscore - title on tärkeä!
  const totalScore = Math.round(
    titleScore * 0.25 +      // Title match on tärkeä
    skillScore * 0.25 +      // Taidot
    experienceScore * 0.15 + // Kokemus
    locationScore * 0.15 +   // Sijainti
    salaryScore * 0.10 +     // Palkka
    industryScore * 0.05 +   // Ala
    companyScore * 0.05      // Yritys
  );

  const matchCategory = getMatchCategory(totalScore);
  const reasons = generateMatchReasons(titleScore, skillScore, locationScore, profile, job);

  return {
    totalScore,
    skillScore,
    experienceScore,
    locationScore,
    salaryScore,
    industryScore,
    companyScore,
    titleScore,
    matchCategory,
    category: matchCategory,
    reasons,
  };
}

/**
 * Title-matchaus (25%) - tarkistaa vastaako työpaikan otsikko käyttäjän hakemia titlejä
 */
function calculateTitleMatch(profile: Profile, job: Job): number {
  const jobTitle = (job.title || "").toLowerCase();
  
  // Tarkista preferredJobTitles/desiredTitles
  let preferredTitles: string[] = [];
  try {
    if ((profile as any).desiredTitles) {
      preferredTitles = JSON.parse((profile as any).desiredTitles);
    } else if ((profile as any).preferredJobTitles) {
      preferredTitles = JSON.parse((profile as any).preferredJobTitles);
    }
  } catch {}

  // Myös currentTitle voi olla relevantti
  if (profile.currentTitle) {
    preferredTitles.push(profile.currentTitle);
  }

  if (preferredTitles.length === 0) return 60; // Neutraali

  const normalizedTitles = preferredTitles.map(t => t.toLowerCase().trim());
  
  // Tarkista suora osuma
  for (const title of normalizedTitles) {
    if (jobTitle.includes(title) || title.includes(jobTitle)) {
      return 95;
    }
  }

  // Tarkista osittaiset osumat (sanat)
  const jobWords = jobTitle.split(/[\s\-,]+/).filter(w => w.length > 2);
  const titleWords = normalizedTitles.flatMap(t => t.split(/[\s\-,]+/).filter(w => w.length > 2));
  
  const matchedWords = jobWords.filter(word => 
    titleWords.some(tw => tw.includes(word) || word.includes(tw))
  );

  if (matchedWords.length > 0) {
    return Math.min(90, 60 + matchedWords.length * 15);
  }

  // Tarkista yleisiä synonyymejä
  const synonymGroups = [
    ["markkinointi", "marketing", "markkinoija", "marketer", "markkinointipäällikkö"],
    ["myynti", "sales", "myyjä", "salesperson", "myyntipäällikkö"],
    ["johtaja", "manager", "director", "head", "lead", "päällikkö", "esimies"],
    ["kehittäjä", "developer", "ohjelmoija", "programmer", "coder", "devaaja"],
    ["suunnittelija", "designer", "ux", "ui", "muotoilija"],
    ["analyytikko", "analyst", "data", "analytiikka"],
    ["konsultti", "consultant", "advisor", "neuvonantaja"],
    ["toimitusjohtaja", "ceo", "chief executive"],
    ["cmo", "chief marketing", "markkinointijohtaja"],
    ["cto", "chief technology", "teknologiajohtaja"],
    ["coo", "chief operating", "operatiivinen johtaja"],
    ["hr", "henkilöstö", "rekrytointi", "recruitment", "talent"],
    ["asiakaspalvelu", "customer service", "asiakaspalvelija", "support"],
    ["projekti", "project", "projektipäällikkö", "project manager"],
  ];

  for (const group of synonymGroups) {
    const jobHas = group.some(syn => jobTitle.includes(syn));
    const userWants = group.some(syn => normalizedTitles.some(t => t.includes(syn)));
    if (jobHas && userWants) {
      return 85;
    }
  }

  return 40;
}

/**
 * Taidot-matchaus (25%)
 */
function calculateSkillMatch(profile: Profile, job: Job): number {
  let userSkills: string[] = [];
  try {
    if (profile.skills) {
      userSkills = JSON.parse(profile.skills);
    }
  } catch {}

  // Jos työpaikalla on requiredSkills, käytä niitä
  let requiredSkills: string[] = [];
  try {
    if (job.requiredSkills) {
      requiredSkills = JSON.parse(job.requiredSkills);
    }
  } catch {}

  // Jos ei requiredSkills, yritä poimia kuvauksesta ja titlistä
  if (requiredSkills.length === 0) {
    const textToAnalyze = `${job.title || ""} ${job.description || ""}`;
    requiredSkills = extractSkillsFromText(textToAnalyze);
  }

  // Jos ei taitodataa, anna neutraali score
  if (userSkills.length === 0 || requiredSkills.length === 0) {
    return 55;
  }

  const normalizedUserSkills = userSkills.map(s => s.toLowerCase().trim());
  const normalizedRequired = requiredSkills.map(s => s.toLowerCase().trim());

  const matchedSkills = normalizedRequired.filter(skill =>
    normalizedUserSkills.some(userSkill => 
      userSkill.includes(skill) || skill.includes(userSkill)
    )
  );

  if (matchedSkills.length === 0) return 40;
  
  const matchPercentage = (matchedSkills.length / normalizedRequired.length) * 100;
  return Math.min(100, Math.round(matchPercentage));
}

/**
 * Poimi taitoja tekstistä
 */
function extractSkillsFromText(text: string): string[] {
  const lowerText = text.toLowerCase();
  const commonSkills = [
    // Tech
    "javascript", "typescript", "python", "java", "react", "node", "sql", "aws",
    "azure", "google cloud", "docker", "kubernetes", "git", "ci/cd",
    // Marketing
    "excel", "powerpoint", "crm", "salesforce", "hubspot", "google analytics",
    "seo", "sem", "facebook ads", "google ads", "linkedin", "markkinointi",
    "some", "sosiaalinen media", "content", "sisältö", "brändi", "brand",
    // Sales
    "myynti", "sales", "b2b", "b2c", "neuvottelu", "asiakashankinta",
    // General
    "viestintä", "projektinhallinta", "johtaminen", "tiimityö", "kommunikointi",
    "englanti", "suomi", "ruotsi", "saksa",
    // Business
    "saas", "startup", "enterprise", "e-commerce", "verkkokauppa",
    "budjetointi", "raportointi", "analytiikka",
  ];
  
  return commonSkills.filter(skill => lowerText.includes(skill));
}

/**
 * Kokemus-matchaus (15%)
 */
function calculateExperienceMatch(profile: Profile, job: Job): number {
  if (!profile.yearsOfExperience) return 65;
  if (!job.experienceRequired) return 70;

  const userExp = profile.yearsOfExperience;
  const requiredExp = job.experienceRequired;

  if (userExp >= requiredExp) {
    const excess = userExp - requiredExp;
    if (excess <= 2) return 100;
    if (excess <= 5) return 90;
    return 80;
  } else {
    const deficit = requiredExp - userExp;
    if (deficit <= 1) return 80;
    if (deficit <= 2) return 60;
    return 40;
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
  let preferredLocs: string[] = [];
  try {
    if (profile.preferredLocations) {
      preferredLocs = JSON.parse(profile.preferredLocations);
    }
  } catch {}

  if (preferredLocs.length === 0 || !job.location) return 60;

  const normalizedPreferred = preferredLocs.map(l => l.toLowerCase().trim());
  const jobLocation = job.location.toLowerCase().trim();

  // Helsinki-alue on yleinen
  const helsinkiAliases = ["helsinki", "espoo", "vantaa", "pääkaupunkiseutu", "hki", "pk-seutu", "uusimaa"];
  const jobInHelsinki = helsinkiAliases.some(a => jobLocation.includes(a));
  const userWantsHelsinki = normalizedPreferred.some(loc => 
    helsinkiAliases.some(a => loc.includes(a))
  );

  if (jobInHelsinki && userWantsHelsinki) return 95;

  // Muut kaupungit
  const isMatch = normalizedPreferred.some(loc => 
    jobLocation.includes(loc) || loc.includes(jobLocation)
  );

  // "Suomi" tai "Finland" matchi
  if (normalizedPreferred.some(loc => loc.includes("suomi") || loc.includes("finland"))) {
    if (jobLocation.includes("finland") || jobLocation.includes("suomi") || 
        helsinkiAliases.some(a => jobLocation.includes(a)) ||
        ["tampere", "turku", "oulu", "jyväskylä", "lahti", "kuopio"].some(c => jobLocation.includes(c))) {
      return 80;
    }
  }

  return isMatch ? 90 : 40;
}

/**
 * Palkka-matchaus (10%)
 */
function calculateSalaryMatch(profile: Profile, job: Job): number {
  if (!profile.salaryMin || !job.salaryMin) return 65;

  const userMin = profile.salaryMin;
  const userMax = profile.salaryMax || userMin * 1.5;
  const jobMin = job.salaryMin;
  const jobMax = job.salaryMax || jobMin * 1.2;

  if (jobMax >= userMin && jobMin <= userMax) {
    const overlapStart = Math.max(jobMin, userMin);
    const overlapEnd = Math.min(jobMax, userMax);
    const overlapSize = overlapEnd - overlapStart;
    const userRange = userMax - userMin;
    
    const overlapPercentage = (overlapSize / userRange) * 100;
    return Math.min(100, Math.round(overlapPercentage));
  } else if (jobMin > userMax) {
    return 100;
  } else {
    const deficit = userMin - jobMax;
    const deficitPercentage = (deficit / userMin) * 100;
    return Math.max(0, Math.round(100 - deficitPercentage));
  }
}

/**
 * Ala-matchaus (5%)
 */
function calculateIndustryMatch(profile: Profile, job: Job): number {
  let preferredIndustries: string[] = [];
  try {
    if (profile.preferredIndustries) {
      preferredIndustries = JSON.parse(profile.preferredIndustries);
    }
  } catch {}

  if (preferredIndustries.length === 0 || !job.industry) return 60;

  const normalizedPreferred = preferredIndustries.map(i => i.toLowerCase().trim());
  const jobIndustry = job.industry.toLowerCase().trim();

  const isMatch = normalizedPreferred.some(industry => 
    jobIndustry.includes(industry) || industry.includes(jobIndustry)
  );

  return isMatch ? 100 : 50;
}

/**
 * Yritys-matchaus (5%)
 */
function calculateCompanyMatch(job: Job): number {
  if ((job as any).companyRating) {
    return (job as any).companyRating;
  }
  return 65;
}

/**
 * Generoi match-syyt
 */
function generateMatchReasons(
  titleScore: number, 
  skillScore: number, 
  locationScore: number,
  profile: Profile,
  job: Job
): string[] {
  const reasons: string[] = [];

  if (titleScore >= 85) {
    reasons.push("Työtehtävä vastaa hakemaasi roolia");
  }
  if (skillScore >= 70) {
    reasons.push("Osaamisesi sopii tehtävään");
  }
  if (locationScore >= 80) {
    reasons.push("Sijainti sopii toiveisiisi");
  }

  return reasons;
}

/**
 * Määrittää match-kategorian scoren perusteella
 */
function getMatchCategory(score: number): "perfect" | "good" | "fair" | "possible" | "weak" {
  if (score >= 85) return "perfect";
  if (score >= 70) return "good";
  if (score >= 55) return "fair";
  if (score >= 40) return "possible";
  return "weak";
}
