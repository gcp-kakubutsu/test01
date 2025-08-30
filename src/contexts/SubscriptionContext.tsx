"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getUserSubscriptionData, 
  checkAndUpdateTrialStatus,
  initializeUserTrial 
} from '@/lib/firebase/subscription';
import {
  UserWithSubscription,
  UserSubscriptionStatus,
  TrialInfo,
  SubscriptionInfo
} from '@/types/subscription';
import {
  getUserStatus,
  hasPremiumAccess,
  getTrialInfo,
  getSubscriptionInfo
} from '@/utils/subscription';

interface SubscriptionContextType {
  userSubscription: UserWithSubscription | null;
  status: UserSubscriptionStatus;
  hasPremium: boolean;
  trialInfo: TrialInfo | null;
  subscriptionInfo: SubscriptionInfo | null;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [userSubscription, setUserSubscription] = useState<UserWithSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // サブスクリプション情報を取得
  const fetchSubscription = React.useCallback(async () => {
    if (!currentUser?.uid) {
      setUserSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('🔄 Fetching subscription for user:', currentUser.uid);
      
      // LINEブラウザ対応: セッションベースAPIを使用して簡易的に有料判定を取得
      const isLineBrowser = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('line');
      if (isLineBrowser) {
        try {
          const headers: HeadersInit = { 'Accept': 'application/json' };
          if (typeof window !== 'undefined' && (window.location.hostname.includes('ngrok') || window.location.hostname.includes('ngrok-free'))) {
            headers['ngrok-skip-browser-warning'] = 'true';
          }
          const response = await fetch('/api/subscription/check', { method: 'GET', credentials: 'include', headers });
          if (response.ok) {
            const data = await response.json();
            // トップレベルの subscriptionEndDate が存在する（=スクリプト/サブスク起源の有料）の場合のみ
            // 最小ユーザーデータを採用する。トライアル起源の isPremium では Firestore 経路にフォールバックする。
            if (data?.subscriptionEndDate) {
              const endDate = Timestamp.fromDate(new Date(data.subscriptionEndDate));
              const minimalUser = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                createdAt: Timestamp.now(),
                trial: {
                  startDate: null,
                  endDate: null,
                  isActive: false,
                  hasUsed: true,
                  source: undefined,
                },
                subscription: {
                  status: 'active' as const,
                  currentPeriodStart: Timestamp.now(),
                  currentPeriodEnd: endDate,
                  cancelAtPeriodEnd: false,
                  canceledAt: null,
                  pausedAt: null,
                },
                billing: {
                  customerId: null,
                  paymentMethodId: null,
                  lastPaymentDate: null,
                  nextBillingDate: endDate,
                },
                isPremium: true,
              } as UserWithSubscription;
              setUserSubscription(minimalUser);
              setIsLoading(false);
              return; // LINE分岐はここで終了
            }
          }
        } catch (e) {
          // LINEでAPI失敗時は通常ルートへフォールバック
        }
      }
      
      // トライアル状態をチェック・更新
      await checkAndUpdateTrialStatus(currentUser.uid);
      
      // リスタートや初期化レース対策: データ取得をリトライ
      const maxAttempts = 5;
      let attempt = 0;
      let data = null as UserWithSubscription | null;
      while (attempt < maxAttempts && !data) {
        // ユーザーデータを取得
        data = await getUserSubscriptionData(currentUser.uid);
        if (data) break;
        attempt++;
        // 少し待つ（Firebase初期化待ち）
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      setUserSubscription(data);
      
      // 新規ユーザーの場合、トライアルを初期化（論理演算子の優先順位に注意して括弧で明示）
      if (
        data &&
        !data.trial?.hasUsed &&
        (!data.subscription?.status || data.subscription.status === 'none')
      ) {
        await initializeUserTrial(currentUser.uid);
        // 再度取得（同じくリトライ）
        let updatedData = null as UserWithSubscription | null;
        attempt = 0;
        while (attempt < maxAttempts && !updatedData) {
          updatedData = await getUserSubscriptionData(currentUser.uid);
          if (updatedData) break;
          attempt++;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        setUserSubscription(updatedData);
      }
    } catch (error: any) {
      // 権限エラーの場合は静かに処理
      if (error?.code !== 'permission-denied' && 
          !error?.message?.includes('Missing or insufficient permissions')) {
        // 権限エラー以外の場合のみログ出力
        console.error('Error fetching subscription:', error);
      }
      setUserSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.uid, currentUser?.email]);

  // currentUserが変更されたら再取得
  useEffect(() => {
    // ユーザーが変更された場合、前のデータをクリア
    if (!currentUser) {
      setUserSubscription(null);
      setIsLoading(false);
    } else {
      fetchSubscription();
    }
    // マウント時とユーザー変更時のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // 定期的にトライアル状態をチェック（1分ごと）
  useEffect(() => {
    // 前のintervalをクリア
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!currentUser?.uid) return;

    intervalRef.current = setInterval(() => {
      checkAndUpdateTrialStatus(currentUser.uid).catch(() => {
        // エラーを無視
      });
    }, 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentUser?.uid]);

  // 計算されたプロパティ
  const status = userSubscription ? getUserStatus(userSubscription) : UserSubscriptionStatus.FREE;
  const hasPremium = userSubscription ? hasPremiumAccess(userSubscription) : false;
  const trialInfo = userSubscription ? getTrialInfo(userSubscription) : null;
  const subscriptionInfo = userSubscription ? getSubscriptionInfo(userSubscription) : null;

  const value = {
    userSubscription,
    status,
    hasPremium,
    trialInfo,
    subscriptionInfo,
    isLoading,
    refreshSubscription: fetchSubscription
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}