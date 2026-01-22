import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/utils/logger';
import {
  type ResumeData,
  type PersonaType,
  type InterviewQuestion,
  type TranscriptMessage,
  type InterviewFeedback,
  type InterviewFlowState,
} from '@/types/resume';
import {
  checkBrowserCapabilities,
  type BrowserCapabilities,
} from '@/utils/browserCheck';
import { GeminiService } from '@/packages/gemini-service/src';
import {
  saveSession,
  saveResume,
  type InterviewSessionData,
} from '@/packages/storage/src/indexedDB';
import {
  acquireLock,
  releaseLock,
  isBlocked,
  getBlockingSessionId,
  refreshLock,
} from '@/packages/storage/src/sessionLock';

export interface UseInterviewFlowOptions {
  geminiService: GeminiService;
}

export interface UseInterviewFlowReturn {
  // Flow control
  flowState: InterviewFlowState;
  error: string | null;
  browserCapabilities: BrowserCapabilities | null;

  // Resume state
  resumeText: string;
  resumeData: ResumeData | null;

  // Configuration
  persona: PersonaType | null;
  setPersona: React.Dispatch<React.SetStateAction<PersonaType | null>>;
  duration: number;
  setDuration: React.Dispatch<React.SetStateAction<number>>;

  // Active session state
  sessionId: string;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  transcript: TranscriptMessage[];
  feedback: InterviewFeedback | null;
  startedAt: number;

  // Resume handlers
  handleResumeText: (text: string) => Promise<void>;
  handleResumeUpdate: (data: ResumeData) => void;
  handleResumeConfirm: () => void;
  handleResetToUpload: () => void;
  handleSelectSavedResume: (data: ResumeData) => void;

  // Interview handlers
  handleStartInterview: () => Promise<void>;
  handleQuestionComplete: () => void;
  handleInterviewEnd: (
    finalTranscript: TranscriptMessage[],
    wasEarly: boolean
  ) => Promise<void>;
  handleStartNew: () => void;

  // Utility handlers
  handleForceRelease: () => void;
  handleRetryBrowserCheck: () => void;

  // Callback to reload sessions after interview ends (for coordination)
  onInterviewComplete?: () => void;
  setOnInterviewComplete: (cb: (() => void) | undefined) => void;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function useInterviewFlow(
  options: UseInterviewFlowOptions
): UseInterviewFlowReturn {
  const { geminiService } = options;

  // Browser capabilities
  const [browserCapabilities, setBrowserCapabilities] =
    useState<BrowserCapabilities | null>(null);

  // Flow state
  const [flowState, setFlowState] = useState<InterviewFlowState>('INITIAL');
  const [error, setError] = useState<string | null>(null);

  // Session data
  const [sessionId, setSessionId] = useState<string>('');
  const [resumeText, setResumeText] = useState('');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [persona, setPersona] = useState<PersonaType | null>(null);
  const [duration, setDuration] = useState<number>(30);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);

  // Callback ref for coordination with parent
  const onInterviewCompleteRef = useRef<(() => void) | undefined>(undefined);

  const setOnInterviewComplete = useCallback(
    (cb: (() => void) | undefined) => {
      onInterviewCompleteRef.current = cb;
    },
    []
  );

  // Refs for stale-closure prevention in async callbacks
  const resumeDataRef = useRef(resumeData);
  const personaRef = useRef(persona);
  const questionsRef = useRef(questions);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const durationRef = useRef(duration);
  const sessionIdRef = useRef(sessionId);
  const startedAtRef = useRef(startedAt);

  // Keep refs in sync with state
  useEffect(() => {
    resumeDataRef.current = resumeData;
  }, [resumeData]);
  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  // Check browser capabilities on mount
  useEffect(() => {
    const capabilities = checkBrowserCapabilities();
    setBrowserCapabilities(capabilities);

    if (!capabilities.allSupported) {
      return;
    }

    // Check for session lock
    if (isBlocked()) {
      const blockingId = getBlockingSessionId();
      if (blockingId) {
        setFlowState('BLOCKED');
        return;
      }
    }

    setFlowState('UPLOAD');
  }, []);

