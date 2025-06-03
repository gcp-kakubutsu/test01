"use client";

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, MapPin, Heart, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserProfile {
  id: string;
  name: string;
  age: number;
  location: string;
  bio: string;
  interests: string[];
  imageUrl: string;
}

// Mock data
const mockUsers: UserProfile[] = [
  {
    id: '1',
    name: 'さくら',
    age: 25,
    location: '東京',
    bio: 'カフェ巡りが好きです☕️ 週末は美術館によく行きます',
    interests: ['カフェ', 'アート', '映画'],
    imageUrl: 'https://placehold.co/400x600/FFB6C1/FFFFFF?text=User'
  },
  {
    id: '2',
    name: 'ゆうた',
    age: 28,
    location: '大阪',
    bio: 'アウトドア派です！キャンプと登山が趣味',
    interests: ['キャンプ', '登山', '写真'],
    imageUrl: 'https://placehold.co/400x600/87CEEB/FFFFFF?text=User'
  },
  {
    id: '3',
    name: 'みく',
    age: 23,
    location: '福岡',
    bio: '音楽と旅行が大好き♪ フェスによく参加してます',
    interests: ['音楽', '旅行', 'フェス'],
    imageUrl: 'https://placehold.co/400x600/DDA0DD/FFFFFF?text=User'
  }
];

export default function SearchPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filteredUsers, setFilteredUsers] = useState(mockUsers);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSearch = () => {
    const filtered = mockUsers.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.interests.some(interest => 
        interest.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
    setFilteredUsers(filtered);
    setCurrentIndex(0);
  };

  const handleLike = () => {
    console.log('Liked:', filteredUsers[currentIndex]);
    nextProfile();
  };

  const handlePass = () => {
    console.log('Passed:', filteredUsers[currentIndex]);
    nextProfile();
  };

  const nextProfile = () => {
    if (currentIndex < filteredUsers.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const currentUser = filteredUsers[currentIndex];

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="名前、趣味、場所で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} variant="outline">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* User Cards */}
      {currentUser ? (
        <Card className="overflow-hidden shadow-lg">
          <div className="relative h-[500px]">
            <Image
              src={currentUser.imageUrl}
              alt={currentUser.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            
            {/* User Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{currentUser.name}</h2>
                  <span className="text-xl">{currentUser.age}</span>
                </div>
                {/* 円形プロフィール写真 */}
                <Avatar className="h-14 w-14 border-3 border-white shadow-lg">
                  <AvatarImage src={currentUser.imageUrl} alt={currentUser.name} />
                  <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
              
              <div className="flex items-center gap-1 mb-3 text-sm">
                <MapPin className="h-4 w-4" />
                <span>{currentUser.location}</span>
              </div>
              
              <p className="mb-3 text-sm">{currentUser.bio}</p>
              
              <div className="flex flex-wrap gap-2">
                {currentUser.interests.map((interest) => (
                  <Badge key={interest} variant="secondary" className="bg-white/20 text-white border-white/30">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <CardContent className="p-4">
            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full h-16 w-16 p-0 border-2 hover:border-red-500 hover:bg-red-50"
                onClick={handlePass}
              >
                <X className="h-8 w-8 text-red-500" />
              </Button>
              <Button
                size="lg"
                className="rounded-full h-16 w-16 p-0 bg-[#F0306A] hover:bg-[#E02860]"
                onClick={handleLike}
              >
                <Heart className="h-8 w-8 text-white" fill="white" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-gray-500">検索結果がありません</p>
        </Card>
      )}

      {/* Results Counter */}
      {filteredUsers.length > 0 && (
        <p className="text-center text-sm text-gray-500">
          {currentIndex + 1} / {filteredUsers.length} 人
        </p>
      )}
    </div>
  );
}