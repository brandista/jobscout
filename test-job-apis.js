// JobScout API Test Script
// Testaa molemmat työnhaku-API:t
// Run: node --env-file=.env test-job-apis.js

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY || "";
const SERPER_API_KEY = process.env.SERPER_API_KEY || "";

if (!SERPAPI_API_KEY && !SERPER_API_KEY) {
  console.error("❌ No API keys found! Set SERPAPI_API_KEY or SERPER_API_KEY in .env");
  process.exit(1);
}

async function testSerpAPI() {
  console.log("\n========================================");
  console.log("🔍 Testing SerpAPI (Google Jobs)...");
  console.log("========================================");
  
  try {
    const params = new URLSearchParams({
      engine: "google_jobs",
      q: "software developer",
      location: "Helsinki, Finland",
      hl: "en",
      gl: "fi",
      api_key: SERPAPI_API_KEY,
    });

    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    const data = await response.json();
    
    if (data.error) {
      console.log("❌ SerpAPI Error:", data.error);
      return false;
    }
    
    const jobs = data.jobs_results || [];
    console.log(`✅ SerpAPI works! Found ${jobs.length} jobs`);
    
    if (jobs.length > 0) {
      console.log("\nFirst 3 jobs:");
      jobs.slice(0, 3).forEach((job, i) => {
        console.log(`  ${i+1}. ${job.title} @ ${job.company_name}`);
        console.log(`     📍 ${job.location}`);
      });
    }
    return true;
  } catch (error) {
    console.log("❌ SerpAPI fetch error:", error.message);
    return false;
  }
}

async function testSerperDev() {
  console.log("\n========================================");
  console.log("🔍 Testing Serper.dev (Google Search)...");
  console.log("========================================");
  
  try {
    // Serper.dev Google Jobs endpoint
    const response = await fetch("https://google.serper.dev/jobs", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: "software developer Helsinki",
        gl: "fi",
        hl: "en",
      }),
    });

    const data = await response.json();
    
    if (data.error || data.message) {
      console.log("❌ Serper.dev Error:", data.error || data.message);
      return false;
    }
    
    const jobs = data.jobs || [];
    console.log(`✅ Serper.dev works! Found ${jobs.length} jobs`);
    
    if (jobs.length > 0) {
      console.log("\nFirst 3 jobs:");
      jobs.slice(0, 3).forEach((job, i) => {
        console.log(`  ${i+1}. ${job.title} @ ${job.companyName}`);
        console.log(`     📍 ${job.location}`);
      });
    }
    return true;
  } catch (error) {
    console.log("❌ Serper.dev fetch error:", error.message);
    return false;
  }
}

async function testSerperDevSearch() {
  console.log("\n========================================");
  console.log("🔍 Testing Serper.dev (Regular Search)...");
  console.log("========================================");
  
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: "software developer jobs Helsinki",
        gl: "fi",
        hl: "en",
        num: 5,
      }),
    });

    const data = await response.json();
    
    if (data.error || data.message) {
      console.log("❌ Serper.dev Search Error:", data.error || data.message);
      return false;
    }
    
    const results = data.organic || [];
    console.log(`✅ Serper.dev Search works! Found ${results.length} results`);
    
    if (results.length > 0) {
      console.log("\nFirst 3 results:");
      results.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i+1}. ${r.title}`);
        console.log(`     🔗 ${r.link}`);
      });
    }
    return true;
  } catch (error) {
    console.log("❌ Serper.dev Search error:", error.message);
    return false;
  }
}

// Run all tests
async function main() {
  console.log("🚀 JobScout API Test\n");
  
  const serpApiOk = await testSerpAPI();
  const serperJobsOk = await testSerperDev();
  const serperSearchOk = await testSerperDevSearch();
  
  console.log("\n========================================");
  console.log("📊 SUMMARY");
  console.log("========================================");
  console.log(`SerpAPI (Google Jobs):    ${serpApiOk ? '✅ WORKS' : '❌ FAILED'}`);
  console.log(`Serper.dev (Jobs):        ${serperJobsOk ? '✅ WORKS' : '❌ FAILED'}`);
  console.log(`Serper.dev (Search):      ${serperSearchOk ? '✅ WORKS' : '❌ FAILED'}`);
  
  console.log("\n💡 RECOMMENDATION:");
  if (serpApiOk) {
    console.log("   SerpAPI toimii - scout.ts pitäisi löytää työpaikkoja!");
    console.log("   Jos ei silti toimi, ongelma on profiilissa tai tietokannassa.");
  } else if (serperJobsOk) {
    console.log("   Serper.dev toimii mutta scout.ts käyttää SerpAPI:a.");
    console.log("   → Vaihda scout.ts käyttämään Serper.dev:iä TAI");
    console.log("   → Hanki toimiva SerpAPI-avain");
  } else {
    console.log("   Molemmat API:t eivät toimi - tarkista avaimet!");
  }
}

main();
