'use client';

import { PlanInfo } from '@/types/subscription';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Star } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  plan: PlanInfo;
  icon?: LucideIcon;
  monthlyPrice: number;
  discount: number;
  isPopular?: boolean;
  isSelected?: boolean;
  onSelect: () => void;
}

export function PlanCard({ 
  plan, 
  icon: Icon, 
  monthlyPrice, 
  discount, 
  isPopular = false, 
  isSelected = false, 
  onSelect 
}: PlanCardProps) {
  
  // プラン期間を取得
  const planMonths = parseInt(plan.planType.replace('month', ''));
  
  // 価格をフォーマット
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card 
      className={cn(
        "relative h-[500px] cursor-pointer transition-all duration-200 hover:shadow-lg border-2",
        isSelected 
          ? "border-pink-500 shadow-lg ring-2 ring-pink-200" 
          : "border-gray-200 hover:border-pink-300",
        isPopular && "ring-2 ring-yellow-300 shadow-xl"
      )}
      onClick={onSelect}
    >
      {/* 人気プランバッジ */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold px-3 py-1 rounded-full shadow-md">
            <Star className="w-3 h-3 mr-1" />
            人気No.1
          </Badge>
        </div>
      )}

      {/* 割引バッジ */}
      {discount > 0 && (
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-red-500 text-white font-bold px-2 py-1 rounded-full shadow-md">
            {discount}%OFF
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-4">
        {/* プランアイコン */}
        {Icon && (
          <div className={cn(
            "mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3",
            isPopular 
              ? "bg-gradient-to-br from-yellow-400 to-orange-400 text-white" 
              : "bg-gradient-to-br from-pink-400 to-rose-400 text-white"
          )}>
            <Icon className="w-6 h-6" />
          </div>
        )}
        
        {/* プラン名 */}
        <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
        
        {/* プラン説明 */}
        <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 価格表示 */}
        <div className="text-center">
          {/* 月額換算価格 */}
          <div className="text-2xl font-bold text-pink-600">
            {formatPrice(monthlyPrice)}
            <span className="text-sm font-normal text-gray-500">/月</span>
          </div>
          
          {/* 合計価格 */}
          <div className="text-gray-600 text-sm mt-1">
            合計: {formatPrice(plan.amount)}
            {planMonths > 1 && (
              <span className="ml-1">({planMonths}ヶ月分)</span>
            )}
          </div>
          
          {/* 割引表示 */}
          {discount > 0 && (
            <div className="text-green-600 text-sm font-medium mt-1">
              通常より {formatPrice((monthlyPrice * planMonths) - plan.amount)} お得！
            </div>
          )}
        </div>

        {/* 特典リスト */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">プラン特典</h4>
          <div className="space-y-1.5">
            {plan.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 leading-5">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 選択ボタン */}
        <div className="pt-4">
          <Button
            className={cn(
              "w-full font-semibold py-2 px-4 rounded-lg transition-all duration-200",
              isSelected 
                ? "bg-pink-600 text-white hover:bg-pink-700" 
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            {isSelected ? '選択中' : 'このプランを選択'}
          </Button>
        </div>

        {/* トライアル情報 */}
        {plan.trialDays > 0 && (
          <div className="text-center text-xs text-gray-500 pt-2 border-t">
            {plan.trialDays}日間無料トライアル付き
          </div>
        )}
      </CardContent>
    </Card>
  );
}