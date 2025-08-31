'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentProcessor } from '@/lib/payment/transactionHub';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Clock, XCircle, Home, CreditCard } from 'lucide-react';

interface PaymentResult {
  status: 'completed' | 'processing' | 'failed' | 'unknown';
  message: string;
  subscriptionId?: string;
  planName?: string;
}

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const sessionId = searchParams.get('session_id');

  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!sessionId) {
        setPaymentResult({
          status: 'unknown',
          message: 'セッション情報が見つかりません。'
        });
        setLoading(false);
        return;
      }

      try {
        const status = await PaymentProcessor.checkPaymentStatus(sessionId);
        
        let result: PaymentResult;
        
        switch (status.status) {
          case 'completed':
            result = {
              status: 'completed',
              message: 'お支払いが正常に完了しました！',
              subscriptionId: status.subscription_id,
              planName: 'プレミアムプラン'
            };
            break;
            
          case 'pending':
            result = {
              status: 'processing',
              message: 'お支払い処理中です。しばらくお待ちください。'
            };
            break;
            
          case 'failed':
            result = {
              status: 'failed',
              message: status.failure_reason || 'お支払い処理に失敗しました。'
            };
            break;
            
          default:
            result = {
              status: 'unknown',
              message: '支払い状況を確認できませんでした。'
            };
        }
        
        setPaymentResult(result);
        
        // If still processing, check again after a delay
        if (status.status === 'pending') {
          setTimeout(() => {
            checkPaymentStatus();
          }, 3000);
        }
        
      } catch (error) {
        console.error('Failed to check payment status:', error);
        setPaymentResult({
          status: 'unknown',
          message: '支払い状況の確認中にエラーが発生しました。'
        });
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      checkPaymentStatus();
    }
  }, [sessionId, currentUser]);

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/signin');
    }
  }, [currentUser, router]);

  const handleGoHome = () => {
    router.push('/');
  };

  const handleViewSubscription = () => {
    router.push('/subscription');
  };

  if (!currentUser) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-48 mx-auto mb-2" />
            <Skeleton className="h-6 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (paymentResult?.status) {
      case 'completed':
        return <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />;
      case 'processing':
        return <Clock className="w-16 h-16 text-yellow-500 mx-auto animate-pulse" />;
      case 'failed':
        return <XCircle className="w-16 h-16 text-red-500 mx-auto" />;
      default:
        return <XCircle className="w-16 h-16 text-gray-500 mx-auto" />;
    }
  };

  const getStatusBadge = () => {
    switch (paymentResult?.status) {
      case 'completed':
        return <Badge className="bg-green-500 text-white">完了</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-500 text-white">処理中</Badge>;
      case 'failed':
        return <Badge className="bg-red-500 text-white">失敗</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white">不明</Badge>;
    }
  };

  const getStatusColor = () => {
    switch (paymentResult?.status) {
      case 'completed':
        return 'border-green-200';
      case 'processing':
        return 'border-yellow-200';
      case 'failed':
        return 'border-red-200';
      default:
        return 'border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center">
      <Card className={`max-w-md w-full mx-4 ${getStatusColor()}`}>
        <CardHeader className="text-center pb-4">
          {getStatusIcon()}
          <div className="mt-4">
            <div className="flex justify-center mb-2">
              {getStatusBadge()}
            </div>
            <CardTitle className="text-xl text-gray-900">
              {paymentResult?.status === 'completed' ? 'お支払い完了' :
               paymentResult?.status === 'processing' ? '処理中' :
               paymentResult?.status === 'failed' ? 'お支払い失敗' :
               '状態確認'}
            </CardTitle>
            <CardDescription className="mt-2 text-gray-600">
              {paymentResult?.message}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {paymentResult?.status === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-green-900">ご購入ありがとうございます</span>
              </div>
              <p className="text-sm text-green-700">
                {paymentResult.planName}をご購入いただき、ありがとうございます。
                すぐにプレミアム機能をご利用いただけます。
              </p>
              {paymentResult.subscriptionId && (
                <p className="text-xs text-green-600 mt-2">
                  サブスクリプションID: {paymentResult.subscriptionId}
                </p>
              )}
            </div>
          )}

          {paymentResult?.status === 'processing' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-yellow-600 animate-pulse" />
                <span className="font-semibold text-yellow-900">処理中</span>
              </div>
              <p className="text-sm text-yellow-700">
                お支払い処理を確認しています。完了まで数分かかる場合があります。
              </p>
            </div>
          )}

          {paymentResult?.status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="font-semibold text-red-900">お支払いに失敗しました</span>
              </div>
              <p className="text-sm text-red-700">
                お支払い処理中にエラーが発生しました。再度お試しいただくか、
                サポートまでお問い合わせください。
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleGoHome}
              variant="outline"
              className="flex-1"
            >
              <Home className="w-4 h-4 mr-2" />
              ホームに戻る
            </Button>
            
            {paymentResult?.status === 'completed' && (
              <Button
                onClick={handleViewSubscription}
                className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
              >
                サブスクリプション確認
              </Button>
            )}
            
            {paymentResult?.status === 'failed' && (
              <Button
                onClick={() => router.push('/subscription')}
                className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
              >
                再試行
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}