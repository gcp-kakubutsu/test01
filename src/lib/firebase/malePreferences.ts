"use client";

import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, getFirebaseAuth } from './client';
import { getAuth } from 'firebase/auth';

// 男性ユーザーの詳細設定データ構造
export interface MalePreferences {
  // セクシュアル嗜好（1-5スケール）
  groupPlay: number; // 複数人プレイ
  throating: number; // ゴックン
  analPlay: number; // アナルプレイ
  cosplay: number; // コスプレプレイ
  toyPlay: number; // おもちゃを使う
  deepthroat: number; // イラマチオ

  // 相手の体型
  partnerBodyTypes: string[]; // ["スリム", "やや細め", "細め", "グラマー", "筋肉質", "やややっちゃり", "ぽっちゃり", "こだわらない"]
  
  // 女の子タイプ (MySQLのDBから取得したIDを保存)
  girlTypeIds?: number[]; // MySQLのgirl_typesテーブルのID

  // 基本情報
  recordingDuringPlay: string; // プレイ時の撮影
  isSadist: string; // あなたはSですか？
  isMasochist: string; // あなたはMですか？

  // 相手に求める条件
  partnerHeight: string; // 身長
  partnerWeight: string; // 体重
  partnerLocation: string; // 居住地

  // 活動条件
  partnerAgeMin: number; // 相手の年齢（最小）
  partnerAgeMax: number; // 相手の年齢（最大）

  // 活動タイミング

  // システム情報
  completedAt?: any; // 完了日時
  lastUpdated?: any; // 最終更新日時
  isComplete: boolean; // 全て完了しているか
}

// デフォルト値
export const defaultMalePreferences: Partial<MalePreferences> = {
  groupPlay: 3,
  throating: 3,
  analPlay: 3,
  cosplay: 3,
  toyPlay: 3,
  deepthroat: 3,
  partnerBodyTypes: [],
  recordingDuringPlay: '',
  isSadist: '',
  isMasochist: '',
  partnerHeight: '',
  partnerWeight: '',
  partnerLocation: '',
  partnerAgeMin: 18,
  partnerAgeMax: 30,
  isComplete: false
};

// 男性ユーザーの詳細設定を取得
export async function getMalePreferences(userId: string): Promise<MalePreferences | null> {
  if (!db) {
    console.warn('getMalePreferences: Firestore is not initialized');
    return null;
  }
  
  // userIdが空または無効な場合はnullを返す
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.warn('getMalePreferences: Invalid userId provided:', userId);
    return null;
  }

  // Firebase Authの現在のユーザーを確認
  const auth = getFirebaseAuth();
  if (auth?.currentUser) {
    // IDトークンを強制的にリフレッシュ
    try {
      await auth.currentUser.getIdToken(true);
      console.log('🔄 ID token refreshed for Firestore access');
    } catch (tokenError) {
      console.warn('⚠️ Failed to refresh ID token:', tokenError);
    }
  }

  try {
    const preferencesRef = doc(db, 'malePreferences', userId);
    const preferencesDoc = await getDoc(preferencesRef);
    
    if (preferencesDoc.exists()) {
      return preferencesDoc.data() as MalePreferences;
    }
    return null;
  } catch (error: any) {
    // 権限エラーの場合は警告ログのみ出力してnullを返す
    if (error?.code === 'permission-denied' || 
        error?.message?.includes('Missing or insufficient permissions')) {
      console.warn('getMalePreferences: Permission denied for user:', userId);
      return null;
    }
    
    console.error('Error fetching male preferences:', error);
    // その他のエラーの場合もnullを返す（エラーをthrowしない）
    return null;
  }
}

