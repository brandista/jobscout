/**
 * Auto-migration for JobScout
 * Creates ALL tables on startup
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
    // ============== USERS TABLE ==============
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        openId VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        email VARCHAR(255),
        loginMethod VARCHAR(50),
        role VARCHAR(50) DEFAULT 'user',
        lastSignedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_openId (openId),
        INDEX idx_email (email)
      )
    `);
    console.log("[Migrate] ✓ users table created");

    // ============== PROFILES TABLE ==============
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        currentTitle VARCHAR(255),
        currentCompany VARCHAR(255),
        yearsExperience INT,
        skills TEXT,
        preferredLocations TEXT,
        preferredJobTitles TEXT,
        preferredIndustries TEXT,
        salaryMin INT,
        salaryMax INT,
        remotePreference VARCHAR(50),
        employmentTypes TEXT,
        targetFunctions TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("[Migrate] ✓ profiles table created");

    // ============== COMPANIES TABLE ==============
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

    // ============== JOBS TABLE ==============
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        externalId VARCHAR(255) UNIQUE,
        source VARCHAR(100) DEFAULT 'unknown',
        title VARCHAR(500) NOT NULL,
        company VARCHAR(255),
        companyId INT,
        description TEXT,
        location VARCHAR(255),
        salaryMin INT,
        salaryMax INT,
        employmentType VARCHAR(100),
        remoteType VARCHAR(100),
        industry VARCHAR(255),
        requiredSkills TEXT,
        experienceRequired VARCHAR(100),
        seniorityLevel VARCHAR(50),
        functionType VARCHAR(100),
        postedAt TIMESTAMP,
        expiresAt TIMESTAMP,
        url VARCHAR(1000),
        companyRating FLOAT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_externalId (externalId),
        INDEX idx_company (company),
        INDEX idx_postedAt (postedAt)
      )
    `);
    console.log("[Migrate] ✓ jobs table created");

    // ============== MATCHES TABLE ==============
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        jobId INT NOT NULL,
        score INT DEFAULT 0,
        totalScore INT DEFAULT 0,
        skillScore INT DEFAULT 0,
        experienceScore INT DEFAULT 0,
        locationScore INT DEFAULT 0,
        salaryScore INT DEFAULT 0,
        industryScore INT DEFAULT 0,
        companyScore INT DEFAULT 0,
        matchCategory VARCHAR(50) DEFAULT 'weak',
        reasons TEXT,
        status VARCHAR(50) DEFAULT 'new',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_job (userId, jobId)
      )
    `);
    console.log("[Migrate] ✓ matches table created");

    // ============== SAVED JOBS TABLE ==============
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS savedJobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        jobId INT NOT NULL,
        notes TEXT,
        savedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_saved_job (userId, jobId)
      )
    `);
    console.log("[Migrate] ✓ savedJobs table created");

    // ============== SCOUT HISTORY TABLE ==============
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS scoutHistory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        searchParams TEXT,
        resultsCount INT DEFAULT 0,
        newMatchesCount INT DEFAULT 0,
        sources TEXT,
        status VARCHAR(50) DEFAULT 'success',
        executedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("[Migrate] ✓ scoutHistory table created");

    // ============== EVENTS TABLE ==============
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

    // ============== COMPANY SCORES TABLE ==============
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
        FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
      )
    `);
    console.log("[Migrate] ✓ companyScores table created");

    // ============== CONVERSATIONS TABLE ==============
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        agentType ENUM('career_coach', 'job_analyzer', 'company_intel', 'interview_prep', 'negotiator', 'signal_scout') NOT NULL,
        title VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_userId (userId),
        INDEX idx_updatedAt (updatedAt)
      )
    `);
    console.log("[Migrate] ✓ conversations table created");

    // ============== MESSAGES TABLE ==============
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

    // ============== AUTO SCOUT SETTINGS TABLE ==============
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS autoScoutSettings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        enabled TINYINT DEFAULT 0,
        frequency VARCHAR(50) DEFAULT 'weekly',
        emailEnabled TINYINT DEFAULT 1,
        emailAddress VARCHAR(255),
        sources TEXT,
        lastRunAt TIMESTAMP,
        nextRunAt TIMESTAMP,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("[Migrate] ✓ autoScoutSettings table created");

    // ============== COLUMN ADDITIONS (for existing tables) ==============
    
    // Add signal_scout to agentType ENUM if table already exists
    try {
      await db.execute(sql`
        ALTER TABLE conversations 
        MODIFY COLUMN agentType ENUM('career_coach', 'job_analyzer', 'company_intel', 'interview_prep', 'negotiator', 'signal_scout') NOT NULL
      `);
      console.log("[Migrate] ✓ signal_scout added to agentType enum");
    } catch (e: any) {
      // May fail if already correct
    }

    // Add missing columns to existing tables
    const alterCommands = [
      { table: 'jobs', column: 'companyId', type: 'INT' },
      { table: 'jobs', column: 'seniorityLevel', type: 'VARCHAR(50)' },
      { table: 'jobs', column: 'functionType', type: 'VARCHAR(100)' },
      { table: 'profiles', column: 'targetFunctions', type: 'TEXT' },
      { table: 'matches', column: 'totalScore', type: 'INT DEFAULT 0' },
      { table: 'matches', column: 'skillScore', type: 'INT DEFAULT 0' },
      { table: 'matches', column: 'experienceScore', type: 'INT DEFAULT 0' },
      { table: 'matches', column: 'locationScore', type: 'INT DEFAULT 0' },
      { table: 'matches', column: 'salaryScore', type: 'INT DEFAULT 0' },
      { table: 'matches', column: 'industryScore', type: 'INT DEFAULT 0' },
      { table: 'matches', column: 'companyScore', type: 'INT DEFAULT 0' },
      { table: 'matches', column: 'matchCategory', type: "VARCHAR(50) DEFAULT 'weak'" },
    ];

    for (const cmd of alterCommands) {
      try {
        await db.execute(sql.raw(`ALTER TABLE ${cmd.table} ADD COLUMN ${cmd.column} ${cmd.type}`));
        console.log(`[Migrate] ✓ ${cmd.table}.${cmd.column} added`);
      } catch (e: any) {
        // Column may already exist
      }
    }

    console.log("[Migrate] ✓ All migrations complete!");
  } catch (error) {
    console.error("[Migrate] Migration error:", error);
  }
}
