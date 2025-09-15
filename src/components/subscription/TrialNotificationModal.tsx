"use client";

/**
 * 概要: トライアル期間の通知モーダルを表示するクライアントコンポーネント。
 *  - トライアル残日数や時間に応じてヘッダーのアイコン/文言/色味を切り替えます。
 *  - 進捗バー、プレミアム機能の紹介、アクションボタンを含みます。
 * 主要仕様:
 *  - 1日1回のみ自動表示（localStorage: trialModalLastShown を使用）。
 *  - テキストは既存の文言を変更せずに表示します。
 *  - プレミアム機能紹介のカードは赤いヘッダー+ベージュの本文、赤枠の丸角ボックスに統一。
 * 制限事項:
 *  - localStorage に依存するため SSR では動作しません。
 *  - UI は Tailwind CSS ユーティリティクラスに依存します。
 * @returns {JSX.Element | null} モーダル要素。トライアルが無効な場合は null。
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from '@/contexts/SubscriptionContext';
import { UserSubscriptionStatus } from '@/types/subscription';
import { Sparkles, Gift, AlertTriangle, Clock } from 'lucide-react';

/**
 * コンポーネント本体。
 * @returns {JSX.Element | null}
 */
export function TrialNotificationModal() {
  const router = useRouter();
  const { status, trialInfo, isLoading } = useSubscription();
  const [isOpen, setIsOpen] = useState(false);
  const [hasShownToday, setHasShownToday] = useState(false);

  useEffect(() => {
    // ローディング中またはすでに今日表示済みの場合はスキップ
    if (isLoading || hasShownToday) return;

    // トライアル中のユーザーのみ表示
    if (status === UserSubscriptionStatus.TRIAL_ACTIVE && trialInfo?.isActive) {
      // ローカルストレージで今日表示したかチェック
      const lastShown = localStorage.getItem('trialModalLastShown');
      const today = new Date().toDateString();
      
      if (lastShown !== today) {
        // 少し遅延させて表示（ページ読み込み完了後）
        const timer = setTimeout(() => {
          setIsOpen(true);
          localStorage.setItem('trialModalLastShown', today);
          setHasShownToday(true);
        }, 1500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [status, trialInfo, isLoading, hasShownToday]);

  if (!trialInfo || !trialInfo.isActive) {
    return null;
  }

  const progressPercentage = ((trialInfo.daysUsed / 7) * 100);
  const isLastDay = trialInfo.daysRemaining === 0;
  const isWarning = trialInfo.daysRemaining <= 2;

  /**
   * プレミアムへのアップグレード遷移を実行します。
   * @returns {void}
   */
  const handleUpgrade = () => {
    setIsOpen(false);
    router.push('/subscription/upgrade');
  };

  /**
   * モーダルを閉じます（本日の再表示は行いません）。
   * @returns {void}
   */
  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {isLastDay ? (
              <AlertTriangle className="h-6 w-6 text-red-500" />
            ) : isWarning ? (
              <Clock className="h-6 w-6 text-yellow-500" />
            ) : (
              <Gift className="h-6 w-6 text-pink-500" />
            )}
            <DialogTitle className="text-xl">
              {isLastDay ? (
                "⚠️ トライアル最終日です！"
              ) : isWarning ? (
                `⏰ トライアル残り${trialInfo.daysRemaining + 1}日`
              ) : (
                `🎁 プレミアムトライアル ${trialInfo.daysUsed}日目`
              )}
            </DialogTitle>
          </div>
          <div className="text-sm text-muted-foreground space-y-3">
            <div>
              {isLastDay ? (
                <p className="text-red-600 font-semibold">
                  本日でプレミアム機能の無料お試し期間が終了します。
                  明日からは一部機能が制限されます。
                </p>
              ) : isWarning ? (
                <p className="text-yellow-600">
                  あと{trialInfo.hoursRemaining}時間でプレミアム機能の
                  無料お試し期間が終了します。
                </p>
              ) : (
                <p>
                  あと{trialInfo.daysRemaining}日間、すべてのプレミアム機能を
                  無料でお使いいただけます！
                </p>
              )}
            </div>

            {/* 進捗バー */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>トライアル進捗</span>
                <span>{trialInfo.daysUsed}/7日</span>
              </div>
              <Progress 
                value={progressPercentage} 
                className={`h-2 ${isLastDay ? 'bg-red-100' : isWarning ? 'bg-yellow-100' : ''}`}
              />
            </div>

            {/* プレミアム機能の紹介（赤ヘッダー+赤枠+ベージュ本文のカード） */}
            <div className="border-2 border-red-500 rounded-xl overflow-hidden shadow-sm">
              {/* ヘッダー（赤帯） */}
              <div className="bg-red-500 text-white px-3 py-2 flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                <span className="font-bold text-sm">プレミアム機能</span>
              </div>
              {/* 本文（ベージュ） */}
              <div className="bg-amber-50 px-3 py-3 text-gray-800 dark:text-gray-900">
                <ul className="text-xs space-y-1 ml-5">
                  <li>• 無制限のいいね送信</li>
                  <li>• 詳細なプロフィール閲覧</li>
                  <li>• メッセージの既読確認</li>
                  <li>• 高度な検索フィルター</li>
                </ul>
              </div>
            </div>

          </div>
        </DialogHeader>
        
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleClose}
          >
            あとで確認する
          </Button>
          <Button
            onClick={handleUpgrade}
            className={`${isLastDay ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600'}`}
          >
            {isLastDay ? '今すぐアップグレード' : 'プレミアム会員になる'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}