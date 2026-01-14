import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface InterviewControlsProps {
  isMicOn: boolean;
  isConnected: boolean;
  onToggleMic: () => void;
  onEndInterview: () => void;
  /** Text for the end button (default: "END INTERVIEW") */
  endButtonText?: string;
  /** Optional timer display string - if provided, shows timer box above controls */
  timerDisplay?: string;
  /** Gap between buttons: "sm" (gap-3) or "lg" (gap-4, default) */
  buttonGap?: 'sm' | 'lg';
}

const InterviewControls: React.FC<InterviewControlsProps> = ({
  isMicOn,
  isConnected,
  onToggleMic,
  onEndInterview,
  endButtonText = 'END INTERVIEW',
  timerDisplay,
  buttonGap = 'sm',
}) => {
  const gapClass = buttonGap === 'lg' ? 'gap-4' : 'gap-3';

  return (
    <div className="p-3 bg-[#d4d4d4]">
      {timerDisplay && (
        <div className="flex justify-between items-center mb-3 bg-white border-2 border-black px-2 py-1 shadow-retro-sm">
          <span className="font-mono text-xs font-bold">TIMER:</span>
          <span className="font-mono text-xs font-bold">{timerDisplay}</span>
        </div>
      )}
      <div className={`flex justify-center ${gapClass}`}>
        <button
          onClick={onToggleMic}
          disabled={!isConnected}
          className={`w-10 h-10 flex items-center justify-center border-2 border-black shadow-retro-sm transition-all active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
            isMicOn ? 'bg-white hover:bg-gray-100' : 'bg-red-500 text-white'
          }`}
        >
          {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button
          onClick={onEndInterview}
          className="flex-1 bg-black text-white font-mono font-bold text-xs border-2 border-black hover:bg-gray-800 active:bg-gray-900 shadow-retro-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
        >
          {endButtonText}
        </button>
      </div>
    </div>
  );
};

export default InterviewControls;
