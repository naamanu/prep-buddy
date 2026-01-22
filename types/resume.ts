// Resume-Based Mock Interview Types
// See SPEC.md Section 3.2 for full data model documentation

export interface ResumeData {
  name: string;
  email?: string;
  phone?: string;
  summary?: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  projects: Project[];
}

export interface WorkExperience {
  title: string;
  company: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
}

export interface Education {
  degree: string;
  school: string;
  year?: string;
  gpa?: string;
}

export interface Project {
  name: string;
  description?: string;
  technologies: string[];
  highlights?: string[];
}

export type PersonaType = 'friendly' | 'professional' | 'challenging';

/** Gemini Live API voice options */
export type GeminiVoice = 'Kore' | 'Puck' | 'Fenrir' | 'Aoede' | 'Charon';

export interface InterviewSession {
  id: string;
  resumeData: ResumeData;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  transcript: TranscriptMessage[];
  persona: PersonaType;
  duration: number; // minutes (from duration picker)
  status: 'in-progress' | 'completed' | 'incomplete';
  startedAt: number;
  endedAt?: number;
  feedback?: InterviewFeedback;
}

export interface InterviewQuestion {
  id: string;
  content: string;
  type: 'initial' | 'follow-up';
  asked: boolean;
  askedAt?: number;
}

export interface InterviewFeedback {
  overallAssessment: string;
  strengths: string[];
  areasForImprovement: string[];
  suggestedTopics: string[];
  briefAnswerWarning?: string; // Added if answers were too shallow
  questionFeedback: QuestionFeedback[];
}

export interface QuestionFeedback {
  question: string;
  assessment: string;
  suggestion: string;
}

export interface TranscriptMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

// Storage types for encrypted IndexedDB
export interface StoredSession {
  id: string;
  encryptedData: ArrayBuffer;
  iv: Uint8Array;
  createdAt: number;
  status: 'in-progress' | 'completed' | 'incomplete';
}

export interface SessionLock {
  sessionId: string;
  lockedAt: number;
}

// Persona configuration type
export interface PersonaConfig {
  id: PersonaType;
  title: string;
  description: string;
  systemModifier: string;
  questionStyle: string;
  followUpDepth: 'light' | 'moderate' | 'deep';
  voice: GeminiVoice;
}

// Interview state machine states
export type InterviewFlowState =
  | 'INITIAL'
  | 'BLOCKED'
  | 'UPLOAD'
  | 'PARSING'
  | 'PARSE_ERROR'
  | 'REVIEW'
  | 'SETUP'
  | 'GENERATING'
  | 'GEN_ERROR'
  | 'INTERVIEWING'
  | 'ANALYZING'
  | 'COMPLETE';
