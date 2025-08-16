import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getFirebaseDb } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { getStoredUserId, waitForAuth } from '@/lib/firebase/auth-helper';
import { handleFirebaseError, isPermissionError } from '@/lib/firebase/error-handler';

interface SubscriptionData {
  isPremium: boolean;
  subscriptionStatus?: 'active' | 'expired' | 'none';
  subscriptionPlan?: '1month' | '6month' | '12month';
  subscriptionEndDate?: Date;
}

export function useSubscription() {
  const { currentUser } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData>({
    isPremium: false,
    subscriptionStatus: 'none'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    // LINEブラウザの場合は専用APIを使用
    const isLineBrowser = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('line');
    
    if (isLineBrowser) {
      // LINEブラウザ専用の処理
      const fetchSubscriptionForLine = async () => {
        try {
          // セッションベースのAPIを呼び出し
          const response = await fetch('/api/subscription/check', {
            method: 'GET',
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            if (isMounted) {
              setSubscription({
                isPremium: data.isPremium || false,
                subscriptionStatus: data.subscriptionStatus || 'none',
                subscriptionEndDate: data.subscriptionEndDate ? new Date(data.subscriptionEndDate) : undefined,
              });
            }
          } else {
            if (isMounted) {
              setSubscription({ isPremium: false, subscriptionStatus: 'none' });
            }
          }
        } catch (error) {
          console.error('LINE browser subscription check error:', error);
          if (isMounted) {
            setSubscription({ isPremium: false, subscriptionStatus: 'none' });
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };
      
      // 即座に実行
      fetchSubscriptionForLine();
      
      // 1秒後に再チェック（保険）
      setTimeout(() => {
        if (isMounted) {
          fetchSubscriptionForLine();
        }
      }, 1000);
      
      return () => {
        isMounted = false;
      };
    }
    
    // 通常のブラウザの処理
    if (!currentUser) {
      setSubscription({ isPremium: false, subscriptionStatus: 'none' });
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        let db = getFirebaseDb();
        
        // Check if component is still mounted and db is initialized
        if (!isMounted || !db) {
          // LINEブラウザの場合、少し待ってリトライ
          if (typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('line')) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            db = getFirebaseDb();
            if (!db || !isMounted) {
              setSubscription({ isPremium: false, subscriptionStatus: 'none' });
              setLoading(false);
              return;
            }
          } else {
            return;
          }
        }
        
        // Firebase Authの認証状態を待つ（LINEブラウザは長めに）
        const isLineBrowser = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('line');
        await waitForAuth(isLineBrowser ? 5000 : 2000);
        
        // ストレージからユーザーIDを取得
        const userId = currentUser?.uid || getStoredUserId();
        if (!userId) {
          // No user ID available (silent)
          setSubscription({ isPremium: false, subscriptionStatus: 'none' });
          setLoading(false);
          return;
        }
        
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        // Check if component is still mounted after async operation
        if (!isMounted) {
          // Component unmounted during Firestore operation (silent)
          return;
        }
        
        if (!userDoc.exists()) {
          // User document doesn't exist yet
          setSubscription({
            isPremium: false,
            subscriptionStatus: 'none'
          });
          setLoading(false);
          return;
        }
        
        const userData = userDoc.data();
        
        
        if (userData?.isPremium && userData?.subscriptionEndDate) {
          const endDate = userData.subscriptionEndDate.toDate();
          const isActive = endDate > new Date();
          
          // User has premium with end date
          
          setSubscription({
            isPremium: isActive,
            subscriptionStatus: isActive ? 'active' : 'expired',
            subscriptionPlan: userData.subscriptionPlan,
            subscriptionEndDate: endDate
          });
        } else if (userData?.isPremium) {
          // isPremiumがtrueだが、subscriptionEndDateがない場合も有効とする
          setSubscription({
            isPremium: true,
            subscriptionStatus: 'active',
            subscriptionPlan: userData.subscriptionPlan
          });
        } else {
          // Non-premium user
          setSubscription({ isPremium: false, subscriptionStatus: 'none' });
        }
      } catch (error: any) {
        // Check if component is still mounted before setting state
        if (!isMounted) {
          // Component unmounted, ignoring error (silent)
          return;
        }
        
        if (isPermissionError(error)) {
          // Permission denied - completely silent
        } else {
          handleFirebaseError(error, 'useSubscription');
        }
        setSubscription({ isPremium: false, subscriptionStatus: 'none' });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSubscription();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  return { ...subscription, loading };
}