  // Refresh lock periodically during interview
  useEffect(() => {
    if (flowState === 'INTERVIEWING' && sessionId) {
      const interval = setInterval(() => {
        refreshLock(sessionId);
      }, 60000); // Every minute

      return () => clearInterval(interval);
    }
  }, [flowState, sessionId]);

  // Handle resume text extraction and parsing
  const handleResumeText = useCallback(
    async (text: string) => {
      setResumeText(text);
      setFlowState('PARSING');
      setError(null);

      try {
        const parsed = await geminiService.parseResume(text);
        setResumeData(parsed);
        setFlowState('REVIEW');
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to parse resume';
        setError(message);
        setFlowState('PARSE_ERROR');
      }
    },
    [geminiService]
  );

  // Handle resume data update (inline editing)
  const handleResumeUpdate = useCallback((data: ResumeData) => {
    setResumeData(data);
  }, []);

  // Handle resume confirm (move to setup)
  const handleResumeConfirm = useCallback(() => {
    setFlowState('SETUP');
  }, []);

  // Handle reset to upload state
  const handleResetToUpload = useCallback(() => {
    setResumeText('');
    setResumeData(null);
    setFlowState('UPLOAD');
  }, []);

  // Handle selecting a saved resume
  const handleSelectSavedResume = useCallback((data: ResumeData) => {
    setResumeData(data);
    setFlowState('REVIEW'); // Skip PARSING - already parsed
  }, []);

  // Handle start interview
  const handleStartInterview = useCallback(async () => {
    const currentResumeData = resumeDataRef.current;
    const currentPersona = personaRef.current;
    const currentDuration = durationRef.current;

    if (!currentResumeData || !currentPersona) return;

    setFlowState('GENERATING');
    setError(null);

    try {
      // Generate session ID and acquire lock
      const newSessionId = generateSessionId();
      const lockAcquired = await acquireLock(newSessionId);

      if (!lockAcquired) {
        setError(
          'Another interview session is in progress. Please complete or end it first.'
        );
        setFlowState('BLOCKED');
        return;
      }

      setSessionId(newSessionId);

      // Generate questions
      const generatedQuestions =
        await geminiService.generateInterviewQuestions(
          currentResumeData,
          currentPersona,
          currentDuration
        );

      // Add 'asked' field to questions
      const questionsWithState: InterviewQuestion[] = generatedQuestions.map(
        (q) => ({
          ...q,
          asked: false,
        })
      );

      setQuestions(questionsWithState);
      setCurrentQuestionIndex(0);
      setTranscript([]);

      // Save initial session
      const sessionStartTime = Date.now();
      setStartedAt(sessionStartTime);

      // Save resume separately (decoupled from session)
      await saveResume(currentResumeData);

      const session: InterviewSessionData = {
        id: newSessionId,
        resumeData: currentResumeData,
        questions: questionsWithState,
        currentQuestionIndex: 0,
        transcript: [],
        persona: currentPersona,
        duration: currentDuration,
        status: 'in-progress',
        startedAt: sessionStartTime,
      };

      await saveSession(session);

      setFlowState('INTERVIEWING');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate questions';
      setError(message);
      setFlowState('GEN_ERROR');
    }
  }, [geminiService]);

