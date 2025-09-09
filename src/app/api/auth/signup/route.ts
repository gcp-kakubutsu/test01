import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * ユーザー登録時に16桁のユニークなpayment_uidを生成し、ユーザードキュメントへ付与するためのユーティリティ
 * - 文字セット: 英大小文字+数字（62種）
 * - 長さ: 16文字
 * - 一意性: Firestoreのusersコレクションで重複チェック（最大10回リトライ）
 */
const PAYMENT_UID_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PAYMENT_UID_LENGTH = 16;
const PAYMENT_UID_MAX_RETRIES = 10;

function generatePaymentUid(): string {
  let result = '';
  for (let i = 0; i < PAYMENT_UID_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * PAYMENT_UID_CHARSET.length);
    result += PAYMENT_UID_CHARSET[randomIndex];
  }
  return result;
}

async function checkPaymentUidUnique(db: FirebaseFirestore.Firestore, paymentUid: string): Promise<boolean> {
  const snap = await db.collection('users')
    .where('payment_uid', '==', paymentUid)
    .limit(1)
    .get();
  return snap.empty;
}

async function generateUniquePaymentUid(db: FirebaseFirestore.Firestore): Promise<string> {
  for (let attempt = 1; attempt <= PAYMENT_UID_MAX_RETRIES; attempt++) {
    const candidate = generatePaymentUid();
    const unique = await checkPaymentUidUnique(db, candidate);
    if (unique) return candidate;
    if (attempt < PAYMENT_UID_MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 100 * attempt));
    }
  }
  throw new Error('payment_uidのユニーク生成に失敗しました（最大リトライ到達）');
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, birthDate, gender } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: '必須項目が入力されていません' },
        { status: 400 }
      );
    }

    // Firebase Admin SDKが利用可能か確認
    try {
      const auth = getAdminAuth();
      const db = getAdminFirestore();

      // Firebase Admin SDKでユーザー作成
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email,
          password,
          emailVerified: false,
        });
      } catch (error: any) {
        console.error('User creation error:', error);
        
        let errorMessage = '登録に失敗しました';
        
        if (error.code === 'auth/email-already-exists') {
          errorMessage = 'このメールアドレスは既に使用されています';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'メールアドレスの形式が正しくありません';
        } else if (error.code === 'auth/weak-password' || (error.message && error.message.includes('password'))) {
          errorMessage = 'パスワードは6文字以上で設定してください';
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }

      // メール確認メールを非同期で送信（レート制限を回避）
      // ユーザー作成が完全に完了してからメールを送信
      console.log('📧 Scheduling verification email for:', email);
      
      // レスポンスを先に返してからメール送信を実行
      process.nextTick(() => {
        setTimeout(async () => {
          try {
            // ユーザー作成後、パスワードを使ってサインインしてIDトークンを取得
            const signInResponse = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  email,
                  password,
                  returnSecureToken: true,
                }),
              }
            );
            
            if (signInResponse.ok) {
              const signInData = await signInResponse.json();
              
              // IDトークンを使用してメール確認メールを送信
              const verifyResponse = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    requestType: 'VERIFY_EMAIL',
                    idToken: signInData.idToken,
                  }),
                }
              );
              
              if (verifyResponse.ok) {
                console.log('✅ Verification email sent successfully for:', email);
              } else {
                const verifyError = await verifyResponse.json();
                console.error('Failed to send verification email:', verifyError);
              }
            } else {
              const signInError = await signInResponse.json();
              console.error('Failed to sign in for email verification:', signInError);
            }
          } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
          }
        }, 3000); // 3秒待機してからメール送信
      });

      // Firestoreにユーザー情報を保存（トライアルデータ付き）
      const now = new Date();
      const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7日後
      
      const paymentUid = await generateUniquePaymentUid(db);
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        username,
        email,
        birthDate: birthDate || null,
        gender: gender || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        emailVerified: false,
        // 決済用UID
        payment_uid: paymentUid,
        payment_uid_created_at: FieldValue.serverTimestamp(),
        payment_uid_updated_at: FieldValue.serverTimestamp(),
        // トライアル関連フィールド
        trial: {
          startDate: now,
          endDate: trialEndDate,
          isActive: true,
          hasUsed: true,
          source: 'campaign_2025'
        },
        // サブスクリプション関連フィールド
        subscription: {
          status: 'none',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          pausedAt: null
        },
        billing: {
          customerId: null,
          paymentMethodId: null,
          lastPaymentDate: null,
          nextBillingDate: null
        },
        isPremium: true // トライアル中はプレミアム機能を使える
      });

      return NextResponse.json({
        success: true,
        message: 'アカウントを作成しました。メールアドレスの確認をお願いします。',
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
        },
      });
    } catch (adminError) {
      // Admin SDKが使えない場合はREST APIを使用（高速）
      console.log('Using REST API for signup');
      
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = '登録に失敗しました';
        
        if (data.error?.message === 'EMAIL_EXISTS') {
          errorMessage = 'このメールアドレスは既に使用されています';
        } else if (data.error?.message === 'INVALID_EMAIL') {
          errorMessage = 'メールアドレスの形式が正しくありません';
        } else if (data.error?.message === 'WEAK_PASSWORD') {
          errorMessage = 'パスワードは6文字以上で設定してください';
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }

      // メール確認メールを非同期で送信（IDトークンを使用）
      console.log('📧 Scheduling verification email for:', email);
      
      // レスポンスを先に返してからメール送信を実行
      process.nextTick(() => {
        setTimeout(async () => {
          try {
            // IDトークンを使用してメール確認メールを送信
            const verifyResponse = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  requestType: 'VERIFY_EMAIL',
                  idToken: data.idToken,  // 既にIDトークンがあるのでそれを使用
                }),
              }
            );

            if (!verifyResponse.ok) {
              const verifyData = await verifyResponse.json();
              console.error('Failed to send verification email:', verifyData);
            } else {
              console.log('✅ Verification email sent successfully for:', email);
            }
          } catch (error) {
            console.error('Failed to send verification email:', error);
          }
        }, 3000); // 3秒待機してからメール送信
      });

      // REST APIでユーザーが作成された場合もFirestoreにデータを保存
      try {
        const { getAdminFirestore, isAdminInitialized } = await import('@/lib/firebase/admin');
        
        if (isAdminInitialized()) {
          const adminFirestore = getAdminFirestore();
          console.log('[Signup] Creating user document in Firestore for REST API signup:', data.email);
          
          const now = new Date();
          const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7日後
          // payment_uid を生成
          const paymentUid = await (async () => {
            // isAdminInitialized() が true のときのみ adminFirestore 利用可
            // ここでは adminFirestore をそのまま使用
            for (let attempt = 1; attempt <= 10; attempt++) {
              const candidate = generatePaymentUid();
              const snap = await adminFirestore.collection('users')
                .where('payment_uid', '==', candidate)
                .limit(1)
                .get();
              if (snap.empty) return candidate;
              await new Promise(r => setTimeout(r, 100 * attempt));
            }
            throw new Error('payment_uidのユニーク生成に失敗しました（REST経路）');
          })();
          
          await adminFirestore.collection('users').doc(data.localId).set({
            uid: data.localId,
            username,
            email,
            birthDate: birthDate || null,
            gender: gender || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            emailVerified: false,
            // 決済用UID
            payment_uid: paymentUid,
            payment_uid_created_at: FieldValue.serverTimestamp(),
            payment_uid_updated_at: FieldValue.serverTimestamp(),
            // トライアル関連フィールド
            trial: {
              startDate: now,
              endDate: trialEndDate,
              isActive: true,
              hasUsed: true,
              source: 'campaign_2025'
            },
            // サブスクリプション関連フィールド
            subscription: {
              status: 'none',
              currentPeriodStart: null,
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              canceledAt: null,
              pausedAt: null
            },
            billing: {
              customerId: null,
              paymentMethodId: null,
              lastPaymentDate: null,
              nextBillingDate: null
            },
            isPremium: true // トライアル中はプレミアム機能を使える
          });
        }
      } catch (firestoreError) {
        console.error('[Signup] Failed to create Firestore user document:', firestoreError);
        // Firestoreエラーがあってもユーザー作成は成功しているので続行
      }

      return NextResponse.json({
        success: true,
        message: 'アカウントを作成しました。メールアドレスの確認をお願いします。',
        user: {
          uid: data.localId,
          email: data.email,
        },
      });
    }

  } catch (error: any) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}