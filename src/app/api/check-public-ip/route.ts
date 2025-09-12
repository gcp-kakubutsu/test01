// app/api/check-public-ip/route.ts

import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    const publicIp = response.data.ip;

    return NextResponse.json({
      message: 'This is the public IP address from your Firebase App Hosting backend:',
      publicIp: publicIp
    });
  } catch (error) {
    console.error('Error fetching public IP:', error);
    // エラーオブジェクトが unknown 型の場合に備えて型ガードを追加
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      errorMessage = (error as any).message; // 厳密には良くないが、簡易的な対応
    }

    return NextResponse.json({
      message: 'Failed to fetch public IP address.',
      error: errorMessage
    }, { status: 500 });
  }
}
