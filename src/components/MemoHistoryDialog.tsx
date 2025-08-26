"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  addMemoToHistory, 
  updateMemoInHistory, 
  getMemoHistory, 
  getTodaysMemo,
  deleteMemoFromHistory,
  type MemoHistory 
} from '@/lib/firebase/memoHistory';
import { getMemo, deleteMemo, type Memo } from '@/lib/firebase/memos';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Loader2, Calendar, Clock, Edit, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MemoHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  targetId: string;
  targetName?: string;
  targetImage?: string;
}

export default function MemoHistoryDialog({
  open,
  onOpenChange,
  userId,
  targetId,
  targetName,
  targetImage
}: MemoHistoryDialogProps) {
  const [content, setContent] = useState('');
  const [action, setAction] = useState<'new' | 'update'>('new');
  const [todaysMemo, setTodaysMemo] = useState<MemoHistory | null>(null);
  const [history, setHistory] = useState<MemoHistory[]>([]);
  const [singleMemo, setSingleMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingMemoId, setDeletingMemoId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadMemoHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const memos = await getMemoHistory(userId, targetId);
      setHistory(memos);
    } catch (error) {
      console.error('Failed to load memo history:', error);
      toast({
        title: 'エラー',
        description: 'メモ履歴の読み込みに失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoadingHistory(false);
    }
  }, [userId, targetId, toast]);

  const loadSingleMemo = useCallback(async () => {
    try {
      const memo = await getMemo(userId, targetId);
      setSingleMemo(memo);
    } catch (error) {
      console.error('Failed to load single memo:', error);
    }
  }, [userId, targetId]);

  const checkTodaysMemo = useCallback(async () => {
    try {
      const memo = await getTodaysMemo(userId, targetId);
      if (memo) {
        setTodaysMemo(memo);
        setContent(memo.content);
        setAction('update');
      } else {
        setTodaysMemo(null);
        setContent('');
        setAction('new');
      }
    } catch (error) {
      console.error('Failed to check today\'s memo:', error);
    }
  }, [userId, targetId]);

  // Load memo history and single memo when dialog opens
  useEffect(() => {
    if (open) {
      loadMemoHistory();
      checkTodaysMemo();
      loadSingleMemo();
    }
  }, [open, loadMemoHistory, checkTodaysMemo, loadSingleMemo]);

  const handleSave = async () => {
    if (!content.trim()) {
      toast({
        title: 'エラー',
        description: 'メモ内容を入力してください',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      if (action === 'new' || !todaysMemo) {
        // Add new memo to history
        await addMemoToHistory(userId, targetId, content, targetName, targetImage);
        toast({
          title: '保存完了',
          description: '新しいメモを履歴に追加しました'
        });
      } else if (todaysMemo?.id) {
        // Update existing memo
        await updateMemoInHistory(todaysMemo.id, content);
        toast({
          title: '更新完了',
          description: '今日のメモを更新しました'
        });
      }

      // Reload history
      await loadMemoHistory();
      await checkTodaysMemo();
      
      // Close dialog
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save memo:', error);
      toast({
        title: 'エラー',
        description: 'メモの保存に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'yyyy年MM月dd日 HH:mm', { locale: ja });
  };

  const handleDeleteMemo = async (memoId: string, isFromSingleMemo: boolean = false) => {
    if (!memoId || !window.confirm('このメモを削除しますか？')) return;
    
    setDeletingMemoId(memoId);
    try {
      if (isFromSingleMemo) {
        // Delete single memo
        await deleteMemo(userId, targetId);
      } else {
        // Delete from history
        await deleteMemoFromHistory(memoId);
      }
      
      toast({
        title: '削除完了',
        description: 'メモを削除しました'
      });
      
      // Reload data
      await loadMemoHistory();
      await checkTodaysMemo();
      await loadSingleMemo();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>メモ履歴 - {targetName || 'ユーザー'}</DialogTitle>
          <DialogDescription>
            メモを新規追加するか、今日のメモを更新するか選択してください
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Action selection */}
          {todaysMemo && (
            <div className="space-y-2">
              <Label>アクション</Label>
              <RadioGroup value={action} onValueChange={(value) => setAction(value as 'new' | 'update')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new" id="new" />
                  <Label htmlFor="new" className="flex items-center gap-2 cursor-pointer">
                    <Plus className="h-4 w-4" />
                    新しいメモを追加
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="update" id="update" />
                  <Label htmlFor="update" className="flex items-center gap-2 cursor-pointer">
                    <Edit className="h-4 w-4" />
                    今日のメモを更新（{format(new Date(), 'MM/dd')}）
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Memo input */}
          <div className="space-y-2">
            <Label htmlFor="memo">メモ内容</Label>
            <Textarea
              id="memo"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="今日のプレイ内容や感想を記録..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* History */}
          <div className="space-y-2 flex-1 overflow-hidden">
            <Label>履歴</Label>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : history.length > 0 ? (
              <ScrollArea className="h-[200px] border rounded-lg p-3">
                <div className="space-y-3">
                  {/* Single memo (if exists and different from history) */}
                  {singleMemo && !history.some(h => 
                    h.content === singleMemo.content && 
                    h.date === new Date().toISOString().split('T')[0]
                  ) && (
                    <div className="border-b pb-3 group bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(singleMemo.updatedAt)}</span>
                          <Badge variant="outline" className="text-xs">旧システム</Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2"
                          onClick={() => handleDeleteMemo(`single_${singleMemo.id}`, true)}
                          disabled={deletingMemoId === `single_${singleMemo.id}`}
                        >
                          {deletingMemoId === `single_${singleMemo.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 text-red-500" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{singleMemo.content}</p>
                    </div>
                  )}
                  
                  {/* Memo history */}
                  {history.map((memo) => (
                    <div key={memo.id} className="border-b pb-3 last:border-0 group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(memo.createdAt)}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2"
                          onClick={() => handleDeleteMemo(memo.id || '')}
                          disabled={deletingMemoId === memo.id}
                        >
                          {deletingMemoId === memo.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 text-red-500" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{memo.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">まだメモがありません</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={loading || !content.trim()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>保存</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}