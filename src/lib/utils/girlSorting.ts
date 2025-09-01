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
  console.log('🎯 [sortGirlsByPreference] Starting sort with:', {
    girlsCount: girls.length,
    userId,
    hasUserLocation: !!userLocation,
    userProfileLocation
  });
  
  try {
    // Get user preferences (only if userId is valid)
    let preferences = null;
    if (userId && userId.trim() !== '') {
      console.log('📊 [sortGirlsByPreference] Fetching preferences for user:', userId);
      preferences = await getMalePreferences(userId);
      
      // より詳細なデバッグ情報
      if (preferences) {
        console.log('✅ [sortGirlsByPreference] Preferences fetched successfully');
        console.log('   - isComplete:', preferences.isComplete);
        console.log('   - partnerAgeRange:', `${preferences.partnerAgeMin || '?'}-${preferences.partnerAgeMax || '?'}`);
        console.log('   - partnerBodyTypes:', preferences.partnerBodyTypes);
        console.log('   - partnerHeight:', preferences.partnerHeight);
        console.log('   - girlTypeIds:', preferences.girlTypeIds);
        console.log('   - Full preferences object:', preferences);
      } else {
        console.log('❌ [sortGirlsByPreference] No preferences found for user');
      }
    } else {
      console.log('⚠️ [sortGirlsByPreference] No valid userId, using default sort');
    }
    
    // Even without preferences, we should sort by distance and ID for consistency
    // preferencesが全くない場合のみデフォルトソートを使用
    if (!preferences) {
      console.log('🔄 [sortGirlsByPreference] Using default sort (no preferences)');
      // デフォルトソート: サーバーから提供された距離を優先
      const sortedByDefault = [...girls].sort((a, b) => {
        // サーバーから提供されたdistance_kmフィールドを最優先で使用
        const distA = (a as any).distance_km !== undefined ? (a as any).distance_km : 999999;
        const distB = (b as any).distance_km !== undefined ? (b as any).distance_km : 999999;
        
        if (distA !== distB) {
          return distA - distB;
        }
        
        // distance_kmがない場合は計算（フォールバック）
        if (userLocation && a.shop?.latitude && a.shop?.longitude && b.shop?.latitude && b.shop?.longitude) {
          const calculatedDistA = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            a.shop.latitude,
            a.shop.longitude
          );
          const calculatedDistB = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            b.shop.latitude,
            b.shop.longitude
          );
          if (calculatedDistA !== calculatedDistB) {
            return calculatedDistA - calculatedDistB;
          }
        }
        // IDでソート（安定性のため）
        return a.id - b.id;
      });
      return sortedByDefault;
    }
    
    // Score each girl based on preferences
    console.log('🎲 [sortGirlsByPreference] Starting scoring for', girls.length, 'girls with preferences');
    const scoredGirls = girls.map(girl => {
      let score = 0;
      const reasons: string[] = [];

      // Girl type preference scoring (weight: 300-500) - 最重要！！
      if (preferences.girlTypeIds && preferences.girlTypeIds.length > 0 && girl.girlTypes) {
        const matchingTypes = girl.girlTypes.filter((girlType: any) => 
          preferences.girlTypeIds?.includes(girlType.id)
        );
        
        if (matchingTypes.length > 0) {
          // マッチするタイプの数に応じて大幅にスコアを増やす（基礎300点 + 追加100点/タイプ）
          score += 300 + (matchingTypes.length * 100);
          const typeNames = matchingTypes.map((t: any) => t.name).join('、');
          reasons.push(`✨タイプが完全一致（${typeNames}）`);
          
          // 全タイプ一致でボーナス
          if (matchingTypes.length >= 3) {
            score += 100;
            reasons.push('複数タイプ完全一致ボーナス');
          }
        } else {
          // 部分的な類似性をチェック（関連するタイプ）
          const hasRelatedType = girl.girlTypes.some((girlType: any) => {
            // 類似カテゴリーのチェック（例：class_idが同じ）
            return preferences.girlTypeIds?.some((prefId: number) => {
              // ここでは簡単な実装として、IDの近さでチェック
              return Math.abs(girlType.id - prefId) <= 3;
            });
          });
          
          if (hasRelatedType) {
            score += 50;
            reasons.push('タイプが部分的に一致');
          }
        }
      }

      // Age preference scoring (weight: 20) - 重要度を下げる
      if (girl.age && preferences.partnerAgeMin && preferences.partnerAgeMax) {
        if (girl.age >= preferences.partnerAgeMin && girl.age <= preferences.partnerAgeMax) {
          score += 20;
          reasons.push('年齢が希望範囲内');
        } else {
          // Partial score for close ages
          const ageDiff = Math.min(
            Math.abs(girl.age - preferences.partnerAgeMin),
            Math.abs(girl.age - preferences.partnerAgeMax)
          );
          if (ageDiff <= 5) {
            score += 10;
            reasons.push('年齢が希望に近い');
          }
        }
      }

      // Height preference scoring (weight: 15) - 重要度を下げる
      if (girl.height && preferences.partnerHeight) {
        // Parse height preference (e.g., "150-160cm" or "any")
        if (preferences.partnerHeight !== 'こだわらない' && preferences.partnerHeight !== 'any') {
          const match = preferences.partnerHeight.match(/(\d+)-(\d+)/);
          if (match) {
            const minHeight = parseInt(match[1]);
            const maxHeight = parseInt(match[2]);
            if (girl.height >= minHeight && girl.height <= maxHeight) {
              score += 15;
              reasons.push('身長が希望範囲内');
            } else {
              const heightDiff = Math.min(
                Math.abs(girl.height - minHeight),
                Math.abs(girl.height - maxHeight)
              );
              if (heightDiff <= 10) {
                score += 7;
                reasons.push('身長が希望に近い');
              }
            }
          }
        }
      }

      // Body type preference scoring (weight: 20) - 重要度を下げる
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
            score += 20;
            reasons.push(`体型(${estimatedBodyType})が好みに合致`);
          } else {
            // 部分的な一致でも少しスコアを付与
            if ((estimatedBodyType === 'やや細め' && preferences.partnerBodyTypes.includes('スリム')) ||
                (estimatedBodyType === 'スリム' && preferences.partnerBodyTypes.includes('やや細め'))) {
              score += 8;
              reasons.push('体型が好みに近い');
            }
          }
        }
      }

      // Cup size and bust preference scoring (weight: 10) - 重要度を下げる
      if (girl.cup && girl.bust) {
        // カップサイズのスコアリング
        const cupValue = {
          'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8
        }[girl.cup.charAt(0)] || 3;
        
        // ユーザーの好みに基づいてスコアリング（グラマー好きは大きめを好む）
        if (preferences.partnerBodyTypes?.includes('グラマー')) {
          if (cupValue >= 4) { // D cup以上
            score += 10;
            reasons.push(`バスト(${girl.cup})が好みに合致`);
          } else if (cupValue >= 3) {
            score += 5;
          }
        } else if (preferences.partnerBodyTypes?.includes('スリム') || 
                   preferences.partnerBodyTypes?.includes('やや細め')) {
          if (cupValue <= 3) { // C cup以下
            score += 10;
            reasons.push(`バスト(${girl.cup})が好みに合致`);
          } else if (cupValue <= 4) {
            score += 5;
          }
        } else {
          // 特に好みがない場合は少しボーナス
          score += 3;
        }
      }

      // Location scoring (weight: 30) - 位置情報の重要度を下げる（タイプ優先）
      let distanceValue = Infinity;
      
      // サーバーから提供されたdistance_kmを優先的に使用
      if ((girl as any).distance_km !== undefined) {
        distanceValue = (girl as any).distance_km;
      } else if (userLocation && girl.shop?.latitude && girl.shop?.longitude) {
        // distance_kmがない場合のみ計算
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          girl.shop.latitude,
          girl.shop.longitude
        );
        distanceValue = distance;
      }
      
      // より細かい距離スコアリング（distanceValueを使用）
      if (distanceValue !== Infinity) {
        if (distanceValue <= 1) {
          score += 30;
          reasons.push('とても近い（1km以内）');
        } else if (distanceValue <= 3) {
          score += 27;
          reasons.push('非常に近い（3km以内）');
        } else if (distanceValue <= 5) {
          score += 24;
          reasons.push('近い（5km以内）');
        } else if (distanceValue <= 10) {
          score += 18;
          reasons.push('アクセス良好（10km以内）');
        } else if (distanceValue <= 15) {
          score += 12;
          reasons.push('アクセス可能（15km以内）');
        } else if (distanceValue <= 25) {
          score += 6;
          reasons.push('やや遠い（25km以内）');
        } else if (distanceValue <= 50) {
          score += 3;
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

    // Sort by distance first (with threshold), then by score, then by ID for stable sorting
    scoredGirls.sort((a, b) => {
      // 【重要】距離を最優先でソート（5km以上の差がある場合）
      const distDiff = Math.abs(a.distance - b.distance);
      if (distDiff > 5) {
        // 5km以上離れている場合は距離優先
        return a.distance - b.distance;
      }
      
      // 距離が近い場合（5km以内）はスコアで比較
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      
      // スコアも同じ場合は距離で細かく比較
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      
      // 最後にIDで比較（安定したソート順を保証）
      return a.girl.id - b.girl.id;
    });

    // Top 5のスコアをログ出力
    console.log('🏆 [sortGirlsByPreference] Top 5 sorted results:');
    scoredGirls.slice(0, 5).forEach((sg, index) => {
      console.log(`  ${index + 1}. ${sg.girl.name} (ID: ${sg.girl.id})`, {
        score: sg.score,
        distance: sg.distance !== Infinity ? `${sg.distance.toFixed(1)}km` : 'N/A',
        reasons: sg.reasons
      });
    });

    return scoredGirls.map(sg => sg.girl);
  } catch (error) {
    console.error('Error in sortGirlsByPreference:', error);
    // エラー時も距離優先のソートを返す
    const sortedByDefault = [...girls].sort((a, b) => {
      // サーバーから提供されたdistance_kmフィールドを最優先で使用
      const distA = (a as any).distance_km !== undefined ? (a as any).distance_km : 999999;
      const distB = (b as any).distance_km !== undefined ? (b as any).distance_km : 999999;
      
      if (distA !== distB) {
        return distA - distB;
      }
      
      // distance_kmがない場合は計算（フォールバック）
      if (userLocation && a.shop?.latitude && a.shop?.longitude && b.shop?.latitude && b.shop?.longitude) {
        const calculatedDistA = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          a.shop.latitude,
          a.shop.longitude
        );
        const calculatedDistB = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          b.shop.latitude,
          b.shop.longitude
        );
        if (calculatedDistA !== calculatedDistB) {
          return calculatedDistA - calculatedDistB;
        }
      }
      // IDでソート（安定性のため）
      return a.id - b.id;
    });
    return sortedByDefault;
  }
}