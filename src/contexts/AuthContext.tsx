"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { type User, onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import type { AuthFormData } from '@/app/login/page';
import { addUserToFirestore } from '@/app/auth/actions';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: AuthFormData) => Promise<boolean>;
  signup: (data: AuthFormData & { username: string; birthDate?: string; gender?: string }) => Promise<boolean>;
  logout: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Quick check for auth availability
    if (!auth) {
      console.log('Auth not initialized');
      setIsLoading(false);
      return;
    }

    // Setup auth state listener
    const unsubscribe = onAuthStateChanged(auth, 
      (user) => {
        setCurrentUser(user);
        setIsLoading(false);
      },
      (error) => {
        console.error('Auth state error:', error);
        setCurrentUser(null);
        setIsLoading(false);
      }
    );

    // Fallback timeout
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('Auth check timeout');
        setIsLoading(false);
      }
    }, 2000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (data: AuthFormData): Promise<boolean> => {
    if (!auth) {
      toast({ title: 'ログインエラー', description: '認証サービスが利用できません。', variant: 'destructive' });
      return false;
    }
    
    setIsLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      if (userCredential.user) {
        // メールアドレスが確認されていない場合はログインを拒否
        if (!userCredential.user.emailVerified) {
          toast({ 
            title: 'メールアドレス未確認', 
            description: 'メールアドレスの確認が完了していません。確認メールが見つからない場合は、ログイン画面の「パスワードをお忘れですか？」から再送信できます。', 
            variant: 'destructive',
            duration: 10000 // 10秒間表示
          });
          await firebaseSignOut(auth);
          setIsLoading(false);
          return false;
        }
        toast({ title: 'ログインしました', description: 'Nukuneへようこそ！' });
        return true;
      }
      return false;
    } catch (error: any) {
      let description = 'ログインに失敗しました。メールアドレスまたはパスワードを確認してください。';
      
      if (error.code === 'auth/invalid-credential') {
        description = 'メールアドレスまたはパスワードが正しくありません。';
      } else if (error.code === 'auth/user-not-found') {
        description = 'このメールアドレスは登録されていません。';
      } else if (error.code === 'auth/wrong-password') {
        description = 'パスワードが正しくありません。';
      } else if (error.code === 'auth/invalid-email') {
        description = 'メールアドレスの形式が正しくありません。';
      } else if (error.code === 'auth/user-disabled') {
        description = 'このアカウントは無効になっています。';
      } else if (error.code === 'auth/too-many-requests') {
        description = 'ログイン試行回数が多すぎます。しばらくしてから再度お試しください。';
      }
      
      toast({ title: 'ログインエラー', description, variant: 'destructive' });
      setIsLoading(false);
      return false;
    }
  };

  const signup = async (data: AuthFormData & { username: string; birthDate?: string; gender?: string }): Promise<boolean> => {
    if (!auth || !db) {
      toast({ title: '登録エラー', description: '認証サービスが利用できません。', variant: 'destructive' });
      return false;
    }
    
    setIsLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      if (userCredential.user) {
        // メール確認を送信
        try {
          await sendEmailVerification(userCredential.user);
          toast({ 
            title: '確認メールを送信しました', 
            description: 'メールアドレスに確認メールを送信しました。メール内のリンクをクリックして確認を完了してください。' 
          });
        } catch (verificationError: any) {
          console.error("メール確認送信エラー:", verificationError);
          toast({ 
            title: '確認メール送信エラー', 
            description: '確認メールの送信に失敗しました。後ほど再送信してください。', 
            variant: 'destructive' 
          });
        }
        
        const firestoreResult = await addUserToFirestore(userCredential.user.uid, data.username, data.email, data.birthDate, data.gender);
        if (!firestoreResult.success) {
            console.error("Firestoreへのユーザー追加に失敗:", firestoreResult.error);
            toast({ title: '登録処理エラー', description: `アカウントは作成されましたが、プロフィール情報の保存に失敗しました: ${firestoreResult.error}`, variant: 'destructive' });
        } else {
            toast({ title: '登録完了！', description: 'メールアドレスの確認後、ログインできるようになります。' });
        }
        
        // サインアップ後は自動的にログアウト（メール確認が必要なため）
        await firebaseSignOut(auth);
        return true;
      }
      return false;
    } catch (error: any) {
      let description = '登録に失敗しました。';
      if (error.code === 'auth/email-already-in-use') {
        description = 'このメールアドレスは既に使用されています。';
      } else if (error.code === 'auth/weak-password') {
        description = 'パスワードは6文字以上で設定してください。';
      }
      toast({ title: '登録エラー', description, variant: 'destructive' });
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<boolean> => {
    if (!auth) {
      toast({ title: 'ログアウトエラー', description: '認証サービスが利用できません。', variant: 'destructive' });
      return false;
    }
    
    setIsLoading(true);
    try {
      // Clear user state immediately
      setCurrentUser(null);
      
      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      toast({ title: 'ログアウトしました' });
      setIsLoading(false);
      return true;
    } catch (error: any) {
      toast({ title: 'ログアウトエラー', description: error.message || 'ログアウトに失敗しました。', variant: 'destructive' });
      setIsLoading(false);
      return false;
    }
  };

  const value = {
    currentUser,
    isAuthenticated: !isLoading && !!currentUser,
    isLoading,
    login,
    signup,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}