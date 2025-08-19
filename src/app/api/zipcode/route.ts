import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const zipcode = searchParams.get('zipcode');
    
    if (!zipcode) {
      return NextResponse.json(
        { error: '郵便番号が必要です' },
        { status: 400 }
      );
    }
    
    // Remove any hyphens from the zipcode
    const cleanZipcode = zipcode.replace(/-/g, '');
    
    // Validate zipcode format (should be 7 digits)
    if (!/^\d{7}$/.test(cleanZipcode)) {
      return NextResponse.json(
        { error: '郵便番号は7桁の数字である必要があります' },
        { status: 400 }
      );
    }
    
    // Call the external API
    const response = await fetch(
      `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanZipcode}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('External API request failed');
    }
    
    const data = await response.json();
    
    // Check if the API returned an error
    if (data.status !== 200) {
      return NextResponse.json(
        { error: '郵便番号が見つかりませんでした' },
        { status: 404 }
      );
    }
    
    // Check if results exist
    if (!data.results || data.results.length === 0) {
      return NextResponse.json(
        { error: '該当する住所が見つかりませんでした' },
        { status: 404 }
      );
    }
    
    // Return the formatted address data
    const result = data.results[0];
    return NextResponse.json({
      prefecture: result.address1 || '',
      city: result.address2 || '',
      address: result.address3 || '',
      fullAddress: `${result.address1}${result.address2}${result.address3}`,
      kana: {
        prefecture: result.kana1 || '',
        city: result.kana2 || '',
        address: result.kana3 || ''
      },
      prefectureCode: result.prefcode || '',
      zipcode: result.zipcode || zipcode
    });
    
  } catch (error) {
    console.error('Zipcode lookup error:', error);
    return NextResponse.json(
      { error: '住所の検索中にエラーが発生しました' },
      { status: 500 }
    );
  }
}