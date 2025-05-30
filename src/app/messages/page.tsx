
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquareText, Search, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

// チャットリストのモックデータ
const mockChats = [
  { id: '1', name: 'さくら', lastMessage: '元気？最近どうしてる？', unreadCount: 2, avatarUrl: 'https://placehold.co/100x100/F0306A/FFF.png?text=S', dataAiHint: '女性 笑顔' },
  { id: '2', name: 'かける', lastMessage: 'プロフィール見ました！お話しませんか？', unreadCount: 0, avatarUrl: 'https://placehold.co/100x100/FF7F50/FFF.png?text=K', dataAiHint: '男性 考える' },
  { id: '3', name: 'ひなた', lastMessage: '週末は何してるの？', unreadCount: 5, avatarUrl: 'https://placehold.co/100x100/F9E4EB/333.png?text=H', dataAiHint: '女性 笑う' },
];

export default function MessagesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">読み込み中...</p></div>;
  }
  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-screen"><p>ログインページへリダイレクト中...</p></div>;
  }


  const filteredChats = mockChats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <MessageSquareText className="mr-3 h-7 w-7" /> あなたの会話
          </CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="メッセージを検索..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredChats.length > 0 ? (
            <ul className="space-y-4">
              {filteredChats.map(chat => (
                <li key={chat.id}>
                  <Link href={`/messages/${chat.id}`} className="block hover:bg-secondary/50 p-4 rounded-lg transition-colors border">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={chat.avatarUrl} alt={chat.name} data-ai-hint={chat.dataAiHint}/>
                        <AvatarFallback>{chat.name.substring(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold truncate">{chat.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
                      </div>
                      {chat.unreadCount > 0 && (
                        <Badge variant="default" className="bg-primary text-primary-foreground">{chat.unreadCount}</Badge>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10">
              <MessageSquareText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">まだメッセージはありません。</p>
              <p className="text-sm text-muted-foreground">マッチングを開始して会話を始めましょう！</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
