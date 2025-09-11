"use client";

/**
 * @file サブスクリプション請求履歴ページ
 * @summary Firebase の `payment_history` コレクションから実データを取得して表示します。
 * @spec 主な仕様:
 * - `usePaymentHistory` フックで現在ユーザーの履歴を読み込み
 * - ステータス/金額/支払い方法/処理日時を表示
 * @limits 制限事項:
 * - Firestore スキーマに依存。欠落データは可能な範囲で安全に処理します。
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription as useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { useSubscription as useSubscriptionHook } from '@/hooks/useSubscription';
import { usePaymentHistory } from '@/hooks/usePayment';
import type { PaymentHistoryEntry } from '@/types/user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft,
  Receipt,
  Download,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileText
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';

// このページでは `PaymentHistoryEntry` 型（`payment_history` の実データ）を使用します。

// Firestore Timestamp / string / number / Date を安全に Date に変換
// - Timestamp: .toDate() があれば使用
// - string: new Date(string)
// - number: UNIX epoch ms として扱う
// - Date: そのまま返す
// - 不明/無効: null を返す
function toDateSafe(value: any): Date | null {
  try {
    if (!value) return null;
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      const d = value.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'number') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const { isAuthenticated, currentUser } = useAuth();
  const { userSubscription, isLoading: subLoading } = useSubscriptionContext();
  const { paymentHistory, loading: historyLoading } = usePaymentHistory(50);
  const { getPlanInfo, formatPlanName, planType: defaultPlanType, loading: planLoading } = useSubscriptionHook();
  const [isLoading, setIsLoading] = useState(true);
  const [registrationDate, setRegistrationDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // ユーザー登録日のみを取得（履歴はフックが担当）
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.uid) return;
      
      setIsLoading(true);
      try {
        const db = getFirebaseDb();
        if (!db) return;
        
        // 登録日候補を取得
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        // Check for registration dates (accept Timestamp | string | number | Date)
        const startDate = toDateSafe(userData?.subscriptionStartDate);
        const createdAt = toDateSafe(userData?.createdAt);
        if (startDate) {
          setRegistrationDate(startDate);
        } else if (createdAt) {
          setRegistrationDate(createdAt);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser, userSubscription]);

  const handleDownloadInvoice = (paymentId: string) => {
    // In real implementation, this would download the invoice PDF
    console.log('Downloading invoice for:', paymentId);
  };

  const getStatusIcon = (status: PaymentHistoryEntry['status']) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'canceled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'refunded':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: PaymentHistoryEntry['status']) => {
    switch (status) {
      case 'succeeded':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">完了</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">処理中</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">失敗</Badge>;
      case 'canceled':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300">キャンセル</Badge>;
      case 'refunded':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">返金</Badge>;
      default:
        return null;
    }
  };

  if (subLoading || planLoading || isLoading || historyLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">請求履歴</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            お支払い履歴の確認
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="border-pink-200 dark:border-pink-800">
        <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-pink-500" />
            請求サマリー
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">現在のプラン</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">
                {(() => {
                  const planCode = (userSubscription as any)?.subscription?.plan || (userSubscription as any)?.plan || defaultPlanType;
                  return formatPlanName(planCode as any);
                })()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">月額料金</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">
                {(() => {
                  const planCode = (userSubscription as any)?.subscription?.plan || (userSubscription as any)?.plan || defaultPlanType;
                  const info = getPlanInfo(planCode as any);
                  const amount = info?.amount ?? 0;
                  return `¥${amount.toLocaleString()}`;
                })()}
              </p>
            </div>
          </div>
          
          {registrationDate && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">サービス開始日</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">
                {registrationDate.toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}
          
          <Separator className="dark:border-gray-700" />
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">総支払い回数</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {paymentHistory.filter(p => p.status === 'succeeded').length}回
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">総支払い金額</span>
            <span className="font-semibold text-xl text-pink-600 dark:text-pink-400">
              ¥{paymentHistory
                .filter(p => p.status === 'succeeded')
                .reduce((sum, p) => sum + (p.amount || 0), 0)
                .toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-pink-500" />
            支払い履歴
          </CardTitle>
          <CardDescription>
            過去のお支払い記録
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>まだ支払い履歴がありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentHistory.map((payment) => {
                const date = toDateSafe(payment.processed_at) || toDateSafe(payment.created_at) || new Date();
                return (
                  <div
                    key={payment.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(payment.status)}
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {payment.description || 'プレミアムプラン'}
                          </span>
                          {getStatusLabel(payment.status)}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <Calendar className="h-3 w-3" />
                            {date.toLocaleDateString('ja-JP')}
                          </div>
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <CreditCard className="h-3 w-3" />
                            {payment.payment_method}
                          </div>
                          <div className="font-semibold text-gray-800 dark:text-gray-200">
                            ¥{(payment.amount || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            請求に関するご質問がある場合は、
            <Button
              variant="link"
              className="text-blue-600 dark:text-blue-400 p-0 h-auto"
              onClick={() => router.push('/support')}
            >
              サポートセンター
            </Button>
            までお問い合わせください。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}