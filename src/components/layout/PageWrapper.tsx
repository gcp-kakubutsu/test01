'use client';

import { usePathname } from 'next/navigation';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't add padding on landing page
  const shouldAddPadding = pathname !== '/';
  
  return (
    <div className={shouldAddPadding ? "pt-20" : ""}>
      {children}
    </div>
  );
}