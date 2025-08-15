// Browser detection utilities

export function isLineApp(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return ua.includes('line');
}

export function isIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && ua.includes('mobile');
}

export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
}

export function getBrowserInfo(): {
  isLine: boolean;
  isMobile: boolean;
  userAgent: string;
} {
  if (typeof window === 'undefined') {
    return {
      isLine: false,
      isMobile: false,
      userAgent: '',
    };
  }

  return {
    isLine: isLineApp(),
    isMobile: isMobileBrowser(),
    userAgent: window.navigator.userAgent,
  };
}

// Check if localStorage is available (some browsers may block it)
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('localStorage is not available:', e);
    return false;
  }
}

// Check if sessionStorage is available
export function isSessionStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const testKey = '__sessionStorage_test__';
    window.sessionStorage.setItem(testKey, 'test');
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('sessionStorage is not available:', e);
    return false;
  }
}