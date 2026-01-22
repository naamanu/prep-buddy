import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ResumeData, type PersonaType, type InterviewQuestion, type TranscriptMessage } from '@/types/resume';
import { useQuestionTimer } from '@/hooks/useQuestionTimer';
import { useTranscriptManager } from '@/hooks/useTranscriptManager';
import { useInterviewSession } from '@/hooks/useInterviewSession';
import { buildSystemInstruction, buildQuestionContext, buildTranscriptSummary, getVoiceForPersona, getPersonaTitle, SENTENCE_BOUNDARY_REGEX, filterTranscriptionNoise } from '@/services/interviewConfig';
import { formatTime } from '@/utils/time';
import TranscriptBubble from './TranscriptBubble';
import MicRecoveryModal from './MicRecoveryModal';
import InterviewWindowHeader from './InterviewWindowHeader';
import QuestionProgressBar from './QuestionProgressBar';
import AudioVisualizerScreen from './AudioVisualizerScreen';
import InterviewControls from './InterviewControls';
import MinimizedInterviewBar from './MinimizedInterviewBar';

interface MockInterviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onEndInterview: (transcript: TranscriptMessage[], wasEarly: boolean) => void;
  resumeData: ResumeData;
  persona: PersonaType;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  onQuestionComplete: () => void;
}

