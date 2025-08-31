"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import {
  Crown,
  Calendar,
  AlertTriangle,
  CreditCard,
  Clock,
  Gift,
  Settings,
  ChevronRight,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Star,
  Zap
} from 'lucide-react';

interface SubscriptionStatusProps {
  className?: string;
  showActions?: boolean;
  compact?: boolean;
}

export function SubscriptionStatus({ 
  className, 
  showActions = true, 
  compact = false 
}: SubscriptionStatusProps) {
  const router = useRouter();
  const {
    subscription,
    isPremium,
    isExpired,
    hasActiveSubscription,
    canAccessPremiumFeatures,
    currentPlan,
    currentPlanName,
    planType,
    remainingDays,
    remainingHours,
    nextBillingDate,
    subscriptionExpiresAt,
    loading,
    error,
    getRemainingTime,
    isTrialActive,
    willRenew
  } = useSubscription();

  // ステータスバッジの設定
  const getStatusBadge = () => {
    if (loading) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          読み込み中
        </Badge>
      );
    }

    if (error || !subscription) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          エラー
        </Badge>
      );
    }

    if (isTrialActive()) {
      return (
        <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-800 border-blue-200">
          <Gift className="h-3 w-3" />
          無料トライアル中
        </Badge>
      );
    }

    if (isPremium && hasActiveSubscription) {
      return (
        <Badge variant="default" className="gap-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
          <Crown className="h-3 w-3" />
          プレミアム会員
        </Badge>
      );
    }

    if (isExpired) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          有効期限切れ
        </Badge>
      );
    }

    if (subscription?.subscription.status === 'past_due') {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          支払い遅延
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="gap-1">
        <Star className="h-3 w-3" />
        無料プラン
      </Badge>
    );
  };

  // 進捗バーの計算（トライアルまたはサブスクリプション期間）
  const getProgressInfo = () => {
    if (isTrialActive() && subscription?.trial.endDate) {
      const startDate = subscription.trial.startDate?.toDate();
      const endDate = subscription.trial.endDate.toDate();
      const now = new Date();
      
      if (startDate && endDate) {
        const total = endDate.getTime() - startDate.getTime();
        const elapsed = now.getTime() - startDate.getTime();
        const progress = Math.min(Math.max((elapsed / total) * 100, 0), 100);
        
        return {
          progress,
          label: 'トライアル期間',
          remaining: remainingDays || 0
        };
      }
    }

    if (subscriptionExpiresAt && subscription?.subscriptionBasic.startDate) {
      const startDate = subscription.subscriptionBasic.startDate.toDate();
      const endDate = subscriptionExpiresAt;
      const now = new Date();
      
      if (startDate && endDate) {
        const total = endDate.getTime() - startDate.getTime();
        const elapsed = now.getTime() - startDate.getTime();
        const progress = Math.min(Math.max((elapsed / total) * 100, 0), 100);
        
        return {
          progress,
          label: 'サブスクリプション期間',
          remaining: remainingDays || 0
        };
      }
    }

    return null;
  };

  const progressInfo = getProgressInfo();

  // 警告メッセージの表示
  const getWarningMessage = () => {
    if (subscription?.subscription.status === 'past_due') {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>決済が失敗しています</AlertTitle>
          <AlertDescription>
            お支払い方法を確認し、決済を完了してください。猶予期間を過ぎるとサービスのご利用ができなくなります。
          </AlertDescription>
        </Alert>
      );
    }

    if (isExpired && subscription?.cancellation.cancelAtPeriodEnd) {
      return (
        <Alert variant="default" className="mb-4 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800">サブスクリプションが終了しました</AlertTitle>
          <AlertDescription className="text-orange-700">
            サブスクリプションの有効期限が切れました。継続してご利用になる場合は、新しいプランをお選びください。
          </AlertDescription>
        </Alert>
      );
    }

    if (remainingDays !== null && remainingDays <= 3 && remainingDays > 0) {
      return (
        <Alert variant="default" className="mb-4 border-yellow-200 bg-yellow-50">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">まもなく期限切れです</AlertTitle>
          <AlertDescription className="text-yellow-700">
            あと{remainingDays}日でサブスクリプションが終了します。継続してご利用になる場合は更新手続きをお済ませください。
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  // アクションボタンの設定
  const getActionButtons = () => {
    if (!showActions) return null;

    const buttons: React.ReactNode[] = [];

    if (!hasActiveSubscription || planType === 'free') {
      buttons.push(
        <Button 
          key="upgrade" 
          onClick={() => router.push('/subscription/billing')}
          className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          <Zap className="h-4 w-4" />
          プレミアムにアップグレード
        </Button>
      );
    }

    if (hasActiveSubscription) {
      buttons.push(
        <Button 
          key="manage" 
          variant="outline" 
          onClick={() => router.push('/subscription/billing')}
          className="w-full sm:w-auto"
        >
          <Settings className="h-4 w-4" />
          サブスクリプション管理
        </Button>
      );
    }

    if (subscription?.subscription.status === 'past_due') {
      buttons.push(
        <Button 
          key="payment" 
          onClick={() => router.push('/subscription/billing')}
          className="w-full sm:w-auto"
        >
          <CreditCard className="h-4 w-4" />
          決済を完了する
        </Button>
      );
    }

    return buttons.length > 0 ? (
      <div className="flex flex-col sm:flex-row gap-2 pt-4">
        {buttons}
      </div>
    ) : null;
  };

  // エラー状態
  if (error) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>エラーが発生しました</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          {showActions && (
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="w-full mt-4"
            >
              再読み込み
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ローディング状態
  if (loading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">読み込み中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // コンパクト表示
  if (compact) {
    return (
      <div className={cn("flex items-center justify-between p-3 rounded-lg border bg-card", className)}>
        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          <span className="text-sm font-medium">{currentPlanName}</span>
        </div>
        {remainingDays !== null && (
          <span className="text-xs text-muted-foreground">
            残り{remainingDays}日
          </span>
        )}
      </div>
    );
  }

  // メイン表示
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">サブスクリプション状況</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {getWarningMessage()}
        
        {/* プラン情報 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isPremium ? (
                <Crown className="h-4 w-4 text-purple-600" />
              ) : (
                <Star className="h-4 w-4 text-gray-400" />
              )}
              <span className="font-medium">{currentPlanName}</span>
            </div>
            {currentPlan?.amount && currentPlan.amount > 0 && (
              <span className="text-sm text-muted-foreground">
                ¥{currentPlan.amount.toLocaleString()} / {
                  currentPlan.billingCycle === 'monthly' ? '月' :
                  currentPlan.billingCycle === 'quarterly' ? '3ヶ月' :
                  currentPlan.billingCycle === 'semiannual' ? '6ヶ月' :
                  currentPlan.billingCycle === 'annual' ? '年' : '回'
                }
              </span>
            )}
          </div>
          
          {/* 進捗バー */}
          {progressInfo && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progressInfo.label}</span>
                <span>残り{progressInfo.remaining}日</span>
              </div>
              <Progress 
                value={progressInfo.progress} 
                className="h-2"
              />
            </div>
          )}
          
          {/* 期限情報 */}
          {subscriptionExpiresAt && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                有効期限: {subscriptionExpiresAt.toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          )}
          
          {/* 次回決済日 */}
          {nextBillingDate && willRenew() && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span>
                次回決済: {nextBillingDate.toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          )}
        </div>
        
        {/* 機能一覧（プレミアムの場合） */}
        {isPremium && currentPlan?.features && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">ご利用可能な機能</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {currentPlan.features.slice(0, 4).map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* アクションボタン */}
        {getActionButtons()}
      </CardContent>
    </Card>
  );
}

export default SubscriptionStatus;