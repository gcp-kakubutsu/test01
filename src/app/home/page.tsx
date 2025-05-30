
"use client";

import { UserProfileCard, type UserProfile } from '@/components/home/UserProfileCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Ban, ChevronLeft, ChevronRight, Heart, Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const mockUsers: UserProfile[] = [
  { id: '1', name: 'さくら', age: 28, imageUrl: 'https://placehold.co/400x500/F0306A/FFF.png?text=S', bio: 'アート、冒険、深い会話が大好き。誠実な人を探しています。', kinks: ['スリル', '知性', '旅行'] , dataAiHint: "女性 ポートレート" },
  { id: '2', name: 'かける', age: 32, imageUrl: 'https://placehold.co/400x500/FF7F50/FFF.png?text=K', bio: 'テクノロジー好きで、ハイキングと良い音楽を楽しみます。意味のある繋がりを求めています。', kinks: ['正直', 'ユーモア', '犬'] , dataAiHint: "男性 ポートレート" },
  { id: '3', name: 'ひなた', age: 25, imageUrl: 'https://placehold.co/400x500/F9E4EB/333.png?text=H', bio: '読書家で食いしん坊。理想のデートは居心地の良いカフェでのおしゃべり。', kinks: ['優しさ', 'グルメ', '読書'] , dataAiHint: "女性 笑顔" },
  { id: '4', name: 'りく', age: 30, imageUrl: 'https://placehold.co/400x500/333/FFF.png?text=R', bio: 'ミュージシャンで夢想家。一緒に美しい思い出を作りましょう。', kinks: ['音楽', '創造性', '夜遊び'] , dataAiHint: "男性 カジュアル" },
];

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [users, setUsers] = useState<UserProfile[]>(mockUsers); // 実際のアプリではこれをフェッチします
  const [feedback, setFeedback] = useState<'liked' | 'passed' | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleAction = (action: 'like' | 'pass') => {
    setFeedback(action);
    setTimeout(() => {
      setCurrentUserIndex((prevIndex) => (prevIndex + 1) % users.length);
      setFeedback(null);
    }, 500); // フィードバックアニメーションの時間
  };

  const handleLike = () => handleAction('like');
  const handlePass = () => handleAction('pass');
  const handlePrevious = () => {
     setCurrentUserIndex((prevIndex) => (prevIndex - 1 + users.length) % users.length);
  };
  const handleReset = () => {
    setCurrentUserIndex(0); // 最初のユーザーにリセット
    // 実際のアプリではここでユーザーを再フェッチまたはシャッフルする可能性があります
    setUsers([...mockUsers].sort(() => Math.random() - 0.5)); // デモ用の簡単なシャッフル
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">読み込み中...</p></div>;
  }

  if (!isAuthenticated) {
    // This case should ideally be handled by the redirect in useEffect,
    // but as a fallback or during transition:
    return <div className="flex justify-center items-center h-screen"><p>ログインページへリダイレクト中...</p></div>;
  }

  if (users.length === 0) {
    return <div className="text-center py-10">現在表示できるプロフィールはありません。後でもう一度確認してください！</div>;
  }

  const currentUser = users[currentUserIndex];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <div className="w-full max-w-sm relative">
        {currentUser ? (
          <UserProfileCard user={currentUser} feedback={feedback} />
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-xl mb-4">現在表示できるプロフィールはありません！</p>
            <Button onClick={handleReset} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" /> プロフィールを再読み込み
            </Button>
          </div>
        )}
      </div>
      {currentUser && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <Button variant="outline" size="lg" className="rounded-full p-4 h-16 w-16 shadow-lg hover:bg-secondary" onClick={handlePrevious} aria-label="前へ">
            <ChevronLeft className="h-8 w-8 text-muted-foreground" />
          </Button>
          <Button variant="destructive" size="lg" className="rounded-full p-4 h-20 w-20 shadow-xl hover:bg-destructive/90" onClick={handlePass} aria-label="スキップ">
            <Ban className="h-10 w-10" />
          </Button>
          <Button variant="default" size="lg" className="rounded-full p-4 h-20 w-20 bg-green-500 hover:bg-green-600 shadow-xl" onClick={handleLike} aria-label="いいね">
            <Heart className="h-10 w-10" />
          </Button>
          <Button variant="outline" size="lg" className="rounded-full p-4 h-16 w-16 shadow-lg hover:bg-secondary" onClick={() => setCurrentUserIndex((prevIndex) => (prevIndex + 1) % users.length)} aria-label="次へ">
            <ChevronRight className="h-8 w-8 text-muted-foreground" />
          </Button>
        </div>
      )}
       <Button onClick={handleReset} variant="outline" className="mt-6">
          <RotateCcw className="mr-2 h-4 w-4" /> スワイプをリセット
       </Button>
    </div>
  );
}
