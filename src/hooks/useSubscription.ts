import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { getFirebaseDb } from '@/lib/firebase/client';
import { doc, onSnapshot, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { getStoredUserId, waitForAuth } from '@/lib/firebase/auth-helper';
import { handleFirebaseError, isPermissionError } from '@/lib/firebase/error-handler';
import {
  UserWithSubscription,
  PlanType,
  PlanInfo,
  BillingCycle,
  SUBSCRIPTION_CONSTANTS
} from '@/types/subscription';

// フックの戻り値の型定義
interface UseSubscriptionReturn {
  // 基本的なサブスクリプション情報
  subscription: UserWithSubscription | null;
  isPremium: boolean;
  isExpired: boolean;
  hasActiveSubscription: boolean;
  canAccessPremiumFeatures: boolean;
  
  // プラン情報
  currentPlan: PlanInfo | null;
  currentPlanName: string;
  planType: PlanType;
  
  // 日付・時間情報
  remainingDays: number | null;
  remainingHours: number | null;
  nextBillingDate: Date | null;
  subscriptionExpiresAt: Date | null;
  
  // 状態管理
  loading: boolean;
  error: string | null;
  
  // ヘルパー関数
  getPlanInfo: (planType: PlanType) => PlanInfo | null;
  formatPlanName: (planType: PlanType) => string;
  getRemainingTime: () => { days: number; hours: number; minutes: number } | null;
  isTrialActive: () => boolean;
  willRenew: () => boolean;
}

// プラン名の日本語マッピング
const PLAN_NAME_MAP: Record<PlanType, string> = {
  free: '無料プラン',
  '1month': '1ヶ月プラン',
  '3month': '3ヶ月プラン',
  '6month': '6ヶ月プラン',
  '12month': '12ヶ月プラン'
} as const;

export function useSubscription(): UseSubscriptionReturn {
  const { currentUser } = useAuth();
  const [subscription, setSubscription] = useState<UserWithSubscription | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // onSnapshotのunsubscribeを保持（stateにしないことで再レンダーを防止）
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // プラン情報を取得する関数
  const getPlanInfo = useCallback((planType: PlanType): PlanInfo | null => {
    return plans.find(plan => plan.planType === planType) || null;
  }, [plans]);
  
  // プラン名をフォーマットする関数
  const formatPlanName = useCallback((planType: PlanType): string => {
    return PLAN_NAME_MAP[planType] || planType;
  }, []);
  
  // 残り時間を詳細に計算する関数
  const getRemainingTime = useCallback(() => {
    if (!subscription?.subscriptionExpiresAt) return null;
    
    const now = new Date();
    const expiryDate = subscription.subscriptionExpiresAt.toDate();
    const diffMs = expiryDate.getTime() - now.getTime();
    
    if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0 };
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  }, [subscription?.subscriptionExpiresAt]);
  
  // トライアルが有効かチェック
  const isTrialActive = useCallback(() => {
    if (!subscription?.trial) return false;
    return subscription.trial.isActive;
  }, [subscription?.trial]);
  
  // 自動更新されるかチェック
  const willRenew = useCallback(() => {
    if (!subscription?.subscriptionBasic) return false;
    return subscription.subscriptionBasic.autoRenew && !subscription.cancellation.cancelAtPeriodEnd;
  }, [subscription]);
  
  // プラン一覧を取得
  useEffect(() => {
    let isMounted = true;
    
    const fetchPlans = async () => {
      try {
        const db = getFirebaseDb();
        if (!db) return;
        
        // シンプルなクエリに変更（whereクエリを削除）
        const plansSnapshot = await getDocs(collection(db, 'plans'));
        const plansData: PlanInfo[] = [];
        
        plansSnapshot.forEach(doc => {
          const planData = doc.data() as PlanInfo;
          // クライアント側でisActiveをフィルタリング
          if (planData.isActive !== false) { // isActiveがfalseでない場合（未定義またはtrueの場合）
            plansData.push({ ...planData, id: doc.id });
          }
        });
        
        // sortOrderでソート（sortOrderが存在しない場合は999を使用）
        plansData.sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
        
        if (isMounted) {
          setPlans(plansData);
        }
      } catch (error) {
        console.error('[useSubscription] Error fetching plans:', error);
        if (isMounted) {
          // インデックスエラーも含めてエラーハンドリング
          if (error instanceof Error && error.message.includes('index')) {
            console.log('[useSubscription] Index not created yet, using default plans');
            // デフォルトのプランデータを設定
            const defaultPlans: PlanInfo[] = [
              {
                id: '1month',
                planType: '1month' as PlanType,
                name: '1ヶ月プラン',
                description: '1ヶ月プラン',
                amount: 1980,
                currency: 'JPY',
                billingCycle: 'monthly' as BillingCycle,
                trialDays: 0,
                isActive: true,
                sortOrder: 1,
                features: ['基本機能', 'マッチング機能', 'メッセージ機能'],
                createdAt: null as any,
                updatedAt: null as any
              },
              {
                id: '3month',
                planType: '3month' as PlanType,
                name: '3ヶ月プラン',
                description: '3ヶ月プラン',
                amount: 4950,
                currency: 'JPY',
                billingCycle: 'monthly' as BillingCycle,
                trialDays: 0,
                isActive: true,
                sortOrder: 2,
                features: ['基本機能', 'マッチング機能', 'メッセージ機能'],
                createdAt: null as any,
                updatedAt: null as any
              },
              {
                id: '6month',
                planType: '6month' as PlanType,
                name: '6ヶ月プラン',
                description: '6ヶ月プラン',
                amount: 8880,
                currency: 'JPY',
                billingCycle: 'monthly' as BillingCycle,
                trialDays: 0,
                isActive: true,
                sortOrder: 3,
                features: ['基本機能', 'マッチング機能', 'メッセージ機能'],
                createdAt: null as any,
                updatedAt: null as any
              },
              {
                id: '12month',
                planType: '12month' as PlanType,
                name: '12ヶ月プラン',
                description: '12ヶ月プラン',
                amount: 13800,
                currency: 'JPY',
                billingCycle: 'monthly' as BillingCycle,
                trialDays: 0,
                isActive: true,
                sortOrder: 4,
                features: ['基本機能', 'マッチング機能', 'メッセージ機能'],
                createdAt: null as any,
                updatedAt: null as any
              }
            ];
            if (isMounted) {
              setPlans(defaultPlans);
            }
          } else {
            setError('プラン情報の取得に失敗しました');
          }
        }
      }
    };
    
    fetchPlans();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  // メインのサブスクリプションデータ取得とリアルタイム監視
  useEffect(() => {
    let isMounted = true;
    
    // LINEブラウザの場合は専用APIを使用（既存の処理を簡略化）
    const isLineBrowser = typeof window !== 'undefined' && 
      window.navigator.userAgent.toLowerCase().includes('line');
    
    if (isLineBrowser) {
      // LINEブラウザ用の簡略処理
      const fetchSubscriptionForLine = async () => {
        try {
          const response = await fetch('/api/subscription/check', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          
          if (response.ok && isMounted) {
            const data = await response.json();
            // 簡略化されたデータから基本的な情報のみ設定
            setLoading(false);
          }
        } catch (error) {
          if (isMounted) {
            setError('サブスクリプション情報の取得に失敗しました');
            setLoading(false);
          }
        }
      };
      
      fetchSubscriptionForLine();
      return () => { isMounted = false; };
    }
    
    // 通常のブラウザ用処理
    if (!currentUser) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    
    const setupRealtimeListener = async () => {
      try {
        await waitForAuth(2000);
        
        const db = getFirebaseDb();
        if (!db || !isMounted) return;
        
        const userId = currentUser?.uid || getStoredUserId();
        if (!userId) {
          setSubscription(null);
          setLoading(false);
          return;
        }
        
        // Firestoreリアルタイムリスナーを設定
        const userDocRef = doc(db, 'users', userId);
        const unsubscribeListener = onSnapshot(
          userDocRef,
          (docSnapshot) => {
            if (!isMounted) return;
            
            setError(null);
            
            if (!docSnapshot.exists()) {
              setSubscription(null);
              setLoading(false);
              return;
            }
            
            const userData = docSnapshot.data();
            
            // 新しい型システムに対応したデータ変換
            const subscriptionData: UserWithSubscription = {
              uid: userId,
              email: userData.email || '',
              createdAt: userData.createdAt || Timestamp.now(),
              
              // 新しいサブスクリプション情報
              subscriptionBasic: userData.subscriptionBasic || {
                planType: SUBSCRIPTION_CONSTANTS.PLAN_TYPES.FREE,
                status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.NONE,
                startDate: Timestamp.now(),
                endDate: null,
                autoRenew: false,
                trialEndDate: null
              },
              subscriptionManagement: userData.subscriptionManagement || null,
              subscriptionSchedule: userData.subscriptionSchedule || null,
              cancellation: userData.cancellation || {
                canceledAt: null,
                cancelAtPeriodEnd: false,
                cancelReason: null,
                refundAmount: null,
                refundStatus: null
              },
              
              // 後方互換性のために既存フィールドも保持
              trial: userData.trial || {
                startDate: null,
                endDate: null,
                isActive: false,
                hasUsed: false,
                source: undefined
              },
              subscription: userData.subscription || {
                status: 'none',
                currentPeriodStart: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                canceledAt: null,
                pausedAt: null
              },
              billing: userData.billing || {
                customerId: null,
                paymentMethodId: null,
                lastPaymentDate: null,
                nextBillingDate: null
              },
              isPremium: userData.isPremium || false,
              
              // 新しい便利フィールド
              hasActiveSubscription: userData.hasActiveSubscription || false,
              canAccessPremiumFeatures: userData.canAccessPremiumFeatures || false,
              subscriptionExpiresAt: userData.subscriptionExpiresAt || null,
              daysUntilExpiry: userData.daysUntilExpiry || null
            };
            
            setSubscription(subscriptionData);
            setLoading(false);
          },
          (error) => {
            if (!isMounted) return;
            
            // 権限エラーは静かに処理（初回ユーザーなど）
            if (isPermissionError(error)) {
              console.log('[useSubscription] Permission error - likely new user');
              setError(null); // エラーを表示しない
            } else {
              console.error('[useSubscription] Realtime listener error:', error);
              setError('サブスクリプション情報の取得に失敗しました');
              handleFirebaseError(error, 'useSubscription');
            }
            
            setLoading(false);
          }
        );
        
        // 前のリスナーをクリーンアップしてから新しいリスナーを設定
        if (unsubscribeRef.current) {
          try { unsubscribeRef.current(); } catch {}
        }
        unsubscribeRef.current = unsubscribeListener;
        
      } catch (error: any) {
        if (!isMounted) return;
        
        console.error('[useSubscription] Setup error:', error);
        setError('サブスクリプション情報の取得に失敗しました');
        setLoading(false);
      }
    };
    
    setupRealtimeListener();
    
    return () => {
      isMounted = false;
      if (unsubscribeRef.current) {
        try { unsubscribeRef.current(); } catch {}
        unsubscribeRef.current = null;
      }
    };
  }, [currentUser?.uid]); // uidの変更時のみ再設定

  // 計算されたプロパティ
  const isPremium = useMemo(() => {
    if (!subscription) return false;
    return subscription.isPremium && subscription.canAccessPremiumFeatures;
  }, [subscription]);
  
  const isExpired = useMemo(() => {
    if (!subscription) return false;
    if (subscription.subscriptionBasic.status === 'expired') return true;
    if (!subscription.subscriptionExpiresAt) return false;
    return subscription.subscriptionExpiresAt.toDate() < new Date();
  }, [subscription]);
  
  const hasActiveSubscription = useMemo(() => {
    if (!subscription) return false;
    return subscription.hasActiveSubscription && !isExpired;
  }, [subscription, isExpired]);
  
  const canAccessPremiumFeatures = useMemo(() => {
    if (!subscription) return false;
    return subscription.canAccessPremiumFeatures && !isExpired;
  }, [subscription, isExpired]);
  
  const currentPlan = useMemo(() => {
    if (!subscription) return null;
    return getPlanInfo(subscription.subscriptionBasic.planType);
  }, [subscription, getPlanInfo]);
  
  const currentPlanName = useMemo(() => {
    if (!subscription) return PLAN_NAME_MAP.free;
    return formatPlanName(subscription.subscriptionBasic.planType);
  }, [subscription, formatPlanName]);
  
  const planType = useMemo(() => {
    if (!subscription) return SUBSCRIPTION_CONSTANTS.PLAN_TYPES.FREE;
    return subscription.subscriptionBasic.planType;
  }, [subscription]);
  
  const remainingDays = useMemo(() => {
    if (!subscription?.subscriptionExpiresAt) return null;
    const remaining = getRemainingTime();
    return remaining ? remaining.days : null;
  }, [subscription?.subscriptionExpiresAt, getRemainingTime]);
  
  const remainingHours = useMemo(() => {
    if (!subscription?.subscriptionExpiresAt) return null;
    const remaining = getRemainingTime();
    return remaining ? remaining.hours : null;
  }, [subscription?.subscriptionExpiresAt, getRemainingTime]);
  
  const nextBillingDate = useMemo(() => {
    if (!subscription?.billing.nextBillingDate) return null;
    return subscription.billing.nextBillingDate.toDate();
  }, [subscription?.billing.nextBillingDate]);
  
  const subscriptionExpiresAt = useMemo(() => {
    if (!subscription?.subscriptionExpiresAt) return null;
    return subscription.subscriptionExpiresAt.toDate();
  }, [subscription?.subscriptionExpiresAt]);
  
  return {
    // 基本的なサブスクリプション情報
    subscription,
    isPremium,
    isExpired,
    hasActiveSubscription,
    canAccessPremiumFeatures,
    
    // プラン情報
    currentPlan,
    currentPlanName,
    planType,
    
    // 日付・時間情報
    remainingDays,
    remainingHours,
    nextBillingDate,
    subscriptionExpiresAt,
    
    // 状態管理
    loading,
    error,
    
    // ヘルパー関数
    getPlanInfo,
    formatPlanName,
    getRemainingTime,
    isTrialActive,
    willRenew
  };
}