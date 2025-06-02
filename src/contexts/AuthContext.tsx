
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { type User, onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, firebaseInitError } from '@/lib/firebase/client'; // auth, db は undefined の可能性があり、firebaseInitError をインポート
import type { AuthFormData } from '@/app/login/page';
import { addUserToFirestore } from '@/app/auth/actions';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: AuthFormData) => Promise<void>;
  signup: (data: AuthFormData & { username: string; birthDate?: string; gender?: string }) => Promise<void>;
  logout: () => Promise<void>;
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
  }, []);

  const login = async (data: AuthFormData) => {
    if (firebaseInitError) {
      toast({ title: 'ログインエラー', description: `Firebaseの初期化に問題があります: ${firebaseInitError}。設定を確認してください。`, variant: 'destructive' });
      throw new Error(`Firebase initialization error during login: ${firebaseInitError}`);
    }
    if (!auth) {
      toast({ title: 'ログインエラー', description: 'Firebase認証が初期化されていません。設定を確認してください。', variant: 'destructive' });
      throw new Error('Firebase Auth is not initialized.');
    }
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast({ title: 'ログインしました', description: 'Nukuneへようこそ！' });
    } catch (error: any) {
      console.error("Login error:", error);
      let description = 'ログインに失敗しました。メールアドレスまたはパスワードを確認してください。';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password'){
        description = 'メールアドレスまたはパスワードが正しくありません。';
      } else if (error.code === 'auth/invalid-api-key' || error.code === 'auth/configuration-not-found') {
        description = 'Firebaseの設定が正しくありません。環境設定（.envファイル）を確認してください。';
      }
      toast({ title: 'ログインエラー', description, variant: 'destructive' });
      setIsLoading(false);
      throw error;
    }
  };

  const signup = async (data: AuthFormData & { username: string; birthDate?: string; gender?: string }) => {
    if (firebaseInitError) {
      toast({ title: '登録エラー', description: `Firebaseの初期化に問題があります: ${firebaseInitError}。設定を確認してください。`, variant: 'destructive' });
      throw new Error(`Firebase initialization error during signup: ${firebaseInitError}`);
    }
    if (!auth || !db) {
      toast({ title: '登録エラー', description: 'Firebase認証またはデータベースが初期化されていません。設定を確認してください。', variant: 'destructive' });
      throw new Error('Firebase Auth or Firestore is not initialized.');
    }
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      if (userCredential.user) {
        const firestoreResult = await addUserToFirestore(userCredential.user.uid, data.username, data.email, data.birthDate, data.gender);
        if (!firestoreResult.success) {
            console.error("Firestoreへのユーザー追加に失敗:", firestoreResult.error);
            toast({ title: '登録処理エラー', description: `アカウントは作成されましたが、プロフィール情報の保存に失敗しました: ${firestoreResult.error}`, variant: 'destructive' });
        } else {
            toast({ title: '登録完了！', description: 'Nukuneへようこそ！プロフィールを編集しましょう。' });
        }
      }
    } catch (error: any) {
      console.error("Signup error:", error);
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
      throw error;
    }
  };

  const logout = async () => {
    if (firebaseInitError) {
      toast({ title: 'ログアウトエラー', description: `Firebaseの初期化に問題があります: ${firebaseInitError}。`, variant: 'destructive' });
      throw new Error(`Firebase initialization error during logout: ${firebaseInitError}`);
    }
    if (!auth) {
      toast({ title: 'ログアウトエラー', description: 'Firebase認証が初期化されていません。', variant: 'destructive' });
      throw new Error('Firebase Auth is not initialized.');
    }
    setIsLoading(true);
    try {
      await firebaseSignOut(auth);
      toast({ title: 'ログアウトしました' });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({ title: 'ログアウトエラー', description: error.message || 'ログアウトに失敗しました。', variant: 'destructive' });
      setIsLoading(false);
      throw error;
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
