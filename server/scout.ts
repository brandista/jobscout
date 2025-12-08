import type { Profile, InsertJob } from "../drizzle/schema";

/**
 * Scoutaus-agentti työpaikkojen hakuun
 * 
 * Käyttää kahta API:a:
 * 1. SerpApi Google Jobs (ensisijainen) - tukee Suomea!
 * 2. Adzuna (fallback) - kansainväliset työpaikat
 * 
 * https://serpapi.com/google-jobs-api
 * https://developer.adzuna.com/
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
  const { profile, sources = ["serpapi"], maxResults = 50 } = params;
  const results: ScoutResult[] = [];

  // 1. SerpApi Google Jobs (ensisijainen - tukee Suomea!)
  if (sources.some(s => ["serpapi", "google", "google_jobs", "tyomarkkinatori", "duunitori", "demo"].includes(s))) {
    try {
      const jobs = await scoutSerpApiJobs(profile, maxResults);
      if (jobs.length > 0) {
        results.push({
          jobs,
          source: "google_jobs",
          count: jobs.length,
        });
        console.log(`[Scout] SerpApi Google Jobs found ${jobs.length} jobs`);
      }
    } catch (error) {
      console.error("[Scout] SerpApi error:", error);
    }
  }

  // 2. Adzuna (fallback jos SerpApi ei löydä mitään)
  if (results.length === 0 || sources.includes("adzuna")) {
    try {
      const jobs = await scoutAdzunaJobs(profile, maxResults);
      if (jobs.length > 0) {
        results.push({
          jobs,
          source: "adzuna",
          count: jobs.length,
        });
        console.log(`[Scout] Adzuna found ${jobs.length} jobs`);
      }
    } catch (error) {
      console.error("[Scout] Adzuna error:", error);
    }
  }

  if (results.length === 0) {
    console.warn("[Scout] No jobs found - check SERPAPI_API_KEY, ADZUNA_APP_ID and ADZUNA_APP_KEY");
  }

  return results;
}

/**
 * SerpApi Google Jobs API
 * https://serpapi.com/google-jobs-api
 * 
 * TUKEE SUOMEA! Käyttää oikeaa Google Jobs -dataa.
 * Tarvitsee SERPAPI_API_KEY ympäristömuuttujan
 */
