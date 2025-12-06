import type { Profile, InsertJob } from "../drizzle/schema";

/**
 * Scoutaus-agentti työpaikkojen hakuun eri lähteistä
 * 
 * Tuetut lähteet:
 * - tyomarkkinatori: TE-palvelujen Työmarkkinatori API (ilmainen)
 * - duunitori: Duunitori.fi scraping
 * - oikotie: Oikotie Työpaikat scraping
 * - demo: Demo-data testaukseen
 */

export interface ScoutParams {
  profile: Profile;
  sources?: string[];
  maxResults?: number;
}

export interface ScoutResult {
  jobs: InsertJob[];
  source: string;
  count: number;
}

/**
 * Pääfunktio työpaikkojen scoutaukseen
 */
export async function scoutJobs(params: ScoutParams): Promise<ScoutResult[]> {
  const { profile, sources = ["tyomarkkinatori", "duunitori"], maxResults = 50 } = params;
  const results: ScoutResult[] = [];
  const perSourceLimit = Math.ceil(maxResults / sources.length);

  // Työmarkkinatori (TE-palvelut)
  if (sources.includes("tyomarkkinatori")) {
    try {
      const jobs = await scoutTyomarkkinatori(profile, perSourceLimit);
      results.push({
        jobs,
        source: "tyomarkkinatori",
        count: jobs.length,
      });
    } catch (error) {
      console.error("[Scout] Työmarkkinatori error:", error);
    }
  }

  // Duunitori
  if (sources.includes("duunitori")) {
    try {
      const jobs = await scoutDuunitori(profile, perSourceLimit);
      results.push({
        jobs,
        source: "duunitori",
        count: jobs.length,
      });
    } catch (error) {
      console.error("[Scout] Duunitori error:", error);
    }
  }

  // Oikotie
  if (sources.includes("oikotie")) {
    try {
      const jobs = await scoutOikotie(profile, perSourceLimit);
      results.push({
        jobs,
        source: "oikotie",
        count: jobs.length,
      });
    } catch (error) {
      console.error("[Scout] Oikotie error:", error);
    }
  }

  // Demo data fallback
  if (sources.includes("demo") || results.length === 0) {
    const demoJobs = await scoutDemoJobs(profile, perSourceLimit);
    results.push({
      jobs: demoJobs,
      source: "demo",
      count: demoJobs.length,
    });
  }

  return results;
}

/**
 * TE-palvelujen Työmarkkinatori API
 * Dokumentaatio: https://tyomarkkinatori.fi/api
 */
async function scoutTyomarkkinatori(profile: Profile, maxResults: number): Promise<InsertJob[]> {
  const jobs: InsertJob[] = [];
  
  // Parse profile data
  let skills: string[] = [];
  let preferredTitles: string[] = [];
  let preferredLocations: string[] = [];
  
  try {
    if (profile.skills) skills = JSON.parse(profile.skills);
    if (profile.preferredJobTitles) preferredTitles = JSON.parse(profile.preferredJobTitles);
    if (profile.preferredLocations) preferredLocations = JSON.parse(profile.preferredLocations);
  } catch (e) {
    console.error("[Scout] Profile parse error:", e);
  }

  // Build search query
  const searchTerms = [...preferredTitles, ...skills.slice(0, 3)].filter(Boolean);
  const query = searchTerms.length > 0 ? searchTerms.join(" ") : "software developer";
  
  // Location mapping for Työmarkkinatori
  const locationMapping: Record<string, string> = {
    "helsinki": "091",
    "espoo": "049",
    "tampere": "837",
    "turku": "853",
    "oulu": "564",
    "vantaa": "092",
    "jyväskylä": "179",
    "kuopio": "297",
    "lahti": "398",
  };

  // Get municipality codes for preferred locations
  const municipalities = preferredLocations
    .map(loc => locationMapping[loc.toLowerCase()])
    .filter(Boolean);

  try {
    // Työmarkkinatori API endpoint
    const baseUrl = "https://paikat.te-palvelut.fi/tpt-api/v1/tyopaikat";
    const params = new URLSearchParams({
      hakusana: query,
      rows: String(Math.min(maxResults, 100)),
      sort: "julkaistu desc",
    });

    if (municipalities.length > 0) {
      params.set("kunta", municipalities.join(","));
    }

    const response = await fetch(`${baseUrl}?${params}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "JobScoutAgent/1.0",
      },
    });

    if (!response.ok) {
      console.error(`[Scout] Työmarkkinatori API error: ${response.status}`);
      return jobs;
    }

    const data = await response.json();
    const listings = data.response?.docs || data.ilmoitukset || [];

    for (const listing of listings.slice(0, maxResults)) {
      const job: InsertJob = {
        externalId: listing.id || listing.ilmoitusnumero || `tm-${Date.now()}-${Math.random()}`,
        source: "tyomarkkinatori",
        title: listing.otsikko || listing.tehtavanimike || "Työnhakuilmoitus",
        company: listing.tyonantajanNimi || listing.yritys || "Yritys ei tiedossa",
        description: listing.kuvausteksti || listing.kuvaus || "",
        location: listing.sijainti || listing.tyonSuorituspaikka || "",
        employmentType: mapEmploymentType(listing.tyoaika),
        remoteType: listing.etamahdollisuus ? "remote" : "on-site",
        industry: listing.ammattiala || "",
        postedAt: listing.julkaistu ? new Date(listing.julkaistu) : new Date(),
        expiresAt: listing.hakuPaattyy ? new Date(listing.hakuPaattyy) : undefined,
        url: `https://paikat.te-palvelut.fi/tpt/${listing.id || listing.ilmoitusnumero}`,
      };

      jobs.push(job);
    }
  } catch (error) {
    console.error("[Scout] Työmarkkinatori fetch error:", error);
  }

  return jobs;
}

