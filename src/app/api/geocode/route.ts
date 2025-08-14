import { NextRequest, NextResponse } from 'next/server';
import { geocodeCache, createCacheKey, createAddressCacheKey } from '@/lib/geocode-cache';
import { performanceMonitor } from '@/lib/performance-monitor';

// Edge Runtime for better performance
export const runtime = 'edge';

// Revalidate cache every 2 hours
export const revalidate = 7200;

// Quick fallback for major Japanese regions
const REGION_FALLBACK: { [key: string]: string } = {
  '35-36,139-140': '東京都',
  '34-35,135-136': '大阪府',
  '35,135': '京都府',
  '35,139': '神奈川県',
  '43,141': '北海道',
  '33,130': '福岡県',
  '34,135': '兵庫県',
  '38,140': '宮城県',
  '34,132': '広島県',
};

function getRegionFallback(lat: number, lng: number): string | null {
  const latRange = Math.floor(lat);
  const lngRange = Math.floor(lng);
  
  for (const [range, region] of Object.entries(REGION_FALLBACK)) {
    const [latPart, lngPart] = range.split(',');
    if (latPart.includes('-')) {
      const [minLat, maxLat] = latPart.split('-').map(Number);
      const [minLng, maxLng] = lngPart.split('-').map(Number);
      if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
        return region;
      }
    } else {
      if (latRange === Number(latPart) && lngRange === Number(lngPart)) {
        return region;
      }
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { lat, lng, address: inputAddress } = await request.json();
    
    // Forward geocoding (address to coordinates)
    if (inputAddress && !lat && !lng) {
      const cacheKey = createAddressCacheKey(inputAddress);
      const cached = geocodeCache.get(cacheKey);
      
      if (cached) {
        const responseTime = Date.now() - startTime;
        console.log(`Cache hit for address: ${inputAddress} (${responseTime}ms)`);
        performanceMonitor.recordApiCall(responseTime, true);
        return NextResponse.json({ ...cached, cached: true });
      }
      
      // Fetch with aggressive timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputAddress)}&accept-language=ja&limit=1`,
          {
            headers: {
              'User-Agent': 'Nukune Dating App'
            },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error('Geocoding API failed');
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          const result = data[0];
          const response = {
            coordinates: {
              lat: parseFloat(result.lat),
              lng: parseFloat(result.lon)
            },
            address: inputAddress,
            raw: result
          };
          
          // Cache the result
          geocodeCache.set(cacheKey, response);
          const responseTime = Date.now() - startTime;
          console.log(`Geocoded address: ${inputAddress} (${responseTime}ms)`);
          performanceMonitor.recordApiCall(responseTime, false);
          return NextResponse.json(response);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`Geocoding timeout for address: ${inputAddress}`);
          performanceMonitor.recordApiCall(Date.now() - startTime, false, true, true);
        }
        
        // Return error response
        return NextResponse.json({
          error: '住所から座標を取得できませんでした',
          address: inputAddress
        });
      }
    }
    
    // Reverse geocoding (coordinates to address)
    if (!lat || !lng) {
      return NextResponse.json(
        { error: '緯度と経度が必要です' },
        { status: 400 }
      );
    }
    
    // Check cache first
    const cacheKey = createCacheKey(lat, lng);
    const cached = geocodeCache.get(cacheKey);
    
    if (cached) {
      const responseTime = Date.now() - startTime;
      console.log(`Cache hit: ${lat},${lng} (${responseTime}ms)`);
      performanceMonitor.recordApiCall(responseTime, true);
      return NextResponse.json({ ...cached, cached: true });
    }
    
    // Try quick region fallback first
    const regionFallback = getRegionFallback(lat, lng);
    if (regionFallback) {
      const response = { address: regionFallback, fallback: true };
      geocodeCache.set(cacheKey, response);
      const responseTime = Date.now() - startTime;
      console.log(`Region fallback: ${lat},${lng} -> ${regionFallback} (${responseTime}ms)`);
      performanceMonitor.recordApiCall(responseTime, true);
      return NextResponse.json(response);
    }
    
    // Fetch from Nominatim with aggressive timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja&zoom=14`,
        {
          headers: {
            'User-Agent': 'Nukune Dating App'
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error('Geocoding API failed');
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Parse address
      let address = '';
      
      if (data.address) {
        const addressParts = [];
        
        // Japanese address format
        const prefecture = data.address.state || data.address.prefecture || data.address.province;
        if (prefecture) {
          addressParts.push(prefecture);
        }
        
        const city = data.address.city || data.address.town || data.address.village;
        if (city) {
          addressParts.push(city);
        }
        
        const district = data.address.suburb || data.address.neighbourhood || data.address.quarter;
        if (district && district !== city) {
          addressParts.push(district);
        }
        
        if (!city && data.address.county) {
          addressParts.push(data.address.county);
        }
        
        if (addressParts.length > 0) {
          address = addressParts.slice(0, 3).join('');
        }
      }
      
      // Fallback to display_name parsing
      if (!address && data.display_name) {
        const parts = data.display_name.split(',').map((s: string) => s.trim());
        const filteredParts = parts.filter((part: string) => 
          !part.match(/^\d/) && 
          part !== '日本' && 
          part !== 'Japan' &&
          part !== ''
        );
        
        if (filteredParts.length > 0) {
          address = filteredParts.slice(0, 3).join('');
        }
      }
      
      const result = {
        address: address || '詳細な住所を取得できませんでした',
        raw: data
      };
      
      // Cache the successful result
      geocodeCache.set(cacheKey, result);
      
      const responseTime = Date.now() - startTime;
      console.log(`Geocoded: ${lat},${lng} -> ${address} (${responseTime}ms)`);
      performanceMonitor.recordApiCall(responseTime, false);
      return NextResponse.json(result);
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // On timeout or error, use fallback
      if (error.name === 'AbortError') {
        console.log(`Geocoding timeout for ${lat},${lng}, using fallback`);
        
        // Use nearest major city as fallback
        const fallbackAddress = getNearestMajorCity(lat, lng);
        const result = { address: fallbackAddress, fallback: true };
        
        // Cache the fallback
        geocodeCache.set(cacheKey, result);
        
        const responseTime = Date.now() - startTime;
        performanceMonitor.recordApiCall(responseTime, false, true, true);
        
        return NextResponse.json(result);
      }
      
      console.error('Geocoding error:', error);
      return NextResponse.json(
        { error: 'ジオコーディングに失敗しました' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json(
      { error: 'リクエストの処理に失敗しました' },
      { status: 500 }
    );
  }
}

// Get nearest major city for fallback
function getNearestMajorCity(lat: number, lng: number): string {
  const cities = [
    { name: '東京', lat: 35.6762, lng: 139.6503 },
    { name: '大阪', lat: 34.6937, lng: 135.5023 },
    { name: '京都', lat: 35.0116, lng: 135.7681 },
    { name: '横浜', lat: 35.4478, lng: 139.6425 },
    { name: '名古屋', lat: 35.1802, lng: 136.9066 },
    { name: '札幌', lat: 43.0642, lng: 141.3469 },
    { name: '福岡', lat: 33.6064, lng: 130.4181 },
    { name: '神戸', lat: 34.6913, lng: 135.1830 },
    { name: '仙台', lat: 38.2682, lng: 140.8694 },
    { name: '広島', lat: 34.3963, lng: 132.4596 },
  ];
  
  let nearest = cities[0];
  let minDistance = Infinity;
  
  for (const city of cities) {
    const distance = Math.sqrt(
      Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = city;
    }
  }
  
  return nearest.name;
}