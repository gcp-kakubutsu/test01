"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { deleteAccount } from './actions';
import { deleteUser } from 'firebase/auth';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authIsLoading, currentUser, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);

  useEffect(() => {
     if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
    // 実際のアプリでは、ここでユーザー設定をフェッチします
  }, [isAuthenticated, authIsLoading, router]);


  const handleAccountDeletion = async () => {
    setShowDeleteDialog(false);
    if (!currentUser) return;
    
    setIsDeleting(true);
    try {
      // Check if this is an admin-created user by checking Firestore first
      if (!db) throw new Error('Firestore is not initialized');
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnapshot = await getDoc(userDocRef);
      const userData = userDocSnapshot.data();
      
      // If user exists in Firestore but not in Auth (admin-created), use direct Firestore deletion
      if (userData && userData.isGirl) {
        try {
          // Delete directly from Firestore for admin-created users
          await deleteDoc(userDocRef);
          console.log('Admin-created user deleted from Firestore:', currentUser.uid);
          
          toast({
            title: 'アカウントを削除しました',
            description: 'ご利用ありがとうございました。',
          });
          
          // Sign out and redirect to home
          await logout();
          router.push('/');
          return; // Exit early for admin-created users
        } catch (firestoreError) {
          console.error('Direct Firestore deletion failed:', firestoreError);
          // Fall through to API deletion attempt
        }
      }
      
      // For regular users, try server-side deletion via API
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
          if (!db) throw new Error('Firestore is not initialized');
          const userDocRef = doc(db, 'users', currentUser.uid);
          await deleteDoc(userDocRef);
          console.log('User document deleted from Firestore');
          
          // Delete auth user
          if (!auth) throw new Error('Firebase Auth is not initialized');
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
            <ShieldAlert className="mr-3 h-7 w-7" /> アカウント操作
          </CardTitle>
          <CardDescription>アカウントの状態を管理します。</CardDescription>
        </CardHeader>
        <CardContent>
            <Button 
              variant="destructive" 
              className="w-full sm:w-auto"
              disabled={isDeleting}
              onClick={() => {
                setShowDeleteDialog(true);
                setDeleteConfirmStep(1);
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirmStep === 1 ? 'アカウントを削除しますか？' : '本当によろしいですか？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmStep === 1 
                ? 'この操作は取り消すことができません。すべてのデータ、マッチ、メッセージが永久に削除されます。' 
                : 'アカウントを削除すると、二度と復元できません。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setDeleteConfirmStep(1);
            }}>
              キャンセル
            </AlertDialogCancel>
            {deleteConfirmStep === 1 ? (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => setDeleteConfirmStep(2)}
              >
                次へ
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleAccountDeletion}
              >
                削除する
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}