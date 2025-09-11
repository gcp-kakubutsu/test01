"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  AlertTriangle,
  Heart,
  Shield,
  Calendar,
  Loader2,
  MessageCircle,
  Users,
  Search,
  Eye,
  ChevronRight,
  X
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';

// Firestore Timestamp / string / number / Date を安全に Date に変換
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
  } catch {
    return null;
  }
}

const CANCEL_REASONS = [
  { id: 'expensive', label: '料金が高い' },
  { id: 'not_using', label: 'あまり利用していない' },
  { id: 'found_partner', label: 'パートナーが見つかった' },
  { id: 'poor_quality', label: 'マッチングの質が良くない' },
  { id: 'technical', label: '技術的な問題がある' },
  { id: 'other', label: 'その他' }
];

const PREMIUM_FEATURES = [
  { icon: Search, label: 'キャスト検索機能', description: '男性会員はキャスト検索ができなくなります' },
  { icon: Eye, label: 'プロフィール写真', description: '写真にモザイクがかかり、顔が見えなくなります' },
  { icon: Users, label: 'マッチング機能', description: 'マッチング機能が制限されます' },
  { icon: MessageCircle, label: 'カスタマーサポート', description: '優先サポートが受けられなくなります' },
  { icon: Heart, label: '全ての基本機能', description: '一部の基本機能が制限されます' }
];

