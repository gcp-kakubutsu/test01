/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useUser, usePaymentUid } from '../../src/hooks/useUser';

// React Context のモック
const mockCurrentUser = {
  uid: 'test-user-123',
  email: 'test@example.com'
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser
  })
}));

// Firebase Firestoreのモック
const mockOnSnapshot = jest.fn();
const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  updateDoc: mockUpdateDoc
}));

jest.mock('@/lib/firebase/client', () => ({
  getFirebaseDb: jest.fn(() => 'mock-db')
}));

// User Serviceのモック
const mockAddPaymentUidToExistingUser = jest.fn();
const mockGetUserPaymentInfo = jest.fn();
const mockUpdatePaymentUidTimestamp = jest.fn();

jest.mock('@/services/userService', () => ({
  addPaymentUidToExistingUser: mockAddPaymentUidToExistingUser,
  getUserPaymentInfo: mockGetUserPaymentInfo,
  updatePaymentUidTimestamp: mockUpdatePaymentUidTimestamp
}));

describe('useUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ユーザーが認証されていない場合、初期状態を返す', () => {
    // AuthContextをモックして認証されていない状態にする
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({ currentUser: null })
    }));

    const { result } = renderHook(() => useUser());

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('ユーザーデータをリアルタイムで監視する', async () => {
    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com',
      username: 'testuser',
      payment_uid: 'PAYMENT123456789',
      payment_uid_created_at: { toDate: () => new Date() },
      payment_uid_updated_at: { toDate: () => new Date() }
    };

    // onSnapshotのコールバックを即座に実行するようにモック
    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {}; // unsubscribe function
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.user).toEqual({
        id: mockCurrentUser.uid,
        ...mockUserData
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  test('payment_uid情報を正しく抽出する', async () => {
    const mockPaymentUid = 'PAYMENT123456789';
    const mockCreatedAt = { toDate: () => new Date() };
    const mockUpdatedAt = { toDate: () => new Date() };
    
    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com',
      payment_uid: mockPaymentUid,
      payment_uid_created_at: mockCreatedAt,
      payment_uid_updated_at: mockUpdatedAt
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.paymentUidInfo).toEqual({
        payment_uid: mockPaymentUid,
        payment_uid_created_at: mockCreatedAt,
        payment_uid_updated_at: mockUpdatedAt
      });
    });
  });

  test('payment_uidを取得する', async () => {
    const mockPaymentUid = 'PAYMENT123456789';
    const mockUserData = {
      uid: 'test-user-123',
      payment_uid: mockPaymentUid
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.getPaymentUid()).toBe(mockPaymentUid);
      expect(result.current.hasPaymentUid()).toBe(true);
    });
  });

  test('payment_uidがない場合の処理', async () => {
    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com'
      // payment_uid がない
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.getPaymentUid()).toBeNull();
      expect(result.current.hasPaymentUid()).toBe(false);
      expect(result.current.paymentUidInfo).toBeNull();
    });
  });

  test('payment_uidを生成する', async () => {
    const mockGeneratedPaymentUid = 'GENERATED12345678';
    
    mockAddPaymentUidToExistingUser.mockResolvedValue({
      success: true,
      payment_uid: mockGeneratedPaymentUid
    });

    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });

    let generatedPaymentUid;
    await act(async () => {
      generatedPaymentUid = await result.current.generatePaymentUid();
    });

    expect(generatedPaymentUid).toBe(mockGeneratedPaymentUid);
    expect(mockAddPaymentUidToExistingUser).toHaveBeenCalledWith(mockCurrentUser.uid);
  });

  test('payment_uid生成でエラーが発生した場合', async () => {
    const errorMessage = 'Generation failed';
    
    mockAddPaymentUidToExistingUser.mockResolvedValue({
      success: false,
      error: errorMessage
    });

    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });

    await expect(
      act(async () => {
        await result.current.generatePaymentUid();
      })
    ).rejects.toThrow(errorMessage);

    expect(result.current.error).toContain(errorMessage);
  });

  test('payment_uid情報を詳細取得する', async () => {
    const mockPaymentInfo = {
      payment_uid: 'PAYMENT123456789',
      payment_uid_created_at: { toDate: () => new Date() },
      payment_uid_updated_at: { toDate: () => new Date() }
    };

    mockGetUserPaymentInfo.mockResolvedValue(mockPaymentInfo);

    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });

    let paymentInfo;
    await act(async () => {
      paymentInfo = await result.current.getPaymentUidInfo();
    });

    expect(paymentInfo).toEqual(mockPaymentInfo);
    expect(result.current.paymentUidInfo).toEqual(mockPaymentInfo);
  });

  test('payment_uidのタイムスタンプを更新する', async () => {
    mockUpdatePaymentUidTimestamp.mockResolvedValue({
      success: true
    });

    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com',
      payment_uid: 'EXISTING12345678'
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });

    await act(async () => {
      await result.current.updatePaymentUidTime();
    });

    expect(mockUpdatePaymentUidTimestamp).toHaveBeenCalledWith(mockCurrentUser.uid);
  });

  test('ユーザープロフィールを更新する', async () => {
    const updateData = {
      username: 'newusername',
      bio: 'Updated bio'
    };

    mockDoc.mockReturnValue('mock-doc-ref');
    mockUpdateDoc.mockResolvedValue();

    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });

    await act(async () => {
      await result.current.updateProfile(updateData);
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
      ...updateData,
      updatedAt: expect.any(Date)
    });
  });

  test('payment_uidを確保する（existing）', async () => {
    const existingPaymentUid = 'EXISTING12345678';
    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com',
      payment_uid: existingPaymentUid
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });

    let ensuredPaymentUid;
    await act(async () => {
      ensuredPaymentUid = await result.current.ensurePaymentUid();
    });

    expect(ensuredPaymentUid).toBe(existingPaymentUid);
    expect(mockAddPaymentUidToExistingUser).not.toHaveBeenCalled();
  });

  test('payment_uidを確保する（new generation）', async () => {
    const newPaymentUid = 'GENERATED12345678';
    
    mockAddPaymentUidToExistingUser.mockResolvedValue({
      success: true,
      payment_uid: newPaymentUid
    });

    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com'
      // payment_uid がない
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });

    let ensuredPaymentUid;
    await act(async () => {
      ensuredPaymentUid = await result.current.ensurePaymentUid();
    });

    expect(ensuredPaymentUid).toBe(newPaymentUid);
    expect(mockAddPaymentUidToExistingUser).toHaveBeenCalled();
  });
});

