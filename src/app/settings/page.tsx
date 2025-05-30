
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Bell, EyeOff, ShieldAlert, Trash2, UserX, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [profileVisible, setProfileVisible] = useState(true);
  const [matchNotifications, setMatchNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<string[]>(['BlockedUser123', 'AnotherUser']); // Mock data
  const [blockUserInput, setBlockUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
    // In a real app, fetch user settings here
  }, [isAuthenticated, router]);

  const handleSaveChanges = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log({
      profileVisible,
      matchNotifications,
      messageNotifications,
    });
    setIsLoading(false);
    toast({
      title: 'Settings Saved',
      description: 'Your preferences have been updated.',
    });
  };

  const handleBlockUser = () => {
    if (blockUserInput.trim() === '') return;
    setBlockedUsers(prev => [...prev, blockUserInput.trim()]);
    setBlockUserInput('');
    toast({ title: 'User Blocked', description: `${blockUserInput.trim()} has been added to your block list.` });
  };

  const handleUnblockUser = (userToUnblock: string) => {
    setBlockedUsers(prev => prev.filter(user => user !== userToUnblock));
    toast({ title: 'User Unblocked', description: `${userToUnblock} has been removed from your block list.` });
  };
  
  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-full"><p>Redirecting to login...</p></div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <EyeOff className="mr-3 h-7 w-7" /> Privacy Settings
          </CardTitle>
          <CardDescription>Manage your profile visibility and privacy controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
            <Label htmlFor="profileVisibility" className="text-base font-medium">
              Profile Visibility
              <p className="text-sm text-muted-foreground">Control who can see your profile.</p>
            </Label>
            <Switch
              id="profileVisibility"
              checked={profileVisible}
              onCheckedChange={setProfileVisible}
              aria-label="Toggle profile visibility"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <Bell className="mr-3 h-7 w-7" /> Notification Preferences
          </CardTitle>
          <CardDescription>Choose what alerts you want to receive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-3 p-3 rounded-md hover:bg-secondary/30 transition-colors">
            <Checkbox id="matchNotifications" checked={matchNotifications} onCheckedChange={(checked) => setMatchNotifications(Boolean(checked))} />
            <Label htmlFor="matchNotifications" className="text-base font-normal cursor-pointer">
              New Match Notifications
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-md hover:bg-secondary/30 transition-colors">
            <Checkbox id="messageNotifications" checked={messageNotifications} onCheckedChange={(checked) => setMessageNotifications(Boolean(checked))} />
            <Label htmlFor="messageNotifications" className="text-base font-normal cursor-pointer">
              New Message Notifications
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <UserX className="mr-3 h-7 w-7" /> Blocked Users
          </CardTitle>
          <CardDescription>Manage users you've blocked.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              type="text" 
              placeholder="Enter username to block" 
              value={blockUserInput}
              onChange={(e) => setBlockUserInput(e.target.value)}
              className="flex-grow"
            />
            <Button onClick={handleBlockUser} variant="outline">Block</Button>
          </div>
          {blockedUsers.length > 0 ? (
            <ul className="space-y-2 max-h-48 overflow-y-auto p-2 border rounded-md">
              {blockedUsers.map(user => (
                <li key={user} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <span className="text-sm">{user}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleUnblockUser(user)} aria-label={`Unblock ${user}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Your block list is empty.</p>
          )}
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
         <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <ShieldAlert className="mr-3 h-7 w-7" /> Account Actions
          </CardTitle>
          <CardDescription>Manage your account status.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button variant="destructive" className="w-full sm:w-auto">
                Deactivate Account
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Deactivating your account will temporarily hide your profile. You can reactivate it by logging in.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end mt-8">
        <Button onClick={handleSaveChanges} disabled={isLoading} size="lg" className="text-base px-6 py-3">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              Save All Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
