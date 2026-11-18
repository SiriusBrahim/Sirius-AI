export type Mode = 'auto' | 'manual';
export type Phase = 'idle' | 'running' | 'waiting_manual' | 'cooldown' | 'paused' | 'completed' | 'error';
export type PlanKey = 'v1' | 'v2' | 'final';
export type ProviderKey = 'gemini' | 'claude' | 'chatgpt' | 'deepseek';

export interface AgentConfig {
  id: number;
  title: string;
  provider: ProviderKey;
  url: string;
  planKey: PlanKey;
  planFile: string;
  rolePrompt: string;
  lastTranscript: string;
  hasActiveSession: boolean;
}

export interface LogEntry {
  id: string;
  time: string;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
}

export interface ExtractedBlock {
  id: string;
  agentTitle: string;
  language: string;
  fileHint: string | null;
  code: string;
}

export interface MemoryHistoryItem {
  id: string;
  timestamp: string;
  agentTitle: string;
  stage: number;
  summary: string;
}

export interface ProjectMemory {
  architectureSummary: string;
  techStack: string;
  constraints: string;
  decisions: string[];
  history: MemoryHistoryItem[];
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  sourceLabel: string;
  createdAt: string;
  updatedAt: string;
  files: Record<string, string>;
  projectIdea: string;
  mode: Mode;
  phase: Phase;
  currentStage: number;
  failedStage: number | null;
  plans: Record<PlanKey, string>;
  codeBlocks: ExtractedBlock[];
  logs: LogEntry[];
  agents: AgentConfig[];
  memory: ProjectMemory;
}
