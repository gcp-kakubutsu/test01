"use client";

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function PremiumOnlyCard() {
  const router = useRouter();

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8 text-center">
      <div className="mb-4">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="h-12 w-12 text-gray-400 mx-auto mb-4"
        >
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>
        </svg>
        <h2 className="text-lg font-semibold mb-2">有料会員限定</h2>
        <p className="text-gray-500 mb-4">プロフィールの詳細は有料会員のみ閲覧できます</p>
      </div>
      <Button
        onClick={() => router.push('/subscription')}
        className="bg-[#F0306A] hover:bg-[#E02860] text-white"
      >
        有料プランを見る
      </Button>
    </div>
  );
}