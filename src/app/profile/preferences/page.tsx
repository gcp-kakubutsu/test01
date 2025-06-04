"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getMalePreferences, type MalePreferences } from '@/lib/firebase/malePreferences';
import MaleOnboarding from '@/components/MaleOnboarding';
import { Loader2 } from 'lucide-react';

export default function PreferencesPage() {
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (currentUser) {
      setLoading(false);
    }
  }, [currentUser]);

  const handleComplete = () => {
    router.push('/profile');
  };

  const handleBack = () => {
    router.back();
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">読み込み中...</p>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  return (
    <MaleOnboarding
      userId={currentUser.uid}
      userEmail={currentUser.email || undefined}
      onComplete={handleComplete}
      onBack={handleBack}
    />
  );
}