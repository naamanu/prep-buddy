import React, { useState } from 'react';
import {
  Star,
  TrendingUp,
  BookOpen,
  AlertTriangle,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  User,
  Bot,
} from 'lucide-react';
import { type InterviewSessionData } from '../packages/storage/src/indexedDB';
import { type TranscriptMessage, type InterviewFeedback } from '../types/resume';
import { PERSONAS } from '../config/personas';

interface InterviewReviewProps {
  session: InterviewSessionData;
  onDelete: () => void;
  onStartNew: () => void;
}

const InterviewReview: React.FC<InterviewReviewProps> = ({
  session,
  onDelete,
  onStartNew,
}) => {
  const [showFullTranscript, setShowFullTranscript] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const feedback = session.feedback as InterviewFeedback | undefined;
  const transcript = session.transcript as TranscriptMessage[];
  const personaConfig = PERSONAS[session.persona as keyof typeof PERSONAS];

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = () => {
    if (session.endedAt && session.startedAt) {
      const minutes = Math.round((session.endedAt - session.startedAt) / 60000);
      return `${minutes} min`;
    }
    return `${session.duration} min`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-mono font-bold uppercase tracking-wide mb-2">
            Interview Review
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{formatDate(session.startedAt)}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <span>{calculateDuration()}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <span className="capitalize">{personaConfig?.title || session.persona}</span>
            {session.status === 'incomplete' && (
              <>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                <span className="text-yellow-600 font-medium">Ended Early</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartNew}
            className="px-4 py-2 bg-black text-white font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-2"
          >
            <Plus size={16} />
            New Interview
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Left Column - Transcript */}
        <div className="border-2 border-black shadow-retro bg-white">
          <div className="px-4 py-3 border-b-2 border-black bg-black text-white flex items-center gap-2">
            <MessageSquare size={16} />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wide">Transcript</h2>
          </div>
          <div className={`p-4 ${showFullTranscript ? 'max-h-[2000px]' : 'max-h-96'} overflow-y-auto`}>
            {transcript.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No transcript available</p>
            ) : (
              <div className="space-y-4">
                {(showFullTranscript ? transcript : transcript.slice(0, 6)).map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${msg.role === 'user' ? '' : ''}`}
                  >
                    <div className={`w-8 h-8 shrink-0 flex items-center justify-center border-2 border-black ${
                      msg.role === 'user' ? 'bg-white' : 'bg-gray-100'
                    }`}>
                      {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-mono uppercase tracking-wide text-gray-400 mb-1">
                        {msg.role === 'user' ? 'You' : 'Interviewer'}
                      </p>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {transcript.length > 6 && (
            <div className="px-4 py-3 border-t-2 border-black bg-gray-50">
              <button
                onClick={() => setShowFullTranscript(!showFullTranscript)}
                className="w-full flex items-center justify-center gap-2 text-sm font-mono uppercase tracking-wide text-gray-600 hover:text-black"
              >
                {showFullTranscript ? (
                  <>
                    <ChevronUp size={16} />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    Show All ({transcript.length} messages)
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Feedback */}
        <div className="space-y-4">
          {/* Overall Assessment */}
          {feedback && (
            <>
              <div className="border-2 border-black shadow-retro bg-white">
                <div className="px-4 py-3 border-b-2 border-black bg-black text-white flex items-center gap-2">
                  <Star size={16} />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wide">Overall Assessment</h2>
                </div>
                <div className="p-4">
                  <p className="text-sm leading-relaxed">{feedback.overallAssessment}</p>
                </div>
              </div>

              {/* Brief Answer Warning */}
              {feedback.briefAnswerWarning && (
                <div className="border-2 border-yellow-500 shadow-retro bg-yellow-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-yellow-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-mono font-bold text-sm uppercase tracking-wide mb-1">Note</h3>
                      <p className="text-sm text-yellow-800">{feedback.briefAnswerWarning}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Strengths */}
              <div className="border-2 border-black shadow-retro bg-white">
                <div className="px-4 py-3 border-b-2 border-black bg-green-500 text-white flex items-center gap-2">
                  <TrendingUp size={16} />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wide">Strengths</h2>
                </div>
                <div className="p-4">
                  <ul className="space-y-2">
                    {feedback.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-2 h-2 bg-green-500 shrink-0 mt-1.5" />
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Areas for Improvement */}
              <div className="border-2 border-black shadow-retro bg-white">
                <div className="px-4 py-3 border-b-2 border-black bg-orange-500 text-white flex items-center gap-2">
                  <TrendingUp size={16} className="rotate-180" />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wide">Areas to Improve</h2>
                </div>
                <div className="p-4">
                  <ul className="space-y-2">
                    {feedback.areasForImprovement.map((area, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-2 h-2 bg-orange-500 shrink-0 mt-1.5" />
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Topics to Study */}
              <div className="border-2 border-black shadow-retro bg-white">
                <div className="px-4 py-3 border-b-2 border-black bg-blue-500 text-white flex items-center gap-2">
                  <BookOpen size={16} />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wide">Topics to Study</h2>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {feedback.suggestedTopics.map((topic, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-50 border-2 border-blue-200 text-sm font-mono"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Question-by-Question Feedback */}
              {feedback.questionFeedback.length > 0 && (
                <div className="border-2 border-black shadow-retro bg-white">
                  <div className="px-4 py-3 border-b-2 border-black bg-black text-white">
                    <h2 className="text-sm font-mono font-bold uppercase tracking-wide">Question Feedback</h2>
                  </div>
                  <div className="divide-y-2 divide-black">
                    {feedback.questionFeedback.map((qf, index) => (
                      <div key={index} className="p-4">
                        <p className="font-mono text-xs uppercase tracking-wide text-gray-400 mb-2">
                          Question {index + 1}
                        </p>
                        <p className="text-sm font-medium mb-2">{qf.question}</p>
                        <p className="text-sm text-gray-600 mb-2">{qf.assessment}</p>
                        <p className="text-sm text-blue-600">
                          <span className="font-medium">Suggestion:</span> {qf.suggestion}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* No Feedback Available */}
          {!feedback && (
            <div className="border-2 border-gray-300 shadow-retro bg-gray-50 p-8 text-center">
              <AlertTriangle size={32} className="text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                Feedback could not be generated for this session.
              </p>
            </div>
          )}

          {/* Delete Button */}
          <div className="pt-4">
            {showDeleteConfirm ? (
              <div className="border-2 border-red-500 bg-red-50 p-4">
                <p className="text-sm text-red-700 mb-3">
                  Are you sure you want to delete this session? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onDelete}
                    className="flex-1 px-4 py-2 bg-red-500 text-white font-mono text-sm uppercase tracking-wide border-2 border-red-500 hover:bg-red-600 transition-colors"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 bg-white text-black font-mono text-sm uppercase tracking-wide border-2 border-black hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-2 bg-white text-red-500 font-mono text-sm uppercase tracking-wide border-2 border-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Delete Session
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewReview;