async function scoutSerpApiJobs(profile: Profile, maxResults: number): Promise<InsertJob[]> {
  const jobs: InsertJob[] = [];
  
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.warn("[Scout] SERPAPI_API_KEY not set, skipping SerpApi");
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
  const location = preferredLocations[0] || "Helsinki, Finland";

  console.log(`[Scout] Profile data - preferredJobTitles raw:`, profile.preferredJobTitles);
  console.log(`[Scout] Profile data - preferredLocations raw:`, profile.preferredLocations);
  console.log(`[Scout] Searching SerpApi Google Jobs for: "${searchTerm}" in "${location}"`);

  try {
    // Ensimmäinen haku tarkalla sijainnilla
    let params = new URLSearchParams({
      engine: "google_jobs",
      q: searchTerm,
      location: location,
      hl: "en",  // Englanti toimii paremmin
      gl: "fi",
      api_key: apiKey,
    });

    let response = await fetch(`https://serpapi.com/search.json?${params}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Scout] SerpApi error: ${response.status} - ${errorText}`);
      return jobs;
    }

    let data = await response.json();
    
    console.log(`[Scout] SerpApi response keys:`, Object.keys(data));
    if (data.error) {
      console.log(`[Scout] SerpApi note:`, data.error);
    }
    
    let listings = data.jobs_results || [];
    console.log(`[Scout] SerpApi returned ${listings.length} jobs for "${searchTerm}" in "${location}"`);

    // Jos ei tuloksia, kokeile laajemmalla alueella (Finland)
    if (listings.length === 0) {
      console.log(`[Scout] No results, trying broader search with location: Finland`);
      params = new URLSearchParams({
        engine: "google_jobs",
        q: searchTerm,
        location: "Finland",
        hl: "en",
        gl: "fi",
        api_key: apiKey,
      });
      
      response = await fetch(`https://serpapi.com/search.json?${params}`);
      if (response.ok) {
        data = await response.json();
        listings = data.jobs_results || [];
        console.log(`[Scout] Broader search returned ${listings.length} jobs`);
      }
    }

    // Jos vieläkään ei tuloksia, kokeile yleisempää hakutermiä
    if (listings.length === 0 && searchTerm !== "software developer") {
      console.log(`[Scout] Still no results, trying generic term "jobs"`);
      params = new URLSearchParams({
        engine: "google_jobs",
        q: "jobs",
        location: "Helsinki, Finland",
        hl: "en",
        gl: "fi",
        api_key: apiKey,
      });
      
      response = await fetch(`https://serpapi.com/search.json?${params}`);
      if (response.ok) {
        data = await response.json();
        listings = data.jobs_results || [];
        console.log(`[Scout] Generic search returned ${listings.length} jobs`);
      }
    }

    for (const listing of listings.slice(0, maxResults)) {
      const job: InsertJob = {
        externalId: listing.job_id ? `serpapi-${listing.job_id}` : `serpapi-${Date.now()}-${Math.random()}`,
        source: "google_jobs",
        title: listing.title || "Työpaikka",
        company: listing.company_name || "Yritys",
        description: listing.description || "",
        location: listing.location || location,
        salaryMin: parseSalary(listing.detected_extensions?.salary)?.min,
        salaryMax: parseSalary(listing.detected_extensions?.salary)?.max,
        employmentType: mapSerpApiEmploymentType(listing.detected_extensions),
        remoteType: listing.detected_extensions?.work_from_home ? "remote" : "on-site",
        industry: "",
        postedAt: parsePostedDate(listing.detected_extensions?.posted_at),
        url: listing.share_link || listing.related_links?.[0]?.link || "",
      };
      jobs.push(job);
    }

    console.log(`[Scout] Processed ${jobs.length} jobs from SerpApi`);
  } catch (error) {
    console.error("[Scout] SerpApi fetch error:", error);
  }

  return jobs;
}

/**
 * Adzuna Jobs API
 * https://developer.adzuna.com/
 * 
 * Tarvitsee ADZUNA_APP_ID ja ADZUNA_APP_KEY ympäristömuuttujat
 */
