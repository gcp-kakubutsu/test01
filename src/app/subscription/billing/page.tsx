"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  CreditCard,
  Calendar,
  Shield,
  AlertTriangle,
  Loader2,
  Check,
  Edit2,
  Plus,
  Trash2,
  Lock
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';

interface PaymentMethod {
  id: string;
  type: 'card';
  isDefault: boolean;
}

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
  } catch {
    return null;
  }
}

export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, currentUser } = useAuth();
  const { status, subscriptionInfo, userSubscription, isLoading: subLoading } = useSubscription();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [registrationDate, setRegistrationDate] = useState<Date | null>(null);
  const [subscriptionStartDate, setSubscriptionStartDate] = useState<Date | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showEditCardModal, setShowEditCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<PaymentMethod | null>(null);
  const [newCardData, setNewCardData] = useState({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardholderName: ''
  });
  const [editCardData, setEditCardData] = useState({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardholderName: ''
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // 機能フラグ: 支払い方法の変更UI（現状は未対応）
  const paymentMethodChangeEnabled = false;

  // Load registration date for script-created users
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser?.uid) return;
      
      try {
        const db = getFirebaseDb();
        if (!db) {
          console.log('Firebase DB not initialized');
          return;
        }
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Check for registration date from script
          const startDate = toDateSafe(userData?.subscriptionStartDate);
          if (startDate) setSubscriptionStartDate(startDate);
          
          // Also check createdAt for general registration date
          const createdAt = toDateSafe(userData?.createdAt);
          if (createdAt) setRegistrationDate(createdAt);
        }
      } catch (error: any) {
        // Permission error is expected for some users, don't show error
        if (error?.code !== 'permission-denied') {
          console.error('Error loading user data:', error);
        }
        // Continue without registration date - it's optional
      }
    };

    loadUserData();
  }, [currentUser]);

  // Mockデータは未実装表示のため使用しない

  const handleSetDefault = async (methodId: string) => {
    setIsProcessing(true);
    
    // Simulate API call
    setTimeout(() => {
      setPaymentMethods(methods => 
        methods.map(m => ({
          ...m,
          isDefault: m.id === methodId
        }))
      );
      toast({
        title: "デフォルトの支払い方法を更新しました",
        description: "次回の請求からこの支払い方法が使用されます。",
      });
      setIsProcessing(false);
    }, 1000);
  };

  const handleDeleteMethod = async (methodId: string) => {
    const method = paymentMethods.find(m => m.id === methodId);
    if (method?.isDefault) {
      toast({
        title: "削除できません",
        description: "デフォルトの支払い方法は削除できません。",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    // Simulate API call
    setTimeout(() => {
      setPaymentMethods(methods => methods.filter(m => m.id !== methodId));
      toast({
        title: "支払い方法を削除しました",
      });
      setIsProcessing(false);
    }, 1000);
  };

  const handleAddCard = () => {
    setShowAddCardModal(true);
  };

  const submitNewCard = () => {
    if (!newCardData.cardNumber || !newCardData.expiryMonth || !newCardData.expiryYear || !newCardData.cvv) {
      toast({
        title: "エラー",
        description: "すべての項目を入力してください。",
        variant: "destructive"
      });
      return;
    }

    setIsAddingCard(true);

    const newCard: PaymentMethod = {
      id: Date.now().toString(),
      type: 'card',
      isDefault: paymentMethods.length === 0
    };

    setTimeout(() => {
      setPaymentMethods([...paymentMethods, newCard]);
      setIsAddingCard(false);
      setShowAddCardModal(false);
      setNewCardData({ cardNumber: '', expiryMonth: '', expiryYear: '', cvv: '', cardholderName: '' });
      toast({
        title: "カードを追加しました",
        description: "新しい支払い方法が追加されました。",
      });
    }, 1000);
  };

  // Luhnアルゴリズムでカード番号を検証
  const validateCardNumber = (cardNumber: string): boolean => {
    const digits = cardNumber.replace(/\s/g, '');
    if (!/^\d+$/.test(digits)) return false;
    
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  };

  // カード番号をフォーマット（4桁ごとにスペース）
  const formatCardNumber = (value: string): string => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const handleEditCard = (method: PaymentMethod) => {
    setEditingCard(method);
    setEditCardData({
      cardNumber: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: '',
      cardholderName: ''
    });
    setShowEditCardModal(true);
  };

  const submitEditCard = () => {
    const cleanCardNumber = editCardData.cardNumber.replace(/\s/g, '');
    
    // バリデーション
    if (!cleanCardNumber || cleanCardNumber.length !== 16) {
      toast({
        title: "エラー",
        description: "有効なカード番号を入力してください（16桁）",
        variant: "destructive"
      });
      return;
    }

    if (!validateCardNumber(cleanCardNumber)) {
      toast({
        title: "エラー",
        description: "無効なカード番号です",
        variant: "destructive"
      });
      return;
    }

    if (!editCardData.expiryMonth || !editCardData.expiryYear) {
      toast({
        title: "エラー",
        description: "有効期限を入力してください",
        variant: "destructive"
      });
      return;
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const expYear = parseInt(editCardData.expiryYear);
    const expMonth = parseInt(editCardData.expiryMonth);

    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      toast({
        title: "エラー",
        description: "有効期限が過去の日付です",
        variant: "destructive"
      });
      return;
    }

    if (!editCardData.cvv || (editCardData.cvv.length !== 3 && editCardData.cvv.length !== 4)) {
      toast({
        title: "エラー",
        description: "有効なセキュリティコードを入力してください",
        variant: "destructive"
      });
      return;
    }

    if (!editCardData.cardholderName || editCardData.cardholderName.length < 2) {
      toast({
        title: "エラー",
        description: "カード名義人を入力してください",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    if (editingCard) {
      setTimeout(() => {
        setPaymentMethods(methods => 
          methods.map(m => {
            if (m.id === editingCard.id) {
              return {
                ...m,
                // ブランドや番号末尾などは保持・表示しない
              };
            }
            return m;
          })
        );
        setIsProcessing(false);
        setShowEditCardModal(false);
        setEditingCard(null);
        setEditCardData({ cardNumber: '', expiryMonth: '', expiryYear: '', cvv: '', cardholderName: '' });
        toast({
          title: "カード情報を更新しました",
          description: "支払い方法が正常に更新されました。",
        });
      }, 1500);
    }
  };

  if (subLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-20 min-h-screen">
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
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">支払い方法</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            お支払い方法の管理
          </p>
        </div>
      </div>

      {/* Current Subscription Info */}
      <Card className="border-pink-200 dark:border-pink-800">
        <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-pink-500" />
            現在のプラン
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">プラン名</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {userSubscription?.isPremium ? 'プレミアムプラン' : '無料プラン'}
            </span>
          </div>
          
          {(subscriptionStartDate || registrationDate) && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {subscriptionStartDate ? '開始日' : '登録日'}
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {(subscriptionStartDate || registrationDate)?.toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          )}
          
          {subscriptionInfo?.nextBillingDate && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                次回請求日
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {subscriptionInfo.nextBillingDate.toLocaleDateString('ja-JP')}
              </span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">月額料金</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {userSubscription?.isPremium ? '¥1,980' : '¥0'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Unimplemented Notice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-pink-500" />
            支払い方法の変更
          </CardTitle>
          <CardDescription>
            現在、この機能は<strong>未対応</strong>です。恐れ入りますが、支払い方法の変更をご希望の場合はサポートまでお問い合わせください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            無効な操作や未実装の導線は表示されません。
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push('/support')}
              className="bg-pink-500 hover:bg-pink-600 text-white"
            >
              サポートに問い合わせる
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />戻る
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 未実装のため、カード追加/編集のモーダルは表示しない */}

      {/* 未実装のため、カード編集モーダルは表示しない */}

      {/* Security Notice */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-green-300 dark:border-green-600">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                安全な決済システム
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                お客様のカード情報は暗号化され、安全に保護されています。当社のシステムにカード番号の全桁は保存されません。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}