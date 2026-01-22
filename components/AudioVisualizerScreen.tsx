import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AudioVisualizerScreenProps {
  isConnected: boolean;
  error: string | null;
  aiSpeaking: boolean;
  isMicOn: boolean;
  volumeLevel: number;
  onRetry: () => void;
  /** Height class for the visualizer container (default: "h-36") */
  heightClass?: string;
  /** Text shown while connecting (default: "Connecting...") */
  connectingText?: string;
  /** Text shown when AI is speaking (default: "AI_SPEAKING") */
  speakingText?: string;
  /** Text shown when listening (default: "LISTENING...") */
  listeningText?: string;
  /** Prefix for error messages (default: "") */
  errorPrefix?: string;
  /** Stable bar heights for AI speaking visualization (prevents flickering) */
  aiSpeakingBarHeights?: number[];
  /** Stable factors for volume bar heights (prevents flickering) */
  volumeBarFactors?: number[];
  /** Size of the listening circle: "sm" (default) or "lg" */
  circleSize?: 'sm' | 'lg';
}

const AudioVisualizerScreen: React.FC<AudioVisualizerScreenProps> = ({
  isConnected,
  error,
  aiSpeaking,
  isMicOn,
  volumeLevel,
  onRetry,
  heightClass = 'h-36',
  connectingText = 'Connecting...',
  speakingText = 'AI_SPEAKING',
  listeningText = 'LISTENING...',
  errorPrefix = '',
  aiSpeakingBarHeights,
  volumeBarFactors,
  circleSize = 'sm',
}) => {
  // Generate stable random values if not provided (useState initializer runs once on mount)
  const [defaultBarHeights] = useState(() => [...Array(5)].map(() => Math.random() * 100));
  const [defaultVolFactors] = useState(() => [...Array(10)].map(() => Math.random()));

  const barHeights = aiSpeakingBarHeights ?? defaultBarHeights;
  const volFactors = volumeBarFactors ?? defaultVolFactors;

  const circleClasses = circleSize === 'lg'
    ? { outer: 'w-24 h-24', inner: 'w-20 h-20' }
    : { outer: 'w-20 h-20', inner: 'w-16 h-16' };

  const errorDisplay = errorPrefix ? `${errorPrefix}${error}` : error;

  return (
    <div className={`${heightClass} bg-black border-b-2 border-black relative flex items-center justify-center overflow-hidden`}>
      {/* CRT scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 2px, 3px 100%',
        }}
      />

      {/* Connecting state */}
      {!isConnected && !error && (
        <div className="flex flex-col items-center gap-2 text-green-500 font-mono">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-xs uppercase">{connectingText}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-red-500 font-mono text-xs text-center px-4 w-full h-full flex flex-col items-center justify-center">
          <div className="flex-1 overflow-y-auto w-full flex items-center justify-center py-2">
            <span className="break-all">{errorDisplay}</span>
          </div>
          <button
            onClick={onRetry}
            className="border border-red-500 px-2 py-1 hover:bg-red-900 flex-shrink-0 mb-2"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Connected state - visualizer */}
      {isConnected && (
        <div className="w-full h-full flex items-center justify-center">
          {aiSpeaking ? (
            <div className="flex gap-1 h-12 items-center">
              {barHeights.map((height, i) => (
                <div
                  key={i}
                  className="w-2 bg-green-500 animate-pulse"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          ) : (
            <div className={`${circleClasses.outer} border border-green-500/30 rounded-full flex items-center justify-center animate-pulse`}>
              <div className={`${circleClasses.inner} border border-green-500/50 rounded-full`} />
            </div>
          )}
        </div>
      )}

      {/* Status bar - hidden during error state to give retry button more space */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-2 py-1 flex justify-between items-center">
          <span className="text-[10px] text-green-500 font-mono uppercase">
            {aiSpeaking ? speakingText : listeningText}
          </span>
          {isConnected && isMicOn && (
            <div className="flex gap-0.5 h-2 items-end">
              {volFactors.map((factor, i) => (
                <div
                  key={i}
                  className="w-1 bg-green-500"
                  style={{
                    height: `${Math.max(10, Math.min(100, volumeLevel * 1000 * factor))}%`,
                    opacity: volumeLevel > 0.01 ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioVisualizerScreen;
