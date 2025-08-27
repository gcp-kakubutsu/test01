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

  // サブスクリプション情報を取得
  const fetchSubscription = async () => {
    if (!currentUser?.uid) {
      setUserSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
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
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setUserSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  // currentUserが変更されたら再取得
  useEffect(() => {
    fetchSubscription();
  }, [currentUser?.uid]);

  // 定期的にトライアル状態をチェック（1分ごと）
  useEffect(() => {
    if (!currentUser?.uid) return;

    const interval = setInterval(() => {
      checkAndUpdateTrialStatus(currentUser.uid);
    }, 60 * 1000);

    return () => clearInterval(interval);
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