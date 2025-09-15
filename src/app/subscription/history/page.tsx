"use client";

/**
 * @file サブスクリプション請求履歴ページ
 * @summary 支払い情報を Firestore の `payments`（および `nukune_payments`）から取得し、請求サマリーと明細を表示します。
 * @spec 主な仕様:
 * - ユーザードキュメントから現在のプランを解決（`subscription.plan` → `plan` → `subscriptionBasic.planType` → `free`）
 * - 月額料金の固定表示は行わず、直近の成功した支払い（1回分）の金額を動的に算出して表示
 * - `payments`（`userId == uid`、`createdAt` 降順）もしくは `nukune_payments` から合計件数・合計金額・明細を表示
 * @limits 制限事項:
 * - Firestore スキーマに依存。欠落データは可能な範囲で安全に処理します。
 * - 旧 `payment_history` 由来のレコードは本画面では使用しません（新 `payments` 優先）
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription as useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_CONSTANTS } from '@/types/subscription';
import { getPlanDisplayName, resolvePlanType } from '@/utils/planPricing';
import { useUser } from '@/hooks/useUser';
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
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
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
  const [isLoading, setIsLoading] = useState(true);
  const [registrationDate, setRegistrationDate] = useState<Date | null>(null);
  const [resolvedPlan, setResolvedPlan] = useState<typeof SUBSCRIPTION_CONSTANTS.PLAN_TYPES[keyof typeof SUBSCRIPTION_CONSTANTS.PLAN_TYPES]>(SUBSCRIPTION_CONSTANTS.PLAN_TYPES.FREE);
  const [payments, setPayments] = useState<Array<{ id: string; amount: number; status: 'succeeded' | 'failed' | 'pending' | 'canceled' | 'refunded'; paymentMethod: string; createdAt: Date; description?: string }>>([]);
  const [paymentsLoading, setPaymentsLoading] = useState<boolean>(true);
  const { getPaymentUid } = useUser();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // ユーザードキュメントから開始日/プランを取得
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

        // プラン解決: subscription.plan → plan → context.subscriptionBasic.planType → free
        const rawPlan = (userData as any)?.subscription?.plan ?? (userData as any)?.plan ?? userSubscription?.subscriptionBasic?.planType ?? SUBSCRIPTION_CONSTANTS.PLAN_TYPES.FREE;
        const normalized = resolvePlanType(rawPlan) ?? SUBSCRIPTION_CONSTANTS.PLAN_TYPES.FREE;
        setResolvedPlan(normalized);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser, userSubscription]);

  // 支払い履歴の取得優先順位
  // 1) nukune_payments（payment_uidで検索）
  // 2) フォールバック: payments（userId == uid, createdAt 降順）
  useEffect(() => {
    const fetchPayments = async () => {
      if (!currentUser?.uid) {
        setPayments([]);
        setPaymentsLoading(false);
        return;
      }
      try {
        setPaymentsLoading(true);
        const db = getFirebaseDb();
        if (!db) return;

        // 1) nukune_payments を payment_uid で検索
        const paymentUid = getPaymentUid();
        let nukunePayments: Array<{ id: string; amount: number; status: string; payment_method?: string; paymentMethod?: string; created_at?: any; processed_at?: any; createdAt?: any; description?: string }> = [];
        if (paymentUid) {
          try {
            const nukuneRef = collection(db, 'nukune_payments');
            // 可能なら created_at 降順で取得
            let nukuneSnap: any;
            try {
              const nukuneQuery = query(
                nukuneRef,
                where('payment_uid', '==', paymentUid),
                orderBy('created_at', 'desc')
              );
              nukuneSnap = await getDocs(nukuneQuery);
            } catch {
              // フィールド/インデックス不備時は orderBy なしで取得し、後でソート
              const nukuneQuery = query(
                nukuneRef,
                where('payment_uid', '==', paymentUid)
              );
              nukuneSnap = await getDocs(nukuneQuery);
            }
            nukunePayments = [];
            nukuneSnap.forEach((d: any) => {
              const data = d.data() as any;
              nukunePayments.push({ id: d.id, ...data });
            });
          } catch (e) {
            // 続行してフォールバックへ
            console.warn('Failed to fetch nukune_payments, falling back to payments:', e);
          }
        }

        // 正規化（優先: nukune_payments）
        let normalized: Array<{ id: string; amount: number; status: 'succeeded' | 'failed' | 'pending' | 'canceled' | 'refunded'; paymentMethod: string; createdAt: Date; description?: string }> = [];
        if (nukunePayments.length > 0) {
          const mapStatus = (s: string): 'succeeded' | 'failed' | 'pending' | 'canceled' | 'refunded' => {
            const v = String(s || '').toLowerCase();
            if (v === 'succeeded' || v === 'success' || v === 'ok' || v === 'completed') return 'succeeded';
            if (v === 'failed' || v === 'error') return 'failed';
            if (v === 'pending' || v === 'processing') return 'pending';
            if (v === 'canceled' || v === 'cancelled') return 'canceled';
            if (v === 'refunded' || v === 'refund') return 'refunded';
            return 'failed';
          };
          normalized = nukunePayments.map((p) => {
            const createdDate = toDateSafe(p.created_at) || toDateSafe(p.processed_at) || toDateSafe(p.createdAt) || new Date(0);
            return {
              id: p.id,
              amount: Number((p as any).amount || 0),
              status: mapStatus((p as any).status || ''),
              paymentMethod: (p.paymentMethod || p.payment_method || '-') as string,
              createdAt: createdDate || new Date(0),
              description: (p as any)?.description
            };
          });
          // 日時で降順ソート
          normalized.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else {
          // 2) フォールバック：payments から userId で取得
          const paymentsRef = collection(db, 'payments');
          let snap: any;
          try {
            const q1 = query(
              paymentsRef,
              where('userId', '==', currentUser.uid),
              orderBy('createdAt', 'desc')
            );
            snap = await getDocs(q1);
          } catch {
            const q2 = query(
              paymentsRef,
              where('userId', '==', currentUser.uid)
            );
            snap = await getDocs(q2);
          }
          const list: Array<any> = [];
          snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
          normalized = list.map((p) => ({
            id: p.id,
            amount: Number(p.amount || 0),
            status: (String(p.status || 'failed').toLowerCase() as any),
            paymentMethod: (p.paymentMethod || p.payment_method || '-') as string,
            createdAt: toDateSafe(p.createdAt) || new Date(0),
            description: p.description
          }));
          normalized.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        setPayments(normalized);
      } catch (e) {
        console.error('Error fetching payments:', e);
        setPayments([]);
      } finally {
        setPaymentsLoading(false);
      }
    };
    fetchPayments();
  }, [currentUser?.uid, getPaymentUid]);

  const handleDownloadInvoice = (paymentId: string) => {
    // In real implementation, this would download the invoice PDF
    console.log('Downloading invoice for:', paymentId);
  };

  const getStatusIcon = (status: 'succeeded' | 'failed' | 'pending' | 'canceled' | 'refunded') => {
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

  const getStatusLabel = (status: 'succeeded' | 'failed' | 'pending' | 'canceled' | 'refunded') => {
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

  if (subLoading || isLoading || paymentsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  // 直近の「成功」ステータスの支払い 1 回分の金額（ハードコーディングせず履歴から算出）
  const latestSucceededPaymentAmount: number | null = (() => {
    const latest = payments.find((p) => p.status === 'succeeded');
    return typeof latest?.amount === 'number' ? latest.amount : null;
  })();

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
                {getPlanDisplayName(resolvedPlan)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">一回の支払い金額</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">
                {latestSucceededPaymentAmount !== null
                  ? `¥${latestSucceededPaymentAmount.toLocaleString()}`
                  : '—'}
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
              {payments.filter(p => p.status === 'succeeded').length}回
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">総支払い金額</span>
            <span className="font-semibold text-xl text-pink-600 dark:text-pink-400">
              ¥{payments
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
          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>まだ支払い履歴がありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => {
                const date = payment.createdAt || new Date();
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
                            {payment.paymentMethod || '-'}
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