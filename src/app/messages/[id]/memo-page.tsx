"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Trash2, Loader2, StickyNote } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useMemo as useFirebaseMemo } from '@/hooks/useMemos';
import { saveMemo, deleteMemo } from '@/lib/firebase/memos';
import { useToast } from '@/hooks/use-toast';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import Image from 'next/image';

interface MemoPageProps {
  targetId: string;
  targetName?: string;
  targetImage?: string;
}

export default function MemoPage({ targetId, targetName, targetImage }: MemoPageProps) {
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const { isPremium, loading: subscriptionLoading, isLineBrowser } = usePremiumStatus();
  const router = useRouter();
  const { toast } = useToast();
  const { memo, loading: memoLoading, reload } = useFirebaseMemo(targetId);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!subscriptionLoading && !isPremium && !isLineBrowser && isAuthenticated) {
      toast({
        title: '有料会員限定',
        description: 'メモ機能は有料会員のみ利用可能です',
        variant: 'destructive'
      });
      router.push('/subscription');
    }
  }, [subscriptionLoading, isPremium, isLineBrowser, isAuthenticated, router, toast]);

  useEffect(() => {
    if (memo) {
      setContent(memo.content);
    }
  }, [memo]);

  const handleSave = async () => {
    if (!currentUser || (!isPremium && !isLineBrowser) || isSaving) return;

    setIsSaving(true);
    try {
      console.log('Saving memo with:', { targetId, targetName, targetImage });
      await saveMemo(
        currentUser.uid,
        targetId,
        content,
        targetName,
        targetImage
      );
      await reload();
      toast({
        title: '保存しました',
        description: 'メモが保存されました',
      });
    } catch (error) {
      console.error('Error saving memo:', error);
      toast({
        title: 'エラー',
        description: 'メモの保存に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser || (!isPremium && !isLineBrowser) || isDeleting) return;

    if (!confirm('このメモを削除しますか？')) return;

    setIsDeleting(true);
    try {
      await deleteMemo(currentUser.uid, targetId);
      setContent('');
      await reload();
      toast({
        title: '削除しました',
        description: 'メモが削除されました',
      });
      router.push('/messages');
    } catch (error) {
      console.error('Error deleting memo:', error);
      toast({
        title: 'エラー',
        description: 'メモの削除に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading || memoLoading || subscriptionLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">読み込み中...</p>
      </div>
    );
  }

  if (!isPremium && !isLineBrowser) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center mb-4">メモ機能は有料会員限定です</p>
            <Button onClick={() => router.push('/subscription')} className="w-full">
              有料会員になる
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <Link href="/messages" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="mr-2 h-5 w-5" /> 戻る
            </Link>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || !content.trim()}
                size="sm"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                保存
              </Button>
              {memo && (
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  variant="destructive"
                  size="sm"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  削除
                </Button>
              )}
            </div>
          </div>
          <CardTitle className="flex items-center mt-4">
            <StickyNote className="mr-3 h-6 w-6" />
            {targetName && targetName !== '女の子' ? `${targetName}さんのメモ` : 'メモ'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {targetImage && (
            <div className="mb-4 flex justify-center">
              <div className="relative w-32 h-32 rounded-full overflow-hidden">
                <Image
                  src={targetImage}
                  alt={targetName || 'Profile'}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          )}
          <Textarea
            placeholder="ここにメモを入力してください..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[300px] resize-none"
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-2">
            このメモはあなただけが見ることができます
          </p>
        </CardContent>
      </Card>
    </div>
  );
}