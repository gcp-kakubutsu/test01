import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserMemos, type Memo } from '@/lib/firebase/memos';
import { getAllMemoHistory, type MemoHistory } from '@/lib/firebase/memoHistory';

export interface CombinedMemo {
  id: string;
  targetId: string;
  targetName: string;
  targetImage?: string;
  targetLocation?: string;
  content: string;
  createdAt: Date;
  isFromHistory: boolean;
}

export function useCombinedMemos() {
  const { currentUser } = useAuth();
  const [combinedMemos, setCombinedMemos] = useState<CombinedMemo[]>([]);
  const [latestMemos, setLatestMemos] = useState<CombinedMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setCombinedMemos([]);
      setLatestMemos([]);
      setLoading(false);
      return;
    }

    const loadAllMemos = async () => {
      try {
        setLoading(true);
        
        // Load both single memos and memo history
        const [singleMemos, memoHistory] = await Promise.all([
          getUserMemos(currentUser.uid),
          getAllMemoHistory(currentUser.uid)
        ]);
        
        // Convert single memos to combined format
        const singleMemoCombined: CombinedMemo[] = singleMemos.map(memo => ({
          id: memo.id,
          targetId: memo.targetId,
          targetName: memo.targetName || '名前未設定',
          targetImage: memo.targetImage,
          targetLocation: memo.targetLocation,
          content: memo.content,
          createdAt: memo.updatedAt?.toDate() || memo.createdAt?.toDate() || new Date(),
          isFromHistory: false
        }));
        
        // Convert memo history to combined format
        const historyMemoCombined: CombinedMemo[] = memoHistory.map(memo => ({
          id: memo.id || `history_${memo.targetId}_${memo.createdAt?.toMillis()}`,
          targetId: memo.targetId,
          targetName: memo.targetName || '名前未設定',
          targetImage: memo.targetImage,
          targetLocation: memo.targetLocation,
          content: memo.content,
          createdAt: memo.createdAt?.toDate() || new Date(),
          isFromHistory: true
        }));
        
        // Combine and sort by date (newest first)
        const allMemos = [...singleMemoCombined, ...historyMemoCombined];
        
        // Remove duplicates based on targetId + content + approximate time
        const uniqueMemos = new Map<string, CombinedMemo>();
        allMemos.forEach(memo => {
          // Create a key based on targetId, content hash, and date (rounded to day)
          const dateKey = memo.createdAt.toISOString().split('T')[0];
          const contentKey = memo.content.substring(0, 50); // First 50 chars as key
          const key = `${memo.targetId}_${contentKey}_${dateKey}`;
          
          // Keep the newer version if duplicate exists
          const existing = uniqueMemos.get(key);
          if (!existing || memo.createdAt > existing.createdAt) {
            uniqueMemos.set(key, memo);
          }
        });
        
        // Sort by date (newest first)
        const sortedMemos = Array.from(uniqueMemos.values()).sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        
        setCombinedMemos(sortedMemos);
        
        // Calculate latest memos
        const latestMap = new Map<string, CombinedMemo>();
        sortedMemos.forEach(memo => {
          const existing = latestMap.get(memo.targetId);
          if (!existing || memo.createdAt > existing.createdAt) {
            latestMap.set(memo.targetId, memo);
          }
        });
        setLatestMemos(Array.from(latestMap.values()));
        
        setError(null);
      } catch (err: any) {
        console.error('[useCombinedMemos] Error loading memos:', err);
        setError('メモの読み込みに失敗しました');
        setCombinedMemos([]);
        setLatestMemos([]);
      } finally {
        setLoading(false);
      }
    };

    loadAllMemos();
  }, [currentUser]);

  // Get all memos for a specific target
  const getMemosForTarget = (targetId: string) => {
    return combinedMemos.filter(memo => memo.targetId === targetId);
  };

  return { 
    allMemos: combinedMemos, 
    latestMemos,
    getMemosForTarget,
    loading, 
    error 
  };
}