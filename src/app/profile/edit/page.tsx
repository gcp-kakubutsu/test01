
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCircle, Image as ImageIcon, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// Mock current user data structure
interface UserProfileData {
  displayName: string;
  bio: string;
  kinks: string; // Comma-separated for simplicity in this example
  profilePhotoUrl?: string;
}

export default function EditProfilePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [kinks, setKinks] = useState(''); // Storing as comma-separated string
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate fetching existing user data
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    // In a real app, fetch user data here
    const mockUserData: UserProfileData = {
      displayName: 'AlexDoe',
      bio: 'Lover of life, adventure, and exploring new connections. Open-minded and looking for similar souls.',
      kinks: 'Travel,Photography,Foodie,Deep Conversations',
      profilePhotoUrl: 'https://placehold.co/200x200.png?text=AD',
    };
    setDisplayName(mockUserData.displayName);
    setBio(mockUserData.bio);
    setKinks(mockUserData.kinks);
    setProfilePhotoPreview(mockUserData.profilePhotoUrl || null);
  }, [isAuthenticated, router]);


  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Handle form data submission (e.g., send to backend)
    // For profilePhotoFile, you'd typically upload it to a storage service
    // and save the URL.

    console.log({
      displayName,
      bio,
      kinks: kinks.split(',').map(k => k.trim()).filter(k => k), // Convert to array
      profilePhotoFile: profilePhotoFile?.name, // Just logging name for demo
    });

    setIsLoading(false);
    toast({
      title: 'Profile Updated',
      description: 'Your profile information has been successfully saved.',
    });
  };
  
  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-full"><p>Redirecting to login...</p></div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <UserCircle className="mr-3 h-8 w-8" /> Edit Your Profile
          </CardTitle>
          <CardDescription>
            Keep your profile up-to-date to attract the best matches.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-md bg-secondary">
                {profilePhotoPreview ? (
                  <Image src={profilePhotoPreview} alt="Profile Preview" layout="fill" objectFit="cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </div>
              <Input id="profilePhoto" type="file" accept="image/*" onChange={handlePhotoChange} className="max-w-xs file:text-primary file:font-semibold"/>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-base">Display Name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your public username" required className="text-base" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-base">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself, your interests, and what you're looking for..."
                rows={5}
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kinks" className="text-base flex items-center">
                <Tag className="mr-2 h-5 w-5 text-muted-foreground" /> Your Kinks & Interests
              </Label>
              <Input 
                id="kinks" 
                value={kinks} 
                onChange={(e) => setKinks(e.target.value)} 
                placeholder="e.g., Travel, Art, BDSM, Roleplay (comma-separated)" 
                className="text-base" 
              />
              <p className="text-xs text-muted-foreground">Separate items with a comma.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="w-full text-lg py-3">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
