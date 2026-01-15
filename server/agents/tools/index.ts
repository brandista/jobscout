/**
 * JobScout Agent System - Tools
 * Tools that agents can use to fetch data and perform actions
 *
 * Integrated with AgentMessenger for inter-agent communication.
 */

import type { AgentTool, UserContext } from "../types";
import { AgentMessenger, SharedKnowledge, type SignalPayload } from "../core";

// Tool: Search jobs based on criteria
export const searchJobsTool: AgentTool = {
  name: "search_jobs",
  description: "Search for jobs matching specific criteria. Use this to find relevant job opportunities.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query (title, skills, etc.)" },
      location: { type: "string", description: "Location filter" },
      remoteOnly: { type: "boolean", description: "Only show remote jobs" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
    required: ["query"],
  },
  execute: async (args, context) => {
    const { getJobs } = await import("../../db");
    const jobs = await getJobs(args.limit || 10, 0);
    
    // Filter based on query
    const query = args.query.toLowerCase();
    const filtered = jobs.filter((j: any) => {
      const matchesQuery = 
        j.title?.toLowerCase().includes(query) ||
        j.company?.toLowerCase().includes(query) ||
        j.description?.toLowerCase().includes(query);
      
      const matchesLocation = !args.location || 
        j.location?.toLowerCase().includes(args.location.toLowerCase());
      
      const matchesRemote = !args.remoteOnly || 
        j.remoteType === "remote" || j.remoteType === "hybrid";
      
      return matchesQuery && matchesLocation && matchesRemote;
    });

    return {
      count: filtered.length,
      jobs: filtered.slice(0, args.limit || 10).map((j: any) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        remoteType: j.remoteType,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
      })),
    };
  },
};

// Tool: Get detailed job analysis
export const analyzeJobTool: AgentTool = {
  name: "analyze_job",
  description: "Get detailed analysis of a specific job and how well it matches the user's profile.",
  parameters: {
    type: "object",
    properties: {
      jobId: { type: "number", description: "Job ID to analyze" },
    },
    required: ["jobId"],
  },
  execute: async (args, context) => {
    const { getJobById } = await import("../../db");
    const job = await getJobById(args.jobId);
    
    if (!job) {
      return { error: "Job not found" };
    }

    // Calculate match if profile exists
    let matchAnalysis = null;
    if (context.profile) {
      const { calculateMatch } = await import("../../matching");
      const profile = {
        skills: JSON.stringify(context.profile.skills),
        preferredJobTitles: JSON.stringify(context.profile.preferredJobTitles),
        preferredLocations: JSON.stringify(context.profile.preferredLocations),
        preferredIndustries: JSON.stringify(context.profile.preferredIndustries),
        yearsOfExperience: context.profile.yearsOfExperience,
        salaryMin: context.profile.salaryMin,
        salaryMax: context.profile.salaryMax,
      };
      matchAnalysis = calculateMatch(profile as any, job as any);
    }

    return {
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        location: job.location,
        remoteType: job.remoteType,
        employmentType: job.employmentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        industry: job.industry,
        requiredSkills: job.requiredSkills,
        experienceRequired: job.experienceRequired,
        url: job.url,
      },
      matchAnalysis,
    };
  },
};

// Tool: Compare multiple jobs
export const compareJobsTool: AgentTool = {
  name: "compare_jobs",
  description: "Compare multiple jobs side by side based on various criteria.",
  parameters: {
    type: "object",
    properties: {
      jobIds: { type: "array", items: { type: "number" }, description: "List of job IDs to compare" },
    },
    required: ["jobIds"],
  },
  execute: async (args, context) => {
    const { getJobById } = await import("../../db");
    
    const jobs = await Promise.all(
      args.jobIds.map((id: number) => getJobById(id))
    );

    const validJobs = jobs.filter(Boolean);

    return {
      comparison: validJobs.map((j: any) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        remoteType: j.remoteType,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        employmentType: j.employmentType,
        industry: j.industry,
      })),
      summary: {
        totalJobs: validJobs.length,
        salaryRange: {
          min: Math.min(...validJobs.map((j: any) => j.salaryMin || Infinity)),
          max: Math.max(...validJobs.map((j: any) => j.salaryMax || 0)),
        },
        locations: [...new Set(validJobs.map((j: any) => j.location).filter(Boolean))],
        remoteOptions: [...new Set(validJobs.map((j: any) => j.remoteType).filter(Boolean))],
      },
    };
  },
};

// Tool: Analyze company
export const analyzeCompanyTool: AgentTool = {
  name: "analyze_company",
  description: "Get detailed analysis of a company including recent news, hiring signals, and culture insights.",
  parameters: {
    type: "object",
    properties: {
      companyName: { type: "string", description: "Company name to analyze" },
      companyId: { type: "number", description: "Company ID (if known)" },
    },
    required: [],
  },
  execute: async (args, context) => {
    const { getCompanyById, getCompanyByName, getEventsByCompanyId, getJobsByCompanyId } = await import("../../db");
    
    let company;
    if (args.companyId) {
      company = await getCompanyById(args.companyId);
    } else if (args.companyName) {
      company = await getCompanyByName(args.companyName);
    }

    if (!company) {
      return { 
        error: "Company not found",
        suggestion: "Try searching for jobs from this company instead."
      };
    }

    const [events, jobs] = await Promise.all([
      getEventsByCompanyId(company.id, 10),
      getJobsByCompanyId(company.id, 20),
    ]);

    return {
      company: {
        id: company.id,
        name: company.name,
        industry: company.industry,
        website: company.website,
        description: company.description,
        employeeCount: company.employeeCount,
        headquarters: company.headquarters,
      },
      signals: {
        totalEvents: events.length,
        events: events.map((e: any) => ({
          type: e.eventType,
          headline: e.headline,
          impact: e.impactStrength,
          date: e.publishedAt,
        })),
      },
      hiring: {
        openPositions: jobs.length,
        positions: jobs.slice(0, 5).map((j: any) => ({
          title: j.title,
          location: j.location,
          remoteType: j.remoteType,
        })),
      },
    };
  },
};

