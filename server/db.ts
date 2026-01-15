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
let _dbConnectionError: Error | null = null;

export async function getDb() {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    _dbConnectionError = new Error("DATABASE_URL not configured");
    console.error("[Database] DATABASE_URL environment variable not set");
    return null;
  }

  try {
    _db = drizzle(process.env.DATABASE_URL);
    _dbConnectionError = null;
    console.log("[Database] Connected successfully");
    return _db;
  } catch (error) {
    _dbConnectionError = error as Error;
    console.error("[Database] Failed to connect:", error);
    _db = null;
    return null;
  }
}

export function getDbConnectionError(): Error | null {
  return _dbConnectionError;
}

export async function requireDb() {
  const db = await getDb();
  if (!db) {
    const error = _dbConnectionError || new Error("Database not available");
    throw error;
  }
  return db;
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
    const name = user.name ?? null;
    const email = user.email ?? null;
    const loginMethod = user.loginMethod ?? null;
    const lastSignedIn = user.lastSignedIn ?? new Date();
    const role = user.role ?? (user.openId === ENV.ownerOpenId ? 'admin' : 'user');

    await db.execute(sql`
      INSERT INTO users (openId, name, email, loginMethod, lastSignedIn, role)
      VALUES (${user.openId}, ${name}, ${email}, ${loginMethod}, ${lastSignedIn}, ${role})
      ON DUPLICATE KEY UPDATE
        name = COALESCE(${name}, name),
        email = COALESCE(${email}, email),
        loginMethod = COALESCE(${loginMethod}, loginMethod),
        lastSignedIn = ${lastSignedIn},
        role = COALESCE(${role}, role)
    `);
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.execute(sql`SELECT * FROM users WHERE openId = ${openId} LIMIT 1`);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.execute(sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
}

// ============== PROFILE QUERIES ==============

export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.execute(sql`SELECT * FROM profiles WHERE userId = ${userId} LIMIT 1`);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
}

