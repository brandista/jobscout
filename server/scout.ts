import type { Profile, InsertJob } from "../drizzle/schema";

/**
 * Scoutaus-agentti työpaikkojen hakuun
 * 
 * Käyttää Serper.dev Search API:a hakemaan työpaikkoja
 * ja parsii tulokset Indeed, LinkedIn, Glassdoor jne. sivuilta
 * 
 * https://serper.dev/
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
  const { profile, sources = ["serper"], maxResults = 50 } = params;
  const results: ScoutResult[] = [];

  // 1. Serper.dev Search (ensisijainen - TOIMII!)
  try {
    const jobs = await scoutSerperJobs(profile, maxResults);
    if (jobs.length > 0) {
      results.push({
        jobs,
        source: "serper",
        count: jobs.length,
      });
      console.log(`[Scout] Serper.dev found ${jobs.length} jobs`);
    }
  } catch (error) {
    console.error("[Scout] Serper.dev error:", error);
  }

  // 2. Vantaan avoimet työpaikat (ilmainen avoin data API)
  try {
    const jobs = await scoutVantaaJobs(profile);
    if (jobs.length > 0) {
      results.push({
        jobs,
        source: "vantaa",
        count: jobs.length,
      });
      console.log(`[Scout] Vantaa API found ${jobs.length} jobs`);
    }
  } catch (error) {
    console.error("[Scout] Vantaa API error:", error);
  }

  // 3. Adzuna (fallback jos Serper ei löydä mitään)
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
    console.warn("[Scout] No jobs found - check SERPER_API_KEY");
  }

  return results;
}

/**
 * Serper.dev Search API
 * https://serper.dev/
 * 
 * Hakee työpaikkoja Google-haun kautta ja parsii tulokset
 * Tarvitsee SERPER_API_KEY ympäristömuuttujan
 */
