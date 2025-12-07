import { and, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, profiles, InsertProfile, jobs, InsertJob, 
  matches, InsertMatch, savedJobs, scoutHistory, InsertScoutHistory,
  companies, InsertCompany, events, InsertEvent, companyScores, InsertCompanyScore,
  conversations, InsertConversation, messages, InsertMessage,
  autoScoutSettings,
  normalizeCompanyName
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============== USER QUERIES ==============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============== PROFILE QUERIES ==============

export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertProfile(profile: InsertProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getProfileByUserId(profile.userId);
  if (existing) {
    await db.update(profiles).set(profile).where(eq(profiles.userId, profile.userId));
  } else {
    await db.insert(profiles).values(profile);
  }
}

// ============== COMPANY QUERIES ==============

export async function getOrCreateCompany(name: string, data?: Partial<InsertCompany>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalized = normalizeCompanyName(name);
  
  const existingResult = await db.execute(sql`
    SELECT * FROM companies WHERE nameNormalized = ${normalized} LIMIT 1
  `);
  const existing = (existingResult[0] as any[]) || [];

  if (existing.length > 0) {
    await db.execute(sql`
      UPDATE companies SET lastSeenAt = NOW() WHERE id = ${existing[0].id}
    `);
    return existing[0];
  }

  await db.execute(sql`
    INSERT INTO companies (name, nameNormalized, domain, industry, mainLocation)
    VALUES (${name}, ${normalized}, ${data?.domain || null}, ${data?.industry || null}, ${data?.mainLocation || null})
  `);

  const newResult = await db.execute(sql`
    SELECT * FROM companies WHERE nameNormalized = ${normalized} LIMIT 1
  `);
  
  return ((newResult[0] as any[]) || [])[0];
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.execute(sql`SELECT * FROM companies WHERE id = ${id} LIMIT 1`);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getCompanyByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = normalizeCompanyName(name);
  const result = await db.execute(sql`
    SELECT * FROM companies WHERE nameNormalized = ${normalized} LIMIT 1
  `);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getCompanies(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(companies)
    .orderBy(desc(companies.talentNeedScore))
    .limit(limit);
}

export async function getActiveCompanies(daysBack: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  
  // Use raw SQL to avoid column name issues
  const result = await db.execute(sql`
    SELECT * FROM companies 
    WHERE lastSeenAt >= ${cutoff}
    ORDER BY talentNeedScore DESC
  `);
  
  return result[0] as any[];
}

export async function updateCompanyScore(companyId: number, score: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(companies)
    .set({ talentNeedScore: score, lastScoreUpdate: new Date() })
    .where(eq(companies.id, companyId));
}

// ============== EVENT QUERIES ==============

export async function createEvent(event: InsertEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Use raw SQL to avoid Drizzle ORM bug with column names
  const existing = await db.execute(sql`
    SELECT * FROM events 
    WHERE companyId = ${event.companyId} AND headline = ${event.headline}
    LIMIT 1
  `);
  
  if (existing[0] && (existing[0] as any[]).length > 0) {
    return (existing[0] as any[])[0];
  }

  // Use raw SQL for insert to avoid Drizzle ORM syntax bug
  await db.execute(sql`
    INSERT INTO events (companyId, eventType, headline, summary, sourceUrl, impactStrength, functionFocus, affectedCount, confidence, publishedAt)
    VALUES (${event.companyId}, ${event.eventType}, ${event.headline}, ${event.summary || null}, ${event.sourceUrl || null}, ${event.impactStrength || 3}, ${event.functionFocus || null}, ${event.affectedCount || null}, ${event.confidence || 0.8}, ${event.publishedAt || new Date()})
  `);
  
  const created = await db.execute(sql`
    SELECT * FROM events 
    WHERE companyId = ${event.companyId} AND headline = ${event.headline}
    ORDER BY id DESC
    LIMIT 1
  `);
  
  return (created[0] as any[])[0];
}

export async function getEventsByCompanyId(companyId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.execute(sql`
    SELECT * FROM events 
    WHERE companyId = ${companyId}
    ORDER BY createdAt DESC
    LIMIT ${limit}
  `);
  
  return (result[0] as any[]) || [];
}

export async function getRecentEvents(daysBack: number = 30, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  
  const result = await db.execute(sql`
    SELECT e.*, c.name as companyName, c.nameNormalized, c.domain, c.industry
    FROM events e
    INNER JOIN companies c ON e.companyId = c.id
    WHERE e.createdAt >= ${cutoff}
    ORDER BY e.createdAt DESC
    LIMIT ${limit}
  `);
  
  return (result[0] as any[]) || [];
}

// ============== COMPANY SCORE QUERIES ==============

export async function upsertCompanyScore(score: InsertCompanyScore) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existingResult = await db.execute(sql`
    SELECT * FROM companyScores 
    WHERE companyId = ${score.companyId} 
    AND ${score.userId ? sql`userId = ${score.userId}` : sql`userId IS NULL`}
    LIMIT 1
  `);
  const existing = (existingResult[0] as any[]) || [];

  if (existing.length > 0) {
    await db.execute(sql`
      UPDATE companyScores SET 
        talentNeedScore = ${score.talentNeedScore},
        profileMatchScore = ${score.profileMatchScore},
        combinedScore = ${score.combinedScore},
        scoreReasons = ${score.scoreReasons},
        calculatedAt = NOW()
      WHERE id = ${existing[0].id}
    `);
  } else {
    await db.execute(sql`
      INSERT INTO companyScores (companyId, userId, talentNeedScore, profileMatchScore, combinedScore, scoreReasons)
      VALUES (${score.companyId}, ${score.userId || null}, ${score.talentNeedScore}, ${score.profileMatchScore}, ${score.combinedScore}, ${score.scoreReasons})
    `);
  }
}

export async function getTopCompanyScores(userId: number | null, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT cs.*, c.name as companyName, c.nameNormalized, c.domain, c.industry, c.mainLocation, c.employeeCountEstimate
    FROM companyScores cs
    INNER JOIN companies c ON cs.companyId = c.id
    WHERE ${userId ? sql`cs.userId = ${userId}` : sql`cs.userId IS NULL`}
    ORDER BY cs.combinedScore DESC
    LIMIT ${limit}
  `);
  
  return (result[0] as any[]) || [];
}

// ============== JOB QUERIES ==============

export async function createJob(job: InsertJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (job.externalId) {
    const existingResult = await db.execute(sql`
      SELECT * FROM jobs WHERE externalId = ${job.externalId} LIMIT 1
    `);
    const existing = (existingResult[0] as any[]) || [];
    if (existing.length > 0) {
      return existing[0];
    }
  }

  await db.execute(sql`
    INSERT INTO jobs (externalId, source, title, company, description, location, salaryMin, salaryMax, employmentType, remoteType, industry, requiredSkills, experienceRequired, postedAt, expiresAt, url, companyRating, companyId)
    VALUES (${job.externalId || null}, ${job.source || 'unknown'}, ${job.title}, ${job.company || null}, ${job.description || null}, ${job.location || null}, ${job.salaryMin || null}, ${job.salaryMax || null}, ${job.employmentType || null}, ${job.remoteType || null}, ${job.industry || null}, ${job.requiredSkills || null}, ${job.experienceRequired || null}, ${job.postedAt || new Date()}, ${job.expiresAt || null}, ${job.url || null}, ${job.companyRating || null}, ${job.companyId || null})
  `);
  
  const result = await db.execute(sql`SELECT LAST_INSERT_ID() as insertId`);
  return { insertId: ((result[0] as any[])[0])?.insertId };
}

export async function getJobById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.execute(sql`SELECT * FROM jobs WHERE id = ${id} LIMIT 1`);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getJobs(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT * FROM jobs ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}
  `);
  return (result[0] as any[]) || [];
}

