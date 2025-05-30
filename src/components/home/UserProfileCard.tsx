
"use client";

import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Ban } from 'lucide-react';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  imageUrl: string;
  bio: string;
  kinks: string[];
  dataAiHint?: string;
}

interface UserProfileCardProps {
  user: UserProfile;
  feedback?: 'liked' | 'passed' | null;
}

export function UserProfileCard({ user, feedback }: UserProfileCardProps) {
  return (
    <Card className="w-full max-w-sm overflow-hidden shadow-2xl rounded-xl transform transition-all duration-300 ease-out
                    hover:scale-105
                    data-[feedback=liked]:rotate-6 data-[feedback=liked]:translate-x-8 data-[feedback=liked]:opacity-0
                    data-[feedback=passed]:-rotate-6 data-[feedback=passed]:-translate-x-8 data-[feedback=passed]:opacity-0"
          data-feedback={feedback}
    >
      <div className="relative w-full aspect-[3/4]">
        <Image
          src={user.imageUrl}
          alt={user.name}
          layout="fill"
          objectFit="cover"
          data-ai-hint={user.dataAiHint || "人物 ポートレート"}
          priority
        />
        {feedback && (
          <div className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 ${feedback ? 'opacity-100' : 'opacity-0'}`}>
            {feedback === 'liked' && <Heart className="h-24 w-24 text-green-400" fill="currentColor" />}
            {feedback === 'passed' && <Ban className="h-24 w-24 text-red-400" fill="currentColor" />}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <CardTitle className="text-3xl font-bold text-white shadow-sm">{user.name}, {user.age}</CardTitle>
        </div>
      </div>
      <CardContent className="p-6 space-y-3">
        <p className="text-muted-foreground text-sm leading-relaxed h-20 overflow-y-auto">{user.bio}</p>
        {user.kinks && user.kinks.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2 text-primary">興味・関心:</h4>
            <div className="flex flex-wrap gap-2">
              {user.kinks.map((kink) => (
                <Badge key={kink} variant="secondary" className="text-xs">{kink}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