export async function upsertProfile(profile: InsertProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getProfileByUserId(profile.userId);
  if (existing) {
    await db.execute(sql`
      UPDATE profiles SET 
        currentTitle = ${profile.currentTitle || null},
        currentCompany = ${profile.currentCompany || null},
        yearsExperience = ${profile.yearsExperience || null},
        skills = ${profile.skills || null},
        preferredLocations = ${profile.preferredLocations || null},
        preferredJobTitles = ${profile.preferredJobTitles || null},
        preferredIndustries = ${profile.preferredIndustries || null},
        salaryMin = ${profile.salaryMin || null},
        salaryMax = ${profile.salaryMax || null},
        remotePreference = ${profile.remotePreference || null},
        employmentTypes = ${profile.employmentTypes || null},
        targetFunctions = ${profile.targetFunctions || null},
        updatedAt = NOW()
      WHERE userId = ${profile.userId}
    `);
  } else {
    await db.execute(sql`
      INSERT INTO profiles (userId, currentTitle, currentCompany, yearsExperience, skills, preferredLocations, preferredJobTitles, preferredIndustries, salaryMin, salaryMax, remotePreference, employmentTypes, targetFunctions)
      VALUES (${profile.userId}, ${profile.currentTitle || null}, ${profile.currentCompany || null}, ${profile.yearsExperience || null}, ${profile.skills || null}, ${profile.preferredLocations || null}, ${profile.preferredJobTitles || null}, ${profile.preferredIndustries || null}, ${profile.salaryMin || null}, ${profile.salaryMax || null}, ${profile.remotePreference || null}, ${profile.employmentTypes || null}, ${profile.targetFunctions || null})
    `);
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

export async function createCompany(company: InsertCompany) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const nameNormalized = normalizeCompanyName(company.name);
  
  const result = await db.execute(sql`
    INSERT INTO companies (name, nameNormalized, domain, yTunnus, industry, mainLocation, linkedinUrl)
    VALUES (${company.name}, ${nameNormalized}, ${company.domain || null}, ${company.yTunnus || null}, 
            ${company.industry || null}, ${company.mainLocation || null}, ${company.linkedinUrl || null})
  `);
  
  const insertId = (result[0] as any).insertId;
  return await getCompanyById(insertId);
}

export async function updateCompanyById(companyId: number, updates: Partial<InsertCompany>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const setClauses: string[] = [];
  const values: any[] = [];
  
  if (updates.yTunnus !== undefined) {
    setClauses.push('yTunnus = ?');
    values.push(updates.yTunnus);
  }
  if (updates.domain !== undefined) {
    setClauses.push('domain = ?');
    values.push(updates.domain);
  }
  if (updates.industry !== undefined) {
    setClauses.push('industry = ?');
    values.push(updates.industry);
  }
  if (updates.mainLocation !== undefined) {
    setClauses.push('mainLocation = ?');
    values.push(updates.mainLocation);
  }
  
  if (setClauses.length === 0) return;
  
  // Use raw SQL for update
  await db.execute(sql`
    UPDATE companies SET 
      yTunnus = COALESCE(${updates.yTunnus || null}, yTunnus),
      domain = COALESCE(${updates.domain || null}, domain),
      industry = COALESCE(${updates.industry || null}, industry),
      mainLocation = COALESCE(${updates.mainLocation || null}, mainLocation),
      updatedAt = NOW()
    WHERE id = ${companyId}
  `);
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
  const result = await db.execute(sql`
    SELECT sj.*, j.*
    FROM savedJobs sj
    INNER JOIN jobs j ON sj.jobId = j.id
    WHERE sj.userId = ${userId}
    ORDER BY sj.savedAt DESC
  `);
  return (result[0] as any[]) || [];
}

// ============== SCOUT HISTORY QUERIES ==============

export async function createScoutHistory(history: InsertScoutHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`
    INSERT INTO scoutHistory (userId, searchParams, resultsCount, newMatchesCount, sources, status)
    VALUES (${history.userId}, ${history.searchParams || null}, ${history.resultsCount || 0}, ${history.newMatchesCount || 0}, ${history.sources || null}, ${history.status || 'success'})
  `);
}

export async function getScoutHistoryByUserId(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT * FROM scoutHistory WHERE userId = ${userId} ORDER BY executedAt DESC LIMIT ${limit}
  `);
  return (result[0] as any[]) || [];
}

// ============== CONVERSATION QUERIES ==============

export async function createConversation(data: InsertConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`
    INSERT INTO conversations (userId, agentType, title)
    VALUES (${data.userId}, ${data.agentType}, ${data.title || null})
  `);
  const result = await db.execute(sql`SELECT LAST_INSERT_ID() as insertId`);
  return { insertId: ((result[0] as any[])[0])?.insertId };
}

export async function getConversation(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.execute(sql`SELECT * FROM conversations WHERE id = ${id} LIMIT 1`);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getConversationsByUserId(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT * FROM conversations WHERE userId = ${userId} ORDER BY updatedAt DESC LIMIT ${limit}
  `);
  return (result[0] as any[]) || [];
}

export async function updateConversationTitle(id: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`UPDATE conversations SET title = ${title} WHERE id = ${id}`);
}

export async function deleteConversation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`DELETE FROM messages WHERE conversationId = ${id}`);
  await db.execute(sql`DELETE FROM conversations WHERE id = ${id}`);
}

// ============== MESSAGE QUERIES ==============

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`
    INSERT INTO messages (conversationId, role, content, toolCalls, toolResults)
    VALUES (${data.conversationId}, ${data.role}, ${data.content}, ${data.toolCalls || null}, ${data.toolResults || null})
  `);
  
  await db.execute(sql`UPDATE conversations SET updatedAt = NOW() WHERE id = ${data.conversationId}`);
  
  const result = await db.execute(sql`SELECT LAST_INSERT_ID() as insertId`);
  return { insertId: ((result[0] as any[])[0])?.insertId };
}

