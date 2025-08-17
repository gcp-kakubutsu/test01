/**
 * LINEブラウザ専用のFirebase認証ヘルパー
 */

import { getFirebaseDb, getFirebaseAuth } from './client';
import { signInWithCustomToken } from 'firebase/auth';

/**
 * LINEブラウザでFirebaseが初期化されるまで待機
 */
export async function waitForFirebaseInLine(maxRetries = 20): Promise<boolean> {
  const isLineBrowser = typeof window !== 'undefined' && 
    window.navigator.userAgent.toLowerCase().includes('line');
  
  if (!isLineBrowser) {
    // LINE以外は即座に返す
    return !!getFirebaseDb();
  }

  console.log('[LINE Auth Helper] Waiting for Firebase initialization...');
  
  // まずセッションからユーザー情報を取得して認証
  try {
    const sessionData = await checkLineSession();
    if (sessionData.isAuthenticated && sessionData.userId) {
      console.log('[LINE Auth Helper] Session found, syncing Firebase Auth...');
      await syncFirebaseAuth(sessionData.userId);
    }
  } catch (error) {
    console.error('[LINE Auth Helper] Session sync failed:', error);
  }
  
  for (let i = 0; i < maxRetries; i++) {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    
    if (db && auth) {
      console.log(`[LINE Auth Helper] Firebase initialized after ${i} attempts`);
      
      // 認証状態を再確認
      if (!auth.currentUser) {
        console.log('[LINE Auth Helper] No current user, attempting to restore from session...');
        try {
          const sessionData = await checkLineSession();
          if (sessionData.isAuthenticated && sessionData.userId) {
            await syncFirebaseAuth(sessionData.userId);
          }
        } catch (error) {
          console.error('[LINE Auth Helper] Failed to restore auth:', error);
        }
      }
      
      return true;
    }
    
    // 500ms待機
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.error('[LINE Auth Helper] Firebase initialization timeout');
  return false;
}

/**
 * セッションからFirebase Authを同期
 */
async function syncFirebaseAuth(userId: string): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      console.error('[LINE Auth Helper] Auth not initialized');
      return;
    }
    
    // すでに認証済みならスキップ
    if (auth.currentUser?.uid === userId) {
      console.log('[LINE Auth Helper] Already authenticated with correct user');
      return;
    }
    
    // カスタムトークンを取得
    const tokenResponse = await fetch('/api/auth/custom-token', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      if (tokenData.customToken) {
        await signInWithCustomToken(auth, tokenData.customToken);
        console.log('[LINE Auth Helper] Firebase Auth synced successfully');
      }
    }
  } catch (error) {
    console.error('[LINE Auth Helper] Failed to sync Firebase Auth:', error);
  }
}

/**
 * LINEブラウザでセッションベースの認証状態を確認
 */
export async function checkLineSession(): Promise<{
  isAuthenticated: boolean;
  userId?: string;
  isPremium?: boolean;
}> {
  try {
    // ngrok環境対応のヘッダー
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    
    // ngrok環境の場合、警告ページをスキップ
    if (typeof window !== 'undefined' && 
        (window.location.hostname.includes('ngrok') || 
         window.location.hostname.includes('ngrok-free'))) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    
    const response = await fetch('/api/auth/session-check', {
      method: 'GET',
      credentials: 'include',
      headers,
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        isAuthenticated: !!data.userId,
        userId: data.userId,
        isPremium: data.isPremium,
      };
    }
  } catch (error) {
    console.error('[LINE Auth Helper] Session check failed:', error);
  }
  
  return { isAuthenticated: false };
}