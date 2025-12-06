import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User profiles table
 */
export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  currentTitle: varchar("currentTitle", { length: 255 }),
  yearsOfExperience: int("yearsOfExperience"),
  skills: text("skills"),
  languages: text("languages"),
  certifications: text("certifications"),
  degree: varchar("degree", { length: 255 }),
  field: varchar("field", { length: 255 }),
  university: varchar("university", { length: 255 }),
  graduationYear: int("graduationYear"),
  preferredJobTitles: text("preferredJobTitles"),
  preferredIndustries: text("preferredIndustries"),
  preferredLocations: text("preferredLocations"),
  employmentTypes: text("employmentTypes"),
  salaryMin: int("salaryMin"),
  salaryMax: int("salaryMax"),
  remotePreference: varchar("remotePreference", { length: 50 }),
  workHistory: text("workHistory"),
  targetFunctions: text("targetFunctions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

/**
 * Companies table
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameNormalized: varchar("nameNormalized", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  yTunnus: varchar("yTunnus", { length: 20 }),
  industry: varchar("industry", { length: 255 }),
  mainLocation: varchar("mainLocation", { length: 255 }),
  employeeCountEstimate: int("employeeCountEstimate"),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  talentNeedScore: float("talentNeedScore").default(0),
  lastScoreUpdate: timestamp("lastScoreUpdate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/**
 * Events table
 */
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  eventType: mysqlEnum("eventType", [
    "yt_layoff", "yt_restructure", "funding", "new_unit", 
    "expansion", "acquisition", "strategy_change", "leadership_change", "other"
  ]).notNull(),
  headline: varchar("headline", { length: 500 }).notNull(),
  summary: text("summary"),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  impactStrength: int("impactStrength").default(3),
  functionFocus: text("functionFocus"),
  affectedCount: int("affectedCount"),
  confidence: float("confidence").default(0.8),
  happenedAt: timestamp("happenedAt"),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

export const EventTypes = [
  "yt_layoff", "yt_restructure", "funding", "new_unit", 
  "expansion", "acquisition", "strategy_change", "leadership_change", "other"
] as const;
export type EventType = typeof EventTypes[number];

/**
 * Jobs table
 */
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 255 }),
  source: varchar("source", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  company: varchar("company", { length: 255 }).notNull(),
  companyId: int("companyId").references(() => companies.id),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  salaryMin: int("salaryMin"),
  salaryMax: int("salaryMax"),
  employmentType: varchar("employmentType", { length: 100 }),
  remoteType: varchar("remoteType", { length: 50 }),
  industry: varchar("industry", { length: 255 }),
  requiredSkills: text("requiredSkills"),
  experienceRequired: int("experienceRequired"),
  seniorityLevel: varchar("seniorityLevel", { length: 50 }),
  functionType: varchar("functionType", { length: 100 }),
  postedAt: timestamp("postedAt"),
  expiresAt: timestamp("expiresAt"),
  url: varchar("url", { length: 1000 }),
  companyRating: int("companyRating"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/**
 * Company scores
 */
export const companyScores = mysqlTable("companyScores", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
  talentNeedScore: float("talentNeedScore").default(0),
  profileMatchScore: float("profileMatchScore").default(0),
  combinedScore: float("combinedScore").default(0),
  scoreReasons: text("scoreReasons"),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
});

export type CompanyScore = typeof companyScores.$inferSelect;
export type InsertCompanyScore = typeof companyScores.$inferInsert;

/**
 * Matches table
 */
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: int("jobId").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  totalScore: int("totalScore").notNull(),
  skillScore: int("skillScore"),
  experienceScore: int("experienceScore"),
  locationScore: int("locationScore"),
  salaryScore: int("salaryScore"),
  industryScore: int("industryScore"),
  companyScore: int("companyScore"),
  matchCategory: varchar("matchCategory", { length: 50 }),
  matchedAt: timestamp("matchedAt").defaultNow().notNull(),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Saved jobs table
 */
export const savedJobs = mysqlTable("savedJobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: int("jobId").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  notes: text("notes"),
  savedAt: timestamp("savedAt").defaultNow().notNull(),
});

export type SavedJob = typeof savedJobs.$inferSelect;
export type InsertSavedJob = typeof savedJobs.$inferInsert;

/**
 * Scout history table
 */
export const scoutHistory = mysqlTable("scoutHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  searchParams: text("searchParams"),
  resultsCount: int("resultsCount").notNull(),
  newMatchesCount: int("newMatchesCount"),
  sources: text("sources"),
  status: varchar("status", { length: 50 }).notNull(),
  errorMessage: text("errorMessage"),
  executedAt: timestamp("executedAt").defaultNow().notNull(),
});

export type ScoutHistory = typeof scoutHistory.$inferSelect;
export type InsertScoutHistory = typeof scoutHistory.$inferInsert;

// ============== AGENT SYSTEM ==============

/**
 * Agent conversations
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentType: mysqlEnum("agentType", [
    "career_coach", "job_analyzer", "company_intel", "interview_prep", "negotiator"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Chat messages
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["user", "assistant", "system", "tool"]).notNull(),
  content: text("content").notNull(),
  toolCalls: text("toolCalls"),
  toolResults: text("toolResults"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Auto Scout Settings - automaattinen työpaikkahaku ja email-notifikaatiot
 */
export const autoScoutSettings = mysqlTable("autoScoutSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  enabled: int("enabled").default(0).notNull(), // 0 = off, 1 = on (MySQL ei tue boolean)
  frequency: mysqlEnum("frequency", ["daily", "weekly", "biweekly"]).default("weekly").notNull(),
  emailEnabled: int("emailEnabled").default(1).notNull(),
  emailAddress: varchar("emailAddress", { length: 320 }),
  sources: text("sources"), // JSON array: ["google_jobs"]
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AutoScoutSettings = typeof autoScoutSettings.$inferSelect;
export type InsertAutoScoutSettings = typeof autoScoutSettings.$inferInsert;

// ============== HELPER ==============
export function normalizeCompanyName(name: string): string {
  let normalized = name.toLowerCase().trim();
  const suffixes = [" oy", " oyj", " ab", " ltd", " oy ab", " group", " finland"];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length);
    }
  }
  return normalized.trim();
}
