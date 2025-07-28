"use client";

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Home, MessageCircle, User, LogOut } from 'lucide-react';
import styles from './Header.module.scss';

export function Header() {
  const { isAuthenticated, logout, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      router.push('/');
    }
  };

  // Always show header
  // Remove the hiding logic to ensure header is always visible

  return (
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        <Link href={isAuthenticated ? "/home" : "/"} className={styles.logo}>
          <Image 
            src="/img/logo_nukune.svg" 
            alt="Nukune Logo" 
            width={150} 
            height={40}
            priority
            className={styles.logoImg}
          />
        </Link>
        <nav className={styles.navLinks}>
          {!isLoading && (
            isAuthenticated ? (
              <>
                {/* Desktop Navigation */}
                <Link href="/home" className={`${styles.navLink} ${styles.hideOnMobile}`}>ホーム</Link>
                <Link href="/messages" className={`${styles.navLink} ${styles.hideOnMobile}`}>メッセージ</Link>
                <Link href="/profile/edit" className={`${styles.navLink} ${styles.hideOnMobile}`}>プロフィール</Link>
                <button onClick={handleLogout} className={`${styles.navLink} ${styles.primary} ${styles.hideOnMobile}`}>
                  ログアウト
                </button>
                
                {/* Mobile Navigation Icons */}
                <div className={styles.mobileNav}>
                  <Link href="/home" className={styles.iconLink}>
                    <Home size={20} />
                  </Link>
                  <Link href="/messages" className={styles.iconLink}>
                    <MessageCircle size={20} />
                  </Link>
                  <Link href="/profile/edit" className={styles.iconLink}>
                    <User size={20} />
                  </Link>
                  <button onClick={handleLogout} className={styles.iconButton}>
                    <LogOut size={20} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className={styles.navLink}>ログイン</Link>
                <Link href="/signup" className={`${styles.navLink} ${styles.primary}`}>新規登録</Link>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  );
}