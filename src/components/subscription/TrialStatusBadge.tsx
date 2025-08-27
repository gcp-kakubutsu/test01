"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from "@/components/ui/badge";
import { useSubscription } from '@/contexts/SubscriptionContext';
import { UserSubscriptionStatus } from '@/types/subscription';
import { Gift, Crown, AlertTriangle, Clock } from 'lucide-react';

export function TrialStatusBadge() {
  const router = useRouter();
  const { status, trialInfo, subscriptionInfo } = useSubscription();

  const handleClick = () => {
    router.push('/mypage#subscription');
  };

  // 無料会員の場合は表示しない
  if (status === UserSubscriptionStatus.FREE || status === UserSubscriptionStatus.TRIAL_EXPIRED) {
    return null;
  }

  // トライアル中
  if (status === UserSubscriptionStatus.TRIAL_ACTIVE && trialInfo?.isActive) {
    const isLastDay = trialInfo.daysRemaining === 0;
    const isWarning = trialInfo.daysRemaining <= 2;

    return (
      <Badge
        className={`
          cursor-pointer px-3 py-1.5 flex items-center gap-1.5 transition-all
          ${isLastDay 
            ? 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse' 
            : isWarning 
              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
          }
        `}
        onClick={handleClick}
      >
        {isLastDay ? (
          <>
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="font-semibold">最終日！</span>
          </>
        ) : isWarning ? (
          <>
            <Clock className="h-3.5 w-3.5" />
            <span>あと{trialInfo.daysRemaining + 1}日</span>
          </>
        ) : (
          <>
            <Gift className="h-3.5 w-3.5" />
            <span>お試し{trialInfo.daysUsed}日目</span>
            <span className="text-xs opacity-75">（あと{trialInfo.daysRemaining}日）</span>
          </>
        )}
      </Badge>
    );
  }

  // 有料会員（アクティブ）
  if (status === UserSubscriptionStatus.PREMIUM_ACTIVE) {
    return (
      <Badge
        className="cursor-pointer px-3 py-1.5 flex items-center gap-1.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600 transition-all"
        onClick={handleClick}
      >
        <Crown className="h-3.5 w-3.5" />
        <span className="font-semibold">プレミアム会員</span>
      </Badge>
    );
  }

  // 有料会員（解約予定）
  if (status === UserSubscriptionStatus.PREMIUM_CANCELED && subscriptionInfo) {
    return (
      <Badge
        className="cursor-pointer px-3 py-1.5 flex items-center gap-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
        onClick={handleClick}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>解約予定</span>
        <span className="text-xs opacity-75">（残り{subscriptionInfo.daysRemaining}日）</span>
      </Badge>
    );
  }

  return null;
}