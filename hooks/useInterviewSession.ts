import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleGenAI, type LiveServerMessage, Modality, type Session } from '@google/genai';
import { base64ToUint8Array, arrayBufferToBase64, float32ToInt16, decodeAudioData } from '@/services/audioUtils';
import { GEMINI_LIVE_AUDIO_MODEL } from '@/config/models';
import { logger } from '@/utils/logger';

// Type declaration for Safari's prefixed AudioContext
type WebkitAudioContext = typeof AudioContext;
interface WebkitWindow extends Window {
  webkitAudioContext?: WebkitAudioContext;
}
const AudioContextClass = window.AudioContext || (window as WebkitWindow).webkitAudioContext;

interface AudioContextPair {
  inputCtx: AudioContext;
  outputCtx: AudioContext;
}

/**
 * Creates and validates audio contexts for input (16kHz) and output (24kHz).
 * Logs warnings if the browser doesn't support the requested sample rates.
 */
function createAudioContexts(): AudioContextPair {
  const inputCtx = new AudioContextClass({ sampleRate: 16000 });
  const outputCtx = new AudioContextClass({ sampleRate: 24000 });

  if (inputCtx.sampleRate !== 16000) {
    logger.warn(`Input AudioContext using ${inputCtx.sampleRate}Hz instead of requested 16000Hz`);
  }
  if (outputCtx.sampleRate !== 24000) {
    logger.warn(`Output AudioContext using ${outputCtx.sampleRate}Hz instead of requested 24000Hz`);
  }

  return { inputCtx, outputCtx };
}

interface TranscriptionCallbacks {
  onInputTranscript: (text: string, finished: boolean) => void;
  onOutputTranscript: (text: string, finished: boolean) => void;
  onTurnComplete: () => void;
  /** Flush pending user input to transcript (called before AI output to preserve order) */
  flushInputBuffer?: () => void;
}

interface UseInterviewSessionOptions {
  isOpen: boolean;
  isPaused: boolean;
  isMicOn: boolean;
  systemInstruction: string;
  voiceName: string;
  transcription: TranscriptionCallbacks;
  onConnected: () => void;
  onMicBlocked: () => void;
}

interface UseInterviewSessionReturn {
  isConnected: boolean;
  error: string | null;
  aiSpeaking: boolean;
  volumeLevel: number;
  showMicRecovery: boolean;
  setShowMicRecovery: (show: boolean) => void;
  startSession: () => Promise<void>;
  stopSession: () => void;
  sendTimeUpSignal: () => void;
  sendInterviewCompleteSignal: () => void;
  sendWrapUpWarning: () => void;
  sendQuestionContext: (questionText: string) => void;
}

