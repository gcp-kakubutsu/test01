
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Loader2, StickyNote } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { useMemos } from '@/hooks/useMemos';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import AuthGuard from '@/components/AuthGuard';

interface MemoDisplay {
  id: string;
  targetId: string;
  name: string;
  content: string;
  avatarUrl: string;
  lastUpdated?: string | null;
}

export default function MemosPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const { memos, loading: memosLoading } = useMemos();
  const [searchTerm, setSearchTerm] = useState('');
  const [memoDisplays, setMemoDisplays] = useState<MemoDisplay[]>([]);
  
  // Check premium status
  useEffect(() => {
    if (!subscriptionLoading && !isPremium) {
      // Not a premium member
    }
  }, [subscriptionLoading, isPremium]);

  // Convert memos to display format
  useEffect(() => {
    if (!memos || memosLoading) return;
    
    const displays: MemoDisplay[] = memos.map(memo => ({
      id: memo.id,
      targetId: memo.targetId,
      name: memo.targetName || '名前未設定',
      content: memo.content || 'メモを追加してください',
      avatarUrl: memo.targetImage || null,
      lastUpdated: memo.updatedAt ? 
        formatDistanceToNow(memo.updatedAt.toDate(), { addSuffix: true, locale: ja }) : 
        null
    }));
    
    setMemoDisplays(displays);
  }, [memos, memosLoading]);

  const filteredMemos = memoDisplays.filter(memo =>
    memo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    memo.content.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (memosLoading || subscriptionLoading) {
    return (
      <AuthGuard>
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">読み込み中...</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
    <div className="max-w-3xl mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <StickyNote className="mr-3 h-7 w-7" /> あなたのメモ
          </CardTitle>
          {!isPremium && (
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
          {isPremium && (
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
          {isPremium ? (
            filteredMemos.length > 0 ? (
              <ul className="space-y-4">
                {filteredMemos.map(memo => (
                  <li key={memo.id}>
                    <Link href={`/messages/${memo.targetId}`} className="block hover:bg-secondary/50 p-4 rounded-lg transition-colors border">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={memo.avatarUrl} alt={memo.name} />
                          <AvatarFallback>{memo.name.substring(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-base font-semibold line-clamp-1">{memo.name}</p>
                            {memo.lastUpdated && (
                              <span className="text-xs text-muted-foreground">{memo.lastUpdated}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{memo.content}</p>
                        </div>
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
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
    </div>
    </AuthGuard>
  );
}