const MockInterviewPanel: React.FC<MockInterviewPanelProps> = ({
  isOpen,
  onClose,
  onEndInterview,
  resumeData,
  persona,
  questions,
  currentQuestionIndex,
  onQuestionComplete,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);

  // Stable ref for resetTimer to break circular hook dependency
  // (useInterviewSession needs resetTimer, useQuestionTimer needs isConnected)
  // Initialized as no-op until useQuestionTimer provides the actual function
  const resetTimerRef = useRef<() => void>(() => {});

  const currentQuestion = questions[currentQuestionIndex];

  // Transcript management
  const {
    transcript,
    showTranscript,
    unreadMessages,
    addToTranscript,
    toggleTranscript,
    inputBufferRef,
    outputBufferRef,
    flushInputBuffer,
    flushAllBuffers,
  } = useTranscriptManager();

  // System instruction (memoized to prevent unnecessary reconnects)
  // Note: Question-specific content is sent via sendQuestionContext to avoid session reconnection
  const systemInstruction = useMemo(() => buildSystemInstruction({
    resumeData,
    persona,
    totalQuestions: questions.length,
  }), [resumeData, persona, questions.length]);

  const voiceName = useMemo(() => getVoiceForPersona(persona), [persona]);

  // Memoized transcription callbacks to prevent reconnection loops
  const transcription = useMemo(() => ({
    onInputTranscript: (text: string, finished: boolean) => {
      // Accumulate raw chunks (don't filter here - filtering chunks loses valid words like "I")
      inputBufferRef.current += text;
      if (finished || SENTENCE_BOUNDARY_REGEX.test(inputBufferRef.current)) {
        // Filter only the complete buffered content before adding to transcript
        const filtered = filterTranscriptionNoise(inputBufferRef.current.trim());
        if (filtered) addToTranscript('user', filtered);
        inputBufferRef.current = '';
      }
    },
    onOutputTranscript: (text: string, finished: boolean) => {
      outputBufferRef.current += text;
      if (finished || SENTENCE_BOUNDARY_REGEX.test(outputBufferRef.current)) {
        const buffered = outputBufferRef.current.trim();
        if (buffered) addToTranscript('model', buffered);
        outputBufferRef.current = '';
      }
    },
    onTurnComplete: flushAllBuffers,
    // Passed to useInterviewSession to flush user input before AI output appears
    flushInputBuffer,
  }), [inputBufferRef, outputBufferRef, addToTranscript, flushAllBuffers, flushInputBuffer]);

  // Memoized callbacks for hooks
  // Refs for functions and data that come from hooks called after these callbacks are defined
  const sendTimeUpSignalRef = useRef<() => void>(() => {});
  const sendInterviewCompleteSignalRef = useRef<() => void>(() => {});
  const sendWrapUpWarningRef = useRef<() => void>(() => {});
  const sendQuestionContextRef = useRef<(text: string) => void>(() => {});
  // Ref for session data to avoid dependency in handleConnected
  // Includes transcript and recovery tracking for session reconnection
  const sessionDataRef = useRef({
    questions,
    currentQuestionIndex,
    transcript,
    hasConnectedBefore: false,
  });
  useEffect(() => {
    sessionDataRef.current = {
      ...sessionDataRef.current,
      questions,
      currentQuestionIndex,
      transcript,
    };
  }, [questions, currentQuestionIndex, transcript]);

  const handleConnected = useCallback(() => {
    resetTimerRef.current(); // Timer resets to full time (fair - connection issue not user's fault)

    const { questions: q, currentQuestionIndex: idx, transcript: t, hasConnectedBefore } = sessionDataRef.current;
    const isRecovery = hasConnectedBefore && t.length > 0;

    // Mark that we've connected at least once
    sessionDataRef.current.hasConnectedBefore = true;

    // On recovery: send transcript summary first so AI has context
    if (isRecovery) {
      const summary = buildTranscriptSummary(t);
      if (summary) {
        sendQuestionContextRef.current(summary);
      }
    }

    // Then send question context with appropriate mode
    const questionText = buildQuestionContext({
      question: q[idx],
      questionIndex: idx,
      totalQuestions: q.length,
      isFirst: !hasConnectedBefore,
      isRecovery,
    });
    sendQuestionContextRef.current(questionText);
  }, []);

  const handleMicBlocked = useCallback(() => setIsPaused(true), []);

  // Use sessionDataRef for question data to keep callback stable across question transitions.
  // This prevents the double TIME_UP bug where changing currentQuestionIndex would recreate
  // this callback, causing the timer effect to re-run and potentially fire twice.
  const handleTimeUp = useCallback(() => {
    const { questions: q, currentQuestionIndex: idx } = sessionDataRef.current;
    const isLastQuestion = idx >= q.length - 1;

    if (isLastQuestion) {
      sendInterviewCompleteSignalRef.current();
    } else {
      sendTimeUpSignalRef.current();
    }
    onQuestionComplete();
  }, [onQuestionComplete]);

  // Only send wrap-up warning on the final question (30 seconds before time up)
  const handleWrapUpWarning = useCallback(() => {
    const { questions: q, currentQuestionIndex: idx } = sessionDataRef.current;
    const isLastQuestion = idx >= q.length - 1;
    if (isLastQuestion) {
      sendWrapUpWarningRef.current();
    }
  }, []);

  // Session management
  const {
    isConnected,
    error,
    aiSpeaking,
    volumeLevel,
    showMicRecovery,
    setShowMicRecovery,
    startSession,
    stopSession,
    sendTimeUpSignal,
    sendInterviewCompleteSignal,
    sendWrapUpWarning,
    sendQuestionContext,
  } = useInterviewSession({
    isOpen,
    isPaused,
    isMicOn,
    systemInstruction,
    voiceName,
    transcription,
    onConnected: handleConnected,
    onMicBlocked: handleMicBlocked,
  });

  // Question timer
  const {
    timeRemaining,
    isTimeWarning,
    resetTimer,
  } = useQuestionTimer({
    isActive: isOpen && isConnected,
    isPaused,
    onTimeUp: handleTimeUp,
    onWrapUpWarning: handleWrapUpWarning,
  });

  // Keep refs in sync for stable callbacks
  useEffect(() => {
    resetTimerRef.current = resetTimer;
  }, [resetTimer]);

  useEffect(() => {
    sendTimeUpSignalRef.current = sendTimeUpSignal;
  }, [sendTimeUpSignal]);

  useEffect(() => {
    sendInterviewCompleteSignalRef.current = sendInterviewCompleteSignal;
  }, [sendInterviewCompleteSignal]);

  useEffect(() => {
    sendWrapUpWarningRef.current = sendWrapUpWarning;
  }, [sendWrapUpWarning]);

  useEffect(() => {
    sendQuestionContextRef.current = sendQuestionContext;
  }, [sendQuestionContext]);

  // Track previous question index to detect changes (not initial mount)
  const prevQuestionIndexRef = useRef(currentQuestionIndex);

  // Send question context and reset timer when question changes (not on initial mount)
  useEffect(() => {
    if (prevQuestionIndexRef.current !== currentQuestionIndex) {
      prevQuestionIndexRef.current = currentQuestionIndex;
      resetTimer();

      // Send next question to the active session
      if (isConnected && currentQuestion) {
        const questionText = buildQuestionContext({
          question: currentQuestion,
          questionIndex: currentQuestionIndex,
          totalQuestions: questions.length,
          isFirst: false,
        });
        sendQuestionContext(questionText);
      }
    }
  }, [currentQuestionIndex, currentQuestion, questions.length, isConnected, resetTimer, sendQuestionContext]);

  const handleEndInterview = useCallback(() => {
    stopSession();
    onEndInterview(transcript, true);
    onClose();
  }, [stopSession, transcript, onEndInterview, onClose]);

  const handleMicRetry = useCallback(() => {
    setShowMicRecovery(false);
    setIsPaused(false);
    startSession();
  }, [setShowMicRecovery, startSession]);

  const handleMicRecoveryEnd = useCallback(() => {
    setShowMicRecovery(false);
    handleEndInterview();
  }, [setShowMicRecovery, handleEndInterview]);

  const handleRetry = useCallback(() => {
    stopSession();
    startSession();
  }, [stopSession, startSession]);

  if (!isOpen) return null;

  // Mic Recovery Modal
  if (showMicRecovery) {
    return (
      <MicRecoveryModal
        isOpen={true}
        onRetry={handleMicRetry}
        onEndInterview={handleMicRecoveryEnd}
      />
    );
  }

  // Minimized view
  if (isMinimized) {
    return (
      <MinimizedInterviewBar
        isConnected={isConnected}
        currentQuestion={currentQuestionIndex + 1}
        totalQuestions={questions.length}
        timeRemaining={timeRemaining}
        isTimeWarning={isTimeWarning}
        formatTime={formatTime}
        onMaximize={() => setIsMinimized(false)}
        transcript={transcript}
        showTranscript={showTranscript}
        onToggleTranscript={toggleTranscript}
        unreadMessages={unreadMessages}
      />
    );
  }

  // Maximized view
  return (
    <>
      <div className="fixed bottom-6 right-24 z-50 flex flex-col w-96 bg-[#f0f0f0] border-2 border-black shadow-retro">
        <InterviewWindowHeader
          title={`Mock Interview - ${getPersonaTitle(persona)}`}
          onMinimize={() => setIsMinimized(true)}
          onClose={handleEndInterview}
        />
        <QuestionProgressBar
          currentQuestion={currentQuestionIndex + 1}
          totalQuestions={questions.length}
          timeRemaining={timeRemaining}
          isTimeWarning={isTimeWarning}
          formatTime={formatTime}
        />
        <AudioVisualizerScreen
          isConnected={isConnected}
          error={error}
          aiSpeaking={aiSpeaking}
          isMicOn={isMicOn}
          volumeLevel={volumeLevel}
          onRetry={handleRetry}
        />
        <InterviewControls
          isMicOn={isMicOn}
          isConnected={isConnected}
          onToggleMic={() => setIsMicOn(!isMicOn)}
          onEndInterview={handleEndInterview}
        />
      </div>

      <TranscriptBubble
        messages={transcript}
        isOpen={showTranscript}
        onToggle={toggleTranscript}
        unreadCount={unreadMessages}
      />
    </>
  );
};

export default MockInterviewPanel;
