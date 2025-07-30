import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';

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
    if (!currentUser) {
      setSubscription({ isPremium: false, subscriptionStatus: 'none' });
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
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
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setSubscription({ isPremium: false, subscriptionStatus: 'none' });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [currentUser]);

  return { ...subscription, loading };
}