/**
 * Duunitori scraping
 */
async function scoutDuunitori(profile: Profile, maxResults: number): Promise<InsertJob[]> {
  const jobs: InsertJob[] = [];

  let preferredTitles: string[] = [];
  let preferredLocations: string[] = [];
  
  try {
    if (profile.preferredJobTitles) preferredTitles = JSON.parse(profile.preferredJobTitles);
    if (profile.preferredLocations) preferredLocations = JSON.parse(profile.preferredLocations);
  } catch (e) {}

  const searchTerm = preferredTitles[0] || "developer";
  const location = preferredLocations[0] || "helsinki";

  try {
    // Duunitori search URL
    const url = `https://duunitori.fi/tyopaikat?haku=${encodeURIComponent(searchTerm)}&alue=${encodeURIComponent(location)}`;
    
    const response = await fetch(url, {
      headers: {
        "Accept": "text/html",
        "User-Agent": "Mozilla/5.0 (compatible; JobScoutAgent/1.0)",
      },
    });

    if (!response.ok) {
      console.error(`[Scout] Duunitori error: ${response.status}`);
      return jobs;
    }

    const html = await response.text();
    
    // Parse job listings from HTML
    // Note: This is a basic implementation, might need adjustment
    const jobRegex = /<article[^>]*class="[^"]*job-box[^"]*"[^>]*>[\s\S]*?<\/article>/gi;
    const matches = html.match(jobRegex) || [];

    for (const match of matches.slice(0, maxResults)) {
      // Extract job details from HTML
      const titleMatch = match.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const companyMatch = match.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i);
      const linkMatch = match.match(/href="(\/tyopaikat\/[^"]+)"/i);
      const locationMatch = match.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i);

      if (titleMatch && linkMatch) {
        const job: InsertJob = {
          externalId: `duunitori-${linkMatch[1].split("/").pop() || Date.now()}`,
          source: "duunitori",
          title: stripHtml(titleMatch[1]),
          company: companyMatch ? stripHtml(companyMatch[1]) : "Yritys",
          description: "",
          location: locationMatch ? stripHtml(locationMatch[1]) : location,
          url: `https://duunitori.fi${linkMatch[1]}`,
          postedAt: new Date(),
        };
        jobs.push(job);
      }
    }
  } catch (error) {
    console.error("[Scout] Duunitori fetch error:", error);
  }

  return jobs;
}

/**
 * Oikotie Työpaikat scraping
 */
