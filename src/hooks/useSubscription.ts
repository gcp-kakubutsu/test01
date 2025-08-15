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
    
    if (!currentUser) {
      setSubscription({ isPremium: false, subscriptionStatus: 'none' });
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const db = getFirebaseDb();
        
        // Check if component is still mounted and db is initialized
        if (!isMounted || !db) {
          console.log('Component unmounted or Firestore not initialized');
          return;
        }
        
        // Firebase Authの認証状態を待つ（最大と2秒）
        await waitForAuth(2000);
        
        // ストレージからユーザーIDを取得
        const userId = currentUser?.uid || getStoredUserId();
        if (!userId) {
          console.log('No user ID available');
          setSubscription({ isPremium: false, subscriptionStatus: 'none' });
          setLoading(false);
          return;
        }
        
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        // Check if component is still mounted after async operation
        if (!isMounted) {
          console.log('Component unmounted during Firestore operation');
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
          
          console.log('[useSubscription] User has premium with end date:', endDate, 'isActive:', isActive)
          
          setSubscription({
            isPremium: isActive,
            subscriptionStatus: isActive ? 'active' : 'expired',
            subscriptionPlan: userData.subscriptionPlan,
            subscriptionEndDate: endDate
          });
        } else if (userData?.isPremium) {
          // isPremiumがtrueだが、subscriptionEndDateがない場合も有効とする
          console.log('[useSubscription] Premium user without end date - treating as premium');
          setSubscription({
            isPremium: true,
            subscriptionStatus: 'active',
            subscriptionPlan: userData.subscriptionPlan
          });
        } else {
          console.log('[useSubscription] Non-premium user. userData:', userData);
          setSubscription({ isPremium: false, subscriptionStatus: 'none' });
        }
      } catch (error: any) {
        // Check if component is still mounted before setting state
        if (!isMounted) {
          console.log('Component unmounted, ignoring error');
          return;
        }
        
        if (isPermissionError(error)) {
          // Permission denied - user might not have access yet or logged out
          console.log('Permission denied for subscription data - treating as non-premium');
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