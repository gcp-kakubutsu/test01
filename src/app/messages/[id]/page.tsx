
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
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';


interface MatchUser {
  id: string;
  name: string;
  profilePhotoUrl: string;
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { isAuthenticated, isLoading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const [paramsId, setParamsId] = useState<string | null>(null);
  const { messages, loading: messagesLoading } = useMessages(paramsId || '');
  const { profile: currentUserProfile } = useUserProfile();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [matchUser, setMatchUser] = useState<MatchUser | null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Unwrap params
  useEffect(() => {
    params.then(p => setParamsId(p.id));
  }, [params]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch match data and other user's profile
  useEffect(() => {
    const fetchMatchData = async () => {
      if (!currentUser || !db || !paramsId) {
        setIsLoadingMatch(false);
        return;
      }
      
      setIsLoadingMatch(true);
      try {
        const matchRef = doc(db, 'matches', paramsId);
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
          // Match not found
          console.log('Match not found');
          setMatchUser(null);
          setMatchData(null);
        }
      } catch (error) {
        console.error('Error fetching match data:', error);
        // On error, set null
        setMatchUser(null);
        setMatchData(null);
      } finally {
        setIsLoadingMatch(false);
      }
    };
    
    fetchMatchData();
  }, [paramsId, currentUser]);

  // Mark messages as read
  useEffect(() => {
    const markAsRead = async () => {
      if (!currentUser || !messages.length) return;
      
      const unreadMessages = messages.filter(msg => 
        msg.senderId !== currentUser.uid && !msg.read
      );
      
      for (const msg of unreadMessages) {
        await markMessageAsRead(paramsId || '', msg.id, currentUser.uid);
      }
    };
    
    markAsRead();
  }, [messages, currentUser, paramsId]);

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
      await sendMessage(paramsId || '', currentUser.uid, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading || isLoadingMatch || !paramsId) {
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
       <Card className="flex flex-col flex-grow shadow-lg overflow-hidden bg-[#7494C0]/5">
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
          <ScrollArea className="h-full px-4 py-2" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <p>まだメッセージがありません</p>
                  <p className="text-sm mt-2">最初のメッセージを送ってみましょう！</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.senderId === currentUser.uid;
                  const msgDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
                  const prevMsgDate = index > 0 && messages[index - 1].createdAt?.toDate ? 
                    messages[index - 1].createdAt.toDate() : null;
                  const showDateDivider = index === 0 || (prevMsgDate && !isSameDay(msgDate, prevMsgDate));
                  
                  let dateLabel = '';
                  if (showDateDivider) {
                    if (isToday(msgDate)) {
                      dateLabel = '今日';
                    } else if (isYesterday(msgDate)) {
                      dateLabel = '昨日';
                    } else {
                      dateLabel = format(msgDate, 'M月d日(E)', { locale: ja });
                    }
                  }
                  
                  const timeString = format(msgDate, 'HH:mm');
                  
                  return (
                    <div key={msg.id}>
                      {showDateDivider && (
                        <div className="flex justify-center my-4">
                          <span className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                            {dateLabel}
                          </span>
                        </div>
                      )}
                      <div className={`flex items-start gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                          <div className="flex flex-col items-center">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={matchUser.profilePhotoUrl} alt={matchUser.name} />
                              <AvatarFallback className="text-sm bg-secondary">{matchUser.name.substring(0,1).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-muted-foreground mt-1 min-w-0 break-words">
                              {matchUser.name}
                            </span>
                          </div>
                        )}
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[65%]`}>
                          <div className={`px-4 py-2 rounded-2xl ${
                            isMe
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-secondary text-secondary-foreground rounded-bl-sm'
                          }`}>
                            <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                          </div>
                          <p className={`text-xs mt-0.5 px-1 text-muted-foreground`}>
                            {timeString}
                          </p>
                        </div>
                        {isMe && currentUserProfile && (
                          <div className="flex flex-col items-center">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={currentUserProfile.profilePhotoUrl || 'https://placehold.co/100x100/F0306A/FFF.png?text=U'} alt={currentUserProfile.username || 'あなた'} />
                              <AvatarFallback className="text-sm bg-primary text-primary-foreground">{(currentUserProfile.username || 'あなた').substring(0,1).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-muted-foreground mt-1 min-w-0 break-words">
                              {currentUserProfile.username || 'あなた'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-3 border-t bg-background">
          <form onSubmit={handleSendMessage} className="flex items-center w-full gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-primary h-8 w-8" aria-label="ファイルを添付">
                <Paperclip className="h-4 w-4" />
              </Button>
               <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-primary h-8 w-8" aria-label="絵文字を選択">
                <SmilePlus className="h-4 w-4" />
              </Button>
            </div>
            <Input
              type="text"
              placeholder="メッセージを入力"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 h-9 text-sm bg-muted border-0 focus-visible:ring-1"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e as any);
                }
              }}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="bg-primary hover:bg-primary/90 h-8 w-8" 
              aria-label="送信"
              disabled={isSending || !newMessage.trim()}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
