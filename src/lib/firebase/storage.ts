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
  console.log('Starting image upload for user:', userId, 'file:', file.name, 'type:', imageType);
  
  if (!storage) {
    console.error('Firebase Storage is not initialized');
    console.error('Storage config:', {
      hasStorage: !!storage,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    throw new Error('Firebase Storage is not initialized');
  }
  
  console.log('Firebase Storage is initialized:', !!storage);

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
    const storagePath = `profiles/${userId}/${fileName}`;
    
    console.log('Creating storage reference for path:', storagePath);
    const storageRef = ref(storage, storagePath);
    console.log('Storage reference created:', storageRef);

    // ファイルをアップロード
    console.log('Starting file upload with metadata...');
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        userId,
        imageType,
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    });
    console.log('File upload completed:', snapshot);

    // アップロードされたファイルのURLを取得
    console.log('Getting download URL...');
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('Download URL obtained:', downloadURL);
    return downloadURL;
  } catch (error: any) {
    console.error('画像アップロードエラー:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    throw new Error(`画像のアップロードに失敗しました: ${error.message || error.code || 'Unknown error'}`);
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
/**
 * 管理者用プロフィール画像アップロード
 * @param targetUserId 対象ユーザーのID（画像の保存先）
 * @param file アップロードするファイル
 * @param imageType プロフィール画像のタイプ
 * @returns アップロードされた画像のURL
 */
export async function uploadProfileImageForAdmin(
  targetUserId: string,
  file: File,
  imageType: 'main' | 'sub1' | 'sub2' | 'sub3' = 'main'
): Promise<string> {
  console.log('Starting admin image upload for target user:', targetUserId, 'file:', file.name, 'type:', imageType);
  
  if (!storage) {
    console.error('Firebase Storage is not initialized');
    throw new Error('Firebase Storage is not initialized');
  }
  
  console.log('Firebase Storage is initialized:', !!storage);

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
    // 管理者用の共通フォルダを使用
    const timestamp = Date.now();
    const fileName = `${targetUserId}_${imageType}_${timestamp}_${file.name}`;
    const storagePath = `admin-uploads/${fileName}`;
    
    console.log('Creating admin storage reference for path:', storagePath);
    const storageRef = ref(storage, storagePath);
    console.log('Admin storage reference created:', storageRef);

    // ファイルをアップロード
    console.log('Starting admin file upload with metadata...');
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        targetUserId,
        imageType,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'admin'
      }
    });
    console.log('Admin file upload completed:', snapshot);

    // アップロードされたファイルのURLを取得
    console.log('Getting download URL...');
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('Download URL obtained:', downloadURL);
    return downloadURL;
  } catch (error: any) {
    console.error('管理者画像アップロードエラー:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    throw new Error(`画像のアップロードに失敗しました: ${error.message || error.code || 'Unknown error'}`);
  }
}

export async function uploadMultipleProfileImages(
  userId: string,
  files: { file: File; type: 'main' | 'sub1' | 'sub2' | 'sub3' }[]
): Promise<{ type: string; url: string }[]> {
  const uploadPromises = files.map(({ file, type }) =>
    uploadProfileImage(userId, file, type).then(url => ({ type, url }))
  );

  return Promise.all(uploadPromises);
}