export async function getJobsByCompanyId(companyId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT * FROM jobs WHERE companyId = ${companyId} ORDER BY createdAt DESC LIMIT ${limit}
  `);
  return (result[0] as any[]) || [];
}

export async function linkJobToCompany(jobId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`UPDATE jobs SET companyId = ${companyId} WHERE id = ${jobId}`);
}

// ============== MATCH QUERIES ==============

export async function createMatch(match: InsertMatch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`
    INSERT INTO matches (userId, jobId, totalScore, skillScore, experienceScore, locationScore, salaryScore, industryScore, companyScore, matchCategory, status)
    VALUES (${match.userId}, ${match.jobId}, ${match.totalScore || 0}, ${match.skillScore || 0}, ${match.experienceScore || 0}, ${match.locationScore || 0}, ${match.salaryScore || 0}, ${match.industryScore || 0}, ${match.companyScore || 0}, ${match.matchCategory || 'weak'}, ${match.status || 'new'})
  `);
}

export async function checkMatchExists(userId: number, jobId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.execute(sql`
    SELECT id FROM matches WHERE userId = ${userId} AND jobId = ${jobId} LIMIT 1
  `);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0;
}

export async function getMatchesByUserId(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT m.*, j.*
    FROM matches m
    INNER JOIN jobs j ON m.jobId = j.id
    WHERE m.userId = ${userId}
    ORDER BY m.totalScore DESC
    LIMIT ${limit}
  `);
  return (result[0] as any[]) || [];
}

