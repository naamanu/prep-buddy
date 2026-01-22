
import React from 'react';
import type { Question } from '@/types';
import { Eye, ArrowLeft, Terminal, Loader2 } from 'lucide-react';

interface FlipCardProps {
  question: Question;
  isFlipped: boolean;
  onFlip: () => void;
  isSolutionReady?: boolean;
}

const FlipCard: React.FC<FlipCardProps> = ({ question, isFlipped, onFlip, isSolutionReady = true }) => {
  return (
    <div className="w-full h-full perspective-1000">
      <div 
        className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        
        {/* FRONT */}
        <div className="absolute inset-0 backface-hidden bg-white border-2 border-black shadow-retro flex flex-col">
          <div className="border-b-2 border-black bg-gray-100 p-3 flex justify-between items-center">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 border border-black rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 border border-black rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 border border-black rounded-full"></div>
             </div>
             <span className="font-mono text-xs font-bold text-gray-500 uppercase">ID: {question.id}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold font-mono text-black mb-3 uppercase tracking-tight">{question.title}</h2>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-mono font-bold border border-black ${
                    question.difficulty === 'Easy' ? 'bg-green-200 text-black' :
                    question.difficulty === 'Medium' ? 'bg-yellow-200 text-black' :
                    'bg-red-200 text-black'
                  }`}>
                    {question.difficulty.toUpperCase()}
                  </span>
                  {question.tags && question.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center px-2 py-1 text-xs font-mono border border-black bg-white text-black">
                      # {tag}
                    </span>
                  ))}
                </div>
              </div>
              {isSolutionReady ? (
                <button 
                  onClick={onFlip}
                  className="text-xs flex items-center gap-1 bg-black text-white font-mono font-bold px-3 py-2 border-2 border-black hover:bg-white hover:text-black transition-colors shadow-retro-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                  <Eye size={14} /> REVEAL_SOLUTION
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-gray-100 text-gray-500 text-xs font-mono px-3 py-2 border-2 border-gray-300">
                   <Loader2 className="animate-spin" size={12} />
                   <span>GENERATING...</span>
                </div>
              )}
            </div>

            <div className="prose prose-sm max-w-none text-gray-800 font-mono">
              <p className="whitespace-pre-wrap mb-8 text-sm leading-relaxed">{question.description}</p>
              
              {question.examples && question.examples.length > 0 && (
                <div className="space-y-4 mb-8">
                  <h3 className="text-sm font-bold text-black uppercase tracking-wide bg-gray-200 inline-block px-1">Examples</h3>
                  {question.examples.map((ex, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 border-2 border-gray-200 text-xs">
                      <div className="mb-2"><span className="font-bold text-black">INPUT:</span> {ex.input}</div>
                      <div><span className="font-bold text-black">OUTPUT:</span> {ex.output}</div>
                      {ex.explanation && (
                        <div className="mt-2 text-gray-500 border-t border-gray-200 pt-2 italic">
                          // {ex.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {question.constraints && question.constraints.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-black uppercase tracking-wide bg-gray-200 inline-block px-1 mb-2">Constraints</h3>
                  <ul className="list-none pl-0 text-xs text-gray-600 space-y-1">
                    {question.constraints.map((c, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-black font-bold">&gt;</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-black border-2 border-black shadow-retro flex flex-col text-green-400 font-mono">
          <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-900">
             <span className="font-bold text-xs uppercase flex items-center gap-2"><Terminal size={14}/> Terminal Output</span>
             <button 
                onClick={onFlip}
                className="text-xs flex items-center gap-1 text-black bg-green-400 hover:bg-green-300 px-3 py-1 font-bold uppercase"
              >
                <ArrowLeft size={14} /> Return
              </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-black">
            <pre className="whitespace-pre-wrap text-xs lg:text-sm leading-relaxed font-mono text-green-400">
              {question.officialSolution}
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FlipCard;
