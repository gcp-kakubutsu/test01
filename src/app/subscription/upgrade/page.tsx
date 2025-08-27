"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, MapPin, Lock, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DocumentModal from '@/components/DocumentModal';
import { TERMS_CONTENT, PRIVACY_CONTENT } from '@/utils/documents';
import styles from './upgrade.module.scss';

interface PlanConfig {
  name: string;
  originalPrice: number;
  discountAmount: number;
  discountText: string;
  subtotal: number;
  tax: number;
  total: number;
}

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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedPlan, setSelectedPlan] = useState('6month');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  
  const [planConfig, setPlanConfig] = useState<PlanConfig>({
    name: '6ヶ月プラン',
    originalPrice: 8100,
    discountAmount: 0,
    discountText: '',
    subtotal: 8100,
    tax: 0,
    total: 8100
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    cardName: '',
    email: '',
    firstName: '',
    lastName: '',
    postalCode: '',
    prefecture: '',
    city: '',
    address: '',
    termsAccepted: false,
    ageConfirmed: false
  });
  
  const [cardDisplay, setCardDisplay] = useState('•••• •••• •••• ••••');
  const [cardBrand, setCardBrand] = useState('CARD');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  
  // Document modal states
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);

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
      updatePlanConfig(plan);
    } else if (!plan) {
      // URLパラメータがない場合はselectedPlanの初期値（6month）を使用
      updatePlanConfig(selectedPlan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回マウント時のみ実行

  const updatePlanConfig = (plan: string) => {
    switch(plan) {
      case '1month':
        setPlanConfig({
          name: '1ヶ月プラン',
          originalPrice: 1980,
          discountAmount: 0,
          discountText: '',
          subtotal: 1980,
          tax: 0,
          total: 1980
        });
        break;
      case '3month':
        setPlanConfig({
          name: '3ヶ月プラン',
          originalPrice: 4650,
          discountAmount: 0,
          discountText: '',
          subtotal: 4650,
          tax: 0,
          total: 4650
        });
        break;
      case '12month':
        setPlanConfig({
          name: '12ヶ月プラン',
          originalPrice: 13800,
          discountAmount: 0,
          discountText: '',
          subtotal: 13800,
          tax: 0,
          total: 13800
        });
        break;
      default:
        setPlanConfig({
          name: '6ヶ月プラン',
          originalPrice: 8100,
          discountAmount: 0,
          discountText: '',
          subtotal: 8100,
          tax: 0,
          total: 8100
        });
    }
  };

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    updatePlanConfig(planId);
  };

  const handleCardNumberChange = (value: string) => {
    const cleaned = value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    const limited = formatted.substring(0, 19);
    
    setFormData(prev => ({ ...prev, cardNumber: limited }));
    
    // Update card display
    const displayValue = limited.padEnd(19, '•').replace(/(.{4})/g, '$1 ').trim();
    setCardDisplay(displayValue || '•••• •••• •••• ••••');
    
    // Detect card brand
    const firstDigit = cleaned.charAt(0);
    if (firstDigit === '4') {
      setCardBrand('VISA');
    } else if (firstDigit === '5' || firstDigit === '2') {
      setCardBrand('MASTERCARD');
    } else if (firstDigit === '3') {
      setCardBrand('AMEX');
    } else {
      setCardBrand('CARD');
    }
  };

  const handleExpiryChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length >= 2) {
      formatted = cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    setFormData(prev => ({ ...prev, expiry: formatted }));
  };

  const handlePostalCodeChange = async (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 3) {
      formatted = cleaned.substring(0, 3) + '-' + cleaned.substring(3, 7);
    }
    setFormData(prev => ({ ...prev, postalCode: formatted }));
    
    // Auto search address when complete
    if (cleaned.length === 7) {
      setIsLoadingAddress(true);
      
      try {
        // Use our internal API route to avoid CORS issues
        const response = await fetch(`/api/zipcode?zipcode=${cleaned}`);
        const data = await response.json();
        
        if (response.ok && data.prefecture) {
          setFormData(prev => ({
            ...prev,
            prefecture: data.prefecture,
            city: data.city,
            address: data.address
          }));
        } else {
          toast({
            title: "郵便番号エラー",
            description: data.error || "郵便番号が見つかりませんでした。",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Address search error:', error);
        toast({
          title: "エラー",
          description: "住所の検索中にエラーが発生しました。",
          variant: "destructive",
        });
      } finally {
        setIsLoadingAddress(false);
      }
    }
  };

  const handleTermsCheckboxChange = (checked: boolean) => {
    if (checked && (!hasReadTerms || !hasReadPrivacy)) {
      // Prevent checking if documents haven't been read
      toast({
        title: "ご確認ください",
        description: "利用規約とプライバシーポリシーを最後までお読みください。",
        variant: "destructive",
      });
      return;
    }
    setFormData(prev => ({ ...prev, termsAccepted: checked }));
  };

  const handleTermsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowTermsModal(true);
  };

  const handlePrivacyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowPrivacyModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const requiredFields = [
      'cardNumber', 'expiry', 'cvv', 'cardName',
      'email', 'firstName', 'lastName', 'postalCode',
      'prefecture', 'city', 'address'
    ];
    
    const isValid = requiredFields.every(field => formData[field as keyof typeof formData]);
    
    if (!isValid || !formData.termsAccepted || !formData.ageConfirmed) {
      toast({
        title: "入力エラー",
        description: "必要な項目をすべて入力してください。",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      toast({
        title: "決済完了",
        description: "決済が完了しました！ありがとうございます。",
      });
      router.push('/profile');
    }, 2000);
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

        {/* Show Plan Selection or Payment Form */}
        {!showPaymentForm ? (
          <>
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
                onClick={() => setShowPaymentForm(true)}
                size="lg"
              >
                お支払い情報を入力する
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Progress Steps */}
            <div className={styles.progressContainer}>
              <div className={styles.progressSteps}>
                <div className={`${styles.step} ${styles.completed}`}>
                  <div className={styles.stepNumber}>1</div>
                  <div className={styles.stepText}>プラン選択</div>
                </div>
                <div className={styles.stepConnector}></div>
                <div className={`${styles.step} ${styles.active}`}>
                  <div className={styles.stepNumber}>2</div>
                  <div className={styles.stepText}>お支払い情報</div>
                </div>
                <div className={styles.stepConnector}></div>
                <div className={styles.step}>
                  <div className={styles.stepNumber}>3</div>
                  <div className={styles.stepText}>完了</div>
                </div>
              </div>
            </div>

            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => setShowPaymentForm(false)}
              className={styles.backButton}
            >
              ← プラン選択に戻る
            </Button>

            {/* Payment Layout */}
            <div className={styles.paymentLayout}>
              {/* Payment Form */}
              <Card className={styles.paymentFormContainer}>
                <CardContent className="p-0">
                  <form onSubmit={handleSubmit}>
                    {/* Card Information */}
                    <div className={styles.formSection}>
                      <h2 className={styles.sectionTitle}>
                        <CreditCard className={styles.sectionIcon} />
                        カード情報
                      </h2>

                      {/* Card Preview */}
                      <div className={styles.cardPreview}>
                        <div className={styles.cardBrand}>{cardBrand}</div>
                        <div className={styles.cardNumberDisplay}>{cardDisplay}</div>
                        <div className={styles.cardDetails}>
                          <div className={styles.cardHolder}>
                            <div>CARD HOLDER</div>
                            <div>{formData.cardName.toUpperCase() || 'YOUR NAME'}</div>
                          </div>
                          <div className={styles.cardExpiry}>
                            <div>VALID THRU</div>
                            <div>{formData.expiry || 'MM/YY'}</div>
                          </div>
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <Label htmlFor="card-number">
                          カード番号 <span className={styles.required}>*</span>
                        </Label>
                        <Input
                          id="card-number"
                          value={formData.cardNumber}
                          onChange={(e) => handleCardNumberChange(e.target.value)}
                          placeholder="1234 5678 9012 3456"
                          required
                        />
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <Label htmlFor="expiry">
                            有効期限 <span className={styles.required}>*</span>
                          </Label>
                          <Input
                            id="expiry"
                            value={formData.expiry}
                            onChange={(e) => handleExpiryChange(e.target.value)}
                            placeholder="MM/YY"
                            maxLength={5}
                            required
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <Label htmlFor="cvv">
                            セキュリティコード <span className={styles.required}>*</span>
                          </Label>
                          <Input
                            id="cvv"
                            value={formData.cvv}
                            onChange={(e) => setFormData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))}
                            placeholder="123"
                            maxLength={4}
                            required
                          />
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <Label htmlFor="card-name">
                          カード名義 <span className={styles.required}>*</span>
                        </Label>
                        <Input
                          id="card-name"
                          value={formData.cardName}
                          onChange={(e) => setFormData(prev => ({ ...prev, cardName: e.target.value }))}
                          placeholder="TARO YAMADA"
                          required
                        />
                      </div>
                    </div>

                    {/* Billing Information */}
                    <div className={styles.formSection}>
                      <h2 className={styles.sectionTitle}>
                        <MapPin className={styles.sectionIcon} />
                        請求先情報
                      </h2>

                      <div className={styles.formGroup}>
                        <Label htmlFor="email">
                          メールアドレス <span className={styles.required}>*</span>
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="example@email.com"
                          required
                        />
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <Label htmlFor="first-name">
                            姓 <span className={styles.required}>*</span>
                          </Label>
                          <Input
                            id="first-name"
                            value={formData.firstName}
                            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="山田"
                            required
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <Label htmlFor="last-name">
                            名 <span className={styles.required}>*</span>
                          </Label>
                          <Input
                            id="last-name"
                            value={formData.lastName}
                            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder="太郎"
                            required
                          />
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <Label htmlFor="postal-code">
                          郵便番号 <span className={styles.required}>*</span>
                        </Label>
                        <div className={styles.postalWrapper}>
                          <Input
                            id="postal-code"
                            value={formData.postalCode}
                            onChange={(e) => handlePostalCodeChange(e.target.value)}
                            placeholder="123-4567"
                            maxLength={8}
                            required
                          />
                          {isLoadingAddress && (
                            <Loader2 className={styles.postalLoader} />
                          )}
                        </div>
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <Label htmlFor="prefecture">
                            都道府県 <span className={styles.required}>*</span>
                          </Label>
                          <Input
                            id="prefecture"
                            value={formData.prefecture}
                            onChange={(e) => setFormData(prev => ({ ...prev, prefecture: e.target.value }))}
                            placeholder="自動入力されます"
                            readOnly
                            required
                            style={{ backgroundColor: 'rgba(17, 24, 39, 0.4)', cursor: 'not-allowed' }}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <Label htmlFor="city">
                            市区町村 <span className={styles.required}>*</span>
                          </Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                            placeholder="自動入力されます"
                            readOnly
                            required
                            style={{ backgroundColor: 'rgba(17, 24, 39, 0.4)', cursor: 'not-allowed' }}
                          />
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <Label htmlFor="address">
                          住所 <span className={styles.required}>*</span>
                        </Label>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="神南1-2-3"
                          required
                        />
                      </div>
                    </div>

                    {/* Terms and Conditions */}
                    <div className={styles.termsSection}>
                      <div className={styles.checkboxGroup}>
                        <Checkbox
                          id="terms"
                          checked={formData.termsAccepted}
                          onCheckedChange={(checked) => handleTermsCheckboxChange(!!checked)}
                          disabled={!hasReadTerms || !hasReadPrivacy}
                          required
                        />
                        <label htmlFor="terms" className={styles.checkboxLabel}>
                          <a 
                            href="#" 
                            onClick={handleTermsClick}
                            className={hasReadTerms ? styles.readLink : styles.unreadLink}
                          >
                            利用規約
                          </a>
                          および
                          <a 
                            href="#" 
                            onClick={handlePrivacyClick}
                            className={hasReadPrivacy ? styles.readLink : styles.unreadLink}
                          >
                            プライバシーポリシー
                          </a>
                          に同意します
                          <span className={styles.required}>*</span>
                          {(!hasReadTerms || !hasReadPrivacy) && (
                            <span className={styles.readHint}>（クリックして最後まで読んでください）</span>
                          )}
                        </label>
                      </div>
                      <div className={styles.checkboxGroup}>
                        <Checkbox
                          id="age-confirm"
                          checked={formData.ageConfirmed}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ageConfirmed: !!checked }))}
                          required
                        />
                        <label htmlFor="age-confirm" className={styles.checkboxLabel}>
                          私は18歳以上であることを確認します
                          <span className={styles.required}>*</span>
                        </label>
                      </div>
                    </div>

                    {/* Payment Button - moved to form */}
                    <div className={styles.paymentButtonSection}>
                      <Button
                        type="submit"
                        className={styles.paymentButton}
                        disabled={isProcessing}
                        onClick={handleSubmit}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            決済処理中...
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            安全に決済する
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Order Summary */}
              <Card className={styles.orderSummary}>
                <CardContent className="p-0">
                  <h2 className={styles.summaryTitle}>ご注文内容</h2>
                  
                  <div className={styles.priceBreakdown}>
                    <div className={styles.priceRow}>
                      <span>{planConfig.name}</span>
                      <span className={styles.priceValue}>¥{planConfig.originalPrice.toLocaleString()}</span>
                    </div>
                    {planConfig.discountAmount > 0 && (
                      <>
                        <div className={styles.priceRow}>
                          <span>{planConfig.discountText}</span>
                          <span className={styles.priceValue}>-¥{planConfig.discountAmount.toLocaleString()}</span>
                        </div>
                        <div className={styles.priceRow}>
                          <span>小計</span>
                          <span className={styles.priceValue}>¥{planConfig.subtotal.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                    <div className={styles.priceRow}>
                      <span>消費税</span>
                      <span className={styles.priceValue}>¥{planConfig.tax.toLocaleString()}</span>
                    </div>
                    <div className={`${styles.priceRow} ${styles.total}`}>
                      <span>合計</span>
                      <span className={styles.priceValue}>¥{planConfig.total.toLocaleString()}</span>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Document Modals */}
      <DocumentModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="利用規約"
        content={TERMS_CONTENT}
        onFullyRead={() => setHasReadTerms(true)}
        documentType="terms"
      />
      
      <DocumentModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="プライバシーポリシー"
        content={PRIVACY_CONTENT}
        onFullyRead={() => setHasReadPrivacy(true)}
        documentType="privacy"
      />
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