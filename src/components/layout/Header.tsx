"use client";

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from './Header.module.scss';

export function Header() {
  const { isAuthenticated, logout, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        <Link href="/" className={styles.logo}>
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
                <Link href="/home" className={styles.navLink}>ホーム</Link>
                <Link href="/messages" className={styles.navLink}>メッセージ</Link>
                <Link href="/profile/edit" className={styles.navLink}>プロフィール</Link>
                <button onClick={handleLogout} className={`${styles.navLink} ${styles.primary}`}>
                  ログアウト
                </button>
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