async function scoutSerperJobs(profile: Profile, maxResults: number): Promise<InsertJob[]> {
  const jobs: InsertJob[] = [];
  
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn("[Scout] SERPER_API_KEY not set, skipping Serper.dev");
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

  console.log(`[Scout] Profile data - preferredJobTitles raw:`, profile.preferredJobTitles);
  console.log(`[Scout] Profile data - preferredLocations raw:`, profile.preferredLocations);
  console.log(`[Scout] Searching Serper.dev for: "${searchTerm}" in "${location}"`);

  // Tee useita hakuja eri lähteille - optimoitu Suomen markkinoille
  const searchQueries = [
    // Suomalaiset sivustot ensin
    `${searchTerm} työpaikat ${location} site:duunitori.fi`,
    `${searchTerm} avoimet työpaikat ${location} site:oikotie.fi`,
    `${searchTerm} rekry ${location} site:monster.fi`,
    `${searchTerm} työpaikka ${location} site:te-palvelut.fi OR site:tyomarkkinatori.fi`,
    `${searchTerm} jobs ${location} site:kuntarekry.fi`,
    // Kansainväliset
    `${searchTerm} jobs ${location} Finland site:linkedin.com/jobs`,
    `${searchTerm} jobs ${location} site:indeed.fi OR site:indeed.com`,
    // Yleinen haku (poimi myös yritysten omat rekrysivut)
    `${searchTerm} avoimet työpaikat ${location} rekrytointi`,
  ];

  for (const query of searchQueries) {
    if (jobs.length >= maxResults) break;
    
    try {
      console.log(`[Scout] Serper query: "${query}"`);
      
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          gl: "fi",
          hl: "fi",
          num: 10,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Scout] Serper error: ${response.status} - ${errorText}`);
        continue;
      }

      const data = await response.json();
      const results = data.organic || [];
      
      console.log(`[Scout] Serper returned ${results.length} results for query`);

      for (const result of results) {
        if (jobs.length >= maxResults) break;
        
        // Parsitaan työpaikkatieto hakutuloksesta
        const job = parseSearchResultToJob(result, searchTerm, location);
        if (job) {
          // Tarkista ettei duplikaattia
          const isDuplicate = jobs.some(j => 
            j.url === job.url || 
            (j.title === job.title && j.company === job.company)
          );
          if (!isDuplicate) {
            jobs.push(job);
          }
        }
      }
    } catch (error) {
      console.error(`[Scout] Serper fetch error for query "${query}":`, error);
    }
  }

  console.log(`[Scout] Processed ${jobs.length} unique jobs from Serper.dev`);
  return jobs;
}

/**
 * Parsii Google-hakutuloksen työpaikkatiedoksi
 */
function parseSearchResultToJob(result: any, searchTerm: string, location: string): InsertJob | null {
  const url = result.link || "";
  const title = result.title || "";
  const snippet = result.snippet || "";
  
  // Ohita tulokset jotka eivät näytä työpaikoilta
  const jobIndicators = ['job', 'työ', 'career', 'hiring', 'rekry', 'avoin', 'position', 'developer', 'engineer', 'manager', 'analyst'];
  const hasJobIndicator = jobIndicators.some(ind => 
    title.toLowerCase().includes(ind) || snippet.toLowerCase().includes(ind)
  );
  
  if (!hasJobIndicator) {
    return null;
  }

  // Yritä parsia yrityksen nimi
  let company = "Yritys";
  
  // LinkedIn: "Software Engineer at Company - LinkedIn"
  const linkedinMatch = title.match(/at\s+([^-–]+)/i);
  if (linkedinMatch) {
    company = linkedinMatch[1].trim();
  }
  
  // Indeed/Duunitori: "Job Title - Company - Location"
  const dashParts = title.split(/[-–|]/);
  if (dashParts.length >= 2) {
    // Toinen osa on usein yritys
    const potentialCompany = dashParts[1].trim();
    if (potentialCompany && !potentialCompany.toLowerCase().includes('linkedin') && 
        !potentialCompany.toLowerCase().includes('indeed') &&
        !potentialCompany.toLowerCase().includes('glassdoor') &&
        potentialCompany.length < 50) {
      company = potentialCompany;
    }
  }

  // Yritä parsia sijainti snippetistä
  let jobLocation = location;
  const locationPatterns = [
    /(?:Helsinki|Espoo|Tampere|Turku|Oulu|Vantaa|Jyväskylä|Kuopio|Lahti)/i,
    /(?:Remote|Etätyö|Hybrid|Hybridityö)/i,
    /(?:Finland|Suomi)/i,
  ];
  for (const pattern of locationPatterns) {
    const match = snippet.match(pattern) || title.match(pattern);
    if (match) {
      jobLocation = match[0];
      break;
    }
  }

  // Määritä lähde URL:n perusteella
  let source = "serper";
  if (url.includes("linkedin.com")) source = "linkedin";
  else if (url.includes("indeed.com") || url.includes("fi.indeed.com")) source = "indeed";
  else if (url.includes("duunitori.fi")) source = "duunitori";
  else if (url.includes("glassdoor.com")) source = "glassdoor";
  else if (url.includes("oikotie.fi")) source = "oikotie";
  else if (url.includes("monster.fi")) source = "monster";

  // Puhdista title
  let cleanTitle = title
    .replace(/\s*[-–|]\s*(LinkedIn|Indeed|Glassdoor|Duunitori|Monster).*$/i, "")
    .replace(/\s*\|\s*.*$/, "")
    .trim();
  
  // Jos title on liian pitkä tai näyttää listalta, käytä hakutermiä
  if (cleanTitle.length > 100 || cleanTitle.includes(" jobs ")) {
    cleanTitle = searchTerm;
  }

  const job: InsertJob = {
    externalId: `serper-${hashString(url)}`,
    source: source,
    title: cleanTitle || searchTerm,
    company: company,
    description: snippet,
    location: jobLocation,
    employmentType: "full-time",
    remoteType: snippet.toLowerCase().includes("remote") || snippet.toLowerCase().includes("etä") ? "remote" : "on-site",
    industry: "",
    postedAt: new Date(),
    url: url,
  };

  return job;
}

/**
 * Adzuna Jobs API (fallback)
 * https://developer.adzuna.com/
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

  // Adzuna tukee: gb, us, au, br, ca, de, fr, in, nl, nz, pl, ru, sg, za
  // Suomi EI ole tuettu - käytetään DE/GB
  const countries = ['de', 'gb'];
  
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

      if (jobs.length > 0) {
        console.log(`[Scout] Found ${jobs.length} jobs from Adzuna ${country.toUpperCase()}`);
        break;
      }
    } catch (error) {
      console.error(`[Scout] Adzuna ${country} fetch error:`, error);
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

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Vantaan avoimet työpaikat - Ilmainen avoin data API
 * https://gis.vantaa.fi/rest/tyopaikat/v1
 *
 * Palauttaa Vantaan kaupungin avoimet työpaikat JSON-muodossa
 */
async function scoutVantaaJobs(profile: Profile): Promise<InsertJob[]> {
  const jobs: InsertJob[] = [];

  try {
    console.log("[Scout] Fetching Vantaa open jobs API...");

    const response = await fetch("https://gis.vantaa.fi/rest/tyopaikat/v1", {
      headers: {
        "Accept": "application/json",
        "User-Agent": "JobScout/1.0"
      }
    });

    if (!response.ok) {
      console.error(`[Scout] Vantaa API error: ${response.status}`);
      return jobs;
    }

    const data = await response.json();

    // API palauttaa arrayn tai objektin jossa on features/items
    const listings = Array.isArray(data) ? data : (data.features || data.items || data.jobs || []);

    console.log(`[Scout] Vantaa API returned ${listings.length} jobs`);

    for (const listing of listings) {
      // Vantaan API:n kenttänimet voivat vaihdella
      const props = listing.properties || listing;

      const job: InsertJob = {
        externalId: `vantaa-${props.id || props.ID || hashString(props.otsikko || props.title || "")}`,
        source: "vantaa",
        title: props.otsikko || props.title || props.nimike || "Avoin työpaikka",
        company: "Vantaan kaupunki",
        description: props.kuvaus || props.description || props.tehtavankuvaus || "",
        location: props.sijainti || props.toimipaikka || "Vantaa",
        employmentType: parseVantaaEmploymentType(props.tyosuhde || props.tyosuhteen_tyyppi),
        remoteType: "on-site",
        industry: "Julkinen sektori",
        postedAt: props.julkaistu ? new Date(props.julkaistu) : new Date(),
        expiresAt: props.hakuaika_paattyy ? new Date(props.hakuaika_paattyy) : undefined,
        url: props.linkki || props.url || `https://www.vantaa.fi/fi/tyopaikat`,
      };

      jobs.push(job);
    }

    console.log(`[Scout] Processed ${jobs.length} jobs from Vantaa API`);

  } catch (error) {
    console.error("[Scout] Vantaa API fetch error:", error);
  }

  return jobs;
}

function parseVantaaEmploymentType(tyosuhde?: string): string {
  if (!tyosuhde) return "full-time";
  const lower = tyosuhde.toLowerCase();
  if (lower.includes("osa-aika") || lower.includes("part")) return "part-time";
  if (lower.includes("määräaika") || lower.includes("temporary")) return "contract";
  if (lower.includes("sijainen") || lower.includes("substitute")) return "contract";
  return "full-time";
}
