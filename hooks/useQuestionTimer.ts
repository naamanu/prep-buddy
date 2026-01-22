import { useCallback, useEffect, useRef, useState } from 'react';
import { QUESTION_TIME_LIMIT_MS } from '@/config/interview';

export { QUESTION_TIME_LIMIT_MS };

/** Threshold for wrap-up warning on final question (30 seconds) */
const WRAP_UP_WARNING_THRESHOLD_MS = 30 * 1000;

interface UseQuestionTimerOptions {
  isActive: boolean;
  isPaused: boolean;
  onTimeUp: () => void;
  /** Optional callback fired once when 30 seconds remain (for final question wrap-up) */
  onWrapUpWarning?: () => void;
}

interface UseQuestionTimerReturn {
  questionElapsed: number;
  timeRemaining: number;
  isTimeWarning: boolean;
  resetTimer: () => void;
}

export function useQuestionTimer({
  isActive,
  isPaused,
  onTimeUp,
  onWrapUpWarning,
}: UseQuestionTimerOptions): UseQuestionTimerReturn {
  const [questionStartTime, setQuestionStartTime] = useState<number>(() => Date.now());
  const [questionElapsed, setQuestionElapsed] = useState(0);
  const timeUpTriggeredRef = useRef(false);
  const wrapUpWarningTriggeredRef = useRef(false);

  // Stable refs for callbacks to prevent stale closures in the timer interval.
  // Without this, changing questions would cause callbacks to have stale dependencies,
  // leading to bugs like the timer hanging at 0:00 on Q2+.
  const onTimeUpRef = useRef(onTimeUp);
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  const onWrapUpWarningRef = useRef(onWrapUpWarning);
  useEffect(() => {
    onWrapUpWarningRef.current = onWrapUpWarning;
  }, [onWrapUpWarning]);

  const handleTimeUp = useCallback(() => {
    if (timeUpTriggeredRef.current) return;
    timeUpTriggeredRef.current = true;
    onTimeUpRef.current();
  }, []); // No dependencies - stable callback

  // Timer interval
  // Note: setInterval may drift under heavy load or in backgrounded tabs, but this is
  // acceptable for an interview timer where second-level precision isn't critical.
  // The Date.now() calculation ensures cumulative accuracy even if individual ticks are delayed.
  useEffect(() => {
    if (!isActive || isPaused) return;

    const interval = setInterval(() => {
      if (timeUpTriggeredRef.current) return;

      const elapsed = Date.now() - questionStartTime;
      setQuestionElapsed(elapsed);

      const remaining = QUESTION_TIME_LIMIT_MS - elapsed;

      // Fire wrap-up warning at 30 seconds remaining (only once per question)
      if (remaining <= WRAP_UP_WARNING_THRESHOLD_MS && !wrapUpWarningTriggeredRef.current) {
        wrapUpWarningTriggeredRef.current = true;
        onWrapUpWarningRef.current?.();
      }

      if (elapsed >= QUESTION_TIME_LIMIT_MS) {
        handleTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isPaused, questionStartTime, handleTimeUp]);

  const resetTimer = useCallback(() => {
    setQuestionStartTime(Date.now());
    setQuestionElapsed(0);
    timeUpTriggeredRef.current = false;
    wrapUpWarningTriggeredRef.current = false;
  }, []);

  const timeRemaining = QUESTION_TIME_LIMIT_MS - questionElapsed;
  const isTimeWarning = timeRemaining < 60000; // Less than 1 minute

  return {
    questionElapsed,
    timeRemaining,
    isTimeWarning,
    resetTimer,
  };
}