// Tool: Profile gap analysis
export const profileGapsTool: AgentTool = {
  name: "profile_gaps",
  description: "Analyze gaps between user's profile and their target jobs or industry requirements.",
  parameters: {
    type: "object",
    properties: {
      targetJobId: { type: "number", description: "Specific job to compare against" },
      targetIndustry: { type: "string", description: "Industry to analyze requirements for" },
    },
    required: [],
  },
  execute: async (args, context) => {
    if (!context.profile) {
      return { 
        error: "No profile found",
        suggestion: "Please complete your profile first to get personalized gap analysis."
      };
    }

    const gaps: any = {
      skills: [],
      experience: null,
      certifications: [],
      recommendations: [],
    };

    if (args.targetJobId) {
      const { getJobById } = await import("../../db");
      const job = await getJobById(args.targetJobId);
      
      if (job && job.requiredSkills) {
        const requiredSkills = typeof job.requiredSkills === "string" 
          ? JSON.parse(job.requiredSkills) 
          : job.requiredSkills;
        
        const userSkills = new Set(context.profile.skills.map(s => s.toLowerCase()));
        gaps.skills = requiredSkills.filter(
          (s: string) => !userSkills.has(s.toLowerCase())
        );

        if (job.experienceRequired && context.profile.yearsOfExperience) {
          if (context.profile.yearsOfExperience < job.experienceRequired) {
            gaps.experience = {
              required: job.experienceRequired,
              current: context.profile.yearsOfExperience,
              gap: job.experienceRequired - context.profile.yearsOfExperience,
            };
          }
        }
      }
    }

    // Generate recommendations
    if (gaps.skills.length > 0) {
      gaps.recommendations.push(
        `Kehitä näitä taitoja: ${gaps.skills.slice(0, 5).join(", ")}`
      );
    }
    if (gaps.experience) {
      gaps.recommendations.push(
        `Tarvitset ${gaps.experience.gap} vuotta lisää kokemusta. Harkitse projektityötä tai freelance-toimeksiantoja.`
      );
    }

    return {
      currentProfile: {
        skills: context.profile.skills,
        experience: context.profile.yearsOfExperience,
        certifications: context.profile.certifications,
      },
      gaps,
    };
  },
};

// Tool: Get salary insights
export const salaryInsightsTool: AgentTool = {
  name: "salary_insights",
  description: "Get salary insights for specific roles, locations, and experience levels.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Job title to research" },
      location: { type: "string", description: "Location for salary data" },
      experienceYears: { type: "number", description: "Years of experience" },
    },
    required: ["title"],
  },
  execute: async (args, context) => {
    const { getJobs } = await import("../../db");
    const jobs = await getJobs(100, 0);
    
    // Filter relevant jobs
    const titleLower = args.title.toLowerCase();
    const relevant = jobs.filter((j: any) => 
      j.title?.toLowerCase().includes(titleLower) &&
      j.salaryMin && j.salaryMax
    );

    if (relevant.length === 0) {
      return {
        message: "Not enough salary data for this role.",
        suggestion: "Try a broader job title or different location."
      };
    }

    const salaries = relevant.map((j: any) => ({
      min: j.salaryMin,
      max: j.salaryMax,
      avg: (j.salaryMin + j.salaryMax) / 2
    }));

    return {
      title: args.title,
      location: args.location || "Kaikki sijainnit",
      sampleSize: relevant.length,
      salary: {
        min: Math.min(...salaries.map(s => s.min)),
        max: Math.max(...salaries.map(s => s.max)),
        average: Math.round(salaries.reduce((a, s) => a + s.avg, 0) / salaries.length),
        median: salaries.sort((a, b) => a.avg - b.avg)[Math.floor(salaries.length / 2)]?.avg,
      },
      recommendation: context.profile?.yearsOfExperience 
        ? `Kokemuksellasi (${context.profile.yearsOfExperience}v) voit odottaa keskimääräistä ${
            context.profile.yearsOfExperience > 5 ? "korkeampaa" : "palkkaa"
          }.`
        : null,
    };
  },
};

// Tool: Generate interview questions
export const generateQuestionsTool: AgentTool = {
  name: "generate_interview_questions",
  description: "Generate likely interview questions for a specific job or company.",
  parameters: {
    type: "object",
    properties: {
      jobId: { type: "number", description: "Job ID to generate questions for" },
      companyName: { type: "string", description: "Company name" },
      questionType: { 
        type: "string", 
        enum: ["behavioral", "technical", "situational", "all"],
        description: "Type of questions to generate"
      },
    },
    required: [],
  },
  execute: async (args, context) => {
    let jobContext = "";
    let companyContext = "";

    if (args.jobId) {
      const { getJobById } = await import("../../db");
      const job = await getJobById(args.jobId);
      if (job) {
        jobContext = `Role: ${job.title} at ${job.company}. ${job.description || ""}`;
      }
    }

    if (args.companyName) {
      companyContext = `Company: ${args.companyName}`;
    }

    // Return structured data for the agent to use
    return {
      context: {
        job: jobContext,
        company: companyContext,
        userProfile: context.profile ? {
          title: context.profile.currentTitle,
          skills: context.profile.skills,
          experience: context.profile.yearsOfExperience,
        } : null,
      },
      questionTypes: args.questionType || "all",
      note: "The agent should generate personalized questions based on this context.",
    };
  },
};

// ============================================================================
// VÄINÖ (Signal Scout) TOOLS
// ============================================================================

// Tool: Analyze company signals for hiring prediction
export const analyzeCompanySignalsTool: AgentTool = {
  name: "analyze_company_signals",
  description: `Kerää ja analysoi kaikki rekrytointisignaalit yrityksestä.
Signaalit: YTJ (liikevaihto, henkilöstö), uutiset (rahoitus, kasvu, YT), GitHub (aktiviteetti).
Palauttaa: kokonaispistemäärän (0-100), ennusteen ja toimintaohjeet.`,
  parameters: {
    type: "object",
    properties: {
      companyName: { 
        type: "string", 
        description: "Yrityksen nimi (esim. 'Reaktor', 'Futurice')" 
      },
    },
    required: ["companyName"],
  },
  execute: async (args, context) => {
    const companyName = args.companyName;
    
    // Collect signals from multiple sources
    const signals: any = {
      companyName,
      collectedAt: new Date().toISOString(),
      ytj: null,
      news: [],
      github: null,
    };
    
    // 1. Search for news/signals via Serper
    try {
      const SERPER_API_KEY = process.env.SERPER_API_KEY;
      if (SERPER_API_KEY) {
        const newsResponse = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: `"${companyName}" rekrytointi OR rahoitus OR kasvu OR YT-neuvottelut OR laajentuminen 2024 2025`,
            gl: "fi",
            hl: "fi",
            num: 10,
          }),
        });
        
        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          signals.news = (newsData.organic || []).slice(0, 5).map((item: any) => ({
            headline: item.title,
            snippet: item.snippet,
            url: item.link,
            source: new URL(item.link).hostname,
          }));
        }
      }
    } catch (e) {
      console.error("[SignalScout] News fetch error:", e);
    }
    
    // 2. Try to get company from DB
    try {
      const { getCompanyByName, getEventsByCompanyId, getJobsByCompanyId } = await import("../../db");
      const company = await getCompanyByName(companyName);
      if (company) {
        const events = await getEventsByCompanyId(company.id, 10);
        const jobs = await getJobsByCompanyId(company.id, 20);
        signals.dbCompany = {
          name: company.name,
          industry: company.industry,
          events: events.map((e: any) => ({
            type: e.eventType,
            headline: e.headline,
            impact: e.impactStrength,
          })),
          openPositions: jobs.length,
        };
      }
    } catch (e) {
      console.error("[SignalScout] DB lookup error:", e);
    }
    
    // 3. Calculate signal score
    let score = 50; // Base score
    let positiveSignals: string[] = [];
    let negativeSignals: string[] = [];
    
    // Analyze news headlines for signals
    for (const news of signals.news) {
      const headline = (news.headline + " " + news.snippet).toLowerCase();
      
      if (headline.includes("rahoitus") || headline.includes("sijoitus") || headline.includes("miljoon")) {
        score += 20;
        positiveSignals.push("Rahoituskierros/sijoitus havaittu");
      }
      if (headline.includes("kasv") || headline.includes("laajent")) {
        score += 15;
        positiveSignals.push("Kasvusignaali havaittu");
      }
      if (headline.includes("rekrytoi") || headline.includes("palkkaa") || headline.includes("hiring")) {
        score += 25;
        positiveSignals.push("Aktiivinen rekrytointi");
      }
      if (headline.includes("yt-neuvottelu") || headline.includes("irtisano") || headline.includes("lomaut")) {
        score -= 30;
        negativeSignals.push("YT-neuvottelut tai irtisanomiset");
      }
    }
    
    // Cap score
    score = Math.max(0, Math.min(100, score));
    
    // Generate prediction
    let prediction = {
      probability: score,
      confidence: score > 70 ? "high" : score > 40 ? "medium" : "low",
      timing: score > 70 ? "30-60 päivää" : score > 50 ? "60-90 päivää" : "90+ päivää",
      recommendation: "",
    };
    
    if (score >= 70) {
      prediction.recommendation = "Vahvat signaalit! Ota yhteyttä HR:ään tai verkostoidu LinkedInissä NYT.";
    } else if (score >= 50) {
      prediction.recommendation = "Kohtalaisia signaaleja. Seuraa yritystä ja valmistaudu hakemaan.";
    } else {
      prediction.recommendation = "Heikkoja signaaleja. Odota parempia merkkejä tai etsi muita kohteita.";
    }
    
    return {
      company: companyName,
      score,
      confidence: prediction.confidence,
      timing: prediction.timing,
      signals: {
        positive: positiveSignals,
        negative: negativeSignals,
      },
      newsFound: signals.news.length,
      prediction: prediction.recommendation,
      news: signals.news.slice(0, 3),
      dbData: signals.dbCompany || null,
    };
  },
};

