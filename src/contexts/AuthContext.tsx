
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { type User, onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import type { AuthFormData } from '@/app/login/page'; // Assuming login and signup use similar structures
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (data: AuthFormData) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // User state will be updated by onAuthStateChanged
      toast({ title: 'ログインしました', description: 'Nukuneへようこそ！' });
    } catch (error: any) {
      console.error("Login error:", error);
      toast({ title: 'ログインエラー', description: error.message || 'ログインに失敗しました。', variant: 'destructive' });
      setIsLoading(false); // Ensure loading is stopped on error
      throw error; // Re-throw to allow page to handle
    }
    // setIsLoading(false) is handled by onAuthStateChanged effect
  };

  const signup = async (data: AuthFormData & { username: string }) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      if (userCredential.user) {
        // Save additional user info to Firestore
        await addUserToFirestore(userCredential.user.uid, data.username, data.email);
        // User state will be updated by onAuthStateChanged
        toast({ title: '登録完了！', description: 'Nukuneへようこそ！プロフィールを編集しましょう。' });
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({ title: '登録エラー', description: error.message || '登録に失敗しました。', variant: 'destructive' });
      setIsLoading(false); // Ensure loading is stopped on error
      throw error; // Re-throw to allow page to handle
    }
     // setIsLoading(false) is handled by onAuthStateChanged effect
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await firebaseSignOut(auth);
      // User state will be updated by onAuthStateChanged
      toast({ title: 'ログアウトしました' });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({ title: 'ログアウトエラー', description: error.message || 'ログアウトに失敗しました。', variant: 'destructive' });
      setIsLoading(false); // Ensure loading is stopped on error
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
      {!isLoading && children}
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
