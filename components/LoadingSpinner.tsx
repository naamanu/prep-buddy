import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 24,
  md: 32,
  lg: 48,
} as const;

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message,
  size = 'lg',
  className = 'py-20',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Loader2
        size={SIZES[size]}
        className={`animate-spin text-gray-400${message ? ' mb-4' : ''}`}
      />
      {message && (
        <p className="font-mono text-sm uppercase tracking-wide text-gray-500">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
