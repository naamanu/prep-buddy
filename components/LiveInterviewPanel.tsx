import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, type LiveServerMessage, Modality, type Session } from '@google/genai';
import type { Question } from '@/types';
import { base64ToUint8Array, arrayBufferToBase64, float32ToInt16, decodeAudioData } from '@/services/audioUtils';
import { logger } from '@/utils/logger';
import { GEMINI_LIVE_AUDIO_MODEL } from '@/config/models';
import InterviewWindowHeader from './InterviewWindowHeader';
import AudioVisualizerScreen from './AudioVisualizerScreen';
import InterviewControls from './InterviewControls';
import MinimizedInterviewBar from './MinimizedInterviewBar';

interface LiveInterviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question;
  timerDisplay: string;
  mode?: 'coding' | 'system-design';
}

const LiveInterviewPanel: React.FC<LiveInterviewPanelProps> = ({
  isOpen,
  onClose,
  question,
  timerDisplay,
  mode = 'coding'
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

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

  // Stable random values for visualizer bars (lazy init runs once)
  const [aiSpeakingBarHeights] = useState(() =>
    [...Array(5)].map(() => Math.random() * 100)
  );
  const [volumeBarFactors] = useState(() =>
    [...Array(10)].map(() => Math.random())
  );

  const stopSession = useCallback(() => {
    activeRef.current = false;
    if (sessionRef.current) {
      sessionRef.current.then((session) => { try { session.close(); } catch (e) { logger.debug('Session close failed:', e); } }).catch(() => { });
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

  const startSession = useCallback(async () => {
    if (activeRef.current) return;

    try {
      setError(null);
      setIsMinimized(false);
      activeRef.current = true;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!activeRef.current) {
        stream.getTracks().forEach(t => t.stop());
        inputCtx.close();
        outputCtx.close();
        return;
      }

      streamRef.current = stream;
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

      const codingInstruction = `
        You are a professional, slightly strict technical interviewer at a top tech company.
        Problem: "${question.title}".
        Description: ${question.description}
        Solution: ${question.officialSolution}
        Goal: Ask the user to explain their thought process. Be concise.
      `;

      const systemDesignInstruction = `
        You are a Senior System Architect conducting a System Design interview.
        Task: "${question.title}".
        Description: ${question.description}
        Solution: ${question.officialSolution}
        Goal: Drive the conversation on high-level design and tradeoffs. Be professional.
      `;

      const sessionPromise = ai.live.connect({
        model: GEMINI_LIVE_AUDIO_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: mode === 'system-design' ? systemDesignInstruction : codingInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: mode === 'system-design' ? 'Fenrir' : 'Kore' } },
          },
        },
        callbacks: {
          onopen: () => {
            if (!activeRef.current) return;
            logger.log('Gemini Live Session Connected');
            setIsConnected(true);

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
            setError("Network error.");
            setIsConnected(false);
          }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err: any) {
      if (!activeRef.current) return;
      setError(err.message || "Connection Failed.");
    }
  }, [question, isMicOn, mode]);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- connecting to external service on prop change
      startSession();
    } else {
      stopSession();
    }
    return () => stopSession();
  }, [isOpen, startSession, stopSession]);

  if (!isOpen) return null;

  // MINIMIZED
  if (isMinimized) {
    return (
      <MinimizedInterviewBar
        isConnected={isConnected}
        onMaximize={() => setIsMinimized(false)}
        statusLabel="LIVE_SESSION"
        timerDisplay={timerDisplay}
      />
    );
  }

  // MAXIMIZED
  const handleRetry = () => {
    stopSession();
    startSession();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-80 bg-[#f0f0f0] border-2 border-black shadow-retro">
      <InterviewWindowHeader
        title="Voice_Link v1.0"
        onMinimize={() => setIsMinimized(true)}
        onClose={onClose}
      />
      <AudioVisualizerScreen
        isConnected={isConnected}
        error={error}
        aiSpeaking={aiSpeaking}
        isMicOn={isMicOn}
        volumeLevel={volumeLevel}
        onRetry={handleRetry}
        heightClass="h-40"
        connectingText="Est_Connection..."
        speakingText="INCOMING_AUDIO"
        errorPrefix="CONN_ERR: "
        aiSpeakingBarHeights={aiSpeakingBarHeights}
        volumeBarFactors={volumeBarFactors}
        circleSize="lg"
      />
      <InterviewControls
        isMicOn={isMicOn}
        isConnected={isConnected}
        onToggleMic={() => setIsMicOn(!isMicOn)}
        onEndInterview={onClose}
        endButtonText="TERMINATE"
        timerDisplay={timerDisplay}
        buttonGap="lg"
      />
    </div>
  );
};

export default LiveInterviewPanel;
