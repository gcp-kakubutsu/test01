'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';

export function ConditionalHeader() {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';
  
  // Don't show header on landing page
  if (isLandingPage) {
    return null;
  }
  
  return <Header />;
}