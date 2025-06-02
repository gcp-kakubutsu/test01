import { storage } from './client';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * プロフィール画像をFirebase Storageにアップロード
 * @param userId ユーザーID
 * @param file アップロードするファイル
 * @param imageType プロフィール画像のタイプ (main, sub1, sub2, sub3)
 * @returns アップロードされた画像のURL
 */
export async function uploadProfileImage(
  userId: string,
  file: File,
  imageType: 'main' | 'sub1' | 'sub2' | 'sub3' = 'main'
): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized');
  }

  // ファイルサイズ制限（5MB）
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('ファイルサイズは5MB以下にしてください');
  }

  // 許可されるファイルタイプ
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('JPEG, PNG, GIF, WebP形式の画像のみアップロード可能です');
  }

  try {
    // ファイル名を生成（タイムスタンプを含めて一意にする）
    const timestamp = Date.now();
    const fileName = `${userId}_${imageType}_${timestamp}_${file.name}`;
    const storageRef = ref(storage, `profiles/${userId}/${fileName}`);

    // ファイルをアップロード
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        userId,
        imageType,
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    });

    // アップロードされたファイルのURLを取得
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('画像アップロードエラー:', error);
    throw new Error('画像のアップロードに失敗しました');
  }
}

/**
 * プロフィール画像を削除
 * @param imageUrl 削除する画像のURL
 */
export async function deleteProfileImage(imageUrl: string): Promise<void> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized');
  }

  try {
    // URLからStorageリファレンスを作成
    const storageRef = ref(storage, imageUrl);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('画像削除エラー:', error);
    // 画像が存在しない場合のエラーは無視
    if ((error as any).code !== 'storage/object-not-found') {
      throw new Error('画像の削除に失敗しました');
    }
  }
}

/**
 * 複数のプロフィール画像を一括アップロード
 * @param userId ユーザーID
 * @param files アップロードするファイルの配列
 * @returns アップロードされた画像のURL配列
 */
export async function uploadMultipleProfileImages(
  userId: string,
  files: { file: File; type: 'main' | 'sub1' | 'sub2' | 'sub3' }[]
): Promise<{ type: string; url: string }[]> {
  const uploadPromises = files.map(({ file, type }) =>
    uploadProfileImage(userId, file, type).then(url => ({ type, url }))
  );

  return Promise.all(uploadPromises);
}