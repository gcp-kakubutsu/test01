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
    // Get user preferences
    const preferences = await getMalePreferences(userId);
    
    if (!preferences) {
      return girls;
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
        // Since we don't have body type in the database, we can use bust/waist/hip ratios
        if (girl.bust && girl.waist && girl.hip) {
          const bustWaistRatio = girl.bust / girl.waist;
          const waistHipRatio = girl.waist / girl.hip;
          
          // Simple body type estimation based on ratios
          let estimatedBodyType = 'スリム';
          if (bustWaistRatio > 1.4 && waistHipRatio < 0.75) {
            estimatedBodyType = 'グラマー';
          } else if (bustWaistRatio < 1.2 && waistHipRatio > 0.85) {
            estimatedBodyType = 'スリム';
          } else if (girl.weight && girl.height) {
            const bmi = girl.weight / ((girl.height / 100) ** 2);
            if (bmi > 25) {
              estimatedBodyType = 'ぽっちゃり';
            }
          }
          
          if (preferences.partnerBodyTypes.includes(estimatedBodyType) || 
              preferences.partnerBodyTypes.includes('こだわらない')) {
            score += 25;
            reasons.push('体型が好みに合致');
          }
        }
      }

      // Cup size preference scoring (weight: 15)
      // Note: MalePreferences doesn't have bustSize field, so skip this for now
      if (girl.cup) {
        score += 5; // Small bonus for having cup size info
      }

      // Location scoring (weight: 35)
      if (userLocation && girl.shop.latitude && girl.shop.longitude) {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          girl.shop.latitude,
          girl.shop.longitude
        );
        
        if (distance <= 5) {
          score += 35;
          reasons.push('非常に近い（5km以内）');
        } else if (distance <= 10) {
          score += 25;
          reasons.push('近い（10km以内）');
        } else if (distance <= 20) {
          score += 15;
          reasons.push('アクセス可能（20km以内）');
        } else if (distance <= 50) {
          score += 5;
          reasons.push('少し遠い（50km以内）');
        }
      }

      // Personality traits scoring (weight: 10)
      // Note: MalePreferences doesn't have personalityTraits field, so skip this for now
      if (girl.character) {
        score += 5; // Small bonus for having character info
      }

      return {
        girl,
        score,
        reasons
      };
    });

    // Sort by score (highest first)
    scoredGirls.sort((a, b) => b.score - a.score);

    // Log top matches for debugging
    console.log('Top matches:', scoredGirls.slice(0, 5).map(sg => ({
      name: sg.girl.name,
      score: sg.score,
      reasons: sg.reasons
    })));

    return scoredGirls.map(sg => sg.girl);
  } catch (error) {
    console.error('Error sorting girls by preference:', error);
    return girls;
  }
}