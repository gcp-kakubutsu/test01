'use client';

import { useState } from 'react';
import WelcomePage from '@/components/WelcomePage';
import MaleOnboarding from '@/components/MaleOnboarding';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function WelcomePreviewPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [showInfo, setShowInfo] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleComplete = () => {
    // ウェルカムページ完了時の動作（実際と同じ）
    setShowWelcome(false);
    // ログインしていない場合は情報画面に戻る
    if (!currentUser) {
      setShowInfo(true);
      alert('実際の動作では、ここでオンボーディングが表示されます。\nログインが必要です。');
    } else {
      // ログインしている場合はオンボーディングを表示
      setShowOnboarding(true);
    }
  };

  const handleStartOnboarding = () => {
    // 「今すぐ無料で始める」ボタンの動作（実際と同じ）
    handleComplete();
  };

  const handleOnboardingComplete = () => {
    // オンボーディング完了時の動作
    setShowOnboarding(false);
    setShowInfo(true);
    alert('オンボーディングが完了しました。\n実際の動作では、ホーム画面が表示されます。');
  };

  return (
    <div className="min-h-screen bg-black">
      {showInfo ? (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-800">
              <div className="flex items-center gap-3 mb-6">
                <Eye className="w-8 h-8 text-[#D4AF37]" />
                <h1 className="text-3xl font-bold text-white">ウェルカムページ プレビュー</h1>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3 p-4 bg-blue-900/20 rounded-xl border border-blue-800/30">
                  <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-blue-300 font-semibold mb-1">このページについて</p>
                    <p className="text-gray-300 text-sm">
                      新規登録ユーザーが初めて/homeにアクセスした際に表示されるウェルカムページのプレビューです。
                    </p>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-800/50 rounded-xl">
                  <h2 className="text-lg font-semibold text-white mb-3">ページの特徴</h2>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-[#D4AF37]">✓</span>
                      <span>高級感のあるゴールドグラデーションデザイン</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#D4AF37]">✓</span>
                      <span>NUKUNEの3つの主要機能を紹介</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#D4AF37]">✓</span>
                      <span>アニメーション効果でプレミアム感を演出</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#D4AF37]">✓</span>
                      <span>無料トライアル情報の明確な表示</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => router.back()}
                  variant="outline"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  戻る
                </Button>
                <Button
                  onClick={() => {
                    setShowInfo(false);
                    setShowWelcome(true);
                  }}
                  className="flex-1"
                  style={{
                    background: 'linear-gradient(135deg, #f3e5c1, #caa35b)',
                    color: '#1a1a1a'
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  プレビューを表示
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : showWelcome ? (
        <div className="relative">
          <div className="absolute top-4 right-4 z-50 flex gap-2">
            <Button
              onClick={() => {
                setShowWelcome(false);
                setShowInfo(true);
              }}
              variant="outline"
              size="sm"
              className="bg-black/50 backdrop-blur border-white/20 text-white hover:bg-black/70"
            >
              <Info className="w-4 h-4 mr-1" />
              情報
            </Button>
            <Button
              onClick={() => router.back()}
              variant="outline"
              size="sm"
              className="bg-black/50 backdrop-blur border-white/20 text-white hover:bg-black/70"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              戻る
            </Button>
          </div>
          <WelcomePage 
            onComplete={handleComplete}
            onStartOnboarding={handleStartOnboarding}
          />
        </div>
      ) : showOnboarding && currentUser ? (
        <MaleOnboarding 
          userId={currentUser.uid} 
          userEmail={currentUser.email || undefined} 
          onComplete={handleOnboardingComplete}
          onBack={() => {
            setShowOnboarding(false);
            setShowWelcome(true);
          }}
        />
      ) : null}
    </div>
  );
}