// Re-export all types for convenient importing
export * from './question';
export * from './chat';
export * from './storage';
export * from './reference';
export * from './whiteboard';
export * from './service';
export * from './resume';

// Explicit re-exports for better TypeScript resolution
export type { QuestionProgress, StorageServiceConfig } from './storage';
export type { DiagramElement } from './whiteboard';
export type { Question, AnalysisRequest, AnalysisResult, QuestionInput } from './question';
export type { ChatMessage } from './chat';
export type { ReferenceItem } from './reference';
export type { GeminiServiceConfig } from './service';
export type {
  ResumeData,
  WorkExperience,
  Education,
  Project,
  PersonaType,
  InterviewSession,
  InterviewQuestion,
  InterviewFeedback,
  QuestionFeedback,
  TranscriptMessage,
  StoredSession,
  SessionLock,
  PersonaConfig,
  InterviewFlowState,
} from './resume';
