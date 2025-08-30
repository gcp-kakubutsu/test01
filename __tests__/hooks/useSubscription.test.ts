/**
 * Unit Tests for useSubscription Hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useSubscription } from '@/hooks/useSubscription';
import { AuthContext } from '@/contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { SUBSCRIPTION_CONSTANTS } from '@/types/subscription';

// Mock Firebase
jest.mock('@/lib/firebase/client', () => ({
  getFirebaseDb: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
  })),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
    fromDate: (date: Date) => ({ toDate: () => date }),
  },
}));

// Mock auth context
const mockAuthContextValue = {
  currentUser: {
    uid: 'test-user-id',
    email: 'test@example.com',
  },
  isAuthenticated: true,
  isLoading: false,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthContext.Provider value={mockAuthContextValue}>
    {children}
  </AuthContext.Provider>
);

describe('useSubscription Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });
      
      expect(result.current.loading).toBe(true);
      expect(result.current.subscription).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should not load data when user is not authenticated', () => {
      const unauthenticatedWrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthContext.Provider value={{ ...mockAuthContextValue, currentUser: null, isAuthenticated: false }}>
          {children}
        </AuthContext.Provider>
      );

      const { result } = renderHook(() => useSubscription(), { wrapper: unauthenticatedWrapper });
      
      expect(result.current.loading).toBe(false);
      expect(result.current.subscription).toBe(null);
    });
  });

  describe('Subscription Data Processing', () => {
    it('should process free plan subscription correctly', async () => {
      const mockFirestoreData = {
        subscriptionBasic: {
          planType: SUBSCRIPTION_CONSTANTS.PLAN_TYPES.FREE,
          status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.NONE,
          startDate: Timestamp.now(),
          endDate: null,
          autoRenew: false,
          trialEndDate: null,
        },
        isPremium: false,
        hasActiveSubscription: false,
        canAccessPremiumFeatures: false,
      };

      // Mock Firestore listener
      const mockOnSnapshot = jest.fn((docRef, callback) => {
        callback({
          exists: () => true,
          data: () => mockFirestoreData,
        });
        return jest.fn(); // unsubscribe function
      });
      
      require('firebase/firestore').onSnapshot.mockImplementation(mockOnSnapshot);

      const { result } = renderHook(() => useSubscription(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.subscription).not.toBe(null);
        expect(result.current.isPremium).toBe(false);
        expect(result.current.hasActiveSubscription).toBe(false);
        expect(result.current.planType).toBe(SUBSCRIPTION_CONSTANTS.PLAN_TYPES.FREE);
      });
    });

    it('should process premium subscription correctly', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      const mockFirestoreData = {
        subscriptionBasic: {
          planType: SUBSCRIPTION_CONSTANTS.PLAN_TYPES.ONE_MONTH,
          status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.ACTIVE,
          startDate: Timestamp.now(),
          endDate: Timestamp.fromDate(futureDate),
          autoRenew: true,
          trialEndDate: null,
        },
        isPremium: true,
        hasActiveSubscription: true,
        canAccessPremiumFeatures: true,
        subscriptionExpiresAt: Timestamp.fromDate(futureDate),
        daysUntilExpiry: 30,
      };

      const mockOnSnapshot = jest.fn((docRef, callback) => {
        callback({
          exists: () => true,
          data: () => mockFirestoreData,
        });
        return jest.fn();
      });
      
      require('firebase/firestore').onSnapshot.mockImplementation(mockOnSnapshot);

      const { result } = renderHook(() => useSubscription(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.subscription).not.toBe(null);
        expect(result.current.isPremium).toBe(true);
        expect(result.current.hasActiveSubscription).toBe(true);
        expect(result.current.planType).toBe(SUBSCRIPTION_CONSTANTS.PLAN_TYPES.ONE_MONTH);
        expect(result.current.remainingDays).toBeGreaterThan(0);
      });
    });

    it('should handle expired subscription correctly', async () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 1);

      const mockFirestoreData = {
        subscriptionBasic: {
          planType: SUBSCRIPTION_CONSTANTS.PLAN_TYPES.ONE_MONTH,
          status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.EXPIRED,
          startDate: Timestamp.fromDate(new Date(pastDate.getTime() - 30 * 24 * 60 * 60 * 1000)),
          endDate: Timestamp.fromDate(pastDate),
          autoRenew: false,
          trialEndDate: null,
        },
        isPremium: false,
        hasActiveSubscription: false,
        canAccessPremiumFeatures: false,
        subscriptionExpiresAt: Timestamp.fromDate(pastDate),
      };

      const mockOnSnapshot = jest.fn((docRef, callback) => {
        callback({
          exists: () => true,
          data: () => mockFirestoreData,
        });
        return jest.fn();
      });
      
      require('firebase/firestore').onSnapshot.mockImplementation(mockOnSnapshot);

      const { result } = renderHook(() => useSubscription(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.isExpired).toBe(true);
        expect(result.current.isPremium).toBe(false);
        expect(result.current.hasActiveSubscription).toBe(false);
      });
    });
  });

  describe('Helper Functions', () => {
    it('should format plan names correctly', () => {
      const { result } = renderHook(() => useSubscription(), { wrapper });

      expect(result.current.formatPlanName('free')).toBe('無料プラン');
      expect(result.current.formatPlanName('1month')).toBe('1ヶ月プラン');
      expect(result.current.formatPlanName('3month')).toBe('3ヶ月プラン');
      expect(result.current.formatPlanName('6month')).toBe('6ヶ月プラン');
      expect(result.current.formatPlanName('12month')).toBe('12ヶ月プラン');
    });

    it('should calculate remaining time correctly', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      futureDate.setHours(futureDate.getHours() + 12);

      const mockFirestoreData = {
        subscriptionBasic: {
          planType: SUBSCRIPTION_CONSTANTS.PLAN_TYPES.ONE_MONTH,
          status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.ACTIVE,
          startDate: Timestamp.now(),
          endDate: Timestamp.fromDate(futureDate),
          autoRenew: true,
          trialEndDate: null,
        },
        subscriptionExpiresAt: Timestamp.fromDate(futureDate),
      };

      const mockOnSnapshot = jest.fn((docRef, callback) => {
        callback({
          exists: () => true,
          data: () => mockFirestoreData,
        });
        return jest.fn();
      });
      
      require('firebase/firestore').onSnapshot.mockImplementation(mockOnSnapshot);

      const { result } = renderHook(() => useSubscription(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        const remainingTime = result.current.getRemainingTime();
        expect(remainingTime).not.toBe(null);
        expect(remainingTime?.days).toBe(5);
        expect(remainingTime?.hours).toBeGreaterThanOrEqual(11);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle permission errors gracefully', async () => {
      const mockOnSnapshot = jest.fn((docRef, successCallback, errorCallback) => {
        const error = { code: 'permission-denied', message: 'Permission denied' };
        errorCallback(error);
        return jest.fn();
      });
      
      require('firebase/firestore').onSnapshot.mockImplementation(mockOnSnapshot);

      const { result } = renderHook(() => useSubscription(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('アクセス権限がありません');
        expect(result.current.subscription).toBe(null);
      });
    });

    it('should handle network errors gracefully', async () => {
      const mockOnSnapshot = jest.fn((docRef, successCallback, errorCallback) => {
        const error = { code: 'unavailable', message: 'Network unavailable' };
        errorCallback(error);
        return jest.fn();
      });
      
      require('firebase/firestore').onSnapshot.mockImplementation(mockOnSnapshot);

      const { result } = renderHook(() => useSubscription(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('サブスクリプション情報の取得に失敗しました');
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should handle subscription status changes', async () => {
      let mockCallback: any;
      const mockOnSnapshot = jest.fn((docRef, callback) => {
        mockCallback = callback;
        return jest.fn();
      });
      
      require('firebase/firestore').onSnapshot.mockImplementation(mockOnSnapshot);

      const { result } = renderHook(() => useSubscription(), { wrapper });

      // Initial free subscription
      mockCallback({
        exists: () => true,
        data: () => ({
          subscriptionBasic: {
            planType: SUBSCRIPTION_CONSTANTS.PLAN_TYPES.FREE,
            status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.NONE,
          },
          isPremium: false,
        }),
      });

      await waitFor(() => {
        expect(result.current.isPremium).toBe(false);
      });

      // Update to premium subscription
      mockCallback({
        exists: () => true,
        data: () => ({
          subscriptionBasic: {
            planType: SUBSCRIPTION_CONSTANTS.PLAN_TYPES.ONE_MONTH,
            status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.ACTIVE,
          },
          isPremium: true,
          hasActiveSubscription: true,
          canAccessPremiumFeatures: true,
        }),
      });

      await waitFor(() => {
        expect(result.current.isPremium).toBe(true);
        expect(result.current.hasActiveSubscription).toBe(true);
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup listeners on unmount', () => {
      const mockUnsubscribe = jest.fn();
      const mockOnSnapshot = jest.fn(() => mockUnsubscribe);
      
      require('firebase/firestore').onSnapshot.mockImplementation(mockOnSnapshot);

      const { unmount } = renderHook(() => useSubscription(), { wrapper });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});