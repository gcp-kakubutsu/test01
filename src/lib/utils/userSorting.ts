import { type UserProfile } from '@/lib/firebase/user-utils';
import { type LocationCoordinates, calculateDistance, getCoordinatesFromAddress } from '@/lib/utils/location';
import { getMalePreferences } from '@/lib/firebase/malePreferences';

/**
 * ユーザーの位置情報と活動エリア設定に基づいて女性ユーザーをソートする
 * 優先順位:
 * 1. GPS位置情報による距離順
 * 2. プロフィールの住所による距離順  
 * 3. 活動エリアのマッチング
 */
export async function sortUsersByPreference(
  users: UserProfile[], 
  currentUserId: string,
  userLocation?: LocationCoordinates | null,
  userProfileLocation?: string
): Promise<UserProfile[]> {
  if (users.length === 0) return users;

  try {
    // 男性ユーザーの活動エリア設定を取得
    const malePreferences = await getMalePreferences(currentUserId);
    const userActivityAreas: string[] = [];

    // 各ユーザーに優先度スコアを付与
    const usersWithScore = users.map(user => {
      let score = 0;
      let distance = Infinity;

      // 1. GPS位置情報による距離計算（最優先）
      if (userLocation && user.location) {
        const userCoords = getCoordinatesFromAddress(user.location);
        if (userCoords) {
          distance = calculateDistance(userLocation.lat, userLocation.lng, userCoords.lat, userCoords.lng);
          // GPSによる距離スコア（距離が近いほど高スコア）
          score += Math.max(0, 1000 - distance);
        }
      }
      
      // 2. プロフィールの住所による距離計算（GPS無い場合の次善策）
      else if (!userLocation && userProfileLocation && user.location) {
        const userCoords = getCoordinatesFromAddress(userProfileLocation);
        const targetCoords = getCoordinatesFromAddress(user.location);
        if (userCoords && targetCoords) {
          distance = calculateDistance(userCoords.lat, userCoords.lng, targetCoords.lat, targetCoords.lng);
          // 住所による距離スコア（GPSより低い基準）
          score += Math.max(0, 500 - distance);
        }
      }

      // 3. 活動エリアのマッチング（最後の優先順位）
      if (userActivityAreas.length > 0 && user.location) {
        // ユーザーの居住地が活動エリアに含まれているかチェック
        const isInActivityArea = userActivityAreas.some((area: string) => {
          // 完全一致または部分一致でチェック
          return user.location?.includes(area) || area.includes(user.location || '');
        });
        
        if (isInActivityArea) {
          score += 100; // 活動エリアマッチボーナス
        }
      }

      return {
        ...user,
        _score: score,
        _distance: distance
      };
    });

    // スコア順（高い順）でソート、同スコアなら距離順（近い順）
    const sortedUsers = usersWithScore.sort((a, b) => {
      if (b._score !== a._score) {
        return b._score - a._score; // スコア降順
      }
      return a._distance - b._distance; // 距離昇順
    });

    // スコアと距離の情報を削除して返す
    return sortedUsers.map(({ _score, _distance, ...user }) => user);

  } catch (error) {
    console.error('Error sorting users by preference:', error);
    // エラー時は元の配列をそのまま返す
    return users;
  }
}

/**
 * 活動エリア設定に基づいて女性ユーザーをフィルタリング
 */
export async function filterUsersByActivityArea(
  users: UserProfile[],
  currentUserId: string
): Promise<UserProfile[]> {
  try {
    const malePreferences = await getMalePreferences(currentUserId);
    const userActivityAreas: string[] = [];

    if (userActivityAreas.length === 0) {
      return users; // 活動エリア未設定の場合は全ユーザー表示
    }

    return users.filter(user => {
      if (!user.location) return false;
      
      // ユーザーの居住地が活動エリアに含まれているかチェック
      return userActivityAreas.some((area: string) => {
        return user.location?.includes(area) || area.includes(user.location || '');
      });
    });

  } catch (error) {
    console.error('Error filtering users by activity area:', error);
    return users; // エラー時は全ユーザー表示
  }
}