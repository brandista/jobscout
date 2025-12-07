/**
 * Auto-migration for JobScout
 * Creates missing tables on startup
 */

import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log("[Migrate] No DATABASE_URL, skipping migrations");
    return;
  }

  const db = drizzle(process.env.DATABASE_URL);
  console.log("[Migrate] Running migrations...");

  try {
    // Companies table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        nameNormalized VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        yTunnus VARCHAR(20),
        industry VARCHAR(255),
        mainLocation VARCHAR(255),
        employeeCountEstimate INT,
        linkedinUrl VARCHAR(500),
        talentNeedScore FLOAT DEFAULT 0,
        lastScoreUpdate TIMESTAMP,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        lastSeenAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_nameNormalized (nameNormalized)
      )
    `);
    console.log("[Migrate] ✓ companies table created");

    // Events table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        companyId INT NOT NULL,
        eventType ENUM('yt_layoff', 'yt_restructure', 'funding', 'new_unit', 'expansion', 'acquisition', 'strategy_change', 'leadership_change', 'other') NOT NULL,
        headline VARCHAR(500) NOT NULL,
        summary TEXT,
        sourceUrl VARCHAR(1000),
        impactStrength INT DEFAULT 3,
        functionFocus TEXT,
        affectedCount INT,
        confidence FLOAT DEFAULT 0.8,
        happenedAt TIMESTAMP,
        publishedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
      )
    `);
    console.log("[Migrate] ✓ events table created");

    // Company scores table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS companyScores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        companyId INT NOT NULL,
        userId INT,
        talentNeedScore FLOAT DEFAULT 0,
        profileMatchScore FLOAT DEFAULT 0,
        combinedScore FLOAT DEFAULT 0,
        scoreReasons TEXT,
        calculatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("[Migrate] ✓ companyScores table created");

    // Conversations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        agentType ENUM('career_coach', 'job_analyzer', 'company_intel', 'interview_prep', 'negotiator', 'signal_scout') NOT NULL,
        title VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_userId (userId),
        INDEX idx_updatedAt (updatedAt)
      )
    `);
    console.log("[Migrate] ✓ conversations table created");

    // Add signal_scout to agentType ENUM if table already exists
    try {
      await db.execute(sql`
        ALTER TABLE conversations 
        MODIFY COLUMN agentType ENUM('career_coach', 'job_analyzer', 'company_intel', 'interview_prep', 'negotiator', 'signal_scout') NOT NULL
      `);
      console.log("[Migrate] ✓ signal_scout added to agentType enum");
    } catch (e: any) {
      // May fail if already correct, ignore
    }

    // Messages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversationId INT NOT NULL,
        role ENUM('user', 'assistant', 'system', 'tool') NOT NULL,
        content TEXT NOT NULL,
        toolCalls TEXT,
        toolResults TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
        INDEX idx_conversationId (conversationId)
      )
    `);
    console.log("[Migrate] ✓ messages table created");

    // Add companyId to jobs if not exists
    try {
      await db.execute(sql`
        ALTER TABLE jobs ADD COLUMN companyId INT REFERENCES companies(id)
      `);
      console.log("[Migrate] ✓ jobs.companyId added");
    } catch (e: any) {
      if (!e.message?.includes("Duplicate column")) {
        // Column already exists, ignore
      }
    }

    // Add seniorityLevel to jobs if not exists
    try {
      await db.execute(sql`
        ALTER TABLE jobs ADD COLUMN seniorityLevel VARCHAR(50)
      `);
      console.log("[Migrate] ✓ jobs.seniorityLevel added");
    } catch (e: any) {
      // Column may already exist
    }

    // Add functionType to jobs if not exists
    try {
      await db.execute(sql`
        ALTER TABLE jobs ADD COLUMN functionType VARCHAR(100)
      `);
      console.log("[Migrate] ✓ jobs.functionType added");
    } catch (e: any) {
      // Column may already exist
    }

    // Add targetFunctions to profiles if not exists
    try {
      await db.execute(sql`
        ALTER TABLE profiles ADD COLUMN targetFunctions TEXT
      `);
      console.log("[Migrate] ✓ profiles.targetFunctions added");
    } catch (e: any) {
      // Column may already exist
    }

    console.log("[Migrate] Migrations complete!");
  } catch (error) {
    console.error("[Migrate] Migration error:", error);
  }
}
