
"use client";

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { aiProfileVerification, type AIProfileVerificationOutput } from '@/ai/flows/ai-profile-verification';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function VerifyProfilePage() {
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [profileDescription, setProfileDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<AIProfileVerificationOutput | null>(null);
  const { toast } = useToast();

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setProfilePhotoFile(null);
      setProfilePhotoPreview(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profilePhotoFile || !profileDescription) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both a profile photo and a description.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setVerificationResult(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(profilePhotoFile);
      reader.onload = async () => {
        const profilePhotoDataUri = reader.result as string;
        const result = await aiProfileVerification({
          profilePhotoDataUri,
          profileDescription,
        });
        setVerificationResult(result);
        toast({
          title: 'Verification Complete',
          description: 'Profile analysis finished.',
        });
      };
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        toast({
          title: 'File Read Error',
          description: 'Could not process the uploaded photo. Please try again.',
          variant: 'destructive',
        });
        setIsLoading(false);
      };
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: 'Verification Failed',
        description: 'An error occurred during profile verification. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    } finally {
      // setIsLoading(false) is handled inside onload/onerror for FileReader
    }
  };
  
  // This effect ensures loading stops if FileReader promise isn't picked up by finally.
  useEffect(() => {
    if(verificationResult && isLoading) {
        setIsLoading(false);
    }
  }, [verificationResult, isLoading]);


  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">AI Profile Verification</CardTitle>
          <CardDescription>
            Upload your profile photo and description for an AI-powered safety and authenticity check.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="profilePhoto" className="text-base">Profile Photo</Label>
              <Input id="profilePhoto" type="file" accept="image/*" onChange={handlePhotoChange} className="file:text-primary file:font-semibold"/>
              {profilePhotoPreview && (
                <div className="mt-4 relative w-48 h-48 rounded-lg overflow-hidden border-2 border-primary shadow-md mx-auto">
                  <Image src={profilePhotoPreview} alt="Profile Preview" layout="fill" objectFit="cover" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileDescription" className="text-base">Profile Description</Label>
              <Textarea
                id="profileDescription"
                value={profileDescription}
                onChange={(e) => setProfileDescription(e.target.value)}
                placeholder="Tell us about yourself or what you're looking for..."
                rows={5}
                className="text-base"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="w-full text-lg py-3">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Profile'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {verificationResult && (
        <Card className="mt-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-primary">Verification Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center">
              {verificationResult.isGenuine ? (
                <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500 mr-2" />
              )}
              <p className={`font-semibold ${verificationResult.isGenuine ? 'text-green-600' : 'text-red-600'}`}>
                Profile Genuineness: {verificationResult.isGenuine ? 'Likely Genuine' : 'Potentially Not Genuine'}
              </p>
            </div>
            <div className="flex items-center">
              {verificationResult.isAppropriate ? (
                <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-yellow-500 mr-2" />
              )}
              <p className={`font-semibold ${verificationResult.isAppropriate ? 'text-green-600' : 'text-yellow-600'}`}>
                Content Appropriateness: {verificationResult.isAppropriate ? 'Appropriate' : 'May Contain Inappropriate Content'}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-muted-foreground">Reason:</h4>
              <p className="text-sm">{verificationResult.reason}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
