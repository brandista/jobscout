/**
 * SharedKnowledge - Collective knowledge base for agents
 *
 * Inspired by BemuFix's CollectiveKnowledge system.
 * Provides shared context that all agents can read from and write to.
 *
 * Features:
 * - Per-run knowledge isolation
 * - Company intelligence cache
 * - User insights aggregation
 * - Cross-agent learning
 */

export interface CompanyKnowledge {
  name: string;
  businessId?: string;
  industry?: string;
  signalScore?: number;
  signalConfidence?: string;
  signalTiming?: string;
  signals: string[];
  glassdoorRating?: number;
  ytjData?: any;
  newsItems: Array<{
    headline: string;
    sentiment: string;
    signalType: string;
    url?: string;
  }>;
  twitterSignals: number;
  lastAnalyzed: Date;
  analyzedBy: string[];
}

export interface UserInsight {
  type: "career" | "skill" | "preference" | "opportunity";
  content: string;
  sourceAgent: string;
  confidence: number;
  timestamp: Date;
}

export interface RunKnowledge {
  runId: string;
  userId: number;
  conversationId?: number;
  startedAt: Date;
  companies: Map<string, CompanyKnowledge>;
  userInsights: UserInsight[];
  recommendations: Array<{
    sourceAgent: string;
    type: string;
    content: string;
    priority: number;
    timestamp: Date;
  }>;
  context: {
    currentTopic?: string;
    currentCompany?: string;
    userIntent?: string;
    agentPath: string[]; // Which agents have been involved
  };
}

/**
 * SharedKnowledge - Collective knowledge base
 */
class SharedKnowledgeClass {
  private knowledge: Map<string, RunKnowledge> = new Map();
  private globalCompanyCache: Map<string, CompanyKnowledge> = new Map();

  private readonly MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_RUNS = 100; // Cleanup threshold

  /**
   * Initialize knowledge for a new run
   */
  initRun(runId: string, userId: number, conversationId?: number): RunKnowledge {
    const runKnowledge: RunKnowledge = {
      runId,
      userId,
      conversationId,
      startedAt: new Date(),
      companies: new Map(),
      userInsights: [],
      recommendations: [],
      context: {
        agentPath: [],
      },
    };

    this.knowledge.set(runId, runKnowledge);
    this.cleanup();

    console.log(`[SharedKnowledge] Initialized run ${runId} for user ${userId}`);
    return runKnowledge;
  }

  /**
   * Get knowledge for a run
   */
  getRun(runId: string): RunKnowledge | undefined {
    return this.knowledge.get(runId);
  }

  /**
   * Get or initialize run
   */
  getOrInitRun(runId: string, userId: number, conversationId?: number): RunKnowledge {
    return this.getRun(runId) || this.initRun(runId, userId, conversationId);
  }

  /**
   * Add/update company knowledge
   */
  setCompanyKnowledge(
    runId: string,
    companyName: string,
    knowledge: Partial<CompanyKnowledge>,
    sourceAgent: string
  ): void {
    const run = this.knowledge.get(runId);
    if (!run) {
      console.error(`[SharedKnowledge] Run ${runId} not found`);
      return;
    }

    const normalized = companyName.toLowerCase().trim();
    const existing = run.companies.get(normalized) || this.globalCompanyCache.get(normalized);

    const updated: CompanyKnowledge = {
      name: companyName,
      signals: [],
      newsItems: [],
      twitterSignals: 0,
      analyzedBy: [],
      ...existing,
      ...knowledge,
      lastAnalyzed: new Date(),
    };

    // Add source agent if not already present
    if (!updated.analyzedBy.includes(sourceAgent)) {
      updated.analyzedBy.push(sourceAgent);
    }

    // Update both run-specific and global cache
    run.companies.set(normalized, updated);
    this.globalCompanyCache.set(normalized, updated);

    console.log(`[SharedKnowledge] Updated company ${companyName} by ${sourceAgent}`);
  }

  /**
   * Get company knowledge (from run or global cache)
   */
  getCompanyKnowledge(runId: string, companyName: string): CompanyKnowledge | undefined {
    const normalized = companyName.toLowerCase().trim();
    const run = this.knowledge.get(runId);

    // Check run-specific first
    if (run?.companies.has(normalized)) {
      return run.companies.get(normalized);
    }

    // Check global cache
    const cached = this.globalCompanyCache.get(normalized);
    if (cached) {
      // Check if cache is still valid
      const age = Date.now() - cached.lastAnalyzed.getTime();
      if (age < this.MAX_CACHE_AGE) {
        return cached;
      }
    }

    return undefined;
  }