// Tool: Search news signals
export const searchNewsSignalsTool: AgentTool = {
  name: "search_news_signals",
  description: `Hae tuoreita uutisia ja lehdistötiedotteita yrityksestä.
Tunnistaa: rahoituskierrokset, laajentuminen, YT-neuvottelut, johtajamuutokset.`,
  parameters: {
    type: "object",
    properties: {
      companyName: { type: "string", description: "Yrityksen nimi" },
      keywords: { 
        type: "array", 
        items: { type: "string" },
        description: "Lisäavainsanat hakuun" 
      },
    },
    required: ["companyName"],
  },
  execute: async (args) => {
    const SERPER_API_KEY = process.env.SERPER_API_KEY;
    if (!SERPER_API_KEY) {
      return { error: "Hakupalvelu ei käytettävissä" };
    }
    
    const keywords = args.keywords?.join(" OR ") || "rekrytointi kasvu rahoitus";
    
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `"${args.companyName}" ${keywords} 2024 2025`,
        gl: "fi",
        hl: "fi",
        num: 10,
      }),
    });
    
    if (!response.ok) {
      return { error: "Haku epäonnistui" };
    }
    
    const data = await response.json();
    const news = (data.organic || []).map((item: any) => {
      // Analyze sentiment
      const text = (item.title + " " + item.snippet).toLowerCase();
      let sentiment = "neutral";
      let signalType = "none";
      
      if (text.includes("rahoitus") || text.includes("kasv") || text.includes("rekrytoi")) {
        sentiment = "positive";
        signalType = text.includes("rahoitus") ? "funding" : text.includes("rekrytoi") ? "hiring" : "growth";
      }
      if (text.includes("yt-") || text.includes("irtisano") || text.includes("lomaut")) {
        sentiment = "negative";
        signalType = "layoffs";
      }
      
      return {
        headline: item.title,
        snippet: item.snippet,
        url: item.link,
        source: new URL(item.link).hostname,
        sentiment,
        signalType,
      };
    });
    
    return {
      company: args.companyName,
      newsCount: news.length,
      news: news.slice(0, 5),
      summary: news.length > 0 
        ? `Löydettiin ${news.length} uutista. ${news.filter((n: any) => n.sentiment === "positive").length} positiivista signaalia.`
        : "Ei tuoreita uutisia löytynyt.",
    };
  },
};

// Tool: Get hiring prediction
export const getHiringPredictionTool: AgentTool = {
  name: "get_hiring_prediction",
  description: `Laske ennuste yrityksen rekrytointitodennäköisyydestä tietylle roolille.`,
  parameters: {
    type: "object",
    properties: {
      companyName: { type: "string", description: "Yrityksen nimi" },
      roleType: { 
        type: "string", 
        description: "Rooli johon ennuste kohdistuu (esim. 'developer', 'sales', 'marketing')" 
      },
    },
    required: ["companyName"],
  },
  execute: async (args, context) => {
    // Use the main signal analysis
    const signalResult = await analyzeCompanySignalsTool.execute(
      { companyName: args.companyName },
      context
    );
    
    // Adjust for role type if specified
    let roleMultiplier = 1.0;
    let roleNote = "";
    
    if (args.roleType) {
      const role = args.roleType.toLowerCase();
      if (role.includes("dev") || role.includes("engineer") || role.includes("tech")) {
        roleMultiplier = 1.1;
        roleNote = "Tech-roolit yleisesti kysyttyjä kasvuyrityksissä.";
      } else if (role.includes("sales") || role.includes("myynti")) {
        roleMultiplier = 1.05;
        roleNote = "Myyntiroolit usein ensimmäisiä kasvurekryissä.";
      }
    }
    
    const adjustedScore = Math.min(100, Math.round(signalResult.score * roleMultiplier));
    
    return {
      company: args.companyName,
      roleType: args.roleType || "yleinen",
      prediction: {
        probability: `${adjustedScore}%`,
        confidence: signalResult.confidence,
        timing: signalResult.timing,
        roleNote,
      },
      keySignals: [
        ...signalResult.signals.positive,
        ...signalResult.signals.negative.map((s: string) => `⚠️ ${s}`),
      ],
      recommendation: signalResult.prediction,
      profileMatch: context.profile ? "Profiilisi huomioitu ennusteessa" : "Täytä profiili tarkempaan ennusteeseen",
    };
  },
};

// ============================================================================
// VÄINÖ ENHANCED TOOLS - YTJ, Twitter, Glassdoor
// ============================================================================

