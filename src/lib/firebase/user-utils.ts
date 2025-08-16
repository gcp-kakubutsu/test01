import { collection, query, where, getDocs, limit, QueryConstraint } from 'firebase/firestore';
import { db } from './client';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  imageUrl: string;
  bio: string;
  kinks: string[];
  location?: string;
  interests?: string[];
  dataAiHint?: string;
  additionalPhotos?: string[];
}


/**
 * Firebaseから管理者登録した女性ユーザーを取得
 * @param excludeUserId 除外するユーザーID（現在のユーザー）
 * @param limitCount 取得する最大件数
 * @returns ユーザープロフィールの配列
 */
export async function fetchAdminGirls(
  excludeUserId?: string,
  limitCount: number = 100
): Promise<UserProfile[]> {
  try {
    console.log('fetchAdminGirls called with:', { excludeUserId, limitCount });
    
    const constraints: QueryConstraint[] = [
      where('isGirl', '==', true),
      limit(limitCount)
    ];
    
    if (!db) throw new Error('Firestore is not initialized');
    
    const usersQuery = query(collection(db, 'users'), ...constraints);
    console.log('Query created, executing getDocs...');
    
    const querySnapshot = await getDocs(usersQuery);
    console.log('Query executed, found documents:', querySnapshot.size);
    
    const fetchedUsers: UserProfile[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('Processing document:', doc.id, data);
      
      if (!excludeUserId || data.uid !== excludeUserId) {
        fetchedUsers.push({
          id: doc.id,
          name: data.username || data.email?.split('@')[0] || '名前なし',
          age: data.age || 20,
          location: data.location || '未設定',
          imageUrl: data.profilePhotoUrl || 'https://placehold.co/400x600/FFB6C1/FFFFFF?text=User',
          bio: data.bio || '自己紹介はまだありません',
          kinks: data.interests || [],
          interests: data.interests || [],
          dataAiHint: "女性 ポートレート"
        });
      }
    });
    
    console.log('Returning users:', fetchedUsers.length);
    return fetchedUsers;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      // Permission denied when fetching users - returning empty array (silent)
      return [];
    }
    console.error('Error fetching admin girls:', error);
    // Return empty array instead of throwing
    return [];
  }
}

/**
 * ユーザー配列をシャッフル
 * @param users ユーザー配列
 * @returns シャッフルされたユーザー配列
 */
export function shuffleUsers(users: UserProfile[]): UserProfile[] {
  return [...users].sort(() => Math.random() - 0.5);
}