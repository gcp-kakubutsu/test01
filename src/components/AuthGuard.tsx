"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
  fallbackPath?: string;
}

export default function AuthGuard({ 
  children, 
  requireAuth = true,
  fallbackPath = '/login'
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    // 認証が必要で、ロード完了後に未認証の場合のみリダイレクト
    if (requireAuth && !isLoading && !isAuthenticated) {
      router.push(fallbackPath);
    }
  }, [isAuthenticated, isLoading, requireAuth, fallbackPath, router]);
  
  // 3秒後には必ずコンテンツを表示（LINEブラウザ対策）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('⚠️ AuthGuard timeout - forcing content display');
        setForceShow(true);
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [isLoading]);

  // 認証が必要な場合のみローディング表示（タイムアウト前）
  if (requireAuth && isLoading && !forceShow) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-gray-900 dark:text-white">読み込み中...</p>
      </div>
    );
  }

  // 認証が必要で未認証の場合は何も表示しない（リダイレクト中）
  if (requireAuth && !isLoading && !isAuthenticated) {
    return null;
  }

  // 認証OKまたは認証不要の場合は子要素を表示
  return <>{children}</>;
}