export function useInterviewSession({
  isOpen,
  isPaused,
  isMicOn,
  systemInstruction,
  voiceName,
  transcription,
  onConnected,
  onMicBlocked,
}: UseInterviewSessionOptions): UseInterviewSessionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [showMicRecovery, setShowMicRecovery] = useState(false);

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
  const sessionClosingRef = useRef(false);

  // Stable ref for transcription callbacks to prevent reconnection loops
  // The ref is updated via effect, allowing startSession to have stable dependencies
  const transcriptionRef = useRef(transcription);
  useEffect(() => {
    transcriptionRef.current = transcription;
  }, [transcription]);

  // Stable ref for isMicOn to prevent stale closure in audio processor callback
  // The onaudioprocess callback is created once and never recreated, so it would
  // capture the initial isMicOn value without this ref pattern
  const isMicOnRef = useRef(isMicOn);
  useEffect(() => {
    isMicOnRef.current = isMicOn;
  }, [isMicOn]);

  const stopSession = useCallback(() => {
    sessionClosingRef.current = true;
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

  const startSession = useCallback(async () => {
    if (activeRef.current) return;

    try {
      setError(null);
      activeRef.current = true;
      sessionClosingRef.current = false;

      // Create audio contexts
      const { inputCtx, outputCtx } = createAudioContexts();
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      if (!activeRef.current) {
        inputCtx.close();
        outputCtx.close();
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micError: any) {
        if (micError.name === 'NotAllowedError' || micError.name === 'PermissionDeniedError') {
          setShowMicRecovery(true);
          activeRef.current = false;
          inputCtx.close();
          outputCtx.close();
          onMicBlocked();
          return;
        }
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

      const sessionPromise = ai.live.connect({
        model: GEMINI_LIVE_AUDIO_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
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
            onConnected();

            try {
              if (inputCtx.state === 'closed') return;
              const source = inputCtx.createMediaStreamSource(stream);
              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              processor.onaudioprocess = (e) => {
                if (!activeRef.current || !isMicOnRef.current || sessionClosingRef.current) return;
                const inputData = e.inputBuffer.getChannelData(0);
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                setVolumeLevel(Math.sqrt(sum / inputData.length));
                const pcmInt16 = float32ToInt16(inputData);
                const base64Data = arrayBufferToBase64(pcmInt16.buffer);
                sessionPromise.then((session) => {
                  // Re-check state before sending - session may have closed since callback was queued
                  if (!activeRef.current || sessionClosingRef.current) return;
                  try {
                    session.sendRealtimeInput({
                      media: {
                        mimeType: 'audio/pcm;rate=16000',
                        data: base64Data
                      }
                    });
                  } catch (sendError) {
                    // Gracefully handle send failures during session shutdown
                    // This can occur if WebSocket closes between our guard check and the actual send
                    // (race condition with stopSession)
                    if (activeRef.current && !sessionClosingRef.current) {
                      logger.debug('Audio send failed:', sendError);
                    }
                  }
                }).catch((err) => {
                  // Handle promise rejection (session failed to connect)
                  if (activeRef.current && !sessionClosingRef.current) {
                    logger.error('Failed to send audio input:', err);
                    // Stop the processor to prevent accumulating unsendable audio data
                    if (processorRef.current) {
                      try {
                        processorRef.current.disconnect();
                      } catch (e) {
                        logger.debug('Processor disconnect failed:', e);
                      }
                      processorRef.current = null;
                    }
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

            if (message.serverContent?.inputTranscription) {
              logger.debug('inputTranscription:', message.serverContent.inputTranscription);
            }
            if (message.voiceActivityDetectionSignal) {
              logger.debug('VAD signal:', message.voiceActivityDetectionSignal);
            }

            // Handle user speech transcription
            const inputTranscript = message.serverContent?.inputTranscription;
            if (inputTranscript?.text) {
              transcriptionRef.current.onInputTranscript(
                inputTranscript.text,
                inputTranscript.finished || false
              );
            }

            // Handle AI speech transcription
            // Important: Flush user input buffer FIRST when AI starts speaking.
            // This prevents the race condition where user transcript appears AFTER
            // AI transcript due to delayed inputTranscription finalization.
            const outputTranscript = message.serverContent?.outputTranscription;
            if (outputTranscript?.text) {
              // Flush any pending user input before AI output appears
              transcriptionRef.current.flushInputBuffer?.();
              transcriptionRef.current.onOutputTranscript(
                outputTranscript.text,
                outputTranscript.finished || false
              );
            }

            // Flush buffers on turn complete
            if (message.serverContent?.turnComplete) {
              transcriptionRef.current.onTurnComplete();
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
            // Mark session as closing to stop audio processor from sending
            sessionClosingRef.current = true;
            setIsConnected(false);

            // Clean up audio processor to prevent flood of send attempts
            if (processorRef.current) {
              try { processorRef.current.disconnect(); } catch (e) { logger.debug('Processor disconnect failed:', e); }
              processorRef.current = null;
            }
            if (sourceRef.current) {
              try { sourceRef.current.disconnect(); } catch (e) { logger.debug('Source disconnect failed:', e); }
              sourceRef.current = null;
            }

            // Only show error if this wasn't a user-initiated close
            if (activeRef.current) {
              setError("Connection lost. The session may have timed out.");
            }
          },
          onerror: () => {
            if (!activeRef.current) return;
            sessionClosingRef.current = true;
            setIsConnected(false);

            // Clean up audio processor
            if (processorRef.current) {
              try { processorRef.current.disconnect(); } catch (e) { logger.debug('Processor disconnect failed:', e); }
              processorRef.current = null;
            }
            if (sourceRef.current) {
              try { sourceRef.current.disconnect(); } catch (e) { logger.debug('Source disconnect failed:', e); }
              sourceRef.current = null;
            }

            setError("Network error. Please check your connection.");
          }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err: any) {
      if (!activeRef.current) return;
      setError(err.message || "Connection Failed.");
    }
  // Note: transcription and isMicOn are intentionally omitted from deps and accessed via refs
  // to prevent reconnection loops when these values change during a session
  }, [systemInstruction, voiceName, onConnected, onMicBlocked]);

  const sendTimeUpSignal = useCallback(() => {
    if (sessionRef.current && !sessionClosingRef.current) {
      sessionRef.current.then((session) => {
        if (!activeRef.current || sessionClosingRef.current) return;
        try {
          session.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{ text: '[TIME_UP] The time limit for this question has been reached. Please gracefully wrap up your current thought.' }]
            }]
          });
        } catch (e) {
          // Ignore send errors during session shutdown
          logger.debug('TIME_UP signal send failed (session closing):', e);
        }
      }).catch(() => {});
    }
  }, []);

  const sendInterviewCompleteSignal = useCallback(() => {
    if (sessionRef.current && !sessionClosingRef.current) {
      sessionRef.current.then((session) => {
        if (!activeRef.current || sessionClosingRef.current) return;
        try {
          session.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{ text: '[INTERVIEW_COMPLETE] This was the final question and we are approaching the end of our time. Allow the candidate to finish their current thought if they are still speaking. Once they finish, acknowledge their response briefly, then thank them warmly and clearly announce that the interview has concluded. Let them know they can end the session when ready.' }]
            }]
          });
        } catch (e) {
          logger.debug('INTERVIEW_COMPLETE signal send failed:', e);
        }
      }).catch(() => {});
    }
  }, []);

  const sendWrapUpWarning = useCallback(() => {
    if (sessionRef.current && !sessionClosingRef.current) {
      sessionRef.current.then((session) => {
        if (!activeRef.current || sessionClosingRef.current) return;
        try {
          session.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{ text: '[WRAP_UP_WARNING] This is the final question and you have about 30 seconds remaining. After the candidate finishes their current response, please begin wrapping up the interview naturally.' }]
            }]
          });
        } catch (e) {
          logger.debug('WRAP_UP_WARNING signal send failed:', e);
        }
      }).catch(() => {});
    }
  }, []);

  const sendQuestionContext = useCallback((questionText: string) => {
    if (sessionRef.current && !sessionClosingRef.current) {
      sessionRef.current.then((session) => {
        if (!activeRef.current || sessionClosingRef.current) return;
        try {
          session.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{ text: questionText }]
            }]
          });
        } catch (e) {
          // Ignore send errors during session shutdown
          logger.debug('Question context send failed (session closing):', e);
        }
      }).catch(() => {});
    }
  }, []);

  // Lifecycle effect
  // Note: startSession depends on systemInstruction and voiceName, so changing the persona
  // mid-interview will intentionally trigger a full reconnection with the new configuration.
  // This is the expected behavior since the AI needs the updated system prompt.
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
  }, [isOpen, isPaused, stopSession, startSession]);

  return {
    isConnected,
    error,
    aiSpeaking,
    volumeLevel,
    showMicRecovery,
    setShowMicRecovery,
    startSession,
    stopSession,
    sendTimeUpSignal,
    sendInterviewCompleteSignal,
    sendWrapUpWarning,
    sendQuestionContext,
  };
}
