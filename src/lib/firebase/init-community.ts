import { collection, doc, setDoc, serverTimestamp, getDoc, getDocs, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

/**
 * Initialize community collections with sample data
 * This ensures the collections exist and have the proper structure
 */
export async function initializeCommunityCollections() {
  if (!db) {
    console.error('Firestore is not initialized');
    return false;
  }

  try {
    // First check if any communities exist
    const communitiesRef = collection(db, 'communities');
    const communitiesQuery = query(communitiesRef, limit(1));
    
    let hasExistingCommunities = false;
    try {
      const snapshot = await getDocs(communitiesQuery);
      hasExistingCommunities = !snapshot.empty;
    } catch (error: any) {
      // If permission denied, assume collection doesn't exist or is empty
      if (error.code === 'permission-denied') {
        console.log('Permission denied checking communities - will try to create');
      } else {
        console.error('Error checking communities:', error);
      }
    }
    
    // If no communities exist, create the default one
    if (!hasExistingCommunities) {
      console.log('No communities found, creating initial community...');
      
      // Check if communities collection exists by trying to get a document
      const testCommunityRef = doc(db, 'communities', 'general');
      
      let communityExists = false;
      try {
        const testCommunity = await getDoc(testCommunityRef);
        communityExists = testCommunity.exists();
      } catch (error: any) {
        if (error.code !== 'permission-denied') {
          console.error('Error checking community:', error);
        }
      }
      
      // If the general community doesn't exist, create it
      if (!communityExists) {
        console.log('Creating initial community...');
        
        try {
          // Create a general community
          await setDoc(testCommunityRef, {
            name: 'みんなの広場',
            description: 'Nukuneユーザー全員が参加できる交流の場です。気軽に投稿してみましょう！',
            memberCount: 0,
            category: 'general',
            imageUrl: '/img/community-general.jpg',
            members: [],
            createdAt: serverTimestamp(),
            createdBy: 'system'
          });
          
          console.log('Initial community created');
        } catch (error: any) {
          if (error.code === 'permission-denied') {
            console.log('Permission denied creating community - user may not have write access');
          } else {
            console.error('Error creating community:', error);
          }
        }
      }
    }
    
    // Check if posts collection exists
    let hasExistingPosts = false;
    try {
      const postsRef = collection(db, 'posts');
      const postsQuery = query(postsRef, limit(1));
      const postsSnapshot = await getDocs(postsQuery);
      hasExistingPosts = !postsSnapshot.empty;
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        console.log('Permission denied checking posts - will try to create');
      } else {
        console.error('Error checking posts:', error);
      }
    }
    
    // If no posts exist, create a welcome post
    if (!hasExistingPosts) {
      console.log('No posts found, creating welcome post...');
      
      try {
        const testPostRef = doc(db, 'posts', 'welcome');
        
        // Create a welcome post
        await setDoc(testPostRef, {
          author: 'Nukune運営',
          authorId: 'system',
          authorImage: '/img/nukune-logo.png',
          content: 'Nukuneコミュニティへようこそ！ここは皆さんが自由に交流できる場所です。楽しく、マナーを守って利用しましょう。',
          timestamp: serverTimestamp(),
          likes: 0,
          comments: 0,
          communityId: 'general',
          likedBy: []
        });
        
        console.log('Welcome post created');
      } catch (error: any) {
        if (error.code === 'permission-denied') {
          console.log('Permission denied creating post - user may not have write access');
        } else {
          console.error('Error creating post:', error);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing community collections:', error);
    return false;
  }
}

/**
 * Create required indexes for community queries
 * Note: Complex indexes need to be created in Firebase Console
 */
export function getCommunityIndexes() {
  return {
    communities: [
      {
        collection: 'communities',
        fields: [
          { field: 'memberCount', order: 'desc' }
        ]
      }
    ],
    posts: [
      {
        collection: 'posts',
        fields: [
          { field: 'communityId', order: 'asc' },
          { field: 'timestamp', order: 'desc' }
        ]
      }
    ]
  };
}