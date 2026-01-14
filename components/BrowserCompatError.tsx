import React from 'react';
import { AlertTriangle, Monitor, Chrome } from 'lucide-react';
import { type BrowserCapabilities, getBrowserRecommendation } from '../utils/browserCheck';

interface BrowserCompatErrorProps {
  capabilities: BrowserCapabilities;
  onRetry?: () => void;
}

const BrowserCompatError: React.FC<BrowserCompatErrorProps> = ({ capabilities, onRetry }) => {
  const recommendation = getBrowserRecommendation();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="max-w-lg w-full border-2 border-black shadow-retro-lg bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-black bg-red-500 text-white">
          <AlertTriangle size={20} />
          <h1 className="text-sm font-bold font-mono uppercase tracking-wide">
            Browser Not Supported
          </h1>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 border-2 border-black shrink-0">
              <Monitor size={32} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-700 leading-relaxed">
                Your browser is missing features required for the Mock Interview experience.
                The interview requires microphone access, audio processing, and secure storage.
              </p>
            </div>
          </div>

          {/* Missing Features */}
          <div className="border-2 border-black p-4 bg-gray-50">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wide mb-3">
              Missing Features:
            </h3>
            <ul className="space-y-2">
              {capabilities.missingFeatures.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-red-700">
                  <span className="w-2 h-2 bg-red-500 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendation */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border-2 border-black">
            <Chrome size={20} className="text-yellow-700 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              {recommendation}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex-1 px-4 py-3 bg-black text-white font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                Check Again
              </button>
            )}
            <button
              onClick={() => window.history.back()}
              className="flex-1 px-4 py-3 bg-white text-black font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrowserCompatError;
