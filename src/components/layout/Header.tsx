
"use client";

import Link from 'next/link';
import { HeartHandshake, LogIn, LogOut, MessageSquare, Settings, User, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export function Header() {
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="bg-card text-card-foreground shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary">
          <HeartHandshake className="h-8 w-8" />
          NukuConnect
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          {isAuthenticated ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/home" className="flex items-center gap-1">
                  <HeartHandshake className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Matches</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/messages" className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Messages</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/profile/edit" className="flex items-center gap-1">
                  <User className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Profile</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings" className="flex items-center gap-1">
                  <Settings className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Settings</span>
                </Link>
              </Button>
              <Button variant="destructive" size="sm" onClick={handleLogout} className="flex items-center gap-1">
                <LogOut className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Logout</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild>
                <Link href="/signup">
                  <UserPlus className="mr-2 h-4 w-4" /> Sign Up
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
