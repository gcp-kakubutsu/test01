import { NextResponse } from 'next/server';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize admin if not already done
if (!getApps().find(app => app.name === 'admin')) {
  try {
    initializeApp(undefined, 'admin');
  } catch (e) {
    console.error('Firebase Admin SDK initialization error:', e);
  }
}

const sampleCommunities = [
  {
    name: 'カフェ巡り好きの会',
    description: '全国のおしゃれカフェ情報をシェアしましょう☕️',
    category: 'グルメ',
    imageUrl: 'https://placehold.co/400x200/8B4513/FFFFFF?text=Cafe',
    memberCount: 0,
    members: [],
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    name: 'アウトドア愛好会',
    description: 'キャンプ、登山、BBQなどアウトドア情報交換',
    category: 'アウトドア',
    imageUrl: 'https://placehold.co/400x200/228B22/FFFFFF?text=Outdoor',
    memberCount: 0,
    members: [],
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    name: '映画好きが集まる部屋',
    description: '最新映画から名作まで、映画の話で盛り上がろう',
    category: 'エンタメ',
    imageUrl: 'https://placehold.co/400x200/4B0082/FFFFFF?text=Movie',
    memberCount: 0,
    members: [],
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    name: '読書倶楽部',
    description: 'おすすめの本を紹介し合いましょう📚',
    category: '趣味',
    imageUrl: 'https://placehold.co/400x200/8B4513/FFFFFF?text=Books',
    memberCount: 0,
    members: [],
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    name: 'フィットネス仲間',
    description: '一緒に健康的なライフスタイルを目指そう💪',
    category: 'スポーツ',
    imageUrl: 'https://placehold.co/400x200/FF6347/FFFFFF?text=Fitness',
    memberCount: 0,
    members: [],
    createdBy: 'system',
    createdAt: new Date()
  }
];

export async function GET() {
  try {
    const adminApp = getApps().find(app => app.name === 'admin');
    if (!adminApp) {
      return NextResponse.json({ error: 'Firebase Admin SDK not initialized' }, { status: 500 });
    }
    
    const db = getFirestore(adminApp);
    const communitiesRef = db.collection('communities');
    
    // Check if communities already exist
    const snapshot = await communitiesRef.get();
    if (!snapshot.empty) {
      return NextResponse.json({ 
        message: 'Communities already exist', 
        count: snapshot.size 
      });
    }
    
    // Add sample communities
    const batch = db.batch();
    for (const community of sampleCommunities) {
      const docRef = communitiesRef.doc();
      batch.set(docRef, community);
    }
    
    await batch.commit();
    
    return NextResponse.json({ 
      message: 'Sample communities created successfully', 
      count: sampleCommunities.length 
    });
  } catch (error) {
    console.error('Error creating sample communities:', error);
    return NextResponse.json(
      { error: 'Failed to create sample communities' }, 
      { status: 500 }
    );
  }
}