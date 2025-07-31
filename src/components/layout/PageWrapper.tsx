'use client';

import { usePathname } from 'next/navigation';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  // Always add padding for header
  return (
    <div className="pt-20">
      {children}
    </div>
  );
}