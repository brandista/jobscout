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
  
  const existing = await db.select().from(companies)
    .where(eq(companies.nameNormalized, normalized))
    .limit(1);

  if (existing.length > 0) {
    await db.update(companies)
      .set({ lastSeenAt: new Date(), ...data })
      .where(eq(companies.id, existing[0].id));
    return existing[0];
  }

  await db.insert(companies).values({
    name,
    nameNormalized: normalized,
    ...data,
  });

  const newCompany = await db.select().from(companies)
    .where(eq(companies.nameNormalized, normalized))
    .limit(1);
  
  return newCompany[0];
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCompanyByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = normalizeCompanyName(name);
  const result = await db.select().from(companies)
    .where(eq(companies.nameNormalized, normalized))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
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

  await db.insert(events).values(event);
  
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
  return await db.select().from(events)
    .where(eq(events.companyId, companyId))
    .orderBy(desc(events.createdAt))
    .limit(limit);
}

export async function getRecentEvents(daysBack: number = 30, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  
  return await db.select({
    event: events,
    company: companies,
  })
    .from(events)
    .innerJoin(companies, eq(events.companyId, companies.id))
    .where(gte(events.createdAt, cutoff))
    .orderBy(desc(events.createdAt))
    .limit(limit);
}

// ============== COMPANY SCORE QUERIES ==============

export async function upsertCompanyScore(score: InsertCompanyScore) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(companyScores)
    .where(and(
      eq(companyScores.companyId, score.companyId),
      score.userId ? eq(companyScores.userId, score.userId) : sql`${companyScores.userId} IS NULL`
    ))
    .limit(1);

  if (existing.length > 0) {
    await db.update(companyScores)
      .set({
        talentNeedScore: score.talentNeedScore,
        profileMatchScore: score.profileMatchScore,
        combinedScore: score.combinedScore,
        scoreReasons: score.scoreReasons,
        calculatedAt: new Date(),
      })
      .where(eq(companyScores.id, existing[0].id));
  } else {
    await db.insert(companyScores).values(score);
  }
}

export async function getTopCompanyScores(userId: number | null, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return await db.select({
    score: companyScores,
    company: companies,
  })
    .from(companyScores)
    .innerJoin(companies, eq(companyScores.companyId, companies.id))
    .where(userId ? eq(companyScores.userId, userId) : sql`${companyScores.userId} IS NULL`)
    .orderBy(desc(companyScores.combinedScore))
    .limit(limit);
}

// ============== JOB QUERIES ==============

export async function createJob(job: InsertJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (job.externalId) {
    const existing = await db.select().from(jobs)
      .where(eq(jobs.externalId, job.externalId))
      .limit(1);
    if (existing.length > 0) {
      return existing[0];
    }
  }

  const result = await db.insert(jobs).values(job);
  return result;
}

export async function getJobById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getJobs(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(limit).offset(offset);
}

export async function getJobsByCompanyId(companyId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(jobs)
    .where(eq(jobs.companyId, companyId))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}

export async function linkJobToCompany(jobId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(jobs).set({ companyId }).where(eq(jobs.id, jobId));
}

// ============== MATCH QUERIES ==============

export async function createMatch(match: InsertMatch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(matches).values(match);
}

export async function checkMatchExists(userId: number, jobId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(matches)
    .where(and(eq(matches.userId, userId), eq(matches.jobId, jobId)))
    .limit(1);
  return result.length > 0;
}

export async function getMatchesByUserId(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      match: matches,
      job: jobs,
    })
    .from(matches)
    .innerJoin(jobs, eq(matches.jobId, jobs.id))
    .where(eq(matches.userId, userId))
    .orderBy(desc(matches.totalScore))
    .limit(limit);
}

// ============== SAVED JOBS QUERIES ==============

export async function saveJob(userId: number, jobId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(savedJobs).values({ userId, jobId, notes });
}

export async function unsaveJob(userId: number, jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(savedJobs).where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId)));
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
