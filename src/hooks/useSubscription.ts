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
    
    console.log('[useSubscription] Browser detection:', { 
      isLineBrowser, 
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
      currentUser: currentUser?.uid
    });
    
    // LINEブラウザの場合は常にセッションベースのAPIを使用
    // currentUserの有無に関わらず、LINEブラウザではFirestore直接アクセスは不安定
    if (isLineBrowser) {
      // LINEブラウザでは常に専用APIを使用（currentUserの有無に関わらず）
      const fetchSubscriptionForLine = async () => {
        try {
          // セッションベースのAPIを呼び出し
          // ngrok環境対応
          const headers: HeadersInit = {
            'Accept': 'application/json',
          };
          
          // ngrok環境の場合、警告ページをスキップ
          if (typeof window !== 'undefined' && 
              (window.location.hostname.includes('ngrok') || 
               window.location.hostname.includes('ngrok-free'))) {
            headers['ngrok-skip-browser-warning'] = 'true';
          }
          
          const response = await fetch('/api/subscription/check', {
            method: 'GET',
            credentials: 'include',
            headers: {
              ...headers,
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            mode: 'same-origin', // LINEブラウザでのCORS問題を回避
            cache: 'no-store' // キャッシュを無効化
          });
          
          const responseText = await response.text();
          console.log('[useSubscription] LINE API raw response:', responseText);
          
          if (response.ok) {
            const data = JSON.parse(responseText);
            console.log('[useSubscription] LINE API parsed response:', { 
              isPremium: data.isPremium, 
              status: data.subscriptionStatus,
              userId: data.userId,
              fullData: data
            });
            if (isMounted) {
              setSubscription({
                isPremium: data.isPremium === true, // 確実にboolean型にする
                subscriptionStatus: data.subscriptionStatus || 'none',
                subscriptionPlan: data.subscriptionPlan,
                subscriptionEndDate: data.subscriptionEndDate ? new Date(data.subscriptionEndDate) : undefined,
              });
            }
          } else {
            console.error('[useSubscription] LINE API error response:', responseText);
            if (isMounted) {
              setSubscription({ isPremium: false, subscriptionStatus: 'none' });
            }
          }
        } catch (error) {
          console.error('[useSubscription] LINE browser subscription check error:', error);
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
      
      // 2秒後と5秒後に再チェック（LINEブラウザの遅延対策）
      setTimeout(() => {
        if (isMounted) {
          fetchSubscriptionForLine();
        }
      }, 2000);
      
      setTimeout(() => {
        if (isMounted) {
          fetchSubscriptionForLine();
        }
      }, 5000);
      
      // LINEブラウザの場合は、ここで処理を終了
      // 通常のFirestoreアクセスはスキップ
      return () => {
        isMounted = false;
      };
    }
    
    // 通常のブラウザの処理
    if (!currentUser) {
      // currentUserがない場合、デフォルト値を設定
      setSubscription({ isPremium: false, subscriptionStatus: 'none' });
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        console.log('[useSubscription] fetchSubscription started:', {
          currentUserId: currentUser?.uid,
          isLineBrowser,
          hasDb: !!getFirebaseDb()
        });
        
        let db = getFirebaseDb();
        
        // Check if component is still mounted and db is initialized
        if (!isMounted || !db) {
          console.log('[useSubscription] DB not ready, retrying...', { isMounted, hasDb: !!db });
          // LINEブラウザの場合、少し待ってリトライ
          if (typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('line')) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            db = getFirebaseDb();
            if (!db || !isMounted) {
              console.log('[useSubscription] DB still not ready after retry');
              setSubscription({ isPremium: false, subscriptionStatus: 'none' });
              setLoading(false);
              return;
            }
          } else {
            return;
          }
        }
        
        // Firebase Authの認証状態を待つ（LINEブラウザは長めに）
        const isLineBrowserForAuth = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('line');
        await waitForAuth(isLineBrowserForAuth ? 5000 : 2000);
        
        // ストレージからユーザーIDを取得
        const userId = currentUser?.uid || getStoredUserId();
        if (!userId) {
          // No user ID available (silent)
          setSubscription({ isPremium: false, subscriptionStatus: 'none' });
          setLoading(false);
          return;
        }
        
        console.log('[useSubscription] Fetching user doc for:', userId);
        const userDoc = await getDoc(doc(db, 'users', userId));
        console.log('[useSubscription] User doc result:', {
          exists: userDoc.exists(),
          id: userDoc.id
        });
        
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
        
        console.log('[useSubscription] Firestore user data:', { 
          isPremium: userData?.isPremium, 
          hasEndDate: !!userData?.subscriptionEndDate,
          userId: userId,
          fullData: userData
        });
        
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
        
        console.error('[useSubscription] Error fetching subscription:', error);
        console.error('[useSubscription] Error details:', {
          code: error?.code,
          message: error?.message,
          userId: currentUser?.uid,
          hasDb: !!getFirebaseDb(),
          errorStack: error?.stack
        });
        
        if (isPermissionError(error)) {
          console.error('[useSubscription] Permission denied error');
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