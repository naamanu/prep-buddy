import React from 'react';
import { AlertCircle } from 'lucide-react';
import { logger } from '@/utils/logger';

interface InterviewErrorBoundaryProps {
  children: React.ReactNode;
  onReset: () => void;
}

interface InterviewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class InterviewErrorBoundary extends React.Component<
  InterviewErrorBoundaryProps,
  InterviewErrorBoundaryState
> {
  state: InterviewErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): InterviewErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Interview error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="max-w-md w-full border-2 border-red-500 shadow-retro-lg bg-white p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-red-100 border-2 border-black shrink-0">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-mono font-bold uppercase mb-2">Something Went Wrong</h2>
                <p className="text-sm text-gray-600">
                  An unexpected error occurred. Please try again.
                </p>
                {this.state.error && (
                  <p className="text-xs text-gray-400 mt-2 font-mono break-all">
                    {this.state.error.message}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset();
              }}
              className="w-full px-4 py-3 bg-black text-white font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default InterviewErrorBoundary;
