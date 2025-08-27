"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  Gift,
  Crown,
  Check,
  Sparkles,
  Clock,
  Shield,
  Heart,
  Users,
  MessageCircle,
  Search,
  Star,
  ChevronRight,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';
import { UserSubscriptionStatus } from '@/types/subscription';
import Link from 'next/link';

const TRIAL_FEATURES = [
  {
    icon: Search,
    title: '無制限の検索',
    description: 'すべての検索フィルターを使用可能'
  },
  {
    icon: Heart,
    title: '無制限のいいね',
    description: '気になる相手に無制限でアプローチ'
  },
  {
    icon: MessageCircle,
    title: 'メッセージ機能',
    description: 'マッチした相手とメッセージ交換'
  },
  {
    icon: Users,
    title: 'プロフィール詳細閲覧',
    description: 'すべての情報を閲覧可能'
  },
  {
    icon: Star,
    title: '優先表示',
    description: '相手の検索結果で上位に表示'
  },
  {
    icon: Shield,
    title: 'プレミアムサポート',
    description: '優先的なカスタマーサポート'
  }
];

export default function TrialPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, currentUser } = useAuth();
  const { status, trialInfo, userSubscription, refreshSubscription } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // すでにトライアル使用済みまたはプレミアム会員の場合
  useEffect(() => {
    if (status === UserSubscriptionStatus.PREMIUM_ACTIVE) {
      toast({
        title: "すでにプレミアム会員です",
        description: "プレミアム機能をご利用いただけます。",
      });
      router.push('/profile');
    } else if (status === UserSubscriptionStatus.TRIAL_ACTIVE && trialInfo?.isActive) {
      toast({
        title: "トライアル実施中",
        description: `残り${trialInfo.daysRemaining}日間ご利用いただけます。`,
      });
      router.push('/profile');
    } else if (userSubscription?.trial?.hasUsed && status !== UserSubscriptionStatus.TRIAL_ACTIVE) {
      toast({
        title: "トライアルは既に使用済みです",
        description: "プレミアムプランへの登録をご検討ください。",
        variant: "destructive"
      });
      router.push('/subscription/upgrade');
    }
  }, [status, trialInfo, userSubscription, router, toast]);

  const handleStartTrial = async () => {
    if (!currentUser?.uid) {
      toast({
        title: "エラー",
        description: "ログインしてください。",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const db = getFirebaseDb();
      if (!db) throw new Error('Database not initialized');
      
      const userRef = doc(db, 'users', currentUser.uid);
      
      // Calculate trial dates
      const now = Timestamp.now();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // 7 days from now
      
      // Update user's trial status
      await updateDoc(userRef, {
        'trial.startDate': now,
        'trial.endDate': Timestamp.fromDate(endDate),
        'trial.isActive': true,
        'trial.hasUsed': true,
        'trial.source': 'web',
        'subscription.status': 'trial',
        'isPremium': true, // Give premium access during trial
        updatedAt: serverTimestamp()
      });

      // Refresh subscription data
      await refreshSubscription();

      toast({
        title: "トライアル開始！",
        description: "7日間すべてのプレミアム機能をお楽しみください。",
      });

      router.push('/profile');
    } catch (error) {
      console.error('Error starting trial:', error);
      toast({
        title: "エラー",
        description: "トライアルの開始中にエラーが発生しました。",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            7日間無料トライアル
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            すべてのプレミアム機能を無料でお試しください
          </p>
        </div>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-pink-300 dark:border-pink-400 overflow-hidden">
        <div className="bg-gradient-to-r from-pink-500 to-purple-500 p-1">
          <CardHeader className="bg-background rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full">
                  <Gift className="h-8 w-8 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl">期間限定オファー</CardTitle>
                  <CardDescription className="text-lg mt-1">
                    7日間無料ですべての機能を体験
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-lg px-4 py-2">
                無料
              </Badge>
            </div>
          </CardHeader>
        </div>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg">
              <Check className="h-5 w-5 text-green-500" />
              <span>クレジットカード不要</span>
            </div>
            <div className="flex items-center gap-2 text-lg">
              <Check className="h-5 w-5 text-green-500" />
              <span>自動更新なし</span>
            </div>
            <div className="flex items-center gap-2 text-lg">
              <Check className="h-5 w-5 text-green-500" />
              <span>いつでもキャンセル可能</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-pink-500" />
          トライアルで利用できる機能
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {TRIAL_FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                      <Icon className="h-5 w-5 text-pink-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Trial Period Info */}
      <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-300 dark:border-yellow-600">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                トライアル期間について
              </h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400">•</span>
                  <span>トライアル期間は開始から7日間です</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400">•</span>
                  <span>期間終了後は自動的に無料プランに戻ります</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400">•</span>
                  <span>トライアルは1アカウントにつき1回のみ利用可能です</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA Section */}
      <Card className="border-2 border-pink-300 dark:border-pink-400">
        <CardContent className="p-6 text-center">
          <Crown className="h-12 w-12 text-pink-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">
            今すぐトライアルを開始
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            7日間、すべてのプレミアム機能を無料でお試しください
          </p>
          <Button
            onClick={handleStartTrial}
            disabled={isProcessing}
            className="w-full md:w-auto px-8 py-6 text-lg bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                処理中...
              </>
            ) : (
              <>
                無料トライアルを開始
                <ChevronRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Alternative Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link href="/subscription">
          <Button variant="outline" className="w-full sm:w-auto">
            料金プランを見る
          </Button>
        </Link>
        <Link href="/profile">
          <Button variant="ghost" className="w-full sm:w-auto">
            後で決める
          </Button>
        </Link>
      </div>
    </div>
  );
}