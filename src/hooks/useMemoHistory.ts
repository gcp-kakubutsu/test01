import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAllMemoHistory, type MemoHistory } from '@/lib/firebase/memoHistory';

export function useMemoHistory() {
  const { currentUser } = useAuth();
  const [memoHistory, setMemoHistory] = useState<MemoHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setMemoHistory([]);
      setLoading(false);
      return;
    }

    const loadMemoHistory = async () => {
      try {
        setLoading(true);
        const history = await getAllMemoHistory(currentUser.uid);
        
        // Return all memo history sorted by date
        const sortedHistory = history.sort((a, b) => {
          const dateA = a.createdAt?.toMillis() || 0;
          const dateB = b.createdAt?.toMillis() || 0;
          return dateB - dateA; // Newest first
        });
        
        setMemoHistory(sortedHistory);
        setError(null);
      } catch (err: any) {
        console.error('[useMemoHistory] Error loading history:', err);
        setError('メモ履歴の読み込みに失敗しました');
        setMemoHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadMemoHistory();
  }, [currentUser]);

  return { memoHistory, loading, error };
}

// Get latest memo for each target (for summary view)
export function useLatestMemos() {
  const { memoHistory, loading, error } = useMemoHistory();
  const [latestMemos, setLatestMemos] = useState<MemoHistory[]>([]);

  useEffect(() => {
    if (!memoHistory || loading) return;

    // Group by targetId and get the latest memo for each target
    const latestMemoMap = new Map<string, MemoHistory>();
    memoHistory.forEach(memo => {
      const existing = latestMemoMap.get(memo.targetId);
      if (!existing || (memo.createdAt && existing.createdAt && 
          memo.createdAt.toMillis() > existing.createdAt.toMillis())) {
        latestMemoMap.set(memo.targetId, memo);
      }
    });
    
    setLatestMemos(Array.from(latestMemoMap.values()));
  }, [memoHistory, loading]);

  return { latestMemos, allHistory: memoHistory, loading, error };
}