// Tool: Get YTJ/PRH Company Data (Finnish Business Register)
export const getYTJCompanyDataTool: AgentTool = {
  name: "get_ytj_company_data",
  description: `Hae virallinen yritysdata Suomen PRH/YTJ-rekisteristä (Patentti- ja rekisterihallitus).
Palauttaa: Y-tunnus, perustamispäivä, toimiala, kotipaikka, yritysmuoto.
Toimii vain suomalaisille yrityksille.`,
  parameters: {
    type: "object",
    properties: {
      companyName: { 
        type: "string", 
        description: "Yrityksen nimi (esim. 'Reaktor', 'Supercell')" 
      },
      businessId: {
        type: "string",
        description: "Y-tunnus jos tiedossa (esim. '0974698-9')"
      }
    },
    required: ["companyName"],
  },
  execute: async (args) => {
    try {
      const companyName = args.companyName.trim();
      
      // PRH Avoindata API endpoint
      const searchUrl = `https://avoindata.prh.fi/bis/v1?name=${encodeURIComponent(companyName)}&maxResults=5&resultsFrom=0`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'JobScout-Vaino/1.0'
        }
      });
      
      if (!response.ok) {
        return { 
          error: "YTJ-haku epäonnistui",
          message: "Virallisen yritysrekisterin haku ei onnistunut. Yritä uudelleen."
        };
      }
      
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        return {
          error: "Yritystä ei löytynyt",
          message: `Yritystä "${companyName}" ei löydy Suomen yritysrekisteristä. Tarkista kirjoitusasu tai kokeile Y-tunnusta.`
        };
      }
      
      // Ota ensimmäinen tulos (paras osuma)
      const company = data.results[0];
      
      // Parsitaan olennaiset tiedot
      const result: any = {
        source: "PRH/YTJ Avoindata",
        businessId: company.businessId || null,
        name: company.name || companyName,
        registrationDate: company.registrationDate || null,
        companyForm: company.companyForm || null,
        detailsUri: company.detailsUri || null,
      };
      
      // Hae lisätiedot jos detailsUri saatavilla
      if (company.detailsUri) {
        try {
          const detailsResponse = await fetch(company.detailsUri, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'JobScout-Vaino/1.0'
            }
          });
          
          if (detailsResponse.ok) {
            const details = await detailsResponse.json();
            
            // Kotipaikka
            if (details.addresses) {
              const registeredAddress = details.addresses.find((a: any) => a.careOf === null);
              if (registeredAddress) {
                result.city = registeredAddress.city || null;
                result.postCode = registeredAddress.postCode || null;
              }
            }
            
            // Toimialat
            if (details.businessLines) {
              result.businessLines = details.businessLines
                .map((bl: any) => bl.name)
                .filter(Boolean)
                .slice(0, 3);
            }
            
            // Yrityksen tila
            if (details.registeredEntries) {
              const statusEntry = details.registeredEntries.find((e: any) => 
                e.description && e.description.includes('toimintaa')
              );
              if (statusEntry) {
                result.status = statusEntry.description;
              }
            }
            
            // Rekisteröinnit
            if (details.registeredOffices) {
              result.registeredOffice = details.registeredOffices[0]?.name || null;
            }
          }
        } catch (detailsError) {
          console.error("[YTJ] Details fetch failed:", detailsError);
        }
      }
      
      // Analysoi signaalit
      const signals: string[] = [];
      
      // Perustamisvuosi
      if (result.registrationDate) {
        const year = new Date(result.registrationDate).getFullYear();
        const age = new Date().getFullYear() - year;
        if (age < 5) {
          signals.push(`Nuori yritys (perustettu ${year}) - startup-rekrytointi todennäköistä`);
        } else if (age > 20) {
          signals.push(`Vakiintunut yritys (perustettu ${year}) - vakaita rekrytointeja`);
        }
      }
      
      // Yritysmuoto
      if (result.companyForm) {
        if (result.companyForm.includes('Osakeyhtiö')) {
          signals.push('Osakeyhtiö - mahdollisuus rahoituskierroksiin');
        }
      }
      
      return {
        success: true,
        company: result,
        signals,
        note: "YTJ-data on virallista ja luotettavaa. Käytä tätä perustana muille analyyseille."
      };
      
    } catch (error) {
      console.error("[YTJ] API Error:", error);
      return {
        error: "YTJ API virhe",
        message: "Yritysrekisterihaku epäonnistui teknisen virheen takia."
      };
    }
  },
};

// Tool: Search Twitter Signals
export const searchTwitterSignalsTool: AgentTool = {
  name: "search_twitter_signals",
  description: `Hae Twitter/X-viestejä yrityksestä Googlen kautta (Serper API).
Tunnistaa: rekrytointi-ilmoituksia, yrityskulttuuripäivityksiä, kasvusignaaleja.
Sentimenttianalyysi viestien sävystä.`,
  parameters: {
    type: "object",
    properties: {
      companyName: { 
        type: "string", 
        description: "Yrityksen nimi tai Twitter-handle" 
      },
      daysBack: {
        type: "number",
        description: "Montako päivää taaksepäin haetaan (oletus: 30)"
      }
    },
    required: ["companyName"],
  },
  execute: async (args) => {
    const SERPER_API_KEY = process.env.SERPER_API_KEY;
    if (!SERPER_API_KEY) {
      return { error: "SERPER_API_KEY puuttuu ympäristömuuttujista" };
    }
    
    const companyName = args.companyName.trim();
    const daysBack = args.daysBack || 30;
    
    const query = `site:twitter.com OR site:x.com "${companyName}" (rekrytointi OR hiring OR "we're hiring" OR palkkaa OR työpaikka)`;
    
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          gl: "fi",
          hl: "fi",
          num: 10,
          tbs: `qdr:d${daysBack}`
        }),
      });
      
      if (!response.ok) {
        return { error: "Twitter-haku epäonnistui" };
      }
      
      const data = await response.json();
      const results = data.organic || [];
      
      const tweets = results.map((item: any) => {
        const text = `${item.title} ${item.snippet}`.toLowerCase();
        
        let sentiment: "positive" | "negative" | "neutral" = "neutral";
        let signalType = "none";
        let signalStrength = 0;
        
        // Rekrytointisignaalit
        if (text.includes("we're hiring") || text.includes("join us") || text.includes("looking for") ||
            text.includes("rekrytointi") || text.includes("avoimia paikkoja") || text.includes("haku käynnissä")) {
          sentiment = "positive";
          signalType = "hiring";
          signalStrength = 3;
        }
        
        // Kasvusignaalit
        if (text.includes("kasvamme") || text.includes("expanding") || text.includes("new office")) {
          sentiment = "positive";
          signalType = "growth";
          signalStrength = 2;
        }
        
        // Negatiiviset signaalit
        if (text.includes("layoff") || text.includes("irtisano") || text.includes("yt-neuvottelu")) {
          sentiment = "negative";
          signalType = "layoffs";
          signalStrength = -3;
        }
        
        return {
          title: item.title,
          snippet: item.snippet,
          url: item.link,
          sentiment,
          signalType,
          signalStrength,
        };
      });
      
      const totalSignalStrength = tweets.reduce((sum: number, t: any) => sum + t.signalStrength, 0);
      const hiringTweets = tweets.filter((t: any) => t.signalType === "hiring");
      const growthTweets = tweets.filter((t: any) => t.signalType === "growth");
      const negativeTweets = tweets.filter((t: any) => t.sentiment === "negative");
      
      return {
        success: true,
        companyName,
        period: `Viimeiset ${daysBack} päivää`,
        totalTweets: tweets.length,
        analysis: {
          hiringSignals: hiringTweets.length,
          growthSignals: growthTweets.length,
          negativeSignals: negativeTweets.length,
          overallSignalStrength: totalSignalStrength,
          sentiment: totalSignalStrength > 2 ? "positive" : totalSignalStrength < -2 ? "negative" : "neutral"
        },
        tweets: tweets.slice(0, 5),
        summary: `Löydettiin ${tweets.length} Twitter-mainintaa. ${hiringTweets.length} rekrytointisignaalia, ${growthTweets.length} kasvusignaalia.`
      };
      
    } catch (error) {
      console.error("[Twitter] Search error:", error);
      return {
        error: "Twitter-haku epäonnistui",
        message: "Tekninen virhe hakiessa Twitter-viestejä."
      };
    }
  },
};

