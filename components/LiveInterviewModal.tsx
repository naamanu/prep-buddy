
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Mic, MicOff, Loader2, Radio } from 'lucide-react';
import { GoogleGenAI, type LiveServerMessage, Modality } from '@google/genai';
import type { Question } from '@/types';
import { base64ToUint8Array, arrayBufferToBase64, float32ToInt16, decodeAudioData } from '@/services/audioUtils';
import { logger } from '@/utils/logger';
import { GEMINI_LIVE_AUDIO_MODEL } from '@/config/models';

interface LiveInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    question: Question;
}

const LiveInterviewModal: React.FC<LiveInterviewModalProps> = ({ isOpen, onClose, question }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [volumeLevel, setVolumeLevel] = useState(0); // For visualizer
    const [aiSpeaking, setAiSpeaking] = useState(false);

    // Refs for cleanup
    const sessionRef = useRef<any>(null);
    const inputContextRef = useRef<AudioContext | null>(null);
    const outputContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    // Stable random values for visualizer bars (lazy init runs once)
    const [barRandomFactors] = useState(() =>
        [...Array(5)].map(() => Math.random() + 0.5)
    );

    const stopSession = useCallback(() => {
        // Cleanup Audio Contexts & Stream
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (inputContextRef.current) {
            inputContextRef.current.close();
            inputContextRef.current = null;
        }
        if (outputContextRef.current) {
            outputContextRef.current.close();
            outputContextRef.current = null;
        }

        setIsConnected(false);
        setVolumeLevel(0);
        setAiSpeaking(false);
        nextStartTimeRef.current = 0;
    }, []);

    const startSession = useCallback(async () => {
        try {
            setError(null);

            // 1. Setup Audio Contexts
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            inputContextRef.current = inputCtx;
            outputContextRef.current = outputCtx;

            // 2. Get Microphone Stream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // 3. Initialize Gemini Live
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

            const sessionPromise = ai.live.connect({
                model: GEMINI_LIVE_AUDIO_MODEL,
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: `
            You are a professional, slightly strict technical interviewer at a top tech company (like Google or Meta).
            You are interviewing a candidate on the following coding problem: "${question.title}".
            
            Problem Description:
            ${question.description}
            
            Official Solution Approach (Do not reveal unless asked):
            ${question.officialSolution}
            
            Your Goal:
            1. Ask the user to explain their thought process.
            2. Listen to their approach. If they are silent, prompt them.
            3. If they are going down the wrong path, ask a guiding question about edge cases or complexity.
            4. Keep responses concise and conversational (1-3 sentences max). 
            5. Do not read code blocks aloud verbatim, describe the logic instead.
            
            Start by greeting the candidate and asking them how they plan to solve the problem.
          `,
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                },
                callbacks: {
                    onopen: () => {
                        logger.log('Gemini Live Session Connected');
                        setIsConnected(true);

                        // 4. Setup Audio Input Processing (Stream to Gemini)
                        const source = inputCtx.createMediaStreamSource(stream);
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);

                        processor.onaudioprocess = (e) => {
                            if (!isMicOn) return; // Mute logic

                            const inputData = e.inputBuffer.getChannelData(0);

                            // Simple volume visualizer logic
                            let sum = 0;
                            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                            setVolumeLevel(Math.sqrt(sum / inputData.length));

                            // Convert Float32 to Int16 PCM
                            const pcmInt16 = float32ToInt16(inputData);
                            const base64Data = arrayBufferToBase64(pcmInt16.buffer);

                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({
                                    media: {
                                        mimeType: 'audio/pcm;rate=16000',
                                        data: base64Data
                                    }
                                });
                            });
                        };

                        source.connect(processor);
                        processor.connect(inputCtx.destination);

                        sourceRef.current = source;
                        processorRef.current = processor;
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // 5. Handle Audio Output (Stream from Gemini)
                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;

                        if (base64Audio) {
                            setAiSpeaking(true);
                            const ctx = outputContextRef.current;
                            if (!ctx) return;

                            const audioData = base64ToUint8Array(base64Audio);
                            const audioBuffer = await decodeAudioData(audioData, ctx, 24000);

                            // Scheduling
                            const now = ctx.currentTime;
                            // If next start time is in the past, reset to now
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
                        }

                        if (message.serverContent?.interrupted) {
                            // Clear queue if interrupted
                            audioSourcesRef.current.forEach(s => s.stop());
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                            setAiSpeaking(false);
                        }
                    },
                    onclose: () => {
                        logger.log('Session Closed');
                        setIsConnected(false);
                    },
                    onerror: (err) => {
                        logger.error('Gemini Live Error', err);
                        setError("Connection error. Please try again.");
                    }
                }
            });

            sessionRef.current = sessionPromise;

        } catch (err: any) {
            logger.error("Failed to start interview session:", err);
            setError(err.message || "Failed to access microphone or API.");
        }
    }, [question, isMicOn]);

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-800 overflow-hidden relative">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <h3 className="text-gray-100 font-semibold">Live Interview</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* Visualizer Area */}
                <div className="h-64 flex flex-col items-center justify-center relative bg-gradient-to-b from-gray-900 to-gray-950">
                    {!isConnected && !error && (
                        <div className="flex flex-col items-center text-gray-400 gap-3">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                            <p className="text-sm">Connecting to interviewer...</p>
                        </div>
                    )}

                    {error && (
                        <div className="text-red-400 text-center px-6 text-sm w-full">
                            <p className="mb-2 break-all">⚠️ {error}</p>
                            <button onClick={startSession} className="px-4 py-2 bg-gray-800 rounded text-white hover:bg-gray-700 mt-2">Retry</button>
                        </div>
                    )}

                    {isConnected && (
                        <>
                            {/* AI Pulse */}
                            <div className={`absolute transition-all duration-300 ${aiSpeaking ? 'opacity-100 scale-100' : 'opacity-30 scale-75'}`}>
                                <div className="w-32 h-32 rounded-full bg-blue-500/20 animate-pulse flex items-center justify-center">
                                    <div className="w-24 h-24 rounded-full bg-blue-500/30 animate-ping absolute"></div>
                                    <div className="w-20 h-20 rounded-full bg-blue-600 shadow-lg shadow-blue-500/50 flex items-center justify-center">
                                        <Radio size={40} className="text-white" />
                                    </div>
                                </div>
                            </div>

                            {/* Status Text */}
                            <div className="absolute bottom-8 text-center">
                                <p className="text-gray-400 text-sm font-medium">
                                    {aiSpeaking ? "Interviewer is speaking..." : "Listening to you..."}
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Controls */}
                <div className="p-6 bg-gray-900 border-t border-gray-800">
                    <div className="flex items-center justify-center gap-6">
                        <button
                            onClick={() => setIsMicOn(!isMicOn)}
                            className={`p-4 rounded-full transition-all duration-200 ${isMicOn
                                    ? 'bg-white text-black hover:scale-105 shadow-lg shadow-white/10'
                                    : 'bg-gray-800 text-red-500 border border-gray-700'
                                }`}
                        >
                            {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                        </button>

                        <button
                            onClick={onClose}
                            className="px-6 py-3 bg-red-500/10 text-red-400 font-semibold rounded-full hover:bg-red-500 hover:text-white transition-colors border border-red-500/20 text-sm"
                        >
                            End Interview
                        </button>
                    </div>

                    {/* Simple Input Visualizer Bar */}
                    {isConnected && isMicOn && (
                        <div className="mt-6 flex justify-center gap-1 h-4 items-end">
                            {barRandomFactors.map((factor, i) => (
                                <div
                                    key={i}
                                    className="w-1 bg-green-500 rounded-full transition-all duration-75"
                                    style={{
                                        height: `${Math.max(4, Math.min(100, volumeLevel * 100 * factor))}%`,
                                        opacity: volumeLevel > 0.01 ? 1 : 0.3
                                    }}
                                ></div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveInterviewModal;
