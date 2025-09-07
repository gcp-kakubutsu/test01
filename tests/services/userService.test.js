/**
 * @jest-environment jsdom
 */

import {
  createUserWithPaymentUid,
  addPaymentUidToExistingUser,
  getUserByPaymentUid,
  addPaymentUidToAllUsers,
  updatePaymentUidTimestamp,
  getUserPaymentInfo
} from '../../src/services/userService';

// Firebase Firestoreのモック
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockWriteBatch = jest.fn();
const mockBatch = {
  update: jest.fn(),
  commit: jest.fn()
};
const mockServerTimestamp = jest.fn(() => 'mock-timestamp');

jest.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  query: mockQuery,
  where: mockWhere,
  limit: mockLimit,
  writeBatch: mockWriteBatch,
  serverTimestamp: mockServerTimestamp,
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() }))
  }
}));

jest.mock('@/lib/firebase/client', () => ({
  getFirebaseDb: jest.fn()
}));

jest.mock('@/utils/paymentUidGenerator', () => ({
  generateUniquePaymentUid: jest.fn()
}));

describe('userService', () => {
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Firebase Dbのモック
    mockDb = {
      doc: mockDoc,
      collection: mockCollection
    };
    
    const { getFirebaseDb } = require('@/lib/firebase/client');
    getFirebaseDb.mockReturnValue(mockDb);
    
    // Batchオペレーションのモック
    mockWriteBatch.mockReturnValue(mockBatch);
    mockBatch.update.mockClear();
    mockBatch.commit.mockResolvedValue();
  });

  describe('createUserWithPaymentUid', () => {
    test('新規ユーザーを作成し、payment_uidを付与する', async () => {
      const userId = 'test-user-123';
      const userData = {
        email: 'test@example.com',
        username: 'testuser'
      };
      const mockPaymentUid = 'A1B2C3D4E5F6G7H8';

      const { generateUniquePaymentUid } = require('@/utils/paymentUidGenerator');
      generateUniquePaymentUid.mockResolvedValue(mockPaymentUid);
      
      mockDoc.mockReturnValue('mock-doc-ref');
      mockSetDoc.mockResolvedValue();

      const result = await createUserWithPaymentUid(userId, userData);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(userId);
      expect(result.payment_uid).toBe(mockPaymentUid);
      expect(generateUniquePaymentUid).toHaveBeenCalled();
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', {
        ...userData,
        payment_uid: mockPaymentUid,
        payment_uid_created_at: 'mock-timestamp',
        payment_uid_updated_at: 'mock-timestamp'
      });
    });

    test('payment_uid生成に失敗した場合、エラーを返す', async () => {
      const userId = 'test-user-123';
      const userData = { email: 'test@example.com' };

      const { generateUniquePaymentUid } = require('@/utils/paymentUidGenerator');
      generateUniquePaymentUid.mockRejectedValue(new Error('Generation failed'));

      const result = await createUserWithPaymentUid(userId, userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Generation failed');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    test('Firestoreが利用できない場合、エラーを返す', async () => {
      const { getFirebaseDb } = require('@/lib/firebase/client');
      getFirebaseDb.mockReturnValue(null);

      const userId = 'test-user-123';
      const userData = { email: 'test@example.com' };

      const result = await createUserWithPaymentUid(userId, userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Firestore is not initialized');
    });
  });

  describe('addPaymentUidToExistingUser', () => {
    test('既存ユーザーにpayment_uidを追加する', async () => {
      const userId = 'existing-user-123';
      const mockPaymentUid = 'B2C3D4E5F6G7H8I9';
      
      // ユーザーが存在し、payment_uidがない
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          email: 'existing@example.com',
          username: 'existinguser'
          // payment_uid がない
        })
      };

      const { generateUniquePaymentUid } = require('@/utils/paymentUidGenerator');
      generateUniquePaymentUid.mockResolvedValue(mockPaymentUid);

      mockDoc.mockReturnValue('mock-doc-ref');
      mockGetDoc.mockResolvedValue(mockUserDoc);
      mockUpdateDoc.mockResolvedValue();

      const result = await addPaymentUidToExistingUser(userId);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(userId);
      expect(result.payment_uid).toBe(mockPaymentUid);
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        payment_uid: mockPaymentUid,
        payment_uid_created_at: 'mock-timestamp',
        payment_uid_updated_at: 'mock-timestamp'
      });
    });

    test('既にpayment_uidがある場合、既存のものを返す', async () => {
      const userId = 'existing-user-123';
      const existingPaymentUid = 'EXISTING12345678';
      
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          email: 'existing@example.com',
          payment_uid: existingPaymentUid
        })
      };

      mockDoc.mockReturnValue('mock-doc-ref');
      mockGetDoc.mockResolvedValue(mockUserDoc);

      const result = await addPaymentUidToExistingUser(userId);

      expect(result.success).toBe(true);
      expect(result.payment_uid).toBe(existingPaymentUid);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    test('ユーザーが存在しない場合、エラーを返す', async () => {
      const userId = 'nonexistent-user';
      
      const mockUserDoc = {
        exists: () => false
      };

      mockDoc.mockReturnValue('mock-doc-ref');
      mockGetDoc.mockResolvedValue(mockUserDoc);

      const result = await addPaymentUidToExistingUser(userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  describe('getUserByPaymentUid', () => {
    test('payment_uidでユーザーを検索する', async () => {
      const paymentUid = 'C3D4E5F6G7H8I9J0';
      const userId = 'found-user-123';
      
      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            id: userId,
            data: () => ({
              email: 'found@example.com',
              payment_uid: paymentUid,
              payment_uid_created_at: 'mock-created-at',
              payment_uid_updated_at: 'mock-updated-at'
            })
          }
        ]
      };

      mockCollection.mockReturnValue('mock-collection');
      mockQuery.mockReturnValue('mock-query');
      mockWhere.mockReturnValue('mock-where');
      mockLimit.mockReturnValue('mock-limit');
      mockGetDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await getUserByPaymentUid(paymentUid);

      expect(result).not.toBeNull();
      expect(result.id).toBe(userId);
      expect(result.payment_uid).toBe(paymentUid);
      expect(mockGetDocs).toHaveBeenCalled();
    });

    test('payment_uidが見つからない場合、nullを返す', async () => {
      const paymentUid = 'NOTFOUND12345678';
      
      const mockQuerySnapshot = {
        empty: true,
        docs: []
      };

      mockCollection.mockReturnValue('mock-collection');
      mockQuery.mockReturnValue('mock-query');
      mockWhere.mockReturnValue('mock-where');
      mockLimit.mockReturnValue('mock-limit');
      mockGetDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await getUserByPaymentUid(paymentUid);

      expect(result).toBeNull();
    });

    test('無効なpayment_uidフォーマットの場合、エラーを投げる', async () => {
      const invalidPaymentUid = 'INVALID';

      await expect(getUserByPaymentUid(invalidPaymentUid)).rejects.toThrow();
    });
  });

  describe('addPaymentUidToAllUsers', () => {
    test('payment_uidがないユーザーに一括付与する', async () => {
      const batchSize = 2;
      
      // payment_uidがないユーザーを2人作成
      const usersWithoutPaymentUid = [
        {
          id: 'user1',
          ref: 'mock-ref-1',
          data: () => ({ email: 'user1@example.com' })
        },
        {
          id: 'user2', 
          ref: 'mock-ref-2',
          data: () => ({ email: 'user2@example.com' })
        }
      ];

      const mockAllUsersSnapshot = {
        docs: [
          ...usersWithoutPaymentUid,
          // payment_uidがあるユーザー（除外される）
          {
            id: 'user3',
            ref: 'mock-ref-3',
            data: () => ({ email: 'user3@example.com', payment_uid: 'EXISTING12345678' })
          }
        ]
      };

      const { generateUniquePaymentUid } = require('@/utils/paymentUidGenerator');
      generateUniquePaymentUid
        .mockResolvedValueOnce('GENERATED1234567')
        .mockResolvedValueOnce('GENERATED2345678');

      mockCollection.mockReturnValue('mock-collection');
      mockQuery.mockReturnValue('mock-query');
      mockGetDocs.mockResolvedValue(mockAllUsersSnapshot);
      mockWriteBatch.mockReturnValue(mockBatch);

      const result = await addPaymentUidToAllUsers(batchSize);

      expect(result.totalUsers).toBe(2); // payment_uidがないユーザーの数
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    test('すべてのユーザーが既にpayment_uidを持つ場合', async () => {
      const mockAllUsersSnapshot = {
        docs: [
          {
            id: 'user1',
            data: () => ({ email: 'user1@example.com', payment_uid: 'EXISTING1234567' })
          }
        ]
      };

      mockCollection.mockReturnValue('mock-collection');
      mockQuery.mockReturnValue('mock-query');
      mockGetDocs.mockResolvedValue(mockAllUsersSnapshot);

      const result = await addPaymentUidToAllUsers();

      expect(result.totalUsers).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(mockBatch.update).not.toHaveBeenCalled();
    });
  });

  describe('updatePaymentUidTimestamp', () => {
    test('payment_uidのタイムスタンプを更新する', async () => {
      const userId = 'test-user-123';
      const existingPaymentUid = 'EXISTING12345678';
      
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          email: 'test@example.com',
          payment_uid: existingPaymentUid
        })
      };

      mockDoc.mockReturnValue('mock-doc-ref');
      mockGetDoc.mockResolvedValue(mockUserDoc);
      mockUpdateDoc.mockResolvedValue();

      const result = await updatePaymentUidTimestamp(userId);

      expect(result.success).toBe(true);
      expect(result.payment_uid).toBe(existingPaymentUid);
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        payment_uid_updated_at: 'mock-timestamp'
      });
    });

    test('payment_uidがないユーザーの場合、エラーを返す', async () => {
      const userId = 'test-user-123';
      
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          email: 'test@example.com'
          // payment_uid がない
        })
      };

      mockDoc.mockReturnValue('mock-doc-ref');
      mockGetDoc.mockResolvedValue(mockUserDoc);

      const result = await updatePaymentUidTimestamp(userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not have payment_uid');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('getUserPaymentInfo', () => {
    test('ユーザーのpayment_uid情報を取得する', async () => {
      const userId = 'test-user-123';
      const paymentUid = 'PAYMENT123456789';
      
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          payment_uid: paymentUid,
          payment_uid_created_at: 'mock-created-at',
          payment_uid_updated_at: 'mock-updated-at'
        })
      };

      mockDoc.mockReturnValue('mock-doc-ref');
      mockGetDoc.mockResolvedValue(mockUserDoc);

      const result = await getUserPaymentInfo(userId);

      expect(result).not.toBeNull();
      expect(result.payment_uid).toBe(paymentUid);
      expect(result.payment_uid_created_at).toBe('mock-created-at');
      expect(result.payment_uid_updated_at).toBe('mock-updated-at');
    });

    test('payment_uidがない場合、nullを返す', async () => {
      const userId = 'test-user-123';
      
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          email: 'test@example.com'
          // payment_uid がない
        })
      };

      mockDoc.mockReturnValue('mock-doc-ref');
      mockGetDoc.mockResolvedValue(mockUserDoc);

      const result = await getUserPaymentInfo(userId);

      expect(result).toBeNull();
    });

    test('ユーザーが存在しない場合、nullを返す', async () => {
      const userId = 'nonexistent-user';
      
      const mockUserDoc = {
        exists: () => false
      };

      mockDoc.mockReturnValue('mock-doc-ref');
      mockGetDoc.mockResolvedValue(mockUserDoc);

      const result = await getUserPaymentInfo(userId);

      expect(result).toBeNull();
    });
  });

  describe('エラーハンドリング', () => {
    test('Firestore操作でエラーが発生した場合、適切にハンドリングする', async () => {
      const userId = 'test-user-123';
      const userData = { email: 'test@example.com' };

      const { generateUniquePaymentUid } = require('@/utils/paymentUidGenerator');
      generateUniquePaymentUid.mockResolvedValue('VALID12345678901');
      
      mockDoc.mockReturnValue('mock-doc-ref');
      mockSetDoc.mockRejectedValue(new Error('Firestore write failed'));

      const result = await createUserWithPaymentUid(userId, userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Firestore write failed');
    });

    test('バッチ操作でエラーが発生した場合、適切にハンドリングする', async () => {
      const usersWithoutPaymentUid = [
        {
          id: 'user1',
          ref: 'mock-ref-1',
          data: () => ({ email: 'user1@example.com' })
        }
      ];

      const mockAllUsersSnapshot = {
        docs: usersWithoutPaymentUid
      };

      const { generateUniquePaymentUid } = require('@/utils/paymentUidGenerator');
      generateUniquePaymentUid.mockResolvedValue('GENERATED1234567');

      mockCollection.mockReturnValue('mock-collection');
      mockQuery.mockReturnValue('mock-query');
      mockGetDocs.mockResolvedValue(mockAllUsersSnapshot);
      mockWriteBatch.mockReturnValue(mockBatch);
      mockBatch.commit.mockRejectedValue(new Error('Batch commit failed'));

      const result = await addPaymentUidToAllUsers();

      expect(result.failureCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Batch commit failed');
    });
  });
});