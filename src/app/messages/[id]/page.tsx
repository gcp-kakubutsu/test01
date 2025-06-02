
"use client";

import { useEffect, useState, useRef, FormEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Paperclip, SmilePlus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useMessages, useUserProfile, fetchUserProfiles } from '@/lib/firebase/hooks';
import { sendMessage, markMessageAsRead } from '@/lib/firebase/actions';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';


interface MatchUser {
  id: string;
  name: string;
  profilePhotoUrl: string;
}

export default function ChatPage({ params }: { params: { id: string } }) {
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const { messages, loading: messagesLoading } = useMessages(params.id);
  const { profile: currentUserProfile } = useUserProfile();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [matchUser, setMatchUser] = useState<MatchUser | null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch match data and other user's profile
  useEffect(() => {
    const fetchMatchData = async () => {
      if (!currentUser || !db) {
        setIsLoadingMatch(false);
        return;
      }
      
      setIsLoadingMatch(true);
      try {
        const matchRef = doc(db, 'matches', params.id);
        const matchDoc = await getDoc(matchRef);
        
        if (matchDoc.exists()) {
          const data = matchDoc.data();
          setMatchData(data);
          
          // Find the other user in the match
          const otherUserId = data.users.find((id: string) => id !== currentUser.uid);
          if (otherUserId) {
            const profiles = await fetchUserProfiles([otherUserId]);
            const otherUserProfile = profiles.get(otherUserId);
            if (otherUserProfile) {
              setMatchUser({
                id: otherUserId,
                name: otherUserProfile.username || 'ユーザー',
                profilePhotoUrl: otherUserProfile.profilePhotoUrl || 'https://placehold.co/100x100/F0306A/FFF.png?text=U'
              });
            } else {
              // If profile not found, create a default one
              setMatchUser({
                id: otherUserId,
                name: 'ユーザー',
                profilePhotoUrl: 'https://placehold.co/100x100/F0306A/FFF.png?text=U'
              });
            }
          }
        } else {
          // Match not found - create dummy data for testing
          console.log('Match not found, using dummy data');
          setMatchUser({
            id: 'dummy-user',
            name: 'テストユーザー',
            profilePhotoUrl: 'https://placehold.co/100x100/F0306A/FFF.png?text=Test'
          });
          setMatchData({
            users: [currentUser.uid, 'dummy-user'],
            matchedAt: new Date()
          });
        }
      } catch (error) {
        console.error('Error fetching match data:', error);
        // On error, show dummy data
        setMatchUser({
          id: 'error-user',
          name: 'エラー',
          profilePhotoUrl: 'https://placehold.co/100x100/F0306A/FFF.png?text=Error'
        });
      } finally {
        setIsLoadingMatch(false);
      }
    };
    
    fetchMatchData();
  }, [params.id, currentUser]);

  // Mark messages as read
  useEffect(() => {
    const markAsRead = async () => {
      if (!currentUser || !messages.length) return;
      
      const unreadMessages = messages.filter(msg => 
        msg.senderId !== currentUser.uid && !msg.read
      );
      
      for (const msg of unreadMessages) {
        await markMessageAsRead(params.id, msg.id, currentUser.uid);
      }
    };
    
    markAsRead();
  }, [messages, currentUser, params.id]);

  useEffect(() => {
    // 新しいメッセージが追加されたときに一番下にスクロール
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !currentUser || isSending) return;
    
    setIsSending(true);
    try {
      await sendMessage(params.id, currentUser.uid, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading || isLoadingMatch) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">読み込み中...</p></div>;
  }
  
  if (!isAuthenticated || !currentUser) {
    return <div className="flex justify-center items-center h-screen"><p>ログインページへリダイレクト中...</p></div>;
  }
  
  if (!matchUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-700 mb-2">マッチが見つかりません</p>
          <p className="text-gray-500 mb-4">このメッセージは利用できません</p>
          <Button onClick={() => router.push('/messages')}>
            メッセージ一覧に戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-150px)] max-w-2xl mx-auto">
       <Card className="flex flex-col flex-grow shadow-lg overflow-hidden">
        <CardHeader className="bg-card border-b p-4">
          <div className="flex items-center space-x-3">
            <Link href="/messages">
              <Button variant="ghost" size="icon" aria-label="メッセージ一覧に戻る">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <Avatar>
              <AvatarImage src={matchUser.profilePhotoUrl} alt={matchUser.name} />
              <AvatarFallback>{matchUser.name.substring(0,1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-lg font-semibold">{matchUser.name}</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="flex-grow p-0">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <p>まだメッセージがありません</p>
                  <p className="text-sm mt-2">最初のメッセージを送ってみましょう！</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.senderId === currentUser.uid;
                  const timestamp = msg.createdAt?.toDate ? 
                    formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true, locale: ja }) : 
                    '';
                  
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl shadow ${
                        isMe
                          ? 'bg-primary text-primary-foreground rounded-br-none'
                          : 'bg-secondary text-secondary-foreground rounded-bl-none'
                      }`}>
                        <p className="text-sm">{msg.text}</p>
                        <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/70 text-right' : 'text-secondary-foreground/70 text-left'}`}>
                          {timestamp}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-4 border-t bg-card">
          <form onSubmit={handleSendMessage} className="flex items-center w-full space-x-2">
            <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-primary" aria-label="ファイルを添付">
              <Paperclip className="h-5 w-5" />
            </Button>
             <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-primary" aria-label="絵文字を選択">
              <SmilePlus className="h-5 w-5" />
            </Button>
            <Input
              type="text"
              placeholder="メッセージを入力..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 text-base"
              autoComplete="off"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="bg-primary hover:bg-primary/90" 
              aria-label="送信"
              disabled={isSending || !newMessage.trim()}
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
