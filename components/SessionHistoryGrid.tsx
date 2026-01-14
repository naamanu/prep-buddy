import React from 'react';
import { Calendar, Clock, MessageSquare, Trash2, ChevronRight } from 'lucide-react';
import { type InterviewSessionData } from '../packages/storage/src/indexedDB';
import { PERSONAS } from '../config/personas';
import { type PersonaType } from '../types/resume';

interface SessionHistoryGridProps {
  sessions: InterviewSessionData[];
  onViewSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

const SessionHistoryGrid: React.FC<SessionHistoryGridProps> = ({
  sessions,
  onViewSession,
  onDeleteSession,
}) => {
  if (sessions.length === 0) {
    return null;
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateDuration = (session: InterviewSessionData) => {
    if (session.endedAt && session.startedAt) {
      return Math.round((session.endedAt - session.startedAt) / 60000);
    }
    return session.duration;
  };

  const getPersonaEmoji = (persona: string) => {
    switch (persona) {
      case 'friendly':
        return '😊';
      case 'professional':
        return '💼';
      case 'challenging':
        return '⚡';
      default:
        return '🎭';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'incomplete':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div>
      <h2 className="text-lg font-mono font-bold uppercase tracking-wide mb-4">
        Past Interviews
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((session) => {
          const personaConfig = PERSONAS[session.persona as PersonaType];
          const duration = calculateDuration(session);
          const questionsAsked = session.questions.filter((q: any) => q.asked !== false).length;

          return (
            <div
              key={session.id}
              className="border-2 border-black shadow-retro bg-white hover:shadow-retro-lg transition-shadow group"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b-2 border-black bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="font-mono text-xs">{formatDate(session.startedAt)}</span>
                </div>
                <span className={`px-2 py-0.5 text-xs font-mono uppercase border ${getStatusColor(session.status)}`}>
                  {session.status}
                </span>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {/* Duration & Questions */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400" />
                    <span>{duration} min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-gray-400" />
                    <span>{questionsAsked || session.questions.length} questions</span>
                  </div>
                </div>

                {/* Persona */}
                <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200">
                  <span className="text-lg">{getPersonaEmoji(session.persona)}</span>
                  <span className="text-sm font-mono">
                    {personaConfig?.title || session.persona}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => onViewSession(session.id)}
                    className="flex-1 px-3 py-2 bg-black text-white font-mono text-xs uppercase tracking-wide border-2 border-black shadow-retro-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center gap-1"
                  >
                    View Review
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="p-2 bg-white text-red-500 border-2 border-red-500 hover:bg-red-50 transition-colors"
                    title="Delete session"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SessionHistoryGrid;
