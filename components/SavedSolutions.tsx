import React, { useMemo, useState, useEffect } from 'react';
import { QUESTIONS } from '@/constants';
import { getAllProgress, type QuestionProgress } from '@/services';
import { logger } from '@/utils/logger';
import { CheckCircle, ArrowRight, Code2, Calendar, Trophy } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface SavedSolutionsProps {
  onSelectQuestion: (questionId: string) => void;
  onNavigateBack: () => void;
}

const SavedSolutions: React.FC<SavedSolutionsProps> = ({ onSelectQuestion, onNavigateBack }) => {
  const [progress, setProgress] = useState<Record<string, QuestionProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const p = await getAllProgress();
        setProgress(p);
      } catch (e) {
        logger.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const solvedQuestions = useMemo(() => {
    if (loading) return [];
    return QUESTIONS.filter(q => progress[q.id]?.isSolved).map(q => ({
      ...q,
      savedData: progress[q.id]
    })).sort((a, b) => (b.savedData.timestamp || 0) - (a.savedData.timestamp || 0));
  }, [progress, loading]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="h-16 px-6 flex items-center justify-between border-b-2 border-black bg-white">
        <div className="flex items-center gap-4">
          <button
            onClick={onNavigateBack}
            className="p-2 hover:bg-black hover:text-white border-2 border-transparent hover:border-black transition-colors"
            title="Back to Menu"
          >
            <ArrowRight size={20} className="rotate-180" />
          </button>
          <div className="flex items-center gap-2 border-l-2 border-black pl-4">
            <div className="bg-green-200 text-black border-2 border-black p-1 shadow-retro-sm">
              <Trophy size={18} />
            </div>
            <span className="font-mono font-bold text-xl uppercase tracking-tight">Records</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <LoadingSpinner message="RETRIEVING ARCHIVES..." size="md" />
          ) : solvedQuestions.length === 0 ? (
            <div className="text-center py-20 border-2 border-black bg-white shadow-retro">
              <div className="w-16 h-16 bg-gray-200 border-2 border-black flex items-center justify-center mx-auto mb-4 text-gray-500">
                <Code2 size={32} />
              </div>
              <h2 className="text-xl font-bold font-mono uppercase mb-2">No Data Found</h2>
              <p className="text-gray-600 font-mono text-sm mb-6">Database empty. Complete tasks to populate.</p>
              <button
                onClick={onNavigateBack}
                className="px-6 py-2 bg-black text-white border-2 border-black font-mono font-bold hover:shadow-retro-lg transition-all"
              >
                INITIATE PRACTICE
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {solvedQuestions.map((q) => (
                <div
                  key={q.id}
                  onClick={() => onSelectQuestion(q.id)}
                  className="bg-white p-6 border-2 border-black shadow-retro hover:shadow-retro-lg hover:-translate-y-1 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold font-mono text-black group-hover:underline decoration-2 underline-offset-4">{q.title}</h3>
                        <span className={`text-xs px-2 py-0.5 border border-black font-mono font-bold ${q.difficulty === 'Easy' ? 'bg-green-200' :
                            q.difficulty === 'Medium' ? 'bg-yellow-200' : 'bg-red-200'
                          }`}>
                          {q.difficulty.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm font-mono text-gray-600">
                        <span className="flex items-center gap-1">
                          <CheckCircle size={14} className="text-green-600" /> SCORE: <span className="font-bold text-black">{q.savedData.grade}/100</span>
                        </span>
                        {q.savedData.timestamp && (
                          <span className="flex items-center gap-1">
                            <Calendar size={14} /> {new Date(q.savedData.timestamp).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-black font-mono font-bold text-xs mt-2 group-hover:gap-2 transition-all">
                      REVIEW_CODE <ArrowRight size={14} className="ml-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SavedSolutions;