// Tool: Search Glassdoor Reviews
export const searchGlassdoorReviewsTool: AgentTool = {
  name: "search_glassdoor_reviews",
  description: `Hae Glassdoor-työntekijäarvosteluja yrityksestä Googlen kautta (Serper API).
Analysoi: työntekijätyytyväisyyttä, rekrytointitrendi, yrityskulttuurisignaaleja.`,
  parameters: {
    type: "object",
    properties: {
      companyName: { 
        type: "string", 
        description: "Yrityksen nimi" 
      }
    },
    required: ["companyName"],
  },
  execute: async (args) => {
    const SERPER_API_KEY = process.env.SERPER_API_KEY;
    if (!SERPER_API_KEY) {
      return { error: "SERPER_API_KEY puuttuu ympäristömuuttujista" };
    }
    
    const companyName = args.companyName.trim();
    
    const queries = [
      `site:glassdoor.com "${companyName}" reviews`,
      `site:glassdoor.fi "${companyName}" arvostelut`,
    ];
    
    try {
      const results = await Promise.all(
        queries.map(async (q) => {
          const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
              "X-API-KEY": SERPER_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ q, num: 5 }),
          });
          
          if (!response.ok) return [];
          const data = await response.json();
          return data.organic || [];
        })
      );
      
      const allResults = results.flat();
      
      if (allResults.length === 0) {
        return {
          success: false,
          message: `Ei löydetty Glassdoor-arvosteluja yrityksestä "${companyName}".`
        };
      }
      
      const reviews = allResults.map((item: any) => {
        const text = `${item.title} ${item.snippet}`.toLowerCase();
        
        const ratingMatch = text.match(/(\d\.\d)\s*(?:out of|\/)\s*5/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
        
        const positiveKeywords = ["great place", "love working", "amazing culture", "highly recommend", "excellent"];
        const negativeKeywords = ["toxic", "poor management", "avoid", "layoffs", "overworked"];
        
        const hasPositive = positiveKeywords.some(kw => text.includes(kw));
        const hasNegative = negativeKeywords.some(kw => text.includes(kw));
        
        return {
          title: item.title,
          snippet: item.snippet,
          url: item.link,
          rating,
          sentiment: hasPositive ? "positive" : hasNegative ? "negative" : "neutral"
        };
      });
      
      const ratingsFound = reviews.filter((r: any) => r.rating !== null);
      const avgRating = ratingsFound.length > 0
        ? (ratingsFound.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / ratingsFound.length).toFixed(1)
        : null;
      
      const positiveCount = reviews.filter((r: any) => r.sentiment === "positive").length;
      const negativeCount = reviews.filter((r: any) => r.sentiment === "negative").length;
      
      return {
        success: true,
        companyName,
        glassdoorData: {
          reviewsFound: reviews.length,
          averageRating: avgRating,
          sentiment: {
            positive: positiveCount,
            negative: negativeCount,
            neutral: reviews.length - positiveCount - negativeCount
          }
        },
        reviews: reviews.slice(0, 3),
        analysis: avgRating 
          ? `Keskiarvo ${avgRating}/5.0 - ${parseFloat(avgRating) >= 4.0 ? "Hyvä työnantaja" : parseFloat(avgRating) >= 3.0 ? "Keskiverto työnantaja" : "Heikko työnantaja"}`
          : "Ei riittävästi dataa arvion antamiseen",
        signal: avgRating
          ? parseFloat(avgRating) >= 4.0 ? "Positiivinen signaali - hyvä työpaikka" : parseFloat(avgRating) < 3.0 ? "Negatiivinen signaali - työntekijäongelmat" : "Neutraali signaali"
          : null
      };
      
    } catch (error) {
      console.error("[Glassdoor] Search error:", error);
      return {
        error: "Glassdoor-haku epäonnistui",
        message: "Tekninen virhe hakiessa Glassdoor-arvosteluja."
      };
    }
  },
};

