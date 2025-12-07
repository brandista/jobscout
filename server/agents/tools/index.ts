/**
 * JobScout Agent System - Tools
 * Tools that agents can use to fetch data and perform actions
 */

import type { AgentTool, UserContext } from "../types";

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
];

// Tool registry by agent type
export const AGENT_TOOLS: Record<string, AgentTool[]> = {
  career_coach: [profileGapsTool, searchJobsTool, salaryInsightsTool],
  job_analyzer: [analyzeJobTool, compareJobsTool, searchJobsTool, profileGapsTool],
  company_intel: [analyzeCompanyTool, searchJobsTool],
  interview_prep: [generateQuestionsTool, analyzeJobTool, analyzeCompanyTool],
  negotiator: [salaryInsightsTool, analyzeJobTool, analyzeCompanyTool],
  signal_scout: [analyzeCompanySignalsTool, searchNewsSignalsTool, getHiringPredictionTool, analyzeCompanyTool],
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
