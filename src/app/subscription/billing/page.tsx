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
  Trash2
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank';
  last4: string;
  brand?: string;
  isDefault: boolean;
  expiryMonth?: number;
  expiryYear?: number;
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

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Load registration date for script-created users
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser?.uid) return;
      
      try {
        const db = getFirebaseDb();
        if (!db) return;
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        // Check for registration date from script
        if (userData?.subscriptionStartDate) {
          setSubscriptionStartDate(userData.subscriptionStartDate.toDate());
        }
        
        // Also check createdAt for general registration date
        if (userData?.createdAt) {
          setRegistrationDate(userData.createdAt.toDate());
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [currentUser]);

  // Mock payment methods for demonstration
  useEffect(() => {
    // シミュレーションデータ
    setPaymentMethods([
      {
        id: '1',
        type: 'card',
        last4: '1234',
        brand: 'Visa',
        isDefault: true,
        expiryMonth: 12,
        expiryYear: 2025
      }
    ]);
  }, []);

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
    setIsAddingCard(true);
    // In real implementation, this would open Stripe's card element
    setTimeout(() => {
      const newCard: PaymentMethod = {
        id: Date.now().toString(),
        type: 'card',
        last4: '5678',
        brand: 'MasterCard',
        isDefault: paymentMethods.length === 0,
        expiryMonth: 3,
        expiryYear: 2026
      };
      setPaymentMethods([...paymentMethods, newCard]);
      setIsAddingCard(false);
      toast({
        title: "カードを追加しました",
        description: "新しい支払い方法が追加されました。",
      });
    }, 2000);
  };

  if (subLoading) {
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

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-pink-500" />
              支払い方法
            </span>
            <Button
              size="sm"
              onClick={handleAddCard}
              disabled={isAddingCard}
              className="bg-pink-500 hover:bg-pink-600 text-white"
            >
              {isAddingCard ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  カードを追加
                </>
              )}
            </Button>
          </CardTitle>
          <CardDescription>
            登録されている支払い方法を管理できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentMethods.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>支払い方法が登録されていません</p>
              <Button
                onClick={handleAddCard}
                className="mt-4"
                variant="outline"
              >
                支払い方法を追加
              </Button>
            </div>
          ) : (
            paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`border rounded-lg p-4 ${
                  method.isDefault 
                    ? 'border-pink-300 bg-pink-50 dark:bg-pink-900/20 dark:border-pink-600' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <CreditCard className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {method.brand} ****{method.last4}
                        </span>
                        {method.isDefault && (
                          <Badge className="bg-pink-500 text-white text-xs">
                            デフォルト
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        有効期限: {method.expiryMonth?.toString().padStart(2, '0')}/{method.expiryYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!method.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={isProcessing}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingMethodId(method.id)}
                      disabled={isProcessing}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteMethod(method.id)}
                      disabled={isProcessing || method.isDefault}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

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
                お客様のカード情報は暗号化され、安全に保護されています。
                当社のシステムにカード番号の全桁は保存されません。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}