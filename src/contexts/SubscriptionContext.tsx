"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
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
      
      // トライアル状態をチェック・更新
      await checkAndUpdateTrialStatus(currentUser.uid);
      
      // ユーザーのサブスクリプション情報を取得
      const data = await getUserSubscriptionData(currentUser.uid);
      setUserSubscription(data);
      
      // 新規ユーザーの場合、トライアルを初期化
      if (data && !data.trial?.hasUsed && !data.subscription?.status || data?.subscription?.status === 'none') {
        await initializeUserTrial(currentUser.uid);
        // 再度取得
        const updatedData = await getUserSubscriptionData(currentUser.uid);
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
  }, [currentUser?.uid]);

  // currentUserが変更されたら再取得
  useEffect(() => {
    // ユーザーが変更された場合、前のデータをクリア
    if (!currentUser) {
      setUserSubscription(null);
      setIsLoading(false);
    } else {
      fetchSubscription();
    }
  }, [currentUser?.uid, fetchSubscription]);

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