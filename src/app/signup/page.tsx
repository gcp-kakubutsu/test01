
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { UserPlus, Mail, KeyRound, UserCircle2 } from 'lucide-react';

export default function SignupPage() {
  const { login } = useAuth(); // Using login to simulate successful signup and login
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Basic validation or API call would go here
    if (password !== confirmPassword) {
      alert("Passwords don't match.");
      return;
    }
    if (username && email && password) {
      login(); // Mock signup & login
      router.push('/profile/edit'); // Redirect to profile edit after signup
    } else {
      alert("Please fill in all fields.");
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
           <div className="mx-auto p-3 bg-primary rounded-full w-fit mb-4">
            <UserPlus className="h-10 w-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Create Your Account</CardTitle>
          <CardDescription>Join NukuConnect and start exploring connections today.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-base flex items-center"><UserCircle2 className="mr-2 h-4 w-4 text-muted-foreground"/>Username</Label>
              <Input id="username" type="text" placeholder="Choose a username" required value={username} onChange={(e) => setUsername(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/>Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground"/>Password</Label>
              <Input id="password" type="password" placeholder="Create a strong password" required value={password} onChange={(e) => setPassword(e.target.value)} className="text-base p-3"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-base flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground"/>Confirm Password</Label>
              <Input id="confirmPassword" type="password" placeholder="Confirm your password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="text-base p-3"/>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full text-lg py-3">
              Sign Up
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
