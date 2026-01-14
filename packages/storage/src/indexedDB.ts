// IndexedDB operations for interview session and resume storage
// Stores data as plain JSON (no encryption)

import { type ResumeData } from '@/types/resume';

const DB_NAME = 'PrepBuddyInterviews';
const DB_VERSION = 3; // v3: Added separate resumes store
const SESSIONS_STORE = 'sessions';
const RESUMES_STORE = 'resumes';

export interface StoredSession {
  id: string;
  data: InterviewSessionData;
  createdAt: number;
  status: 'in-progress' | 'completed' | 'incomplete';
}

export interface StoredResume {
  id: string;
  data: ResumeData;
  createdAt: number;
  lastUsed: number;
}

export interface InterviewSessionData {
  id: string;
  resumeData: unknown;
  questions: unknown[];
  currentQuestionIndex: number;
  transcript: unknown[];
  persona: string;
  duration: number;
  status: 'in-progress' | 'completed' | 'incomplete';
  startedAt: number;
  endedAt?: number;
  feedback?: unknown;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Opens or creates the IndexedDB database.
 */
async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  // Clean up old encryption key from localStorage (migration cleanup)
  localStorage.removeItem('pb_interview_key');

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle connection closing
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction!;

      // Delete old store if upgrading from v1 (encrypted data is no longer readable)
      if (event.oldVersion < 2 && db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.deleteObjectStore(SESSIONS_STORE);
      }

      // Create sessions object store
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const store = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // v3: Create resumes object store
      if (!db.objectStoreNames.contains(RESUMES_STORE)) {
        const resumeStore = db.createObjectStore(RESUMES_STORE, { keyPath: 'id' });
        resumeStore.createIndex('createdAt', 'createdAt', { unique: false });
        resumeStore.createIndex('lastUsed', 'lastUsed', { unique: false });

        // Migrate existing resumes from sessions (v2 -> v3)
        if (event.oldVersion >= 2 && db.objectStoreNames.contains(SESSIONS_STORE)) {
          const sessionsStore = transaction.objectStore(SESSIONS_STORE);
          const resumeMap = new Map<string, StoredResume>();

          sessionsStore.openCursor().onsuccess = (cursorEvent) => {
            const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              const session = cursor.value as StoredSession;
              const resumeData = session.data.resumeData as ResumeData;
              if (resumeData && resumeData.name) {
                const resumeId = generateResumeId(resumeData);
                const existing = resumeMap.get(resumeId);

                // Keep the most recently used version
                if (!existing || session.createdAt > existing.lastUsed) {
                  resumeMap.set(resumeId, {
                    id: resumeId,
                    data: resumeData,
                    createdAt: existing?.createdAt ?? session.createdAt,
                    lastUsed: session.createdAt,
                  });
                }
              }
              cursor.continue();
            } else {
              // All sessions processed, save unique resumes
              resumeMap.forEach((storedResume) => {
                resumeStore.put(storedResume);
              });
            }
          };
        }
      }
    };
  });
}

/**
 * Saves an interview session.
 */
export async function saveSession(session: InterviewSessionData): Promise<void> {
  const db = await openDatabase();

  const storedSession: StoredSession = {
    id: session.id,
    data: session,
    createdAt: session.startedAt,
    status: session.status,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);

    const request = store.put(storedSession);

    request.onerror = () => {
      reject(new Error(`Failed to save session: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Retrieves a session by ID.
 */
export async function getSession(id: string): Promise<InterviewSessionData | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);

    const request = store.get(id);

    request.onerror = () => {
      reject(new Error(`Failed to get session: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const storedSession = request.result as StoredSession | undefined;

      if (!storedSession) {
        resolve(null);
        return;
      }

      resolve(storedSession.data);
    };
  });
}

/**
 * Gets all sessions with basic metadata.
 */
export async function getAllSessionMetadata(): Promise<
  Array<{ id: string; createdAt: number; status: string }>
> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);
    const index = store.index('createdAt');

    const request = index.openCursor(null, 'prev'); // Newest first
    const results: Array<{ id: string; createdAt: number; status: string }> = [];

    request.onerror = () => {
      reject(new Error(`Failed to get sessions: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const session = cursor.value as StoredSession;
        results.push({
          id: session.id,
          createdAt: session.createdAt,
          status: session.status,
        });
        cursor.continue();
      } else {
        resolve(results);
      }
    };
  });
}

/**
 * Gets all sessions.
 */
export async function getAllSessions(): Promise<InterviewSessionData[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);
    const index = store.index('createdAt');

    const request = index.openCursor(null, 'prev'); // Newest first
    const sessions: InterviewSessionData[] = [];

    request.onerror = () => {
      reject(new Error(`Failed to get sessions: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const stored = cursor.value as StoredSession;
        sessions.push(stored.data);
        cursor.continue();
      } else {
        resolve(sessions);
      }
    };
  });
}

/**
 * Deletes a session by ID.
 */
