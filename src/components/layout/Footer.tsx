
"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Footer() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="bg-card text-card-foreground border-t py-8 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <div className="flex justify-center gap-4 mb-4">
          <Link href="/company" className="text-sm hover:text-primary">会社概要</Link>
          <Link href="/terms" className="text-sm hover:text-primary">利用規約</Link>
          <Link href="/privacy" className="text-sm hover:text-primary">プライバシーポリシー</Link>
          <Link href="/contact" className="text-sm hover:text-primary">お問い合わせ</Link>
        </div>
        <p className="text-sm text-muted-foreground">
          &copy; {currentYear} Nukune. All rights reserved.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Nukuneは成人（18歳以上）のみを対象としています。責任を持ってお楽しみください。
        </p>
      </div>
    </footer>
  );
}
