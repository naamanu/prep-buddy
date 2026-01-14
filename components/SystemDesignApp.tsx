import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { SYSTEM_DESIGN_QUESTIONS } from '@/systemDesignData';
import { logger } from '@/utils/logger';
import FlipCard from './FlipCard';
import LiveInterviewPanel from './LiveInterviewPanel';
import Modal from './Modal';
import Whiteboard from './Whiteboard';
import { chatWithSystemDesignTutor } from '@/services';
import { getStoredProgress, saveStoredProgress } from '@/services';
import type { ChatMessage } from '@/types';
import { ChevronRight, ChevronLeft, Home, Clock, Mic, MessageCircle, Send, Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface SystemDesignAppProps {
  onNavigateHome: () => void;
}

const SystemDesignApp: React.FC<SystemDesignAppProps> = ({ onNavigateHome }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [timeLimit, setTimeLimit] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [liveInterviewOpen, setLiveInterviewOpen] = useState(false);

  // Layout State
  const [fullScreenBoard, setFullScreenBoard] = useState(false);

  // Chat State
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Diagram State
  const [diagramData, setDiagramData] = useState<string>('');

  const currentQuestion = SYSTEM_DESIGN_QUESTIONS[currentQuestionIndex];

  useEffect(() => {
    if (!currentQuestion) return;

    const loadData = async () => {
      setIsFlipped(false);
      setTimeLeft(timeLimit * 60);
      setTimerActive(false);
      setChatInput('');
      setDiagramData('');

      try {
        // Load saved data
        const savedData = await getStoredProgress(currentQuestion.id);
        setChatHistory(savedData.chatHistory || []);
        setDiagramData(savedData.diagramData || '');
      } catch (e) {
        logger.error("Failed to load progress", e);
      }
    };
    loadData();

  }, [currentQuestionIndex, timeLimit, currentQuestion?.id]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  useEffect(() => {
    if (chatModalOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, chatModalOpen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNext = () => {
    if (currentQuestionIndex < SYSTEM_DESIGN_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const toggleInterview = () => {
    const newState = !liveInterviewOpen;
    setLiveInterviewOpen(newState);
    if (newState && !timerActive) {
      setTimerActive(true);
    }
  };

  const handleSendMessage = async () => {
    if (!currentQuestion || !chatInput.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    const updatedHistory = [...chatHistory, userMsg];

    setChatHistory(updatedHistory);
    setChatInput('');
    setChatLoading(true);

    await saveStoredProgress(currentQuestion.id, { chatHistory: updatedHistory });

    try {
      const response = await chatWithSystemDesignTutor(updatedHistory, userMsg.text, currentQuestion);
      const finalHistory = [...updatedHistory, { role: 'model', text: response } as ChatMessage];
      setChatHistory(finalHistory);
      await saveStoredProgress(currentQuestion.id, { chatHistory: finalHistory });
    } catch {
      setChatHistory(prev => [...prev, { role: 'model', text: "Sorry, I encountered an architectural error." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveDiagram = (data: string) => {
    setDiagramData(data);
    if (currentQuestion) {
      saveStoredProgress(currentQuestion.id, { diagramData: data });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white text-black font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b-2 border-black px-6 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onNavigateHome}
            className="p-2 border-2 border-transparent hover:border-black hover:bg-gray-100 transition-all"
            title="Back to Home"
          >
            <Home size={20} />
          </button>
          <div className="flex items-center gap-2 border-l-2 border-black pl-4">
            <div className="bg-black text-white font-mono font-bold px-1.5 text-sm">ARCH</div>
            <span className="font-mono font-bold text-lg uppercase tracking-tight hidden sm:inline">System Design</span>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          {/* Timer */}
          <div className="hidden md:flex items-center gap-3 bg-white border-2 border-black h-9 shadow-retro-sm">
            <button
              onClick={() => setTimerActive(!timerActive)}
              className="flex items-center gap-2 px-3 border-r-2 border-black hover:bg-gray-100 transition-colors h-full bg-yellow-50"
            >
              <Clock size={14} className={timerActive ? "text-black" : "text-gray-500"} />
              <span className={`font-mono text-sm font-bold ${timeLeft < 60 ? "text-red-600" : "text-black"}`}>
                {formatTime(timeLeft)}
              </span>
            </button>
            <select
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="bg-transparent text-xs font-mono font-bold text-black focus:outline-none cursor-pointer h-full px-2"
            >
              <option value={30}>30M</option>
              <option value={45}>45M</option>
              <option value={60}>60M</option>
            </select>
          </div>

          {/* Tools */}
          <div className="flex gap-2">
            <button
              onClick={() => setChatModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-black text-black text-xs font-mono font-bold shadow-retro-sm hover:shadow-retro transition-all hover:-translate-y-0.5 h-9"
            >
              <MessageCircle size={14} /> <span className="hidden sm:inline">AI ARCHITECT</span>
            </button>

            <button
              onClick={toggleInterview}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-black text-xs font-mono font-bold shadow-retro-sm hover:shadow-retro transition-all hover:-translate-y-0.5 h-9 ${liveInterviewOpen
                ? 'bg-red-600 text-white'
                : 'bg-white text-black'
                }`}
            >
              <Mic size={14} /> <span className="hidden sm:inline">{liveInterviewOpen ? 'END' : 'INTERVIEW'}</span>
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center bg-white border-2 border-black h-9 shadow-retro-sm">
            <button
              onClick={handlePrev}
              disabled={currentQuestionIndex === 0}
              className="px-2 hover:bg-black hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black border-r-2 border-black h-full flex items-center transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono font-bold text-black px-3 w-16 text-center bg-gray-50 h-full flex items-center justify-center">
              {currentQuestionIndex + 1}/{SYSTEM_DESIGN_QUESTIONS.length}
            </span>
            <button
              onClick={handleNext}
              disabled={currentQuestionIndex === SYSTEM_DESIGN_QUESTIONS.length - 1}
              className="px-2 hover:bg-black hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black border-l-2 border-black h-full flex items-center transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Left Panel: Problem Statement */}
        <div className={`${fullScreenBoard ? 'hidden' : 'w-full lg:w-1/3'} h-full border-r-2 border-black bg-[#f0f0f0] p-4 flex flex-col transition-all duration-300`}>
          <div className="flex-1 relative">
            <FlipCard
              question={currentQuestion}
              isFlipped={isFlipped}
              onFlip={() => setIsFlipped(!isFlipped)}
            />
          </div>
        </div>

        {/* Right Panel: Whiteboard */}
        <div className={`${fullScreenBoard ? 'w-full' : 'hidden lg:block lg:w-2/3'} h-full bg-white relative transition-all duration-300 flex flex-col`}>
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => setFullScreenBoard(!fullScreenBoard)}
              className="p-2 bg-white border-2 border-black shadow-retro-sm hover:bg-gray-100"
              title={fullScreenBoard ? "Exit Fullscreen" : "Fullscreen Canvas"}
            >
              {fullScreenBoard ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
          </div>
          <Whiteboard
            key={currentQuestion.id} // Re-mount on question change
            initialData={diagramData}
            onSave={handleSaveDiagram}
          />
        </div>

        <LiveInterviewPanel
          isOpen={liveInterviewOpen}
          onClose={() => setLiveInterviewOpen(false)}
          question={currentQuestion}
          timerDisplay={formatTime(timeLeft)}
          mode="system-design"
        />

        {/* Chat Modal */}
        <Modal
          isOpen={chatModalOpen}
          onClose={() => setChatModalOpen(false)}
          title="ARCHITECT_CONSULTATION"
          className="max-w-3xl h-[80vh]"
        >
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {chatHistory.length === 0 && (
                <div className="text-center text-gray-400 text-xs font-mono mt-10">
                  <p>&lt; SYSTEM ARCHITECT READY. ASK ABOUT SCALABILITY, DB, OR DESIGN PATTERNS. &gt;</p>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] border-2 border-black p-3 text-sm shadow-retro-sm ${msg.role === 'user'
                    ? 'bg-black text-white'
                    : 'bg-white text-black'
                    }`}>
                    {msg.role === 'model' ? (
                      <div className="prose prose-sm max-w-none prose-p:font-mono prose-p:text-xs prose-code:bg-gray-200 prose-code:text-black prose-pre:bg-gray-200 prose-pre:text-black">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap font-mono text-xs">{msg.text}</div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border-2 border-black p-3">
                    <Loader2 className="animate-spin w-4 h-4 text-black" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex items-center gap-2 pt-4 border-t-2 border-black border-dashed">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="QUERY ARCHITECT..."
                disabled={chatLoading}
                className="flex-1 bg-white text-black border-2 border-black px-4 py-2 text-sm font-mono focus:outline-none focus:bg-yellow-50 disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || chatLoading}
                className="bg-black text-white p-2 border-2 border-black hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </Modal>

      </main>
    </div>
  );
};

export default SystemDesignApp;