/**
 * @jest-environment jsdom
 */

import {
  generatePaymentUid,
  checkPaymentUidUnique,
  generateUniquePaymentUid,
  validatePaymentUidFormat,
  generateUniquePaymentUidWithStats
} from '../../src/utils/paymentUidGenerator';

// Firebase Firestoreのモック
jest.mock('@/lib/firebase/client', () => ({
  getFirebaseDb: jest.fn(() => ({
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    getDocs: jest.fn()
  }))
}));

// Firestoreクエリの結果をモック
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockCollection = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  
  // Firebase Firestoreのモックを設定
  const { getFirebaseDb } = require('@/lib/firebase/client');
  getFirebaseDb.mockReturnValue({
    collection: mockCollection,
  });
  
  // Firestoreクエリのチェーンをモック
  mockCollection.mockReturnValue('collection');
  mockQuery.mockReturnValue('query');
  mockWhere.mockReturnValue('where');
  mockLimit.mockReturnValue('limit');
});

describe('generatePaymentUid', () => {
  test('16桁の文字列を生成する', () => {
    const paymentUid = generatePaymentUid();
    expect(paymentUid).toHaveLength(16);
  });

  test('英数字のみで構成される', () => {
    const paymentUid = generatePaymentUid();
    expect(paymentUid).toMatch(/^[A-Za-z0-9]+$/);
  });

  test('複数回実行してもユニークな値を生成する', () => {
    const paymentUids = new Set();
    for (let i = 0; i < 100; i++) {
      const paymentUid = generatePaymentUid();
      expect(paymentUids.has(paymentUid)).toBe(false);
      paymentUids.add(paymentUid);
    }
    expect(paymentUids.size).toBe(100);
  });

  test('正確に16桁であることを検証する', () => {
    for (let i = 0; i < 10; i++) {
      const paymentUid = generatePaymentUid();
      expect(paymentUid.length).toBe(16);
    }
  });

  test('有効な文字セットのみを使用する', () => {
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const paymentUid = generatePaymentUid();
    
    for (const char of paymentUid) {
      expect(validChars.includes(char)).toBe(true);
    }
  });
});

describe('validatePaymentUidFormat', () => {
  test('正しいフォーマットの場合trueを返す', () => {
    const validPaymentUid = 'A1B2C3D4E5F6G7H8';
    expect(validatePaymentUidFormat(validPaymentUid)).toBe(true);
  });

  test('16桁でない場合falseを返す', () => {
    expect(validatePaymentUidFormat('SHORT')).toBe(false);
    expect(validatePaymentUidFormat('TOOLONGPAYMENTUID123')).toBe(false);
    expect(validatePaymentUidFormat('')).toBe(false);
  });

  test('無効な文字が含まれる場合falseを返す', () => {
    expect(validatePaymentUidFormat('A1B2C3D4E5F6G7H!')).toBe(false);
    expect(validatePaymentUidFormat('A1B2C3D4E5F6G7H@')).toBe(false);
    expect(validatePaymentUidFormat('A1B2C3D4E5F6G7H-')).toBe(false);
  });

  test('nullやundefinedの場合falseを返す', () => {
    expect(validatePaymentUidFormat(null)).toBe(false);
    expect(validatePaymentUidFormat(undefined)).toBe(false);
  });
});

