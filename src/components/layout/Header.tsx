
"use client";

import Link from 'next/link';
import { LogIn, LogOut, MessageSquare, Settings, User, UserPlus, Loader2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export function Header() {
  const { isAuthenticated, logout, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className="bg-card text-card-foreground shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 flex justify-between items-center gap-2">
        <Link href="/" className="flex items-center flex-shrink-0">
          <Image 
            src="/img/logo_nukune.svg" 
            alt="Nukune Logo" 
            width={150} 
            height={40}
            priority
            className="h-8 w-auto sm:h-10 max-w-[120px] sm:max-w-[150px]"
          />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 lg:gap-4 overflow-x-auto">
          {isLoading ? (
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
          ) : isAuthenticated ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/home" className="flex items-center gap-1">
                  <Home className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">ホーム</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/messages" className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">メッセージ</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/profile/edit" className="flex items-center gap-1">
                  <User className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">プロフィール</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings" className="flex items-center gap-1">
                  <Settings className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">設定</span>
                </Link>
              </Button>
              <Button variant="destructive" size="sm" onClick={handleLogout} className="flex items-center gap-1">
                <LogOut className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">ログアウト</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" /> ログイン
                </Link>
              </Button>
              <Button asChild>
                <Link href="/signup">
                  <UserPlus className="mr-2 h-4 w-4" /> 新規登録
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