  // Handle question complete (advance to next)
  const handleQuestionComplete = useCallback(() => {
    const currentQuestions = questionsRef.current;
    const currentIndex = currentQuestionIndexRef.current;

    if (currentIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, []);

  // Handle interview end
  const handleInterviewEnd = useCallback(
    async (finalTranscript: TranscriptMessage[], wasEarly: boolean) => {
      const currentResumeData = resumeDataRef.current;
      const currentPersona = personaRef.current;
      const currentQuestions = questionsRef.current;
      const currentIndex = currentQuestionIndexRef.current;
      const currentDuration = durationRef.current;
      const currentSessionId = sessionIdRef.current;
      const currentStartedAt = startedAtRef.current;

      // Defensive guard - should never happen if flow is correct
      if (!currentResumeData || !currentPersona) {
        logger.error('handleInterviewEnd called with missing data', {
          hasResumeData: !!currentResumeData,
          hasPersona: !!currentPersona,
        });
        setError('Missing interview data - cannot complete session');
        releaseLock(currentSessionId);
        setFlowState('COMPLETE');
        return;
      }

      setTranscript(finalTranscript);
      setFlowState('ANALYZING');

      try {
        // Generate feedback
        const interviewFeedback = await geminiService.analyzeInterviewSession(
          currentResumeData,
          finalTranscript,
          currentQuestions.filter((_, i) => i <= currentIndex),
          currentPersona,
          wasEarly
        );

        setFeedback(interviewFeedback);

        // Update and save session
        const session: InterviewSessionData = {
          id: currentSessionId,
          resumeData: currentResumeData,
          questions: currentQuestions,
          currentQuestionIndex: currentIndex,
          transcript: finalTranscript,
          persona: currentPersona,
          duration: currentDuration,
          status: wasEarly ? 'incomplete' : 'completed',
          startedAt: currentStartedAt,
          endedAt: Date.now(),
          feedback: interviewFeedback,
        };

        await saveSession(session);

        // Release lock
        releaseLock(currentSessionId);

        // Notify parent to reload sessions
        onInterviewCompleteRef.current?.();

        setFlowState('COMPLETE');
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to analyze interview';
        setError(message);

        // Save session without feedback (preserve interview data)
        const session: InterviewSessionData = {
          id: currentSessionId,
          resumeData: currentResumeData,
          questions: currentQuestions,
          currentQuestionIndex: currentIndex,
          transcript: finalTranscript,
          persona: currentPersona,
          duration: currentDuration,
          status: 'incomplete',
          startedAt: currentStartedAt,
          endedAt: Date.now(),
          // feedback: undefined - analysis failed
        };
        await saveSession(session).catch((e) =>
          logger.error('Failed to save session after analysis error:', e)
        );

        // Release lock even on error to prevent BLOCKED state
        releaseLock(currentSessionId);

        // Notify parent to reload sessions
        onInterviewCompleteRef.current?.();

        // Still show complete but without feedback
        setFlowState('COMPLETE');
      }
    },
    [geminiService]
  );

  // Handle starting a new interview
  const handleStartNew = useCallback(() => {
    setResumeText('');
    setResumeData(null);
    setPersona(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setTranscript([]);
    setFeedback(null);
    setSessionId('');
    setFlowState('UPLOAD');
  }, []);

  // Handle force release of session lock
  const handleForceRelease = useCallback(() => {
    const blockingId = getBlockingSessionId();
    if (blockingId) {
      releaseLock(blockingId);
    }
    setFlowState('UPLOAD');
  }, []);

  // Handle retry browser capability check
  const handleRetryBrowserCheck = useCallback(() => {
    const newCapabilities = checkBrowserCapabilities();
    setBrowserCapabilities(newCapabilities);
    if (newCapabilities.allSupported) {
      setFlowState('UPLOAD');
    }
  }, []);

  return {
    // Flow control
    flowState,
    error,
    browserCapabilities,

    // Resume state
    resumeText,
    resumeData,

    // Configuration
    persona,
    setPersona,
    duration,
    setDuration,

    // Active session state
    sessionId,
    questions,
    currentQuestionIndex,
    transcript,
    feedback,
    startedAt,

    // Resume handlers
    handleResumeText,
    handleResumeUpdate,
    handleResumeConfirm,
    handleResetToUpload,
    handleSelectSavedResume,

    // Interview handlers
    handleStartInterview,
    handleQuestionComplete,
    handleInterviewEnd,
    handleStartNew,

    // Utility handlers
    handleForceRelease,
    handleRetryBrowserCheck,

    // Coordination
    setOnInterviewComplete,
  };
}
