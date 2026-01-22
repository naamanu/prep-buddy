import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Code2, Server, ArrowRight, Sparkles, Terminal, Cpu, BookOpen, Loader2, Search, Mic } from 'lucide-react';
import { identifyCodingPattern } from '@/services';
import Tour from './Tour';

interface LandingPageProps {
  onNavigate: (page: 'coding' | 'system-design' | 'learning' | 'mock-interview') => void;
}

// --- Dither / Genie Components ---

const DitherBackground = () => (
  <div
    className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none"
    style={{
      backgroundImage: 'radial-gradient(#000 1px, transparent 0)',
      backgroundSize: '4px 4px'
    }}
  />
);

const RetroCard = ({
  id,
  title,
  description,
  icon: Icon,
  onClick,
  label,
  accentColor = "bg-white"
}: {
  id?: string,
  title: string,
  description: string,
  icon: any,
  onClick: () => void,
  label: string,
  accentColor?: string
}) => (
  <div
    id={id}
    onClick={onClick}
    className="group relative bg-white border-2 border-black p-6 cursor-pointer transition-transform hover:-translate-y-1 hover:-translate-x-1 flex flex-col h-full"
    style={{ boxShadow: '8px 8px 0px 0px #000000' }}
  >
    {/* Label Badge */}
    <div className="absolute -top-3 right-4 bg-black text-white text-xs font-mono py-1 px-2 uppercase tracking-widest">
      {label}
    </div>

    <div className="flex flex-col h-full">
      <div className={`w-12 h-12 ${accentColor} border-2 border-black flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-colors`}>
        <Icon size={24} strokeWidth={2} />
      </div>

      <h3 className="text-xl font-bold font-mono text-black mb-2 uppercase tracking-tight">{title}</h3>
      <p className="text-gray-600 font-mono text-xs leading-relaxed mb-6 flex-1 border-t border-gray-100 pt-2">
        {description}
      </p>

      <div className="flex items-center gap-2 text-black font-mono text-sm font-bold group-hover:gap-4 transition-all mt-auto">
        <span className="uppercase">Initialize</span>
        <ArrowRight size={16} />
      </div>
    </div>
  </div>
);

