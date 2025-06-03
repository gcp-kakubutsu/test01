"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Heart, Users, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/lib/firebase/hooks';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

const navItems: NavItem[] = [
  { href: '/search', icon: Search, label: 'さがす' },
  { href: '/matches', icon: Heart, label: 'マッチ' },
  { href: '/community', icon: Users, label: 'コミュニティ' },
  { href: '/messages', icon: MessageCircle, label: 'メッセージ' },
  { href: '/profile', icon: User, label: 'マイページ' },
];

export default function BottomNavigation() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const { currentUser } = useAuth();
  const { matches } = useMatches();

  // Calculate total unread messages
  const totalUnreadCount = currentUser && matches 
    ? matches.reduce((total, match) => total + (match.unreadCount?.[currentUser.uid] || 0), 0)
    : 0;

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show navigation when at top or scrolling up
      if (currentScrollY === 0 || currentScrollY < lastScrollY) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Hide when scrolling down (with threshold)
        setIsVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Don't show on auth pages
  if (pathname === '/login' || pathname === '/signup' || pathname === '/' || pathname === '/verify') {
    return null;
  }

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 transition-transform duration-300 z-50",
        !isVisible && "translate-y-full"
      )}
    >
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || 
                          (item.href === '/profile' && pathname.startsWith('/profile')) ||
                          (item.href === '/profile' && pathname === '/settings');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center space-y-1 transition-colors",
                isActive 
                  ? "text-[#F0306A]" 
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <div className="relative">
                <Icon 
                  className="h-5 w-5" 
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {item.href === '/messages' && totalUnreadCount > 0 && (
                  <Badge 
                    className="absolute -top-2 -right-2 bg-red-500 text-white min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white"
                  >
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}