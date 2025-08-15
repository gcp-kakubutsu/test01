/**
 * LINE Browser Authentication Helper
 * Provides fallback authentication methods for LINE browser compatibility
 */

import { signInWithEmailAndPassword, createUserWithEmailAndPassword, type User } from 'firebase/auth';
import { auth } from './client';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

export async function lineCompatibleSignIn(email: string, password: string): Promise<User | null> {
  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }

  let lastError: any = null;
  
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`LINE browser login attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`);
      
      // Add delay between attempts
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
      
      // Try to sign in
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user) {
        console.log('LINE browser login successful');
        
        // Force refresh the token for LINE browser
        try {
          await userCredential.user.getIdToken(true);
          console.log('Token refreshed for LINE browser');
        } catch (tokenError) {
          console.warn('Failed to refresh token:', tokenError);
        }
        
        return userCredential.user;
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`LINE browser login attempt ${attempt} failed:`, error.code);
      
      // If it's a network error, retry
      if (error.code === 'auth/network-request-failed' || 
          error.code === 'auth/internal-error') {
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  // If all attempts failed, throw the last error
  throw lastError || new Error('Login failed after multiple attempts');
}

export async function lineCompatibleSignUp(
  email: string, 
  password: string
): Promise<User | null> {
  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }

  let lastError: any = null;
  
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`LINE browser signup attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`);
      
      // Add delay between attempts
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
      
      // Try to create account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user) {
        console.log('LINE browser signup successful');
        return userCredential.user;
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`LINE browser signup attempt ${attempt} failed:`, error.code);
      
      // If it's a network error, retry
      if (error.code === 'auth/network-request-failed' || 
          error.code === 'auth/internal-error') {
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  // If all attempts failed, throw the last error
  throw lastError || new Error('Signup failed after multiple attempts');
}

/**
 * Check if Firebase Auth is properly initialized for LINE browser
 */
export async function checkLineAuthStatus(): Promise<boolean> {
  if (!auth) {
    console.warn('Auth not initialized');
    return false;
  }
  
  try {
    // Try to get current user
    const user = auth.currentUser;
    if (user) {
      // Try to get a fresh token
      await user.getIdToken();
      return true;
    }
    return false;
  } catch (error) {
    console.warn('LINE auth status check failed:', error);
    return false;
  }
}

/**
 * Initialize LINE browser specific auth settings
 */
export function initializeLineAuth(): void {
  if (typeof window === 'undefined') return;
  
  const ua = window.navigator.userAgent.toLowerCase();
  if (!ua.includes('line')) return;
  
  console.log('Initializing LINE browser auth settings');
  
  // Set LINE browser flag in session storage
  try {
    sessionStorage.setItem('isLineApp', 'true');
  } catch (e) {
    console.warn('Failed to set LINE browser flag:', e);
  }
  
  // Add event listener for auth state changes
  if (auth) {
    auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('LINE browser: User authenticated');
        // Store minimal auth info for LINE browser
        try {
          sessionStorage.setItem('lineAuthUser', JSON.stringify({
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified
          }));
        } catch (e) {
          console.warn('Failed to store LINE auth info:', e);
        }
      } else {
        console.log('LINE browser: User not authenticated');
        try {
          sessionStorage.removeItem('lineAuthUser');
        } catch (e) {
          console.warn('Failed to remove LINE auth info:', e);
        }
      }
    });
  }
}