const PatternRecognizer = () => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const analysis = await identifyCodingPattern(input);
      setResult(analysis);
    } catch {
      setResult("Unable to analyze pattern. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="tour-pattern" className="w-full max-w-2xl mx-auto mb-8 px-4 md:px-0 relative z-20">
      <div className="bg-white border-2 border-black shadow-retro flex flex-col">
        <div className="relative bg-gray-50 border-b-2 border-black p-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 border border-black"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500 border border-black"></div>
          <div className="w-3 h-3 rounded-full bg-green-500 border border-black"></div>
          <span className="ml-2 font-mono text-[10px] font-bold uppercase text-gray-500">Pattern_Recognition_Module.exe</span>
        </div>
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="PASTE PROBLEM DESCRIPTION HERE TO IDENTIFY PATTERN..."
            className="w-full min-h-[100px] p-4 pr-14 bg-white text-black font-mono text-xs md:text-sm focus:outline-none resize-y placeholder:text-gray-400 uppercase"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !input.trim()}
            className="absolute bottom-3 right-3 bg-black text-white p-2 hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm border border-transparent hover:border-gray-600"
            title="Identify Pattern"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          </button>
        </div>

        {result && (
          <div className="bg-yellow-50 border-t-2 border-black p-4 animate-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-black"><Search size={16} /></div>
              <div className="prose prose-sm max-w-none font-mono leading-relaxed text-xs md:text-sm text-black">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const tourCompleted = localStorage.getItem('pb_tour_completed');
    if (!tourCompleted) {
      const timer = setTimeout(() => setShowTour(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleTourComplete = () => {
    setShowTour(false);
    localStorage.setItem('pb_tour_completed', 'true');
  };

  const tourSteps = [
    {
      targetId: 'tour-pattern',
      title: 'AI Pattern Analysis',
      content: 'Stuck on a problem? Paste the description here, and the Gemini AI will identify the algorithmic pattern (e.g. "Sliding Window") for you.'
    },
    {
      targetId: 'tour-coding',
      title: 'Coding Practice',
      content: 'Tackle the Blind 75 with our specialized IDE. It provides instant complexity grading and conversational AI hints.'
    },
    {
      targetId: 'tour-system',
      title: 'System Design',
      content: 'Learn how to architect scalable systems like Uber or YouTube. Includes interactive whiteboard-style interviews with an AI Architect.'
    },
    {
      targetId: 'tour-learning',
      title: 'Knowledge Base',
      content: 'Access a library of flashcards or generate custom learning modules for any Computer Science topic you want to master.'
    },
    {
      targetId: 'tour-interview',
      title: 'Mock Interview',
      content: 'Upload your resume and practice with an AI interviewer. Choose your interviewer persona and get personalized feedback on your performance.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans selection:bg-black selection:text-white overflow-x-hidden flex flex-col">
      <DitherBackground />

      {showTour && <Tour steps={tourSteps} onComplete={handleTourComplete} onSkip={handleTourComplete} />}

      {/* Early Access Banner */}
      <div className="relative z-50 bg-yellow-400 text-black text-center py-1.5 border-b-2 border-black">
        <p className="font-mono text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2">
          <span className="hidden sm:inline">🚧</span>
          EARLY ACCESS: SYSTEM IS IN BETA
        </p>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-mono font-bold text-lg border-2 border-transparent">
            PB
          </div>
          <span className="font-mono font-bold text-xl tracking-tighter uppercase hidden sm:block">PreppBuddy</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-gray-500 border border-gray-300 px-3 py-1 rounded-full bg-white">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            SYSTEMS ONLINE
          </div>

          <button onClick={() => setShowTour(true)} className="font-mono text-sm underline underline-offset-4 hover:bg-black hover:text-white px-2 py-1 transition-colors">
            Help
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 pt-10 pb-20">

        {/* <GenieOrb />

        <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-6 max-w-4xl mx-auto leading-[0.9]">
          Master The <br/>
          <span className="relative inline-block">
            <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-b from-gray-700 to-black">Machine</span>
            <span className="absolute bottom-2 left-0 right-0 h-4 bg-gray-200 -z-10 transform -skew-x-12"></span>
          </span>
        </h1> */}

        <p className="font-mono text-sm md:text-base text-gray-600 max-w-xl mx-auto mb-12 border-l-2 border-black pl-4 text-left md:text-center md:border-l-0 md:pl-0">
          /* The AI-powered learning genie for Algorithms, Data Structures,
          and System Design interviews. Optimized for engineering success. */
        </p>

        {/* Pattern Recognizer */}
        <PatternRecognizer />

        {/* Stats / Social Proof Ticker */}
        <div className="w-full max-w-3xl overflow-hidden border-y-2 border-black bg-white py-2 mb-16">
          <div className="flex animate-marquee whitespace-nowrap gap-12 font-mono text-xs font-bold uppercase tracking-widest">
            <span className="flex items-center gap-2"><Terminal size={12} /> Blind 75 Ready</span>
            <span className="flex items-center gap-2"><Cpu size={12} /> System Design</span>
            <span className="flex items-center gap-2"><Sparkles size={12} /> AI Grading</span>
            <span className="flex items-center gap-2"><Terminal size={12} /> Mock Interviews</span>
            {/* Duplicate for smooth loop */}
            <span className="flex items-center gap-2"><Terminal size={12} /> Blind 75 Ready</span>
            <span className="flex items-center gap-2"><Cpu size={12} /> System Design</span>
            <span className="flex items-center gap-2"><Sparkles size={12} /> AI Grading</span>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl w-full px-4 md:px-0 mb-20">

          <RetroCard
            id="tour-coding"
            title="Coding Algo"
            label="Module 01"
            description="Practice Blind 75 problems with an intelligent editor that grades complexity."
            icon={Code2}
            onClick={() => onNavigate('coding')}
            accentColor="bg-blue-50"
          />

          <RetroCard
            id="tour-system"
            title="System Arch"
            label="Module 02"
            description="Architect distributed systems. Learn scalability patterns and database selection."
            icon={Server}
            onClick={() => onNavigate('system-design')}
            accentColor="bg-purple-50"
          />

          <RetroCard
            id="tour-learning"
            title="Knowledge Base"
            label="Module 03"
            description="Ask the machine to teach you any CS concept. Custom lesson plans on demand."
            icon={BookOpen}
            onClick={() => onNavigate('learning')}
            accentColor="bg-orange-50"
          />

          <RetroCard
            id="tour-interview"
            title="Mock Interview"
            label="Module 04"
            description="Upload your resume and practice with an AI interviewer. Get personalized feedback."
            icon={Mic}
            onClick={() => onNavigate('mock-interview')}
            accentColor="bg-green-50"
          />

        </div>
      </header>

      <footer className="relative z-10 py-8 text-center font-mono text-xs text-gray-400 border-t border-gray-200 mt-auto">
        <p>PREPPBUDDY SYSTEM &copy; {new Date().getFullYear()}</p>
      </footer>

      <style>{`
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;