describe('checkPaymentUidUnique', () => {
  beforeEach(() => {
    // Firestoreクエリのモックをリセット
    jest.clearAllMocks();
  });

  test('ユニークなpayment_uidの場合trueを返す', async () => {
    // 空のクエリ結果をモック（ユニーク）
    mockGetDocs.mockResolvedValue({ empty: true });
    
    // Firestoreクエリのチェーンをモック
    const query = require('firebase/firestore').query;
    const collection = require('firebase/firestore').collection;
    const where = require('firebase/firestore').where;
    const limit = require('firebase/firestore').limit;
    const getDocs = require('firebase/firestore').getDocs;
    
    jest.doMock('firebase/firestore', () => ({
      query: jest.fn(() => 'mocked-query'),
      collection: jest.fn(() => 'mocked-collection'),
      where: jest.fn(() => 'mocked-where'),
      limit: jest.fn(() => 'mocked-limit'),
      getDocs: mockGetDocs
    }));

    const paymentUid = 'A1B2C3D4E5F6G7H8';
    const isUnique = await checkPaymentUidUnique(paymentUid);
    expect(isUnique).toBe(true);
  });

  test('重複するpayment_uidの場合falseを返す', async () => {
    // 重複するクエリ結果をモック
    mockGetDocs.mockResolvedValue({ empty: false });
    
    jest.doMock('firebase/firestore', () => ({
      query: jest.fn(() => 'mocked-query'),
      collection: jest.fn(() => 'mocked-collection'),
      where: jest.fn(() => 'mocked-where'),
      limit: jest.fn(() => 'mocked-limit'),
      getDocs: mockGetDocs
    }));

    const paymentUid = 'DUPLICATE12345678';
    const isUnique = await checkPaymentUidUnique(paymentUid);
    expect(isUnique).toBe(false);
  });

  test('無効なpayment_uidフォーマットの場合エラーを投げる', async () => {
    const invalidPaymentUid = 'INVALID';
    await expect(checkPaymentUidUnique(invalidPaymentUid)).rejects.toThrow();
  });

  test('Firestoreが利用できない場合エラーを投げる', async () => {
    const { getFirebaseDb } = require('@/lib/firebase/client');
    getFirebaseDb.mockReturnValue(null);

    const paymentUid = 'A1B2C3D4E5F6G7H8';
    await expect(checkPaymentUidUnique(paymentUid)).rejects.toThrow('Firestore is not initialized');
  });
});

