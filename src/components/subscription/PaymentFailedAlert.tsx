/**
 * Payment Failed Alert Component
 * Displays alerts for payment failures and grace period warnings
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  CreditCard, 
  Clock, 
  ExternalLink, 
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { 
  SubscriptionError, 
  isInGracePeriod, 
  getGracePeriodDaysRemaining 
} from '@/lib/errors/subscriptionErrors';

interface PaymentFailedAlertProps {
  error?: SubscriptionError | null;
  subscriptionEndDate?: Date | null;
  nextBillingDate?: Date | null;
  onRetry?: () => void;
  onUpdatePaymentMethod?: () => void;
  onContactSupport?: () => void;
  className?: string;
}

export function PaymentFailedAlert({
  error,
  subscriptionEndDate,
  nextBillingDate,
  onRetry,
  onUpdatePaymentMethod,
  onContactSupport,
  className
}: PaymentFailedAlertProps) {
  const router = useRouter();
  const isGracePeriod = isInGracePeriod(subscriptionEndDate ?? null);
  const graceDaysRemaining = getGracePeriodDaysRemaining(subscriptionEndDate ?? null);

  // If in grace period, show grace period alert
  if (isGracePeriod) {
    return (
      <Card className={cn("border-orange-200 bg-orange-50", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-500 rounded-full">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-orange-900">決済猶予期間中</CardTitle>
                <CardDescription className="text-orange-700">
                  お支払い処理を完了してください
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-orange-500 text-white">
              残り{graceDaysRemaining}日
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Grace period progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>猶予期間</span>
              <span className="font-medium">{graceDaysRemaining}/3日</span>
            </div>
            <Progress 
              value={(3 - graceDaysRemaining) / 3 * 100} 
              className="h-2"
            />
            <p className="text-xs text-orange-700">
              猶予期間終了後は、プレミアム機能がご利用いただけなくなります。
            </p>
          </div>

          {/* Error details if available */}
          {error && (
            <Alert className="border-orange-300 bg-orange-100">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>決済エラー:</strong> {error.userMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Next billing attempt */}
          {nextBillingDate && (
            <div className="flex items-center gap-2 text-sm text-orange-700 bg-white/50 rounded-lg p-3">
              <Calendar className="h-4 w-4" />
              <span>次回請求予定: {nextBillingDate.toLocaleDateString('ja-JP')}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button
              onClick={onUpdatePaymentMethod || (() => router.push('/subscription/billing'))}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              支払い方法を更新
            </Button>
            
            {onRetry && (
              <Button
                variant="outline"
                onClick={onRetry}
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                再試行
              </Button>
            )}
          </div>

          {/* Help section */}
          <div className="border-t border-orange-200 pt-4">
            <div className="flex items-center gap-2 text-sm text-orange-700 mb-2">
              <HelpCircle className="h-4 w-4" />
              <span className="font-medium">お困りの場合</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={onContactSupport || (() => router.push('/support'))}
                className="justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-100"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                サポートに問い合わせ
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open('/support/billing', '_blank')}
                className="justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-100"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                決済ヘルプを見る
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If there's a payment error but not in grace period, show error alert
  if (error) {
    const isRetryableError = error.retryable;
    
    return (
      <Card className={cn("border-red-200 bg-red-50", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-500 rounded-full">
              {error.category === 'network' ? (
                <RefreshCw className="h-5 w-5 text-white" />
              ) : (
                <XCircle className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <CardTitle className="text-red-900">決済処理が失敗しました</CardTitle>
              <CardDescription className="text-red-700">
                {error.category === 'payment' && 'お支払いに問題が発生しました'}
                {error.category === 'network' && 'ネットワーク接続に問題があります'}
                {error.category === 'auth' && '認証に問題があります'}
                {error.category === 'service' && 'サービスに問題があります'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error message */}
          <Alert className="border-red-300 bg-red-100">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error.userMessage}
            </AlertDescription>
          </Alert>

          {/* Specific error guidance */}
          {error.code === 'CARD_DECLINED' && (
            <div className="bg-white rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-red-900 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                解決方法
              </h4>
              <ul className="space-y-2 text-sm text-red-700">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  カード情報（番号、有効期限、セキュリティコード）をご確認ください
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  別のクレジットカードをお試しください
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  カード会社にお問い合わせください
                </li>
              </ul>
            </div>
          )}

          {error.code === 'INSUFFICIENT_FUNDS' && (
            <div className="bg-white rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-red-900 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                解決方法
              </h4>
              <ul className="space-y-2 text-sm text-red-700">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  カードの残高をご確認ください
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  別のクレジットカードをお試しください
                </li>
              </ul>
            </div>
          )}

          {error.category === 'network' && (
            <div className="bg-white rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-red-900 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                解決方法
              </h4>
              <ul className="space-y-2 text-sm text-red-700">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  インターネット接続をご確認ください
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  しばらく時間を置いてお試しください
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  ページを再読み込みしてください
                </li>
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {isRetryableError && onRetry && (
              <Button
                onClick={onRetry}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                再試行
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={onUpdatePaymentMethod || (() => router.push('/subscription/billing'))}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              支払い方法を変更
            </Button>
          </div>

          {/* Support section */}
          <div className="border-t border-red-200 pt-4">
            <div className="flex items-center gap-2 text-sm text-red-700 mb-2">
              <HelpCircle className="h-4 w-4" />
              <span className="font-medium">問題が解決しない場合</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onContactSupport || (() => router.push('/support'))}
              className="justify-start text-red-600 hover:text-red-700 hover:bg-red-100"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              サポートチームに問い合わせる
            </Button>
          </div>

          {/* Error code for debugging */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-red-600/60 font-mono bg-red-100 rounded p-2">
              エラーコード: {error.code} | カテゴリ: {error.category}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // If no error and no grace period, don't render anything
  return null;
}