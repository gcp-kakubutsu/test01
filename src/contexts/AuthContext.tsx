
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { type User, onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, db, firebaseInitError } from '@/lib/firebase/client'; // auth, db は undefined の可能性があり、firebaseInitError をインポート
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
    let unsubscribe = () => {};

    if (firebaseInitError) {
      console.warn("AuthContext: Firebaseの初期化中にエラーが検出されたため、認証関連の処理をスキップします。", firebaseInitError);
      setCurrentUser(null);
      setIsLoading(false);
      toast({
        title: "Firebase初期化エラー",
        description: `設定に問題があります: ${firebaseInitError}. アプリケーションの主要機能が利用できません。環境設定（.envファイルなど）を確認してください。`,
        variant: "destructive",
        duration: Infinity, // ユーザーが閉じるまで表示
      });
      return;
    }

    if (auth) {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setIsLoading(false);
      }, (error) => {
        // 認証状態の監視でエラーが発生した場合のハンドリング
        console.error('Auth state change error:', error);
        
        // 一時的なネットワークエラーの場合は現在のユーザー状態を保持
        const firebaseError = error as any;
        if (firebaseError.code === 'auth/network-request-failed' || 
            firebaseError.code === 'auth/internal-error' ||
            error.message.includes('503') ||
            error.message.includes('Service Unavailable')) {
          console.warn('一時的なネットワークエラーが発生しました。ユーザー状態を保持します。');
          // ユーザー状態を変更せずにローディングだけ終了
          setIsLoading(false);
          return;
        }
        
        // その他のエラーの場合は通常通り処理
        setCurrentUser(null);
        setIsLoading(false);
        toast({
          title: "認証エラー",
          description: "認証状態の確認中にエラーが発生しました。再度ログインしてください。",
          variant: "destructive",
        });
      });
    } else {
      console.warn("AuthContext: Firebase Auth が初期化されていませんが、firebaseInitErrorは設定されていませんでした。認証機能は動作しません。");
      setCurrentUser(null);
      setIsLoading(false);
      toast({
        title: "認証サービスエラー",
        description: "Firebase認証サービスが正しく設定されていません。管理者に連絡するか、設定を確認してください。",
        variant: "destructive",
        duration: Infinity,
      });
    }
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (data: AuthFormData): Promise<boolean> => {
    if (firebaseInitError) {
      toast({ title: 'ログインエラー', description: `Firebaseの初期化に問題があります: ${firebaseInitError}。設定を確認してください。`, variant: 'destructive' });
      return false;
    }
    if (!auth) {
      toast({ title: 'ログインエラー', description: 'Firebase認証が初期化されていません。設定を確認してください。', variant: 'destructive' });
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
      // Don't log error to console to prevent error messages
      
      let description = 'ログインに失敗しました。メールアドレスまたはパスワードを確認してください。';
      
      // Firebase v9以降では、多くのエラーがauth/invalid-credentialに統一されています
      if (error.code === 'auth/invalid-credential') {
        description = 'メールアドレスまたはパスワードが正しくありません。新規登録がまだの場合は、先にアカウントを作成してください。';
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
      } else if (error.code === 'auth/invalid-api-key' || error.code === 'auth/configuration-not-found') {
        description = 'Firebaseの設定が正しくありません。環境設定（.envファイル）を確認してください。';
      }
      
      toast({ title: 'ログインエラー', description, variant: 'destructive' });
      setIsLoading(false);
      // Don't throw the error to prevent console errors
      return false;
    }
  };

  const signup = async (data: AuthFormData & { username: string; birthDate?: string; gender?: string }): Promise<boolean> => {
    if (firebaseInitError) {
      toast({ title: '登録エラー', description: `Firebaseの初期化に問題があります: ${firebaseInitError}。設定を確認してください。`, variant: 'destructive' });
      return false;
    }
    if (!auth || !db) {
      toast({ title: '登録エラー', description: 'Firebase認証またはデータベースが初期化されていません。設定を確認してください。', variant: 'destructive' });
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
      // Don't log error to console to prevent error messages
      let description = '登録に失敗しました。';
      if (error.code === 'auth/email-already-in-use') {
        description = 'このメールアドレスは既に使用されています。';
      } else if (error.code === 'auth/weak-password') {
        description = 'パスワードは6文字以上で設定してください。';
      } else if (error.code === 'auth/invalid-api-key' || error.code === 'auth/configuration-not-found') {
        description = 'Firebaseの設定が正しくありません。環境設定（.envファイル）を確認してください。';
      }
      toast({ title: '登録エラー', description, variant: 'destructive' });
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<boolean> => {
    if (firebaseInitError) {
      toast({ title: 'ログアウトエラー', description: `Firebaseの初期化に問題があります: ${firebaseInitError}。`, variant: 'destructive' });
      return false;
    }
    if (!auth) {
      toast({ title: 'ログアウトエラー', description: 'Firebase認証が初期化されていません。', variant: 'destructive' });
      return false;
    }
    setIsLoading(true);
    try {
      // Clear user state immediately to prevent any active listeners from trying to access Firestore
      setCurrentUser(null);
      
      // Small delay to allow listeners to clean up
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then sign out from Firebase
      await firebaseSignOut(auth);
      
      toast({ title: 'ログアウトしました' });
      setIsLoading(false);
      return true;
    } catch (error: any) {
      // Don't log error to console to prevent error messages
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
