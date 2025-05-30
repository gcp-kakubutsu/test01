
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

// Mock data for a chat
const mockChatName = "Seraphina";
const mockChatAvatar = "https://placehold.co/100x100/F0306A/FFF.png?text=S";
const mockMessages: Message[] = [
  { id: '1', text: 'Hey there! Loved your profile. 😊', sender: 'them', timestamp: '10:00 AM' },
  { id: '2', text: 'Hi Seraphina! Thanks, yours is great too!', sender: 'me', timestamp: '10:01 AM' },
  { id: '3', text: 'What kind of things are you into?', sender: 'them', timestamp: '10:02 AM' },
  { id: '4', text: 'I love exploring new cafes and hiking. You?', sender: 'me', timestamp: '10:03 AM' },
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
    // In a real app, fetch chat details and messages for params.id
  }, [isAuthenticated, router, params.id]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
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
    return <div className="flex justify-center items-center h-full"><p>Redirecting to login...</p></div>;
  }
  
  // This will be dynamic in a real app
  const chatPartnerName = mockChatName; 
  const chatPartnerAvatar = mockChatAvatar;

  return (
    <div className="flex flex-col h-[calc(100vh-150px)] max-w-2xl mx-auto">
       <Card className="flex flex-col flex-grow shadow-lg overflow-hidden">
        <CardHeader className="bg-card border-b p-4">
          <div className="flex items-center space-x-3">
            <Link href="/messages">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </Link>
            <Avatar>
              <AvatarImage src={chatPartnerAvatar} alt={chatPartnerName} data-ai-hint="person portrait"/>
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
            <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-primary">
              <Paperclip className="h-5 w-5" />
            </Button>
             <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-primary">
              <SmilePlus className="h-5 w-5" />
            </Button>
            <Input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 text-base"
              autoComplete="off"
            />
            <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90">
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
