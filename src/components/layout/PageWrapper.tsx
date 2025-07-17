'use client';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  // Always add padding top for header
  return (
    <div className="pt-20">
      {children}
    </div>
  );
}