export async function getMessagesByConversationId(conversationId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT * FROM messages WHERE conversationId = ${conversationId} ORDER BY createdAt ASC LIMIT ${limit}
  `);
  return (result[0] as any[]) || [];
}

// ============== STATS ==============

export async function getStats() {
  const db = await getDb();
  if (!db) return { companies: 0, events: 0, jobs: 0 };

  const companyResult = await db.execute(sql`SELECT COUNT(*) as count FROM companies`);
  const eventResult = await db.execute(sql`SELECT COUNT(*) as count FROM events`);
  const jobResult = await db.execute(sql`SELECT COUNT(*) as count FROM jobs`);

  return {
    companies: ((companyResult[0] as any[])[0])?.count || 0,
    events: ((eventResult[0] as any[])[0])?.count || 0,
    jobs: ((jobResult[0] as any[])[0])?.count || 0,
  };
}

// ============== AUTO SCOUT SETTINGS ==============

export async function getAutoScoutSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.execute(sql`
    SELECT * FROM autoScoutSettings WHERE userId = ${userId} LIMIT 1
  `);
  const rows = (result[0] as any[]) || [];
  return rows[0] || null;
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

  const enabled = settings.enabled !== undefined ? (settings.enabled ? 1 : 0) : (existing?.enabled ?? 0);
  const frequency = settings.frequency || existing?.frequency || "weekly";
  const emailEnabled = settings.emailEnabled !== undefined ? (settings.emailEnabled ? 1 : 0) : (existing?.emailEnabled ?? 1);
  const emailAddress = settings.emailAddress || existing?.emailAddress || null;
  const sources = settings.sources ? JSON.stringify(settings.sources) : (existing?.sources || JSON.stringify(["google_jobs"]));
  const nextRunAt = enabled ? calculateNextRunAt(frequency) : null;

  if (existing) {
    await db.execute(sql`
      UPDATE autoScoutSettings SET 
        enabled = ${enabled},
        frequency = ${frequency},
        emailEnabled = ${emailEnabled},
        emailAddress = ${emailAddress},
        sources = ${sources},
        nextRunAt = ${nextRunAt},
        updatedAt = NOW()
      WHERE id = ${existing.id}
    `);
    return await getAutoScoutSettings(userId);
  } else {
    await db.execute(sql`
      INSERT INTO autoScoutSettings (userId, enabled, frequency, emailEnabled, emailAddress, sources, nextRunAt)
      VALUES (${userId}, ${enabled}, ${frequency}, ${emailEnabled}, ${emailAddress}, ${sources}, ${nextRunAt})
    `);
    return await getAutoScoutSettings(userId);
  }
}

export async function getAutoScoutSettingsDueForRun() {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT * FROM autoScoutSettings WHERE enabled = 1 AND nextRunAt <= NOW()
  `);
  return (result[0] as any[]) || [];
}