describe('usePaymentUid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('payment_uid関連の情報のみを返す', async () => {
    const mockPaymentUid = 'PAYMENT123456789';
    const mockPaymentUidInfo = {
      payment_uid: mockPaymentUid,
      payment_uid_created_at: { toDate: () => new Date() },
      payment_uid_updated_at: { toDate: () => new Date() }
    };

    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com',
      payment_uid: mockPaymentUid,
      payment_uid_created_at: mockPaymentUidInfo.payment_uid_created_at,
      payment_uid_updated_at: mockPaymentUidInfo.payment_uid_updated_at
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => usePaymentUid());

    await waitFor(() => {
      expect(result.current.paymentUid).toBe(mockPaymentUid);
      expect(result.current.hasPaymentUid).toBe(true);
      expect(result.current.paymentUidInfo).toEqual(mockPaymentUidInfo);
    });
  });

  test('payment_uidがない場合の処理', async () => {
    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com'
      // payment_uid がない
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => usePaymentUid());

    await waitFor(() => {
      expect(result.current.paymentUid).toBeNull();
      expect(result.current.hasPaymentUid).toBe(false);
      expect(result.current.paymentUidInfo).toBeNull();
    });
  });
});

describe('エラーハンドリング', () => {
  test('Firestoreエラーを適切にハンドリングする', async () => {
    const errorMessage = 'Firestore error';

    mockOnSnapshot.mockImplementation((ref, successCallback, errorCallback) => {
      const error = new Error(errorMessage);
      errorCallback(error);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.error).toContain(errorMessage);
      expect(result.current.loading).toBe(false);
    });
  });

  test('エラーをクリアする', async () => {
    const errorMessage = 'Test error';

    mockOnSnapshot.mockImplementation((ref, successCallback, errorCallback) => {
      const error = new Error(errorMessage);
      errorCallback(error);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.error).toContain(errorMessage);
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});

describe('ローディング状態', () => {
  test('初期ローディング状態', () => {
    mockOnSnapshot.mockImplementation(() => () => {});

    const { result } = renderHook(() => useUser());

    expect(result.current.loading).toBe(true);
  });

  test('データ読み込み完了後はローディング終了', async () => {
    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };

    mockOnSnapshot.mockImplementation((ref, callback) => {
      const docSnapshot = {
        exists: () => true,
        id: mockCurrentUser.uid,
        data: () => mockUserData
      };
      callback(docSnapshot);
      return () => {};
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});