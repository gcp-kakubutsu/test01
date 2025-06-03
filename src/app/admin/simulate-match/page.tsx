"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Loader2 } from 'lucide-react';

export default function SimulateMatchPage() {
  const { currentUser, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [girls, setGirls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    const fetchGirls = async () => {
      if (!db || !isAuthenticated) return;
      
      try {
        const girlsQuery = query(
          collection(db, 'users'),
          where('isGirl', '==', true)
        );
        const snapshot = await getDocs(girlsQuery);
        const girlsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setGirls(girlsData);
      } catch (error) {
        console.error('Error fetching girls:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGirls();
  }, [isAuthenticated]);

  const simulateLike = async (girlId: string, girlName: string) => {
    if (!currentUser) return;
    
    setSimulating(true);
    try {
      const response = await fetch('/api/admin/simulate-like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: girlId,
          toUserId: currentUser.uid
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "いいねを送信しました",
          description: `${girlName}からあなたへいいねを送信しました。${result.isMatch ? 'マッチしました！' : ''}`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "エラー",
        description: error.message || "いいねの送信に失敗しました",
        variant: "destructive"
      });
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>マッチシミュレーション（管理者用）</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600">
            女の子アカウントからあなたへのいいねをシミュレートします。
          </p>
          
          <div className="space-y-2">
            {girls.map(girl => (
              <div key={girl.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-semibold">{girl.username || girl.email}</p>
                  <p className="text-sm text-gray-500">ID: {girl.id}</p>
                </div>
                <Button
                  onClick={() => simulateLike(girl.id, girl.username || girl.email)}
                  disabled={simulating}
                  size="sm"
                >
                  {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'いいねを送る'}
                </Button>
              </div>
            ))}
          </div>
          
          {girls.length === 0 && (
            <p className="text-center text-gray-500">
              女の子アカウントが登録されていません。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}