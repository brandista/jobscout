/**
 * JobScout Agent System - Shared Types
 */

export type AgentType = 
  | "career_coach"
  | "job_analyzer" 
  | "company_intel"
  | "interview_prep"
  | "negotiator"
  | "signal_scout";

export interface AgentInfo {
  id: AgentType;
  name: string;
  nameFi: string;
  description: string;
  descriptionFi: string;
  icon: string;
  color: string;
  capabilities: string[];
}

export const AGENTS: Record<AgentType, AgentInfo> = {
  career_coach: {
    id: "career_coach",
    name: "Career Coach",
    nameFi: "Uravalmentaja",
    description: "Strategic career guidance, CV optimization, and professional development",
    descriptionFi: "Urastrategia, CV:n optimointi ja ammatillinen kehitys",
    icon: "🎯",
    color: "#8B5CF6",
    capabilities: [
      "CV and profile review",
      "Career path planning", 
      "Skill gap analysis",
      "Job search strategy",
      "Personal branding"
    ]
  },
  job_analyzer: {
    id: "job_analyzer",
    name: "Job Analyzer",
    nameFi: "Työpaikka-analyytikko",
    description: "Deep analysis of job opportunities and personalized matching insights",
    descriptionFi: "Työpaikkojen syvällinen analyysi ja henkilökohtaiset match-näkemykset",
    icon: "🔍",
    color: "#3B82F6",
    capabilities: [
      "Job-profile matching",
      "Requirements analysis",
      "Opportunity scoring",
      "Job comparison",
      "Hidden requirements detection"
    ]
  },
  company_intel: {
    id: "company_intel",
    name: "Company Intel",
    nameFi: "Yritystiedustelu",
    description: "Company research, culture insights, and market intelligence",
    descriptionFi: "Yritystutkimus, kulttuurianalyysi ja markkinatiedustelu",
    icon: "🏢",
    color: "#10B981",
    capabilities: [
      "Company analysis",
      "Culture assessment",
      "Growth signals",
      "News monitoring",
      "Employee insights"
    ]
  },
  interview_prep: {
    id: "interview_prep",
    name: "Interview Prep",
    nameFi: "Haastatteluvalmennus",
    description: "Interview preparation, practice questions, and feedback",
    descriptionFi: "Haastatteluvalmistelu, harjoituskysymykset ja palaute",
    icon: "📝",
    color: "#F59E0B",
    capabilities: [
      "Question generation",
      "Answer coaching",
      "Mock interviews",
      "STAR method training",
      "Company-specific prep"
    ]
  },
  negotiator: {
    id: "negotiator",
    name: "Negotiator",
    nameFi: "Neuvotteluapu",
    description: "Salary negotiation, benefits optimization, and offer evaluation",
    descriptionFi: "Palkkaneuvottelu, etujen optimointi ja tarjousten arviointi",
    icon: "💰",
    color: "#EF4444",
    capabilities: [
      "Salary research",
      "Negotiation strategy",
      "Offer comparison",
      "Benefits analysis",
      "Counter-offer tactics"
    ]
  },
  signal_scout: {
    id: "signal_scout",
    name: "Väinö",
    nameFi: "Signaalitietäjä",
    description: "Predictive hiring intelligence - sees recruitment signals before jobs are posted",
    descriptionFi: "Ennustava rekrytointitiedustelu - näkee signaalit ennen kuin paikat julkaistaan",
    icon: "🔮",
    color: "#6366F1",
    capabilities: [
      "YTJ/PRH company data analysis",
      "News & funding signal detection",
      "GitHub activity monitoring",
      "Hiring probability prediction",
      "Company watchlist & alerts"
    ]
  }
};

export interface UserContext {
  userId: number;
  profile: ProfileContext | null;
  savedJobs: JobContext[];
  topMatches: MatchContext[];
  recentCompanies: CompanyContext[];
}

export interface ProfileContext {
  currentTitle: string | null;
  yearsOfExperience: number | null;
  skills: string[];
  languages: string[];
  certifications: string[];
  degree: string | null;
  field: string | null;
  preferredJobTitles: string[];
  preferredIndustries: string[];
  preferredLocations: string[];
  employmentTypes: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  remotePreference: string | null;
  workHistory: WorkHistoryItem[];
  targetFunctions: string[];
}

export interface WorkHistoryItem {
  company: string;
  title: string;
  duration: string;
  description: string;
}

export interface JobContext {
  id: number;
  title: string;
  company: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  employmentType: string | null;
  remoteType: string | null;
  industry: string | null;
  requiredSkills: string[];
  url: string | null;
}

export interface MatchContext {
  jobId: number;
  jobTitle: string;
  company: string;
  totalScore: number;
  skillScore: number;
  experienceScore: number;
  locationScore: number;
  matchCategory: string | null;
}

export interface CompanyContext {
  id: number;
  name: string;
  industry: string | null;
  talentNeedScore: number | null;
  profileMatchScore: number | null;
  combinedScore: number | null;
  reasons: string[];
  recentEvents: EventContext[];
  openPositions: number;
}

export interface EventContext {
  eventType: string;
  headline: string;
  summary: string | null;
  impactStrength: string | null;
  publishedAt: Date | null;
}

export interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls: ToolCall[] | null;
  toolResults: ToolResult[] | null;
  createdAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  result: any;
}

export interface Conversation {
  id: number;
  userId: number;
  agentType: AgentType;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  conversationId?: number;
  agentType: AgentType;
  message: string;
  fileBase64?: string;
  fileName?: string;
}

export interface ChatResponse {
  conversationId: number;
  message: Message;
  suggestedFollowUps?: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: Record<string, any>, context: UserContext) => Promise<any>;
}
