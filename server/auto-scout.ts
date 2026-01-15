/**
 * Auto Scout Cron Job
 * Runs scheduled job searches for users with auto scout enabled
 */

import { sendJobAlertEmail } from "./email";
import { scoutJobs } from "./scout";

/**
 * Run auto scout for all eligible users
 * Should be called by a cron job or scheduler
 */
export async function runAutoScout(): Promise<{
  usersProcessed: number;
  emailsSent: number;
  errors: string[];
}> {
  const { getDb } = await import("./db");
  const db = await getDb();
  
  if (!db) {
    return { usersProcessed: 0, emailsSent: 0, errors: ["Database not available"] };
  }

  const results = {
    usersProcessed: 0,
    emailsSent: 0,
    errors: [] as string[],
  };

  try {
    // Import schema and eq
    const { autoScoutSettings, profiles, users } = await import("../drizzle/schema");
    const { eq, and, lte, or, isNull } = await import("drizzle-orm");

    const now = new Date();
    
    // Find users with auto scout enabled and due for run
    const dueSettings = await db
      .select({
        settings: autoScoutSettings,
        profile: profiles,
        user: users,
      })
      .from(autoScoutSettings)
      .innerJoin(users, eq(autoScoutSettings.userId, users.id))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(
        and(
          eq(autoScoutSettings.enabled, 1),
          or(
            isNull(autoScoutSettings.nextRunAt),
            lte(autoScoutSettings.nextRunAt, now)
          )
        )
      );

    console.log(`[AutoScout] Found ${dueSettings.length} users due for scout`);

    for (const { settings, profile, user } of dueSettings) {
      try {
        if (!profile) {
          console.log(`[AutoScout] Skipping user ${user.id} - no profile`);
          continue;
        }

        results.usersProcessed++;

        // Parse sources
        let sources = ["google_jobs"];
        try {
          if (settings.sources) {
            sources = JSON.parse(settings.sources);
          }
        } catch {}

        // Run scout
        console.log(`[AutoScout] Running scout for user ${user.id}`);
        const scoutResults = await scoutJobs({
          profile,
          sources,
          maxResults: 30,
        });

        // Collect all jobs
        const allJobs = scoutResults.flatMap(r => r.jobs);
        const totalJobs = allJobs.length;

        if (totalJobs === 0) {
          console.log(`[AutoScout] No jobs found for user ${user.id}`);
          // Still update next run time
          await updateNextRunTime(db, settings.id, settings.frequency);
          continue;
        }

        // Save jobs to database and create matches
        const { createJob, createMatch, getProfileByUserId } = await import("./db");
        const { calculateMatch } = await import("./matching");
        
        let newMatches = 0;
        const jobsForEmail: Array<{
          title: string;
          company: string;
          location: string;
          url: string;
          matchScore?: number;
        }> = [];

        for (const jobData of allJobs) {
          try {
            // Create or get existing job
            const job = await createJob(jobData);
            if (!job || typeof job === 'object' && 'affectedRows' in job) continue;

            // Calculate match
            const matchScore = calculateMatch(profile, job);
            
            // Create match if score is reasonable
            if (matchScore.totalScore >= 40) {
              await createMatch({
                userId: user.id,
                jobId: job.id,
                totalScore: matchScore.totalScore,
                skillScore: matchScore.skillScore,
                experienceScore: matchScore.experienceScore,
                locationScore: matchScore.locationScore,
                salaryScore: matchScore.salaryScore,
                matchCategory: matchScore.matchCategory,
              });
              newMatches++;
              
              jobsForEmail.push({
                title: job.title,
                company: job.company || "Yritys",
                location: job.location || "Suomi",
                url: job.url || "",
                matchScore: matchScore.totalScore,
              });
            }
          } catch (e) {
            // Job might already exist, continue
          }
        }

        console.log(`[AutoScout] User ${user.id}: ${totalJobs} jobs, ${newMatches} matches`);

        // Send email if enabled and there are new matches
        if (settings.emailEnabled && newMatches > 0) {
          const emailAddress = settings.emailAddress || user.email;

          // Validate email format before sending
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailAddress && emailRegex.test(emailAddress)) {
            const emailSent = await sendJobAlertEmail({
              recipientEmail: emailAddress,
              recipientName: user.name || undefined,
              jobs: jobsForEmail.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0)),
              totalJobs,
              newMatches,
            });

            if (emailSent) {
              results.emailsSent++;
            }
          } else if (emailAddress) {
            console.warn(`[AutoScout] Invalid email address for user ${user.id}: ${emailAddress}`);
          }
        }

        // Update last run and next run times
        await updateNextRunTime(db, settings.id, settings.frequency);

      } catch (error: any) {
        console.error(`[AutoScout] Error for user ${user.id}:`, error);
        results.errors.push(`User ${user.id}: ${error.message}`);
      }
    }

  } catch (error: any) {
    console.error("[AutoScout] Fatal error:", error);
    results.errors.push(`Fatal: ${error.message}`);
  }

  console.log(`[AutoScout] Complete: ${results.usersProcessed} users, ${results.emailsSent} emails`);
  return results;
}

/**
 * Update next run time based on frequency
 */
async function updateNextRunTime(db: any, settingsId: number, frequency: string) {
  const { autoScoutSettings } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  
  const now = new Date();
  let nextRun = new Date();

  switch (frequency) {
    case "daily":
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(8, 0, 0, 0); // 8 AM
      break;
    case "weekly":
      nextRun.setDate(nextRun.getDate() + 7);
      nextRun.setHours(8, 0, 0, 0);
      break;
    case "biweekly":
      nextRun.setDate(nextRun.getDate() + 14);
      nextRun.setHours(8, 0, 0, 0);
      break;
    default:
      nextRun.setDate(nextRun.getDate() + 7);
  }

  await db
    .update(autoScoutSettings)
    .set({
      lastRunAt: now,
      nextRunAt: nextRun,
    })
    .where(eq(autoScoutSettings.id, settingsId));
}

/**
 * Check if auto scout should run (for cron endpoint)
 */
export async function shouldRunAutoScout(): Promise<boolean> {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return false;

  const { autoScoutSettings } = await import("../drizzle/schema");
  const { eq, and, lte, or, isNull } = await import("drizzle-orm");

  const now = new Date();
  
  const due = await db
    .select({ id: autoScoutSettings.id })
    .from(autoScoutSettings)
    .where(
      and(
        eq(autoScoutSettings.enabled, 1),
        or(
          isNull(autoScoutSettings.nextRunAt),
          lte(autoScoutSettings.nextRunAt, now)
        )
      )
    )
    .limit(1);

  return due.length > 0;
}
