"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminGirls } from '@/lib/firebase/user-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function TestFirestorePage() {
  const { currentUser, isAuthenticated } = useAuth();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [girlUsers, setGirlUsers] = useState<any[]>([]);
  const [fetchedGirls, setFetchedGirls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const testFirestore = async () => {
      if (!isAuthenticated || !currentUser) {
        toast({
          title: "認証エラー",
          description: "ログインしてください",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // 1. すべてのユーザーを取得
        console.log('Fetching all users...');
        if (!db) throw new Error('Firestore is not initialized');
        const allUsersQuery = query(collection(db, 'users'), limit(10));
        const allUsersSnapshot = await getDocs(allUsersQuery);
        const allUsersData = allUsersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllUsers(allUsersData);
        console.log('All users:', allUsersData);

        // 2. isGirl=trueのユーザーを取得
        console.log('Fetching girl users...');
        if (!db) throw new Error('Firestore is not initialized');
        const girlUsersQuery = query(collection(db, 'users'), where('isGirl', '==', true), limit(10));
        const girlUsersSnapshot = await getDocs(girlUsersQuery);
        const girlUsersData = girlUsersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setGirlUsers(girlUsersData);
        console.log('Girl users:', girlUsersData);

        // 3. fetchAdminGirls関数を使用
        console.log('Using fetchAdminGirls function...');
        const fetchedData = await fetchAdminGirls(currentUser.uid, 10);
        setFetchedGirls(fetchedData);
        console.log('Fetched girls:', fetchedData);

      } catch (err: any) {
        console.error('Error:', err);
        toast({
          title: "エラー",
          description: err.message || "データの取得に失敗しました",
          variant: "destructive",
        });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    testFirestore();
  }, [isAuthenticated, currentUser, toast]);

  if (loading) {
    return <div className="p-8">読み込み中...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Firestore デバッグページ</h1>
      
      {/* Errors are now shown via toast */}

      <Card>
        <CardHeader>
          <CardTitle>すべてのユーザー ({allUsers.length}件)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto">{JSON.stringify(allUsers, null, 2)}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>isGirl=true のユーザー ({girlUsers.length}件)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto">{JSON.stringify(girlUsers, null, 2)}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>fetchAdminGirls関数の結果 ({fetchedGirls.length}件)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto">{JSON.stringify(fetchedGirls, null, 2)}</pre>
        </CardContent>
      </Card>
    </div>
  );
}