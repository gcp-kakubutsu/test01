"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Heart, Users, StickyNote, User, Loader2 } from 'lucide-react';
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

// プリフェッチ済みのURLを管理
const prefetchedUrls = new Set<string>();

export default function BottomNavigationOptimized() {
  const pathname = usePathname();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const { currentUser, logout } = useAuth();
  const { matches } = useMatches();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  // Calculate total unread messages
  const totalUnreadCount = currentUser && matches 
    ? matches.reduce((total, match) => total + (match.unreadCount?.[currentUser.uid] || 0), 0)
    : 0;

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const navItems = useMemo<NavItem[]>(() => [
    { href: '/search', icon: Search, label: 'さがす' },
    { href: '/likes', icon: Heart, label: 'いいね' },
    { href: '/community', icon: Users, label: 'コミュニティ' },
    { href: '/messages', icon: StickyNote, label: 'メモ' },
    { href: '/profile', icon: User, label: 'マイページ' },
  ], []);

  // ページプリフェッチ
  const prefetchPage = useCallback((href: string) => {
    if (!prefetchedUrls.has(href)) {
      router.prefetch(href);
      prefetchedUrls.add(href);
      
      // 重要なページのデータも事前フェッチ
      if (href === '/likes' && currentUser) {
        // いいねデータのプリフェッチ
        fetch('/api/likes/prefetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.uid })
        }).catch(console.error);
      } else if (href === '/messages' && currentUser) {
        // メモデータのプリフェッチ
        fetch('/api/memos/prefetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.uid })
        }).catch(console.error);
      }
    }
  }, [router, currentUser]);

  // 全ページを事前プリフェッチ（マウント時）
  useEffect(() => {
    navItems.forEach(item => {
      if (item.href) {
        prefetchPage(item.href);
      }
    });
  }, [navItems, prefetchPage]);

  // 高速ナビゲーション
  const handleNavigation = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    
    // 即座にローディング状態を表示
    setNavigatingTo(href);
    
    // 少し遅延を入れてアニメーション効果を出す
    setTimeout(() => {
      router.push(href);
      // ナビゲーション後にローディング状態を解除
      setTimeout(() => {
        setNavigatingTo(null);
      }, 300);
    }, 50);
  }, [router]);

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
          const isNavigating = navigatingTo === item.href;
          
          if (item.action) {
            return (
              <button
                key={index}
                onClick={item.action}
                className={styles.navItem}
              >
                <div className={styles.navIcon}>
                  <Icon 
                    size={24}
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
              className={`${styles.navItem} ${isActive ? styles.active : ''} ${isNavigating ? styles.navigating : ''}`}
              onMouseEnter={() => prefetchPage(item.href!)}
              onClick={(e) => handleNavigation(e, item.href!)}
            >
              <div className={styles.navIcon}>
                {isNavigating ? (
                  <Loader2 
                    size={24}
                    className="animate-spin"
                  />
                ) : (
                  <>
                    <Icon 
                      size={24}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {item.href === '/messages' && totalUnreadCount > 0 && (
                      <span className={styles.badge}>
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                      </span>
                    )}
                  </>
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