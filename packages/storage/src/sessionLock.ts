// Session locking to prevent concurrent interview sessions
// Uses Web Locks API for atomic cross-tab synchronization (with localStorage fallback)

const LOCK_KEY = 'prep-buddy-interview-lock';
const LOCK_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours - stale lock timeout

// Feature detection for Web Locks API
const supportsWebLocks = typeof navigator !== 'undefined' && 'locks' in navigator;

// Track the Web Lock release function so we can release it when needed
let activeLockRelease: (() => void) | null = null;

export interface SessionLock {
  sessionId: string;
  lockedAt: number;
}

/**
 * Attempts to acquire a lock for a session.
 * Returns true if lock acquired, false if blocked by another session.
 * Uses Web Locks API for atomic cross-tab synchronization when available,
 * falling back to localStorage with deterministic conflict resolution.
 */
export async function acquireLock(sessionId: string): Promise<boolean> {
  // Check for stale locks first (applies to both implementations)
  const existing = getLock();
  if (existing && existing.sessionId !== sessionId) {
    if (Date.now() - existing.lockedAt < LOCK_TIMEOUT_MS) {
      return false; // Blocked by active session
    }
    // Stale lock - clear it so we can proceed
    clearLock();
  }

  if (supportsWebLocks) {
    return acquireLockWithWebLocks(sessionId);
  }
  return acquireLockWithLocalStorage(sessionId);
}

/**
 * Acquires lock using the Web Locks API (atomic, no race conditions).
 * The lock is held until explicitly released via releaseLock().
 *
 * Web Locks API behavior notes:
 * - The callback's return value determines how long the lock is held
 * - Returning a Promise holds the lock until that Promise resolves
 * - Returning undefined (or nothing) means "don't hold a lock"
 * - Browser automatically releases locks when the tab/page closes
 */
async function acquireLockWithWebLocks(sessionId: string): Promise<boolean> {
  return new Promise((resolve) => {
    navigator.locks.request(
      LOCK_KEY,
      { ifAvailable: true },
      async (lock) => {
        if (!lock) {
          // Lock unavailable - another tab holds it.
          // Returning undefined tells Web Locks API we're not holding anything.
          // This is correct behavior: no lock was acquired, so nothing to release.
          resolve(false);
          return;
        }

        // We have the lock - store session info in localStorage for UI/recovery purposes
        const lockData: SessionLock = { sessionId, lockedAt: Date.now() };
        localStorage.setItem(LOCK_KEY, JSON.stringify(lockData));

        resolve(true);

        // Hold the lock by returning an unresolved Promise.
        // The Web Locks API keeps the lock until this Promise resolves.
        // We store the resolver so releaseLock() can trigger it.
        return new Promise<void>((releaseResolve) => {
          activeLockRelease = releaseResolve;
        });
      }
    );
  });
}

/**
 * Fallback lock acquisition using localStorage with deterministic conflict resolution.
 * Earlier timestamp wins; sessionId is used as tie-breaker for simultaneous attempts.
 */
async function acquireLockWithLocalStorage(sessionId: string): Promise<boolean> {
  const ourTimestamp = Date.now();
  const ourLock: SessionLock = { sessionId, lockedAt: ourTimestamp };

  // Write our lock
  localStorage.setItem(LOCK_KEY, JSON.stringify(ourLock));

  // Wait for potential competing writes from other tabs
  await new Promise(resolve => setTimeout(resolve, 100));

  // Read current state
  const current = getLock();
  if (!current) return false;

  // If we own it, success
  if (current.sessionId === sessionId) return true;

  // Conflict detected - use deterministic resolution
  // Earlier timestamp wins; lexicographically smaller sessionId as tie-breaker
  const weWin = ourLock.lockedAt < current.lockedAt ||
    (ourLock.lockedAt === current.lockedAt && ourLock.sessionId < current.sessionId);

  if (weWin) {
    // We should win - rewrite our lock and verify
    localStorage.setItem(LOCK_KEY, JSON.stringify(ourLock));
    await new Promise(resolve => setTimeout(resolve, 50));
    const verify = getLock();
    return verify?.sessionId === sessionId;
  }

  return false;
}

/**
 * Releases the lock if it belongs to the given session.
 * For Web Locks API, this resolves the held promise to release the browser lock.
 */
export function releaseLock(sessionId: string): void {
  const existing = getLock();
  if (existing?.sessionId === sessionId) {
    clearLock();

    // Release Web Lock if we're holding one
    if (activeLockRelease) {
      activeLockRelease();
      activeLockRelease = null;
    }
  }
}

/**
 * Gets the current lock if one exists.
 */
export function getLock(): SessionLock | null {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionLock;
  } catch {
    return null;
  }
}

/**
 * Sets the lock.
 */
function setLock(lock: SessionLock): void {
  localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
}

/**
 * Clears the lock.
 */
export function clearLock(): void {
  localStorage.removeItem(LOCK_KEY);
}

/**
 * Checks if there's an active lock blocking a new session.
 */
export function isBlocked(): boolean {
  const existing = getLock();
  if (!existing) return false;

  // Check if lock is stale
  if (Date.now() - existing.lockedAt >= LOCK_TIMEOUT_MS) {
    // Auto-clear stale lock
    clearLock();
    return false;
  }

  return true;
}

/**
 * Gets the ID of the session currently holding the lock.
 * Returns null if no active lock.
 */
export function getBlockingSessionId(): string | null {
  const existing = getLock();
  if (!existing) return null;

  // Check if lock is stale
  if (Date.now() - existing.lockedAt >= LOCK_TIMEOUT_MS) {
    return null;
  }

  return existing.sessionId;
}

/**
 * Force releases any existing lock.
 * Use with caution - should only be used for recovery.
 */
export function forceReleaseLock(): void {
  clearLock();

  // Also release Web Lock if we're holding one
  if (activeLockRelease) {
    activeLockRelease();
    activeLockRelease = null;
  }
}

/**
 * Refreshes the lock timestamp to prevent timeout.
 * Call periodically during long interviews.
 */
export function refreshLock(sessionId: string): boolean {
  const existing = getLock();
  if (existing?.sessionId === sessionId) {
    setLock({ sessionId, lockedAt: Date.now() });
    return true;
  }
  return false;
}

/**
 * Checks if the given session owns the lock.
 */
export function ownsLock(sessionId: string): boolean {
  const existing = getLock();
  return existing?.sessionId === sessionId;
}
