import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorCardProps {
  title: string;
  message: string;
  onRetry: () => void;
  onSecondaryAction: () => void;
  retryLabel?: string;
  secondaryLabel?: string;
}

const ErrorCard: React.FC<ErrorCardProps> = ({
  title,
  message,
  onRetry,
  onSecondaryAction,
  retryLabel = 'Try Again',
  secondaryLabel = 'Start Over',
}) => {
  return (
    <div className="max-w-md mx-auto">
      <div className="border-2 border-red-500 shadow-retro-lg bg-white p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-red-100 border-2 border-black shrink-0">
            <AlertCircle size={24} className="text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-mono font-bold uppercase mb-2">{title}</h2>
            <p className="text-sm text-gray-600 break-all">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="flex-1 px-4 py-3 bg-black text-white font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} />
            {retryLabel}
          </button>
          <button
            onClick={onSecondaryAction}
            className="flex-1 px-4 py-3 bg-white text-black font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorCard;
