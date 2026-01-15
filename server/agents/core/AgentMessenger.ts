/**
 * AgentMessenger - Inter-agent communication system
 *
 * Inspired by BemuFix's swarm architecture.
 * Provides pub/sub messaging for agent collaboration.
 *
 * Features:
 * - Synchronous message passing between agents
 * - Event publishing for agent discoveries
 * - Message history for context building
 * - In-memory implementation (can be extended to Redis)
 */

import { EventEmitter } from "events";

// Message types for agent communication
export type AgentMessageType =
  | "signal_discovered"      // Väinö found a hiring signal
  | "company_analyzed"       // Company Intel completed analysis
  | "job_matched"            // Job Analyzer found a match
  | "interview_scheduled"    // Interview Prep is needed
  | "negotiation_advice"     // Negotiator has advice
  | "career_insight"         // Career Coach has insight
  | "request_analysis"       // Agent requests another agent's help
  | "response_ready"         // Agent has completed a request
  | "context_update"         // Shared context has been updated
  | "user_action";           // User took an action

export interface AgentMessage {
  id: string;
  type: AgentMessageType;
  sourceAgent: string;
  targetAgent?: string;      // If null, broadcast to all
  payload: any;
  timestamp: Date;
  runId: string;            // Links to RunContext
  conversationId?: number;
  priority: "low" | "normal" | "high";
}

export interface SignalPayload {
  companyName: string;
  score: number;
  confidence: string;
  signals: string[];
  timing: string;
  recommendation: string;
}

export interface AnalysisRequestPayload {
  requestId: string;
  question: string;
  context?: any;
  waitForResponse: boolean;
}

export interface AnalysisResponsePayload {
  requestId: string;
  response: any;
  success: boolean;
}

/**
 * AgentMessenger - Central message bus for agent communication
 */
class AgentMessengerClass extends EventEmitter {
  private messageHistory: Map<string, AgentMessage[]> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private readonly MESSAGE_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_HISTORY_PER_RUN = 100;

  constructor() {
    super();
    this.setMaxListeners(20); // Support many agent listeners
  }

  /**
   * Publish a message to the bus
   */
  publish(message: Omit<AgentMessage, "id" | "timestamp">): AgentMessage {
    const fullMessage: AgentMessage = {
      ...message,
      id: this.generateId(),
      timestamp: new Date(),
    };

    // Store in history
    this.addToHistory(fullMessage);

    // Emit to listeners
    if (message.targetAgent) {
      // Direct message to specific agent
      this.emit(`agent:${message.targetAgent}`, fullMessage);
    } else {
      // Broadcast to all
      this.emit("broadcast", fullMessage);
    }

    // Also emit by type for specific handlers
    this.emit(`type:${message.type}`, fullMessage);

    console.log(`[AgentMessenger] ${message.sourceAgent} → ${message.targetAgent || "ALL"}: ${message.type}`);

    return fullMessage;
  }

  /**
   * Publish a signal discovery (from Väinö)
   */
  publishSignal(runId: string, signal: SignalPayload, conversationId?: number): AgentMessage {
    return this.publish({
      type: "signal_discovered",
      sourceAgent: "signal_scout",
      payload: signal,
      runId,
      conversationId,
      priority: signal.score >= 75 ? "high" : "normal",
    });
  }

