import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  
  // ============== AUTH ==============
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============== PROFILE ==============
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { getProfileByUserId } = await import("./db");
      return await getProfileByUserId(ctx.user.id);
    }),
    upsert: protectedProcedure
      .input(z.object({
        currentTitle: z.string().optional(),
        yearsOfExperience: z.number().optional(),
        skills: z.array(z.string()).optional(),
        languages: z.array(z.string()).optional(),
        certifications: z.array(z.string()).optional(),
        degree: z.string().optional(),
        field: z.string().optional(),
        university: z.string().optional(),
        graduationYear: z.number().optional(),
        preferredJobTitles: z.array(z.string()).optional(),
        preferredIndustries: z.array(z.string()).optional(),
        preferredLocations: z.array(z.string()).optional(),
        employmentTypes: z.array(z.string()).optional(),
        salaryMin: z.number().optional(),
        salaryMax: z.number().optional(),
        remotePreference: z.string().optional(),
        workHistory: z.array(z.object({
          company: z.string(),
          title: z.string(),
          duration: z.string(),
          description: z.string(),
        })).optional(),
        targetFunctions: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { upsertProfile } = await import("./db");
        await upsertProfile({
          userId: ctx.user.id,
          currentTitle: input.currentTitle,
          yearsOfExperience: input.yearsOfExperience,
          skills: input.skills ? JSON.stringify(input.skills) : undefined,
          languages: input.languages ? JSON.stringify(input.languages) : undefined,
          certifications: input.certifications ? JSON.stringify(input.certifications) : undefined,
          degree: input.degree,
          field: input.field,
          university: input.university,
          graduationYear: input.graduationYear,
          preferredJobTitles: input.preferredJobTitles ? JSON.stringify(input.preferredJobTitles) : undefined,
          preferredIndustries: input.preferredIndustries ? JSON.stringify(input.preferredIndustries) : undefined,
          preferredLocations: input.preferredLocations ? JSON.stringify(input.preferredLocations) : undefined,
          employmentTypes: input.employmentTypes ? JSON.stringify(input.employmentTypes) : undefined,
          salaryMin: input.salaryMin,
          salaryMax: input.salaryMax,
          remotePreference: input.remotePreference,
          workHistory: input.workHistory ? JSON.stringify(input.workHistory) : undefined,
          targetFunctions: input.targetFunctions ? JSON.stringify(input.targetFunctions) : undefined,
        });
        return { success: true };
      }),

    // CV Parsing endpoint
    parseCV: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
        fileName: z.string(),
        fileType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const OpenAI = (await import("openai")).default;
        const pdfParse = (await import("pdf-parse")).default;
        const mammoth = (await import("mammoth")).default;
        
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        // Decode base64 file
        const base64Data = input.fileBase64.split(',')[1] || input.fileBase64;
        const buffer = Buffer.from(base64Data, 'base64');
        
        let textContent = '';
        
        // Parse based on file type
        if (input.fileType === 'application/pdf') {
          const pdfData = await pdfParse(buffer);
          textContent = pdfData.text;
        } else if (input.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const result = await mammoth.extractRawText({ buffer });
          textContent = result.value;
        } else {
          textContent = buffer.toString('utf-8');
        }
        
        // Use OpenAI to extract structured data
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Extract structured profile data from this CV/resume. Return JSON only with these fields:
              {
                "currentTitle": "string or null",
                "yearsOfExperience": "number or null",
                "skills": ["skill1", "skill2"],
                "languages": ["language1", "language2"],
                "certifications": ["cert1"],
                "degree": "string or null",
                "field": "string or null",
                "university": "string or null",
                "graduationYear": "number or null",
                "workHistory": [{"company": "string", "title": "string", "duration": "string", "description": "string"}]
              }`
            },
            { role: "user", content: textContent.slice(0, 10000) }
          ],
          response_format: { type: "json_object" },
        });
        
        const parsed = JSON.parse(completion.choices[0].message.content || '{}');
        return parsed;
      }),

    // Profile image upload
    uploadImage: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { upsertProfile } = await import("./db");
        
        // Store base64 directly (in production, upload to S3/Supabase Storage)
        await upsertProfile({
          userId: ctx.user.id,
          profileImage: input.imageBase64,
        });
        
        return { url: input.imageBase64 };
      }),
  }),

  // ============== JOBS ==============
  jobs: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input }) => {
        const { getJobs } = await import("./db");
        return await getJobs(input.limit, input.offset);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getJobById } = await import("./db");
        return await getJobById(input.id);
      }),
  }),

  // ============== MATCHES ==============
  matches: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
      }))
      .query(async ({ ctx, input }) => {
        const { getMatchesByUserId } = await import("./db");
        return await getMatchesByUserId(ctx.user.id, input.limit);
      }),
  }),

  // ============== SAVED JOBS ==============
  savedJobs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getSavedJobsByUserId } = await import("./db");
      return await getSavedJobsByUserId(ctx.user.id);
    }),
    save: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { saveJob } = await import("./db");
        await saveJob(ctx.user.id, input.jobId, input.notes);
        return { success: true };
      }),
    unsave: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { unsaveJob } = await import("./db");
        await unsaveJob(ctx.user.id, input.jobId);
        return { success: true };
      }),
  }),

  // ============== COMPANIES ==============
  companies: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        const { getCompanies } = await import("./db");
        return await getCompanies(input.limit);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getCompanyById, getEventsByCompanyId, getJobsByCompanyId } = await import("./db");
        const company = await getCompanyById(input.id);
        if (!company) return null;
        
        const events = await getEventsByCompanyId(input.id, 10);
        const jobs = await getJobsByCompanyId(input.id, 20);
        
        return { company, events, jobs };
      }),
    topScored: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(20),
        includeUserMatch: z.boolean().optional().default(true),
      }))
      .query(async ({ ctx, input }) => {
        const { getTopCompanyScores, getEventsByCompanyId, getJobsByCompanyId } = await import("./db");
        
        const userId = input.includeUserMatch ? ctx.user.id : null;
        const scores = await getTopCompanyScores(userId, input.limit);
        
        const enriched = await Promise.all(scores.map(async (s) => {
          const events = await getEventsByCompanyId(s.company.id, 5);
          const jobs = await getJobsByCompanyId(s.company.id, 10);
          return {
            ...s,
            events,
            jobs,
          };
        }));
        
        return enriched;
      }),
  }),

  // ============== EVENTS ==============
  events: router({
    recent: protectedProcedure
      .input(z.object({
        daysBack: z.number().optional().default(30),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        const { getRecentEvents } = await import("./db");
        return await getRecentEvents(input.daysBack, input.limit);
      }),
    byCompany: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        const { getEventsByCompanyId } = await import("./db");
        return await getEventsByCompanyId(input.companyId, input.limit);
      }),
  }),

  // ============== SCOUT (JOB FETCHING) ==============
  scout: router({
    run: protectedProcedure
      .input(z.object({
        sources: z.array(z.string()).optional().default(["demo"]),
        maxResults: z.number().optional().default(50),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getProfileByUserId, createJob, createMatch, createScoutHistory, getOrCreateCompany, linkJobToCompany, checkMatchExists } = await import("./db");
        const { scoutJobs } = await import("./scout");
        const { calculateMatch } = await import("./matching");

        const profile = await getProfileByUserId(ctx.user.id);
        if (!profile) {
          throw new Error("Profile not found. Please complete your profile first.");
        }

        const results = await scoutJobs({
          profile,
          sources: input.sources,
          maxResults: input.maxResults,
        });

        let totalJobs = 0;
        let newMatches = 0;

        for (const result of results) {
          for (const job of result.jobs) {
            const createResult = await createJob(job);
            const jobId = (createResult as any).insertId || (createResult as any).id;
            
            if (!jobId) continue;
            totalJobs++;

            const jobForMatching: any = {
              ...job,
              id: jobId,
              description: job.description ?? null,
              location: job.location ?? null,
              salaryMin: job.salaryMin ?? null,
              salaryMax: job.salaryMax ?? null,
              employmentType: job.employmentType ?? null,
              remoteType: job.remoteType ?? null,
              industry: job.industry ?? null,
              requiredSkills: job.requiredSkills ?? null,
              experienceRequired: job.experienceRequired ?? null,
              postedAt: job.postedAt ?? null,
              expiresAt: job.expiresAt ?? null,
              url: job.url ?? null,
              companyRating: job.companyRating ?? null,
              externalId: job.externalId ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            const matchScores = calculateMatch(profile, jobForMatching);

            const matchExists = await checkMatchExists(ctx.user.id, jobId);
            
            if (matchScores.totalScore >= 30 && !matchExists) {
              await createMatch({
                userId: ctx.user.id,
                jobId,
                totalScore: matchScores.totalScore,
                skillScore: matchScores.skillScore,
                experienceScore: matchScores.experienceScore,
                locationScore: matchScores.locationScore,
                salaryScore: matchScores.salaryScore,
                industryScore: matchScores.industryScore,
                companyScore: matchScores.companyScore,
                matchCategory: matchScores.matchCategory,
              });
              newMatches++;
            }
          }
        }

        await createScoutHistory({
          userId: ctx.user.id,
          searchParams: JSON.stringify({ sources: input.sources, maxResults: input.maxResults }),
          resultsCount: totalJobs,
          newMatchesCount: newMatches,
          sources: JSON.stringify(input.sources),
          status: "success",
        });

        return {
          success: true,
          totalJobs,
          newMatches,
        };
      }),
    
    history: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(20),
      }))
      .query(async ({ ctx, input }) => {
        const { getScoutHistoryByUserId } = await import("./db");
        return await getScoutHistoryByUserId(ctx.user.id, input.limit);
      }),

    fetchNews: protectedProcedure
      .input(z.object({
        daysBack: z.number().optional().default(14),
      }))
      .mutation(async ({ input }) => {
        const { fetchNews } = await import("./news-fetcher");
        const { classifyNewsBatch } = await import("./event-classifier");
        const { getOrCreateCompany, createEvent } = await import("./db");

        console.log("[CompanyScout] Fetching news...");
        const news = await fetchNews(input.daysBack);
        console.log(`[CompanyScout] Fetched ${news.length} news items`);

        const classified = await classifyNewsBatch(news);
        console.log(`[CompanyScout] Classified ${classified.length} events`);

        let eventsCreated = 0;
        for (const event of classified) {
          const company = await getOrCreateCompany(event.companyName);
          await createEvent({
            companyId: company.id,
            eventType: event.eventType as any,
            headline: event.headline,
            summary: event.summary,
            sourceUrl: event.sourceUrl,
            impactStrength: event.impactStrength,
            functionFocus: JSON.stringify(event.functionFocus),
            affectedCount: event.affectedCount,
            confidence: event.confidence,
            publishedAt: event.publishedAt,
          });
          eventsCreated++;
        }

        return {
          success: true,
          newsFetched: news.length,
          eventsClassified: classified.length,
          eventsCreated,
        };
      }),

    calculateScores: protectedProcedure
      .input(z.object({
        daysBack: z.number().optional().default(30),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getActiveCompanies, getEventsByCompanyId, getJobsByCompanyId, upsertCompanyScore, getProfileByUserId } = await import("./db");
        const { calculateTalentNeedScore, calculateProfileMatchScore, calculateCombinedScore } = await import("./company-scoring");

        const profile = await getProfileByUserId(ctx.user.id);
        const companies = await getActiveCompanies(input.daysBack);

        let scoresCalculated = 0;
        for (const company of companies) {
          const events = await getEventsByCompanyId(company.id, 50);
          const jobs = await getJobsByCompanyId(company.id, 100);

          const { score: talentScore, reasons: talentReasons } = calculateTalentNeedScore(
            company as any, events as any[], jobs as any[]
          );
          const { score: profileScore, reasons: profileReasons } = calculateProfileMatchScore(
            company as any, events as any[], jobs as any[], profile as any
          );
          const combinedScore = calculateCombinedScore(talentScore, profileScore, !!profile);

          await upsertCompanyScore({
            companyId: company.id,
            userId: ctx.user.id,
            talentNeedScore: talentScore,
            profileMatchScore: profileScore,
            combinedScore,
            scoreReasons: JSON.stringify([...talentReasons, ...profileReasons]),
          });
          scoresCalculated++;
        }

        return {
          success: true,
          companiesProcessed: companies.length,
          scoresCalculated,
        };
      }),

    runFull: protectedProcedure
      .input(z.object({
        newsDaysBack: z.number().optional().default(14),
        scoreDaysBack: z.number().optional().default(30),
      }))
      .mutation(async ({ ctx, input }) => {
        const { fetchNews } = await import("./news-fetcher");
        const { classifyNewsBatch } = await import("./event-classifier");
        const { getOrCreateCompany, createEvent, getActiveCompanies, getEventsByCompanyId, getJobsByCompanyId, upsertCompanyScore, getProfileByUserId } = await import("./db");
        const { calculateTalentNeedScore, calculateProfileMatchScore, calculateCombinedScore } = await import("./company-scoring");

        console.log("[CompanyScout] Starting full pipeline...");

        const news = await fetchNews(input.newsDaysBack);
        console.log(`[CompanyScout] Fetched ${news.length} news items`);

        const classified = await classifyNewsBatch(news);
        console.log(`[CompanyScout] Classified ${classified.length} events`);

        let eventsCreated = 0;
        for (const event of classified) {
          const company = await getOrCreateCompany(event.companyName);
          await createEvent({
            companyId: company.id,
            eventType: event.eventType as any,
            headline: event.headline,
            summary: event.summary,
            sourceUrl: event.sourceUrl,
            impactStrength: event.impactStrength,
            functionFocus: JSON.stringify(event.functionFocus),
            affectedCount: event.affectedCount,
            confidence: event.confidence,
            publishedAt: event.publishedAt,
          });
          eventsCreated++;
        }

        const profile = await getProfileByUserId(ctx.user.id);
        const companies = await getActiveCompanies(input.scoreDaysBack);

        let scoresCalculated = 0;
        for (const company of companies) {
          const events = await getEventsByCompanyId(company.id, 50);
          const jobs = await getJobsByCompanyId(company.id, 100);

          const { score: talentScore, reasons: talentReasons } = calculateTalentNeedScore(
            company as any, events as any[], jobs as any[]
          );
          const { score: profileScore, reasons: profileReasons } = calculateProfileMatchScore(
            company as any, events as any[], jobs as any[], profile as any
          );
          const combinedScore = calculateCombinedScore(talentScore, profileScore, !!profile);

          await upsertCompanyScore({
            companyId: company.id,
            userId: ctx.user.id,
            talentNeedScore: talentScore,
            profileMatchScore: profileScore,
            combinedScore,
            scoreReasons: JSON.stringify([...talentReasons, ...profileReasons]),
          });
          scoresCalculated++;
        }

        console.log("[CompanyScout] Pipeline complete!");

        return {
          success: true,
          newsFetched: news.length,
          eventsCreated,
          scoresCalculated,
        };
      }),

    topCompanies: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(20),
      }))
      .query(async ({ ctx, input }) => {
        const { getTopCompanyScores, getEventsByCompanyId, getJobsByCompanyId } = await import("./db");
        
        const scores = await getTopCompanyScores(ctx.user.id, input.limit);
        
        const enriched = await Promise.all(scores.map(async (s) => {
          const events = await getEventsByCompanyId(s.company.id, 5);
          const jobs = await getJobsByCompanyId(s.company.id, 10);
          
          let reasons: string[] = [];
          try {
            reasons = s.score.scoreReasons ? JSON.parse(s.score.scoreReasons) : [];
          } catch {}

          return {
            company: s.company,
            talentNeedScore: s.score.talentNeedScore,
            profileMatchScore: s.score.profileMatchScore,
            combinedScore: s.score.combinedScore,
            reasons,
            events,
            jobs,
          };
        }));
        
        return enriched;
      }),
  }),

  // ============== AGENTS ==============
  agent: router({
    list: publicProcedure.query(async () => {
      const { AGENTS } = await import("./agents");
      return Object.values(AGENTS);
    }),

    chat: protectedProcedure
      .input(z.object({
        conversationId: z.number().optional(),
        agentType: z.enum(["career_coach", "job_analyzer", "company_intel", "interview_prep", "negotiator"]),
        message: z.string().min(1).max(10000),
        fileBase64: z.string().optional(),
        fileName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { chat } = await import("./agents");
        return chat(input, ctx.user.id);
      }),

    conversations: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(20),
      }))
      .query(async ({ ctx, input }) => {
        const { getConversations } = await import("./agents");
        return getConversations(ctx.user.id, input.limit);
      }),

    conversation: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const { getConversationMessages } = await import("./agents");
        return getConversationMessages(input.conversationId, ctx.user.id);
      }),

    deleteConversation: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { deleteConversation } = await import("./agents");
        return deleteConversation(input.conversationId, ctx.user.id);
      }),
  }),

  // ============== STATS ==============
  stats: router({
    get: protectedProcedure.query(async () => {
      const { getStats } = await import("./db");
      return await getStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
