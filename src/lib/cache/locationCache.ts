import { query } from '@/lib/mysql/db';

interface LocationData {
  prefecture_id: number;
  latitude: number;
  longitude: number;
  area_name: string;
}

class LocationCache {
  private cache: Map<number, LocationData> = new Map();
  private lastUpdate: number = 0;
  private updateInterval = 3600000; // 1時間
  private isLoading = false;
  
  /**
   * 都道府県IDから位置情報を取得（超高速）
   */
  async getLocation(prefectureId: number): Promise<LocationData | null> {
    // キャッシュが古い場合は更新
    if (Date.now() - this.lastUpdate > this.updateInterval) {
      await this.refresh();
    }
    
    return this.cache.get(prefectureId) || null;
  }
  
  /**
   * 複数の都道府県IDから位置情報を一括取得
   */
  async getLocations(prefectureIds: number[]): Promise<Map<number, LocationData>> {
    if (Date.now() - this.lastUpdate > this.updateInterval) {
      await this.refresh();
    }
    
    const result = new Map<number, LocationData>();
    for (const id of prefectureIds) {
      const location = this.cache.get(id);
      if (location) {
        result.set(id, location);
      }
    }
    return result;
  }
  
  /**
   * キャッシュを更新（初回起動時とリフレッシュ時）
   */
  async refresh(): Promise<void> {
    if (this.isLoading) return;
    
    this.isLoading = true;
    try {
      console.log('📍 Location cache refreshing...');
      
      // 各都道府県の代表的な位置（area_smallsの最初のレコード）を取得
      const locations = await query<any>(`
        SELECT 
          a.area_prefecture_id as prefecture_id,
          a.latitude,
          a.longitude,
          a.name as area_name,
          p.name as prefecture_name
        FROM area_smalls a
        INNER JOIN (
          SELECT area_prefecture_id, MIN(id) as min_id
          FROM area_smalls
          GROUP BY area_prefecture_id
        ) first_area ON a.area_prefecture_id = first_area.area_prefecture_id 
          AND a.id = first_area.min_id
        LEFT JOIN area_prefectures p ON a.area_prefecture_id = p.id
      `);
      
      // キャッシュをクリアして再構築
      this.cache.clear();
      
      for (const loc of locations) {
        this.cache.set(loc.prefecture_id, {
          prefecture_id: loc.prefecture_id,
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          area_name: loc.area_name
        });
      }
      
      this.lastUpdate = Date.now();
      console.log(`✅ Location cache updated: ${this.cache.size} prefectures cached`);
      
    } catch (error) {
      console.error('❌ Location cache refresh failed:', error);
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * キャッシュサイズを取得（デバッグ用）
   */
  getSize(): number {
    return this.cache.size;
  }
  
  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
    this.lastUpdate = 0;
  }
}

// シングルトンインスタンス
export const locationCache = new LocationCache();

// アプリケーション起動時に自動的にキャッシュを構築
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  locationCache.refresh().catch(console.error);
}