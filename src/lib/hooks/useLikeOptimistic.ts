import { useState, useCallback, useRef } from 'react';
import { sendLike } from '@/lib/firebase/actions';
import { useToast } from '@/hooks/use-toast';

// ローカルキャッシュ for いいね状態
const likedCache = new Set<string>();

// 処理中のいいねを管理
const processingLikes = new Map<string, Promise<any>>();

export function useLikeOptimistic() {
  const { toast } = useToast();
  const [likingStates, setLikingStates] = useState<Record<string, boolean>>({});
  
  const handleLikeOptimistic = useCallback(async (
    fromUserId: string,
    toUserId: string,
    toUserName: string,
    options?: {
      toGirlName?: string;
      toGirlId?: string;
      isGirlProfile?: boolean;
    }
  ) => {
    const cacheKey = `${fromUserId}_${toUserId}`;
    
    // 既に処理中の場合は既存のPromiseを返す
    if (processingLikes.has(cacheKey)) {
      return processingLikes.get(cacheKey);
    }
    
    // 即座にキャッシュに追加（楽観的更新）
    const wasAlreadyLiked = likedCache.has(cacheKey);
    if (!wasAlreadyLiked) {
      likedCache.add(cacheKey);
      
      // 即座に成功トーストを表示
      toast({
        title: 'いいねを送りました！',
        description: `${toUserName || options?.toGirlName}さんにいいねを送りました。`,
        duration: 2000,
      });
    } else {
      // 既にいいね済みの場合は即座に通知
      toast({
        title: '既にいいねを送っています',
        description: `${toUserName || options?.toGirlName}さんには既にいいねを送信済みです。`,
        duration: 2000,
      });
      return Promise.resolve({ alreadyLiked: true });
    }
    
    // UIをローディング状態に
    setLikingStates(prev => ({ ...prev, [toUserId]: true }));
    
    // バックグラウンドでFirebase処理
    const likePromise = sendLike(fromUserId, toUserId, options)
      .then(result => {
        // 成功時は何もしない（既に楽観的更新済み）
        return result;
      })
      .catch(error => {
        // エラー時はキャッシュから削除してロールバック
        likedCache.delete(cacheKey);
        
        // エラートーストを表示
        toast({
          title: 'エラー',
          description: 'いいねの送信に失敗しました。もう一度お試しください。',
          variant: 'destructive',
          duration: 3000,
        });
        
        throw error;
      })
      .finally(() => {
        // ローディング状態を解除
        setLikingStates(prev => ({ ...prev, [toUserId]: false }));
        // 処理中リストから削除
        processingLikes.delete(cacheKey);
      });
    
    // 処理中リストに追加
    processingLikes.set(cacheKey, likePromise);
    
    return likePromise;
  }, [toast]);
  
  // キャッシュをクリアする関数（ログアウト時などに使用）
  const clearLikeCache = useCallback(() => {
    likedCache.clear();
    processingLikes.clear();
    setLikingStates({});
  }, []);
  
  // いいね済みかチェックする関数（即座に返す）
  const isLiked = useCallback((fromUserId: string, toUserId: string) => {
    return likedCache.has(`${fromUserId}_${toUserId}`);
  }, []);
  
  return {
    handleLikeOptimistic,
    likingStates,
    clearLikeCache,
    isLiked,
  };
}