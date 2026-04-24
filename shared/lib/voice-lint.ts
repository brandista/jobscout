export type AgentId = "signal_scout" | "career_coach" | "job_analyzer";

export interface LintResult {
  ok: boolean;
  violations: string[];
}

type Rule = { pattern: RegExp; message: string };

const RULES: Record<AgentId, Rule[]> = {
  signal_scout: [
    { pattern: /\bsinun\b/i,       message: "signal_scout ei käytä toisen persoonan puhuttelua" },
    { pattern: /\bprofiilistasi\b/i, message: "signal_scout ei käytä toisen persoonan puhuttelua" },
    { pattern: /\bSinä\b/i,        message: "signal_scout ei käytä toisen persoonan puhuttelua" },
  ],
  career_coach: [
    { pattern: /\bSignaali:/i,     message: "career_coach ei käytä kenttäraportteri-jargonia" },
    { pattern: /\bLähde:/i,        message: "career_coach ei käytä kenttäraportteri-jargonia" },
    { pattern: /\bPRH-rekisteri/i, message: "career_coach ei käytä kenttäraportteri-jargonia" },
  ],
  job_analyzer: [
    { pattern: /\bHienoa\b/i,      message: "job_analyzer ei käytä kehuvaa kieltä" },
    { pattern: /\bMahtavaa\b/i,    message: "job_analyzer ei käytä kehuvaa kieltä" },
    { pattern: /\bErinomaisesti\b/i, message: "job_analyzer ei käytä kehuvaa kieltä" },
  ],
};

export function lintAgentNote(agentId: AgentId, text: string): LintResult {
  const rules = RULES[agentId] ?? [];
  const violations = rules
    .filter(r => r.pattern.test(text))
    .map(r => r.message);
  return { ok: violations.length === 0, violations };
}
