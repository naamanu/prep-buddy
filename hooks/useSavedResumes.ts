import { useCallback, useRef, useState } from 'react';
import { logger } from '@/utils/logger';
import {
  getAllResumes,
  deleteResume as deleteResumeFromDB,
  type StoredResume,
} from '@/packages/storage/src/indexedDB';

export interface UseSavedResumesReturn {
  savedResumes: StoredResume[];
  isLoading: boolean;
  error: Error | null;
  loadResumes: () => Promise<void>;
  deleteResume: (id: string) => Promise<void>;
}

export function useSavedResumes(): UseSavedResumesReturn {
  const [savedResumes, setSavedResumes] = useState<StoredResume[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isLoadingRef = useRef(false);

  const loadResumes = useCallback(async () => {
    // Guard against concurrent loads using ref (avoids stale closure)
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const resumes = await getAllResumes();
      setSavedResumes(resumes);
    } catch (err) {
      logger.error('Failed to load saved resumes:', err);
      setError(err instanceof Error ? err : new Error('Failed to load resumes'));
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const deleteResume = useCallback(async (id: string) => {
    try {
      await deleteResumeFromDB(id);
      // Reload resumes after deletion
      const resumes = await getAllResumes();
      setSavedResumes(resumes);
    } catch (err) {
      logger.error('Failed to delete resume:', err);
    }
  }, []);

  return {
    savedResumes,
    isLoading,
    error,
    loadResumes,
    deleteResume,
  };
}
