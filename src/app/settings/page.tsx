
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Bell, EyeOff, ShieldAlert, Trash2, UserX, Loader2, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { deleteAccount } from './actions';
import { deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authIsLoading, currentUser, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [profileVisible, setProfileVisible] = useState(true);
  const [matchNotifications, setMatchNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<string[]>(['ブロックユーザー123', '別のユーザー']); // モックデータ
  const [blockUserInput, setBlockUserInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
     if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
    // 実際のアプリでは、ここでユーザー設定をフェッチします
  }, [isAuthenticated, authIsLoading, router]);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    // API呼び出しをシミュレート
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log({
      profileVisible,
      matchNotifications,
      messageNotifications,
    });
    setIsSaving(false);
    toast({
      title: '設定保存完了',
      description: '設定が更新されました。',
    });
  };

  const handleBlockUser = () => {
    if (blockUserInput.trim() === '') return;
    setBlockedUsers(prev => [...prev, blockUserInput.trim()]);
    setBlockUserInput('');
    toast({ title: 'ユーザーをブロックしました', description: `${blockUserInput.trim()} をブロックリストに追加しました。` });
  };

  const handleUnblockUser = (userToUnblock: string) => {
    setBlockedUsers(prev => prev.filter(user => user !== userToUnblock));
    toast({ title: 'ユーザーのブロックを解除しました', description: `${userToUnblock} をブロックリストから削除しました。` });
  };

  if (authIsLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">読み込み中...</p></div>;
  }
  if (!isAuthenticated) {
     return <div className="flex justify-center items-center h-screen"><p>ログインページへリダイレクト中...</p></div>;
  }


  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <EyeOff className="mr-3 h-7 w-7" /> プライバシー設定
          </CardTitle>
          <CardDescription>プロフィールの公開設定やプライバシー管理を行います。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
            <Label htmlFor="profileVisibility" className="text-base font-medium">
              プロフィールの公開
              <p className="text-sm text-muted-foreground">あなたのプロフィールを誰に見せるか制御します。</p>
            </Label>
            <Switch
              id="profileVisibility"
              checked={profileVisible}
              onCheckedChange={setProfileVisible}
              aria-label="プロフィールの公開/非公開を切り替える"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <Bell className="mr-3 h-7 w-7" /> 通知設定
          </CardTitle>
          <CardDescription>受け取りたい通知を選択します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-3 p-3 rounded-md hover:bg-secondary/30 transition-colors">
            <Checkbox id="matchNotifications" checked={matchNotifications} onCheckedChange={(checked) => setMatchNotifications(Boolean(checked))} />
            <Label htmlFor="matchNotifications" className="text-base font-normal cursor-pointer">
              新しいマッチ通知
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-md hover:bg-secondary/30 transition-colors">
            <Checkbox id="messageNotifications" checked={messageNotifications} onCheckedChange={(checked) => setMessageNotifications(Boolean(checked))} />
            <Label htmlFor="messageNotifications" className="text-base font-normal cursor-pointer">
              新しいメッセージ通知
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <UserX className="mr-3 h-7 w-7" /> ブロック中のユーザー
          </CardTitle>
          <CardDescription>ブロックしたユーザーを管理します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="ブロックするユーザー名を入力"
              value={blockUserInput}
              onChange={(e) => setBlockUserInput(e.target.value)}
              className="flex-grow"
            />
            <Button onClick={handleBlockUser} variant="outline">ブロック</Button>
          </div>
          {blockedUsers.length > 0 ? (
            <ul className="space-y-2 max-h-48 overflow-y-auto p-2 border rounded-md">
              {blockedUsers.map(user => (
                <li key={user} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <span className="text-sm">{user}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleUnblockUser(user)} aria-label={`${user} のブロックを解除`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">ブロックリストは空です。</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
         <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <ShieldAlert className="mr-3 h-7 w-7" /> アカウント操作
          </CardTitle>
          <CardDescription>アカウントの状態を管理します。</CardDescription>
        </CardHeader>
        <CardContent>
            <Button 
              variant="destructive" 
              className="w-full sm:w-auto"
              disabled={isDeleting}
              onClick={async () => {
                if (!currentUser) return;
                
                // Double confirmation for account deletion
                const firstConfirm = confirm('本当にアカウントを削除しますか？\n\nこの操作は取り消すことができません。すべてのデータ、マッチ、メッセージが永久に削除されます。');
                if (!firstConfirm) return;
                
                const secondConfirm = confirm('本当によろしいですか？\n\nアカウントを削除すると、二度と復元できません。');
                if (!secondConfirm) return;
                
                setIsDeleting(true);
                try {
                  // First try server-side deletion via API
                  const response = await fetch('/api/account/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.uid }),
                  });
                  
                  const result = await response.json();
                  
                  if (result.success) {
                    toast({
                      title: 'アカウントを削除しました',
                      description: 'ご利用ありがとうございました。',
                    });
                    // Sign out and redirect to home
                    await logout();
                    router.push('/');
                  } else if (result.error === 'admin-not-initialized' || result.error === 'admin-deletion-failed') {
                    // Fallback to client-side deletion
                    console.log('Falling back to client-side deletion');
                    
                    try {
                      // Delete Firestore document first
                      const userDocRef = doc(db, 'users', currentUser.uid);
                      await deleteDoc(userDocRef);
                      console.log('User document deleted from Firestore');
                      
                      // Delete auth user
                      if (auth.currentUser) {
                        await deleteUser(auth.currentUser);
                        console.log('User deleted from Firebase Auth');
                      }
                      
                      toast({
                        title: 'アカウントを削除しました',
                        description: 'ご利用ありがとうございました。',
                      });
                      
                      router.push('/');
                    } catch (clientError: any) {
                      console.error('Client-side deletion error:', clientError);
                      
                      // If it's a permission error, the user might be deleted from auth but not from Firestore
                      if (clientError.code === 'permission-denied') {
                        toast({
                          title: 'アカウントを削除しました',
                          description: 'ご利用ありがとうございました。',
                        });
                        router.push('/');
                      } else {
                        toast({
                          title: 'エラー',
                          description: 'アカウントの削除に失敗しました。再度ログインしてお試しください。',
                          variant: 'destructive',
                        });
                      }
                    }
                  } else {
                    toast({
                      title: 'エラー',
                      description: result.error || 'アカウントの削除に失敗しました。',
                      variant: 'destructive',
                    });
                  }
                } catch (error) {
                  console.error('Account deletion error:', error);
                  toast({
                    title: 'エラー',
                    description: 'アカウントの削除に失敗しました。',
                    variant: 'destructive',
                  });
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  削除中...
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  アカウントを削除
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">アカウントを削除すると、すべてのデータが永久に削除され、復元できません。</p>
        </CardContent>
      </Card>

      <div className="flex justify-end mt-8">
        <Button onClick={handleSaveChanges} disabled={isSaving} size="lg" className="text-base px-6 py-3">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              すべての変更を保存
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
