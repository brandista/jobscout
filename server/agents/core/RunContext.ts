/**
 * RunContext - Per-request isolation for agent execution
 *
 * Inspired by BemuFix's RunContext system.
 * Provides isolated context for each agent interaction.
 *
 * Features:
 * - Unique run ID for tracking
 * - Session and conversation tracking
 * - Agent execution state
 * - Tool result caching
 */

import { AgentMessenger, createAgentPublisher } from "./AgentMessenger";
import { SharedKnowledge, type RunKnowledge } from "./SharedKnowledge";
import type { UserContext, AgentType } from "../types";

export interface ToolResult {
  toolName: string;
  input: any;
  output: any;
  timestamp: Date;
  cached: boolean;
}

export interface AgentExecution {
  agentType: AgentType;
  startedAt: Date;
  completedAt?: Date;
  toolsUsed: string[];
  messagesPublished: number;
}

export interface RunContextData {
  runId: string;
  sessionId: string;
  userId: number;
  conversationId?: number;
  startedAt: Date;
  currentAgent?: AgentType;
  agentExecutions: AgentExecution[];
  toolResults: Map<string, ToolResult>;
  metadata: Record<string, any>;
}

/**
 * RunContext - Execution context for a single agent interaction
 */
export class RunContext {
  readonly runId: string;
  readonly sessionId: string;
  readonly userId: number;
  readonly conversationId?: number;
  readonly startedAt: Date;

  private currentAgent?: AgentType;
  private agentExecutions: AgentExecution[] = [];
  private toolResults: Map<string, ToolResult> = new Map();
  private metadata: Record<string, any> = {};
  private publisher: ReturnType<typeof createAgentPublisher> | null = null;

  constructor(userId: number, conversationId?: number, existingRunId?: string) {
    this.runId = existingRunId || this.generateRunId();
    this.sessionId = this.generateSessionId();
    this.userId = userId;
    this.conversationId = conversationId;
    this.startedAt = new Date();

    // Initialize shared knowledge for this run
    SharedKnowledge.initRun(this.runId, userId, conversationId);

    console.log(`[RunContext] Created run ${this.runId} for user ${userId}`);
  }

  /**
   * Set the current executing agent
   */
  setCurrentAgent(agentType: AgentType): void {
    // Complete previous agent if any
    if (this.currentAgent) {
      this.completeAgentExecution();
    }

    this.currentAgent = agentType;
    this.agentExecutions.push({
      agentType,
      startedAt: new Date(),
      toolsUsed: [],
      messagesPublished: 0,
    });

    // Create publisher for this agent
    this.publisher = createAgentPublisher(agentType);

    // Record in shared knowledge
    SharedKnowledge.recordAgentInvolved(this.runId, agentType);

    console.log(`[RunContext] Agent ${agentType} started`);
  }

  /**
   * Get current agent publisher
   */
  getPublisher(): ReturnType<typeof createAgentPublisher> {
    if (!this.publisher) {
      throw new Error("No agent is currently executing. Call setCurrentAgent first.");
    }
    return this.publisher;
  }

  /**
   * Complete current agent execution
   */
  completeAgentExecution(): void {
    const currentExecution = this.getCurrentExecution();
    if (currentExecution && !currentExecution.completedAt) {
      currentExecution.completedAt = new Date();
      console.log(`[RunContext] Agent ${this.currentAgent} completed`);
    }
  }

  /**
   * Record a tool being used
   */
  recordToolUse(toolName: string, input: any, output: any, cached: boolean = false): void {
    const cacheKey = this.createToolCacheKey(toolName, input);

    const result: ToolResult = {
      toolName,
      input,
      output,
      timestamp: new Date(),
      cached,
    };

    this.toolResults.set(cacheKey, result);

    // Record in current agent execution
    const currentExecution = this.getCurrentExecution();
    if (currentExecution && !currentExecution.toolsUsed.includes(toolName)) {
      currentExecution.toolsUsed.push(toolName);
    }
  }

