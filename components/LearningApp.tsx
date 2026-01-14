import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import CodeEditor from 'react-simple-code-editor';
import { logger } from '@/utils/logger';
import Prism from 'prismjs';
import { generateLearningModule, chatWithLearningTutor } from '@/services';
import type { ChatMessage } from '@/types';
import { ArrowLeft, Send, Loader2, BookOpen, MessageCircle, Sparkles, BrainCircuit } from 'lucide-react';

interface LearningAppProps {
  onNavigateHome: () => void;
}

const CodeBlock = ({ inline, className, children, node, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const code = String(children).replace(/\n$/, '');

  // Block Code - Prism Editor
  if (!inline) {
    const language = match ? match[1] : 'python';
    return (
      <div className="my-4 border-2 border-black bg-white shadow-retro-sm overflow-hidden rounded-none">
        <div className="bg-gray-100 border-b-2 border-black px-3 py-1.5 flex justify-between items-center">
          <span className="text-[10px] font-bold font-mono text-gray-600 uppercase flex items-center gap-2">
            {language.toUpperCase()} SOURCE
          </span>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-300 border border-gray-400"></div>
            <div className="w-2 h-2 rounded-full bg-gray-300 border border-gray-400"></div>
          </div>
        </div>
        <div className="bg-white">
          <CodeEditor
            value={code}
            onValueChange={() => { }}
            highlight={code => Prism.highlight(
              code,
              Prism.languages[language] || Prism.languages.javascript,
              language
            )}
            padding={16}
            readOnly
            className="font-mono text-xs lg:text-sm"
            style={{
              fontFamily: '"Fira Code", monospace',
              backgroundColor: 'white',
            }}
            textareaClassName="focus:outline-none"
          />
        </div>
      </div>
    );
  }

  // Inline Code - Red Text
  return (
    <code className="font-mono text-red-600 font-bold bg-gray-100 px-1.5 py-0.5 rounded text-sm border border-gray-200" {...props}>
      {children}
    </code>
  );
};

const LearningApp: React.FC<LearningAppProps> = ({ onNavigateHome }) => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [learningPlan, setLearningPlan] = useState<string | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleInitializeLearning = async () => {
    if (!topic.trim()) return;

    setIsLoading(true);
    setLearningPlan(null);
    setChatHistory([]);

    try {
      const plan = await generateLearningModule(topic);
      setLearningPlan(plan);
    } catch (e) {
      logger.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !topic) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    const newHistory = [...chatHistory, userMsg];

    setChatHistory(newHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await chatWithLearningTutor(newHistory, userMsg.text, topic);
      setChatHistory([...newHistory, { role: 'model', text: response }]);
    } catch {
      setChatHistory([...newHistory, { role: 'model', text: "Error connecting to tutor." }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b-2 border-black px-6 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onNavigateHome}
            className="p-2 border-2 border-transparent hover:border-black hover:bg-gray-100 transition-all"
            title="Back to Home"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 border-l-2 border-black pl-4">
            <div className="bg-orange-500 text-white font-mono font-bold px-1.5 text-sm border border-black">LEARN</div>
            <span className="font-mono font-bold text-lg uppercase tracking-tight">Knowledge Base</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">

        {!learningPlan && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f0f0f0]">
            <div className="max-w-2xl w-full bg-white border-2 border-black shadow-retro p-8 text-center">
              <div className="w-20 h-20 bg-orange-100 border-2 border-black rounded-full flex items-center justify-center mx-auto mb-6">
                <BrainCircuit size={40} className="text-orange-600" />
              </div>
              <h1 className="text-3xl font-black font-mono uppercase mb-4">What knowledge do you seek?</h1>
              <p className="text-gray-600 font-mono text-sm mb-8">
                Enter a Computer Science topic (e.g. "Prefix Sums", "Red-Black Trees", "Dijkstra").
                The system will generate a comprehensive study module.
              </p>

              <div className="relative max-w-lg mx-auto">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInitializeLearning()}
                  placeholder="ENTER_TOPIC..."
                  className="w-full px-4 py-3 bg-white text-black border-2 border-black font-mono text-lg shadow-retro-sm focus:outline-none focus:shadow-retro focus:bg-yellow-50 transition-all uppercase placeholder:normal-case"
                  autoFocus
                />
                <button
                  onClick={handleInitializeLearning}
                  disabled={!topic.trim()}
                  className="absolute right-2 top-2 bottom-2 px-4 bg-black text-white font-mono font-bold text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-black w-12 h-12" />
              <p className="font-mono text-lg font-bold uppercase animate-pulse">Compiling Learning Module...</p>
              <p className="font-mono text-xs text-gray-500">Accessing Neural Archives for "{topic}"</p>
            </div>
          </div>
        )}

        {learningPlan && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

            {/* Left Panel: Lesson Content */}
            <div className="flex-1 overflow-y-auto bg-white p-8 lg:p-12 border-r-2 border-black scrollbar-retro">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-2 mb-6 border-b-2 border-black pb-4">
                  <BookOpen size={24} />
                  <h1 className="text-3xl font-black font-mono uppercase">{topic}</h1>
                </div>
                <div className="prose prose-lg max-w-none font-mono prose-headings:font-bold prose-headings:uppercase prose-p:text-gray-800 prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0">
                  <ReactMarkdown
                    components={{
                      code: CodeBlock,
                      pre: ({ children }) => <>{children}</>
                    }}
                  >
                    {learningPlan}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Right Panel: Chat Tutor */}
            <div className="w-full lg:w-[450px] bg-[#f9f9f9] flex flex-col border-t-2 lg:border-t-0 border-black shadow-[-4px_0px_10px_rgba(0,0,0,0.05)] z-20">
              <div className="bg-black text-white p-3 flex items-center justify-between border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <MessageCircle size={16} />
                  <span className="font-mono font-bold text-sm uppercase">Professor AI</span>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#f0f0f0]">
                {chatHistory.length === 0 && (
                  <div className="text-center mt-10 text-gray-400 font-mono text-xs">
                    <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
                    <p>Have questions about the material?</p>
                    <p>Ask the professor for clarification.</p>
                  </div>
                )}
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[95%] p-4 border-2 border-black shadow-retro-sm text-sm font-mono ${msg.role === 'user' ? 'bg-white text-black' : 'bg-orange-50 text-black'
                      }`}>
                      {msg.role === 'model' ? (
                        <div className="prose prose-sm max-w-none prose-p:mb-2">
                          <ReactMarkdown>
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border-2 border-black p-3 shadow-retro-sm">
                      <Loader2 className="animate-spin w-4 h-4" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t-2 border-black bg-white">
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask a follow-up question..."
                    disabled={chatLoading}
                    className="w-full pl-4 pr-10 py-3 bg-white text-black border-2 border-black font-mono text-sm focus:outline-none focus:bg-yellow-50 shadow-retro-sm disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || chatLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-black hover:text-white transition-colors rounded-none disabled:opacity-50"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LearningApp;