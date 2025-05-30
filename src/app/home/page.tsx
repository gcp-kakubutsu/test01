
"use client";

import { UserProfileCard, type UserProfile } from '@/components/home/UserProfileCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Ban, ChevronLeft, ChevronRight, Heart, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const mockUsers: UserProfile[] = [
  { id: '1', name: 'Seraphina', age: 28, imageUrl: 'https://placehold.co/400x500/F0306A/FFF.png?text=S', bio: 'Loves art, adventure, and deep conversations. Looking for someone genuine.', kinks: ['Spontaneity', 'Intellect', 'Travel'] , dataAiHint: "woman portrait" },
  { id: '2', name: 'Orion', age: 32, imageUrl: 'https://placehold.co/400x500/FF7F50/FFF.png?text=O', bio: 'Tech enthusiast, enjoys hiking and good music. Seeking a meaningful connection.', kinks: ['Honesty', 'Humor', 'Dogs'] , dataAiHint: "man portrait" },
  { id: '3', name: 'Luna', age: 25, imageUrl: 'https://placehold.co/400x500/F9E4EB/333.png?text=L', bio: 'Bookworm and foodie. My ideal date involves a cozy cafe and great chat.', kinks: ['Kindness', 'Foodie', 'Books'] , dataAiHint: "woman smiling" },
  { id: '4', name: 'Jasper', age: 30, imageUrl: 'https://placehold.co/400x500/333/FFF.png?text=J', bio: 'Musician and dreamer. Let\'s make some beautiful memories together.', kinks: ['Music', 'Creativity', 'Night Outs'] , dataAiHint: "man casual" },
];

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [users, setUsers] = useState<UserProfile[]>(mockUsers); // In a real app, fetch this
  const [feedback, setFeedback] = useState<'liked' | 'passed' | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleAction = (action: 'like' | 'pass') => {
    setFeedback(action);
    setTimeout(() => {
      setCurrentUserIndex((prevIndex) => (prevIndex + 1) % users.length);
      setFeedback(null);
    }, 500); // Duration of feedback animation
  };

  const handleLike = () => handleAction('like');
  const handlePass = () => handleAction('pass');
  const handlePrevious = () => {
     setCurrentUserIndex((prevIndex) => (prevIndex - 1 + users.length) % users.length);
  };
  const handleReset = () => {
    setCurrentUserIndex(0); // Reset to the first user
    // Potentially re-fetch or shuffle users here in a real app
    setUsers([...mockUsers].sort(() => Math.random() - 0.5)); // Simple shuffle for demo
  }

  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-full"><p>Redirecting to login...</p></div>;
  }
  
  if (users.length === 0) {
    return <div className="text-center py-10">No more profiles to show right now. Check back later!</div>;
  }

  const currentUser = users[currentUserIndex];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <div className="w-full max-w-sm relative">
        {currentUser ? (
          <UserProfileCard user={currentUser} feedback={feedback} />
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-xl mb-4">No more profiles right now!</p>
            <Button onClick={handleReset} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" /> Reload Profiles
            </Button>
          </div>
        )}
      </div>
      {currentUser && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <Button variant="outline" size="lg" className="rounded-full p-4 h-16 w-16 shadow-lg hover:bg-secondary" onClick={handlePrevious} aria-label="Previous">
            <ChevronLeft className="h-8 w-8 text-muted-foreground" />
          </Button>
          <Button variant="destructive" size="lg" className="rounded-full p-4 h-20 w-20 shadow-xl hover:bg-destructive/90" onClick={handlePass} aria-label="Pass">
            <Ban className="h-10 w-10" />
          </Button>
          <Button variant="default" size="lg" className="rounded-full p-4 h-20 w-20 bg-green-500 hover:bg-green-600 shadow-xl" onClick={handleLike} aria-label="Like">
            <Heart className="h-10 w-10" />
          </Button>
          <Button variant="outline" size="lg" className="rounded-full p-4 h-16 w-16 shadow-lg hover:bg-secondary" onClick={() => setCurrentUserIndex((prevIndex) => (prevIndex + 1) % users.length)} aria-label="Next">
            <ChevronRight className="h-8 w-8 text-muted-foreground" />
          </Button>
        </div>
      )}
       <Button onClick={handleReset} variant="outline" className="mt-6">
          <RotateCcw className="mr-2 h-4 w-4" /> Reset Swipes
       </Button>
    </div>
  );
}
