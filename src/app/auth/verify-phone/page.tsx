"use client";

/**
 * @file 電話番号確認ページ
 * @summary Firebase Auth の SMS 認証を用いて、メール確認済みユーザーに電話番号を紐付け（リンク）するためのページ。
 * 既存セッション（IDトークンを Cookie 保存）を前提に、クライアントの Firebase Auth と同期し、
 * `linkWithPhoneNumber` → `confirmationResult.confirm(code)` の流れで電話番号を登録します。
 * @limitations reCAPTCHA はブラウザでの実行が必要で、Bot 判定やネットワーク状況により失敗する可能性があります。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getFirebaseAuth } from '@/lib/firebase/client';
import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  signInWithCustomToken,
  onAuthStateChanged,
  type ConfirmationResult,
} from 'firebase/auth';
import { Loader2 } from 'lucide-react';

/**
 * @typedef {Object} VerificationState
 * @property {boolean} isInitializing - 画面初期化（Firebase同期など）処理中か
 * @property {boolean} isSending - SMS 送信中か
 * @property {boolean} isVerifying - コード検証中か
 * @property {string} error - 画面表示用のエラーメッセージ
 */

export default function VerifyPhonePage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();

  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [state, setState] = useState<{ isInitializing: boolean; isSending: boolean; isVerifying: boolean; error: string }>({
    isInitializing: true,
    isSending: false,
    isVerifying: false,
    error: '',
  });

  /** @type {React.MutableRefObject<ConfirmationResult | null>} */
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  /** @type {React.MutableRefObject<RecaptchaVerifier | null>} */
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // 初期化: クライアントの Firebase Auth と同期
  useEffect(() => {
    let unsub: (() => void) | null = null;

    const init = async () => {
      try {
        const auth = getFirebaseAuth();
        if (!auth) {
          setState(s => ({ ...s, isInitializing: false }));
          return;
        }

        // サーバセッションのカスタムトークンを取得し、必要なら同期
        try {
          const tokenRes = await fetch('/api/auth/custom-token', { credentials: 'include' });
          if (tokenRes.ok) {
            const { customToken } = await tokenRes.json();
            if (customToken) {
              if (!auth.currentUser) {
                try {
                  await signInWithCustomToken(auth, customToken);
                } catch (e: any) {
                  // Admin SDKが使えずIDトークンが返ってきた場合など、失敗を許容
                  // 署名済み状態の復元を試みる
                  try {
                    const { signInWithIdToken } = await import('@/lib/firebase/auth-helper');
                    await signInWithIdToken(customToken);
                  } catch {
                    // 失敗しても継続（以後の処理で currentUser が必要な箇所では弾く）
                  }
                }
              }
            }
          }
        } catch {
          // 失敗しても継続
        }

        unsub = onAuthStateChanged(auth, (u) => {
          // 既に電話番号リンク済みならホームへ
          if (u && u.phoneNumber) {
            router.replace('/');
          }
        });
      } finally {
        setState(s => ({ ...s, isInitializing: false }));
      }
    };

    void init();
    return () => { if (unsub) unsub(); };
  }, [router]);

  const setupRecaptcha = useCallback(() => {
    const auth = getFirebaseAuth();
    if (!auth) return null;
    if (recaptchaRef.current) return recaptchaRef.current;
    // DOM 上のコンテナに invisible reCAPTCHA を作成
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => {},
    });
    recaptchaRef.current = verifier;
    return verifier;
  }, []);

  const handleSendCode = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    if (!auth.currentUser) {
      toast({ title: 'ログインが必要です', description: '先にメールとパスワードでログインしてください。', variant: 'destructive' });
      return;
    }
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      toast({ title: '入力エラー', description: '国コード付き電話番号（例: +81...）を入力してください。', variant: 'destructive' });
      return;
    }
    setState(s => ({ ...s, isSending: true, error: '' }));
    try {
      const verifier = setupRecaptcha();
      if (!verifier) throw new Error('reCAPTCHA の初期化に失敗しました');
      // 明示的にレンダリングしてウィジェットID確保
      try {
        await verifier.render();
      } catch {}
      confirmationResultRef.current = await linkWithPhoneNumber(auth.currentUser!, phoneNumber, verifier);
      toast({ title: 'SMS送信', description: '認証コードを送信しました。' });
    } catch (error: any) {
      console.error('sendCode error:', error);
      let msg = error?.message || 'SMS送信に失敗しました。';
      if (error?.code === 'auth/operation-not-allowed') {
        msg = 'Firebaseコンソールで電話番号サインインを有効にしてください。';
      } else if (error?.code === 'auth/app-not-authorized') {
        msg = '承認されていないドメインです。Firebaseの承認済みドメインに現在のドメインを追加してください。';
      } else if (error?.code === 'auth/too-many-requests') {
        msg = '試行回数が多すぎます。しばらくしてから再試行してください。';
      } else if (error?.code === 'auth/internal-error') {
        msg = '内部エラーが発生しました。承認済みドメインや設定を確認し、再度お試しください。';
      }
      setState(s => ({ ...s, error: msg }));
      try {
        // reCAPTCHA リセット試行
        const widgetId = await recaptchaRef.current?.render();
        if ((window as any).grecaptcha && (typeof widgetId === 'number' || typeof widgetId === 'string')) {
          (window as any).grecaptcha.reset(widgetId as any);
        }
      } catch {}
    } finally {
      setState(s => ({ ...s, isSending: false }));
    }
  }, [phoneNumber, setupRecaptcha, toast]);

  const handleVerifyCode = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    if (!verificationCode) {
      toast({ title: '入力エラー', description: 'SMSで受け取った認証コードを入力してください。', variant: 'destructive' });
      return;
    }
    setState(s => ({ ...s, isVerifying: true, error: '' }));
    try {
      const cr = confirmationResultRef.current;
      if (!cr) throw new Error('認証手続きが開始されていません。まずはコード送信を行ってください。');
      await cr.confirm(verificationCode);
      toast({ title: '電話番号登録完了', description: '電話番号の確認が完了しました。' });
      router.replace('/');
    } catch (error: any) {
      console.error('verifyCode error:', error);
      const message = error?.code === 'auth/invalid-verification-code'
        ? '認証コードが正しくありません。'
        : error?.message || '認証に失敗しました。';
      setState(s => ({ ...s, error: message }));
    } finally {
      setState(s => ({ ...s, isVerifying: false }));
    }
  }, [router, toast, verificationCode]);

  return (
    <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="font-bold text-xl sm:text-2xl">電話番号の確認</CardTitle>
          <CardDescription>SMSで届く認証コードで電話番号を登録します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.isInitializing ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-[#F0306A]" />
              <span className="ml-2 text-gray-600">準備中...</span>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm text-gray-700 mb-1">電話番号（国コード付き）</label>
                <Input
                  type="tel"
                  placeholder="例: +81 90 1234 5678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button className="w-full bg-[#F0306A] hover:bg-[#d91f5a]" onClick={handleSendCode} disabled={state.isSending}>
                  {state.isSending ? '送信中...' : 'コードを送信'}
                </Button>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">認証コード</label>
                <Input
                  type="text"
                  placeholder="SMSに届いた6桁のコード"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>

              <Button variant="outline" className="w-full" onClick={handleVerifyCode} disabled={state.isVerifying}>
                {state.isVerifying ? '確認中...' : '確認して完了する'}
              </Button>

              {state.error && (
                <p className="text-sm text-red-600">{state.error}</p>
              )}
            </>
          )}
          {/* reCAPTCHA container */}
          <div id="recaptcha-container" />
        </CardContent>
      </Card>
    </div>
  );
}


