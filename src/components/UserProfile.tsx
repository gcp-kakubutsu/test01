'use client';

import React, { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Copy, 
  Check, 
  User, 
  CreditCard, 
  Calendar,
  MapPin,
  Mail,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface UserProfileProps {
  className?: string;
  showPaymentUid?: boolean;
  compact?: boolean;
}

/**
 * ユーザープロフィール表示コンポーネント
 * payment_uidの表示・コピー機能を含む
 */
export function UserProfile({ 
  className, 
  showPaymentUid = true, 
  compact = false 
}: UserProfileProps) {
  const {
    user,
    loading,
    error,
    paymentUidInfo,
    isGeneratingPaymentUid,
    generatePaymentUid,
    clearError,
    refresh
  } = useUser();

  const [copiedPaymentUid, setCopiedPaymentUid] = useState(false);

  // payment_uidをクリップボードにコピー
  const handleCopyPaymentUid = async () => {
    if (!paymentUidInfo?.payment_uid) return;

    try {
      await navigator.clipboard.writeText(paymentUidInfo.payment_uid);
      setCopiedPaymentUid(true);
      toast({
        title: "コピー完了",
        description: "Payment UIDをクリップボードにコピーしました",
      });
      
      // 2秒後にコピー状態をリセット
      setTimeout(() => setCopiedPaymentUid(false), 2000);
    } catch (err) {
      console.error('Failed to copy payment UID:', err);
      toast({
        title: "コピー失敗",
        description: "Payment UIDのコピーに失敗しました",
        variant: "destructive",
      });
    }
  };

  // payment_uidを生成
  const handleGeneratePaymentUid = async () => {
    try {
      await generatePaymentUid();
      toast({
        title: "Payment UID生成完了",
        description: "Payment UIDが正常に生成されました",
      });
    } catch (err) {
      toast({
        title: "生成エラー",
        description: err instanceof Error ? err.message : "Payment UID生成に失敗しました",
        variant: "destructive",
      });
    }
  };

  // エラー表示
  if (error) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={clearError}>
              エラーを閉じる
            </Button>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              再読み込み
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ローディング表示
  if (loading && !user) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[80%]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <Alert>
            <User className="h-4 w-4" />
            <AlertDescription>
              ユーザー情報が見つかりませんでした。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // コンパクト表示
  if (compact) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.profilePhotoUrl || undefined} />
              <AvatarFallback>
                {user.username?.charAt(0)?.toUpperCase() || 
                 user.email?.charAt(0)?.toUpperCase() || 
                 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">
                {user.username || user.email?.split('@')[0] || '未設定'}
              </p>
              {showPaymentUid && paymentUidInfo && (
                <p className="text-xs text-muted-foreground font-mono">
                  {paymentUidInfo.payment_uid}
                </p>
              )}
            </div>
            
            {showPaymentUid && paymentUidInfo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyPaymentUid}
                className="h-8 w-8 p-0"
              >
                {copiedPaymentUid ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // フル表示
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.profilePhotoUrl || undefined} />
            <AvatarFallback className="text-xl">
              {user.username?.charAt(0)?.toUpperCase() || 
               user.email?.charAt(0)?.toUpperCase() || 
               'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-2">
            <CardTitle className="text-xl">
              {user.username || user.email?.split('@')[0] || '未設定'}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              {user.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </span>
              )}
            </CardDescription>
          </div>
          
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            更新
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 基本情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {user.age && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{user.age}歳</span>
            </div>
          )}
          
          {user.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{user.location}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              登録日: {user.createdAt?.toDate?.()?.toLocaleDateString() || '不明'}
            </span>
          </div>
        </div>

        {/* 自己紹介 */}
        {user.bio && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">自己紹介</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {user.bio}
            </p>
          </div>
        )}

        {/* 興味・関心 */}
        {user.interests && user.interests.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">興味・関心</h4>
            <div className="flex flex-wrap gap-2">
              {user.interests.map((interest, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Payment UID情報 */}
        {showPaymentUid && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">決済情報</h4>
            </div>
            
            {paymentUidInfo ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Payment UID</p>
                    <p className="font-mono text-sm font-medium">
                      {paymentUidInfo.payment_uid}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPaymentUid}
                    className="flex items-center gap-2"
                  >
                    {copiedPaymentUid ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-xs">コピー済み</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span className="text-xs">コピー</span>
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    作成日: {paymentUidInfo.payment_uid_created_at?.toDate?.()?.toLocaleString() || '不明'}
                  </p>
                  <p>
                    最終更新: {paymentUidInfo.payment_uid_updated_at?.toDate?.()?.toLocaleString() || '不明'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Alert>
                  <CreditCard className="h-4 w-4" />
                  <AlertDescription>
                    Payment UIDが設定されていません。決済機能を利用するには生成が必要です。
                  </AlertDescription>
                </Alert>
                
                <Button
                  onClick={handleGeneratePaymentUid}
                  disabled={isGeneratingPaymentUid}
                  className="w-full sm:w-auto"
                >
                  {isGeneratingPaymentUid && (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Payment UIDを生成
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}