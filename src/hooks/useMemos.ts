import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserMemos, getMemo, type Memo } from '@/lib/firebase/memos';

export function useMemos() {
  const { currentUser } = useAuth();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setMemos([]);
      setLoading(false);
      return;
    }

    const loadMemos = async () => {
      try {
        setLoading(true);
        const userMemos = await getUserMemos(currentUser.uid);
        setMemos(userMemos);
        setError(null);
      } catch (err: any) {
        console.error('[useMemos] Error loading memos:', err);
        console.error('[useMemos] Error details:', {
          code: err?.code,
          message: err?.message,
          userId: currentUser?.uid
        });
        setError('メモの読み込みに失敗しました');
        setMemos([]);
      } finally {
        setLoading(false);
      }
    };

    loadMemos();
  }, [currentUser]);

  return { memos, loading, error };
}

export function useMemo(targetId: string) {
  const { currentUser } = useAuth();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !targetId) {
      setMemo(null);
      setLoading(false);
      return;
    }

    const loadMemo = async () => {
      try {
        console.log('[useMemo] Loading memo for:', { userId: currentUser.uid, targetId });
        setLoading(true);
        const userMemo = await getMemo(currentUser.uid, targetId);
        console.log('[useMemo] Memo loaded:', userMemo);
        setMemo(userMemo);
        setError(null);
      } catch (err: any) {
        console.error('[useMemo] Error loading memo:', err);
        console.error('[useMemo] Error details:', {
          code: err?.code,
          message: err?.message,
          stack: err?.stack,
          userId: currentUser?.uid,
          targetId
        });
        setError('メモの読み込みに失敗しました');
        setMemo(null);
      } finally {
        setLoading(false);
      }
    };

    loadMemo();
  }, [currentUser, targetId]);

  const reload = async () => {
    if (!currentUser || !targetId) return;
    
    try {
      setLoading(true);
      const userMemo = await getMemo(currentUser.uid, targetId);
      setMemo(userMemo);
      setError(null);
    } catch (err) {
      console.error('Error reloading memo:', err);
      setError('メモの再読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return { memo, loading, error, reload };
}