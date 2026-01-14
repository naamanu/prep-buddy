import React from 'react';
import { Clock } from 'lucide-react';

interface QuestionProgressBarProps {
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  isTimeWarning: boolean;
  formatTime: (ms: number) => string;
}

const QuestionProgressBar: React.FC<QuestionProgressBarProps> = ({
  currentQuestion,
  totalQuestions,
  timeRemaining,
  isTimeWarning,
  formatTime,
}) => {
  return (
    <div className="px-3 py-2 bg-white border-b-2 border-black">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs uppercase text-gray-500">
          Question {currentQuestion} of {totalQuestions}
        </span>
        <div
          className={`flex items-center gap-1 font-mono text-xs ${
            isTimeWarning ? 'text-red-500' : 'text-gray-600'
          }`}
        >
          <Clock size={12} />
          {formatTime(timeRemaining)}
        </div>
      </div>
      <div className="w-full h-1 bg-gray-200">
        <div
          className="h-full bg-black transition-all"
          style={{ width: `${(currentQuestion / totalQuestions) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default QuestionProgressBar;
