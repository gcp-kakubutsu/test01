'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { Footer } from './Footer';
import BottomNavigation from './BottomNavigation';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  return (
    <>
      <div className={isAuthenticated ? 'pb-16' : ''}>
        {children}
      </div>
      {!isAuthenticated && !isLandingPage && <Footer />}
      {isAuthenticated && <BottomNavigation />}
    </>
  );
}