// ============== SAVED JOBS QUERIES ==============

export async function saveJob(userId: number, jobId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`
    INSERT INTO savedJobs (userId, jobId, notes) VALUES (${userId}, ${jobId}, ${notes || null})
  `);
}

export async function unsaveJob(userId: number, jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`DELETE FROM savedJobs WHERE userId = ${userId} AND jobId = ${jobId}`);
}

export async function getSavedJobsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      savedJob: savedJobs,
      job: jobs,
    })
    .from(savedJobs)
    .innerJoin(jobs, eq(savedJobs.jobId, jobs.id))
    .where(eq(savedJobs.userId, userId))
    .orderBy(desc(savedJobs.savedAt));
}

// ============== SCOUT HISTORY QUERIES ==============

export async function createScoutHistory(history: InsertScoutHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(scoutHistory).values(history);
}

export async function getScoutHistoryByUserId(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(scoutHistory)
    .where(eq(scoutHistory.userId, userId))
    .orderBy(desc(scoutHistory.executedAt))
    .limit(limit);
}

// ============== CONVERSATION QUERIES ==============

export async function createConversation(data: InsertConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(conversations).values(data);
  return { insertId: result[0].insertId };
}

export async function getConversation(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getConversationsByUserId(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

export async function updateConversationTitle(id: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(conversations).set({ title }).where(eq(conversations.id, id));
}

export async function deleteConversation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
}

// ============== MESSAGE QUERIES ==============

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(messages).values(data);
  
  await db.update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, data.conversationId));
  
  return { insertId: result[0].insertId };
}

export async function getMessagesByConversationId(conversationId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(limit);
}

// ============== STATS ==============

export async function getStats() {
  const db = await getDb();
  if (!db) return { companies: 0, events: 0, jobs: 0 };

  const companyCount = await db.select({ count: sql<number>`count(*)` }).from(companies);
  const eventCount = await db.select({ count: sql<number>`count(*)` }).from(events);
  const jobCount = await db.select({ count: sql<number>`count(*)` }).from(jobs);

  return {
    companies: companyCount[0]?.count || 0,
    events: eventCount[0]?.count || 0,
    jobs: jobCount[0]?.count || 0,
  };
}

// ============== AUTO SCOUT SETTINGS ==============

export async function getAutoScoutSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(autoScoutSettings)
    .where(eq(autoScoutSettings.userId, userId))
    .limit(1);

  return result[0] || null;
}

export async function upsertAutoScoutSettings(userId: number, settings: {
  enabled?: boolean;
  frequency?: "daily" | "weekly" | "biweekly";
  emailEnabled?: boolean;
  emailAddress?: string;
  sources?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getAutoScoutSettings(userId);

  const data = {
    enabled: settings.enabled !== undefined ? (settings.enabled ? 1 : 0) : undefined,
    frequency: settings.frequency,
    emailEnabled: settings.emailEnabled !== undefined ? (settings.emailEnabled ? 1 : 0) : undefined,
    emailAddress: settings.emailAddress,
    sources: settings.sources ? JSON.stringify(settings.sources) : undefined,
    nextRunAt: settings.enabled ? calculateNextRunAt(settings.frequency || "weekly") : null,
  };

  // Remove undefined values
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );

  if (existing) {
    await db.update(autoScoutSettings)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(autoScoutSettings.id, existing.id));
    return { ...existing, ...cleanData };
  } else {
    await db.insert(autoScoutSettings).values({
      userId,
      enabled: data.enabled ?? 0,
      frequency: data.frequency ?? "weekly",
      emailEnabled: data.emailEnabled ?? 1,
      emailAddress: data.emailAddress,
      sources: data.sources ?? JSON.stringify(["google_jobs"]),
      nextRunAt: data.nextRunAt,
    });
    return await getAutoScoutSettings(userId);
  }
}

export async function getAutoScoutSettingsDueForRun() {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  return await db.select()
    .from(autoScoutSettings)
    .where(
      and(
        eq(autoScoutSettings.enabled, 1),
        sql`${autoScoutSettings.nextRunAt} <= ${now}`
      )
    );
}

export async function updateAutoScoutLastRun(settingsId: number, frequency: "daily" | "weekly" | "biweekly") {
  const db = await getDb();
  if (!db) return;

  await db.update(autoScoutSettings)
    .set({
      lastRunAt: new Date(),
      nextRunAt: calculateNextRunAt(frequency),
    })
    .where(eq(autoScoutSettings.id, settingsId));
}

function calculateNextRunAt(frequency: "daily" | "weekly" | "biweekly"): Date {
  const now = new Date();
  switch (frequency) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "biweekly":
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}
