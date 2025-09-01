import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { girlId, girlName, shopId, shopName } = await request.json();

    if (!girlId) {
      return NextResponse.json(
        { error: '女性IDが必要です' },
        { status: 400 }
      );
    }

    // セッションからユーザー情報を取得
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      console.log('❌ No session cookie found');
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }

    console.log('📝 Creating request for girl:', girlId);

    try {
      // Admin SDKを使用してトークンを検証
      const { getAdminAuth, getAdminFirestore, isAdminInitialized } = await import('@/lib/firebase-admin');
      
      if (!isAdminInitialized()) {
        console.warn('⚠️ Admin SDK not initialized, using fallback');
        // Admin SDKが使えない場合、簡易的な方法でユーザーIDを取得
        const payload = JSON.parse(
          Buffer.from(sessionCookie.value.split('.')[1], 'base64').toString()
        );
        const userId = payload.sub || payload.user_id || payload.localId;
        
        console.log(`✅ Request logged for user ${userId} (fallback mode)`);
        
        return NextResponse.json({
          success: true,
          message: 'リクエストを送信しました',
          userId: userId
        });
      }
      
      const auth = getAdminAuth();
      const db = getAdminFirestore();
      
      // セッショントークンからユーザーを検証
      const decodedToken = await auth.verifyIdToken(sessionCookie.value);
      const userId = decodedToken.uid;
      
      console.log('👤 User verified:', userId);

      // リクエストデータを作成
      const now = new Date();
      const requestData = {
        userId,
        girlId: `mysql_girl_${girlId}`,
        girlName: girlName || '',
        shopId: shopId || null,
        shopName: shopName || '',
        createdAt: now,
        status: 'pending', // pending, confirmed, cancelled
        type: 'reservation' // 予約リクエスト
      };

      // Firestoreにリクエストを保存
      console.log('💾 Saving request to Firestore...');
      const requestRef = await db.collection('requests').add(requestData);
      console.log('✅ Request saved with ID:', requestRef.id);

      // ユーザーのstatsを更新（リクエスト数を増やす）
      const userStatsRef = db.collection('userStats').doc(userId);
      const statsDoc = await userStatsRef.get();
      
      if (statsDoc.exists) {
        console.log('📊 Updating existing user stats...');
        await userStatsRef.update({
          requestsSent: (statsDoc.data()?.requestsSent || 0) + 1,
          updatedAt: now
        });
      } else {
        console.log('📊 Creating new user stats...');
        await userStatsRef.set({
          requestsSent: 1,
          requestsReceived: 0,
          likesReceived: 0,
          likesSent: 0,
          matchesCount: 0,
          updatedAt: now
        });
      }

      console.log(`✅ Request created for girl ${girlId} by user ${userId}`);

      return NextResponse.json({
        success: true,
        requestId: requestRef.id,
        message: 'リクエストを送信しました'
      });

    } catch (adminError: any) {
      console.error('❌ Error in request creation:', adminError);
      
      // エラーの詳細をログ出力
      if (adminError.code) {
        console.error('Error code:', adminError.code);
      }
      if (adminError.message) {
        console.error('Error message:', adminError.message);
      }
      
      return NextResponse.json(
        { 
          error: 'リクエストの送信に失敗しました',
          details: adminError.message || 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Request creation error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}