// 男性ユーザーの詳細設定を保存
export async function saveMalePreferences(userId: string, preferences: Partial<MalePreferences>): Promise<void> {
  console.log('=== saveMalePreferences START ===');
  console.log('userId:', userId);
  console.log('preferences:', JSON.stringify(preferences, null, 2));
  
  if (!db) {
    console.error('Firestore is not initialized');
    throw new Error('Firestore is not initialized');
  }
  
  // userIdが空または無効な場合はエラー
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.error('saveMalePreferences: Invalid userId provided:', userId);
    throw new Error('Invalid userId for saving preferences');
  }

  try {
    console.log('Starting to save male preferences for user:', userId);
    console.log('Preferences data:', preferences);
    
    const preferencesRef = doc(db, 'malePreferences', userId);
    const updateData = {
      ...preferences,
      lastUpdated: serverTimestamp(),
      ...(preferences.isComplete && { completedAt: serverTimestamp() })
    };
    
    console.log('Saving to Firestore with data:', updateData);
    console.log('Document path: malePreferences/' + userId);
    
    await setDoc(preferencesRef, updateData, { merge: true });
    
    console.log('✅ Successfully saved to malePreferences collection');
    console.log('Document saved at:', preferencesRef.path);

    // ユーザープロフィールにも基本情報を保存
    if (preferences.isComplete) {
      console.log('Updating user profile with preferences');
      await updateUserProfileWithPreferences(userId, preferences);
      console.log('Successfully updated user profile');
    }
    
    console.log('=== saveMalePreferences COMPLETED SUCCESSFULLY ===');
  } catch (error: any) {
    console.error('❌ Error saving male preferences:', error);
    console.error('Error code:', error?.code);
    console.error('Error message:', error?.message);
    console.error('Error details:', {
      userId,
      preferencesKeys: Object.keys(preferences),
      isComplete: preferences.isComplete
    });
    throw error;
  }
}

// ユーザープロフィールに設定情報を反映
async function updateUserProfileWithPreferences(userId: string, preferences: Partial<MalePreferences>): Promise<void> {
  if (!db) return;
  
  // userIdが空または無効な場合は処理をスキップ
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.warn('updateUserProfileWithPreferences: Invalid userId provided:', userId);
    return;
  }

  try {
    const userRef = doc(db, 'users', userId);
    const profileUpdateData: any = {
      lastPreferencesUpdate: serverTimestamp(),
      hasCompletedPreferences: true
    };

    // 重要な設定項目をユーザープロフィールにも保存
    if (preferences.partnerAgeMin && preferences.partnerAgeMax) {
      profileUpdateData.partnerAgeRange = {
        min: preferences.partnerAgeMin,
        max: preferences.partnerAgeMax
      };
    }

    await updateDoc(userRef, profileUpdateData);
  } catch (error) {
    console.error('Error updating user profile with preferences:', error);
    // プロフィール更新が失敗しても設定保存は成功扱いにする
  }
}

// 設定が完了しているかチェック
export function isMalePreferencesComplete(preferences: MalePreferences | null): boolean {
  if (!preferences) {
    return false;
  }
  
  // isCompleteフラグが既にtrueの場合は、常にtrueを返す（既存完了済みユーザー対応）
  if (preferences.isComplete === true) {
    return true;
  }
  
  const requiredFields = [
    'recordingDuringPlay', 
    'isSadist',
    'isMasochist',
    'partnerHeight',
    'partnerWeight',
    'partnerLocation'
  ];
  
  // 必須フィールドがすべて入力されているかチェック
  const hasAllRequiredFields = requiredFields.every(field => {
    const value = preferences[field as keyof MalePreferences];
    const isValid = value !== '' && value !== null && value !== undefined;
    if (!isValid) {
      console.log(`Preferences check: Missing field ${field}:`, value);
    }
    return isValid;
  });
  
  // 年齢範囲がセットされているかチェック
  const hasAgeRange = preferences.partnerAgeMin > 0 && preferences.partnerAgeMax > 0 && preferences.partnerAgeMin <= preferences.partnerAgeMax;
  if (!hasAgeRange) {
    console.log('Preferences check: Invalid age range:', {
      min: preferences.partnerAgeMin,
      max: preferences.partnerAgeMax
    });
  }
  
  // 体型が選択されているかチェック
  const hasBodyTypes = preferences.partnerBodyTypes && preferences.partnerBodyTypes.length > 0;
  if (!hasBodyTypes) {
    console.log('Preferences check: No body types selected:', preferences.partnerBodyTypes);
  }
  
  
  // isCompleteフラグもチェック
  const isMarkedComplete = Boolean(preferences.isComplete);
  if (!isMarkedComplete) {
    console.log('Preferences check: isComplete flag is false:', preferences.isComplete);
  }
  
  const result = hasAllRequiredFields && hasAgeRange && hasBodyTypes && isMarkedComplete;
  
  console.log('Full preferences completion check result:', {
    hasAllRequiredFields,
    hasAgeRange,
    hasBodyTypes,
    isMarkedComplete,
    finalResult: result
  });
  
  return result;
}