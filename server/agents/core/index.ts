/**
 * JobScout Agent Core - Message Bus & Shared Knowledge
 *
 * This module provides the infrastructure for inter-agent communication,
 * inspired by BemuFix's swarm architecture.
 *
 * Components:
 * - AgentMessenger: Pub/sub messaging for agent collaboration
 * - SharedKnowledge: Collective knowledge base
 * - RunContext: Per-request execution isolation
 */

export {
  AgentMessenger,
  createAgentPublisher,
  type AgentMessage,
  type AgentMessageType,
  type SignalPayload,
  type AnalysisRequestPayload,
  type AnalysisResponsePayload,
} from "./AgentMessenger";

export {
  SharedKnowledge,
  type CompanyKnowledge,
  type UserInsight,
  type RunKnowledge,
} from "./SharedKnowledge";

export {
  RunContext,
  createRunContext,
  registerRun,
  unregisterRun,
  getActiveRuns,
  type RunContextData,
  type ToolResult,
  type AgentExecution,
} from "./RunContext";
