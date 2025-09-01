"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './Footer.module.scss';

export function Footer() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className={styles.footer}>
      <div className="container mx-auto px-4">
        <div className={styles.footerContent}>
          <div className={styles.footerLinks}>
            <Link href="/privacy" className={styles.footerLink}>プライバシーポリシー</Link>
            <Link href="/terms" className={styles.footerLink}>利用規約</Link>
            <Link href="/contact" className={styles.footerLink}>お問い合わせ</Link>
            <Link href="/company" className={styles.footerLink}>会社概要</Link>
            <Link href="/legal" className={styles.footerLink}>特定商取引法に基づく表示</Link>
            <Link href="/support" className={styles.footerLink}>サポートページ</Link>
          </div>
          <p className={styles.footerNotice}>NUKUNEは成人（18歳以上）のみを対象としています。</p>
          <p className={styles.footerCopyright}>
            © {currentYear} NUKUNE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}