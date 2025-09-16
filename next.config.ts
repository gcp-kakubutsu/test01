/**
 * @file next.config.ts
 * @description
 *   Next.js のプロジェクト全体設定を定義します。画像最適化のリモートホスト許可、
 *   パフォーマンス関連設定、CSP を含む各種ヘッダ、実験的最適化設定を含みます。
 * @spec
 *   - 画像: `images.remotePatterns` で外部ホスト（placehold.co, Firebase Storage, nukipedia.jp, S3）を許可
 *   - セキュリティ: `Content-Security-Policy` に画像配信元を明示追加
 *   - パフォーマンス: 圧縮、ヘッダキャッシュ、最適化対象パッケージ指定
 * @limitations
 *   - 追加の画像ホストが増えた場合は `images.remotePatterns` と CSP の両方に追記が必要
 */
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/v0/b/**',
      },
      {
        protocol: 'https',
        hostname: '**.nukipedia.jp',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**.nukipedia.jp',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'nukipedia-frontend.s3.ap-northeast-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.ap-northeast-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
  // Headers for better caching and performance
  async headers() {
    return [
      {
        source: '/api/mysql-girls-fast',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'max-age=300',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=30, stale-while-revalidate=60',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://apis.google.com https://www.google.com https://www.recaptcha.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.googleapis.com https://firebasestorage.googleapis.com https://*.nukipedia.jp http://*.nukipedia.jp https://placehold.co https://nukipedia-frontend.s3.ap-northeast-1.amazonaws.com https://s3.ap-northeast-1.amazonaws.com; connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://nominatim.openstreetmap.org; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com https://www.google.com https://www.recaptcha.net https://www.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'self' https://secure.telecomcredit.co.jp; upgrade-insecure-requests;"
          }
        ],
      },
    ];
  },
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['mysql2', 'firebase', '@tanstack/react-query', 'lru-cache'],
  },
};

export default nextConfig;
