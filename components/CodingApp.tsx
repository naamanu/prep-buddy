import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { QUESTIONS } from '@/constants';
import { logger } from '@/utils/logger';
import { DATA_STRUCTURES, ALGORITHMS, INTERVIEW_CONCEPTS } from '@/referenceData';
import FlipCard from './FlipCard';
import Editor from './Editor';
import AnalysisResultView from './AnalysisResult';
import ReferenceLibrary from './ReferenceLibrary';
import SavedSolutions from './SavedSolutions';
import Modal from './Modal';
import LiveInterviewPanel from './LiveInterviewPanel';
import SolutionComparison from './SolutionComparison';
import { analyzeSolution, getProblemExplanation, chatWithTutor, generateOfficialSolution } from '@/services';
import type { AnalysisResult, Question, ChatMessage } from '@/types';
import { getStoredProgress, saveStoredProgress } from '@/services';
import { Send, ChevronRight, ChevronLeft, Loader2, RotateCcw, Clock, Home, Code2, Database, Network, ArrowRight, ArrowLeft, Sparkles, MessageCircle, CheckCircle, Mic, Trophy, SplitSquareHorizontal, Keyboard, Brain, FilePlus } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface CodingAppProps {
  onNavigateHome: () => void;
}

type CodingView = 'menu' | 'practice' | 'data-structures' | 'algorithms' | 'concepts' | 'history' | 'custom-setup';

const TooltipWrapper = ({ children, text }: { children?: React.ReactNode, text: string }) => (
  <div className="group relative flex items-center h-full">
    {children}
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-max px-3 py-1 bg-black text-white text-[10px] font-mono border border-white shadow-retro-sm z-50 pointer-events-none whitespace-nowrap">
      {text}
    </div>
  </div>
);

const RetroCard = ({
  title,
  description,
  icon: Icon,
  onClick,
  label,
  accentColor = "bg-white"
}: {
  title: string,
  description: string,
  icon: any,
  onClick: () => void,
  label: string,
  accentColor?: string
}) => (
  <div
    onClick={onClick}
    className="group relative bg-white border-2 border-black p-6 cursor-pointer transition-transform hover:-translate-y-1 hover:-translate-x-1 shadow-retro hover:shadow-retro-lg"
  >
    <div className="flex flex-col h-full">
      <div className={`w-12 h-12 ${accentColor} border-2 border-black flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-colors`}>
        <Icon size={24} strokeWidth={2} />
      </div>

      <h3 className="text-xl font-bold font-mono text-black mb-2 uppercase tracking-tight">{title}</h3>
      <p className="text-gray-600 font-mono text-xs leading-relaxed mb-6 flex-1 border-t-2 border-gray-100 pt-2">
        {description}
      </p>

      <div className="flex items-center gap-2 text-black font-mono text-sm font-bold group-hover:gap-4 transition-all">
        <span className="uppercase">{label}</span>
        <ArrowRight size={16} />
      </div>
    </div>
  </div>
);

