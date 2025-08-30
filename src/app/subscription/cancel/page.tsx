'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, Home, ArrowLeft, CreditCard } from 'lucide-react';

export default function PaymentCancelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/signin');
    }
  }, [currentUser, router]);

  const handleGoHome = () => {
    router.push('/');
  };

  const handleRetryPayment = () => {
    router.push('/subscription');
  };

  const handleGoBack = () => {
    router.back();
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center">
      <Card className="max-w-md w-full mx-4 border-orange-200">
        <CardHeader className="text-center pb-4">
          <XCircle className="w-16 h-16 text-orange-500 mx-auto" />
          <div className="mt-4">
            <CardTitle className="text-xl text-gray-900">
              お支払いがキャンセルされました
            </CardTitle>
            <CardDescription className="mt-2 text-gray-600">
              決済処理を中断しました。いつでも再度お試しいただけます。
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-orange-600" />
              <span className="font-semibold text-orange-900">お支払いはキャンセルされました</span>
            </div>
            <p className="text-sm text-orange-700">
              決済は実行されていませんので、ご安心ください。
              プレミアム機能をご利用になりたい場合は、再度お手続きをお願いいたします。
            </p>
          </div>

          {sessionId && (
            <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg">
              <p>セッションID: {sessionId}</p>
              <p className="mt-1">
                お問い合わせの際は、このセッションIDをお知らせください。
              </p>
            </div>
          )}

          <div className="space-y-3 pt-4">
            <Button
              onClick={handleRetryPayment}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              プランを選んで再試行
            </Button>
            
            <div className="flex gap-3">
              <Button
                onClick={handleGoBack}
                variant="outline"
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                戻る
              </Button>
              
              <Button
                onClick={handleGoHome}
                variant="outline"
                className="flex-1"
              >
                <Home className="w-4 h-4 mr-2" />
                ホーム
              </Button>
            </div>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">
              お困りのことがございましたら
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-pink-600 hover:text-pink-700"
              onClick={() => router.push('/support')}
            >
              サポートにお問い合わせ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}