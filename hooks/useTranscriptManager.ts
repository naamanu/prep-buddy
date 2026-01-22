import { useCallback, useEffect, useRef, useState } from 'react';
import { type TranscriptMessage } from '@/types/resume';

interface UseTranscriptManagerReturn {
  transcript: TranscriptMessage[];
  showTranscript: boolean;
  unreadMessages: number;
  addToTranscript: (role: 'user' | 'model', content: string) => void;
  toggleTranscript: () => void;
  // Buffer management for streaming transcription
  inputBufferRef: React.MutableRefObject<string>;
  outputBufferRef: React.MutableRefObject<string>;
  flushInputBuffer: () => void;
  flushOutputBuffer: () => void;
  flushAllBuffers: () => void;
}

export function useTranscriptManager(): UseTranscriptManagerReturn {
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const inputBufferRef = useRef<string>('');
  const outputBufferRef = useRef<string>('');
  const showTranscriptRef = useRef(showTranscript);

  // Keep ref in sync with state
  useEffect(() => {
    showTranscriptRef.current = showTranscript;
  }, [showTranscript]);

  // Note: This callback is intentionally memoized with [] deps.
  // It reads showTranscriptRef.current (not showTranscript state) to avoid
  // recreating the callback on every toggle, which would cause downstream re-renders.
  const addToTranscript = useCallback((role: 'user' | 'model', content: string) => {
    const message: TranscriptMessage = {
      role,
      content,
      timestamp: Date.now(),
    };
    setTranscript(prev => [...prev, message]);
    // Only increment unread when transcript is hidden
    if (!showTranscriptRef.current) {
      setUnreadMessages(prev => prev + 1);
    }
  }, []);

  const toggleTranscript = useCallback(() => {
    setShowTranscript(prev => {
      if (!prev) {
        // Opening transcript, clear unread
        setUnreadMessages(0);
      }
      return !prev;
    });
  }, []);

  const flushInputBuffer = useCallback(() => {
    const buffered = inputBufferRef.current.trim();
    if (buffered) {
      addToTranscript('user', buffered);
    }
    inputBufferRef.current = '';
  }, [addToTranscript]);

  const flushOutputBuffer = useCallback(() => {
    const buffered = outputBufferRef.current.trim();
    if (buffered) {
      addToTranscript('model', buffered);
    }
    outputBufferRef.current = '';
  }, [addToTranscript]);

  const flushAllBuffers = useCallback(() => {
    flushInputBuffer();
    flushOutputBuffer();
  }, [flushInputBuffer, flushOutputBuffer]);

  return {
    transcript,
    showTranscript,
    unreadMessages,
    addToTranscript,
    toggleTranscript,
    inputBufferRef,
    outputBufferRef,
    flushInputBuffer,
    flushOutputBuffer,
    flushAllBuffers,
  };
}
