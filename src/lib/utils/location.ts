// 位置情報関連のユーティリティ関数

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface LocationInfo {
  coordinates?: LocationCoordinates;
  address?: string;
  error?: string;
}

// 2点間の距離を計算（km）
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // 地球の半径（km）
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}

// GPS位置情報を取得
export async function getCurrentLocation(): Promise<LocationInfo> {
  return new Promise((resolve) => {
    // HTTPS環境のチェック
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      resolve({ error: '位置情報を使用するにはHTTPSが必要です' });
      return;
    }

    if (!navigator.geolocation) {
      resolve({ error: 'このブラウザは位置情報をサポートしていません' });
      return;
    }

    const options = {
      enableHighAccuracy: true, // 高精度モードを有効化
      timeout: 30000, // 30秒に延長（モバイルでより正確な位置取得のため）
      maximumAge: 0 // キャッシュを使用せず、常に最新の位置情報を取得
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        // リバースジオコーディングで住所を取得
        try {
          const address = await reverseGeocode(coordinates.lat, coordinates.lng);
          resolve({
            coordinates,
            address
          });
        } catch (error) {
          // ジオコーディングが失敗しても座標と最寄りの地域名は返す
          const nearestLocation = getNearestLocationName(coordinates.lat, coordinates.lng);
          resolve({ 
            coordinates,
            address: nearestLocation
          });
        }
      },
      (error) => {
        // エラーオブジェクトの安全な処理
        const errorCode = error?.code || 0;
        const errorMsg = error?.message || 'Unknown error';
        
        let errorMessage = '位置情報の取得に失敗しました';
        
        switch (errorCode) {
          case 1: // PERMISSION_DENIED
            errorMessage = '位置情報の使用が拒否されました。ブラウザの設定で位置情報を許可してください。';
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = '位置情報が利用できません。GPSが有効か確認してください。';
            break;
          case 3: // TIMEOUT
            errorMessage = '位置情報の取得がタイムアウトしました。もう一度お試しください。';
            break;
          default:
            errorMessage = `位置情報エラー: ${errorMsg}`;
        }
        
        resolve({ error: errorMessage });
      },
      options
    );
  });
}

// リバースジオコーディング（APIルート経由）
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    // Next.js APIルートを経由してジオコーディング
    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lng }),
    });

    if (!response.ok) {
      throw new Error('Geocoding API failed');
    }

    const data = await response.json();
    
    
    if (data.error) {
      throw new Error(data.error);
    }

    return data.address || '詳細な住所を取得できませんでした';
  } catch (error) {
    throw error;
  }
}

