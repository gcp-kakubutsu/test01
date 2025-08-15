"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  type User, 
  onAuthStateChanged, 
  signOut as firebaseSignOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification 
} from 'firebase/auth';
import { getFirebaseAuth, getFirebaseDb, getInitializationError } from '@/lib/firebase/client';
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
    let unsubscribe: (() => void) | null = null;
    
    const setupAuth = () => {
      try {
        // Firebase Authを取得
        const auth = getFirebaseAuth();
        const initError = getInitializationError();
        
        // 初期化エラーがある場合はログに記録
        if (initError) {
          console.error('Firebase initialization error detected:', initError);
        }
        
        if (!auth) {
          console.warn('Firebase Auth is not available');
          setIsLoading(false);
          return;
        }

        console.log('Setting up auth state listener');
        
        // 認証状態の監視
        unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
            setCurrentUser(user);
            setIsLoading(false);
          },
          (error) => {
            console.error('Auth state listener error:', error);
            setCurrentUser(null);
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error('Failed to setup auth:', error);
        setIsLoading(false);
      }
    };

    // 少し遅延してから初期化（DOMの準備を待つ）
    const timer = setTimeout(() => {
      setupAuth();
    }, 100);

    // フォールバックタイマー
    const fallbackTimer = setTimeout(() => {
      if (isLoading) {
        console.log('Auth setup timeout - forcing ready state');
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (data: AuthFormData): Promise<boolean> => {
    console.log('Login attempt for:', data.email);
    
    try {
      const auth = getFirebaseAuth();
      
      if (!auth) {
        console.error('Auth not available for login');
        toast({ 
          title: 'ログインエラー', 
          description: '認証システムの初期化に失敗しました。ページを再読み込みしてください。', 
          variant: 'destructive' 
        });
        return false;
      }
      
      setIsLoading(true);
      
      // ログイン実行
      console.log('Calling signInWithEmailAndPassword...');
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      
      console.log('Login successful:', userCredential.user.email);
      
      // メール確認チェック
      if (!userCredential.user.emailVerified) {
        console.warn('Email not verified');
        toast({ 
          title: 'メールアドレス未確認', 
          description: 'メールアドレスの確認が完了していません。確認メールをご確認ください。', 
          variant: 'destructive',
          duration: 10000
        });
        await firebaseSignOut(auth);
        setIsLoading(false);
        return false;
      }
      
      toast({ 
        title: 'ログインしました', 
        description: 'Nukuneへようこそ！' 
      });
      
      setIsLoading(false);
      return true;
      
    } catch (error: any) {
      console.error('Login error details:', {
        code: error.code,
        message: error.message,
        error
      });
      
      // エラーメッセージマッピング
      let description = 'ログインに失敗しました。';
      
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/invalid-email':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          description = 'メールアドレスまたはパスワードが正しくありません。';
          break;
        case 'auth/user-disabled':
          description = 'このアカウントは無効になっています。';
          break;
        case 'auth/too-many-requests':
          description = 'ログイン試行回数が多すぎます。しばらくしてから再度お試しください。';
          break;
        case 'auth/network-request-failed':
          description = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
          break;
        case 'auth/internal-error':
          description = 'サーバーエラーが発生しました。しばらくしてから再度お試しください。';
          break;
        default:
          if (error.message) {
            description = `エラー: ${error.message}`;
          }
      }
      
      toast({ 
        title: 'ログインエラー', 
        description, 
        variant: 'destructive' 
      });
      
      setIsLoading(false);
      return false;
    }
  };

  const signup = async (data: AuthFormData & { username: string; birthDate?: string; gender?: string }): Promise<boolean> => {
    console.log('Signup attempt for:', data.email);
    
    try {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      
      if (!auth || !db) {
        console.error('Auth or DB not available for signup');
        toast({ 
          title: '登録エラー', 
          description: 'システムの初期化に失敗しました。ページを再読み込みしてください。', 
          variant: 'destructive' 
        });
        return false;
      }
      
      setIsLoading(true);
      
      // アカウント作成
      console.log('Creating user account...');
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      
      console.log('Account created:', userCredential.user.email);
      
      // メール確認送信
      try {
        await sendEmailVerification(userCredential.user);
        console.log('Verification email sent');
        toast({ 
          title: '確認メールを送信しました', 
          description: 'メールアドレスに確認メールを送信しました。' 
        });
      } catch (verificationError) {
        console.error('Failed to send verification email:', verificationError);
        toast({ 
          title: '確認メール送信エラー', 
          description: '確認メールの送信に失敗しました。', 
          variant: 'destructive' 
        });
      }
      
      // Firestoreにユーザー情報保存
      const firestoreResult = await addUserToFirestore(
        userCredential.user.uid, 
        data.username, 
        data.email, 
        data.birthDate, 
        data.gender
      );
      
      if (!firestoreResult.success) {
        console.error('Firestore save failed:', firestoreResult.error);
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
      
      // サインアップ後はログアウト
      await firebaseSignOut(auth);
      setIsLoading(false);
      return true;
      
    } catch (error: any) {
      console.error('Signup error details:', {
        code: error.code,
        message: error.message,
        error
      });
      
      let description = '登録に失敗しました。';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          description = 'このメールアドレスは既に使用されています。';
          break;
        case 'auth/weak-password':
          description = 'パスワードは6文字以上で設定してください。';
          break;
        case 'auth/invalid-email':
          description = 'メールアドレスの形式が正しくありません。';
          break;
        case 'auth/network-request-failed':
          description = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
          break;
        default:
          if (error.message) {
            description = `エラー: ${error.message}`;
          }
      }
      
      toast({ 
        title: '登録エラー', 
        description, 
        variant: 'destructive' 
      });
      
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<boolean> => {
    console.log('Logout attempt');
    
    try {
      const auth = getFirebaseAuth();
      
      if (!auth) {
        console.error('Auth not available for logout');
        toast({ 
          title: 'ログアウトエラー', 
          description: 'システムエラーが発生しました。', 
          variant: 'destructive' 
        });
        return false;
      }
      
      setIsLoading(true);
      
      // 即座にユーザー状態をクリア
      setCurrentUser(null);
      
      // Firebaseからログアウト
      await firebaseSignOut(auth);
      
      console.log('Logout successful');
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