  /**
   * Check if company was recently analyzed
   */
  wasRecentlyAnalyzed(companyName: string, maxAgeMs: number = 3600000): boolean {
    const normalized = companyName.toLowerCase().trim();
    const cached = this.globalCompanyCache.get(normalized);

    if (!cached) return false;

    const age = Date.now() - cached.lastAnalyzed.getTime();
    return age < maxAgeMs;
  }

  /**
   * Add user insight
   */
  addUserInsight(runId: string, insight: Omit<UserInsight, "timestamp">): void {
    const run = this.knowledge.get(runId);
    if (!run) return;

    run.userInsights.push({
      ...insight,
      timestamp: new Date(),
    });

    console.log(`[SharedKnowledge] Added ${insight.type} insight from ${insight.sourceAgent}`);
  }

  /**
   * Get all user insights for a run
   */
  getUserInsights(runId: string): UserInsight[] {
    return this.knowledge.get(runId)?.userInsights || [];
  }

  /**
   * Add recommendation
   */
  addRecommendation(
    runId: string,
    sourceAgent: string,
    type: string,
    content: string,
    priority: number = 5
  ): void {
    const run = this.knowledge.get(runId);
    if (!run) return;

    run.recommendations.push({
      sourceAgent,
      type,
      content,
      priority,
      timestamp: new Date(),
    });

    // Sort by priority
    run.recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get top recommendations
   */
  getRecommendations(runId: string, limit: number = 5): RunKnowledge["recommendations"] {
    const run = this.knowledge.get(runId);
    return (run?.recommendations || []).slice(0, limit);
  }

  /**
   * Update run context
   */
  updateContext(runId: string, updates: Partial<RunKnowledge["context"]>): void {
    const run = this.knowledge.get(runId);
    if (!run) return;

    run.context = {
      ...run.context,
      ...updates,
    };
  }

  /**
   * Record that an agent was involved
   */
  recordAgentInvolved(runId: string, agentType: string): void {
    const run = this.knowledge.get(runId);
    if (!run) return;

    if (!run.context.agentPath.includes(agentType)) {
      run.context.agentPath.push(agentType);
    }
  }

  /**
   * Build context summary for prompts
   */
  buildContextSummary(runId: string): string {
    const run = this.knowledge.get(runId);
    if (!run) return "";

    const parts: string[] = [];

    // Companies analyzed
    if (run.companies.size > 0) {
      parts.push("## Analysoidut yritykset (tässä keskustelussa)");
      run.companies.forEach((company, name) => {
        const score = company.signalScore
          ? `Score: ${company.signalScore}% (${company.signalConfidence})`
          : "Ei pisteytetty";
        parts.push(`- **${company.name}**: ${score}`);
        if (company.signals.length > 0) {
          parts.push(`  Signaalit: ${company.signals.slice(0, 3).join(", ")}`);
        }
      });
    }

    // User insights
    if (run.userInsights.length > 0) {
      parts.push("\n## Havaitut käyttäjäinsightit");
      run.userInsights.slice(-5).forEach((insight) => {
        parts.push(`- [${insight.type}] ${insight.content}`);
      });
    }

    // Top recommendations
    if (run.recommendations.length > 0) {
      parts.push("\n## Agenttien suositukset");
      run.recommendations.slice(0, 3).forEach((rec) => {
        parts.push(`- [${rec.sourceAgent}] ${rec.content}`);
      });
    }

    // Agent path
    if (run.context.agentPath.length > 1) {
      parts.push(`\n## Agenttien polku: ${run.context.agentPath.join(" → ")}`);
    }

    return parts.join("\n");
  }

  /**
   * Clean up old runs
   */
  private cleanup(): void {
    if (this.knowledge.size <= this.MAX_RUNS) return;

    // Remove oldest runs
    const runs = Array.from(this.knowledge.entries())
      .sort((a, b) => a[1].startedAt.getTime() - b[1].startedAt.getTime());

    const toRemove = runs.slice(0, this.knowledge.size - this.MAX_RUNS);
    toRemove.forEach(([runId]) => {
      this.knowledge.delete(runId);
      console.log(`[SharedKnowledge] Cleaned up run ${runId}`);
    });
  }

  /**
   * Clear run knowledge
   */
  clearRun(runId: string): void {
    this.knowledge.delete(runId);
  }

  /**
   * Get stats
   */
  getStats(): { activeRuns: number; cachedCompanies: number; totalInsights: number } {
    let totalInsights = 0;
    this.knowledge.forEach((run) => {
      totalInsights += run.userInsights.length;
    });

    return {
      activeRuns: this.knowledge.size,
      cachedCompanies: this.globalCompanyCache.size,
      totalInsights,
    };
  }
}

// Singleton instance
export const SharedKnowledge = new SharedKnowledgeClass();