// 住所から大まかな座標を取得（日本の主要都市）
export function getCoordinatesFromAddress(address: string): LocationCoordinates | null {
  const addressMap: { [key: string]: LocationCoordinates } = {
    // 都道府県
    '北海道': { lat: 43.0642, lng: 141.3469 },
    '札幌': { lat: 43.0642, lng: 141.3469 },
    '青森': { lat: 40.8244, lng: 140.7400 },
    '岩手': { lat: 39.7036, lng: 141.1527 },
    '盛岡': { lat: 39.7036, lng: 141.1527 },
    '宮城': { lat: 38.2682, lng: 140.8694 },
    '仙台': { lat: 38.2682, lng: 140.8694 },
    '秋田': { lat: 39.7186, lng: 140.1023 },
    '山形': { lat: 38.2404, lng: 140.3633 },
    '福島': { lat: 37.7503, lng: 140.4676 },
    '茨城': { lat: 36.3418, lng: 140.4468 },
    '水戸': { lat: 36.3418, lng: 140.4468 },
    '栃木': { lat: 36.5658, lng: 139.8836 },
    '宇都宮': { lat: 36.5658, lng: 139.8836 },
    '群馬': { lat: 36.3911, lng: 139.0608 },
    '前橋': { lat: 36.3911, lng: 139.0608 },
    '埼玉': { lat: 35.8569, lng: 139.6489 },
    'さいたま': { lat: 35.8569, lng: 139.6489 },
    '千葉': { lat: 35.6074, lng: 140.1233 },
    '東京': { lat: 35.6762, lng: 139.6503 },
    '神奈川': { lat: 35.4478, lng: 139.6425 },
    '横浜': { lat: 35.4478, lng: 139.6425 },
    '新潟': { lat: 37.9026, lng: 139.0232 },
    '富山': { lat: 36.6959, lng: 137.2136 },
    '石川': { lat: 36.5944, lng: 136.6256 },
    '金沢': { lat: 36.5944, lng: 136.6256 },
    '福井': { lat: 36.0652, lng: 136.2217 },
    '山梨': { lat: 35.6638, lng: 138.5683 },
    '甲府': { lat: 35.6638, lng: 138.5683 },
    '長野': { lat: 36.6513, lng: 138.1810 },
    '岐阜': { lat: 35.3912, lng: 136.7223 },
    '静岡': { lat: 34.9756, lng: 138.3828 },
    '愛知': { lat: 35.1802, lng: 136.9066 },
    '名古屋': { lat: 35.1802, lng: 136.9066 },
    '三重': { lat: 34.7303, lng: 136.5086 },
    '津': { lat: 34.7303, lng: 136.5086 },
    '滋賀': { lat: 35.0045, lng: 135.8686 },
    '大津': { lat: 35.0045, lng: 135.8686 },
    '京都': { lat: 35.0116, lng: 135.7681 },
    '大阪': { lat: 34.6937, lng: 135.5023 },
    '兵庫': { lat: 34.6913, lng: 135.1830 },
    '神戸': { lat: 34.6913, lng: 135.1830 },
    '奈良': { lat: 34.6851, lng: 135.8048 },
    '和歌山': { lat: 34.2261, lng: 135.1675 },
    '鳥取': { lat: 35.5038, lng: 134.2380 },
    '島根': { lat: 35.4723, lng: 133.0505 },
    '松江': { lat: 35.4723, lng: 133.0505 },
    '岡山': { lat: 34.6617, lng: 133.9345 },
    '広島': { lat: 34.3963, lng: 132.4596 },
    '山口': { lat: 34.1858, lng: 131.4706 },
    '徳島': { lat: 34.0657, lng: 134.5593 },
    '香川': { lat: 34.3401, lng: 134.0434 },
    '高松': { lat: 34.3401, lng: 134.0434 },
    '愛媛': { lat: 33.8416, lng: 132.7658 },
    '松山': { lat: 33.8416, lng: 132.7658 },
    '高知': { lat: 33.5597, lng: 133.5311 },
    '福岡': { lat: 33.6064, lng: 130.4181 },
    '佐賀': { lat: 33.2494, lng: 130.2989 },
    '長崎': { lat: 32.7503, lng: 129.8779 },
    '熊本': { lat: 32.7898, lng: 130.7417 },
    '大分': { lat: 33.2382, lng: 131.6126 },
    '宮崎': { lat: 31.9077, lng: 131.4202 },
    '鹿児島': { lat: 31.5966, lng: 130.5571 },
    '沖縄': { lat: 26.2124, lng: 127.6792 },
    '那覇': { lat: 26.2124, lng: 127.6792 }
  };

  // 住所の一部が含まれているかチェック
  for (const [key, coordinates] of Object.entries(addressMap)) {
    if (address.includes(key)) {
      return coordinates;
    }
  }

  return null;
}

