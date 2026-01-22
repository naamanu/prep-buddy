import React from 'react';
import { Maximize2 } from 'lucide-react';
import { type TranscriptMessage } from '@/types/resume';
import TranscriptBubble from './TranscriptBubble';

interface MinimizedInterviewBarProps {
  isConnected: boolean;
  onMaximize: () => void;
  /** Static label to show (e.g., "LIVE_SESSION") - mutually exclusive with question progress */
  statusLabel?: string;
  /** Current question number - used with totalQuestions for progress display */
  currentQuestion?: number;
  /** Total number of questions - used with currentQuestion for progress display */
  totalQuestions?: number;
  /** Pre-formatted timer string (e.g., "5:00") - mutually exclusive with timeRemaining */
  timerDisplay?: string;
  /** Time remaining in ms - used with formatTime for calculated display */
  timeRemaining?: number;
  /** Whether timer is in warning state (turns red) */
  isTimeWarning?: boolean;
  /** Function to format time remaining - required if using timeRemaining */
  formatTime?: (ms: number) => string;
  /** Transcript messages - if not provided, transcript bubble is not shown */
  transcript?: TranscriptMessage[];
  /** Whether transcript panel is open */
  showTranscript?: boolean;
  /** Callback to toggle transcript visibility */
  onToggleTranscript?: () => void;
  /** Number of unread messages */
  unreadMessages?: number;
}

const MinimizedInterviewBar: React.FC<MinimizedInterviewBarProps> = ({
  isConnected,
  onMaximize,
  statusLabel,
  currentQuestion,
  totalQuestions,
  timerDisplay,
  timeRemaining,
  isTimeWarning = false,
  formatTime,
  transcript,
  showTranscript,
  onToggleTranscript,
  unreadMessages = 0,
}) => {
  // Determine what to show for status: either a label or question progress
  const statusContent = statusLabel
    ? statusLabel
    : currentQuestion && totalQuestions
      ? `Q${currentQuestion}/${totalQuestions}`
      : null;

  // Determine what to show for timer: either direct display or calculated
  const timerContent = timerDisplay
    ? timerDisplay
    : timeRemaining !== undefined && formatTime
      ? formatTime(timeRemaining)
      : null;

  // Determine timer styling
  const timerClassName = isTimeWarning
    ? 'bg-red-500 text-white'
    : 'bg-black text-white';

  // Whether to show transcript bubble
  const showTranscriptBubble = transcript && onToggleTranscript;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-white border-2 border-black shadow-retro flex items-center p-2 gap-3">
          <div
            className={`w-3 h-3 rounded-full border border-black ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          {statusContent && (
            <span className="font-mono text-xs font-bold text-black uppercase">
              {statusContent}
            </span>
          )}
          {timerContent && (
            <span className={`font-mono text-xs px-2 ${timerClassName}`}>
              {timerContent}
            </span>
          )}
          <button
            onClick={onMaximize}
            className="p-1 hover:bg-gray-200 border border-transparent hover:border-black"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>
      {showTranscriptBubble && (
        <TranscriptBubble
          messages={transcript}
          isOpen={showTranscript ?? false}
          onToggle={onToggleTranscript}
          unreadCount={unreadMessages}
        />
      )}
    </>
  );
};

export default MinimizedInterviewBar;