export async function deleteSession(id: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);

    const request = store.delete(id);

    request.onerror = () => {
      reject(new Error(`Failed to delete session: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Updates the status of a session.
 */
export async function updateSessionStatus(
  id: string,
  status: 'in-progress' | 'completed' | 'incomplete'
): Promise<void> {
  const session = await getSession(id);
  if (!session) {
    throw new Error(`Session ${id} not found`);
  }

  session.status = status;
  await saveSession(session);
}

/**
 * Gets sessions with a specific status.
 */
export async function getSessionsByStatus(
  status: 'in-progress' | 'completed' | 'incomplete'
): Promise<InterviewSessionData[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);
    const index = store.index('status');

    const request = index.getAll(status);

    request.onerror = () => {
      reject(new Error(`Failed to get sessions: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const storedSessions = request.result as StoredSession[];
      const sessions = storedSessions.map((stored) => stored.data);
      resolve(sessions);
    };
  });
}

/**
 * Clears all sessions from the database.
 */
export async function clearAllSessions(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);

    const request = store.clear();

    request.onerror = () => {
      reject(new Error(`Failed to clear sessions: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Gets the count of sessions.
 */
export async function getSessionCount(): Promise<number> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);

    const request = store.count();

    request.onerror = () => {
      reject(new Error(`Failed to count sessions: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

// ============================================================================
// Resume Storage Operations
// ============================================================================

/**
 * Generates a deterministic ID for a resume based on name and skills.
 * This ensures the same resume data always maps to the same ID.
 */
export function generateResumeId(resume: ResumeData): string {
  const normalized = `${resume.name.toLowerCase().trim()}|${resume.skills.slice().sort().join(',').toLowerCase()}`;
  // Simple hash function for deterministic ID
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash | 0; // Convert to 32-bit integer
  }
  return `resume_${Math.abs(hash).toString(36)}`;
}

/**
 * Saves a resume to the store. Updates if already exists (by generated ID).
 * Returns the resume ID.
 */
export async function saveResume(resume: ResumeData): Promise<string> {
  const db = await openDatabase();
  const id = generateResumeId(resume);
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RESUMES_STORE, 'readwrite');
    const store = transaction.objectStore(RESUMES_STORE);

    // Check if resume already exists
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const existing = getRequest.result as StoredResume | undefined;

      const storedResume: StoredResume = {
        id,
        data: resume,
        createdAt: existing?.createdAt ?? now,
        lastUsed: now,
      };

      const putRequest = store.put(storedResume);

      putRequest.onerror = () => {
        reject(new Error(`Failed to save resume: ${putRequest.error?.message}`));
      };

      putRequest.onsuccess = () => {
        resolve(id);
      };
    };

    getRequest.onerror = () => {
      reject(new Error(`Failed to check existing resume: ${getRequest.error?.message}`));
    };
  });
}

/**
 * Retrieves a resume by ID.
 */
export async function getResume(id: string): Promise<ResumeData | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RESUMES_STORE, 'readonly');
    const store = transaction.objectStore(RESUMES_STORE);

    const request = store.get(id);

    request.onerror = () => {
      reject(new Error(`Failed to get resume: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const stored = request.result as StoredResume | undefined;
      resolve(stored?.data ?? null);
    };
  });
}

/**
 * Gets all saved resumes, sorted by most recently used.
 */
export async function getAllResumes(): Promise<StoredResume[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RESUMES_STORE, 'readonly');
    const store = transaction.objectStore(RESUMES_STORE);
    const index = store.index('lastUsed');

    const request = index.openCursor(null, 'prev'); // Most recently used first
    const resumes: StoredResume[] = [];

    request.onerror = () => {
      reject(new Error(`Failed to get resumes: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        resumes.push(cursor.value as StoredResume);
        cursor.continue();
      } else {
        resolve(resumes);
      }
    };
  });
}

/**
 * Deletes a resume by ID.
 */
export async function deleteResume(id: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RESUMES_STORE, 'readwrite');
    const store = transaction.objectStore(RESUMES_STORE);

    const request = store.delete(id);

    request.onerror = () => {
      reject(new Error(`Failed to delete resume: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Updates the lastUsed timestamp for a resume.
 */
export async function touchResume(id: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RESUMES_STORE, 'readwrite');
    const store = transaction.objectStore(RESUMES_STORE);

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const stored = getRequest.result as StoredResume | undefined;
      if (!stored) {
        resolve(); // Resume doesn't exist, nothing to update
        return;
      }

      stored.lastUsed = Date.now();
      const putRequest = store.put(stored);

      putRequest.onerror = () => {
        reject(new Error(`Failed to update resume: ${putRequest.error?.message}`));
      };

      putRequest.onsuccess = () => {
        resolve();
      };
    };

    getRequest.onerror = () => {
      reject(new Error(`Failed to get resume: ${getRequest.error?.message}`));
    };
  });
}
