"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import MemoPage from './memo-page';
import { fetchWithDedup } from '@/lib/utils/api-request-manager';

export default function MemoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [paramsId, setParamsId] = useState<string | null>(null);
  const [girlData, setGirlData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Unwrap params
  useEffect(() => {
    params.then(p => setParamsId(p.id));
  }, [params]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch girl data
  useEffect(() => {
    const fetchGirlData = async () => {
      if (!paramsId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        // Fetch from MySQL API for numeric IDs (with deduplication)
        const apiUrl = `/api/mysql-girls-fast?limit=1&girlId=${paramsId}`;
        const data = await fetchWithDedup(apiUrl, {
          method: 'GET'
        }, `girl_${paramsId}`);
        
        console.log('Girl data fetched:', data);
        if (data.girls && data.girls.length > 0) {
          const girl = data.girls[0];
          console.log('Girl details:', girl);
          setGirlData({
            id: paramsId,
            name: girl.name || '女の子',
            imageUrl: girl.imageUrl || girl.images?.[0]?.image_url || girl.images?.[0]?.real_image_url || null,
            location: girl.location || girl.municipality || ''
          });
        } else {
          // Girl not found, set default
          setGirlData({
            id: paramsId,
            name: '女の子',
            imageUrl: null
          });
        }
      } catch (error) {
        console.error('Error fetching girl data:', error);
        // Create default data with ID
        setGirlData({
          id: paramsId,
          name: '女の子',
          imageUrl: null
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGirlData();
  }, [paramsId]);

  if (authLoading || isLoading || !paramsId) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">読み込み中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-screen"><p>ログインページへリダイレクト中...</p></div>;
  }

  return (
    <MemoPage
      targetId={paramsId}
      targetName={girlData?.name}
      targetImage={girlData?.imageUrl}
      targetLocation={girlData?.location}
    />
  );
}