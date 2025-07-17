"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Heart, Users, MessageCircle, User, Home, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/lib/firebase/hooks';
import { useRouter } from 'next/navigation';
import styles from './BottomNavigation.module.scss';

interface NavItem {
  href?: string;
  action?: () => void;
  icon: React.ElementType;
  label: string;
}

export default function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const { currentUser, logout } = useAuth();
  const { matches } = useMatches();

  // Calculate total unread messages
  const totalUnreadCount = currentUser && matches 
    ? matches.reduce((total, match) => total + (match.unreadCount?.[currentUser.uid] || 0), 0)
    : 0;

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const navItems: NavItem[] = [
    { href: '/search', icon: Search, label: 'さがす' },
    { href: '/matches', icon: Heart, label: 'マッチ' },
    { href: '/community', icon: Users, label: 'コミュニティ' },
    { href: '/messages', icon: MessageCircle, label: 'メッセージ' },
    { href: '/profile', icon: User, label: 'マイページ' },
  ];

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
    <nav className={`${styles.bottomNav} ${!isVisible ? styles.hidden : ''}`}>
      <div className={styles.navGrid}>
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.href && (
            pathname === item.href || 
            (item.href === '/profile' && pathname.startsWith('/profile')) ||
            (item.href === '/profile' && pathname === '/settings')
          );
          
          if (item.action) {
            return (
              <button
                key={index}
                onClick={item.action}
                className={styles.navItem}
              >
                <div className={styles.navIcon}>
                  <Icon 
                    size={20}
                    strokeWidth={2}
                  />
                </div>
                <span className={styles.navLabel}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <div className={styles.navIcon}>
                <Icon 
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {item.href === '/messages' && totalUnreadCount > 0 && (
                  <span className={styles.badge}>
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </div>
              <span className={styles.navLabel}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}