import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
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
        // Check if component is still mounted and db is initialized
        if (!isMounted || !db) {
          console.log('Component unmounted or Firestore not initialized');
          return;
        }
        
        // Check if currentUser still exists before making Firestore call
        if (!currentUser?.uid) {
          console.log('User logged out, skipping Firestore call');
          setSubscription({ isPremium: false, subscriptionStatus: 'none' });
          setLoading(false);
          return;
        }
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
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
        
        console.log('User subscription data:', userData);
        
        if (userData?.isPremium && userData?.subscriptionEndDate) {
          const endDate = userData.subscriptionEndDate.toDate();
          const isActive = endDate > new Date();
          
          console.log('Premium user detected:', {
            isPremium: userData.isPremium,
            endDate: endDate.toISOString(),
            isActive
          });
          
          setSubscription({
            isPremium: isActive,
            subscriptionStatus: isActive ? 'active' : 'expired',
            subscriptionPlan: userData.subscriptionPlan,
            subscriptionEndDate: endDate
          });
        } else if (userData?.isPremium) {
          // isPremiumがtrueだが、subscriptionEndDateがない場合も有効とする
          console.log('Premium user without end date');
          setSubscription({
            isPremium: true,
            subscriptionStatus: 'active',
            subscriptionPlan: userData.subscriptionPlan
          });
        } else {
          console.log('Non-premium user');
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