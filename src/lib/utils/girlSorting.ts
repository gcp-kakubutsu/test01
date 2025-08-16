import { GirlWithDetails } from '@/types/database';
import { getMalePreferences } from '@/lib/firebase/malePreferences';
import type { LocationCoordinates } from './location';

// Calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function sortGirlsByPreference(
  girls: GirlWithDetails[],
  userId: string,
  userLocation?: LocationCoordinates | null,
  userProfileLocation?: string | null
): Promise<GirlWithDetails[]> {
  try {
    // Get user preferences (only if userId is valid)
    let preferences = null;
    if (userId && userId.trim() !== '') {
      preferences = await getMalePreferences(userId);
    }
    
    // Even without preferences, we should sort by distance and ID for consistency
    if (!preferences) {
      // デフォルトソート: 距離とIDで安定したソート
      const sortedByDefault = [...girls].sort((a, b) => {
        // 距離でソート（位置情報がある場合）
        if (userLocation && a.shop?.latitude && a.shop?.longitude && b.shop?.latitude && b.shop?.longitude) {
          const distanceA = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            a.shop.latitude,
            a.shop.longitude
          );
          const distanceB = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            b.shop.latitude,
            b.shop.longitude
          );
          if (distanceA !== distanceB) {
            return distanceA - distanceB;
          }
        }
        // IDでソート（安定性のため）
        return a.id - b.id;
      });
      return sortedByDefault;
    }
    
    // Score each girl based on preferences
    const scoredGirls = girls.map(girl => {
      let score = 0;
      const reasons: string[] = [];

      // Age preference scoring (weight: 30)
      if (girl.age && preferences.partnerAgeMin && preferences.partnerAgeMax) {
        if (girl.age >= preferences.partnerAgeMin && girl.age <= preferences.partnerAgeMax) {
          score += 30;
          reasons.push('年齢が希望範囲内');
        } else {
          // Partial score for close ages
          const ageDiff = Math.min(
            Math.abs(girl.age - preferences.partnerAgeMin),
            Math.abs(girl.age - preferences.partnerAgeMax)
          );
          if (ageDiff <= 5) {
            score += 15;
            reasons.push('年齢が希望に近い');
          }
        }
      }

      // Height preference scoring (weight: 20)
      if (girl.height && preferences.partnerHeight) {
        // Parse height preference (e.g., "150-160cm" or "any")
        if (preferences.partnerHeight !== 'こだわらない' && preferences.partnerHeight !== 'any') {
          const match = preferences.partnerHeight.match(/(\d+)-(\d+)/);
          if (match) {
            const minHeight = parseInt(match[1]);
            const maxHeight = parseInt(match[2]);
            if (girl.height >= minHeight && girl.height <= maxHeight) {
              score += 20;
              reasons.push('身長が希望範囲内');
            } else {
              const heightDiff = Math.min(
                Math.abs(girl.height - minHeight),
                Math.abs(girl.height - maxHeight)
              );
              if (heightDiff <= 10) {
                score += 10;
                reasons.push('身長が希望に近い');
              }
            }
          }
        }
      }

      // Body type preference scoring (weight: 25)
      if (preferences.partnerBodyTypes && preferences.partnerBodyTypes.length > 0) {
        if (girl.bust && girl.waist && girl.hip) {
          const bustWaistRatio = girl.bust / girl.waist;
          const waistHipRatio = girl.waist / girl.hip;
          
          // より詳細な体型推定
          let estimatedBodyType = 'スリム';
          if (girl.weight && girl.height) {
            const bmi = girl.weight / ((girl.height / 100) ** 2);
            if (bmi < 18.5) {
              estimatedBodyType = 'やや細め';
            } else if (bmi >= 18.5 && bmi < 22) {
              if (bustWaistRatio > 1.35) {
                estimatedBodyType = 'グラマー';
              } else {
                estimatedBodyType = 'スリム';
              }
            } else if (bmi >= 22 && bmi < 25) {
              if (bustWaistRatio > 1.4) {
                estimatedBodyType = 'グラマー';
              } else {
                estimatedBodyType = 'やややっちゃり';
              }
            } else if (bmi >= 25) {
              estimatedBodyType = 'ぽっちゃり';
            }
          } else if (bustWaistRatio > 1.45 && waistHipRatio < 0.7) {
            estimatedBodyType = 'グラマー';
          } else if (bustWaistRatio < 1.25 && waistHipRatio > 0.85) {
            estimatedBodyType = 'スリム';
          }
          
          if (preferences.partnerBodyTypes.includes(estimatedBodyType) || 
              preferences.partnerBodyTypes.includes('こだわらない')) {
            score += 25;
            reasons.push(`体型(${estimatedBodyType})が好みに合致`);
          } else {
            // 部分的な一致でも少しスコアを付与
            if ((estimatedBodyType === 'やや細め' && preferences.partnerBodyTypes.includes('スリム')) ||
                (estimatedBodyType === 'スリム' && preferences.partnerBodyTypes.includes('やや細め'))) {
              score += 10;
              reasons.push('体型が好みに近い');
            }
          }
        }
      }

      // Cup size and bust preference scoring (weight: 15)
      if (girl.cup && girl.bust) {
        // カップサイズのスコアリング
        const cupValue = {
          'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8
        }[girl.cup.charAt(0)] || 3;
        
        // ユーザーの好みに基づいてスコアリング（グラマー好きは大きめを好む）
        if (preferences.partnerBodyTypes?.includes('グラマー')) {
          if (cupValue >= 4) { // D cup以上
            score += 15;
            reasons.push(`バスト(${girl.cup})が好みに合致`);
          } else if (cupValue >= 3) {
            score += 7;
          }
        } else if (preferences.partnerBodyTypes?.includes('スリム') || 
                   preferences.partnerBodyTypes?.includes('やや細め')) {
          if (cupValue <= 3) { // C cup以下
            score += 15;
            reasons.push(`バスト(${girl.cup})が好みに合致`);
          } else if (cupValue <= 4) {
            score += 7;
          }
        } else {
          // 特に好みがない場合は少しボーナス
          score += 5;
        }
      }

      // Location scoring (weight: 50) - 位置情報の重要度を高める
      let distanceValue = Infinity;
      if (userLocation && girl.shop?.latitude && girl.shop?.longitude) {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          girl.shop.latitude,
          girl.shop.longitude
        );
        distanceValue = distance;
        
        // より細かい距離スコアリング
        if (distance <= 1) {
          score += 50;
          reasons.push('とても近い（1km以内）');
        } else if (distance <= 3) {
          score += 45;
          reasons.push('非常に近い（3km以内）');
        } else if (distance <= 5) {
          score += 40;
          reasons.push('近い（5km以内）');
        } else if (distance <= 10) {
          score += 30;
          reasons.push('アクセス良好（10km以内）');
        } else if (distance <= 15) {
          score += 20;
          reasons.push('アクセス可能（15km以内）');
        } else if (distance <= 25) {
          score += 10;
          reasons.push('やや遠い（25km以内）');
        } else if (distance <= 50) {
          score += 5;
          reasons.push('遠い（50km以内）');
        }
      }

      // Sexual preferences and play style scoring (weight: 30)
      let sexualCompatibilityScore = 0;
      const sexualReasons: string[] = [];
      
      // S/M compatibility
      if (preferences.isSadist === 'はい' && girl.character) {
        if (girl.character.includes('M') || girl.character.includes('従順') || 
            girl.character.includes('受け身')) {
          sexualCompatibilityScore += 10;
          sexualReasons.push('S/M相性良好');
        }
      } else if (preferences.isMasochist === 'はい' && girl.character) {
        if (girl.character.includes('S') || girl.character.includes('責め') || 
            girl.character.includes('リード')) {
          sexualCompatibilityScore += 10;
          sexualReasons.push('M/S相性良好');
        }
      }
      
      // Play style compatibility based on tokui_play field
      if (girl.tokui_play) {
        const playLower = girl.tokui_play.toLowerCase();
        
        // Check each preference
        if (preferences.cosplay >= 4 && 
            (playLower.includes('コスプレ') || playLower.includes('cosplay'))) {
          sexualCompatibilityScore += 5;
          sexualReasons.push('コスプレ対応');
        }
        
        if (preferences.toyPlay >= 4 && 
            (playLower.includes('おもちゃ') || playLower.includes('バイブ') || 
             playLower.includes('ローター'))) {
          sexualCompatibilityScore += 5;
          sexualReasons.push('おもちゃ使用可');
        }
        
        if (preferences.deepthroat >= 4 && 
            (playLower.includes('イラマ') || playLower.includes('ディープ'))) {
          sexualCompatibilityScore += 5;
          sexualReasons.push('ディープ対応');
        }
        
        if (preferences.analPlay >= 4 && 
            (playLower.includes('アナル') || playLower.includes('AF'))) {
          sexualCompatibilityScore += 5;
          sexualReasons.push('アナル対応');
        }
      }
      
      score += sexualCompatibilityScore;
      if (sexualReasons.length > 0) {
        reasons.push(...sexualReasons);
      }

      return {
        girl,
        score,
        reasons,
        distance: distanceValue
      };
    });

    // Sort by score first, then by distance, then by ID for stable sorting
    scoredGirls.sort((a, b) => {
      // まずスコアで比較
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // スコアが同じ場合は距離で比較（近い方が優先）
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      // 距離も同じ場合はIDで比較（安定したソート順を保証）
      return a.girl.id - b.girl.id;
    });

    return scoredGirls.map(sg => sg.girl);
  } catch (error) {
    console.error('Error in sortGirlsByPreference:', error);
    // エラー時も安定したソートを返す
    const sortedByDefault = [...girls].sort((a, b) => {
      // 距離でソート（位置情報がある場合）
      if (userLocation && a.shop?.latitude && a.shop?.longitude && b.shop?.latitude && b.shop?.longitude) {
        const distanceA = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          a.shop.latitude,
          a.shop.longitude
        );
        const distanceB = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          b.shop.latitude,
          b.shop.longitude
        );
        if (distanceA !== distanceB) {
          return distanceA - distanceB;
        }
      }
      // IDでソート（安定性のため）
      return a.id - b.id;
    });
    return sortedByDefault;
  }
}