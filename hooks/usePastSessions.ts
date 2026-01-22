import { useCallback, useRef, useState } from 'react';
import { logger } from '@/utils/logger';
import {
  getAllSessions,
  getSession,
  deleteSession as deleteSessionFromDB,
  type InterviewSessionData,
} from '@/packages/storage/src/indexedDB';

export interface UsePastSessionsReturn {
  pastSessions: InterviewSessionData[];
  viewingSession: InterviewSessionData | null;
  isLoading: boolean;
  error: Error | null;
  loadSessions: () => Promise<void>;
  viewSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  closeViewingSession: () => void;
}

export function usePastSessions(): UsePastSessionsReturn {
  const [pastSessions, setPastSessions] = useState<InterviewSessionData[]>([]);
  const [viewingSession, setViewingSession] = useState<InterviewSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isLoadingRef = useRef(false);

  const loadSessions = useCallback(async () => {
    // Guard against concurrent loads using ref (avoids stale closure)
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const sessions = await getAllSessions();
      setPastSessions(sessions);
    } catch (err) {
      logger.error('Failed to load past sessions:', err);
      setError(err instanceof Error ? err : new Error('Failed to load sessions'));
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const viewSession = useCallback(async (id: string) => {
    try {
      const session = await getSession(id);
      if (session) {
        setViewingSession(session);
      }
    } catch (err) {
      logger.error('Failed to load session:', err);
    }
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await deleteSessionFromDB(id);
      // Reload sessions after deletion
      const sessions = await getAllSessions();
      setPastSessions(sessions);
      // Clear viewing session if it was the deleted one
      setViewingSession(prev => (prev?.id === id ? null : prev));
    } catch (err) {
      logger.error('Failed to delete session:', err);
    }
  }, []);

  const closeViewingSession = useCallback(() => {
    setViewingSession(null);
  }, []);

  return {
    pastSessions,
    viewingSession,
    isLoading,
    error,
    loadSessions,
    viewSession,
    deleteSession,
    closeViewingSession,
  };
}
