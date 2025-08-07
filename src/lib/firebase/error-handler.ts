/**
 * Firebase error handler utility
 * Handles common Firebase errors, especially permission errors during logout
 */

export function handleFirebaseError(error: any, context?: string): void {
  // Check if it's a permission error
  if (error?.code === 'permission-denied' || 
      error?.message?.includes('Missing or insufficient permissions')) {
    // Log quietly - this is expected during logout
    console.log(`Permission denied${context ? ` in ${context}` : ''} - likely during logout or auth transition`);
    return;
  }

  // Check for other auth-related errors
  if (error?.code?.startsWith('auth/')) {
    console.log(`Auth error${context ? ` in ${context}` : ''}: ${error.code}`);
    return;
  }

  // Log other errors normally
  console.error(`Firebase error${context ? ` in ${context}` : ''}:`, error);
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
      console.log(`Permission denied${context ? ` in ${context}` : ''} - returning fallback`);
      return fallback;
    }
    // Re-throw non-permission errors
    throw error;
  }
}