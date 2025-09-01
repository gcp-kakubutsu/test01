import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// プリフェッチ済みのURLを管理
const prefetchedUrls = new Set<string>();

export function useMemoOptimistic() {
  const router = useRouter();
  const { toast } = useToast();
  const [navigatingStates, setNavigatingStates] = useState<Record<string, boolean>>({});
  
  // メッセージページをプリフェッチ
  const prefetchMemoPage = useCallback((userId: string) => {
    const url = `/messages/${userId}`;
    if (!prefetchedUrls.has(url)) {
      router.prefetch(url);
      prefetchedUrls.add(url);
    }
  }, [router]);
  
  // 高速ナビゲーション
  const handleMemoNavigation = useCallback(async (
    userId: string,
    userName?: string
  ) => {
    const url = `/messages/${userId}`;
    
    // 即座にローディング状態を設定
    setNavigatingStates(prev => ({ ...prev, [userId]: true }));
    
    // 即座にフィードバックを表示
    toast({
      title: 'メモページへ移動中...',
      description: userName ? `${userName}さんのメモページを開いています` : 'メモページを開いています',
      duration: 1000,
    });
    
    // 少し遅延を入れてアニメーション効果を出す
    setTimeout(() => {
      router.push(url);
      // ナビゲーション後にローディング状態を解除
      setTimeout(() => {
        setNavigatingStates(prev => ({ ...prev, [userId]: false }));
      }, 500);
    }, 100);
  }, [router, toast]);
  
  return {
    prefetchMemoPage,
    handleMemoNavigation,
    navigatingStates,
  };
}