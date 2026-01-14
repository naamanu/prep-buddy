import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { logger } from '@/utils/logger';
import {
  type ResumeData,
  type PersonaType,
  type InterviewQuestion,
  type TranscriptMessage,
  type InterviewFeedback,
  type InterviewFlowState,
} from '../types/resume';
import { checkBrowserCapabilities, type BrowserCapabilities } from '../utils/browserCheck';
import { GeminiService } from '../packages/gemini-service/src';
import {
  saveSession,
  getSession,
  getAllSessions,
  deleteSession,
  type InterviewSessionData,
  getAllResumes,
  deleteResume,
  saveResume,
  type StoredResume,
} from '../packages/storage/src/indexedDB';
import {
  acquireLock,
  releaseLock,
  isBlocked,
  getBlockingSessionId,
  refreshLock,
} from '../packages/storage/src/sessionLock';

import BrowserCompatError from './BrowserCompatError';
import ResumeUpload from './ResumeUpload';
import ResumeSummaryCard from './ResumeSummaryCard';
import PersonaSelector from './PersonaSelector';
import MockInterviewPanel from './MockInterviewPanel';
import InterviewReview from './InterviewReview';
import SessionHistoryGrid from './SessionHistoryGrid';
import SavedResumePicker from './SavedResumePicker';
import InterviewErrorBoundary from './InterviewErrorBoundary';
import LoadingSpinner from './LoadingSpinner';
import ErrorCard from './ErrorCard';
import SessionBlockedCard from './SessionBlockedCard';
import DurationPicker from './DurationPicker';

interface MockInterviewAppProps {
  onNavigateHome: () => void;
}

