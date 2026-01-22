// Browser feature detection for Mock Interview functionality
// Checks for required Web APIs: MediaDevices (mic), Web Audio, IndexedDB, Web Crypto

export interface BrowserCapabilities {
  mediaDevices: boolean;
  webAudio: boolean;
  indexedDB: boolean;
  webCrypto: boolean;
  allSupported: boolean;
  missingFeatures: string[];
}

/**
 * Checks if the browser supports all required features for mock interviews.
 * Returns detailed information about which features are supported/missing.
 */
export function checkBrowserCapabilities(): BrowserCapabilities {
  const missingFeatures: string[] = [];

  // Check for MediaDevices API (microphone access)
  const mediaDevices = !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
  if (!mediaDevices) {
    missingFeatures.push('Microphone access (MediaDevices API)');
  }

  // Check for Web Audio API
  const webAudio = !!(
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
  if (!webAudio) {
    missingFeatures.push('Audio processing (Web Audio API)');
  }

  // Check for IndexedDB
  const indexedDB = !!(
    window.indexedDB ||
    (window as unknown as { mozIndexedDB?: IDBFactory }).mozIndexedDB ||
    (window as unknown as { webkitIndexedDB?: IDBFactory }).webkitIndexedDB
  );
  if (!indexedDB) {
    missingFeatures.push('Local storage (IndexedDB)');
  }

  // Check for Web Crypto API
  const webCrypto = !!(
    window.crypto &&
    window.crypto.subtle &&
    typeof window.crypto.subtle.encrypt === 'function'
  );
  if (!webCrypto) {
    missingFeatures.push('Encryption (Web Crypto API)');
  }

  return {
    mediaDevices,
    webAudio,
    indexedDB,
    webCrypto,
    allSupported: missingFeatures.length === 0,
    missingFeatures,
  };
}

/**
 * Returns a user-friendly browser recommendation message.
 */
export function getBrowserRecommendation(): string {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('chrome') || ua.includes('chromium')) {
    return 'Please ensure you are using a recent version of Chrome (90+) and that third-party cookies are not blocked.';
  }

  if (ua.includes('firefox')) {
    return 'Please ensure you are using Firefox 90+ with WebRTC enabled.';
  }

  if (ua.includes('safari')) {
    return 'Safari may have limited support. We recommend using Chrome or Firefox for the best experience.';
  }

  if (ua.includes('edge')) {
    return 'Please ensure you are using Microsoft Edge 90+ (Chromium-based).';
  }

  return 'We recommend using a recent version of Chrome, Firefox, or Edge for the best experience.';
}

/**
 * Checks if microphone permissions are currently granted.
 * Returns null if the Permissions API is not supported.
 */
export async function checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | null> {
  try {
    if (!navigator.permissions) {
      return null;
    }
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch {
    // Some browsers don't support querying microphone permission
    return null;
  }
}

/**
 * Requests microphone access and returns whether it was granted.
 */
export async function requestMicrophoneAccess(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop all tracks immediately - we just needed to check permission
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}
