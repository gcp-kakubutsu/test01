'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Footer } from './Footer';
import BottomNavigation from './BottomNavigation';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <div className={isAuthenticated ? 'pb-16' : ''}>
        {children}
      </div>
      {!isAuthenticated && <Footer />}
      {isAuthenticated && <BottomNavigation />}
    </>
  );
}