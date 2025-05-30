
"use client";

import { useEffect, useState, useRef, FormEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Paperclip, SmilePlus } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';


interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: string;
}

// チャットのモックデータ
const mockChatName = "さくら"; // 以前は "Seraphina"
const mockChatAvatar = "https://placehold.co/100x100/F0306A/FFF.png?text=S";
const mockMessages: Message[] = [
  { id: '1', text: 'こんにちは！プロフィール素敵ですね😊', sender: 'them', timestamp: '10:00 AM' },
  { id: '2', text: 'さくらさん、ありがとう！あなたのも素晴らしいです！', sender: 'me', timestamp: '10:01 AM' },
  { id: '3', text: 'どんなことに興味がありますか？', sender: 'them', timestamp: '10:02 AM' },
  { id: '4', text: '新しいカフェ巡りやハイキングが好きです。あなたは？', sender: 'me', timestamp: '10:03 AM' },
];

export default function ChatPage({ params }: { params: { id: string } }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
    // 実際のアプリでは、params.id のチャット詳細とメッセージをフェッチします
  }, [isAuthenticated, router, params.id]);

  useEffect(() => {
    // 新しいメッセージが追加されたときに一番下にスクロール
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;
    const message: Message = {
      id: String(messages.length + 1),
      text: newMessage,
      sender: 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-full"><p>ログインページへリダイレクト中...</p></div>;
  }

  // これは実際のアプリでは動的になります
  const chatPartnerName = mockChatName;
  const chatPartnerAvatar = mockChatAvatar;

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
              <AvatarImage src={chatPartnerAvatar} alt={chatPartnerName} data-ai-hint="女性 ポートレート"/>
              <AvatarFallback>{chatPartnerName.substring(0,1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-lg font-semibold">{chatPartnerName}</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="flex-grow p-0">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl shadow ${
                    msg.sender === 'me'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-secondary text-secondary-foreground rounded-bl-none'
                  }`}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-primary-foreground/70 text-right' : 'text-secondary-foreground/70 text-left'}`}>
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              ))}
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
            <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90" aria-label="送信">
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
