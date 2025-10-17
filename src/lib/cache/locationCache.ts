import { query } from '@/lib/mysql/db';
import { calculateDistance } from '@/lib/utils/location';

interface LocationData {
  prefecture_id: number;
  latitude: number;
  longitude: number;
  area_name: string;
  prefecture_name: string;
}

class LocationCache {
  private cache: Map<number, LocationData> = new Map();
  private nameIndex: Map<string, LocationData> = new Map();
  private neighborIndex: Map<number, number[]> = new Map();
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
      this.nameIndex.clear();
      this.neighborIndex.clear();
      
      const normalizedRecords: LocationData[] = [];
      for (const loc of locations) {
        const normalized: LocationData = {
          prefecture_id: loc.prefecture_id,
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          area_name: loc.area_name,
          prefecture_name: loc.prefecture_name
        };
        this.cache.set(loc.prefecture_id, normalized);
        normalizedRecords.push(normalized);
        
        const keys = this.buildNameKeys(loc.prefecture_name, loc.area_name);
        for (const key of keys) {
          if (!this.nameIndex.has(key)) {
            this.nameIndex.set(key, normalized);
          }
        }
      }

      // 近隣県の事前計算
      for (const origin of normalizedRecords) {
        const neighbors = normalizedRecords
          .filter(target => target.prefecture_id !== origin.prefecture_id)
          .map(target => ({
            id: target.prefecture_id,
            distance: calculateDistance(
              origin.latitude,
              origin.longitude,
              target.latitude,
              target.longitude
            )
          }))
          .sort((a, b) => a.distance - b.distance)
          .map(item => item.id);
        this.neighborIndex.set(origin.prefecture_id, neighbors);
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

  /**
   * 都道府県名から代表地点を取得
   */
  async getPrefectureByName(name: string): Promise<LocationData | null> {
    if (!name) return null;
    
    if (Date.now() - this.lastUpdate > this.updateInterval) {
      await this.refresh();
    }
    
    const candidates = this.buildLookupKeys(name);
    for (const key of candidates) {
      const record = this.nameIndex.get(key);
      if (record) {
        return record;
      }
    }
    return null;
  }

  /**
   * 指定都道府県に隣接する近隣都道府県IDリストを距離順で取得
   */
  async getNearestPrefectureIds(prefectureId: number, limit: number = 4): Promise<number[]> {
    if (Date.now() - this.lastUpdate > this.updateInterval) {
      await this.refresh();
    }
    
    const neighbors = this.neighborIndex.get(prefectureId);
    if (!neighbors || neighbors.length === 0) {
      return [];
    }
    return neighbors.slice(0, Math.max(0, limit));
  }

  private normalizeKey(value: string): string {
    return value
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  private stripSuffix(value: string): string {
    return value.replace(/[都道府県]$/u, '');
  }

  private buildNameKeys(prefectureName: string | null, areaName?: string | null): string[] {
    const keys = new Set<string>();
    const pushVariants = (value: string | null | undefined) => {
      if (!value) return;
      const normalized = this.normalizeKey(value);
      if (!normalized) return;
      keys.add(normalized);
      const base = this.stripSuffix(normalized);
      if (base) {
        keys.add(base);
        keys.add(`${base}都`);
        keys.add(`${base}道`);
        keys.add(`${base}府`);
        keys.add(`${base}県`);
      }
    };
    
    pushVariants(prefectureName);
    pushVariants(areaName);
    return Array.from(keys);
  }

  private buildLookupKeys(input: string): string[] {
    const normalized = this.normalizeKey(input);
    const keys = new Set<string>([normalized]);
    const base = this.stripSuffix(normalized);
    if (base) {
      keys.add(base);
      keys.add(`${base}都`);
      keys.add(`${base}道`);
      keys.add(`${base}府`);
      keys.add(`${base}県`);
    }
    return Array.from(keys);
  }
}

// シングルトンインスタンス
export const locationCache = new LocationCache();

// アプリケーション起動時に自動的にキャッシュを構築
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  locationCache.refresh().catch(console.error);
}