// Tool: Analyze Company Signals V2 (Enhanced - all sources)
export const analyzeCompanySignalsV2Tool: AgentTool = {
  name: "analyze_company_signals_v2",
  description: `PARANNETTU VERSIO - Kerää ja analysoi KAIKKI rekrytointisignaalit yrityksestä.
Signaalit: YTJ (virallinen data), Uutiset, Twitter, Glassdoor.
Palauttaa: kokonaispistemäärän (0-100), ennusteen ja toimintaohjeet.
KÄYTÄ TÄTÄ ensisijaisesti!`,
  parameters: {
    type: "object",
    properties: {
      companyName: { 
        type: "string", 
        description: "Yrityksen nimi (esim. 'Reaktor', 'Futurice')" 
      },
    },
    required: ["companyName"],
  },
  execute: async (args, context) => {
    const companyName = args.companyName;
    
    console.log(`[SignalScout V2] Analyzing ${companyName}...`);
    
    // Kerää signaalit rinnakkain kaikista lähteistä
    const [ytjData, newsData, twitterData, glassdoorData] = await Promise.all([
      getYTJCompanyDataTool.execute({ companyName }, context).catch(e => {
        console.error("[SignalScout V2] YTJ failed:", e);
        return null;
      }),
      searchNewsSignalsTool.execute({ companyName }, context).catch(e => {
        console.error("[SignalScout V2] News failed:", e);
        return null;
      }),
      searchTwitterSignalsTool.execute({ companyName, daysBack: 30 }, context).catch(e => {
        console.error("[SignalScout V2] Twitter failed:", e);
        return null;
      }),
      searchGlassdoorReviewsTool.execute({ companyName }, context).catch(e => {
        console.error("[SignalScout V2] Glassdoor failed:", e);
        return null;
      }),
    ]);
    
    // Laske kokonaispistemäärä
    let score = 50;
    const signals: string[] = [];
    const dataSources: string[] = [];
    
    // YTJ-SIGNAALIT
    if (ytjData && ytjData.success) {
      dataSources.push("YTJ Virallinen rekisteri");
      if (ytjData.signals) {
        signals.push(...ytjData.signals);
      }
      if (ytjData.company?.registrationDate) {
        const age = new Date().getFullYear() - new Date(ytjData.company.registrationDate).getFullYear();
        if (age < 5) score += 10;
      }
    }
    
    // UUTIS-SIGNAALIT
    if (newsData && newsData.newsCount > 0) {
      dataSources.push("Uutiset & Lehdistötiedotteet");
      const news = newsData.news || [];
      for (const article of news) {
        if (article.sentiment === "positive") {
          score += 5;
          if (article.signalType === "funding") {
            score += 15;
            signals.push(`💰 Rahoituskierros havaittu - vahva rekrytointisignaali`);
          } else if (article.signalType === "hiring") {
            score += 20;
            signals.push(`📢 Aktiivinen rekrytointi-ilmoitus uutisissa`);
          } else if (article.signalType === "growth") {
            score += 10;
            signals.push(`📈 Kasvusignaali uutisissa`);
          }
        } else if (article.sentiment === "negative") {
          score -= 15;
          if (article.signalType === "layoffs") {
            score -= 20;
            signals.push(`⚠️ YT-neuvottelut tai irtisanomiset - EI rekrytoi`);
          }
        }
      }
    }
    
    // TWITTER-SIGNAALIT
    if (twitterData && twitterData.success) {
      dataSources.push("Twitter/X");
      const analysis = twitterData.analysis || {};
      if (analysis.hiringSignals > 0) {
        score += analysis.hiringSignals * 5;
        signals.push(`🐦 ${analysis.hiringSignals} rekrytointi-twiittiä havaittu`);
      }
      if (analysis.growthSignals > 0) {
        score += analysis.growthSignals * 3;
      }
      if (analysis.negativeSignals > 0) {
        score -= analysis.negativeSignals * 5;
      }
    }
    
    // GLASSDOOR-SIGNAALIT
    if (glassdoorData && glassdoorData.success) {
      dataSources.push("Glassdoor Arvostelut");
      const rating = glassdoorData.glassdoorData?.averageRating;
      if (rating) {
        const ratingNum = parseFloat(rating);
        if (ratingNum >= 4.0) {
          score += 10;
          signals.push(`⭐ Glassdoor ${rating}/5.0 - hyvä työnantaja`);
        } else if (ratingNum < 3.0) {
          score -= 10;
          signals.push(`⚠️ Glassdoor ${rating}/5.0 - työntekijäongelmat`);
        }
      }
    }
    
    // Rajoita pistemäärä 0-100
    score = Math.max(0, Math.min(100, score));
    
    // Määritä luotettavuus
    const confidence = dataSources.length >= 3 ? "high" : dataSources.length >= 2 ? "medium" : "low";
    
    // Määritä ajoitus
    let timing = "90+ päivää";
    if (score >= 75) timing = "30-60 päivää";
    else if (score >= 60) timing = "60-90 päivää";
    
    // Suositus
    let recommendation = "";
    if (score >= 75) {
      recommendation = "🔥 VAHVAT SIGNAALIT! Ota yhteyttä HR:ään tai verkostoidu LinkedInissä NYT. Yritys todennäköisesti rekrytoi pian.";
    } else if (score >= 60) {
      recommendation = "📊 Kohtalaiset signaalit. Seuraa yritystä aktiivisesti ja valmistaudu hakemaan lähiviikkoina.";
    } else if (score >= 40) {
      recommendation = "⏳ Heikot signaalit. Pidä yritys watchlistilla mutta etsi vahvempia kohteita.";
    } else {
      recommendation = "❌ Ei rekrytointisignaaleja. Yritys ei todennäköisesti rekrytoi lähiaikoina.";
    }
    
    const result = {
      company: companyName,
      timestamp: new Date().toISOString(),
      score,
      confidence,
      timing,
      dataSources,
      signals: signals.slice(0, 10),
      recommendation,
      rawData: {
        ytj: ytjData?.success ? ytjData.company : null,
        newsCount: newsData?.newsCount || 0,
        twitterCount: twitterData?.totalTweets || 0,
        glassdoorRating: glassdoorData?.glassdoorData?.averageRating || null,
      },
      note: `Analyysi perustuu ${dataSources.length} datalähteeseen. ${confidence === "high" ? "Korkea" : confidence === "medium" ? "Keskitason" : "Matala"} luotettavuus.`
    };

    // === MESSAGE BUS INTEGRATION ===
    // Get runId from context metadata (set by orchestrator)
    const runId = (context as any)._runId || `adhoc_${Date.now()}`;

    // Update SharedKnowledge with company data
    SharedKnowledge.setCompanyKnowledge(runId, companyName, {
      name: companyName,
      businessId: ytjData?.company?.businessId,
      industry: ytjData?.company?.businessLines?.[0],
      signalScore: score,
      signalConfidence: confidence,
      signalTiming: timing,
      signals: signals.slice(0, 10),
      glassdoorRating: glassdoorData?.glassdoorData?.averageRating
        ? parseFloat(glassdoorData.glassdoorData.averageRating)
        : undefined,
      ytjData: ytjData?.company,
      newsItems: (newsData?.news || []).map((n: any) => ({
        headline: n.headline,
        sentiment: n.sentiment,
        signalType: n.signalType,
        url: n.url,
      })),
      twitterSignals: twitterData?.analysis?.hiringSignals || 0,
    }, "signal_scout");

    // Publish signal to message bus
    const signalPayload: SignalPayload = {
      companyName,
      score,
      confidence,
      signals: signals.slice(0, 5),
      timing,
      recommendation,
    };

    AgentMessenger.publishSignal(runId, signalPayload);

    // If strong signal (score >= 75), add recommendations for other agents
    if (score >= 75) {
      SharedKnowledge.addRecommendation(
        runId,
        "signal_scout",
        "interview_prep",
        `Vahva signaali ${companyName} - valmistaudu haastatteluun!`,
        8
      );
      SharedKnowledge.addRecommendation(
        runId,
        "signal_scout",
        "negotiation",
        `${companyName} rekrytoi aktiivisesti - neuvotteluasema vahva`,
        7
      );
    }

    console.log(`[SignalScout V2] Published signal for ${companyName}: score=${score}, confidence=${confidence}`);

    return result;
  },
};

// ============================================================================
// AGENT COLLABORATION TOOLS - Agenttien yhteistyö (MESSAGE BUS ENABLED)
// ============================================================================

