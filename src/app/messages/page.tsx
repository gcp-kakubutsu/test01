
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
import { useMatches, fetchUserProfiles } from '@/lib/firebase/hooks';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ChatDisplay {
  id: string;
  name: string;
  lastMessage: string;
  unreadCount: number;
  avatarUrl: string;
  lastMessageTime?: string | null;
}

export default function MessagesPage() {
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const { matches, loading: matchesLoading } = useMatches();
  const [searchTerm, setSearchTerm] = useState('');
  const [chats, setChats] = useState<ChatDisplay[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Convert matches to chat display format
  useEffect(() => {
    const loadChats = async () => {
      if (!currentUser || matchesLoading) return;
      
      setIsLoadingChats(true);
      
      // If no matches, set empty array
      if (matches.length === 0) {
        setChats([]);
        setIsLoadingChats(false);
        return;
      }
      
      // Get all other user IDs from matches
      const otherUserIds = matches.map(match => 
        match.users.find(uid => uid !== currentUser.uid)
      ).filter(Boolean) as string[];
      
      // Fetch user profiles
      const userProfiles = await fetchUserProfiles(otherUserIds);
      
      // Convert to chat display format
      const chatList: ChatDisplay[] = matches.map(match => {
        const otherUserId = match.users.find(uid => uid !== currentUser.uid);
        const otherUser = otherUserId ? userProfiles.get(otherUserId) : null;
        
        return {
          id: match.id,
          name: otherUser?.username || 'ユーザー',
          lastMessage: match.lastMessage || 'メッセージを送ってみましょう',
          unreadCount: match.unreadCount?.[currentUser.uid] || 0,
          avatarUrl: otherUser?.profilePhotoUrl || 'https://placehold.co/100x100/F0306A/FFF.png?text=U',
          lastMessageTime: match.lastMessageAt ? 
            formatDistanceToNow(match.lastMessageAt.toDate(), { addSuffix: true, locale: ja }) : 
            null
        };
      });
      
      setChats(chatList);
      setIsLoadingChats(false);
    };
    
    loadChats();
  }, [matches, matchesLoading, currentUser]);

  if (authLoading || isLoadingChats) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">読み込み中...</p></div>;
  }
  
  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-screen"><p>ログインページへリダイレクト中...</p></div>;
  }

  const filteredChats = chats.filter(chat =>
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
                        <AvatarImage src={chat.avatarUrl} alt={chat.name} />
                        <AvatarFallback>{chat.name.substring(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-base font-semibold truncate">{chat.name}</p>
                          {chat.lastMessageTime && (
                            <span className="text-xs text-muted-foreground">{chat.lastMessageTime}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
                      </div>
                      {chat.unreadCount > 0 && (
                        <Badge variant="default" className="bg-red-500 text-white min-w-[24px] h-6 px-2 rounded-full flex items-center justify-center">
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </Badge>
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
