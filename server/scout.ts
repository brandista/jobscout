import type { Profile, InsertJob } from "../drizzle/schema";

/**
 * Scoutaus-agentti työpaikkojen hakuun
 * 
 * Käyttää Serper.dev Google Jobs API:a joka hakee oikeita työpaikkoja
 * Google for Jobs -aggregaattorilta. Toimii maailmanlaajuisesti, myös Suomessa.
 * 
 * Ilmainen tier: 2500 hakua/kk
 * https://serper.dev
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
  const { profile, sources = ["google"], maxResults = 50 } = params;
  const results: ScoutResult[] = [];

  // Serper.dev Google Jobs API (ensisijainen)
  // Hyväksytään myös vanhat source-nimet yhteensopivuuden vuoksi
  if (sources.includes("google") || sources.includes("serper") || 
      sources.includes("tyomarkkinatori") || sources.includes("duunitori") ||
      sources.includes("demo")) {
    try {
      const jobs = await scoutGoogleJobs(profile, maxResults);
      if (jobs.length > 0) {
        results.push({
          jobs,
          source: "google",
          count: jobs.length,
        });
        console.log(`[Scout] Google Jobs found ${jobs.length} jobs`);
      }
    } catch (error) {
      console.error("[Scout] Google Jobs error:", error);
    }
  }

  if (results.length === 0) {
    console.warn("[Scout] No jobs found - check SERPER_API_KEY environment variable");
  }

  return results;
}

/**
 * Serper.dev Google Jobs API
 * https://serper.dev/google-jobs-api
 * 
 * Ilmainen tier: 2500 hakua/kk
 * Tarvitsee SERPER_API_KEY ympäristömuuttujan
 */
async function scoutGoogleJobs(profile: Profile, maxResults: number): Promise<InsertJob[]> {
  const jobs: InsertJob[] = [];
  
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn("[Scout] SERPER_API_KEY not set");
    return jobs;
  }

  // Parse profile data
  let preferredTitles: string[] = [];
  let preferredLocations: string[] = [];
  
  try {
    if (profile.preferredJobTitles) preferredTitles = JSON.parse(profile.preferredJobTitles);
    if (profile.preferredLocations) preferredLocations = JSON.parse(profile.preferredLocations);
  } catch (e) {
    console.error("[Scout] Profile parse error:", e);
  }

  const searchTerm = preferredTitles[0] || profile.currentTitle || "software developer";
  const location = preferredLocations[0] || "Helsinki";
  const query = `${searchTerm} ${location}`;

  console.log(`[Scout] Searching Google Jobs for: "${query}"`);

  try {
    // Käytetään search-endpointia jobs-spesifisellä haulla
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `${query} työpaikka OR avoin paikka OR rekrytointi`,
        gl: "fi",
        hl: "fi",
        num: Math.min(maxResults, 20),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Scout] Serper API error: ${response.status} - ${errorText}`);
      return jobs;
    }

    const data = await response.json();
    // Search API palauttaa organic results, ei jobs
    const listings = data.organic || [];

    console.log(`[Scout] Serper returned ${listings.length} search results`);

    for (const listing of listings.slice(0, maxResults)) {
      // Parsitaan työpaikkatiedot hakutuloksista
      const titleParts = (listing.title || "").split(" - ");
      const jobTitle = titleParts[0]?.trim() || "Työpaikka";
      const company = titleParts.length > 1 ? titleParts[titleParts.length - 1]?.trim() : "Yritys";
      
      const job: InsertJob = {
        externalId: listing.link ? `google-${hashString(listing.link)}` : `google-${Date.now()}-${Math.random()}`,
        source: "google",
        title: jobTitle,
        company: company,
        description: listing.snippet || "",
        location: location,
        employmentType: "full-time",
        remoteType: "on-site",
        industry: "",
        postedAt: new Date(),
        url: listing.link || "",
      };
      jobs.push(job);
    }

    console.log(`[Scout] Processed ${jobs.length} jobs for "${query}"`);
  } catch (error) {
    console.error("[Scout] Serper fetch error:", error);
  }

  return jobs;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function mapEmploymentType(type: string | undefined): string {
  if (!type) return "full-time";
  const lower = type.toLowerCase();
  if (lower.includes("part")) return "part-time";
  if (lower.includes("contract") || lower.includes("temp")) return "contract";
  if (lower.includes("intern")) return "internship";
  return "full-time";
}

function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const now = new Date();
  const lower = dateStr.toLowerCase();
  
  if (lower.includes("hour")) {
    const hours = parseInt(lower) || 1;
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }
  if (lower.includes("day")) {
    const days = parseInt(lower) || 1;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
  if (lower.includes("week")) {
    const weeks = parseInt(lower) || 1;
    return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  }
  if (lower.includes("month")) {
    const months = parseInt(lower) || 1;
    return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
  }
  
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}
