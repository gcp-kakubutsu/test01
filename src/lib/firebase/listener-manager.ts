/**
 * Firestoreリスナー管理ユーティリティ
 * リスナーの重複登録を防ぎ、適切なクリーンアップを保証する
 */

import type { Unsubscribe } from 'firebase/firestore';

class ListenerManager {
  private listeners: Map<string, Unsubscribe> = new Map();
  private activeQueries: Set<string> = new Set();

  /**
   * リスナーを登録
   * @param key リスナーの一意のキー
   * @param unsubscribe クリーンアップ関数
   * @returns 既存のリスナーがあった場合はtrue、新規登録の場合はfalse
   */
  register(key: string, unsubscribe: Unsubscribe): boolean {
    // 既存のリスナーがある場合はまずクリーンアップ
    if (this.listeners.has(key)) {
      console.warn(`⚠️ Listener '${key}' already exists. Cleaning up old listener.`);
      this.unregister(key);
      return true;
    }

    this.listeners.set(key, unsubscribe);
    this.activeQueries.add(key);
    return false;
  }

  /**
   * リスナーを登録解除
   * @param key リスナーのキー
   */
  unregister(key: string): void {
    const unsubscribe = this.listeners.get(key);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        console.error(`Error unsubscribing listener '${key}':`, error);
      }
      this.listeners.delete(key);
      this.activeQueries.delete(key);
    }
  }

  /**
   * すべてのリスナーをクリーンアップ
   */
  unregisterAll(): void {
    console.log(`🧹 Cleaning up ${this.listeners.size} listeners`);
    for (const [key, unsubscribe] of this.listeners.entries()) {
      try {
        unsubscribe();
      } catch (error) {
        console.error(`Error unsubscribing listener '${key}':`, error);
      }
    }
    this.listeners.clear();
    this.activeQueries.clear();
  }

  /**
   * アクティブなリスナー数を取得
   */
  getActiveCount(): number {
    return this.listeners.size;
  }

  /**
   * 特定のキーのリスナーが存在するかチェック
   */
  has(key: string): boolean {
    return this.listeners.has(key);
  }

  /**
   * アクティブなクエリをチェック（重複防止用）
   */
  isQueryActive(key: string): boolean {
    return this.activeQueries.has(key);
  }

  /**
   * デバッグ情報を出力
   */
  debug(): void {
    console.log('🔍 Active listeners:', Array.from(this.listeners.keys()));
    console.log('📊 Total active listeners:', this.listeners.size);
  }
}

// シングルトンインスタンス
export const listenerManager = new ListenerManager();

// ページアンロード時にクリーンアップ
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    listenerManager.unregisterAll();
  });
}