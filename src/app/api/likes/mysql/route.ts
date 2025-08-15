import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/mysql/db';
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Like request body:', body);
    
    const { fromUserId, toGirlId } = body;

    if (!fromUserId || !toGirlId) {
      console.error('Missing fields:', { fromUserId, toGirlId });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify the user is authenticated
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // For client-side requests without Bearer token, we trust the fromUserId
      // In production, you should implement proper authentication
    }

    // Check if the girl exists
    const girlQuery = `
      SELECT id, name FROM girl_profiles 
      WHERE id = ? AND is_displayed = 1 AND deleted_at IS NULL
    `;
    
    console.log('Checking if girl exists with ID:', toGirlId);
    
    let girls: { id: number; name: string }[];
    
    try {
      girls = await query<{ id: number; name: string }>(girlQuery, [toGirlId]);
      
      if (girls.length === 0) {
        console.error('Girl not found with ID:', toGirlId);
        return NextResponse.json(
          { error: 'Girl not found' },
          { status: 404 }
        );
      }
    } catch (dbError) {
      console.error('Database error when checking girl:', dbError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    const girl = girls[0];

    // Create a unique identifier for MySQL girls
    const mysqlGirlId = `mysql_girl_${toGirlId}`;

    // Check if like already exists
    console.log('Checking existing likes for:', { fromUserId, mysqlGirlId });
    
    try {
      if (!db) {
        throw new Error('Firestore database not initialized');
      }
      const likesRef = collection(db, 'likes');
      const q = firestoreQuery(
        likesRef,
        where('from', '==', fromUserId),
        where('to', '==', mysqlGirlId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        console.log('Like already exists');
        return NextResponse.json({ 
          success: true, 
          alreadyLiked: true 
        });
      }

      // Create the like document
      console.log('Creating new like document');
      const likeData = {
        from: fromUserId,
        to: mysqlGirlId,
        toGirlName: girl.name,
        toGirlId: toGirlId,
        isGirlProfile: true, // Flag to indicate this is a MySQL girl profile
        createdAt: Timestamp.now(), // Use Timestamp.now() instead of serverTimestamp()
        seen: false
      };
      
      console.log('Like data to save:', likeData);
      
      await addDoc(likesRef, likeData);
      
      console.log('Like created successfully');
    } catch (firestoreError) {
      console.error('Firestore error:', firestoreError);
      return NextResponse.json(
        { error: 'Failed to save like' },
        { status: 500 }
      );
    }

    // Note: Unlike user-to-user likes, there's no match creation 
    // since MySQL girls can't like users back

    return NextResponse.json({ 
      success: true, 
      alreadyLiked: false 
    });

  } catch (error) {
    console.error('Error sending like to MySQL girl:', error);
    return NextResponse.json(
      { error: 'Failed to send like' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const girlId = searchParams.get('girlId');

    if (!userId || !girlId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Check if like exists
    const mysqlGirlId = `mysql_girl_${girlId}`;
    if (!db) {
      throw new Error('Firestore database not initialized');
    }
    const likesRef = collection(db, 'likes');
    const q = firestoreQuery(
      likesRef,
      where('from', '==', userId),
      where('to', '==', mysqlGirlId)
    );
    
    const querySnapshot = await getDocs(q);
    
    return NextResponse.json({ 
      hasLiked: !querySnapshot.empty 
    });

  } catch (error) {
    console.error('Error checking like status:', error);
    return NextResponse.json(
      { error: 'Failed to check like status' },
      { status: 500 }
    );
  }
}