
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Loader2, StickyNote, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { useCombinedMemos } from '@/hooks/useCombinedMemos';
import MemoHistoryDialog from '@/components/MemoHistoryDialog';
import { deleteMemo } from '@/lib/firebase/memos';
import { deleteMemoFromHistory } from '@/lib/firebase/memoHistory';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';

interface MemoDisplay {
  id: string;
  targetId: string;
  name: string;
  content: string;
  avatarUrl: string | null;
  lastUpdated?: Date | null;
}

export default function MemosPage() {
  const { isAuthenticated, currentUser, isLoading, hasInitialized } = useAuth();
  const router = useRouter();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const isLineBrowser = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('line');

  // 認証チェック - 有料会員チェックで判定
  useEffect(() => {
    // 認証されていない場合は3秒待ってからリダイレクト
    if (!subscriptionLoading && !currentUser) {
      const timer = setTimeout(() => {
        if (!currentUser) {
          router.push('/login');
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, subscriptionLoading, router]);
  const { latestMemos, allMemos, getMemosForTarget, loading: memosLoading } = useCombinedMemos();
  const [searchTerm, setSearchTerm] = useState('');
  const [memoDisplays, setMemoDisplays] = useState<MemoDisplay[]>([]);
  const [selectedMemoTarget, setSelectedMemoTarget] = useState<{id: string; name?: string; imageUrl?: string} | null>(null);
  const [deletingMemoId, setDeletingMemoId] = useState<string | null>(null);
  
  // Check premium status
  useEffect(() => {
    if (!subscriptionLoading && !isPremium && !isLineBrowser && isAuthenticated) {
      // Not a premium member
    }
  }, [subscriptionLoading, isPremium, isLineBrowser, isAuthenticated]);

  // Convert latest memos to display format
  useEffect(() => {
    if (!latestMemos || memosLoading) return;
    
    const displays: MemoDisplay[] = latestMemos.map(memo => ({
      id: memo.id || '',
      targetId: memo.targetId,
      name: memo.targetName || '名前未設定',
      content: memo.content || 'メモを追加してください',
      avatarUrl: memo.targetImage || null,
      lastUpdated: memo.createdAt // Already a Date object from useCombinedMemos
    }));
    
    setMemoDisplays(displays);
  }, [latestMemos, memosLoading]);

  const filteredMemos = memoDisplays.filter(memo =>
    memo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    memo.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Delete memo function
  const handleDeleteMemo = async (memo: MemoDisplay, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the dialog
    
    if (!window.confirm(`${memo.name}のメモを削除しますか？`)) return;
    
    setDeletingMemoId(memo.id);
    try {
      // Find the original memo from allMemos to determine if it's from history
      const originalMemo = allMemos.find(m => m.id === memo.id);
      
      if (originalMemo?.isFromHistory) {
        // Delete from memo history
        await deleteMemoFromHistory(memo.id);
      } else {
        // Delete single memo
        await deleteMemo(currentUser?.uid || '', memo.targetId);
      }
      
      toast({
        title: '削除完了',
        description: 'メモを削除しました'
      });
      
      // Reload memos
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete memo:', error);
      toast({
        title: 'エラー',
        description: 'メモの削除に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setDeletingMemoId(null);
    }
  };
  
  // データ取得中の表示

  // 初期ローディング中は表示しない
  // isLoadingが長引く場合は無視してページを表示
  if (isLoading && !hasInitialized) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">読み込み中...</p>
      </div>
    );
  }

  // データ読み込み中（ただし初回以外）
  if ((memosLoading || subscriptionLoading) && !isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <StickyNote className="mr-3 h-7 w-7" /> あなたのメモ
          </CardTitle>
          {!isPremium && !subscriptionLoading && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                メモ機能は有料会員限定です
              </p>
              <Button 
                onClick={() => router.push('/subscription')}
                className="mt-2"
                size="sm"
              >
                有料会員になる
              </Button>
            </div>
          )}
          {isPremium && !subscriptionLoading && (
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="メモを検索..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isPremium && !subscriptionLoading ? (
            filteredMemos.length > 0 ? (
              <ul className="space-y-4">
                {filteredMemos.map(memo => {
                  // Count how many memos exist for this target
                  const memoCount = getMemosForTarget(memo.targetId).length;
                  
                  return (
                    <li key={memo.id}>
                      <div 
                        className="block hover:bg-secondary/50 p-4 rounded-lg transition-colors border cursor-pointer"
                        onClick={() => setSelectedMemoTarget({
                          id: memo.targetId,
                          name: memo.name,
                          imageUrl: memo.avatarUrl || undefined
                        })}
                      >
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={memo.avatarUrl || undefined} alt={memo.name} />
                            <AvatarFallback>{memo.name.substring(0, 1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <p className="text-base font-semibold line-clamp-1">{memo.name}</p>
                                {memoCount > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {memoCount}件
                                  </Badge>
                                )}
                              </div>
                              {memo.lastUpdated && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(memo.lastUpdated, { addSuffix: true, locale: ja })}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{memo.content}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 p-1"
                              onClick={(e) => handleDeleteMemo(memo, e)}
                              disabled={deletingMemoId === memo.id}
                            >
                              {deletingMemoId === memo.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                            <StickyNote className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-10">
                <StickyNote className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">まだメモはありません。</p>
                <p className="text-sm text-muted-foreground">女の子のプロフィールからメモを追加しましょう！</p>
              </div>
            )
          ) : (
            <div className="text-center py-10">
              <StickyNote className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">メモ機能を利用するには有料会員登録が必要です</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Memo History Dialog */}
      {selectedMemoTarget && currentUser && (
        <MemoHistoryDialog
          open={Boolean(selectedMemoTarget)}
          onOpenChange={(open) => !open && setSelectedMemoTarget(null)}
          userId={currentUser.uid}
          targetId={selectedMemoTarget.id}
          targetName={selectedMemoTarget.name}
          targetImage={selectedMemoTarget.imageUrl}
        />
      )}
    </div>
  );
}
