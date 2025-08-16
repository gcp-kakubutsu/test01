'use client';

import { usePremiumStatus } from './usePremiumStatus';

/**
 * 後方互換性のためのラッパー
 * 新しいusePremiumStatusフックを使用して、統一的な有料会員チェックを提供
 */
export function useSubscription() {
  const { isPremium, subscriptionStatus, subscriptionEndDate, loading, error } = usePremiumStatus();
  
  // 既存のコンポーネントとの互換性のために同じインターフェースを返す
  return {
    isPremium,
    subscriptionStatus: subscriptionStatus as 'active' | 'expired' | 'none',
    subscriptionPlan: isPremium ? '1month' : undefined, // デフォルト値
    subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : undefined,
    loading,
    error
  };
}