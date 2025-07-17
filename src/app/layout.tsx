
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import BottomNavigation from '@/components/layout/BottomNavigation';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Nukune - あなたの出会いをサポート',
  description: 'Nukuneは、価値観の合う人との出会いをサポートする最新のマッチングアプリです。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-black`}>
        <AuthProvider>
          <Header />
          <main className="flex-grow pt-16">
            {children}
          </main>
          <Footer />
          <BottomNavigation />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