const CodingApp: React.FC<CodingAppProps> = ({ onNavigateHome }) => {
  // View State
  const [currentView, setCurrentView] = useState<CodingView>('menu');

  // Filtering State
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Derived State: Filtered Questions
  const filteredQuestions = useMemo(() => {
    return QUESTIONS.filter(q => {
      const matchesDiff = difficultyFilter === 'All' || q.difficulty === difficultyFilter;
      const matchesCat = categoryFilter === 'All' || q.category === categoryFilter;
      return matchesDiff && matchesCat;
    });
  }, [difficultyFilter, categoryFilter]);

  const categories = useMemo(() => {
    return Array.from(new Set(QUESTIONS.map(q => q.category))).sort();
  }, []);

  // Current Question Logic
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [customQuestion, setCustomQuestion] = useState<Question | null>(null);

  // Custom Problem Form State
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [isCustomSolutionLoading, setIsCustomSolutionLoading] = useState(false);

  // Question State
  const [code, setCode] = useState('');
  const [timeComplexity, setTimeComplexity] = useState('');
  const [spaceComplexity, setSpaceComplexity] = useState('');

  // Flip Card State
  const [isFlipped, setIsFlipped] = useState(false);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Timer State
  const [timeLimit, setTimeLimit] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [timerActive, setTimerActive] = useState(true);

  // Explanation State
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationText, setExplanationText] = useState('');

  // Chat State
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Live Interview State
  const [liveInterviewOpen, setLiveInterviewOpen] = useState(false);

  // Comparison State
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Saved Progress State
  const [isSolved, setIsSolved] = useState(false);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  const currentQuestion: Question | undefined = customQuestion || filteredQuestions[currentQuestionIndex];

  useEffect(() => {
    if (!currentQuestion) return;

    // Only reset logic if we are not in custom mode or if switching problems
    if (!customQuestion) {
      const loadData = async () => {
        setTimeComplexity('');
        setSpaceComplexity('');
        setResult(null);
        setError(null);
        setIsFlipped(false);
        setTimeLeft(timeLimit * 60);
        setTimerActive(true);
        setChatInput('');
        setIsLoadingProgress(true);

        try {
          const savedData = await getStoredProgress(currentQuestion.id);

          setCode(savedData.userCode || '');
          setExplanationText(savedData.explanation || '');
          setChatHistory(savedData.chatHistory || []);
          setIsSolved(savedData.isSolved);

          if (savedData.isSolved && savedData.analysisResult) {
            setResult(savedData.analysisResult);
          }
        } catch (error) {
          logger.error("Error loading progress:", error);
        } finally {
          setIsLoadingProgress(false);
        }
      };
      loadData();
    }

  }, [currentQuestion?.id, timeLimit, customQuestion]);

  useEffect(() => {
    setCurrentQuestionIndex(0);
  }, [difficultyFilter, categoryFilter, companyFilter]);

  useEffect(() => {
    if (chatModalOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, chatModalOpen]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (currentView === 'practice' && timerActive && timeLeft > 0 && !isFlipped && currentQuestion) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false);
      setIsFlipped(true);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, isFlipped, currentQuestion, currentView]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView !== 'practice') return;

      // Cmd/Ctrl + Enter -> Run Code
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }

      // Cmd/Ctrl + Shift + F -> Flip Card (only if no modal open)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      }

      // Cmd/Ctrl + ArrowRight -> Next (Disable in Custom Mode)
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight' && !customQuestion) {
        e.preventDefault();
        handleNext();
      }

      // Cmd/Ctrl + ArrowLeft -> Prev (Disable in Custom Mode)
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft' && !customQuestion) {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, code, timeComplexity, spaceComplexity, currentQuestionIndex, filteredQuestions, customQuestion]);


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNext = () => {
    if (currentQuestionIndex < filteredQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!currentQuestion) return;
    if (!code.trim()) {
      setError("Please write some code before submitting.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setTimerActive(false);

    try {
      const analysis = await analyzeSolution({
        questionTitle: currentQuestion.title,
        questionDescription: currentQuestion.description,
        userCode: code,
        userTimeComplexity: timeComplexity || "Not specified",
        userSpaceComplexity: spaceComplexity || "Not specified"
      });

      setResult(analysis);

      if (analysis.isCorrect) {
        setIsSolved(true);

        // Only save progress if it's a standard question
        if (!customQuestion) {
          await saveStoredProgress(currentQuestion.id, {
            isSolved: true,
            grade: analysis.grade,
            userCode: code,
            analysisResult: analysis
          });
        }
      }

      if (!analysis.isCorrect || analysis.grade < 70) {
        setIsFlipped(true);
      }

    } catch {
      setError("Failed to analyze solution. Please check your API key or internet connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExplain = async () => {
    if (!currentQuestion) return;
    setExplainModalOpen(true);

    if (!explanationText) {
      setExplanationLoading(true);
      try {
        const text = await getProblemExplanation(currentQuestion);
        setExplanationText(text);
        if (!customQuestion) {
          await saveStoredProgress(currentQuestion.id, { explanation: text });
        }
      } catch {
        setExplanationText("Failed to generate explanation.");
      } finally {
        setExplanationLoading(false);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!currentQuestion || !chatInput.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    const updatedHistory = [...chatHistory, userMsg];

    setChatHistory(updatedHistory);
    setChatInput('');
    setChatLoading(true);

    if (!customQuestion) {
      await saveStoredProgress(currentQuestion.id, { chatHistory: updatedHistory });
    }

    try {
      const response = await chatWithTutor(updatedHistory, userMsg.text, currentQuestion);
      const finalHistory = [...updatedHistory, { role: 'model', text: response } as ChatMessage];
      setChatHistory(finalHistory);
      if (!customQuestion) {
        await saveStoredProgress(currentQuestion.id, { chatHistory: finalHistory });
      }
    } catch {
      setChatHistory(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSelectSavedQuestion = (questionId: string) => {
    const question = QUESTIONS.find(q => q.id === questionId);
    if (!question) return;

    setDifficultyFilter('All');
    setCategoryFilter('All');
    setCustomQuestion(null); // Clear custom if any

    const index = QUESTIONS.findIndex(q => q.id === questionId);
    if (index !== -1) {
      setCurrentQuestionIndex(index);
      setCurrentView('practice');
    }
  };

  const handleCreateCustomQuestion = () => {
    if (!customTitle.trim() || !customDescription.trim()) return;

    const tempId = `custom-${Date.now()}`;

    // Create initial question with placeholder solution
    const newQuestion: Question = {
      id: tempId,
      title: customTitle,
      description: customDescription,
      difficulty: 'Medium',
      category: 'Custom',
      officialSolution: "", // Empty initially
      tags: ['Custom'],
      companies: ['Personal']
    };

    setCustomQuestion(newQuestion);
    setIsCustomSolutionLoading(true);

    setCode('');
    setTimeComplexity('');
    setSpaceComplexity('');
    setResult(null);
    setExplanationText('');
    setChatHistory([]);
    setIsSolved(false);
    setIsFlipped(false);
    setCurrentView('practice');

    // Generate solution in background
    generateOfficialSolution(customTitle, customDescription)
      .then((generatedSolution) => {
        setCustomQuestion(prev => {
          if (prev && prev.id === tempId) {
            return { ...prev, officialSolution: generatedSolution };
          }
          return prev;
        });
      })
      .catch(e => {
        logger.error("Failed to generate custom solution", e);
        setCustomQuestion(prev => {
          if (prev && prev.id === tempId) {
            return { ...prev, officialSolution: "Failed to generate solution. You can still use the AI tutor for help." };
          }
          return prev;
        });
      })
      .finally(() => {
        setIsCustomSolutionLoading(false);
      });
  };

  // Render the Menu (Dashboard)
  if (currentView === 'menu') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="h-20 px-6 flex items-center justify-between border-b-2 border-black bg-white z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateHome}
              className="p-2 border-2 border-transparent hover:border-black hover:bg-gray-100 transition-all rounded-none"
              title="Back to Home"
            >
              <Home size={24} />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l-2 border-black">
              <div className="bg-black text-white font-mono font-bold px-2 py-1 text-sm">PB_SYS</div>
              <span className="font-mono font-bold text-xl uppercase tracking-tight">Dashboard</span>
            </div>
          </div>
          <div className="font-mono text-xs text-gray-400 hidden sm:block">
            SELECT_MODULE_TO_BEGIN_
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-6xl w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <RetroCard
                title="Practice"
                label="Initialize"
                description="Solve Blind 75 problems with an intelligent editor that grades complexity."
                icon={Code2}
                onClick={() => { setCustomQuestion(null); setCurrentView('practice'); }}
                accentColor="bg-blue-100"
              />

              <RetroCard
                title="Custom Problem"
                label="New Task"
                description="Paste your own question description and use the AI environment to solve it."
                icon={FilePlus}
                onClick={() => setCurrentView('custom-setup')}
                accentColor="bg-cyan-100"
              />

              <RetroCard
                title="History"
                label="Review"
                description="Access your saved solutions and past performance grades."
                icon={Trophy}
                onClick={() => setCurrentView('history')}
                accentColor="bg-green-100"
              />

              <RetroCard
                title="Structures"
                label="Library"
                description="Flashcards for Lists, Trees, Graphs, Heaps, and more."
                icon={Database}
                onClick={() => setCurrentView('data-structures')}
                accentColor="bg-purple-100"
              />

              <RetroCard
                title="Algorithms"
                label="Library"
                description="Master standard algorithms like DFS, BFS, and Sorting."
                icon={Network}
                onClick={() => setCurrentView('algorithms')}
                accentColor="bg-yellow-100"
              />

              <RetroCard
                title="Concepts"
                label="Library"
                description="Cheatsheets for Big O, System Design, and OOP Principles."
                icon={Brain}
                onClick={() => setCurrentView('concepts')}
                accentColor="bg-pink-100"
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (currentView === 'custom-setup') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white border-2 border-black shadow-retro flex flex-col">
          <div className="bg-cyan-100 p-4 border-b-2 border-black flex items-center gap-2">
            <FilePlus size={20} />
            <h2 className="text-lg font-bold font-mono uppercase tracking-tight">Custom Protocol Setup</h2>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <label className="block font-mono text-xs font-bold mb-2 uppercase">Problem Title</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Fibonacci Sequence"
                className="w-full bg-white text-black border-2 border-black p-3 font-mono text-sm focus:outline-none focus:bg-yellow-50 shadow-retro-sm"
              />
            </div>
            <div>
              <label className="block font-mono text-xs font-bold mb-2 uppercase">Problem Description</label>
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Paste the full problem statement here..."
                className="w-full bg-white text-black border-2 border-black p-3 font-mono text-sm h-48 resize-none focus:outline-none focus:bg-yellow-50 shadow-retro-sm"
              />
            </div>
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setCurrentView('menu')}
                className="px-6 py-3 border-2 border-black font-mono font-bold text-sm hover:bg-gray-100 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleCreateCustomQuestion}
                disabled={!customTitle.trim() || !customDescription.trim()}
                className="flex-1 bg-black text-white px-6 py-3 border-2 border-black font-mono font-bold text-sm hover:bg-gray-800 transition-all shadow-retro-sm disabled:opacity-50"
              >
                INITIALIZE SESSION
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'data-structures') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="bg-purple-100 border-b-2 border-black p-4">
          <button onClick={() => setCurrentView('menu')} className="flex items-center gap-2 font-mono font-bold text-sm hover:underline"><ArrowLeft size={16} /> BACK_TO_MENU</button>
        </div>
        <ReferenceLibrary items={DATA_STRUCTURES} title="Data Structures" />
      </div>
    );
  }

  if (currentView === 'algorithms') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="bg-yellow-100 border-b-2 border-black p-4">
          <button onClick={() => setCurrentView('menu')} className="flex items-center gap-2 font-mono font-bold text-sm hover:underline"><ArrowLeft size={16} /> BACK_TO_MENU</button>
        </div>
        <ReferenceLibrary items={ALGORITHMS} title="Algorithms" />
      </div>
    );
  }

  if (currentView === 'concepts') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="bg-pink-100 border-b-2 border-black p-4">
          <button onClick={() => setCurrentView('menu')} className="flex items-center gap-2 font-mono font-bold text-sm hover:underline"><ArrowLeft size={16} /> BACK_TO_MENU</button>
        </div>
        <ReferenceLibrary items={INTERVIEW_CONCEPTS} title="Concepts" />
      </div>
    );
  }

  if (currentView === 'history') {
    return (
      <SavedSolutions
        onSelectQuestion={handleSelectSavedQuestion}
        onNavigateBack={() => setCurrentView('menu')}
      />
    );
  }

  // --- PRACTICE VIEW ---

  if (!currentQuestion) return null;

  return (
    <div className="h-screen flex flex-col bg-white text-black font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b-2 border-black px-6 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentView('menu')}
            className="p-2 border-2 border-transparent hover:border-black hover:bg-gray-100 transition-all"
            title="Back to Menu"
          >
            <Home size={20} />
          </button>
          <div className="flex items-center gap-2 border-l-2 border-black pl-4">
            <div className="bg-black text-white font-mono font-bold px-1.5 text-sm">DS&A</div>
            <span className="font-mono font-bold text-lg uppercase tracking-tight hidden md:inline">Workstation</span>
          </div>
        </div>

        {/* Middle Controls */}
        <div className="flex items-center gap-4">
          {/* Filter Dropdowns (Only show if not custom) */}
          {!customQuestion && (
            <div className="hidden lg:flex gap-2">
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value as any)}
                className="bg-white border-2 border-black px-2 py-1 text-xs font-mono font-bold focus:outline-none hover:bg-gray-50 cursor-pointer shadow-retro-sm"
              >
                <option value="All">DIFF: ALL</option>
                <option value="Easy">EASY</option>
                <option value="Medium">MEDIUM</option>
                <option value="Hard">HARD</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white border-2 border-black px-2 py-1 text-xs font-mono font-bold focus:outline-none hover:bg-gray-50 cursor-pointer shadow-retro-sm max-w-[120px]"
              >
                <option value="All">CAT: ALL</option>
                {categories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
          )}

          {/* Timer */}
          <div className="flex items-center gap-3 bg-white border-2 border-black h-9 shadow-retro-sm">
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
              onChange={(e) => {
                const newLimit = Number(e.target.value);
                setTimeLimit(newLimit);
                setTimeLeft(newLimit * 60);
              }}
              className="bg-transparent text-xs font-mono font-bold text-black focus:outline-none cursor-pointer h-full px-2"
            >
              <option value={15}>15M</option>
              <option value={30}>30M</option>
              <option value={45}>45M</option>
              <option value={60}>60M</option>
            </select>
          </div>

          {/* Navigation (Disabled for Custom) */}
          {!customQuestion && (
            <div className="flex items-center bg-white border-2 border-black h-9 shadow-retro-sm">
              <button
                onClick={handlePrev}
                disabled={currentQuestionIndex === 0}
                className="px-2 hover:bg-black hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black border-r-2 border-black h-full flex items-center transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-mono font-bold text-black px-3 w-12 text-center bg-gray-50 h-full flex items-center justify-center">
                {currentQuestionIndex + 1}/{filteredQuestions.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentQuestionIndex === filteredQuestions.length - 1}
                className="px-2 hover:bg-black hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black border-l-2 border-black h-full flex items-center transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* Left Panel: Problem Card */}
        <div className="w-full lg:w-1/2 h-full bg-[#f0f0f0] border-r-2 border-black p-4 lg:p-6 overflow-hidden flex flex-col">
          <div className="flex-1 relative">
            <FlipCard
              question={currentQuestion}
              isFlipped={isFlipped}
              onFlip={() => setIsFlipped(!isFlipped)}
              isSolutionReady={!customQuestion || !isCustomSolutionLoading}
            />
          </div>

          {/* Toolbar */}
          <div className="mt-4 flex gap-2 flex-wrap justify-center lg:justify-start">
            <TooltipWrapper text="Get AI Explanation">
              <button onClick={handleExplain} className="p-2 bg-white border-2 border-black shadow-retro-sm hover:-translate-y-0.5 hover:shadow-retro transition-all">
                <Sparkles size={18} />
              </button>
            </TooltipWrapper>
            <TooltipWrapper text="Chat with Tutor">
              <button onClick={() => setChatModalOpen(true)} className="p-2 bg-white border-2 border-black shadow-retro-sm hover:-translate-y-0.5 hover:shadow-retro transition-all">
                <MessageCircle size={18} />
              </button>
            </TooltipWrapper>
            <TooltipWrapper text="Compare Solutions">
              <button
                onClick={() => setComparisonOpen(true)}
                disabled={!isSolved && !isFlipped}
                className="p-2 bg-white border-2 border-black shadow-retro-sm hover:-translate-y-0.5 hover:shadow-retro transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-retro-sm"
              >
                <SplitSquareHorizontal size={18} />
              </button>
            </TooltipWrapper>
            <TooltipWrapper text="Voice Interview">
              <button onClick={() => setLiveInterviewOpen(true)} className="p-2 bg-white border-2 border-black shadow-retro-sm hover:-translate-y-0.5 hover:shadow-retro transition-all">
                <Mic size={18} />
              </button>
            </TooltipWrapper>
            <div className="ml-auto hidden md:block">
              <TooltipWrapper text="Shortcuts">
                <button onClick={() => setShortcutsOpen(true)} className="p-2 text-gray-500 hover:text-black">
                  <Keyboard size={18} />
                </button>
              </TooltipWrapper>
            </div>
          </div>
        </div>

        {/* Right Panel: Editor & Analysis */}
        <div className="w-full lg:w-1/2 h-full flex flex-col bg-white relative">
          {/* Editor Header */}
          <div className="h-10 bg-gray-100 border-b-2 border-black flex items-center justify-between px-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-gray-500">
              <Code2 size={14} /> SOLUTION.PY
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono uppercase text-gray-500">Time:</span>
                <input
                  type="text"
                  placeholder="O(n)"
                  value={timeComplexity}
                  onChange={(e) => setTimeComplexity(e.target.value)}
                  className="w-16 bg-white text-black border border-gray-300 px-1 text-xs font-mono focus:outline-none focus:border-black"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono uppercase text-gray-500">Space:</span>
                <input
                  type="text"
                  placeholder="O(1)"
                  value={spaceComplexity}
                  onChange={(e) => setSpaceComplexity(e.target.value)}
                  className="w-16 bg-white text-black border border-gray-300 px-1 text-xs font-mono focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>

          {/* Code Editor Area */}
          <div className="flex-1 overflow-hidden relative">
            {isLoadingProgress && (
              <div className="absolute inset-0 z-20 bg-white/80 flex items-center justify-center">
                <Loader2 className="animate-spin" size={32} />
              </div>
            )}

            {result ? (
              <div className="absolute inset-0 overflow-y-auto pb-20 bg-gray-50">
                <AnalysisResultView result={result} />
                <div className="flex justify-center gap-4 p-6">
                  <button
                    onClick={() => setResult(null)}
                    className="px-4 py-2 border-2 border-black bg-white shadow-retro-sm hover:shadow-retro font-mono font-bold text-sm flex items-center gap-2"
                  >
                    <RotateCcw size={14} /> EDIT_CODE
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={customQuestion !== null}
                    className="px-4 py-2 border-2 border-black bg-black text-white shadow-retro-sm hover:translate-y-0.5 hover:shadow-none font-mono font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    NEXT_PROBLEM <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <Editor code={code} setCode={setCode} />
            )}
          </div>

          {/* Submit Bar */}
          {!result && (
            <div className="p-4 border-t-2 border-black bg-gray-50 flex justify-end">
              {error && <span className="text-red-500 font-mono text-xs mr-4 self-center">{error}</span>}
              <button
                onClick={handleSubmit}
                disabled={isAnalyzing || isLoadingProgress}
                className="bg-black text-white px-6 py-3 font-mono font-bold text-sm border-2 border-black shadow-retro-sm hover:shadow-retro hover:-translate-y-1 transition-all flex items-center gap-2 disabled:opacity-70 disabled:hover:transform-none disabled:shadow-none"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                {isAnalyzing ? 'ANALYZING...' : 'SUBMIT_SOLUTION'}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}

      {/* Explanation Modal */}
      <Modal
        isOpen={explainModalOpen}
        onClose={() => setExplainModalOpen(false)}
        title="ALGORITHMIC_BREAKDOWN"
        className="max-w-2xl"
      >
        {explanationLoading ? (
          <LoadingSpinner message="DECRYPTING_LOGIC..." size="md" className="py-12" />
        ) : (
          <div className="prose prose-sm max-w-none font-mono">
            <ReactMarkdown>{explanationText}</ReactMarkdown>
          </div>
        )}
      </Modal>

      {/* Chat Modal */}
      <Modal
        isOpen={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        title="AI_TUTOR_UPLINK"
        className="max-w-3xl h-[80vh]"
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {chatHistory.length === 0 && (
              <div className="text-center text-gray-400 text-xs font-mono mt-10">
                <p>&lt; UPLINK ESTABLISHED. ASK FOR HINTS OR SYNTAX HELP. &gt;</p>
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
              placeholder="ENTER QUERY..."
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

      {/* Live Interview Panel */}
      <LiveInterviewPanel
        isOpen={liveInterviewOpen}
        onClose={() => setLiveInterviewOpen(false)}
        question={currentQuestion}
        timerDisplay={formatTime(timeLeft)}
        mode="coding"
      />

      {/* Shortcuts Modal */}
      <Modal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="KEYBOARD_MACROS"
        className="max-w-md"
      >
        <div className="space-y-4 font-mono text-sm">
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <span>RUN_CODE</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-300">Cmd + Enter</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <span>FLIP_CARD</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-300">Cmd + Shift + F</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <span>NEXT_PROBLEM</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-300">Cmd + Right</span>
          </div>
          <div className="flex justify-between">
            <span>PREV_PROBLEM</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-300">Cmd + Left</span>
          </div>
        </div>
      </Modal>

      {/* Comparison Modal */}
      <Modal
        isOpen={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        title="SOLUTION_DIFF"
        className="max-w-5xl h-[85vh]"
      >
        <SolutionComparison
          userCode={code}
          officialSolutionMarkdown={currentQuestion.officialSolution}
        />
      </Modal>
    </div>
  );
};

export default CodingApp;