export default function CancelPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, currentUser } = useAuth();
  const { status, subscriptionInfo, userSubscription, refreshSubscription } = useSubscription();
  const [cancelReason, setCancelReason] = useState('');
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [registrationDate, setRegistrationDate] = useState<Date | null>(null);
  const [justCanceled, setJustCanceled] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Load registration date
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser?.uid) return;
      
      try {
        const db = getFirebaseDb();
        if (!db) return;
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        const startDate = toDateSafe(userData?.subscriptionStartDate);
        const createdAt = toDateSafe(userData?.createdAt);
        if (startDate) {
          setRegistrationDate(startDate);
        } else if (createdAt) {
          setRegistrationDate(createdAt);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [currentUser]);

  const handleCancelSubscription = async () => {
    if (!cancelReason) {
      toast({
        title: "解約理由を選択してください",
        variant: "destructive"
      });
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmCancellation = async () => {
    if (!currentUser?.uid) return;

    setIsProcessing(true);
    
    try {
      const db = getFirebaseDb();
      if (!db) throw new Error('Database not initialized');
      
      const userRef = doc(db, 'users', currentUser.uid);
      
      // Update subscription status
      await updateDoc(userRef, {
        'subscription.cancelAtPeriodEnd': true,
        'subscription.canceledAt': serverTimestamp(),
        'subscription.cancelReason': cancelReason,
        'subscription.cancelFeedback': additionalFeedback,
        updatedAt: serverTimestamp()
      });

      // Refresh subscription data
      await refreshSubscription();

      toast({
        title: "解約手続きが完了しました",
        description: "現在の請求期間終了まではプレミアム機能をご利用いただけます。",
      });

      // 解約完了後、解約キャンセル画面を表示するためにフラグを設定
      setJustCanceled(true);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast({
        title: "エラー",
        description: "解約処理中にエラーが発生しました。",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setShowConfirmModal(false);
    }
  };

  // Calculate days used
  const daysUsed = registrationDate 
    ? Math.floor((Date.now() - registrationDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // 解約予定の場合、または解約したばかりの場合は解約をキャンセルする画面を表示
  if (userSubscription?.cancellation?.cancelAtPeriodEnd || justCanceled) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
              解約予定のお知らせ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600 rounded-lg p-4">
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                現在、プレミアムプランの解約が予定されています。
              </p>
              {subscriptionInfo?.nextBillingDate && (
                <p className="font-semibold text-gray-800 dark:text-gray-200">
                  解約予定日: {subscriptionInfo.nextBillingDate.toLocaleDateString('ja-JP')}
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                この日まではプレミアム機能をご利用いただけます。
              </p>
            </div>
            
            <div className="space-y-3">
              <Button
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    const db = getFirebaseDb();
                    if (!db) throw new Error('Database not initialized');
                    
                    const userRef = doc(db, 'users', currentUser!.uid);
                    
                    // 解約をキャンセル
                    await updateDoc(userRef, {
                      'subscription.cancelAtPeriodEnd': false,
                      'subscription.canceledAt': null,
                      'subscription.cancelReason': null,
                      'subscription.cancelFeedback': null,
                      updatedAt: serverTimestamp()
                    });

                    // Refresh subscription data
                    await refreshSubscription();

                    toast({
                      title: "解約をキャンセルしました",
                      description: "プレミアムプランを継続してご利用いただけます。",
                    });

                    // justCanceledフラグをリセット
                    setJustCanceled(false);
                    
                    router.push('/profile#subscription');
                  } catch (error) {
                    console.error('Error canceling subscription cancellation:', error);
                    toast({
                      title: "エラー",
                      description: "処理中にエラーが発生しました。",
                      variant: "destructive"
                    });
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={isProcessing}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                解約をキャンセルして継続する
              </Button>
              
              <Button
                variant="outline"
                onClick={() => router.push('/profile#subscription')}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userSubscription?.isPremium) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">プレミアムプランに加入していません</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              現在無料プランをご利用中です
            </p>
            <Button onClick={() => router.push('/subscription/upgrade')}>
              プレミアムプランを見る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
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
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">プラン解約</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              プレミアムプランの解約手続き
            </p>
          </div>
        </div>

        {/* Warning Card */}
        <Card className="border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
              解約前のご確認
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg p-3 mb-4">
                <p className="text-orange-800 dark:text-orange-300 text-sm font-semibold">
                  ※ このサービスは男性会員様のみご利用いただけます
                </p>
              </div>
              <p className="text-yellow-700 dark:text-yellow-400 font-semibold mb-2">
                解約すると以下の機能が制限されます：
              </p>
              <div className="space-y-3">
                {PREMIUM_FEATURES.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <div className="p-1.5 bg-yellow-200 dark:bg-yellow-800 rounded">
                        <Icon className="h-4 w-4 text-yellow-700 dark:text-yellow-300" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {feature.label}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          → {feature.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {subscriptionInfo?.nextBillingDate && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-300 dark:border-yellow-600">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  次回請求日までは引き続きプレミアム機能をご利用いただけます
                </p>
                <p className="font-semibold text-gray-800 dark:text-gray-200 mt-1">
                  利用可能期限: {subscriptionInfo.nextBillingDate.toLocaleDateString('ja-JP')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Summary */}
        {registrationDate && (
          <Card>
            <CardHeader>
              <CardTitle>ご利用状況</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">プラン開始日</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {registrationDate.toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ご利用日数</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {daysUsed}日間
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancel Reason */}
        <Card>
          <CardHeader>
            <CardTitle>解約理由をお聞かせください</CardTitle>
            <CardDescription>
              サービス改善のため、ご意見をお聞かせください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={cancelReason} onValueChange={setCancelReason}>
              {CANCEL_REASONS.map((reason) => (
                <div key={reason.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.id} id={reason.id} />
                  <Label htmlFor={reason.id} className="cursor-pointer">
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {cancelReason === 'other' && (
              <Textarea
                placeholder="詳細をお聞かせください（任意）"
                value={additionalFeedback}
                onChange={(e) => setAdditionalFeedback(e.target.value)}
                className="mt-3"
                rows={4}
              />
            )}
          </CardContent>
        </Card>


        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex-1"
          >
            キャンセル
          </Button>
          <Button
            onClick={handleCancelSubscription}
            disabled={!cancelReason || isProcessing}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-2" />
            )}
            解約手続きを進める
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                最終確認
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                本当にプレミアムプランを解約しますか？
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-600 rounded-lg p-4">
                <p className="text-sm text-red-700 dark:text-red-300">
                  解約後も{subscriptionInfo?.nextBillingDate?.toLocaleDateString('ja-JP')}まではプレミアム機能をご利用いただけます。
                  その後は自動的に無料プランに移行されます。
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1"
                disabled={isProcessing}
              >
                やめる
              </Button>
              <Button
                onClick={confirmCancellation}
                disabled={isProcessing}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                解約を確定
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}