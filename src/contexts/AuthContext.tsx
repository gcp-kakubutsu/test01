"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { type User, onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/client';
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
  const [authInitialized, setAuthInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    // 非同期で認証を初期化
    const initAuth = async () => {
      try {
        const auth = getFirebaseAuth();
        
        if (!auth) {
          console.log('Firebase Auth not available');
          setIsLoading(false);
          return;
        }

        // 認証状態のリスナーを設定
        unsubscribe = onAuthStateChanged(auth, 
          (user) => {
            console.log('Auth state updated:', user ? 'User logged in' : 'No user');
            setCurrentUser(user);
            setIsLoading(false);
            setAuthInitialized(true);
          },
          (error) => {
            console.error('Auth state error:', error);
            setCurrentUser(null);
            setIsLoading(false);
            setAuthInitialized(true);
          }
        );
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setIsLoading(false);
        setAuthInitialized(true);
      }
    };

    // 初期化を実行
    initAuth();

    // タイムアウト設定（3秒）
    const timeout = setTimeout(() => {
      if (!authInitialized) {
        console.log('Auth initialization timeout');
        setIsLoading(false);
        setAuthInitialized(true);
      }
    }, 3000);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      clearTimeout(timeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (data: AuthFormData): Promise<boolean> => {
    const auth = getFirebaseAuth();
    
    if (!auth) {
      toast({ title: 'ログインエラー', description: '認証サービスが一時的に利用できません。', variant: 'destructive' });
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
            duration: 10000
          });
          await firebaseSignOut(auth);
          setIsLoading(false);
          return false;
        }
        toast({ title: 'ログインしました', description: 'Nukuneへようこそ！' });
        setIsLoading(false);
        return true;
      }
      setIsLoading(false);
      return false;
    } catch (error: any) {
      console.error('Login error:', error);
      
      let description = 'ログインに失敗しました。';
      
      // エラーメッセージのマッピング
      const errorMessages: Record<string, string> = {
        'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません。',
        'auth/user-not-found': 'このメールアドレスは登録されていません。',
        'auth/wrong-password': 'パスワードが正しくありません。',
        'auth/invalid-email': 'メールアドレスの形式が正しくありません。',
        'auth/user-disabled': 'このアカウントは無効になっています。',
        'auth/too-many-requests': 'ログイン試行回数が多すぎます。しばらくしてから再度お試しください。',
        'auth/network-request-failed': 'ネットワークエラーが発生しました。接続を確認してください。',
      };
      
      description = errorMessages[error.code] || description;
      
      toast({ title: 'ログインエラー', description, variant: 'destructive' });
      setIsLoading(false);
      return false;
    }
  };

  const signup = async (data: AuthFormData & { username: string; birthDate?: string; gender?: string }): Promise<boolean> => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    
    if (!auth || !db) {
      toast({ title: '登録エラー', description: '認証サービスが一時的に利用できません。', variant: 'destructive' });
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
        
        // Firestoreにユーザー情報を保存
        const firestoreResult = await addUserToFirestore(
          userCredential.user.uid, 
          data.username, 
          data.email, 
          data.birthDate, 
          data.gender
        );
        
        if (!firestoreResult.success) {
          console.error("Firestoreへのユーザー追加に失敗:", firestoreResult.error);
          toast({ 
            title: '登録処理エラー', 
            description: 'プロフィール情報の保存に失敗しました。', 
            variant: 'destructive' 
          });
        } else {
          toast({ 
            title: '登録完了！', 
            description: 'メールアドレスの確認後、ログインできるようになります。' 
          });
        }
        
        // サインアップ後は自動的にログアウト
        await firebaseSignOut(auth);
        setIsLoading(false);
        return true;
      }
      setIsLoading(false);
      return false;
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let description = '登録に失敗しました。';
      
      const errorMessages: Record<string, string> = {
        'auth/email-already-in-use': 'このメールアドレスは既に使用されています。',
        'auth/weak-password': 'パスワードは6文字以上で設定してください。',
        'auth/invalid-email': 'メールアドレスの形式が正しくありません。',
        'auth/operation-not-allowed': 'メール/パスワード認証が無効になっています。',
        'auth/network-request-failed': 'ネットワークエラーが発生しました。接続を確認してください。',
      };
      
      description = errorMessages[error.code] || description;
      
      toast({ title: '登録エラー', description, variant: 'destructive' });
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<boolean> => {
    const auth = getFirebaseAuth();
    
    if (!auth) {
      toast({ title: 'ログアウトエラー', description: '認証サービスが一時的に利用できません。', variant: 'destructive' });
      return false;
    }
    
    setIsLoading(true);
    
    try {
      // ユーザー状態をクリア
      setCurrentUser(null);
      
      // Firebaseからログアウト
      await firebaseSignOut(auth);
      
      toast({ title: 'ログアウトしました' });
      setIsLoading(false);
      return true;
    } catch (error: any) {
      console.error('Logout error:', error);
      toast({ 
        title: 'ログアウトエラー', 
        description: 'ログアウトに失敗しました。', 
        variant: 'destructive' 
      });
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