async function scoutAdzunaJobs(profile: Profile, maxResults: number): Promise<InsertJob[]> {
  const jobs: InsertJob[] = [];
  
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  
  if (!appId || !appKey) {
    console.warn("[Scout] ADZUNA_APP_ID or ADZUNA_APP_KEY not set");
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

  console.log(`[Scout] Searching Adzuna for: "${searchTerm}" in "${location}"`);

  // Adzuna tukee näitä maita: gb, us, au, br, ca, de, fr, in, nl, nz, pl, ru, sg, za
  // Suomi (fi) EI ole suoraan tuettu, joten käytetään 'de' (Saksa) tai haetaan ilman maakoodia
  // TAI käytetään UK/GB ja haetaan "Finland" location-parametrilla
  
  // Kokeillaan ensin Suomi-spesifistä hakua DE-endpointilla (lähin)
  const countries = ['de', 'gb']; // Kokeillaan Saksaa ja UK:ta
  
  for (const country of countries) {
    try {
      const resultsPerPage = Math.min(maxResults, 50);
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=${resultsPerPage}&what=${encodeURIComponent(searchTerm)}&where=${encodeURIComponent(location)}&content-type=application/json`;

      console.log(`[Scout] Trying Adzuna ${country.toUpperCase()}...`);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Scout] Adzuna ${country} error: ${response.status} - ${errorText}`);
        continue;
      }

      const data = await response.json();
      const listings = data.results || [];

      console.log(`[Scout] Adzuna ${country.toUpperCase()} returned ${listings.length} jobs`);

      if (listings.length === 0) continue;

      for (const listing of listings.slice(0, maxResults)) {
        const job: InsertJob = {
          externalId: listing.id ? `adzuna-${listing.id}` : `adzuna-${Date.now()}-${Math.random()}`,
          source: "adzuna",
          title: listing.title || "Työpaikka",
          company: listing.company?.display_name || "Yritys",
          description: listing.description || "",
          location: listing.location?.display_name || location,
          salaryMin: listing.salary_min ? Math.round(listing.salary_min) : undefined,
          salaryMax: listing.salary_max ? Math.round(listing.salary_max) : undefined,
          employmentType: mapContractType(listing.contract_type, listing.contract_time),
          remoteType: "on-site",
          industry: listing.category?.label || "",
          postedAt: listing.created ? new Date(listing.created) : new Date(),
          url: listing.redirect_url || "",
        };
        jobs.push(job);
      }

      // Jos löydettiin tuloksia, ei tarvitse kokeilla muita maita
      if (jobs.length > 0) {
        console.log(`[Scout] Found ${jobs.length} jobs from Adzuna ${country.toUpperCase()}`);
        break;
      }
    } catch (error) {
      console.error(`[Scout] Adzuna ${country} fetch error:`, error);
    }
  }

  // Jos Adzuna ei löytänyt mitään, kokeillaan vielä yleisempää hakua
  if (jobs.length === 0) {
    console.log("[Scout] Trying broader Adzuna search...");
    try {
      // Hae vain hakutermillä ilman lokaatiota
      const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(searchTerm)}&content-type=application/json`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const listings = data.results || [];

        for (const listing of listings.slice(0, maxResults)) {
          const job: InsertJob = {
            externalId: listing.id ? `adzuna-${listing.id}` : `adzuna-${Date.now()}-${Math.random()}`,
            source: "adzuna",
            title: listing.title || "Työpaikka",
            company: listing.company?.display_name || "Yritys",
            description: listing.description || "",
            location: listing.location?.display_name || "Remote",
            salaryMin: listing.salary_min ? Math.round(listing.salary_min) : undefined,
            salaryMax: listing.salary_max ? Math.round(listing.salary_max) : undefined,
            employmentType: mapContractType(listing.contract_type, listing.contract_time),
            remoteType: "on-site",
            industry: listing.category?.label || "",
            postedAt: listing.created ? new Date(listing.created) : new Date(),
            url: listing.redirect_url || "",
          };
          jobs.push(job);
        }
        console.log(`[Scout] Broader search found ${jobs.length} jobs`);
      }
    } catch (error) {
      console.error("[Scout] Broader Adzuna search error:", error);
    }
  }

  return jobs;
}

function mapContractType(contractType?: string, contractTime?: string): string {
  if (contractTime === "part_time") return "part-time";
  if (contractType === "contract") return "contract";
  if (contractType === "permanent") return "full-time";
  return "full-time";
}

function mapSerpApiEmploymentType(extensions?: any): string {
  if (!extensions) return "full-time";
  if (extensions.schedule_type) {
    const type = extensions.schedule_type.toLowerCase();
    if (type.includes("part")) return "part-time";
    if (type.includes("contract") || type.includes("temporary")) return "contract";
    if (type.includes("intern")) return "internship";
  }
  return "full-time";
}

function parseSalary(salaryStr?: string): { min?: number; max?: number } | undefined {
  if (!salaryStr) return undefined;
  
  // Yritetään parsia palkka stringistä, esim. "€50,000 - €70,000 a year"
  const numbers = salaryStr.match(/[\d,]+/g);
  if (!numbers || numbers.length === 0) return undefined;
  
  const parsed = numbers.map(n => parseInt(n.replace(/,/g, ''), 10));
  
  if (parsed.length >= 2) {
    return { min: Math.min(...parsed), max: Math.max(...parsed) };
  } else if (parsed.length === 1) {
    return { min: parsed[0], max: parsed[0] };
  }
  
  return undefined;
}

function parsePostedDate(postedStr?: string): Date {
  if (!postedStr) return new Date();
  
  const now = new Date();
  const lower = postedStr.toLowerCase();
  
  // "X days ago", "X hours ago", etc.
  const match = lower.match(/(\d+)\s*(hour|day|week|month)/);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 'hour':
        return new Date(now.getTime() - num * 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000);
    }
  }
  
  return new Date();
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
