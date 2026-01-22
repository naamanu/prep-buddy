import React, { useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GeminiService } from '@/packages/gemini-service/src';
import {
  useInterviewFlow,
  usePastSessions,
  useSavedResumes,
} from '@/hooks';

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
  // Initialize hooks
  const flow = useInterviewFlow({ geminiService });
  const sessions = usePastSessions();
  const resumes = useSavedResumes();

  // Load sessions and resumes when entering UPLOAD state
  useEffect(() => {
    if (flow.flowState === 'UPLOAD') {
      sessions.loadSessions();
      resumes.loadResumes();
    }
  }, [flow.flowState, sessions.loadSessions, resumes.loadResumes]);

  // Set up callback to reload sessions after interview completes
  useEffect(() => {
    flow.setOnInterviewComplete(() => {
      sessions.loadSessions();
    });
  }, [flow.setOnInterviewComplete, sessions.loadSessions]);

  // Handle deleting a resume (needs to reload after)
  const handleDeleteResume = useCallback(
    async (id: string) => {
      await resumes.deleteResume(id);
    },
    [resumes.deleteResume]
  );

  // Handle deleting a session
  const handleDeleteSession = useCallback(
    async (id: string) => {
      await sessions.deleteSession(id);
    },
    [sessions.deleteSession]
  );

  // Render browser compatibility error
  if (flow.browserCapabilities && !flow.browserCapabilities.allSupported) {
    return (
      <BrowserCompatError
        capabilities={flow.browserCapabilities}
        onRetry={flow.handleRetryBrowserCheck}
      />
    );
  }

  // Render viewing a past session
  if (sessions.viewingSession) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b-2 border-black bg-white sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={sessions.closeViewingSession}
              className="flex items-center gap-2 text-sm font-mono hover:underline"
            >
              <ArrowLeft size={16} />
              Back to Sessions
            </button>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          <InterviewReview
            session={sessions.viewingSession}
            onDelete={() => handleDeleteSession(sessions.viewingSession!.id)}
            onStartNew={flow.handleStartNew}
          />
        </main>
      </div>
    );
  }

  return (
    <InterviewErrorBoundary onReset={flow.handleStartNew}>
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
          {flow.flowState === 'INITIAL' && <LoadingSpinner size="md" />}

          {/* BLOCKED state */}
          {flow.flowState === 'BLOCKED' && (
            <SessionBlockedCard
              onForceRelease={flow.handleForceRelease}
              onGoBack={onNavigateHome}
            />
          )}

          {/* UPLOAD state */}
          {flow.flowState === 'UPLOAD' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-mono font-bold uppercase tracking-wide mb-2">
                  Upload Your Resume
                </h2>
                <p className="text-gray-600">
                  Upload or paste your resume to get personalized interview questions
                </p>
              </div>
              <ResumeUpload onTextExtracted={flow.handleResumeText} />

              {/* Saved Resumes */}
              {resumes.isLoading ? (
                <div className="text-center text-gray-500 text-sm font-mono">Loading saved resumes...</div>
              ) : resumes.error ? (
                <div className="text-center text-red-600 text-sm font-mono">
                  Failed to load resumes.{' '}
                  <button onClick={resumes.loadResumes} className="underline hover:no-underline">
                    Retry
                  </button>
                </div>
              ) : resumes.savedResumes.length > 0 ? (
                <SavedResumePicker
                  resumes={resumes.savedResumes}
                  onSelectResume={flow.handleSelectSavedResume}
                  onDeleteResume={handleDeleteResume}
                />
              ) : null}

              {/* Past Sessions */}
              {sessions.isLoading ? (
                <div className="mt-12 text-center text-gray-500 text-sm font-mono">Loading past sessions...</div>
              ) : sessions.error ? (
                <div className="mt-12 text-center text-red-600 text-sm font-mono">
                  Failed to load sessions.{' '}
                  <button onClick={sessions.loadSessions} className="underline hover:no-underline">
                    Retry
                  </button>
                </div>
              ) : sessions.pastSessions.length > 0 ? (
                <div className="mt-12">
                  <SessionHistoryGrid
                    sessions={sessions.pastSessions}
                    onViewSession={sessions.viewSession}
                    onDeleteSession={handleDeleteSession}
                  />
                </div>
              ) : null}
            </div>
          )}

          {/* PARSING state */}
          {flow.flowState === 'PARSING' && (
            <LoadingSpinner message="Analyzing your resume..." />
          )}

          {/* PARSE_ERROR state */}
          {flow.flowState === 'PARSE_ERROR' && (
            <ErrorCard
              title="Parse Error"
              message={flow.error || 'Failed to parse resume'}
              onRetry={() => flow.handleResumeText(flow.resumeText)}
              onSecondaryAction={flow.handleResetToUpload}
            />
          )}

          {/* REVIEW state */}
          {flow.flowState === 'REVIEW' && flow.resumeData && (
            <ResumeSummaryCard
              resumeData={flow.resumeData}
              onUpdate={flow.handleResumeUpdate}
              onConfirm={flow.handleResumeConfirm}
              onReset={flow.handleResetToUpload}
            />
          )}

          {/* SETUP state */}
          {flow.flowState === 'SETUP' && (
            <div className="space-y-8">
              <PersonaSelector
                selectedPersona={flow.persona}
                onSelect={flow.setPersona}
              />

              <DurationPicker
                duration={flow.duration}
                onDurationChange={flow.setDuration}
              />

              {/* Start Button */}
              <div className="max-w-3xl mx-auto">
                <button
                  onClick={flow.handleStartInterview}
                  disabled={!flow.persona}
                  className="w-full px-6 py-4 bg-black text-white font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-retro"
                >
                  Start Interview
                </button>
              </div>
            </div>
          )}

          {/* GENERATING state */}
          {flow.flowState === 'GENERATING' && (
            <LoadingSpinner message="Preparing interview questions..." />
          )}

          {/* GEN_ERROR state */}
          {flow.flowState === 'GEN_ERROR' && (
            <ErrorCard
              title="Generation Error"
              message={flow.error || 'Failed to generate questions'}
              onRetry={flow.handleStartInterview}
              onSecondaryAction={() => flow.handleResumeConfirm()}
              secondaryLabel="Go Back"
            />
          )}

          {/* INTERVIEWING state */}
          {flow.flowState === 'INTERVIEWING' && flow.resumeData && flow.persona && (
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
                  Question {flow.currentQuestionIndex + 1} of {flow.questions.length}
                </div>
              </div>

              <MockInterviewPanel
                isOpen={true}
                onClose={() => {}}
                onEndInterview={flow.handleInterviewEnd}
                resumeData={flow.resumeData}
                persona={flow.persona}
                questions={flow.questions}
                currentQuestionIndex={flow.currentQuestionIndex}
                onQuestionComplete={flow.handleQuestionComplete}
              />
            </div>
          )}

          {/* ANALYZING state */}
          {flow.flowState === 'ANALYZING' && (
            <LoadingSpinner message="Generating feedback..." />
          )}

          {/* COMPLETE state */}
          {flow.flowState === 'COMPLETE' && flow.resumeData && flow.persona && (
            <InterviewReview
              session={{
                id: flow.sessionId,
                resumeData: flow.resumeData,
                questions: flow.questions,
                currentQuestionIndex: flow.currentQuestionIndex,
                transcript: flow.transcript,
                persona: flow.persona,
                duration: flow.duration,
                status: 'completed',
                startedAt: flow.startedAt,
                feedback: flow.feedback,
              }}
              onDelete={() => handleDeleteSession(flow.sessionId)}
              onStartNew={flow.handleStartNew}
            />
          )}
        </main>
      </div>
    </InterviewErrorBoundary>
  );
};

export default MockInterviewApp;
