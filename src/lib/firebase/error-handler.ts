/**
 * Firebase error handler utility
 * Handles common Firebase errors, especially permission errors during logout
 */

export function handleFirebaseError(error: any, context?: string): void {
  // Check if it's a permission error
  if (error?.code === 'permission-denied' || 
      error?.message?.includes('Missing or insufficient permissions')) {
    // Completely silent - this is expected during logout or auth transition
    return;
  }

  // Check for other auth-related errors
  if (error?.code?.startsWith('auth/')) {
    // Silent for auth errors too
    return;
  }

  // Silent handling for other errors - don't log to console
  // Errors are handled by the calling code
}

/**
 * Check if an error is a permission error
 */
export function isPermissionError(error: any): boolean {
  return error?.code === 'permission-denied' || 
         error?.message?.includes('Missing or insufficient permissions');
}

/**
 * Safe Firestore operation wrapper
 * Wraps Firestore operations to handle permission errors gracefully
 */
export async function safeFirestoreOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isPermissionError(error)) {
      // Silently return fallback for permission errors
      return fallback;
    }
    // Re-throw non-permission errors
    throw error;
  }
}