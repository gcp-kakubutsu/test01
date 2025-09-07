"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { redirectToTelecomCredit } from '@/utils/telecomCreditPayment';
import { useUser } from '@/hooks/useUser';
import styles from './upgrade.module.scss';

const PLAN_OPTIONS = [
  {
    id: '1month',
    name: '1ヶ月プラン',
    price: 1980,
    monthlyPrice: 1980,
    originalPrice: 3480,
    discount: 0,
    badge: '期間限定！',
    specialOffer: '3,480円が期間限定で1,980円に！',
    features: [
      '全ての基本機能',
      'プロフィール閲覧',
      'マッチング機能',
      'カスタマーサポート',
    ]
  },
  {
    id: '3month',
    name: '3ヶ月プラン',
    price: 4650,
    monthlyPrice: 1550,
    originalPrice: 10440,
    discount: 56,
    badge: '少しお得',
    features: [
      '全ての基本機能',
      'プロフィール閲覧',
      'マッチング機能',
      'カスタマーサポート',
    ]
  },
  {
    id: '6month',
    name: '6ヶ月プラン',
    price: 8100,
    monthlyPrice: 1350,
    originalPrice: 20880,
    discount: 62,
    popular: true,
    badge: '一番人気！',
    features: [
      '全ての基本機能',
      'プロフィール閲覧',
      'マッチング機能',
      'カスタマーサポート',
    ]
  },
  {
    id: '12month',
    name: '12ヶ月プラン',
    price: 13800,
    monthlyPrice: 1150,
    originalPrice: 41760,
    discount: 67,
    badge: '一番お得！',
    features: [
      '全ての基本機能',
      'プロフィール閲覧',
      'マッチング機能',
      'カスタマーサポート',
    ]
  }
];

function UpgradeContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { getPaymentUid, generatePaymentUid, hasPaymentUid } = useUser();
  
  const [selectedPlan, setSelectedPlan] = useState('6month');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const plan = searchParams.get('plan');
    const ageConfirm = searchParams.get('age_confirm');
    
    // If age confirmation is required, show alert
    if (ageConfirm === 'required') {
      alert('このサービスは18歳以上の方のみご利用いただけます。\n18歳以上の場合は続行してください。');
    }
    
    if (plan && PLAN_OPTIONS.some(p => p.id === plan)) {
      setSelectedPlan(plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回マウント時のみ実行

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handlePaymentButtonClick = async () => {
    if (!currentUser) {
      toast({
        title: "ログインが必要です",
        description: "決済を行うにはログインしてください。",
        variant: "destructive",
      });
      router.push('/login');
      return;
    }

    // 年齢確認の確認
    const confirmed = window.confirm(
      "このサービスは18歳以上の方のみご利用いただけます。\n" +
      "18歳以上であることを確認して、決済画面へ進みますか？"
    );

    if (!confirmed) {
      return;
    }

    setIsProcessing(true);
    
    try {
      // payment_uidの取得または生成
      let paymentUid = getPaymentUid();
      
      if (!paymentUid) {
        toast({
          title: "決済情報を準備中...",
          description: "初回決済の準備をしています。",
        });
        
        // payment_uidがない場合は生成
        paymentUid = await generatePaymentUid();
        
        if (!paymentUid) {
          throw new Error('Payment UID の生成に失敗しました');
        }
      }
      
      toast({
        title: "決済画面へ移動中...",
        description: "Telecom Creditの決済画面へ移動します。",
      });

      // Telecom Credit決済画面へ遷移（payment_uidを使用）
      redirectToTelecomCredit({
        planId: selectedPlan as '1month' | '3month' | '6month' | '12month',
        userId: paymentUid, // payment_uidを使用
        userEmail: currentUser.email || '',
        userName: currentUser.displayName || undefined
      });
    } catch (error) {
      console.error('Payment redirect failed:', error);
      setIsProcessing(false);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "決済画面への移動に失敗しました。",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={styles.subscriptionPage}>
      <div className={styles.container}>
        {/* Page Header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>
            <span className={styles.titleLine1}>NUKUNE 利用料金</span>
            <span className={styles.titleLine2}>（男性会員様）</span>
          </h1>
          <p className={styles.pageSubtitle}>
            NUKUNEは登録無料でお使いいただけます。<br />
            ただし、良質な出会いを提供するため、男性会員様のキャスト検索機能は<br />
            月額定額制の有料プランで提供しています。
          </p>
        </div>

        {/* 共通機能表示 */}
        <div className={styles.commonFeatures}>
          <h3 className={styles.commonFeaturesTitle}>料金プラン</h3>
          <div className={styles.featuresBox}>
            <div className={styles.featureItem}>
              <span className={styles.checkIcon}>✓</span>
              <span>全ての基本機能</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkIcon}>✓</span>
              <span>プロフィール閲覧</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkIcon}>✓</span>
              <span>マッチング機能</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkIcon}>✓</span>
              <span>カスタマーサポート</span>
            </div>
          </div>
        </div>

        {/* Plan Selection */}
        <div className={styles.plansGrid}>
          {PLAN_OPTIONS.map((plan) => (
            <Card 
              key={plan.id}
              className={`${styles.planCard} ${selectedPlan === plan.id ? styles.selected : ''} ${plan.popular ? styles.popular : ''}`}
              onClick={() => handlePlanSelect(plan.id)}
            >
              {plan.badge && (
                <div className={styles.planBadge}>{plan.badge}</div>
              )}
              <CardContent className={styles.planContent}>
                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.priceContainer}>
                  <div className={styles.priceWrapper}>
                    <span className={styles.priceLabel}>月額</span>
                    <div className={styles.currentPrice}>
                      <span className={styles.currency}>¥</span>
                      <span className={styles.amount}>{plan.monthlyPrice.toLocaleString()}</span>
                    </div>
                    <span className={styles.priceTax}>円/月</span>
                  </div>
                  <div className={styles.priceTaxLabel}>（税込）</div>
                  <div className={styles.totalPrice}>（一括{plan.price.toLocaleString()}円）</div>
                  {plan.specialOffer && (
                    <div className={styles.specialOffer}>{plan.specialOffer}</div>
                  )}
                  {plan.discount > 0 && (
                    <div className={styles.discountBadge}>
                      最大{plan.discount}%お得なプラン
                    </div>
                  )}
                </div>
                {selectedPlan === plan.id && (
                  <div className={styles.selectedIndicator}>
                    <Check className={styles.selectedCheck} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Continue Button */}
        <div className={styles.continueSection}>
          <Button
            className={styles.continueButton}
            onClick={handlePaymentButtonClick}
            size="lg"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                決済画面へ移動中...
              </>
            ) : (
              'お支払い情報を入力する'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <UpgradeContent />
    </Suspense>
  );
}