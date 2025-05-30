
"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquareText, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

// Mock data for chat list
const mockChats = [
  { id: '1', name: 'Seraphina', lastMessage: 'Hey, how are you doing?', unreadCount: 2, avatarUrl: 'https://placehold.co/100x100/F0306A/FFF.png?text=S', dataAiHint: 'woman smiling' },
  { id: '2', name: 'Orion', lastMessage: 'Loved your profile! Let\'s chat.', unreadCount: 0, avatarUrl: 'https://placehold.co/100x100/FF7F50/FFF.png?text=O', dataAiHint: 'man thinking' },
  { id: '3', name: 'Luna', lastMessage: 'What are you up to this weekend?', unreadCount: 5, avatarUrl: 'https://placehold.co/100x100/F9E4EB/333.png?text=L', dataAiHint: 'woman laughing' },
];

export default function MessagesPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-full"><p>Redirecting to login...</p></div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <MessageSquareText className="mr-3 h-7 w-7" /> Your Conversations
          </CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input placeholder="Search messages..." className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          {mockChats.length > 0 ? (
            <ul className="space-y-4">
              {mockChats.map(chat => (
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
              <p className="text-muted-foreground">No messages yet.</p>
              <p className="text-sm text-muted-foreground">Start matching to initiate conversations!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
