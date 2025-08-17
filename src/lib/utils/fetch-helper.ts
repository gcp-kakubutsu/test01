/**
 * ngrokやプロキシ環境でのfetchを助けるユーティリティ
 */

/**
 * ngrok警告ページをスキップするためのヘッダーを取得
 */
export function getNgrokHeaders(): HeadersInit {
  // ngrok環境の場合、警告ページをスキップするヘッダーを追加
  const isNgrok = typeof window !== 'undefined' && 
    (window.location.hostname.includes('ngrok') || 
     window.location.hostname.includes('ngrok-free'));
  
  if (isNgrok) {
    return {
      'ngrok-skip-browser-warning': 'true',
    };
  }
  
  return {};
}

/**
 * APIエンドポイントへのfetchを行う
 * ngrok環境での警告ページスキップに対応
 */
export async function fetchAPI(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const ngrokHeaders = getNgrokHeaders();
  
  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...ngrokHeaders,
      ...(options.headers || {}),
    },
  };
  
  return fetch(url, mergedOptions);
}

/**
 * LINEブラウザ判定
 */
export function isLineBrowser(): boolean {
  return typeof window !== 'undefined' && 
    window.navigator.userAgent.toLowerCase().includes('line');
}