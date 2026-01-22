import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Minimize2 } from 'lucide-react';
import { type TranscriptMessage } from '../types/resume';

interface TranscriptBubbleProps {
  messages: TranscriptMessage[];
  isOpen: boolean;
  onToggle: () => void;
  unreadCount?: number;
}

const TranscriptBubble: React.FC<TranscriptBubbleProps> = ({
  messages,
  isOpen,
  onToggle,
  unreadCount = 0,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isMinimized]);

  // Handle toggle - expand/minimize
  const handleToggle = () => {
    setIsMinimized(!isMinimized);
    onToggle();
  };

  if (!isOpen) return null;

  // Collapsed state - just a bubble
  if (isMinimized) {
    return (
      <button
        onClick={handleToggle}
        className="fixed bottom-6 left-6 z-[60] p-4 bg-black text-white border-2 border-black shadow-retro-lg hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-retro transition-all"
      >
        <div className="relative">
          <MessageSquare size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 flex items-center justify-center bg-red-500 text-white text-xs font-mono font-bold rounded-full px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </button>
    );
  }

  // Expanded state - full transcript panel
  return (
    <div className="fixed bottom-6 left-6 z-[60] w-80 max-h-96 bg-white border-2 border-black shadow-retro-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-black text-white border-b-2 border-black shrink-0">
        <span className="text-xs font-mono uppercase tracking-wide">Transcript</span>
        <button
          onClick={handleToggle}
          className="p-1 text-white hover:bg-white hover:text-black transition-colors"
        >
          <Minimize2 size={14} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 max-h-72"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">
            Transcript will appear here...
          </p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-black border-l-2 border-black'
                }`}
              >
                <p className="text-xs font-mono uppercase tracking-wide mb-1 opacity-60">
                  {msg.role === 'user' ? 'You' : 'Interviewer'}
                </p>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-gray-50 border-t-2 border-black shrink-0">
        <p className="text-xs text-gray-500 font-mono text-center">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};

export default TranscriptBubble;
