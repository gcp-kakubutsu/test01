"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSubscription } from '@/contexts/SubscriptionContext';
import { UserSubscriptionStatus } from '@/types/subscription';
import { useToast } from '@/hooks/use-toast';
import { getFirebaseDb, auth } from '@/lib/firebase/client';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Gift, 
  Crown, 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle2,
  User,
  Receipt,
  XCircle,
  Loader2
} from 'lucide-react';

export function SubscriptionStatusSection() {
  const router = useRouter();
  const { status, trialInfo, subscriptionInfo, userSubscription, isLoading } = useSubscription();
  const [showReactivateModal, setShowReactivateModal] = React.useState(false);
  const [isReactivating, setIsReactivating] = React.useState(false);
  const { toast } = useToast();

  const handleReactivate = async () => {
    if (status !== UserSubscriptionStatus.PREMIUM_CANCELED) return;
    setIsReactivating(true);
    
    try {
      const db = getFirebaseDb();
      if (!db) throw new Error('Database not initialized');
      
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      
      const userRef = doc(db, 'users', user.uid);
      
      // 解約を取り消す
      await updateDoc(userRef, {
        'subscription.cancelAtPeriodEnd': false,
        'subscription.canceledAt': null,
        'subscription.cancelReason': null,
        'subscription.cancelFeedback': null,
        updatedAt: serverTimestamp()
      });

      toast({
        title: "解約を取り消しました",
        description: "プレミアムプランの継続をありがとうございます。",
      });

      setShowReactivateModal(false);
      // ページをリフレッシュして状態を更新
      window.location.reload();
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast({
        title: "エラー",
        description: "解約の取り消し中にエラーが発生しました。",
        variant: "destructive"
      });
    } finally {
      setIsReactivating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 無料会員（トライアル未使用）
  if (status === UserSubscriptionStatus.FREE && !userSubscription?.trial?.hasUsed) {
    return (
      <Card className="border-2 border-pink-300 dark:border-pink-400 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-pink-100 via-pink-50 to-purple-50 dark:from-pink-900/30 dark:via-pink-800/20 dark:to-purple-900/20">
          <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <div className="p-2 bg-pink-500 rounded-full">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold">7日間無料トライアル実施中！</span>
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
            今なら全てのプレミアム機能を7日間無料でお試しいただけます
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-lg p-4 space-y-3 border border-pink-200 dark:border-pink-800">
            <h4 className="font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <Sparkles className="h-4 w-4 text-pink-500" />
              プレミアム機能をすべて体験
            </h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <li className="flex items-center gap-2">
                <div className="p-0.5 bg-green-500 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </div>
                <span>無制限のいいね送信</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="p-0.5 bg-green-500 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </div>
                <span>詳細なプロフィール閲覧</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="p-0.5 bg-green-500 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </div>
                <span>メッセージの既読確認</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="p-0.5 bg-green-500 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </div>
                <span>高度な検索フィルター</span>
              </li>
            </ul>
          </div>
          <Button 
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold shadow-lg hover:shadow-xl transition-all"
            onClick={() => router.push('/subscription/trial')}
          >
            無料トライアルを開始
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // トライアル中
  if (status === UserSubscriptionStatus.TRIAL_ACTIVE && trialInfo?.isActive) {
    const progressPercentage = ((trialInfo.daysUsed / 7) * 100);
    const isLastDay = trialInfo.daysRemaining === 0;
    const isWarning = trialInfo.daysRemaining <= 2;

    return (
      <Card className={`border-2 overflow-hidden ${isLastDay ? 'border-red-400 dark:border-red-500' : isWarning ? 'border-yellow-400 dark:border-yellow-500' : 'border-pink-300 dark:border-pink-400'}`}>
        <CardHeader className={`${
          isLastDay 
            ? 'bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20' 
            : isWarning 
              ? 'bg-gradient-to-r from-yellow-100 to-orange-50 dark:from-yellow-900/30 dark:to-orange-800/20' 
              : 'bg-gradient-to-r from-pink-100 via-pink-50 to-purple-50 dark:from-pink-900/30 dark:via-pink-800/20 dark:to-purple-900/20'
        }`}>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <div className={`p-2 rounded-full ${
                isLastDay ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-pink-500'
              }`}>
                {isLastDay ? (
                  <AlertTriangle className="h-5 w-5 text-white" />
                ) : isWarning ? (
                  <Clock className="h-5 w-5 text-white" />
                ) : (
                  <Gift className="h-5 w-5 text-white" />
                )}
              </div>
              <span className="font-bold">
                {isLastDay ? 'トライアル最終日' : isWarning ? 'トライアル残りわずか' : 'プレミアムトライアル中'}
              </span>
            </div>
            <Badge className={`font-bold px-3 py-1 ${
              isLastDay 
                ? 'bg-red-500 text-white dark:bg-red-600' 
                : isWarning 
                  ? 'bg-orange-500 text-white dark:bg-orange-600' 
                  : 'bg-pink-500 text-white dark:bg-pink-600'
            }`}>
              {trialInfo.daysUsed}日目 / 7日間
            </Badge>
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
            {trialInfo.message}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* 進捗バー */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 font-medium">
              <span>トライアル進捗</span>
              <span className={`font-bold ${isLastDay ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>
                残り{trialInfo.daysRemaining}日
              </span>
            </div>
            <Progress 
              value={progressPercentage} 
              className={`h-3 ${isLastDay ? 'bg-red-200 dark:bg-red-900/30' : isWarning ? 'bg-yellow-200 dark:bg-yellow-900/30' : 'bg-pink-200 dark:bg-pink-900/30'}`}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              期限: {trialInfo.expiresAt?.toLocaleDateString('ja-JP')} {trialInfo.expiresAt?.toLocaleTimeString('ja-JP')}
            </p>
          </div>

          <Separator className="dark:border-gray-700" />


          <Button 
            className={`w-full font-bold shadow-lg hover:shadow-xl transition-all text-white ${
              isLastDay 
                ? 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700' 
                : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600'
            }`}
            onClick={() => router.push('/subscription/upgrade')}
          >
            {isLastDay ? '今すぐプレミアムに登録' : 'プレミアム会員になる'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 有料会員（アクティブ）
  if (status === UserSubscriptionStatus.PREMIUM_ACTIVE && subscriptionInfo) {
    return (
      <Card className="border-2 border-pink-300 dark:border-pink-400">
        <CardHeader className="bg-gradient-to-r from-pink-50 via-purple-50 to-pink-50 dark:from-pink-900/20 dark:via-purple-900/20 dark:to-pink-900/20">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <div className="p-2 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold">プレミアム会員</span>
            </div>
            <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold">
              アクティブ
            </Badge>
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
            すべてのプレミアム機能をご利用いただけます
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">プラン</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">月額プラン ¥1,980/月</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Calendar className="h-4 w-4 text-pink-500" />
                次回更新日
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {subscriptionInfo.nextBillingDate?.toLocaleDateString('ja-JP')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <CreditCard className="h-4 w-4 text-pink-500" />
                支払い方法
              </span>
              <span className="text-gray-800 dark:text-gray-200">Visa ****1234</span>
            </div>
          </div>

          <Separator className="dark:border-gray-700" />

          <div className="space-y-3">
            <Button 
              variant="outline"
              className="w-full text-xl py-8 border-pink-300 hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20"
              onClick={() => router.push('/subscription/billing')}
            >
              <CreditCard className="h-6 w-6 mr-2" />
              支払い方法を変更
            </Button>
            <Button 
              variant="outline"
              className="w-full text-xl py-8 border-pink-300 hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20"
              onClick={() => router.push('/subscription/history')}
            >
              <Receipt className="h-6 w-6 mr-2" />
              請求履歴
            </Button>
            <Button 
              variant="outline"
              className="w-full text-xl py-8 border-red-300 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              onClick={() => router.push('/subscription/cancel')}
            >
              <XCircle className="h-6 w-6 mr-2" />
              プランを解約
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 有料会員（解約予定）
  if (status === UserSubscriptionStatus.PREMIUM_CANCELED && subscriptionInfo) {
    return (
      <>
        <Card className="border-2 border-orange-400 dark:border-orange-500">
          <CardHeader className="bg-orange-100 dark:bg-orange-900/30">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                解約予定
              </div>
              <Badge className="bg-orange-500 text-white dark:bg-orange-600">残り{subscriptionInfo.daysRemaining}日</Badge>
            </CardTitle>
            <CardDescription className="text-gray-700 dark:text-gray-300">
              {subscriptionInfo.cancelationDate?.toLocaleDateString('ja-JP')}にプレミアム会員が終了します
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-600 rounded-lg p-3">
              <p className="text-sm text-gray-800 dark:text-gray-200">
                解約日までは引き続きプレミアム機能をご利用いただけます。
              </p>
            </div>

            <Button 
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
              onClick={() => setShowReactivateModal(true)}
            >
              解約を取り消す
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Reactivate Modal */}
        {showReactivateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-pink-500" />
                  解約を取り消す
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  プレミアムプランの解約を取り消しますか？
                </p>
                <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-300 dark:border-pink-600 rounded-lg p-4">
                  <p className="text-sm text-pink-700 dark:text-pink-300">
                    解約を取り消すと、現在のプランが継続され、次回の請求日に自動更新されます。
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowReactivateModal(false)}
                  className="flex-1"
                  disabled={isReactivating}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleReactivate}
                  disabled={isReactivating}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                >
                  {isReactivating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  解約を取り消す
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </>
    );
  }

  // トライアル期限切れまたは無料会員
  return (
    <Card className="border-2 border-gray-300 dark:border-gray-600 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900">
        <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
          <div className="p-2 bg-gray-500 rounded-full">
            <User className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold">無料プラン</span>
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
          基本機能をご利用いただけます
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            プレミアム会員になると、より多くの機能をご利用いただけます。
          </p>
          <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full" />
              <span>無制限のいいね送信</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full" />
              <span>プロフィールの詳細閲覧</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full" />
              <span>高度な検索機能</span>
            </li>
          </ul>
        </div>
        <Button 
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold shadow-lg hover:shadow-xl transition-all"
          onClick={() => router.push('/subscription/upgrade')}
        >
          プレミアム会員になる
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}