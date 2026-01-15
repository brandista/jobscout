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
        const results = await getMatchesByUserId(ctx.user.id, input.limit);
        
        // Transform flat SQL results to { match, job } format expected by frontend
        return results.map((row: any) => ({
          match: {
            id: row.id,
            userId: row.userId,
            jobId: row.jobId,
            totalScore: row.totalScore,
            skillScore: row.skillScore,
            experienceScore: row.experienceScore,
            locationScore: row.locationScore,
            salaryScore: row.salaryScore,
            industryScore: row.industryScore,
            companyScore: row.companyScore,
            matchCategory: row.matchCategory,
            matchedAt: row.matchedAt,
          },
          job: {
            id: row.jobId,
            title: row.title,
            company: row.company,
            location: row.location,
            description: row.description,
            salaryMin: row.salaryMin,
            salaryMax: row.salaryMax,
            employmentType: row.employmentType,
            remoteType: row.remoteType,
            url: row.url,
            postedAt: row.postedAt,
          },
        }));
      }),
  }),

  // ============== SAVED JOBS ==============
  savedJobs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getSavedJobsByUserId } = await import("./db");
      const results = await getSavedJobsByUserId(ctx.user.id);
      
      // Transform flat SQL results to { savedJob, job } format expected by frontend
      return results.map((row: any) => ({
        savedJob: {
          id: row.id,
          userId: row.userId,
          jobId: row.jobId,
          notes: row.notes,
          savedAt: row.savedAt,
        },
        job: {
          id: row.jobId,
          title: row.title,
          company: row.company,
          location: row.location,
          description: row.description,
          salaryMin: row.salaryMin,
          salaryMax: row.salaryMax,
          employmentType: row.employmentType,
          remoteType: row.remoteType,
          url: row.url,
          postedAt: row.postedAt,
        },
      }));
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
        sources: z.array(z.string()).optional().default(["google"]),
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

    // ============== AUTO SCOUT SETTINGS ==============
    getAutoScoutSettings: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return null;

      const { autoScoutSettings } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const result = await db
        .select()
        .from(autoScoutSettings)
        .where(eq(autoScoutSettings.userId, ctx.user.id))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    }),

    updateAutoScoutSettings: protectedProcedure
      .input(z.object({
        enabled: z.boolean(),
        frequency: z.enum(["daily", "weekly", "biweekly"]).optional(),
        emailEnabled: z.boolean().optional(),
        emailAddress: z.string().email().optional().nullable(),
        sources: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { autoScoutSettings, users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        // Get user email as default
        const userResult = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const userEmail = userResult[0]?.email;

        // Check if settings exist
        const existing = await db
          .select()
          .from(autoScoutSettings)
          .where(eq(autoScoutSettings.userId, ctx.user.id))
          .limit(1);

        const now = new Date();
        let nextRun = new Date();
        
        // Calculate next run time based on frequency
        if (input.enabled) {
          const freq = input.frequency || "weekly";
          switch (freq) {
            case "daily":
              nextRun.setDate(nextRun.getDate() + 1);
              break;
            case "weekly":
              nextRun.setDate(nextRun.getDate() + 7);
              break;
            case "biweekly":
              nextRun.setDate(nextRun.getDate() + 14);
              break;
          }
          nextRun.setHours(8, 0, 0, 0);
        }

        const settingsData = {
          enabled: input.enabled ? 1 : 0,
          frequency: input.frequency || "weekly",
          emailEnabled: input.emailEnabled !== false ? 1 : 0,
          emailAddress: input.emailAddress || userEmail || null,
          sources: JSON.stringify(input.sources || ["google_jobs"]),
          nextRunAt: input.enabled ? nextRun : null,
        };

        if (existing.length > 0) {
          await db
            .update(autoScoutSettings)
            .set(settingsData)
            .where(eq(autoScoutSettings.userId, ctx.user.id));
        } else {
          await db.insert(autoScoutSettings).values({
            userId: ctx.user.id,
            ...settingsData,
          });

          // Send welcome email if enabling for first time
          if (input.enabled && (input.emailAddress || userEmail)) {
            const { sendAutoScoutWelcomeEmail } = await import("./email");
            await sendAutoScoutWelcomeEmail(
              input.emailAddress || userEmail || "",
              userResult[0]?.name || undefined,
              input.frequency || "weekly"
            );
          }
        }

        return { success: true };
      }),

    // Cron endpoint - called by external scheduler (e.g., Railway cron, Vercel cron)
    runAutoScoutCron: publicProcedure
      .input(z.object({
        secret: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Verify cron secret
        const cronSecret = process.env.CRON_SECRET || "jobscout-cron-2024";
        if (input.secret !== cronSecret) {
          throw new Error("Unauthorized");
        }

        const { runAutoScout } = await import("./auto-scout");
        return await runAutoScout();
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
        
        const enriched = await Promise.all(scores.map(async (s: any) => {
          // Raw SQL returns flat object with company fields
          const companyId = s.companyId;
          const events = await getEventsByCompanyId(companyId, 5);
          const jobs = await getJobsByCompanyId(companyId, 10);
          
          let reasons: string[] = [];
          try {
            reasons = s.scoreReasons ? JSON.parse(s.scoreReasons) : [];
          } catch {}

          return {
            company: {
              id: companyId,
              name: s.companyName,
              nameNormalized: s.nameNormalized,
              domain: s.domain,
              industry: s.industry,
              mainLocation: s.mainLocation,
              employeeCountEstimate: s.employeeCountEstimate,
            },
            talentNeedScore: s.talentNeedScore,
            profileMatchScore: s.profileMatchScore,
            combinedScore: s.combinedScore,
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
        agentType: z.enum(["career_coach", "job_analyzer", "company_intel", "interview_prep", "negotiator", "signal_scout"]),
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

  // ============== SEARCH (Serper Google Search) ==============
  search: router({
    google: protectedProcedure
      .input(z.object({
        query: z.string().min(1).max(200),
        num: z.number().min(1).max(10).optional().default(5),
      }))
      .mutation(async ({ input }) => {
        const SERPER_API_KEY = process.env.SERPER_API_KEY;
        if (!SERPER_API_KEY) {
          throw new Error("SERPER_API_KEY not configured");
        }

        const response = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: input.query,
            gl: "fi",
            hl: "fi",
            num: input.num,
          }),
        });

        if (!response.ok) {
          throw new Error(`Serper API error: ${response.status}`);
        }

        return await response.json();
      }),

    company: protectedProcedure
      .input(z.object({
        companyName: z.string().min(1).max(100),
      }))
      .mutation(async ({ input }) => {
        const SERPER_API_KEY = process.env.SERPER_API_KEY;
        if (!SERPER_API_KEY) {
          throw new Error("SERPER_API_KEY not configured");
        }

        const response = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: `${input.companyName} yritys suomi`,
            gl: "fi",
            hl: "fi",
            num: 10,
          }),
        });

        if (!response.ok) {
          throw new Error(`Serper API error: ${response.status}`);
        }

        return await response.json();
      }),

    // Kattava yritystiedustelu - hakee useasta lähteestä
    companyIntel: protectedProcedure
      .input(z.object({
        companyName: z.string().min(1).max(100),
      }))
      .mutation(async ({ input }) => {
        const SERPER_API_KEY = process.env.SERPER_API_KEY;
        if (!SERPER_API_KEY) {
          throw new Error("SERPER_API_KEY not configured");
        }

        const companyName = input.companyName.trim();

        // Helper function for Serper searches
        const searchSerper = async (query: string, num: number = 10) => {
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
              num,
            }),
          });
          if (!response.ok) return null;
          return await response.json();
        };

        // Parallel searches for different intel categories
        const [
          basicInfo,
          jobsInfo,
          newsInfo,
          financeInfo,
          reviewsInfo,
        ] = await Promise.all([
          // 1. Perustiedot - toimiala, koko, sijainti
          searchSerper(`"${companyName}" yritys toimiala henkilöstö suomi`, 5),
          
          // 2. Rekrytointi - avoimet paikat, rekrytointitilanne
          searchSerper(`"${companyName}" avoimet työpaikat rekrytointi 2024 2025`, 8),
          
          // 3. Uutiset - rahoitus, kasvu, YT, muutokset
          searchSerper(`"${companyName}" uutiset rahoitus kasvu YT irtisanominen 2024 2025`, 8),
          
          // 4. Taloustiedot - liikevaihto, tulos
          searchSerper(`"${companyName}" liikevaihto tulos talous finder`, 5),
          
          // 5. Työntekijäarviot
          searchSerper(`"${companyName}" työntekijä arvostelu kokemuksia glassdoor`, 5),
        ]);

        // Process and structure the results
        const processResults = (data: any) => {
          if (!data?.organic) return [];
          return data.organic.map((r: any) => ({
            title: r.title || "",
            snippet: r.snippet || "",
            link: r.link || "",
            date: r.date || null,
          }));
        };

        // Extract signals from news
        const extractSignals = (newsResults: any[]) => {
          const signals: { type: string; text: string; sentiment: "positive" | "negative" | "neutral" }[] = [];
          
          for (const news of newsResults) {
            const text = `${news.title} ${news.snippet}`.toLowerCase();
            
            if (text.includes("rahoitus") || text.includes("sijoitus") || text.includes("miljoonaa euroa")) {
              signals.push({ type: "funding", text: news.title, sentiment: "positive" });
            }
            if (text.includes("kasvaa") || text.includes("laajent") || text.includes("uusi toimipiste")) {
              signals.push({ type: "growth", text: news.title, sentiment: "positive" });
            }
            if (text.includes("rekrytoi") || text.includes("palkkaa") || text.includes("avoimia paikkoja")) {
              signals.push({ type: "hiring", text: news.title, sentiment: "positive" });
            }
            if (text.includes("yt-neuvottelu") || text.includes("irtisano") || text.includes("lomautta")) {
              signals.push({ type: "layoffs", text: news.title, sentiment: "negative" });
            }
            if (text.includes("yrityskauppa") || text.includes("ostaa") || text.includes("fuusio")) {
              signals.push({ type: "acquisition", text: news.title, sentiment: "neutral" });
            }
          }
          
          return signals.slice(0, 10);
        };

        // Calculate hiring score based on job results
        const calculateHiringScore = (jobResults: any[]) => {
          let score = 50; // Base score
          const jobCount = jobResults.length;
          
          if (jobCount >= 5) score += 30;
          else if (jobCount >= 3) score += 20;
          else if (jobCount >= 1) score += 10;
          
          // Check for recent dates
          const recentJobs = jobResults.filter(j => {
            const text = `${j.title} ${j.snippet}`.toLowerCase();
            return text.includes("2025") || text.includes("2024") || text.includes("tänään") || text.includes("viikko");
          });
          
          if (recentJobs.length >= 3) score += 20;
          
          return Math.min(score, 100);
        };

        const basicResults = processResults(basicInfo);
        const jobResults = processResults(jobsInfo);
        const newsResults = processResults(newsInfo);
        const financeResults = processResults(financeInfo);
        const reviewResults = processResults(reviewsInfo);
        
        const signals = extractSignals(newsResults);
        const hiringScore = calculateHiringScore(jobResults);

        // Determine overall sentiment
        const positiveSignals = signals.filter(s => s.sentiment === "positive").length;
        const negativeSignals = signals.filter(s => s.sentiment === "negative").length;
        let overallSentiment: "positive" | "negative" | "neutral" = "neutral";
        if (positiveSignals > negativeSignals + 1) overallSentiment = "positive";
        if (negativeSignals > positiveSignals) overallSentiment = "negative";

        return {
          companyName,
          timestamp: new Date().toISOString(),
          
          // Scores
          hiringScore,
          overallSentiment,
          
          // Signals
          signals,
          
          // Categorized results
          sections: {
            basic: {
              title: "Perustiedot",
              results: basicResults,
            },
            jobs: {
              title: "Rekrytointi & Avoimet paikat",
              results: jobResults,
              count: jobResults.length,
            },
            news: {
              title: "Uutiset & Ajankohtaista",
              results: newsResults,
            },
            finance: {
              title: "Taloustiedot",
              results: financeResults,
            },
            reviews: {
              title: "Työntekijäkokemukset",
              results: reviewResults,
            },
          },
          
          // Knowledge graph if available
          knowledgeGraph: basicInfo?.knowledgeGraph || null,
        };
      }),
  }),

  // ============== STATS ==============
  stats: router({
    get: protectedProcedure.query(async () => {
      const { getStats } = await import("./db");
      return await getStats();
    }),
  }),

  // ============== AUTO SCOUT ==============
  autoScout: router({
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      const { getAutoScoutSettings } = await import("./db");
      const settings = await getAutoScoutSettings(ctx.user.id);
      
      if (!settings) {
        return {
          enabled: false,
          frequency: "weekly" as const,
          emailEnabled: true,
          emailAddress: ctx.user.email || "",
          sources: ["google_jobs"],
          lastRunAt: null,
          nextRunAt: null,
        };
      }
      
      return {
        enabled: settings.enabled === 1,
        frequency: settings.frequency,
        emailEnabled: settings.emailEnabled === 1,
        emailAddress: settings.emailAddress || ctx.user.email || "",
        sources: settings.sources ? JSON.parse(settings.sources) : ["google_jobs"],
        lastRunAt: settings.lastRunAt,
        nextRunAt: settings.nextRunAt,
      };
    }),

    updateSettings: protectedProcedure
      .input(z.object({
        enabled: z.boolean(),
        frequency: z.enum(["daily", "weekly", "biweekly"]),
        emailEnabled: z.boolean(),
        emailAddress: z.string().optional(),
        sources: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        console.log("[AutoScout] updateSettings called with:", JSON.stringify(input));
        console.log("[AutoScout] User:", ctx.user.id, ctx.user.email);
        
        try {
          const { upsertAutoScoutSettings } = await import("./db");
          const { sendAutoScoutWelcomeEmail } = await import("./email");
          
          console.log("[AutoScout] Calling upsertAutoScoutSettings...");
          const result = await upsertAutoScoutSettings(ctx.user.id, {
            enabled: input.enabled,
            frequency: input.frequency,
            emailEnabled: input.emailEnabled,
            emailAddress: input.emailAddress || ctx.user.email || undefined,
            sources: input.sources,
          });
          console.log("[AutoScout] upsertAutoScoutSettings result:", result);

          // Send welcome email if just enabled
          if (input.enabled && input.emailEnabled && (input.emailAddress || ctx.user.email)) {
            console.log("[AutoScout] Sending welcome email...");
            await sendAutoScoutWelcomeEmail(
              input.emailAddress || ctx.user.email!,
              ctx.user.name || undefined,
              input.frequency
            );
          }

          return result;
        } catch (error: any) {
          console.error("[AutoScout] updateSettings ERROR:", error.message, error.stack);
          throw error;
        }
      }),

    // Manual trigger for testing
    runNow: protectedProcedure.mutation(async ({ ctx }) => {
      const { getAutoScoutSettings, getProfileByUserId } = await import("./db");
      const { scoutJobs } = await import("./scout");
      const { sendJobAlertEmail } = await import("./email");
      const { calculateMatch } = await import("./matching");

      const settings = await getAutoScoutSettings(ctx.user.id);
      if (!settings) {
        throw new Error("Auto Scout ei ole konfiguroitu");
      }

      const profile = await getProfileByUserId(ctx.user.id);
      if (!profile) {
        throw new Error("Profiili puuttuu");
      }

      const sources = settings.sources ? JSON.parse(settings.sources) : ["google_jobs"];
      const results = await scoutJobs({ profile, sources, maxResults: 20 });
      
      const allJobs = results.flatMap(r => r.jobs);
      
      // Calculate match scores for each job
      const jobsWithScores = allJobs.map(job => {
        const jobForMatching = {
          id: 0,
          title: job.title || "",
          company: job.company || "",
          location: job.location || "",
          description: job.description || "",
          url: job.url || "",
          source: job.source || "google_jobs",
          externalId: job.externalId || "",
          requiredSkills: null,
          experienceRequired: null,
          salaryMin: null,
          salaryMax: null,
          remoteType: null,
          industry: null,
          companyRating: null,
          postedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const matchScores = calculateMatch(profile, jobForMatching as any);
        return {
          ...job,
          matchScore: matchScores.totalScore,
          matchCategory: matchScores.matchCategory,
        };
      });

      // Sort by match score (highest first)
      jobsWithScores.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      
      // Count excellent matches (85+)
      const excellentMatches = jobsWithScores.filter(j => (j.matchScore || 0) >= 85).length;
      const goodMatches = jobsWithScores.filter(j => (j.matchScore || 0) >= 70).length;
      const bestScore = jobsWithScores.length > 0 ? jobsWithScores[0].matchScore || 0 : 0;
      
      if (allJobs.length > 0 && settings.emailEnabled && settings.emailAddress) {
        await sendJobAlertEmail({
          recipientEmail: settings.emailAddress,
          recipientName: ctx.user.name || undefined,
          jobs: jobsWithScores.slice(0, 10).map(j => ({
            title: j.title || "Työpaikka",
            company: j.company || "Yritys",
            location: j.location || "",
            url: j.url || "",
            matchScore: j.matchScore,
            matchCategory: j.matchCategory,
          })),
          totalJobs: allJobs.length,
          newMatches: goodMatches,
          excellentMatches,
          bestMatchScore: bestScore,
        });
      }

      return {
        jobsFound: allJobs.length,
        emailSent: allJobs.length > 0 && settings.emailEnabled === 1,
        excellentMatches,
        goodMatches,
        bestScore,
      };
    }),
  }),

  // ============== DEBUG: Manual Auto Scout Trigger ==============
  debugAutoScout: router({
    trigger: protectedProcedure.mutation(async ({ ctx }) => {
      const { runAutoScout } = await import("./auto-scout");
      const result = await runAutoScout();
      return result;
    }),
    
    ensureSettings: protectedProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("./db");
        const { autoScoutSettings } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const existing = await db
          .select()
          .from(autoScoutSettings)
          .where(eq(autoScoutSettings.userId, ctx.user.id))
          .limit(1);
        
        if (existing.length > 0) {
          await db
            .update(autoScoutSettings)
            .set({
              enabled: 1,
              emailEnabled: 1,
              email: input.email,
              sources: '["google_jobs"]',
              nextRunAt: new Date(),
            })
            .where(eq(autoScoutSettings.userId, ctx.user.id));
          return { status: "updated", userId: ctx.user.id };
        } else {
          await db.insert(autoScoutSettings).values({
            userId: ctx.user.id,
            enabled: 1,
            emailEnabled: 1,
            frequency: "daily",
            email: input.email,
            sources: '["google_jobs"]',
            nextRunAt: new Date(),
          });
          return { status: "created", userId: ctx.user.id };
        }
      }),
  }),

  // ============== WATCHLIST ==============
  watchlist: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getWatchlist } = await import("./db");
      return await getWatchlist(ctx.user.id);
    }),

    add: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addToWatchlist } = await import("./db");
        return await addToWatchlist(ctx.user.id, input.companyId, input.notes);
      }),

    remove: protectedProcedure
      .input(z.object({
        companyId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { removeFromWatchlist } = await import("./db");
        return await removeFromWatchlist(ctx.user.id, input.companyId);
      }),

    updateNotes: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        notes: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateWatchlistNotes } = await import("./db");
        return await updateWatchlistNotes(ctx.user.id, input.companyId, input.notes);
      }),

    toggleAlerts: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        enabled: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { toggleWatchlistAlerts } = await import("./db");
        return await toggleWatchlistAlerts(ctx.user.id, input.companyId, input.enabled);
      }),

    isWatched: protectedProcedure
      .input(z.object({
        companyId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const { isCompanyWatched } = await import("./db");
        return await isCompanyWatched(ctx.user.id, input.companyId);
      }),
  }),

  // ============== PRH (Finnish Business Register) ==============
  prh: router({
    searchByYTunnus: protectedProcedure
      .input(z.object({
        yTunnus: z.string(),
      }))
      .query(async ({ input }) => {
        const { searchByYTunnus, parsePrhResult } = await import("./prh-api");
        const result = await searchByYTunnus(input.yTunnus);
        if (!result) return null;
        return parsePrhResult(result);
      }),

    searchByName: protectedProcedure
      .input(z.object({
        name: z.string(),
        maxResults: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        const { searchAndEnrichCompanies } = await import("./prh-api");
        return await searchAndEnrichCompanies(input.name);
      }),

    enrichCompany: protectedProcedure
      .input(z.object({
        yTunnus: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { enrichCompanyWithPrhData } = await import("./prh-api");
        return await enrichCompanyWithPrhData(input.yTunnus);
      }),

    getCompanyData: protectedProcedure
      .input(z.object({
        companyId: z.number(),
      }))
      .query(async ({ input }) => {
        const { getCompanyWithPrhData } = await import("./db");
        return await getCompanyWithPrhData(input.companyId);
      }),

    checkLiquidation: protectedProcedure
      .input(z.object({
        yTunnus: z.string(),
      }))
      .query(async ({ input }) => {
        const { checkCompanyLiquidation } = await import("./prh-api");
        return await checkCompanyLiquidation(input.yTunnus);
      }),

    findRecentCompanies: protectedProcedure
      .input(z.object({
        searchTerm: z.string(),
        withinDays: z.number().optional().default(365),
      }))
      .query(async ({ input }) => {
        const { findRecentlyRegisteredCompanies, parsePrhResult } = await import("./prh-api");
        const results = await findRecentlyRegisteredCompanies(input.searchTerm, input.withinDays);
        return results.map(r => parsePrhResult(r));
      }),
  }),

  // ============== SIGNAL FEED ==============
  signalFeed: router({
    // Get recent signals/events
    recent: publicProcedure
      .input(z.object({
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { sql } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) return [];
        
        const result = await db.execute(sql`
          SELECT e.*, c.name as companyName, c.industry, c.yTunnus, c.talentNeedScore
          FROM events e
          JOIN companies c ON e.companyId = c.id
          ORDER BY e.createdAt DESC
          LIMIT ${input.limit}
        `);
        
        return (result[0] as any[]) || [];
      }),

    // Get top companies by signal strength
    topCompanies: publicProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { sql } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) return [];
        
        const result = await db.execute(sql`
          SELECT c.*, 
                 COUNT(e.id) as eventCount,
                 MAX(e.createdAt) as lastEventAt
          FROM companies c
          LEFT JOIN events e ON c.id = e.companyId AND e.createdAt > DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY c.id
          HAVING eventCount > 0 OR c.talentNeedScore > 0
          ORDER BY c.talentNeedScore DESC, eventCount DESC
          LIMIT ${input.limit}
        `);
        
        return (result[0] as any[]) || [];
      }),

    // Get signal stats/summary
    stats: publicProcedure.query(async () => {
      const { getDb } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      const db = await getDb();
      if (!db) return null;
      
      const [eventsResult, companiesResult, recentResult] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as total FROM events WHERE createdAt > DATE_SUB(NOW(), INTERVAL 7 DAY)`),
        db.execute(sql`SELECT COUNT(*) as total FROM companies WHERE talentNeedScore > 0`),
        db.execute(sql`SELECT COUNT(*) as total FROM events WHERE createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)`),
      ]);
      
      return {
        eventsLast7Days: (eventsResult[0] as any[])[0]?.total || 0,
        activeCompanies: (companiesResult[0] as any[])[0]?.total || 0,
        eventsLast24Hours: (recentResult[0] as any[])[0]?.total || 0,
      };
    }),

    // Get signals by event type
    byType: publicProcedure
      .input(z.object({
        eventType: z.string(),
        limit: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { sql } = await import("drizzle-orm");
        
        const db = await getDb();
        if (!db) return [];
        
        const result = await db.execute(sql`
          SELECT e.*, c.name as companyName, c.industry
          FROM events e
          JOIN companies c ON e.companyId = c.id
          WHERE e.eventType = ${input.eventType}
          ORDER BY e.createdAt DESC
          LIMIT ${input.limit}
        `);
        
        return (result[0] as any[]) || [];
      }),
  }),

  // ============== EMAIL DIGEST ==============
  emailDigest: router({
    // Send test digest email
    sendTest: protectedProcedure.mutation(async ({ ctx }) => {
      const { getProfileByUserId, getWatchlist } = await import("./db");
      const { sendDigestEmail } = await import("./email-digest");
      
      const profile = await getProfileByUserId(ctx.user.id);
      const watchlist = await getWatchlist(ctx.user.id);
      
      if (!ctx.user.email) {
        throw new Error("No email address found");
      }
      
      await sendDigestEmail({
        to: ctx.user.email,
        userName: ctx.user.name || "Käyttäjä",
        watchlist,
        profile,
      });
      
      return { success: true };
    }),

    // Get digest preview (what would be sent)
    preview: protectedProcedure.query(async ({ ctx }) => {
      const { getProfileByUserId, getWatchlist } = await import("./db");
      const { getDb } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      const db = await getDb();
      if (!db) return null;
      
      const [profile, watchlist] = await Promise.all([
        getProfileByUserId(ctx.user.id),
        getWatchlist(ctx.user.id),
      ]);
      
      // Get top signals for user
      const topSignals = await db.execute(sql`
        SELECT e.*, c.name as companyName, c.talentNeedScore
        FROM events e
        JOIN companies c ON e.companyId = c.id
        WHERE e.createdAt > DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY c.talentNeedScore DESC, e.impactStrength DESC
        LIMIT 5
      `);
      
      // Get watchlist updates
      const watchlistIds = watchlist.map((w: any) => w.companyId);
      let watchlistUpdates: any[] = [];
      
      if (watchlistIds.length > 0) {
        const watchlistResult = await db.execute(sql`
          SELECT e.*, c.name as companyName
          FROM events e
          JOIN companies c ON e.companyId = c.id
          WHERE e.companyId IN (${sql.raw(watchlistIds.join(',') || '0')})
          AND e.createdAt > DATE_SUB(NOW(), INTERVAL 7 DAY)
          ORDER BY e.createdAt DESC
          LIMIT 10
        `);
        watchlistUpdates = (watchlistResult[0] as any[]) || [];
      }
      
      return {
        userName: ctx.user.name || "Käyttäjä",
        topSignals: (topSignals[0] as any[]) || [],
        watchlistUpdates,
        watchlistCount: watchlist.length,
        profileComplete: !!profile?.skills,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
