import React from 'react';
import { AlertCircle } from 'lucide-react';

interface SessionBlockedCardProps {
  onForceRelease: () => void;
  onGoBack: () => void;
}

const SessionBlockedCard: React.FC<SessionBlockedCardProps> = ({
  onForceRelease,
  onGoBack,
}) => {
  return (
    <div className="max-w-md mx-auto">
      <div className="border-2 border-black shadow-retro-lg bg-white p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-yellow-100 border-2 border-black shrink-0">
            <AlertCircle size={24} className="text-yellow-600" />
          </div>
          <div>
            <h2 className="font-mono font-bold uppercase mb-2">Session in Progress</h2>
            <p className="text-sm text-gray-600">
              Another interview session is currently in progress. You can only run one interview at a time.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onForceRelease}
            className="flex-1 px-4 py-3 bg-black text-white font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            End Other Session
          </button>
          <button
            onClick={onGoBack}
            className="flex-1 px-4 py-3 bg-white text-black font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionBlockedCard;
