/**
 * ブラウザ検出ユーティリティ
 */

/**
 * LINEブラウザかどうかを検出
 */
export function isLineBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  return userAgent.includes('line');
}

/**
 * インアップブラウザ（WebView）かどうかを検出
 */
export function isInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  // 各種インアップブラウザの検出
  const inAppBrowsers = [
    'line',           // LINE
    'fbav',          // Facebook
    'fban',          // Facebook
    'instagram',     // Instagram
    'twitter',       // Twitter
    'wv',           // Android WebView
    'micromessenger' // WeChat
  ];
  
  return inAppBrowsers.some(browser => userAgent.includes(browser));
}

/**
 * IndexedDBが利用可能かチェック
 */
export function isIndexedDBAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // IndexedDBの基本的な可用性をチェック
    if (!window.indexedDB) return false;
    
    // LINEブラウザの場合はIndexedDBが問題を起こすことが多いのでfalseを返す
    if (isLineBrowser()) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * localStorageが利用可能かチェック
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const testKey = '__test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Firebase SDKを安全に使用できるかチェック
 */
export function canUseFirebaseSDK(): boolean {
  // LINEブラウザではFirebase SDKの機能が制限される
  if (isLineBrowser()) {
    return false;
  }
  
  // その他のインアップブラウザでも問題が起きる可能性がある
  if (isInAppBrowser()) {
    // localStorageが使えればOK
    return isLocalStorageAvailable();
  }
  
  return true;
}

/**
 * 推奨ブラウザかどうかをチェック
 */
export function isRecommendedBrowser(): boolean {
  if (typeof window === 'undefined') return true;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  // 推奨ブラウザ
  const recommendedBrowsers = [
    'chrome',
    'safari',
    'firefox',
    'edge'
  ];
  
  // インアップブラウザでない、かつ推奨ブラウザのいずれか
  return !isInAppBrowser() && recommendedBrowsers.some(browser => userAgent.includes(browser));
}

/**
 * ブラウザ情報を取得
 */
export function getBrowserInfo() {
  if (typeof window === 'undefined') {
    return {
      isLine: false,
      isInApp: false,
      canUseFirebase: true,
      hasIndexedDB: true,
      hasLocalStorage: true,
      isRecommended: true,
      userAgent: ''
    };
  }
  
  return {
    isLine: isLineBrowser(),
    isInApp: isInAppBrowser(),
    canUseFirebase: canUseFirebaseSDK(),
    hasIndexedDB: isIndexedDBAvailable(),
    hasLocalStorage: isLocalStorageAvailable(),
    isRecommended: isRecommendedBrowser(),
    userAgent: window.navigator.userAgent
  };
}