// Tool: Request help from Career Coach
export const requestCareerCoachTool: AgentTool = {
  name: "request_career_coach",
  description: `Pyydä apua Career Coach -agentilta. Käytä kun:
- Käyttäjä tarvitsee uraohjausta tai neuvoja
- Haluat analysoida käyttäjän profiilin sopivuutta
- Käyttäjä kysyy CV:stä tai profiilista
Palauttaa Career Coachin analyysin ja suositukset.`,
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "Kysymys tai pyyntö Career Coachille"
      },
      context: {
        type: "string",
        description: "Lisäkonteksti (esim. yritys jota analysoidaan)"
      }
    },
    required: ["question"],
  },
  execute: async (args, userContext) => {
    const profile = userContext?.profile;
    const runId = (userContext as any)._runId || `adhoc_${Date.now()}`;

    // Publish request to message bus
    AgentMessenger.publish({
      type: "request_analysis",
      sourceAgent: "signal_scout",
      targetAgent: "career_coach",
      payload: {
        requestId: `req_${Date.now()}`,
        question: args.question,
        context: args.context,
        waitForResponse: false, // Async for now
      },
      runId,
      priority: "normal",
    });

    // Add insight to shared knowledge
    SharedKnowledge.addUserInsight(runId, {
      type: "career",
      content: `Käyttäjä kysyi uraohjausta: "${args.question}"`,
      sourceAgent: "signal_scout",
      confidence: 0.8,
    });

    // Generate response based on profile and shared knowledge
    const companyKnowledge = SharedKnowledge.getRun(runId)?.companies;
    const recentCompanies = companyKnowledge ? Array.from(companyKnowledge.values()).slice(0, 3) : [];

    const response = {
      agent: "Career Coach",
      response: `Career Coach analysoi tilanteen:

Käyttäjän profiili: ${profile?.currentTitle || 'Ei määritelty'}
Kokemus: ${profile?.yearsOfExperience || 'Ei tiedossa'} vuotta
Taidot: ${profile?.skills?.slice(0, 5).join(', ') || 'Ei määritelty'}

Kysymys: "${args.question}"

${recentCompanies.length > 0 ? `📊 Analysoidut yritykset tässä keskustelussa:
${recentCompanies.map(c => `- ${c.name}: ${c.signalScore || '?'}% signaali`).join('\n')}` : ''}

Suositus: Perustuen profiiliisi, suosittelen keskittymään vahvuuksiisi ja verkostoitumiseen.
${args.context ? `Konteksti "${args.context}" huomioiden, tämä voisi olla hyvä tilaisuus sinulle.` : ''}`,
      actionItems: [
        "Päivitä LinkedIn-profiilisi",
        "Valmistele hissipuhe",
        "Verkostoidu alan ammattilaisiin",
        ...(recentCompanies.filter(c => (c.signalScore || 0) >= 70).map(c =>
          `Hae ${c.name}:lle - vahva signaali (${c.signalScore}%)`
        ))
      ],
      sharedContext: {
        companiesAnalyzed: recentCompanies.length,
        strongSignals: recentCompanies.filter(c => (c.signalScore || 0) >= 70).length,
      }
    };

    console.log(`[Career Coach] Processed request from signal_scout, runId=${runId}`);

    return response;
  },
};

// Tool: Request help from Negotiator
export const requestNegotiatorTool: AgentTool = {
  name: "request_negotiator",
  description: `Pyydä apua Negotiator-agentilta. Käytä kun:
- Käyttäjä kysyy palkasta tai neuvottelusta
- Vahva rekrytointisignaali → neuvottelu voi olla aggressiivisempi
- Käyttäjä haluaa tietää markkinapalkat
Palauttaa neuvottelustrategian ja palkka-arvion.`,
  parameters: {
    type: "object",
    properties: {
      companyName: {
        type: "string",
        description: "Yrityksen nimi"
      },
      roleType: {
        type: "string",
        description: "Rooli (esim. 'senior developer', 'marketing manager')"
      },
      signalStrength: {
        type: "number",
        description: "Rekrytointisignaalin vahvuus 0-100"
      }
    },
    required: ["companyName"],
  },
  execute: async (args, userContext) => {
    const profile = userContext?.profile;
    const runId = (userContext as any)._runId || `adhoc_${Date.now()}`;

    // Check SharedKnowledge for company signal data
    const companyKnowledge = SharedKnowledge.getCompanyKnowledge(runId, args.companyName);
    const signalStrength = args.signalStrength || companyKnowledge?.signalScore || 50;

    // Publish request to message bus
    AgentMessenger.publish({
      type: "request_analysis",
      sourceAgent: "signal_scout",
      targetAgent: "negotiator",
      payload: {
        requestId: `req_${Date.now()}`,
        companyName: args.companyName,
        roleType: args.roleType,
        signalStrength,
      },
      runId,
      priority: signalStrength >= 70 ? "high" : "normal",
    });

    // Neuvottelustrategia perustuen signaalin vahvuuteen
    let strategy = "";
    let salaryAdvice = "";

    if (signalStrength >= 75) {
      strategy = "VAHVA NEUVOTTELUASEMA! Yritys todennäköisesti rekrytoi aktiivisesti - voit neuvotella aggressiivisemmin.";
      salaryAdvice = "Pyydä 10-20% markkinahintaa korkeampaa palkkaa.";
    } else if (signalStrength >= 50) {
      strategy = "Kohtuullinen neuvotteluasema. Yritys harkitsee rekrytointia - pysy kohtuullisena mutta älä alihinnoittele.";
      salaryAdvice = "Pyydä markkinahintaa vastaavaa palkkaa.";
    } else {
      strategy = "Varovainen lähestymistapa. Signaalit ovat heikot - keskity osoittamaan arvosi ennen palkkaneuvottelua.";
      salaryAdvice = "Hyväksy aluksi markkinahinta ja neuvottele myöhemmin.";
    }

    // Add recommendation to shared knowledge
    SharedKnowledge.addRecommendation(
      runId,
      "negotiator",
      "salary",
      `${args.companyName}: ${salaryAdvice}`,
      signalStrength >= 70 ? 8 : 5
    );

    const response = {
      agent: "Negotiator",
      company: args.companyName,
      role: args.roleType || "Yleinen",
      signalStrength,
      signalSource: companyKnowledge ? "SharedKnowledge (Väinön analyysi)" : "Parametri",
      strategy,
      salaryAdvice,
      tips: [
        "Tutki yrityksen taloustilanne ennen neuvottelua",
        "Valmistele konkreettisia esimerkkejä saavutuksistasi",
        "Älä paljasta nykyistä palkkaasi ensimmäisenä",
        signalStrength >= 75 ? "Mainitse muut tarjoukset (jos on)" : "Osoita kiinnostuksesi yritykseen"
      ],
      companyContext: companyKnowledge ? {
        signals: companyKnowledge.signals.slice(0, 3),
        glassdoorRating: companyKnowledge.glassdoorRating,
        timing: companyKnowledge.signalTiming,
      } : null
    };

    console.log(`[Negotiator] Processed request for ${args.companyName}, signal=${signalStrength}%`);

    return response;
  },
};

