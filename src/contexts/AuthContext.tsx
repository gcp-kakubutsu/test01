"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  type User, 
  onAuthStateChanged, 
  signOut as firebaseSignOut, 
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
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
  loginWithRedirect: (data: AuthFormData) => Promise<void>;
  signup: (data: AuthFormData & { username: string; birthDate?: string; gender?: string }) => Promise<boolean>;
  logout: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ブラウザ判定
function isLineApp(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return ua.includes('line');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCredentials, setPendingCredentials] = useState<AuthFormData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    const setupAuth = async () => {
      try {
        const auth = getFirebaseAuth();
        const initError = getInitializationError();
        
        if (initError) {
          console.error('📛 Firebase initialization error:', initError);
        }
        
        if (!auth) {
          console.error('❌ Firebase Auth not available');
          setIsLoading(false);
          return;
        }

        console.log('🔐 Setting up auth state listener');
        
        // リダイレクト結果を確認（LINEブラウザ対応）
        try {
          const result = await getRedirectResult(auth);
          if (result?.user) {
            console.log('✅ Redirect login successful:', result.user.email);
            
            // メール確認チェック
            if (!result.user.emailVerified && pendingCredentials) {
              toast({ 
                title: 'メールアドレス未確認', 
                description: 'メールアドレスの確認が完了していません。', 
                variant: 'destructive'
              });
              await firebaseSignOut(auth);
            } else {
              toast({ 
                title: 'ログインしました', 
                description: 'Nukuneへようこそ！' 
              });
            }
            setPendingCredentials(null);
          }
        } catch (redirectError: any) {
          console.error('❌ Redirect result error:', redirectError);
          if (redirectError.code && redirectError.code !== 'auth/popup-blocked-by-browser') {
            toast({
              title: 'ログインエラー',
              description: 'ログインに失敗しました。もう一度お試しください。',
              variant: 'destructive'
            });
          }
        }
        
        // 認証状態の監視
        unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            console.log('👤 Auth state:', user ? `User: ${user.email}` : 'No user');
            setCurrentUser(user);
            setIsLoading(false);
          },
          (error) => {
            console.error('❌ Auth listener error:', error);
            setCurrentUser(null);
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error('❌ Auth setup failed:', error);
        setIsLoading(false);
      }
    };

    setupAuth();

    // タイムアウト
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('⏱️ Auth timeout - forcing ready');
        setIsLoading(false);
      }
    }, 10000); // 10秒に延長

    return () => {
      clearTimeout(timeout);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // リダイレクトログイン（LINE対応）
  const loginWithRedirect = async (data: AuthFormData): Promise<void> => {
    console.log('🔄 Attempting redirect login for:', data.email);
    
    const auth = getFirebaseAuth();
    if (!auth) {
      toast({ 
        title: 'ログインエラー', 
        description: 'システムエラーが発生しました。', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      // 資格情報を保存（リダイレクト後の確認用）
      setPendingCredentials(data);
      sessionStorage.setItem('pendingLogin', JSON.stringify(data));
      
      // Googleプロバイダーの例（メール/パスワードの代わりに）
      // 注: メール/パスワードはリダイレクトをサポートしていないため、
      // 実装を変更する必要があります
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      
    } catch (error: any) {
      console.error('❌ Redirect login error:', error);
      setPendingCredentials(null);
      sessionStorage.removeItem('pendingLogin');
      
      toast({ 
        title: 'ログインエラー', 
        description: 'ログインに失敗しました。', 
        variant: 'destructive' 
      });
    }
  };

  // 通常のログイン
  const login = async (data: AuthFormData): Promise<boolean> => {
    console.log('🔑 Login attempt for:', data.email);
    
    // LINEブラウザの場合は別の方法を試す
    const isLine = isLineApp();
    if (isLine) {
      console.log('📱 LINE browser detected - using special handling');
    }
    
    try {
      const auth = getFirebaseAuth();
      
      if (!auth) {
        console.error('❌ Auth not available');
        toast({ 
          title: 'ログインエラー', 
          description: '認証システムが利用できません。', 
          variant: 'destructive' 
        });
        return false;
      }
      
      setIsLoading(true);
      
      // ログイン実行
      console.log('🔐 Calling signInWithEmailAndPassword...');
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      
      console.log('✅ Login successful');
      
      // メール確認チェック
      if (!userCredential.user.emailVerified) {
        console.warn('⚠️ Email not verified');
        toast({ 
          title: 'メールアドレス未確認', 
          description: 'メールアドレスの確認が完了していません。', 
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
      console.error('❌ Login error:', {
        code: error.code,
        message: error.message,
        fullError: error
      });
      
      // エラーメッセージ
      let description = 'ログインに失敗しました。';
      
      if (error.code === 'auth/network-request-failed') {
        if (isLine) {
          description = 'LINEブラウザでは認証に制限があります。Safari、Chrome等の標準ブラウザをご利用ください。';
        } else {
          description = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
        }
      } else if (error.code === 'auth/invalid-credential' || 
                 error.code === 'auth/user-not-found' || 
                 error.code === 'auth/wrong-password') {
        description = 'メールアドレスまたはパスワードが正しくありません。';
      } else if (error.code === 'auth/too-many-requests') {
        description = 'ログイン試行回数が多すぎます。しばらくしてから再度お試しください。';
      } else if (error.code === 'auth/internal-error') {
        description = 'サーバーエラーが発生しました。しばらくしてから再度お試しください。';
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

  // サインアップ
  const signup = async (data: AuthFormData & { username: string; birthDate?: string; gender?: string }): Promise<boolean> => {
    console.log('📝 Signup attempt for:', data.email);
    
    try {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      
      if (!auth || !db) {
        console.error('❌ Auth or DB not available');
        toast({ 
          title: '登録エラー', 
          description: 'システムエラーが発生しました。', 
          variant: 'destructive' 
        });
        return false;
      }
      
      setIsLoading(true);
      
      // アカウント作成
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      
      console.log('✅ Account created');
      
      // メール確認送信
      try {
        await sendEmailVerification(userCredential.user);
        console.log('📧 Verification email sent');
        toast({ 
          title: '確認メールを送信しました', 
          description: 'メールアドレスに確認メールを送信しました。' 
        });
      } catch (verificationError) {
        console.error('❌ Verification email failed:', verificationError);
      }
      
      // Firestoreに保存
      const firestoreResult = await addUserToFirestore(
        userCredential.user.uid, 
        data.username, 
        data.email, 
        data.birthDate, 
        data.gender
      );
      
      if (!firestoreResult.success) {
        console.error('❌ Firestore save failed');
      }
      
      toast({ 
        title: '登録完了！', 
        description: 'メールアドレスの確認後、ログインできるようになります。' 
      });
      
      await firebaseSignOut(auth);
      setIsLoading(false);
      return true;
      
    } catch (error: any) {
      console.error('❌ Signup error:', error);
      
      let description = '登録に失敗しました。';
      
      if (error.code === 'auth/email-already-in-use') {
        description = 'このメールアドレスは既に使用されています。';
      } else if (error.code === 'auth/weak-password') {
        description = 'パスワードは6文字以上で設定してください。';
      } else if (error.code === 'auth/network-request-failed') {
        const isLine = isLineApp();
        if (isLine) {
          description = 'LINEブラウザでは登録に制限があります。Safari、Chrome等の標準ブラウザをご利用ください。';
        } else {
          description = 'ネットワークエラーが発生しました。';
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

  // ログアウト
  const logout = async (): Promise<boolean> => {
    console.log('🚪 Logout attempt');
    
    try {
      const auth = getFirebaseAuth();
      
      if (!auth) {
        console.error('❌ Auth not available');
        return false;
      }
      
      setIsLoading(true);
      setCurrentUser(null);
      
      await firebaseSignOut(auth);
      
      console.log('✅ Logout successful');
      toast({ title: 'ログアウトしました' });
      
      setIsLoading(false);
      return true;
      
    } catch (error: any) {
      console.error('❌ Logout error:', error);
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
    loginWithRedirect,
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