const geminiService = new GeminiService({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

const MockInterviewApp: React.FC<MockInterviewAppProps> = ({ onNavigateHome }) => {
  // Browser capabilities
  const [browserCapabilities, setBrowserCapabilities] = useState<BrowserCapabilities | null>(null);

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

  // History
  const [pastSessions, setPastSessions] = useState<InterviewSessionData[]>([]);
  const [viewingSession, setViewingSession] = useState<InterviewSessionData | null>(null);
  const [savedResumes, setSavedResumes] = useState<StoredResume[]>([]);

  const loadPastSessions = useCallback(async () => {
    try {
      const sessions = await getAllSessions();
      setPastSessions(sessions);
    } catch (err) {
      logger.error('Failed to load past sessions:', err);
    }
  }, []);

  const loadSavedResumes = useCallback(async () => {
    try {
      const resumes = await getAllResumes();
      setSavedResumes(resumes);
    } catch (err) {
      logger.error('Failed to load saved resumes:', err);
    }
  }, []);

  // Check browser capabilities on mount
  useEffect(() => {
    const capabilities = checkBrowserCapabilities();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialization effect on mount
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

    // Load past sessions and saved resumes
    loadPastSessions();
    loadSavedResumes();

    setFlowState('UPLOAD');
  }, [loadPastSessions, loadSavedResumes]);

  // Refresh lock periodically
  useEffect(() => {
    if (flowState === 'INTERVIEWING' && sessionId) {
      const interval = setInterval(() => {
        refreshLock(sessionId);
      }, 60000); // Every minute

      return () => clearInterval(interval);
    }
  }, [flowState, sessionId]);

  const handleDeleteResume = useCallback(async (id: string) => {
    try {
      await deleteResume(id);
      await loadSavedResumes();
    } catch (err) {
      logger.error('Failed to delete resume:', err);
    }
  }, [loadSavedResumes]);

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  // Handle resume text extraction
  const handleResumeText = useCallback(async (text: string) => {
    setResumeText(text);
    setFlowState('PARSING');
    setError(null);

    try {
      const parsed = await geminiService.parseResume(text);
      setResumeData(parsed);
      setFlowState('REVIEW');
    } catch (err: any) {
      setError(err.message || 'Failed to parse resume');
      setFlowState('PARSE_ERROR');
    }
  }, []);

  // Handle resume data update
  const handleResumeUpdate = useCallback((data: ResumeData) => {
    setResumeData(data);
  }, []);

  // Handle resume confirm
  const handleResumeConfirm = useCallback(() => {
    setFlowState('SETUP');
  }, []);

  // Handle reset to upload
  const handleResetToUpload = useCallback(() => {
    setResumeText('');
    setResumeData(null);
    setFlowState('UPLOAD');
  }, []);

  // Handle selecting a saved resume from past sessions
  const handleSelectSavedResume = useCallback((data: ResumeData) => {
    setResumeData(data);
    setFlowState('REVIEW'); // Skip PARSING - already parsed
  }, []);

  // Handle start interview
  const handleStartInterview = useCallback(async () => {
    if (!resumeData || !persona) return;

    setFlowState('GENERATING');
    setError(null);

    try {
      // Generate session ID and acquire lock
      const newSessionId = generateSessionId();
      const lockAcquired = await acquireLock(newSessionId);

      if (!lockAcquired) {
        setError('Another interview session is in progress. Please complete or end it first.');
        setFlowState('BLOCKED');
        return;
      }

      setSessionId(newSessionId);

      // Generate questions
      const generatedQuestions = await geminiService.generateInterviewQuestions(
        resumeData,
        persona,
        duration
      );

      // Add 'asked' field to questions
      const questionsWithState: InterviewQuestion[] = generatedQuestions.map(q => ({
        ...q,
        asked: false,
      }));

      setQuestions(questionsWithState);
      setCurrentQuestionIndex(0);
      setTranscript([]);

      // Save initial session
      const sessionStartTime = Date.now();
      setStartedAt(sessionStartTime);

      // Save resume separately (decoupled from session)
      await saveResume(resumeData);

      const session: InterviewSessionData = {
        id: newSessionId,
        resumeData,
        questions: questionsWithState,
        currentQuestionIndex: 0,
        transcript: [],
        persona,
        duration,
        status: 'in-progress',
        startedAt: sessionStartTime,
      };

      await saveSession(session);

      setFlowState('INTERVIEWING');
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions');
      setFlowState('GEN_ERROR');
    }
  }, [resumeData, persona, duration]);

  // Handle question complete
  const handleQuestionComplete = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [currentQuestionIndex, questions.length]);

  // Handle interview end
  const handleInterviewEnd = useCallback(async (
    finalTranscript: TranscriptMessage[],
    wasEarly: boolean
  ) => {
    setTranscript(finalTranscript);
    setFlowState('ANALYZING');

    try {
      // Generate feedback
      const interviewFeedback = await geminiService.analyzeInterviewSession(
        resumeData!,
        finalTranscript,
        questions.filter((_, i) => i <= currentQuestionIndex),
        persona!,
        wasEarly
      );

      setFeedback(interviewFeedback);

      // Update and save session
      const session: InterviewSessionData = {
        id: sessionId,
        resumeData: resumeData!,
        questions,
        currentQuestionIndex,
        transcript: finalTranscript,
        persona: persona!,
        duration,
        status: wasEarly ? 'incomplete' : 'completed',
        startedAt,
        endedAt: Date.now(),
        feedback: interviewFeedback,
      };

      await saveSession(session);

      // Release lock
      releaseLock(sessionId);

      // Reload past sessions
      await loadPastSessions();

      setFlowState('COMPLETE');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze interview');
      // Still show complete but without feedback
      setFlowState('COMPLETE');
    }
  }, [resumeData, questions, currentQuestionIndex, persona, duration, sessionId, startedAt]);

  // Handle view past session
  const handleViewSession = useCallback(async (id: string) => {
    try {
      const session = await getSession(id);
      if (session) {
        setViewingSession(session);
      }
    } catch (err) {
      logger.error('Failed to load session:', err);
    }
  }, []);

  // Handle delete session
  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      await deleteSession(id);
      await loadPastSessions();
      if (viewingSession?.id === id) {
        setViewingSession(null);
      }
    } catch (err) {
      logger.error('Failed to delete session:', err);
    }
  }, [viewingSession]);

  // Handle close viewing session
  const handleCloseViewingSession = useCallback(() => {
    setViewingSession(null);
  }, []);

  // Handle start new interview
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

  // Handle force release lock (for blocked state)
  const handleForceRelease = useCallback(async () => {
    const blockingId = getBlockingSessionId();
    if (blockingId) {
      releaseLock(blockingId);
    }
    setFlowState('UPLOAD');
  }, []);

  // Render browser compatibility error
  if (browserCapabilities && !browserCapabilities.allSupported) {
    return (
      <BrowserCompatError
        capabilities={browserCapabilities}
        onRetry={() => {
          const newCapabilities = checkBrowserCapabilities();
          setBrowserCapabilities(newCapabilities);
          if (newCapabilities.allSupported) {
            setFlowState('UPLOAD');
          }
        }}
      />
    );
  }

  // Render viewing a past session
  if (viewingSession) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b-2 border-black bg-white sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={handleCloseViewingSession}
              className="flex items-center gap-2 text-sm font-mono hover:underline"
            >
              <ArrowLeft size={16} />
              Back to Sessions
            </button>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          <InterviewReview
            session={viewingSession}
            onDelete={() => handleDeleteSession(viewingSession.id)}
            onStartNew={handleStartNew}
          />
        </main>
      </div>
    );
  }

  return (
    <InterviewErrorBoundary onReset={handleStartNew}>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="border-b-2 border-black bg-white sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2 text-sm font-mono hover:underline"
            >
              <ArrowLeft size={16} />
              Back to Home
            </button>
            <h1 className="font-mono text-sm uppercase tracking-wide font-bold">
              Mock Interview
            </h1>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* INITIAL / Loading state */}
          {flowState === 'INITIAL' && <LoadingSpinner size="md" />}

          {/* BLOCKED state */}
          {flowState === 'BLOCKED' && (
            <SessionBlockedCard
              onForceRelease={handleForceRelease}
              onGoBack={onNavigateHome}
            />
          )}

          {/* UPLOAD state */}
          {flowState === 'UPLOAD' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-mono font-bold uppercase tracking-wide mb-2">
                  Upload Your Resume
                </h2>
                <p className="text-gray-600">
                  Upload or paste your resume to get personalized interview questions
                </p>
              </div>
              <ResumeUpload onTextExtracted={handleResumeText} />

              {/* Saved Resumes */}
              {savedResumes.length > 0 && (
                <SavedResumePicker
                  resumes={savedResumes}
                  onSelectResume={handleSelectSavedResume}
                  onDeleteResume={handleDeleteResume}
                />
              )}

              {/* Past Sessions */}
              {pastSessions.length > 0 && (
                <div className="mt-12">
                  <SessionHistoryGrid
                    sessions={pastSessions}
                    onViewSession={handleViewSession}
                    onDeleteSession={handleDeleteSession}
                  />
                </div>
              )}
            </div>
          )}

          {/* PARSING state */}
          {flowState === 'PARSING' && (
            <LoadingSpinner message="Analyzing your resume..." />
          )}

          {/* PARSE_ERROR state */}
          {flowState === 'PARSE_ERROR' && (
            <ErrorCard
              title="Parse Error"
              message={error || 'Failed to parse resume'}
              onRetry={() => handleResumeText(resumeText)}
              onSecondaryAction={handleResetToUpload}
            />
          )}

          {/* REVIEW state */}
          {flowState === 'REVIEW' && resumeData && (
            <ResumeSummaryCard
              resumeData={resumeData}
              onUpdate={handleResumeUpdate}
              onConfirm={handleResumeConfirm}
              onReset={handleResetToUpload}
            />
          )}

          {/* SETUP state */}
          {flowState === 'SETUP' && (
            <div className="space-y-8">
              <PersonaSelector
                selectedPersona={persona}
                onSelect={setPersona}
              />

              <DurationPicker
                duration={duration}
                onDurationChange={setDuration}
              />

              {/* Start Button */}
              <div className="max-w-3xl mx-auto">
                <button
                  onClick={handleStartInterview}
                  disabled={!persona}
                  className="w-full px-6 py-4 bg-black text-white font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-retro"
                >
                  Start Interview
                </button>
              </div>
            </div>
          )}

          {/* GENERATING state */}
          {flowState === 'GENERATING' && (
            <LoadingSpinner message="Preparing interview questions..." />
          )}

          {/* GEN_ERROR state */}
          {flowState === 'GEN_ERROR' && (
            <ErrorCard
              title="Generation Error"
              message={error || 'Failed to generate questions'}
              onRetry={handleStartInterview}
              onSecondaryAction={() => setFlowState('SETUP')}
              secondaryLabel="Go Back"
            />
          )}

          {/* INTERVIEWING state */}
          {flowState === 'INTERVIEWING' && resumeData && persona && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <h2 className="text-xl font-mono font-bold uppercase tracking-wide mb-4">
                  Interview in Progress
                </h2>
                <p className="text-gray-600 mb-4">
                  Use the voice panel to conduct your interview
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 border-2 border-green-500 font-mono text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Question {currentQuestionIndex + 1} of {questions.length}
                </div>
              </div>

              <MockInterviewPanel
                isOpen={true}
                onClose={() => {}}
                onEndInterview={handleInterviewEnd}
                resumeData={resumeData}
                persona={persona}
                questions={questions}
                currentQuestionIndex={currentQuestionIndex}
                onQuestionComplete={handleQuestionComplete}
              />
            </div>
          )}

          {/* ANALYZING state */}
          {flowState === 'ANALYZING' && (
            <LoadingSpinner message="Generating feedback..." />
          )}

          {/* COMPLETE state */}
          {flowState === 'COMPLETE' && resumeData && (
            <InterviewReview
              session={{
                id: sessionId,
                resumeData,
                questions,
                currentQuestionIndex,
                transcript,
                persona: persona!,
                duration,
                status: 'completed',
                startedAt,
                feedback,
              }}
              onDelete={() => handleDeleteSession(sessionId)}
              onStartNew={handleStartNew}
            />
          )}
        </main>
      </div>
    </InterviewErrorBoundary>
  );
};

export default MockInterviewApp;
