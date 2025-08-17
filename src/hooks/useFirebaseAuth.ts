import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { waitForFirebaseInLine } from '@/lib/firebase/line-auth-helper';
import { onAuthStateChanged, User } from 'firebase/auth';

/**
 * LINEブラウザ対応のFirebase Auth Hook
 * セッションベースの認証とFirebase Authを同期
 */
export function useFirebaseAuth() {
  const { currentUser } = useAuth();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const initFirebaseAuth = async () => {
      try {
        const isLineBrowser = typeof window !== 'undefined' && 
          window.navigator.userAgent.toLowerCase().includes('line');

        if (isLineBrowser) {
          console.log('[useFirebaseAuth] LINE browser detected, waiting for Firebase...');
          const initialized = await waitForFirebaseInLine();
          if (!initialized || !mounted) {
            setLoading(false);
            return;
          }
        }

        const auth = getFirebaseAuth();
        if (!auth) {
          console.error('[useFirebaseAuth] Auth not available');
          setLoading(false);
          return;
        }

        // Firebase Authの状態変更を監視
        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (!mounted) return;
          
          console.log('[useFirebaseAuth] Auth state changed:', {
            firebaseUser: user?.uid,
            contextUser: currentUser?.uid,
            match: user?.uid === currentUser?.uid
          });
          
          setFirebaseUser(user);
          setIsInitialized(true);
          setLoading(false);
        });

      } catch (error) {
        console.error('[useFirebaseAuth] Error initializing:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initFirebaseAuth();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]);

  return {
    firebaseUser,
    isInitialized,
    loading,
    isAuthenticated: !!firebaseUser && firebaseUser.uid === currentUser?.uid
  };
}