'use client';

import React, { useState, useEffect } from 'react';
import { usePayment, usePaymentHistory, usePaymentStats } from '@/hooks/usePayment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Download,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentHistoryEntry, PaymentStats } from '@/types/user';

interface PaymentHistoryProps {
  className?: string;
  showStats?: boolean;
  limit?: number;
  compact?: boolean;
}

/**
 * 決済履歴表示コンポーネント
 * 決済履歴の一覧表示と統計情報を提供
 */
export function PaymentHistory({ 
  className, 
  showStats = true, 
  limit = 20,
  compact = false 
}: PaymentHistoryProps) {
  const { paymentHistory, loading, error, refresh } = usePaymentHistory(limit);
  const { paymentStats, loading: statsLoading } = usePaymentStats();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // フィルタリングされた履歴
  const filteredHistory = paymentHistory.filter(payment => 
    filterStatus === 'all' || payment.status === filterStatus
  );

  // 決済ステータスに応じたバッジの色を取得
  const getStatusBadgeVariant = (status: PaymentHistoryEntry['status']) => {
    switch (status) {
      case 'succeeded':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'secondary';
      case 'canceled':
        return 'outline';
      case 'refunded':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // 決済ステータスのラベルを取得
  const getStatusLabel = (status: PaymentHistoryEntry['status']) => {
    switch (status) {
      case 'succeeded':
        return '成功';
      case 'failed':
        return '失敗';
      case 'pending':
        return '処理中';
      case 'canceled':
        return 'キャンセル';
      case 'refunded':
        return '返金';
      default:
        return status;
    }
  };

  // 決済方法のラベルを取得
  const getPaymentMethodLabel = (method: PaymentHistoryEntry['payment_method']) => {
    switch (method) {
      case 'credit_card':
        return 'クレジットカード';
      case 'bank_transfer':
        return '銀行振込';
      case 'digital_wallet':
        return 'デジタルウォレット';
      case 'other':
        return 'その他';
      default:
        return method;
    }
  };

  // 金額フォーマット
  const formatAmount = (amount: number, currency: string = 'JPY') => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // エラー表示
  if (error) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            再読み込み
          </Button>
        </CardContent>
      </Card>
    );
  }

  // コンパクト表示
  if (compact) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            最近の決済
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              決済履歴がありません
            </p>
          ) : (
            <div className="space-y-2">
              {filteredHistory.slice(0, 3).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {formatAmount(payment.amount, payment.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.processed_at?.toDate?.()?.toLocaleDateString() || '日付不明'}
                    </p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(payment.status)} className="text-xs">
                    {getStatusLabel(payment.status)}
                  </Badge>
                </div>
              ))}
              {filteredHistory.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  他 {filteredHistory.length - 3}件
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // フル表示
  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* 統計情報カード */}
      {showStats && paymentStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">総決済回数</p>
                  <p className="text-2xl font-bold">{paymentStats.total_payments}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">成功率</p>
                  <p className="text-2xl font-bold">
                    {paymentStats.total_payments > 0 
                      ? Math.round((paymentStats.successful_payments / paymentStats.total_payments) * 100)
                      : 0}%
                  </p>
                </div>
                {paymentStats.successful_payments >= paymentStats.failed_payments ? (
                  <TrendingUp className="h-8 w-8 text-green-500" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">累計金額</p>
                  <p className="text-2xl font-bold">
                    {formatAmount(paymentStats.total_amount)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 決済履歴カード */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                決済履歴
              </CardTitle>
              <CardDescription>
                過去の決済記録と詳細情報
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {/* フィルターボタン */}
              <div className="flex items-center gap-1">
                <Button 
                  variant={filterStatus === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                >
                  すべて
                </Button>
                <Button 
                  variant={filterStatus === 'succeeded' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilterStatus('succeeded')}
                >
                  成功
                </Button>
                <Button 
                  variant={filterStatus === 'failed' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilterStatus('failed')}
                >
                  失敗
                </Button>
              </div>
              
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {loading && paymentHistory.length === 0 ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[150px]" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {filterStatus === 'all' ? '決済履歴がありません' : `${getStatusLabel(filterStatus as any)}の決済履歴がありません`}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] w-full">
              <div className="space-y-4">
                {filteredHistory.map((payment, index) => (
                  <React.Fragment key={payment.id}>
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium truncate">
                              {payment.description || `決済 #${payment.id.slice(-8)}`}
                            </p>
                            <p className="text-sm font-semibold">
                              {formatAmount(payment.amount, payment.currency)}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {getPaymentMethodLabel(payment.payment_method)} • {' '}
                              {payment.processed_at?.toDate?.()?.toLocaleString() || '日時不明'}
                            </span>
                            <Badge variant={getStatusBadgeVariant(payment.status)} className="text-xs">
                              {getStatusLabel(payment.status)}
                            </Badge>
                          </div>
                          
                          {payment.error_message && (
                            <p className="text-xs text-red-500 mt-1 truncate">
                              エラー: {payment.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {index < filteredHistory.length - 1 && <Separator />}
                  </React.Fragment>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {filteredHistory.length >= limit && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" size="sm">
                さらに読み込む
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 決済統計のみを表示する軽量コンポーネント
 */
export function PaymentStatsCard({ className }: { className?: string }) {
  const { paymentStats, loading, error } = usePaymentStats();

  if (error || !paymentStats) {
    return null;
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          決済統計
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">総決済回数</span>
              <span className="font-semibold">{paymentStats.total_payments}回</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">成功率</span>
              <span className="font-semibold">
                {paymentStats.total_payments > 0 
                  ? Math.round((paymentStats.successful_payments / paymentStats.total_payments) * 100)
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">累計金額</span>
              <span className="font-semibold">
                ¥{paymentStats.total_amount.toLocaleString()}
              </span>
            </div>
            {paymentStats.average_amount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">平均金額</span>
                <span className="font-semibold">
                  ¥{Math.round(paymentStats.average_amount).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}