  /**
   * Get cached tool result
   */
  getCachedToolResult(toolName: string, input: any): any | undefined {
    const cacheKey = this.createToolCacheKey(toolName, input);
    const cached = this.toolResults.get(cacheKey);

    if (cached) {
      console.log(`[RunContext] Cache hit for ${toolName}`);
      return cached.output;
    }

    return undefined;
  }

  /**
   * Check if tool result is cached
   */
  hasToolCache(toolName: string, input: any): boolean {
    const cacheKey = this.createToolCacheKey(toolName, input);
    return this.toolResults.has(cacheKey);
  }

  /**
   * Record a message being published
   */
  recordMessagePublished(): void {
    const currentExecution = this.getCurrentExecution();
    if (currentExecution) {
      currentExecution.messagesPublished++;
    }
  }

  /**
   * Set metadata
   */
  setMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  /**
   * Get metadata
   */
  getMetadata<T = any>(key: string): T | undefined {
    return this.metadata[key] as T;
  }

  /**
   * Get shared knowledge for this run
   */
  getKnowledge(): RunKnowledge | undefined {
    return SharedKnowledge.getRun(this.runId);
  }

  /**
   * Build context summary for prompts
   */
  buildPromptContext(): string {
    return SharedKnowledge.buildContextSummary(this.runId);
  }

  /**
   * Get message history for this run
   */
  getMessageHistory() {
    return AgentMessenger.getHistory(this.runId);
  }

  /**
   * Get all signals discovered in this run
   */
  getDiscoveredSignals() {
    return AgentMessenger.getSignals(this.runId);
  }

  /**
   * Get current execution
   */
  private getCurrentExecution(): AgentExecution | undefined {
    return this.agentExecutions[this.agentExecutions.length - 1];
  }

  /**
   * Create cache key for tool results
   */
  private createToolCacheKey(toolName: string, input: any): string {
    const inputStr = JSON.stringify(input, Object.keys(input).sort());
    return `${toolName}:${inputStr}`;
  }

  /**
   * Generate unique run ID
   */
  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }

  /**
   * Get execution summary
   */
  getSummary(): {
    runId: string;
    duration: number;
    agents: string[];
    toolsUsed: string[];
    messagesPublished: number;
  } {
    const allTools: string[] = [];
    let totalMessages = 0;

    this.agentExecutions.forEach((exec) => {
      exec.toolsUsed.forEach((tool) => {
        if (!allTools.includes(tool)) allTools.push(tool);
      });
      totalMessages += exec.messagesPublished;
    });

    return {
      runId: this.runId,
      duration: Date.now() - this.startedAt.getTime(),
      agents: this.agentExecutions.map((e) => e.agentType),
      toolsUsed: allTools,
      messagesPublished: totalMessages,
    };
  }

  /**
   * Cleanup run resources
   */
  cleanup(): void {
    this.completeAgentExecution();
    AgentMessenger.clearHistory(this.runId);
    SharedKnowledge.clearRun(this.runId);
    console.log(`[RunContext] Cleaned up run ${this.runId}`);
  }

  /**
   * Serialize context data
   */
  toJSON(): RunContextData {
    return {
      runId: this.runId,
      sessionId: this.sessionId,
      userId: this.userId,
      conversationId: this.conversationId,
      startedAt: this.startedAt,
      currentAgent: this.currentAgent,
      agentExecutions: this.agentExecutions,
      toolResults: this.toolResults,
      metadata: this.metadata,
    };
  }
}

// Factory function for creating run contexts
export function createRunContext(
  userId: number,
  conversationId?: number,
  existingRunId?: string
): RunContext {
  return new RunContext(userId, conversationId, existingRunId);
}

// Store for active runs (for cleanup and debugging)
const activeRuns: Map<string, RunContext> = new Map();

export function registerRun(ctx: RunContext): void {
  activeRuns.set(ctx.runId, ctx);
}

export function unregisterRun(runId: string): void {
  const ctx = activeRuns.get(runId);
  if (ctx) {
    ctx.cleanup();
    activeRuns.delete(runId);
  }
}

export function getActiveRuns(): RunContext[] {
  return Array.from(activeRuns.values());
}
