import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // Firebase Auth のデフォルトアクション URL をインターセプト
  if (pathname === '/__/auth/action') {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    const apiKey = searchParams.get('apiKey');
    const lang = searchParams.get('lang') || 'ja';
    
    if (mode && oobCode) {
      // カスタムページにリダイレクト
      const url = new URL(`/auth/action`, request.url);
      url.searchParams.set('mode', mode);
      url.searchParams.set('oobCode', oobCode);
      if (apiKey) url.searchParams.set('apiKey', apiKey);
      url.searchParams.set('lang', lang);
      
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/__/auth/action',
};