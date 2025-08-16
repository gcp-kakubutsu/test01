"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthFormData } from '@/app/login/page';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface User {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName?: string | null;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasInitialized: boolean;
  login: (data: AuthFormData) => Promise<boolean>;
  loginWithRedirect: (data: AuthFormData) => Promise<void>;
  signup: (data: AuthFormData & { username: string; birthDate?: string; gender?: string }) => Promise<boolean>;
  logout: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 初期状態はtrue
  const [hasInitialized, setHasInitialized] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // セッションチェック（初回のみ）
  useEffect(() => {
    let mounted = true;
    
    // LINEブラウザ対応: 2秒でタイムアウトしてページを表示
    const timeout = setTimeout(() => {
      if (mounted && isLoading) {
        console.log('⏱️ Session check timeout - proceeding with page load');
        setHasInitialized(true);
        setIsLoading(false);
      }
    }, 2000); // 2秒でタイムアウト
    
    // 非同期でセッション確認（UIをブロックしない）
    const checkSession = async () => {
      if (!mounted) return;
      
      try {
        console.log('🔐 Session check...');
        
        // LINEブラウザ対応: フェッチにもタイムアウトを設定
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 3000); // 3秒タイムアウト
        
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        }).finally(() => clearTimeout(fetchTimeout));
        
        if (!mounted) return;
        
        const data = await response.json();
        
        if (data.authenticated && data.user) {
          console.log('✅ Session valid:', data.user.email);
          setCurrentUser(data.user);
          
          // Firebase Authにも同期（Firestore権限のため）
          const tokenResponse = await fetch('/api/auth/custom-token', {
            method: 'GET',
            credentials: 'include',
          });
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            if (tokenData.customToken && tokenData.uid) {
              // カスタムトークンでFirebase Authにサインイン
              const { getFirebaseAuth } = await import('@/lib/firebase/client');
              const { signInWithCustomToken } = await import('firebase/auth');
              const auth = getFirebaseAuth();
              if (auth) {
                try {
                  await signInWithCustomToken(auth, tokenData.customToken);
                  console.log('✅ Firebase Auth synced with custom token');
                } catch (error: any) {
                  // カスタムトークンが失敗した場合、IDトークンを使用
                  if (error.code === 'auth/invalid-custom-token') {
                    const { signInWithIdToken } = await import('@/lib/firebase/auth-helper');
                    await signInWithIdToken(tokenData.customToken);
                  } else {
                    console.warn('⚠️ Could not sync Firebase Auth:', error);
                  }
                }
              }
            }
          }
        } else {
          console.log('❌ No valid session');
          setCurrentUser(null);
        }
      } catch (error: any) {
        if (!mounted) return;
        // AbortErrorの場合はログを出さない
        if (error.name !== 'AbortError') {
          console.error('❌ Session check failed:', error);
        }
        setCurrentUser(null);
      } finally {
        if (mounted) {
          clearTimeout(timeout); // タイムアウトをクリア
          setHasInitialized(true);
          setIsLoading(false); // セッション確認完了
        }
      }
    };
        if (mounted) {
          clearTimeout(timeout); // タイムアウトをクリア
          setHasInitialized(true);
          setIsLoading(false); // セッション確認完了
        }
      }
    };
    
    // 初回実行
    checkSession();
    
    // 定期的にセッションをチェック（5分ごと）
    const interval = setInterval(() => {
      if (mounted) {
        // 定期チェックではisLoadingを変更しない
        const periodicCheck = async () => {
          try {
            const response = await fetch('/api/auth/session', {
              method: 'GET',
              credentials: 'include',
            });
            const data = await response.json();
            if (data.authenticated && data.user) {
              setCurrentUser(data.user);
            } else {
              setCurrentUser(null);
            }
          } catch {
            // 定期チェックのエラーは無視
          }
        };
        periodicCheck();
      }
    
    // 初回実行
    checkSession();
    
    // 定期的にセッションをチェック（5分ごと）
    const interval = setInterval(() => {
      if (mounted) {
        // 定期チェックではisLoadingを変更しない
        const periodicCheck = async () => {
          try {
            const response = await fetch('/api/auth/session', {
              method: 'GET',
              credentials: 'include',
            });
            const data = await response.json();
            if (data.authenticated && data.user) {
              setCurrentUser(data.user);
            } else {
              setCurrentUser(null);
            }
          } catch {
            // 定期チェックのエラーは無視
          }
        };
        periodicCheck();
      }
    }, 5 * 60 * 1000);
    
    return () => {
      mounted = false;
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []); // 空の依存配列で初回のみ実行

  // Firebase Auth同期（currentUserが設定された後）
  useEffect(() => {
    if (!currentUser || !hasInitialized) return;
    
    let mounted = true;
    
    const syncFirebase = async () => {
      if (!mounted) return;
      
      try {
        const tokenResponse = await fetch('/api/auth/custom-token', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (!mounted) return;
        
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.customToken && tokenData.uid) {
            const { getFirebaseAuth } = await import('@/lib/firebase/client');
            const { signInWithCustomToken } = await import('firebase/auth');
            const auth = getFirebaseAuth();
            if (auth && mounted) {
              try {
                await signInWithCustomToken(auth, tokenData.customToken);
                console.log('✅ Firebase Auth synced');
              } catch (error) {
                console.warn('⚠️ Firebase sync failed, but session is valid');
              }
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Background sync failed, but session is valid');
      }
    };
    
    // 遅延実行でFirebase同期
    const timer = setTimeout(syncFirebase, 100);
    
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [currentUser?.uid]); // currentUser.uidの変更時のみ実行

  // ログイン
  const login = async (data: AuthFormData): Promise<boolean> => {
    console.log('🔑 Login attempt for:', data.email);
    
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        // エラーログを出さずにトーストのみ表示
        toast({ 
          title: 'ログインエラー', 
          description: result.error || 'ログインに失敗しました', 
          variant: 'destructive' 
        });
        setIsLoading(false);
        return false;
      }

      console.log('✅ Login successful');
      setCurrentUser(result.user);
      setIsLoading(false);
      
      // Firebase Authにもサインイン（Firestoreアクセス用）
      if (result.customToken) {
        // カスタムトークンAPIを呼び出して正しいトークンを取得
        const tokenResponse = await fetch('/api/auth/custom-token', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.customToken) {
            const { getFirebaseAuth } = await import('@/lib/firebase/client');
            const { signInWithCustomToken } = await import('firebase/auth');
            const auth = getFirebaseAuth();
            if (auth) {
              try {
                await signInWithCustomToken(auth, tokenData.customToken);
                console.log('✅ Firebase Auth synced after login');
              } catch (error: any) {
                // カスタムトークンが失敗した場合、IDトークンを使用
                if (error.code === 'auth/invalid-custom-token') {
                  const { signInWithIdToken } = await import('@/lib/firebase/auth-helper');
                  await signInWithIdToken(result.customToken);
                } else {
                  console.warn('⚠️ Could not sync Firebase Auth:', error);
                }
              }
            }
          }
        }
      }
      
      toast({ 
        title: 'ログインしました', 
        description: 'Nukuneへようこそ！' 
      });
      
      // ホームページにリダイレクト
      router.push('/');
      
      // Firebase Auth同期は非同期で実行（ブロックしない）
      if (result.customToken) {
        setTimeout(async () => {
          try {
            const tokenResponse = await fetch('/api/auth/custom-token', {
              method: 'GET',
              credentials: 'include',
            });
            
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              if (tokenData.customToken) {
                const { getFirebaseAuth } = await import('@/lib/firebase/client');
                const { signInWithCustomToken } = await import('firebase/auth');
                const auth = getFirebaseAuth();
                if (auth) {
                  try {
                    await signInWithCustomToken(auth, tokenData.customToken);
                    console.log('✅ Firebase Auth synced after login');
                  } catch (error) {
                    console.warn('⚠️ Firebase sync failed, but login successful');
                  }
                }
              }
            }
          } catch (error) {
            console.warn('⚠️ Background sync failed, but login successful');
          }
        }, 100);
      }
      
      return true;
      
    } catch (error: any) {
      // ネットワークエラーの場合もコンソールエラーを出さない
      toast({ 
        title: 'ログインエラー', 
        description: 'ネットワークエラーが発生しました。インターネット接続を確認してください。', 
        variant: 'destructive' 
      });
      
      setIsLoading(false);
      return false;
    }
  };

  // リダイレクトログイン（互換性のため残す）
  const loginWithRedirect = async (data: AuthFormData): Promise<void> => {
    // 通常のログインを使用
    await login(data);
  };

  // サインアップ
  const signup = async (data: AuthFormData & { username: string; birthDate?: string; gender?: string }): Promise<boolean> => {
    console.log('📝 Signup attempt for:', data.email);
    
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        // エラーログを出さずにトーストのみ表示
        toast({ 
          title: '登録エラー', 
          description: result.error || '登録に失敗しました', 
          variant: 'destructive' 
        });
        setIsLoading(false);
        return false;
      }

      console.log('✅ Signup successful');
      
      toast({ 
        title: '登録完了！', 
        description: 'メールアドレスの確認後、ログインできるようになります。' 
      });
      
      // ログインページにリダイレクト
      router.push('/login');
      
      setIsLoading(false);
      return true;
      
    } catch (error: any) {
      // ネットワークエラーの場合もコンソールエラーを出さない
      toast({ 
        title: '登録エラー', 
        description: 'ネットワークエラーが発生しました。', 
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
      setIsLoading(true);
      
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        // エラーログを出さずにトーストのみ表示
        toast({ 
          title: 'ログアウトエラー', 
          description: result.error || 'ログアウトに失敗しました', 
          variant: 'destructive' 
        });
        setIsLoading(false);
        return false;
      }

      console.log('✅ Logout successful');
      setCurrentUser(null);
      
      // Firebase Authからもサインアウト
      const { getFirebaseAuth } = await import('@/lib/firebase/client');
      const { signOut } = await import('firebase/auth');
      const auth = getFirebaseAuth();
      if (auth) {
        try {
          await signOut(auth);
          console.log('✅ Firebase Auth signed out');
        } catch (error) {
          console.warn('⚠️ Could not sign out from Firebase Auth:', error);
        }
      }
      
      toast({ title: 'ログアウトしました' });
      
      // ログインページにリダイレクト
      router.push('/login');
      
      setIsLoading(false);
      return true;
      
    } catch (error: any) {
      // ネットワークエラーの場合もコンソールエラーを出さない
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
    isAuthenticated: !!currentUser, // シンプルに現在のユーザーがいるかどうか
    isLoading, // 初期セッション確認中はtrue
    hasInitialized, // 初期化状態を公開
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