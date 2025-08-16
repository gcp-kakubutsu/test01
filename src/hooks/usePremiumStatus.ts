'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface PremiumStatus {
  isPremium: boolean;
  subscriptionStatus: string;
  subscriptionEndDate?: string | null;
  isLineBrowser?: boolean;
  loading: boolean;
  error?: string;
}

/**
 * サーバーサイドで有料会員ステータスを確認するカスタムフック
 * LINEブラウザや認証の問題に対応
 */
export function usePremiumStatus(): PremiumStatus {
  const { currentUser, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<PremiumStatus>({
    isPremium: false,
    subscriptionStatus: 'none',
    loading: true,
    isLineBrowser: false
  });

  useEffect(() => {
    // LINEブラウザチェック（クライアントサイド）
    const isLineBrowser = typeof window !== 'undefined' && 
      window.navigator.userAgent.toLowerCase().includes('line');

    // LINEブラウザの場合は即座に有料会員として扱う
    if (isLineBrowser) {
      setStatus({
        isPremium: true,
        subscriptionStatus: 'active',
        loading: false,
        isLineBrowser: true
      });
      return;
    }

    const checkPremiumStatus = async () => {
      try {
        // User-Agentをクッキーに設定（サーバーサイドで判定するため）
        if (typeof window !== 'undefined') {
          document.cookie = `user-agent=${encodeURIComponent(window.navigator.userAgent)}; path=/`;
        }

        const response = await fetch('/api/auth/premium-status', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch premium status');
        }

        const data = await response.json();
        
        setStatus({
          isPremium: data.isPremium || false,
          subscriptionStatus: data.subscriptionStatus || 'none',
          subscriptionEndDate: data.subscriptionEndDate,
          isLineBrowser: data.isLineBrowser || false,
          loading: false,
          error: data.error
        });
      } catch (error) {
        console.error('Error checking premium status:', error);
        
        // エラー時でもLINEブラウザなら有料会員として扱う
        if (isLineBrowser) {
          setStatus({
            isPremium: true,
            subscriptionStatus: 'active',
            loading: false,
            isLineBrowser: true,
            error: 'Using LINE browser override'
          });
        } else {
          setStatus({
            isPremium: false,
            subscriptionStatus: 'none',
            loading: false,
            error: 'Failed to check premium status'
          });
        }
      }
    };

    // 認証状態が確定してからチェック
    if (isAuthenticated === false) {
      // 未認証の場合
      setStatus({
        isPremium: false,
        subscriptionStatus: 'none',
        loading: false,
        isLineBrowser: false
      });
    } else if (currentUser) {
      // 認証済みの場合
      checkPremiumStatus();
    }
  }, [currentUser, isAuthenticated]);

  return status;
}