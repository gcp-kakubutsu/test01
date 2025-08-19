import { useState, useEffect } from 'react';
import { getMalePreferences } from '@/lib/firebase/malePreferences';
import { useAuth } from '@/contexts/AuthContext';

interface Girl {
  id: number;
  name: string;
  age: number;
  height: number;
  bust_size: string;
  waist_size: string;
  hip_size: string;
  image_url: string;
  shop_name: string;
  location: string;
  opening_hours: string;
  shop_url: string;
  girl_types: string;
}

export function useGirlSearch() {
  const [girls, setGirls] = useState<Girl[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const searchGirlsByPreferences = async () => {
    if (!currentUser) {
      setError('ログインが必要です');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user's preferences from Firebase
      const preferences = await getMalePreferences(currentUser.uid);
      
      if (!preferences || !preferences.girlTypeIds || preferences.girlTypeIds.length === 0) {
        setError('まず詳細設定で女の子タイプを選択してください');
        setGirls([]);
        return;
      }

      // Search girls using preferences
      const response = await fetch('/api/search-girls-by-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          girlTypeIds: preferences.girlTypeIds,
          location: preferences.partnerLocation,
          ageMin: preferences.partnerAgeMin,
          ageMax: preferences.partnerAgeMax,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGirls(data.girls || []);
      } else {
        setError(data.error || '検索に失敗しました');
        setGirls([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('検索中にエラーが発生しました');
      setGirls([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    girls,
    loading,
    error,
    searchGirlsByPreferences,
  };
}