async function scoutOikotie(profile: Profile, maxResults: number): Promise<InsertJob[]> {
  const jobs: InsertJob[] = [];

  let preferredTitles: string[] = [];
  let preferredLocations: string[] = [];
  
  try {
    if (profile.preferredJobTitles) preferredTitles = JSON.parse(profile.preferredJobTitles);
    if (profile.preferredLocations) preferredLocations = JSON.parse(profile.preferredLocations);
  } catch (e) {}

  const searchTerm = preferredTitles[0] || "ohjelmoija";
  const location = preferredLocations[0] || "helsinki";

  try {
    // Oikotie search URL
    const url = `https://tyopaikat.oikotie.fi/tyopaikat?hakusana=${encodeURIComponent(searchTerm)}&sijainti=${encodeURIComponent(location)}`;
    
    const response = await fetch(url, {
      headers: {
        "Accept": "text/html",
        "User-Agent": "Mozilla/5.0 (compatible; JobScoutAgent/1.0)",
      },
    });

    if (!response.ok) {
      console.error(`[Scout] Oikotie error: ${response.status}`);
      return jobs;
    }

    const html = await response.text();
    
    // Parse job listings - Oikotie uses JSON-LD
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, "");
          const data = JSON.parse(jsonContent);
          
          if (data["@type"] === "JobPosting") {
            const job: InsertJob = {
              externalId: `oikotie-${data.identifier || Date.now()}`,
              source: "oikotie",
              title: data.title || "Työpaikka",
              company: data.hiringOrganization?.name || "Yritys",
              description: data.description || "",
              location: data.jobLocation?.address?.addressLocality || location,
              salaryMin: data.baseSalary?.value?.minValue,
              salaryMax: data.baseSalary?.value?.maxValue,
              employmentType: data.employmentType,
              url: data.url || url,
              postedAt: data.datePosted ? new Date(data.datePosted) : new Date(),
              expiresAt: data.validThrough ? new Date(data.validThrough) : undefined,
            };
            jobs.push(job);
          }
        } catch (e) {
          // JSON parse error, skip
        }
      }
    }
  } catch (error) {
    console.error("[Scout] Oikotie fetch error:", error);
  }

  return jobs.slice(0, maxResults);
}

/**
 * Demo-data fallback
 */
async function scoutDemoJobs(profile: Profile, maxResults: number): Promise<InsertJob[]> {
  const demoJobs: InsertJob[] = [];

  let skills: string[] = [];
  let preferredTitles: string[] = [];
  let preferredLocations: string[] = [];

  try {
    if (profile.skills) skills = JSON.parse(profile.skills);
    if (profile.preferredJobTitles) preferredTitles = JSON.parse(profile.preferredJobTitles);
    if (profile.preferredLocations) preferredLocations = JSON.parse(profile.preferredLocations);
  } catch (e) {}

  const companies = [
    { name: "TechCorp Finland", rating: 85 },
    { name: "Nordic Software Solutions", rating: 90 },
    { name: "Helsinki AI Labs", rating: 95 },
    { name: "Suomi Digital", rating: 80 },
    { name: "Innovation Hub Oy", rating: 88 },
    { name: "Future Tech Finland", rating: 92 },
  ];

  const jobTitles = preferredTitles.length > 0 
    ? preferredTitles 
    : ["Software Developer", "Full Stack Developer", "Frontend Developer"];

  const locations = preferredLocations.length > 0
    ? preferredLocations
    : ["Helsinki", "Espoo", "Tampere"];

  const count = Math.min(maxResults, 10);

  for (let i = 0; i < count; i++) {
    const company = companies[i % companies.length];
    const title = jobTitles[i % jobTitles.length];
    const location = locations[i % locations.length];

    const job: InsertJob = {
      externalId: `demo-${Date.now()}-${i}`,
      source: "demo",
      title: `${title}`,
      company: company.name,
      description: `Etsimme motivoitunutta ${title.toLowerCase()}a tiimimme. Demo-työpaikka testausta varten.`,
      location,
      salaryMin: 3500 + (i * 200),
      salaryMax: 5000 + (i * 200),
      employmentType: "full-time",
      remoteType: i % 3 === 0 ? "remote" : i % 3 === 1 ? "hybrid" : "on-site",
      industry: "Technology",
      requiredSkills: JSON.stringify(skills.slice(0, 5) || ["JavaScript", "React"]),
      experienceRequired: Math.floor(i / 2) + 1,
      postedAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
      url: `https://example.com/demo-job-${i + 1}`,
      companyRating: company.rating,
    };

    demoJobs.push(job);
  }

  return demoJobs;
}

// Helper functions
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function mapEmploymentType(type: string | undefined): string {
  if (!type) return "full-time";
  const lower = type.toLowerCase();
  if (lower.includes("osa-aika") || lower.includes("part")) return "part-time";
  if (lower.includes("määräaika") || lower.includes("contract")) return "contract";
  return "full-time";
}