describe('generateUniquePaymentUid', () => {
  test('ユニークなpayment_uidを生成する', async () => {
    // 最初の試行でユニークなIDが生成されることをモック
    mockGetDocs.mockResolvedValue({ empty: true });
    
    jest.doMock('firebase/firestore', () => ({
      query: jest.fn(() => 'mocked-query'),
      collection: jest.fn(() => 'mocked-collection'),
      where: jest.fn(() => 'mocked-where'),
      limit: jest.fn(() => 'mocked-limit'),
      getDocs: mockGetDocs
    }));

    const paymentUid = await generateUniquePaymentUid();
    expect(paymentUid).toBeDefined();
    expect(paymentUid).toHaveLength(16);
    expect(validatePaymentUidFormat(paymentUid)).toBe(true);
  });

  test('リトライ後にユニークなpayment_uidを生成する', async () => {
    // 最初は重複、2回目でユニーク
    mockGetDocs
      .mockResolvedValueOnce({ empty: false }) // 1回目: 重複
      .mockResolvedValueOnce({ empty: true });  // 2回目: ユニーク
    
    jest.doMock('firebase/firestore', () => ({
      query: jest.fn(() => 'mocked-query'),
      collection: jest.fn(() => 'mocked-collection'),
      where: jest.fn(() => 'mocked-where'),
      limit: jest.fn(() => 'mocked-limit'),
      getDocs: mockGetDocs
    }));

    const paymentUid = await generateUniquePaymentUid();
    expect(paymentUid).toBeDefined();
    expect(paymentUid).toHaveLength(16);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  test('最大リトライ回数に達した場合エラーを投げる', async () => {
    // 常に重複を返すようモック
    mockGetDocs.mockResolvedValue({ empty: false });
    
    jest.doMock('firebase/firestore', () => ({
      query: jest.fn(() => 'mocked-query'),
      collection: jest.fn(() => 'mocked-collection'),
      where: jest.fn(() => 'mocked-where'),
      limit: jest.fn(() => 'mocked-limit'),
      getDocs: mockGetDocs
    }));

    const maxRetries = 3;
    await expect(generateUniquePaymentUid(maxRetries)).rejects.toThrow(
      `Failed to generate unique payment_uid after ${maxRetries} attempts`
    );
    expect(mockGetDocs).toHaveBeenCalledTimes(maxRetries);
  });
});

describe('generateUniquePaymentUidWithStats', () => {
  test('統計情報付きで成功する', async () => {
    mockGetDocs.mockResolvedValue({ empty: true });
    
    jest.doMock('firebase/firestore', () => ({
      query: jest.fn(() => 'mocked-query'),
      collection: jest.fn(() => 'mocked-collection'),
      where: jest.fn(() => 'mocked-where'),
      limit: jest.fn(() => 'mocked-limit'),
      getDocs: mockGetDocs
    }));

    const stats = await generateUniquePaymentUidWithStats();
    
    expect(stats.successfulGeneration).toBe(true);
    expect(stats.finalPaymentUid).toBeDefined();
    expect(stats.errors).toHaveLength(0);
    expect(stats.duration).toBeGreaterThan(0);
    expect(validatePaymentUidFormat(stats.finalPaymentUid)).toBe(true);
  });

  test('失敗時に統計情報を返す', async () => {
    mockGetDocs.mockResolvedValue({ empty: false }); // 常に重複
    
    jest.doMock('firebase/firestore', () => ({
      query: jest.fn(() => 'mocked-query'),
      collection: jest.fn(() => 'mocked-collection'),
      where: jest.fn(() => 'mocked-where'),
      limit: jest.fn(() => 'mocked-limit'),
      getDocs: mockGetDocs
    }));

    const maxRetries = 2;
    const stats = await generateUniquePaymentUidWithStats(maxRetries);
    
    expect(stats.successfulGeneration).toBe(false);
    expect(stats.finalPaymentUid).toBeUndefined();
    expect(stats.errors.length).toBeGreaterThan(0);
    expect(stats.duration).toBeGreaterThan(0);
  });
});

describe('エッジケースとエラーハンドリング', () => {
  test('空文字列のpayment_uidは無効', () => {
    expect(validatePaymentUidFormat('')).toBe(false);
  });

  test('特殊文字を含むpayment_uidは無効', () => {
    const invalidChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '='];
    invalidChars.forEach(char => {
      const invalidUid = `A1B2C3D4E5F6G7H${char}`;
      expect(validatePaymentUidFormat(invalidUid)).toBe(false);
    });
  });

  test('数値型のpayment_uidは無効', () => {
    expect(validatePaymentUidFormat(1234567890123456)).toBe(false);
  });

  test('オブジェクト型のpayment_uidは無効', () => {
    expect(validatePaymentUidFormat({})).toBe(false);
    expect(validatePaymentUidFormat([])).toBe(false);
  });
});

describe('パフォーマンステスト', () => {
  test('大量のpayment_uid生成のパフォーマンス', () => {
    const startTime = Date.now();
    const count = 1000;
    
    for (let i = 0; i < count; i++) {
      const paymentUid = generatePaymentUid();
      expect(paymentUid).toHaveLength(16);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 1000個の生成が2秒以内に完了することを確認
    expect(duration).toBeLessThan(2000);
  });

  test('payment_uidの分布が偏っていない', () => {
    const charFrequency = {};
    const sampleCount = 100;
    
    for (let i = 0; i < sampleCount; i++) {
      const paymentUid = generatePaymentUid();
      for (const char of paymentUid) {
        charFrequency[char] = (charFrequency[char] || 0) + 1;
      }
    }
    
    // 文字の出現頻度が極端に偏っていないことを確認
    const frequencies = Object.values(charFrequency);
    const minFreq = Math.min(...frequencies);
    const maxFreq = Math.max(...frequencies);
    
    // 最大頻度が最小頻度の10倍を超えないことを確認（統計的な偏りの検査）
    expect(maxFreq / minFreq).toBeLessThan(10);
  });
});