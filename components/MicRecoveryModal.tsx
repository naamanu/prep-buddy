import React, { useState } from 'react';
import { MicOff, RefreshCw, X, AlertTriangle, Loader2 } from 'lucide-react';
import { requestMicrophoneAccess } from '../utils/browserCheck';

interface MicRecoveryModalProps {
  isOpen: boolean;
  onRetry: () => void;
  onEndInterview: () => void;
}

const MicRecoveryModal: React.FC<MicRecoveryModalProps> = ({
  isOpen,
  onRetry,
  onEndInterview,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryError(null);

    try {
      const granted = await requestMicrophoneAccess();
      if (granted) {
        onRetry();
      } else {
        setRetryError('Microphone access was denied. Please check your browser settings.');
      }
    } catch {
      setRetryError('Failed to access microphone. Please try again.');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white border-2 border-black shadow-retro-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-black bg-yellow-400">
          <AlertTriangle size={20} className="text-black" />
          <h3 className="text-sm font-bold font-mono uppercase tracking-wide">
            Microphone Access Required
          </h3>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 border-2 border-black shrink-0">
              <MicOff size={32} className="text-red-600" />
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              The interview has been paused because microphone access was lost or denied.
              Please enable microphone access to continue.
            </p>
          </div>

          {/* Instructions */}
          <div className="border-2 border-black p-4 bg-gray-50">
            <h4 className="text-xs font-bold font-mono uppercase tracking-wide mb-3">
              How to enable microphone:
            </h4>
            <ol className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="font-mono font-bold shrink-0">1.</span>
                <span>Click the lock/info icon in your browser's address bar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono font-bold shrink-0">2.</span>
                <span>Find "Microphone" in the permissions list</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono font-bold shrink-0">3.</span>
                <span>Change the setting to "Allow"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono font-bold shrink-0">4.</span>
                <span>Click "Retry" below to resume the interview</span>
              </li>
            </ol>
          </div>

          {/* Error message */}
          {retryError && (
            <div className="p-3 bg-red-50 border-2 border-red-500 flex items-start gap-2">
              <X size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 min-w-0 break-all">{retryError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex-1 px-4 py-3 bg-black text-white font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRetrying ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Retry
                </>
              )}
            </button>
            <button
              onClick={onEndInterview}
              disabled={isRetrying}
              className="flex-1 px-4 py-3 bg-white text-black font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
            >
              End Interview
            </button>
          </div>

          {/* Additional help */}
          <p className="text-xs text-gray-500 text-center">
            Ending the interview will save your progress and generate feedback based on your responses so far.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MicRecoveryModal;
