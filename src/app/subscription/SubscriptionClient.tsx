'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, MapPin, Lock, Loader2, Crown, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import styles from './subscription.module.scss';

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
    price: 2000,
    originalPrice: 2000,
    discount: 0,
    features: [
      '全ての女性のプロフィール閲覧',
      '無制限のいいね送信',
      'マッチング機能',
      'メッセージ機能',
    ]
  },
  {
    id: '6month',
    name: '6ヶ月プラン',
    price: 9000,
    originalPrice: 12000,
    discount: 25,
    popular: true,
    features: [
      '全ての女性のプロフィール閲覧',
      '無制限のいいね送信',
      'マッチング機能',
      'メッセージ機能',
      '25%お得！',
    ]
  },
  {
    id: '12month',
    name: '12ヶ月プラン',
    price: 12000,
    originalPrice: 24000,
    discount: 50,
    features: [
      '全ての女性のプロフィール閲覧',
      '無制限のいいね送信',
      'マッチング機能',
      'メッセージ機能',
      '50%お得！最もお得',
    ]
  }
];

export default function SubscriptionClient() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedPlan, setSelectedPlan] = useState('6month');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  
  const [planConfig, setPlanConfig] = useState<PlanConfig>({
    name: '6ヶ月プラン',
    originalPrice: 12000,
    discountAmount: 3000,
    discountText: '割引（25%お得）',
    subtotal: 9000,
    tax: 900,
    total: 9900
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const plan = searchParams.get('plan');
    if (plan && PLAN_OPTIONS.some(p => p.id === plan)) {
      setSelectedPlan(plan);
      updatePlanConfig(plan);
    } else if (!plan) {
      // URLパラメータがない場合はselectedPlanの初期値（6month）を使用
      updatePlanConfig(selectedPlan);
    }
  }, []); // 初回マウント時のみ実行

  const updatePlanConfig = (plan: string) => {
    switch(plan) {
      case '1month':
        setPlanConfig({
          name: '1ヶ月プラン',
          originalPrice: 2000,
          discountAmount: 0,
          discountText: '',
          subtotal: 2000,
          tax: 200,
          total: 2200
        });
        break;
      case '12month':
        setPlanConfig({
          name: '12ヶ月プラン',
          originalPrice: 24000,
          discountAmount: 12000,
          discountText: '割引（50%お得）',
          subtotal: 12000,
          tax: 1200,
          total: 13200
        });
        break;
      default:
        setPlanConfig({
          name: '6ヶ月プラン',
          originalPrice: 12000,
          discountAmount: 3000,
          discountText: '割引（25%お得）',
          subtotal: 9000,
          tax: 900,
          total: 9900
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
        const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleaned}`);
        const data = await response.json();
        
        if (data.status === 200 && data.results && data.results.length > 0) {
          const result = data.results[0];
          setFormData(prev => ({
            ...prev,
            prefecture: result.address1,
            city: result.address2,
            address: result.address3
          }));
        } else {
          toast({
            title: "郵便番号エラー",
            description: "郵便番号が見つかりませんでした。",
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
          <Crown className={styles.crownIcon} />
          <h1 className={styles.pageTitle}>プレミアム会員になる</h1>
          <p className={styles.pageSubtitle}>
            すべての機能を使って、理想の相手を見つけましょう
          </p>
        </div>

        {/* Show Plan Selection or Payment Form */}
        {!showPaymentForm ? (
          <>
            {/* Plan Selection */}
            <div className={styles.plansGrid}>
              {PLAN_OPTIONS.map((plan) => (
                <Card 
                  key={plan.id}
                  className={`${styles.planCard} ${selectedPlan === plan.id ? styles.selected : ''} ${plan.popular ? styles.popular : ''}`}
                  onClick={() => handlePlanSelect(plan.id)}
                >
                  {plan.popular && (
                    <div className={styles.popularBadge}>人気No.1</div>
                  )}
                  <CardContent className={styles.planContent}>
                    <h3 className={styles.planName}>{plan.name}</h3>
                    <div className={styles.priceContainer}>
                      {plan.discount > 0 && (
                        <div className={styles.originalPrice}>
                          ¥{plan.originalPrice.toLocaleString()}
                        </div>
                      )}
                      <div className={styles.currentPrice}>
                        <span className={styles.currency}>¥</span>
                        <span className={styles.amount}>{plan.price.toLocaleString()}</span>
                      </div>
                      {plan.discount > 0 && (
                        <div className={styles.discountBadge}>
                          {plan.discount}%OFF
                        </div>
                      )}
                    </div>
                    <ul className={styles.featuresList}>
                      {plan.features.map((feature, index) => (
                        <li key={index} className={styles.featureItem}>
                          <Check className={styles.checkIcon} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
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
                          <Select 
                            value={formData.prefecture} 
                            onValueChange={(value) => setFormData(prev => ({ ...prev, prefecture: value }))}
                            required
                          >
                            <SelectTrigger id="prefecture">
                              <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="北海道">北海道</SelectItem>
                              <SelectItem value="青森県">青森県</SelectItem>
                              <SelectItem value="岩手県">岩手県</SelectItem>
                              <SelectItem value="宮城県">宮城県</SelectItem>
                              <SelectItem value="秋田県">秋田県</SelectItem>
                              <SelectItem value="山形県">山形県</SelectItem>
                              <SelectItem value="福島県">福島県</SelectItem>
                              <SelectItem value="茨城県">茨城県</SelectItem>
                              <SelectItem value="栃木県">栃木県</SelectItem>
                              <SelectItem value="群馬県">群馬県</SelectItem>
                              <SelectItem value="埼玉県">埼玉県</SelectItem>
                              <SelectItem value="千葉県">千葉県</SelectItem>
                              <SelectItem value="東京都">東京都</SelectItem>
                              <SelectItem value="神奈川県">神奈川県</SelectItem>
                              <SelectItem value="新潟県">新潟県</SelectItem>
                              <SelectItem value="富山県">富山県</SelectItem>
                              <SelectItem value="石川県">石川県</SelectItem>
                              <SelectItem value="福井県">福井県</SelectItem>
                              <SelectItem value="山梨県">山梨県</SelectItem>
                              <SelectItem value="長野県">長野県</SelectItem>
                              <SelectItem value="岐阜県">岐阜県</SelectItem>
                              <SelectItem value="静岡県">静岡県</SelectItem>
                              <SelectItem value="愛知県">愛知県</SelectItem>
                              <SelectItem value="三重県">三重県</SelectItem>
                              <SelectItem value="滋賀県">滋賀県</SelectItem>
                              <SelectItem value="京都府">京都府</SelectItem>
                              <SelectItem value="大阪府">大阪府</SelectItem>
                              <SelectItem value="兵庫県">兵庫県</SelectItem>
                              <SelectItem value="奈良県">奈良県</SelectItem>
                              <SelectItem value="和歌山県">和歌山県</SelectItem>
                              <SelectItem value="鳥取県">鳥取県</SelectItem>
                              <SelectItem value="島根県">島根県</SelectItem>
                              <SelectItem value="岡山県">岡山県</SelectItem>
                              <SelectItem value="広島県">広島県</SelectItem>
                              <SelectItem value="山口県">山口県</SelectItem>
                              <SelectItem value="徳島県">徳島県</SelectItem>
                              <SelectItem value="香川県">香川県</SelectItem>
                              <SelectItem value="愛媛県">愛媛県</SelectItem>
                              <SelectItem value="高知県">高知県</SelectItem>
                              <SelectItem value="福岡県">福岡県</SelectItem>
                              <SelectItem value="佐賀県">佐賀県</SelectItem>
                              <SelectItem value="長崎県">長崎県</SelectItem>
                              <SelectItem value="熊本県">熊本県</SelectItem>
                              <SelectItem value="大分県">大分県</SelectItem>
                              <SelectItem value="宮崎県">宮崎県</SelectItem>
                              <SelectItem value="鹿児島県">鹿児島県</SelectItem>
                              <SelectItem value="沖縄県">沖縄県</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className={styles.formGroup}>
                          <Label htmlFor="city">
                            市区町村 <span className={styles.required}>*</span>
                          </Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                            placeholder="渋谷区"
                            required
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
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, termsAccepted: !!checked }))}
                          required
                        />
                        <label htmlFor="terms" className={styles.checkboxLabel}>
                          <Link href="/terms" target="_blank">利用規約</Link>および
                          <Link href="/privacy" target="_blank">プライバシーポリシー</Link>に同意します
                          <span className={styles.required}>*</span>
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
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}