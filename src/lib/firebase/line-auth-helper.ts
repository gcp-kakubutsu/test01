/**
 * LINEブラウザ専用のFirebase認証ヘルパー
 */

import { getFirebaseDb } from './client';

/**
 * LINEブラウザでFirebaseが初期化されるまで待機
 */
export async function waitForFirebaseInLine(maxRetries = 10): Promise<boolean> {
  const isLineBrowser = typeof window !== 'undefined' && 
    window.navigator.userAgent.toLowerCase().includes('line');
  
  if (!isLineBrowser) {
    // LINE以外は即座に返す
    return !!getFirebaseDb();
  }

  console.log('[LINE Auth Helper] Waiting for Firebase initialization...');
  
  for (let i = 0; i < maxRetries; i++) {
    const db = getFirebaseDb();
    if (db) {
      console.log(`[LINE Auth Helper] Firebase initialized after ${i} attempts`);
      return true;
    }
    
    // 500ms待機
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.error('[LINE Auth Helper] Firebase initialization timeout');
  return false;
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