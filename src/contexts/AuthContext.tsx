
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { type User, onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client'; // auth と db は undefined の可能性があります
import type { AuthFormData } from '@/app/login/page';
import { addUserToFirestore } from '@/app/auth/actions';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: AuthFormData) => Promise<void>;
  signup: (data: AuthFormData & { username: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let unsubscribe = () => {};
    if (auth) { // authが初期化されている場合のみ監視を開始
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setIsLoading(false);
      });
    } else {
      console.warn("Firebase Auth が初期化されていません。認証機能は動作しません。");
      // .envファイルでFirebaseのAPIキーが正しく設定されているか確認してください。
      setIsLoading(false); // 認証がない場合でもローディング状態は解除
    }
    return () => unsubscribe();
  }, []);

  const login = async (data: AuthFormData) => {
    if (!auth) {
      toast({ title: 'ログインエラー', description: 'Firebase認証が初期化されていません。設定を確認してください。', variant: 'destructive' });
      throw new Error('Firebase Auth is not initialized.');
    }
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast({ title: 'ログインしました', description: 'Nukuneへようこそ！' });
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      console.error("Login error:", error);
      let description = 'ログインに失敗しました。メールアドレスまたはパスワードを確認してください。';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password'){
        description = 'メールアドレスまたはパスワードが正しくありません。';
      } else if (error.code === 'auth/invalid-api-key') {
        description = 'Firebase APIキーが無効です。管理者にお問い合わせください。';
      }
      toast({ title: 'ログインエラー', description, variant: 'destructive' });
      setIsLoading(false);
      throw error;
    }
    // setIsLoading(false) is handled by onAuthStateChanged effect or error catch
  };

  const signup = async (data: AuthFormData & { username: string }) => {
    if (!auth || !db) {
      toast({ title: '登録エラー', description: 'Firebase認証またはデータベースが初期化されていません。設定を確認してください。', variant: 'destructive' });
      throw new Error('Firebase Auth or Firestore is not initialized.');
    }
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      if (userCredential.user) {
        const firestoreResult = await addUserToFirestore(userCredential.user.uid, data.username, data.email);
        if (!firestoreResult.success) {
            console.error("Firestoreへのユーザー追加に失敗:", firestoreResult.error);
            // ここでロールバック処理やユーザーへの通知を検討できますが、
            // Firebase Authのユーザーは既に作成されています。
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
      } else if (error.code === 'auth/invalid-api-key') {
        description = 'Firebase APIキーが無効です。管理者にお問い合わせください。';
      }
      toast({ title: '登録エラー', description, variant: 'destructive' });
      setIsLoading(false);
      throw error;
    }
    // setIsLoading(false) is handled by onAuthStateChanged effect or error catch
  };

  const logout = async () => {
    if (!auth) {
      toast({ title: 'ログアウトエラー', description: 'Firebase認証が初期化されていません。', variant: 'destructive' });
      throw new Error('Firebase Auth is not initialized.');
    }
    setIsLoading(true);
    try {
      await firebaseSignOut(auth);
      toast({ title: 'ログアウトしました' });
      // User state will be updated by onAuthStateChanged
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