export async function updateAutoScoutLastRun(settingsId: number, frequency: "daily" | "weekly" | "biweekly") {
  const db = await getDb();
  if (!db) return;

  const nextRunAt = calculateNextRunAt(frequency);
  await db.execute(sql`
    UPDATE autoScoutSettings SET lastRunAt = NOW(), nextRunAt = ${nextRunAt} WHERE id = ${settingsId}
  `);
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

// ============== WATCHLIST QUERIES ==============

export async function getWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT w.*, c.name as companyName, c.domain, c.industry, c.yTunnus, c.talentNeedScore,
           (SELECT COUNT(*) FROM events e WHERE e.companyId = c.id AND e.createdAt > DATE_SUB(NOW(), INTERVAL 30 DAY)) as recentEventsCount
    FROM watchlist w
    JOIN companies c ON w.companyId = c.id
    WHERE w.userId = ${userId}
    ORDER BY w.createdAt DESC
  `);
  return (result[0] as any[]) || [];
}

export async function addToWatchlist(userId: number, companyId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.execute(sql`
    INSERT INTO watchlist (userId, companyId, notes)
    VALUES (${userId}, ${companyId}, ${notes || null})
    ON DUPLICATE KEY UPDATE notes = ${notes || null}, alertsEnabled = 1
  `);
  
  return { success: true };
}

export async function removeFromWatchlist(userId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.execute(sql`DELETE FROM watchlist WHERE userId = ${userId} AND companyId = ${companyId}`);
  return { success: true };
}

export async function updateWatchlistNotes(userId: number, companyId: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.execute(sql`
    UPDATE watchlist SET notes = ${notes} WHERE userId = ${userId} AND companyId = ${companyId}
  `);
  return { success: true };
}

export async function toggleWatchlistAlerts(userId: number, companyId: number, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.execute(sql`
    UPDATE watchlist SET alertsEnabled = ${enabled ? 1 : 0} WHERE userId = ${userId} AND companyId = ${companyId}
  `);
  return { success: true };
}

export async function isCompanyWatched(userId: number, companyId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.execute(sql`
    SELECT id FROM watchlist WHERE userId = ${userId} AND companyId = ${companyId} LIMIT 1
  `);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0;
}

// ============== PRH DATA QUERIES ==============

export interface PrhCompanyData {
  yTunnus: string;
  companyName: string;
  companyForm?: string;
  registrationDate?: Date;
  businessLine?: string;
  businessLineCode?: string;
  liquidation: boolean;
  website?: string;
  latestRevenue?: number;
  latestEmployees?: number;
  latestRevenueYear?: number;
  rawData?: any;
}

export async function savePrhData(companyId: number, prhData: PrhCompanyData) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rawJson = prhData.rawData ? JSON.stringify(prhData.rawData) : null;

  await db.execute(sql`
    INSERT INTO prhData (companyId, yTunnus, companyForm, registrationDate, businessLine, businessLineCode, 
                         liquidation, website, latestRevenue, latestEmployees, latestRevenueYear, rawData)
    VALUES (${companyId}, ${prhData.yTunnus}, ${prhData.companyForm || null}, ${prhData.registrationDate || null},
            ${prhData.businessLine || null}, ${prhData.businessLineCode || null}, ${prhData.liquidation ? 1 : 0},
            ${prhData.website || null}, ${prhData.latestRevenue || null}, ${prhData.latestEmployees || null},
            ${prhData.latestRevenueYear || null}, ${rawJson})
    ON DUPLICATE KEY UPDATE
      companyForm = ${prhData.companyForm || null},
      registrationDate = ${prhData.registrationDate || null},
      businessLine = ${prhData.businessLine || null},
      businessLineCode = ${prhData.businessLineCode || null},
      liquidation = ${prhData.liquidation ? 1 : 0},
      website = ${prhData.website || null},
      latestRevenue = ${prhData.latestRevenue || null},
      latestEmployees = ${prhData.latestEmployees || null},
      latestRevenueYear = ${prhData.latestRevenueYear || null},
      rawData = ${rawJson},
      fetchedAt = NOW()
  `);
}

export async function getPrhData(companyId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.execute(sql`SELECT * FROM prhData WHERE companyId = ${companyId} LIMIT 1`);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getPrhDataByYTunnus(yTunnus: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.execute(sql`SELECT * FROM prhData WHERE yTunnus = ${yTunnus} LIMIT 1`);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
}

export async function getCompanyWithPrhData(companyId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.execute(sql`
    SELECT c.*, p.companyForm, p.registrationDate, p.businessLine, p.businessLineCode,
           p.liquidation, p.website as prhWebsite, p.latestRevenue, p.latestEmployees, 
           p.latestRevenueYear, p.fetchedAt as prhFetchedAt
    FROM companies c
    LEFT JOIN prhData p ON c.id = p.companyId
    WHERE c.id = ${companyId}
    LIMIT 1
  `);
  const rows = (result[0] as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
}
