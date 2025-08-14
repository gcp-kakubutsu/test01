import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { lat, lng, address: inputAddress } = await request.json();
    
    // 住所から座標を取得する場合（フォワードジオコーディング）
    if (inputAddress && !lat && !lng) {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputAddress)}&accept-language=ja&limit=1`,
        {
          headers: {
            'User-Agent': 'Nukune Dating App'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding API failed');
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        return NextResponse.json({
          coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon)
          },
          address: inputAddress,
          raw: result
        });
      } else {
        return NextResponse.json({
          error: '住所から座標を取得できませんでした',
          address: inputAddress
        });
      }
    }
    
    // 座標から住所を取得する場合（リバースジオコーディング）
    if (!lat || !lng) {
      return NextResponse.json(
        { error: '緯度と経度が必要です' },
        { status: 400 }
      );
    }

    // Nominatim APIを使用してリバースジオコーディング
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja&zoom=14`,
      {
        headers: {
          'User-Agent': 'Nukune Dating App'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding API failed');
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    // 住所の詳細度を調整
    let address = '';
    
    if (data.address) {
      const addressParts = [];
      
      // 日本の住所形式で優先度の高い順に取得
      // 1. 都道府県レベル
      const prefecture = data.address.state || data.address.prefecture || data.address.province;
      if (prefecture) {
        addressParts.push(prefecture);
      }
      
      // 2. 市区町村レベル
      const city = data.address.city || data.address.town || data.address.village;
      if (city) {
        addressParts.push(city);
      }
      
      // 3. 区・地区レベル（市区町村と重複しない場合のみ）
      const district = data.address.suburb || data.address.neighbourhood || data.address.quarter;
      if (district && district !== city) {
        addressParts.push(district);
      }
      
      // 4. 郡レベル（都道府県と市区町村の間に入る場合）
      if (!city && data.address.county) {
        addressParts.push(data.address.county);
      }
      
      if (addressParts.length > 0) {
        // 最大3つの要素を結合（例：「大阪府大阪市中央区」）
        address = addressParts.slice(0, 3).join('');
      }
    }

    // 表示名から抽出するフォールバック
    if (!address && data.display_name) {
      // 表示名をカンマで分割
      const parts = data.display_name.split(',').map((s: string) => s.trim());
      
      // 日本の住所を抽出（数字と国名を除外）
      const filteredParts = parts.filter((part: string) => 
        !part.match(/^\d/) && 
        part !== '日本' && 
        part !== 'Japan' &&
        part !== ''
      );
      
      // 最初の3つの要素を結合（通常は都道府県、市区町村、地区）
      if (filteredParts.length > 0) {
        address = filteredParts.slice(0, 3).join('');
      }
    }

    return NextResponse.json({
      address: address || '詳細な住所を取得できませんでした',
      raw: data // デバッグ用に生データも返す
    });

  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      { error: 'ジオコーディングに失敗しました' },
      { status: 500 }
    );
  }
}