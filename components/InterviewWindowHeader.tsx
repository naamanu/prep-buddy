import React from 'react';
import { X, Minus } from 'lucide-react';

interface InterviewWindowHeaderProps {
  title: string;
  onMinimize: () => void;
  onClose: () => void;
}

const InterviewWindowHeader: React.FC<InterviewWindowHeaderProps> = ({
  title,
  onMinimize,
  onClose,
}) => {
  return (
    <div className="bg-black text-white px-2 py-1 flex justify-between items-center border-b-2 border-black">
      <span className="font-mono text-xs font-bold uppercase">{title}</span>
      <div className="flex gap-1">
        <button
          onClick={onMinimize}
          className="bg-white text-black w-4 h-4 flex items-center justify-center border border-gray-500 hover:bg-gray-200"
        >
          <Minus size={10} />
        </button>
        <button
          onClick={onClose}
          className="bg-white text-black w-4 h-4 flex items-center justify-center border border-gray-500 hover:bg-red-500 hover:text-white"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  );
};

export default InterviewWindowHeader;
