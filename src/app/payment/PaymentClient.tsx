'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentClient() {
  const router = useRouter();

  useEffect(() => {
    // 支払いページは廃止されたので、サブスクリプションページへリダイレクト
    router.replace('/subscription');
  }, [router]);

  return null;
}