// Tool: Request Interview Prep
export const requestInterviewPrepTool: AgentTool = {
  name: "request_interview_prep",
  description: `Pyydä apua Interview Prep -agentilta. Käytä kun:
- Käyttäjä haluaa valmistautua haastatteluun
- Vahva signaali → haastattelukutsu todennäköinen pian
- Käyttäjä kysyy haastattelukysymyksistä
Palauttaa haastatteluvalmistelusuunnitelman.`,
  parameters: {
    type: "object",
    properties: {
      companyName: {
        type: "string",
        description: "Yrityksen nimi"
      },
      roleType: {
        type: "string",
        description: "Rooli johon haetaan"
      },
      urgency: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Kiireellisyys (perustuen signaalin vahvuuteen)"
      }
    },
    required: ["companyName"],
  },
  execute: async (args, userContext) => {
    const runId = (userContext as any)._runId || `adhoc_${Date.now()}`;

    // Check SharedKnowledge for company data
    const companyKnowledge = SharedKnowledge.getCompanyKnowledge(runId, args.companyName);

    // Determine urgency from signal strength if not provided
    let urgency = args.urgency;
    if (!urgency && companyKnowledge?.signalScore) {
      if (companyKnowledge.signalScore >= 75) urgency = "high";
      else if (companyKnowledge.signalScore >= 50) urgency = "medium";
      else urgency = "low";
    }
    urgency = urgency || "medium";

    // Publish request to message bus
    AgentMessenger.publish({
      type: "request_analysis",
      sourceAgent: "signal_scout",
      targetAgent: "interview_prep",
      payload: {
        requestId: `req_${Date.now()}`,
        companyName: args.companyName,
        roleType: args.roleType,
        urgency,
        signalScore: companyKnowledge?.signalScore,
      },
      runId,
      priority: urgency === "high" ? "high" : "normal",
    });

    // Build company-specific questions based on shared knowledge
    const companySpecific = [
      `Tutki ${args.companyName}:n viimeisimmät uutiset`,
      `Selvitä ${args.companyName}:n kilpailijat`,
      `Ymmärrä ${args.companyName}:n liiketoimintamalli`
    ];

    // Add news-based questions if available
    if (companyKnowledge?.newsItems && companyKnowledge.newsItems.length > 0) {
      const recentNews = companyKnowledge.newsItems[0];
      companySpecific.push(`Valmistaudu keskustelemaan: "${recentNews.headline}"`);
    }

    // Add Glassdoor-based insight
    if (companyKnowledge?.glassdoorRating) {
      if (companyKnowledge.glassdoorRating >= 4.0) {
        companySpecific.push("Glassdoor arvosana hyvä - mainitse miksi arvostat yrityksen kulttuuria");
      } else if (companyKnowledge.glassdoorRating < 3.5) {
        companySpecific.push("Huom: Glassdoor arvosanat alhaiset - valmistaudu kysymyksiin yrityskulttuurista");
      }
    }

    // Add recommendation to shared knowledge
    SharedKnowledge.addRecommendation(
      runId,
      "interview_prep",
      "preparation",
      `Valmistaudu haastatteluun ${args.companyName} - ${urgency === "high" ? "KIIREELLINEN" : "normaali aikataulu"}`,
      urgency === "high" ? 9 : 6
    );

    const response = {
      agent: "Interview Prep",
      company: args.companyName,
      role: args.roleType || "Yleinen",
      urgency,
      urgencySource: companyKnowledge ? `Perustuu Väinön analyysiin (${companyKnowledge.signalScore}%)` : "Oletus",
      prepPlan: {
        timeline: urgency === "high" ? "1-2 viikkoa" : urgency === "medium" ? "2-4 viikkoa" : "1-2 kuukautta",
        focusAreas: [
          "Tutustu yrityksen historiaan ja arvoihin",
          "Valmistele STAR-tarinat kokemuksistasi",
          "Tutki yrityksen tuotteet/palvelut",
          "Harjoittele yleisiä haastattelukysymyksiä"
        ],
        companySpecific,
        questions: [
          "Kerro itsestäsi ja miksi haet tätä roolia?",
          `Miksi haluat työskennellä ${args.companyName}:ssa?`,
          "Kerro tilanteesta jossa ratkaisit vaikean ongelman?",
          "Missä näet itsesi 5 vuoden päästä?"
        ]
      },
      companyContext: companyKnowledge ? {
        signalScore: companyKnowledge.signalScore,
        timing: companyKnowledge.signalTiming,
        signals: companyKnowledge.signals.slice(0, 3),
        glassdoorRating: companyKnowledge.glassdoorRating,
      } : null,
      tip: urgency === "high"
        ? "🔥 Aloita valmistautuminen NYT - haastattelukutsu voi tulla pian!"
        : "Hyvä ajankohta aloittaa perusteellinen valmistautuminen."
    };

    console.log(`[Interview Prep] Processed request for ${args.companyName}, urgency=${urgency}`);

    return response;
  },
};

// Export all tools
export const ALL_TOOLS: AgentTool[] = [
  searchJobsTool,
  analyzeJobTool,
  compareJobsTool,
  analyzeCompanyTool,
  profileGapsTool,
  salaryInsightsTool,
  generateQuestionsTool,
  analyzeCompanySignalsTool,
  searchNewsSignalsTool,
  getHiringPredictionTool,
  // Väinö Enhanced tools
  getYTJCompanyDataTool,
  searchTwitterSignalsTool,
  searchGlassdoorReviewsTool,
  analyzeCompanySignalsV2Tool,
  // Agent collaboration tools
  requestCareerCoachTool,
  requestNegotiatorTool,
  requestInterviewPrepTool,
];

// Tool registry by agent type
export const AGENT_TOOLS: Record<string, AgentTool[]> = {
  career_coach: [profileGapsTool, searchJobsTool, salaryInsightsTool],
  job_analyzer: [analyzeJobTool, compareJobsTool, searchJobsTool, profileGapsTool],
  company_intel: [analyzeCompanyTool, searchJobsTool, getYTJCompanyDataTool],
  interview_prep: [generateQuestionsTool, analyzeJobTool, analyzeCompanyTool],
  negotiator: [salaryInsightsTool, analyzeJobTool, analyzeCompanyTool],
  signal_scout: [
    analyzeCompanySignalsV2Tool,
    getYTJCompanyDataTool,
    searchNewsSignalsTool,
    searchTwitterSignalsTool,
    searchGlassdoorReviewsTool,
    getHiringPredictionTool,
    analyzeCompanyTool,
    // Agent collaboration - Väinö can call other agents
    requestCareerCoachTool,
    requestNegotiatorTool,
    requestInterviewPrepTool,
  ],
};

export function getToolsForAgent(agentType: string): AgentTool[] {
  return AGENT_TOOLS[agentType] || ALL_TOOLS;
}

export function formatToolsForOpenAI(tools: AgentTool[]): any[] {
  return tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