  /**
   * Request analysis from another agent (synchronous-style with async)
   */
  async requestAnalysis(
    sourceAgent: string,
    targetAgent: string,
    runId: string,
    question: string,
    context?: any
  ): Promise<any> {
    const requestId = this.generateId();

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Analysis request timed out after ${this.MESSAGE_TIMEOUT}ms`));
      }, this.MESSAGE_TIMEOUT);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Publish request
      this.publish({
        type: "request_analysis",
        sourceAgent,
        targetAgent,
        payload: {
          requestId,
          question,
          context,
          waitForResponse: true,
        } as AnalysisRequestPayload,
        runId,
        priority: "high",
      });
    });
  }

  /**
   * Respond to an analysis request
   */
  respondToRequest(
    sourceAgent: string,
    requestId: string,
    runId: string,
    response: any,
    success: boolean = true
  ): void {
    const pending = this.pendingRequests.get(requestId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);

      if (success) {
        pending.resolve(response);
      } else {
        pending.reject(new Error(response?.error || "Analysis failed"));
      }
    }

    // Also publish for logging/history
    this.publish({
      type: "response_ready",
      sourceAgent,
      payload: {
        requestId,
        response,
        success,
      } as AnalysisResponsePayload,
      runId,
      priority: "normal",
    });
  }

  /**
   * Subscribe to messages for a specific agent
   */
  subscribeAgent(agentType: string, handler: (message: AgentMessage) => void): () => void {
    const listener = (message: AgentMessage) => handler(message);

    this.on(`agent:${agentType}`, listener);
    this.on("broadcast", listener);

    // Return unsubscribe function
    return () => {
      this.off(`agent:${agentType}`, listener);
      this.off("broadcast", listener);
    };
  }

  /**
   * Subscribe to a specific message type
   */
  subscribeToType(type: AgentMessageType, handler: (message: AgentMessage) => void): () => void {
    const listener = (message: AgentMessage) => handler(message);
    this.on(`type:${type}`, listener);
    return () => this.off(`type:${type}`, listener);
  }

  /**
   * Get message history for a run
   */
  getHistory(runId: string): AgentMessage[] {
    return this.messageHistory.get(runId) || [];
  }

  /**
   * Get messages from a specific agent in a run
   */
  getAgentMessages(runId: string, agentType: string): AgentMessage[] {
    const history = this.getHistory(runId);
    return history.filter(m => m.sourceAgent === agentType);
  }

  /**
   * Get all signals discovered in a run
   */
  getSignals(runId: string): SignalPayload[] {
    const history = this.getHistory(runId);
    return history
      .filter(m => m.type === "signal_discovered")
      .map(m => m.payload as SignalPayload);
  }

  /**
   * Clear history for a run (cleanup)
   */
  clearHistory(runId: string): void {
    this.messageHistory.delete(runId);
    console.log(`[AgentMessenger] Cleared history for run ${runId}`);
  }

  /**
   * Add message to history
   */
  private addToHistory(message: AgentMessage): void {
    const history = this.messageHistory.get(message.runId) || [];
    history.push(message);

    // Limit history size
    if (history.length > this.MAX_HISTORY_PER_RUN) {
      history.shift();
    }

    this.messageHistory.set(message.runId, history);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get stats for debugging
   */
  getStats(): { activeRuns: number; totalMessages: number; pendingRequests: number } {
    let totalMessages = 0;
    this.messageHistory.forEach(history => {
      totalMessages += history.length;
    });

    return {
      activeRuns: this.messageHistory.size,
      totalMessages,
      pendingRequests: this.pendingRequests.size,
    };
  }
}

// Singleton instance
export const AgentMessenger = new AgentMessengerClass();

// Helper to create agent-specific publishers
export function createAgentPublisher(agentType: string) {
  return {
    publishSignal: (runId: string, signal: SignalPayload, conversationId?: number) =>
      AgentMessenger.publishSignal(runId, signal, conversationId),

    publish: (runId: string, type: AgentMessageType, payload: any, priority: "low" | "normal" | "high" = "normal") =>
      AgentMessenger.publish({
        type,
        sourceAgent: agentType,
        payload,
        runId,
        priority,
      }),

    requestAnalysis: (targetAgent: string, runId: string, question: string, context?: any) =>
      AgentMessenger.requestAnalysis(agentType, targetAgent, runId, question, context),

    respondToRequest: (requestId: string, runId: string, response: any, success?: boolean) =>
      AgentMessenger.respondToRequest(agentType, requestId, runId, response, success),
  };
}
