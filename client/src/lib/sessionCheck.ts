/**
 * Session verification utility
 * Ensures the session cookie is properly set before making platform API calls
 */

/**
 * Checks if the session cookie exists
 */
export function hasSessionCookie(): boolean {
  // Check if the Manus session cookie exists
  const cookies = document.cookie.split(';');
  return cookies.some(cookie => {
    const [name] = cookie.trim().split('=');
    return name === 'manus-session';
  });
}

/**
 * Waits for the session cookie to be available
 * @param maxWaitMs Maximum time to wait in milliseconds (default: 5000ms)
 * @param checkIntervalMs How often to check in milliseconds (default: 100ms)
 * @returns Promise that resolves when cookie is found or rejects on timeout
 */
export function waitForSession(
  maxWaitMs: number = 5000,
  checkIntervalMs: number = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkCookie = () => {
      if (hasSessionCookie()) {
        resolve();
        return;
      }
      
      if (Date.now() - startTime >= maxWaitMs) {
        reject(new Error('Session cookie not found within timeout period'));
        return;
      }
      
      setTimeout(checkCookie, checkIntervalMs);
    };
    
    checkCookie();
  });
}

/**
 * Ensures session is ready before executing a callback
 * @param callback Function to execute after session is ready
 * @param onError Optional error handler
 */
export async function withSession<T>(
  callback: () => T | Promise<T>,
  onError?: (error: Error) => void
): Promise<T | null> {
  try {
    await waitForSession();
    return await callback();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Session] Error waiting for session:', err);
    if (onError) {
      onError(err);
    }
    return null;
  }
}
