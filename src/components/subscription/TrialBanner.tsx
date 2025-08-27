"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { UserSubscriptionStatus } from '@/types/subscription';
import { Gift, AlertTriangle, Clock, ChevronRight, Sparkles } from 'lucide-react';

export function TrialBanner() {
  const router = useRouter();
  const { status, trialInfo, isLoading } = useSubscription();

  // トライアル中以外は表示しない（プレミアム会員も含む）
  if (isLoading || status !== UserSubscriptionStatus.TRIAL_ACTIVE || !trialInfo?.isActive) {
    return null;
  }

  const isLastDay = trialInfo.daysRemaining === 0;
  const isWarning = trialInfo.daysRemaining <= 2;

  const handleClick = () => {
    router.push('/mypage#subscription');
  };

  return (
    <div 
      className={`
        w-full cursor-pointer transition-all duration-300 relative overflow-hidden border-b-2
        ${isLastDay 
          ? 'bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 border-red-400 dark:border-red-500' 
          : isWarning 
            ? 'bg-gradient-to-r from-yellow-100 to-orange-50 dark:from-yellow-900/30 dark:to-orange-800/20 border-yellow-400 dark:border-yellow-500'
            : 'bg-gradient-to-r from-pink-100 via-pink-50 to-purple-50 dark:from-pink-900/30 dark:via-pink-800/20 dark:to-purple-900/20 border-pink-300 dark:border-pink-400'
        }
      `}
      onClick={handleClick}
    >
      {/* 背景パターン */}
      <div className="absolute inset-0 opacity-5 dark:opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,.1) 10px, rgba(0,0,0,.1) 20px)`
        }} />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* アイコンバッジ */}
            <div className={`
              rounded-full p-2.5 shadow-md
              ${isLastDay 
                ? 'bg-red-500' 
                : isWarning 
                  ? 'bg-orange-500'
                  : 'bg-pink-500'
              }
            `}>
              {isLastDay ? (
                <AlertTriangle className="h-5 w-5 text-white animate-pulse" />
              ) : isWarning ? (
                <Clock className="h-5 w-5 text-white" />
              ) : (
                <Gift className="h-5 w-5 text-white" />
              )}
            </div>
            
            {/* メインテキスト */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* ステータスバッジ */}
                <div className={`
                  inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shadow-sm
                  ${isLastDay 
                    ? 'bg-red-500 text-white dark:bg-red-600' 
                    : isWarning 
                      ? 'bg-orange-500 text-white dark:bg-orange-600'
                      : 'bg-pink-500 text-white dark:bg-pink-600'
                  }
                `}>
                  {isLastDay ? (
                    <>
                      <Sparkles className="h-3 w-3" />
                      最終日
                    </>
                  ) : (
                    `${trialInfo.daysUsed}日目/7日間`
                  )}
                </div>
                
                {/* メッセージ */}
                <span className={`
                  text-sm sm:text-base font-bold text-gray-800 dark:text-gray-100
                `}>
                  {isLastDay 
                    ? '本日で無料お試し終了！' 
                    : isWarning
                      ? `あと${trialInfo.daysRemaining + 1}日で終了`
                      : `あと${trialInfo.daysRemaining}日お試しできます`
                  }
                </span>
              </div>
              
              {/* サブテキスト */}
              {isLastDay && (
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 font-medium">
                  明日からプレミアム機能が制限されます
                </p>
              )}
            </div>
          </div>
          
          {/* CTA部分 */}
          <div className="flex items-center gap-2">
            
            {/* 詳細ボタン */}
            <div className={`
              flex items-center gap-1 px-4 py-2 rounded-full font-bold text-sm shadow-md transition-all hover:scale-105
              ${isLastDay 
                ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700' 
                : isWarning 
                  ? 'bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  : 'bg-white dark:bg-gray-800 text-pink-600 dark:text-pink-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            `}>
              詳細を見る
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}