// 座標から最も近い地域名を取得
export function getNearestLocationName(lat: number, lng: number): string {
  const addressMap: { [key: string]: LocationCoordinates } = {
    // 都道府県
    '北海道': { lat: 43.0642, lng: 141.3469 },
    '札幌': { lat: 43.0642, lng: 141.3469 },
    '青森': { lat: 40.8244, lng: 140.7400 },
    '岩手': { lat: 39.7036, lng: 141.1527 },
    '盛岡': { lat: 39.7036, lng: 141.1527 },
    '宮城': { lat: 38.2682, lng: 140.8694 },
    '仙台': { lat: 38.2682, lng: 140.8694 },
    '秋田': { lat: 39.7186, lng: 140.1023 },
    '山形': { lat: 38.2404, lng: 140.3633 },
    '福島': { lat: 37.7503, lng: 140.4676 },
    '茨城': { lat: 36.3418, lng: 140.4468 },
    '水戸': { lat: 36.3418, lng: 140.4468 },
    '栃木': { lat: 36.5658, lng: 139.8836 },
    '宇都宮': { lat: 36.5658, lng: 139.8836 },
    '群馬': { lat: 36.3911, lng: 139.0608 },
    '前橋': { lat: 36.3911, lng: 139.0608 },
    '埼玉': { lat: 35.8569, lng: 139.6489 },
    'さいたま': { lat: 35.8569, lng: 139.6489 },
    '千葉': { lat: 35.6074, lng: 140.1233 },
    '東京': { lat: 35.6762, lng: 139.6503 },
    '神奈川': { lat: 35.4478, lng: 139.6425 },
    '横浜': { lat: 35.4478, lng: 139.6425 },
    '新潟': { lat: 37.9026, lng: 139.0232 },
    '富山': { lat: 36.6959, lng: 137.2136 },
    '石川': { lat: 36.5944, lng: 136.6256 },
    '金沢': { lat: 36.5944, lng: 136.6256 },
    '福井': { lat: 36.0652, lng: 136.2217 },
    '山梨': { lat: 35.6638, lng: 138.5683 },
    '甲府': { lat: 35.6638, lng: 138.5683 },
    '長野': { lat: 36.6513, lng: 138.1810 },
    '岐阜': { lat: 35.3912, lng: 136.7223 },
    '静岡': { lat: 34.9756, lng: 138.3828 },
    '愛知': { lat: 35.1802, lng: 136.9066 },
    '名古屋': { lat: 35.1802, lng: 136.9066 },
    '三重': { lat: 34.7303, lng: 136.5086 },
    '津': { lat: 34.7303, lng: 136.5086 },
    '滋賀': { lat: 35.0045, lng: 135.8686 },
    '大津': { lat: 35.0045, lng: 135.8686 },
    '京都': { lat: 35.0116, lng: 135.7681 },
    '大阪': { lat: 34.6937, lng: 135.5023 },
    '兵庫': { lat: 34.6913, lng: 135.1830 },
    '神戸': { lat: 34.6913, lng: 135.1830 },
    '奈良': { lat: 34.6851, lng: 135.8048 },
    '和歌山': { lat: 34.2261, lng: 135.1675 },
    '鳥取': { lat: 35.5038, lng: 134.2380 },
    '島根': { lat: 35.4723, lng: 133.0505 },
    '松江': { lat: 35.4723, lng: 133.0505 },
    '岡山': { lat: 34.6617, lng: 133.9345 },
    '広島': { lat: 34.3963, lng: 132.4596 },
    '山口': { lat: 34.1858, lng: 131.4706 },
    '徳島': { lat: 34.0657, lng: 134.5593 },
    '香川': { lat: 34.3401, lng: 134.0434 },
    '高松': { lat: 34.3401, lng: 134.0434 },
    '愛媛': { lat: 33.8416, lng: 132.7658 },
    '松山': { lat: 33.8416, lng: 132.7658 },
    '高知': { lat: 33.5597, lng: 133.5311 },
    '福岡': { lat: 33.6064, lng: 130.4181 },
    '佐賀': { lat: 33.2494, lng: 130.2989 },
    '長崎': { lat: 32.7503, lng: 129.8779 },
    '熊本': { lat: 32.7898, lng: 130.7417 },
    '大分': { lat: 33.2382, lng: 131.6126 },
    '宮崎': { lat: 31.9077, lng: 131.4202 },
    '鹿児島': { lat: 31.5966, lng: 130.5571 },
    '沖縄': { lat: 26.2124, lng: 127.6792 },
    '那覇': { lat: 26.2124, lng: 127.6792 }
  };

  let nearestLocation = '';
  let minDistance = Infinity;

  for (const [locationName, coordinates] of Object.entries(addressMap)) {
    const distance = calculateDistance(lat, lng, coordinates.lat, coordinates.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestLocation = locationName;
    }
  }

  // 100km以内の場合は地域名を返す、それ以外は都道府県レベルで返す
  if (minDistance < 100) {
    return nearestLocation;
  } else {
    // 都道府県名のみを返す（市区町村を除外）
    const prefectures = ['北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川', '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'];
    
    for (const prefecture of prefectures) {
      if (nearestLocation.includes(prefecture)) {
        return prefecture;
      }
    }
    
    return nearestLocation;
  }
}

// ユーザーリストを距離順にソート
export function sortUsersByDistance(
  users: any[],
  userLocation: LocationCoordinates
): any[] {
  return users.map(user => {
    let distance = Infinity;
    
    // ユーザーの位置情報がある場合
    if (user.location) {
      const userCoords = getCoordinatesFromAddress(user.location);
      if (userCoords) {
        distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          userCoords.lat,
          userCoords.lng
        );
      }
    }
    
    return {
      ...user,
      distance
    };
  }).sort((a, b) => a.distance - b.distance);
}