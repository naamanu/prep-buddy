import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, type LiveServerMessage, Modality, type Session } from '@google/genai';
import { base64ToUint8Array, arrayBufferToBase64, float32ToInt16, decodeAudioData } from '@/services/audioUtils';
import { type ResumeData, type PersonaType, type InterviewQuestion, type TranscriptMessage } from '@/types/resume';
import { PERSONAS } from '@/config/personas';
import { GEMINI_LIVE_AUDIO_MODEL } from '@/config/models';
import { logger } from '@/utils/logger';
import TranscriptBubble from './TranscriptBubble';
import MicRecoveryModal from './MicRecoveryModal';
import InterviewWindowHeader from './InterviewWindowHeader';
import QuestionProgressBar from './QuestionProgressBar';
import AudioVisualizerScreen from './AudioVisualizerScreen';
import InterviewControls from './InterviewControls';
import MinimizedInterviewBar from './MinimizedInterviewBar';

interface MockInterviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onEndInterview: (transcript: TranscriptMessage[], wasEarly: boolean) => void;
  resumeData: ResumeData;
  persona: PersonaType;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  onQuestionComplete: () => void;
}

const QUESTION_TIME_LIMIT_MS = 5 * 60 * 1000; // 5 minutes per question

const MockInterviewPanel: React.FC<MockInterviewPanelProps> = ({
  isOpen,
  onClose,
  onEndInterview,
  resumeData,
  persona,
  questions,
  currentQuestionIndex,
  onQuestionComplete,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [questionElapsed, setQuestionElapsed] = useState(0);
  const [showMicRecovery, setShowMicRecovery] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Refs
  const activeRef = useRef(false);
  const sessionRef = useRef<Promise<Session> | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputTranscriptBufferRef = useRef<string>('');
  const outputTranscriptBufferRef = useRef<string>('');

  const currentQuestion = questions[currentQuestionIndex];
  const personaConfig = PERSONAS[persona];

  const handleTimeUp = useCallback(() => {
    // Send a signal to the AI to move on
    if (sessionRef.current) {
      sessionRef.current.then((session) => {
        if (activeRef.current) {
          // Send text instruction to transition
          session.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{ text: '[SYSTEM: The 5-minute limit for this question has been reached. Please gracefully conclude and move to the next question.]' }]
            }]
          });
        }
      }).catch(() => {});
    }
    onQuestionComplete();
  }, [onQuestionComplete]);

  // Question timer
  useEffect(() => {
    if (!isOpen || isPaused || !isConnected) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - questionStartTime;
      setQuestionElapsed(elapsed);

      // Check for 5-minute limit
      if (elapsed >= QUESTION_TIME_LIMIT_MS) {
        // Time's up - move to next question
        handleTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, isConnected, questionStartTime, handleTimeUp]);

  // Reset question timer when question changes
  useEffect(() => {
    setQuestionStartTime(Date.now());
    setQuestionElapsed(0);
  }, [currentQuestionIndex]);

  const addToTranscript = useCallback((role: 'user' | 'model', content: string) => {
    const message: TranscriptMessage = {
      role,
      content,
      timestamp: Date.now(),
    };
    setTranscript(prev => [...prev, message]);
    if (!showTranscript) {
      setUnreadMessages(prev => prev + 1);
    }
  }, [showTranscript]);

  const getSystemInstruction = useCallback(() => {
    const resumeContext = [
      `Name: ${resumeData.name}`,
      resumeData.summary ? `Summary: ${resumeData.summary}` : '',
      resumeData.skills.length > 0 ? `Skills: ${resumeData.skills.join(', ')}` : '',
      resumeData.experience.length > 0
        ? `Experience: ${resumeData.experience.map(e => `${e.title} at ${e.company}`).join('; ')}`
        : '',
      resumeData.projects.length > 0
        ? `Projects: ${resumeData.projects.map(p => p.name).join(', ')}`
        : '',
    ].filter(Boolean).join('\n');

    return `
      You are conducting a mock interview with a candidate.

      Candidate Background:
      ${resumeContext}

      Your Persona: ${persona} - ${personaConfig.title}
      ${personaConfig.systemModifier}

      Current Question (${currentQuestionIndex + 1} of ${questions.length}):
      "${currentQuestion?.content || 'General introduction'}"

      Instructions:
      - Start by asking the current question clearly
      - Listen to the candidate's response
      - Ask follow-up questions based on your persona's follow-up depth (${personaConfig.followUpDepth})
      - If the answer is too brief, encourage elaboration according to your persona style
      - When you're satisfied with the answer, acknowledge it and indicate you're moving to the next topic
      - Be natural and conversational while maintaining your persona
      - Keep responses concise for a flowing conversation

      IMPORTANT - Question Style:
      - Ask ONE focused question at a time. Never combine multiple questions.
      - Avoid compound questions like "Tell me about X and also how did you handle Y?"
      - If you need multiple pieces of information, ask them in separate turns.
    `;
  }, [resumeData, persona, personaConfig, currentQuestionIndex, questions, currentQuestion]);

  useEffect(() => {
    let cancelled = false;

    if (isOpen && !isPaused) {
      startSession().catch(err => {
        if (!cancelled) {
          setError(err.message || 'Failed to start session');
        }
      });
    } else if (!isOpen) {
      stopSession();
    }

    return () => {
      cancelled = true;
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startSession intentionally excluded: it closes over persona/getSystemInstruction which change, but we only want to reconnect on isOpen/isPaused changes
  }, [isOpen, isPaused, stopSession]);

  const startSession = async () => {
    if (activeRef.current) return;

    try {
      setError(null);
      setIsMinimized(false);
      activeRef.current = true;

      // Create contexts and immediately store in refs to ensure cleanup on unmount
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputContextRef.current = outputCtx;

      // Check if component unmounted during context creation
      if (!activeRef.current) {
        inputCtx.close();
        outputCtx.close();
        return;
      }

      // Verify browser honored our sample rate requests
      if (inputCtx.sampleRate !== 16000) {
        logger.warn(`Input AudioContext using ${inputCtx.sampleRate}Hz instead of requested 16000Hz - audio quality may be affected`);
      }
      if (outputCtx.sampleRate !== 24000) {
        logger.warn(`Output AudioContext using ${outputCtx.sampleRate}Hz instead of requested 24000Hz - audio quality may be affected`);
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micError: any) {
        if (micError.name === 'NotAllowedError' || micError.name === 'PermissionDeniedError') {
          setShowMicRecovery(true);
          setIsPaused(true);
          activeRef.current = false;
          inputCtx.close();
          outputCtx.close();
          return;
        }
        // Clean up contexts before re-throwing other errors
        inputCtx.close();
        outputCtx.close();
        throw micError;
      }

      if (!activeRef.current) {
        stream.getTracks().forEach(t => t.stop());
        inputCtx.close();
        outputCtx.close();
        return;
      }

      streamRef.current = stream;
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

      const voiceName = persona === 'friendly' ? 'Kore' : persona === 'challenging' ? 'Fenrir' : 'Puck';

      const sessionPromise = ai.live.connect({
        model: GEMINI_LIVE_AUDIO_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: getSystemInstruction(),
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            if (!activeRef.current) return;
            logger.log('Mock Interview Session Connected');
            setIsConnected(true);
            setQuestionStartTime(Date.now());

            try {
              if (inputCtx.state === 'closed') return;
              const source = inputCtx.createMediaStreamSource(stream);
              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              processor.onaudioprocess = (e) => {
                if (!activeRef.current || !isMicOn) return;
                const inputData = e.inputBuffer.getChannelData(0);
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                setVolumeLevel(Math.sqrt(sum / inputData.length));
                const pcmInt16 = float32ToInt16(inputData);
                const base64Data = arrayBufferToBase64(pcmInt16.buffer);
                sessionPromise.then((session) => {
                  if (activeRef.current) {
                    session.sendRealtimeInput({
                      media: {
                        mimeType: 'audio/pcm;rate=16000',
                        data: base64Data
                      }
                    });
                  }
                });
              };
              source.connect(processor);
              processor.connect(inputCtx.destination);
              sourceRef.current = source;
              processorRef.current = processor;
            } catch (setupError) {
              logger.error("Audio setup failed", setupError);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!activeRef.current) return;

            // Debug: log all message types to diagnose transcription
            if (message.serverContent?.inputTranscription) {
              logger.log('inputTranscription:', message.serverContent.inputTranscription);
            }
            if (message.voiceActivityDetectionSignal) {
              logger.log('VAD signal:', message.voiceActivityDetectionSignal);
            }

            // Handle user speech transcription (inputTranscription)
            const inputTranscript = message.serverContent?.inputTranscription;
            if (inputTranscript?.text) {
              inputTranscriptBufferRef.current += inputTranscript.text;
              // Flush on sentence boundary (punctuation) or when finished flag is set
              if (inputTranscript.finished || inputTranscriptBufferRef.current.match(/[.!?]\s*$/)) {
                const buffered = inputTranscriptBufferRef.current.trim();
                if (buffered) {
                  addToTranscript('user', buffered);
                }
                inputTranscriptBufferRef.current = '';
              }
            }

            // Handle AI speech transcription (outputTranscription)
            const outputTranscript = message.serverContent?.outputTranscription;
            if (outputTranscript?.text) {
              outputTranscriptBufferRef.current += outputTranscript.text;
              // Flush buffer when transcription is marked finished or on sentence boundary
              if (outputTranscript.finished || outputTranscriptBufferRef.current.match(/[.!?]\s*$/)) {
                const buffered = outputTranscriptBufferRef.current.trim();
                if (buffered) {
                  addToTranscript('model', buffered);
                }
                outputTranscriptBufferRef.current = '';
              }
            }

            // Flush any remaining buffers on turn complete
            if (message.serverContent?.turnComplete) {
              const remainingInput = inputTranscriptBufferRef.current.trim();
              if (remainingInput) {
                addToTranscript('user', remainingInput);
                inputTranscriptBufferRef.current = '';
              }
              const remainingOutput = outputTranscriptBufferRef.current.trim();
              if (remainingOutput) {
                addToTranscript('model', remainingOutput);
                outputTranscriptBufferRef.current = '';
              }
            }

            // Handle audio
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setAiSpeaking(true);
              const ctx = outputContextRef.current;
              if (!ctx || ctx.state === 'closed') return;
              try {
                const audioData = base64ToUint8Array(base64Audio);
                const audioBuffer = await decodeAudioData(audioData, ctx, 24000);
                const now = ctx.currentTime;
                const startTime = Math.max(nextStartTimeRef.current, now);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.start(startTime);
                nextStartTimeRef.current = startTime + audioBuffer.duration;
                audioSourcesRef.current.add(source);
                source.onended = () => {
                  audioSourcesRef.current.delete(source);
                  if (audioSourcesRef.current.size === 0) {
                    setAiSpeaking(false);
                  }
                };
              } catch (decodeErr) {
                logger.error("Audio decoding error", decodeErr);
              }
            }

            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { logger.debug('Audio source stop failed:', e); } });
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setAiSpeaking(false);
            }
          },
          onclose: () => {
            if (!activeRef.current) return;
            setIsConnected(false);
          },
          onerror: () => {
            if (!activeRef.current) return;
            setError("Network error. Please check your connection.");
            setIsConnected(false);
          }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err: any) {
      if (!activeRef.current) return;
      setError(err.message || "Connection Failed.");
    }
  };

  const stopSession = useCallback(() => {
    activeRef.current = false;
    if (sessionRef.current) {
      sessionRef.current.then((session) => { try { session.close(); } catch (e) { logger.debug('Session close failed:', e); } }).catch(() => {});
      sessionRef.current = null;
    }
    audioSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { logger.debug('Audio source stop failed:', e); } });
    audioSourcesRef.current.clear();
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch (e) { logger.debug('Processor disconnect failed:', e); } processorRef.current = null; }
    if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch (e) { logger.debug('Source disconnect failed:', e); } sourceRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    if (inputContextRef.current) { try { inputContextRef.current.close(); } catch (e) { logger.debug('Input context close failed:', e); } inputContextRef.current = null; }
    if (outputContextRef.current) { try { outputContextRef.current.close(); } catch (e) { logger.debug('Output context close failed:', e); } outputContextRef.current = null; }
    setIsConnected(false);
    setVolumeLevel(0);
    setAiSpeaking(false);
    nextStartTimeRef.current = 0;
  }, []);

  const handleEndInterview = useCallback(() => {
    stopSession();
    onEndInterview(transcript, true);
    onClose();
  }, [stopSession, transcript, onEndInterview, onClose]);

  const handleMicRetry = useCallback(() => {
    setShowMicRecovery(false);
    setIsPaused(false);
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startSession intentionally excluded: we want to use the latest closure values when retrying
  }, []);

  const handleMicRecoveryEnd = useCallback(() => {
    setShowMicRecovery(false);
    handleEndInterview();
  }, [handleEndInterview]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const timeRemaining = QUESTION_TIME_LIMIT_MS - questionElapsed;
  const isTimeWarning = timeRemaining < 60000; // Less than 1 minute

  if (!isOpen) return null;

  // Mic Recovery Modal
  if (showMicRecovery) {
    return (
      <MicRecoveryModal
        isOpen={true}
        onRetry={handleMicRetry}
        onEndInterview={handleMicRecoveryEnd}
      />
    );
  }

  // MINIMIZED
  if (isMinimized) {
    return (
      <MinimizedInterviewBar
        isConnected={isConnected}
        currentQuestion={currentQuestionIndex + 1}
        totalQuestions={questions.length}
        timeRemaining={timeRemaining}
        isTimeWarning={isTimeWarning}
        formatTime={formatTime}
        onMaximize={() => setIsMinimized(false)}
        transcript={transcript}
        showTranscript={showTranscript}
        onToggleTranscript={() => {
          setShowTranscript(!showTranscript);
          if (!showTranscript) setUnreadMessages(0);
        }}
        unreadMessages={unreadMessages}
      />
    );
  }

  // MAXIMIZED
  const handleRetry = () => {
    stopSession();
    startSession();
  };

  return (
    <>
      <div className="fixed bottom-6 right-24 z-50 flex flex-col w-96 bg-[#f0f0f0] border-2 border-black shadow-retro">
        <InterviewWindowHeader
          title={`Mock Interview - ${personaConfig.title}`}
          onMinimize={() => setIsMinimized(true)}
          onClose={handleEndInterview}
        />
        <QuestionProgressBar
          currentQuestion={currentQuestionIndex + 1}
          totalQuestions={questions.length}
          timeRemaining={timeRemaining}
          isTimeWarning={isTimeWarning}
          formatTime={formatTime}
        />
        <AudioVisualizerScreen
          isConnected={isConnected}
          error={error}
          aiSpeaking={aiSpeaking}
          isMicOn={isMicOn}
          volumeLevel={volumeLevel}
          onRetry={handleRetry}
        />
        <InterviewControls
          isMicOn={isMicOn}
          isConnected={isConnected}
          onToggleMic={() => setIsMicOn(!isMicOn)}
          onEndInterview={handleEndInterview}
        />
      </div>

      <TranscriptBubble
        messages={transcript}
        isOpen={true}
        onToggle={() => {
          setShowTranscript(!showTranscript);
          if (!showTranscript) setUnreadMessages(0);
        }}
        unreadCount={unreadMessages}
      />
    </>
  );
};

export default MockInterviewPanel;
