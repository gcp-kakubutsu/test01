/**
 * Unit Tests for SubscriptionStatus Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubscriptionStatusComponent } from '@/components/subscription/SubscriptionStatusComponent';
import { UserWithSubscription, SUBSCRIPTION_CONSTANTS } from '@/types/subscription';
import { Timestamp } from 'firebase/firestore';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock toast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('SubscriptionStatusComponent', () => {
  const mockFreeSubscription: UserWithSubscription = {
    uid: 'test-user',
    email: 'test@example.com',
    createdAt: Timestamp.now(),
    subscriptionBasic: {
      planType: SUBSCRIPTION_CONSTANTS.PLAN_TYPES.FREE,
      status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.NONE,
      startDate: Timestamp.now(),
      endDate: null,
      autoRenew: false,
      trialEndDate: null,
    },
    subscriptionManagement: null,
    subscriptionSchedule: null,
    cancellation: {
      canceledAt: null,
      cancelAtPeriodEnd: false,
      cancelReason: null,
      refundAmount: null,
      refundStatus: null,
    },
    trial: {
      startDate: null,
      endDate: null,
      isActive: false,
      hasUsed: false,
    },
    subscription: {
      status: 'none',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      pausedAt: null,
    },
    billing: {
      customerId: null,
      paymentMethodId: null,
      lastPaymentDate: null,
      nextBillingDate: null,
    },
    isPremium: false,
    hasActiveSubscription: false,
    canAccessPremiumFeatures: false,
    subscriptionExpiresAt: null,
    daysUntilExpiry: null,
  };

  const mockPremiumSubscription: UserWithSubscription = {
    ...mockFreeSubscription,
    subscriptionBasic: {
      planType: SUBSCRIPTION_CONSTANTS.PLAN_TYPES.ONE_MONTH,
      status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.ACTIVE,
      startDate: Timestamp.now(),
      endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      autoRenew: true,
      trialEndDate: null,
    },
    isPremium: true,
    hasActiveSubscription: true,
    canAccessPremiumFeatures: true,
    subscriptionExpiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    daysUntilExpiry: 30,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Free Subscription State', () => {
    it('should display free plan status correctly', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockFreeSubscription}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('無料プラン')).toBeInTheDocument();
      expect(screen.getByText('アップグレード')).toBeInTheDocument();
    });

    it('should handle upgrade button click', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockFreeSubscription}
          loading={false}
          error={null}
        />
      );

      const upgradeButton = screen.getByText('アップグレード');
      fireEvent.click(upgradeButton);

      expect(mockPush).toHaveBeenCalledWith('/subscription/plans');
    });
  });

  describe('Premium Subscription State', () => {
    it('should display premium plan status correctly', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockPremiumSubscription}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('1ヶ月プラン')).toBeInTheDocument();
      expect(screen.getByText('アクティブ')).toBeInTheDocument();
      expect(screen.getByText('30日')).toBeInTheDocument();
    });

    it('should show manage subscription button for premium users', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockPremiumSubscription}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('管理')).toBeInTheDocument();
    });

    it('should handle manage subscription button click', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockPremiumSubscription}
          loading={false}
          error={null}
        />
      );

      const manageButton = screen.getByText('管理');
      fireEvent.click(manageButton);

      expect(mockPush).toHaveBeenCalledWith('/subscription');
    });
  });

  describe('Trial State', () => {
    const mockTrialSubscription: UserWithSubscription = {
      ...mockFreeSubscription,
      trial: {
        startDate: Timestamp.now(),
        endDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        isActive: true,
        hasUsed: false,
      },
      subscriptionBasic: {
        ...mockFreeSubscription.subscriptionBasic,
        status: 'trialing' as any,
      },
      subscription: {
        ...mockFreeSubscription.subscription,
        status: 'trialing',
      },
      isPremium: true,
      canAccessPremiumFeatures: true,
    };

    it('should display trial status correctly', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockTrialSubscription}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText(/トライアル/)).toBeInTheDocument();
      expect(screen.getByText('7日')).toBeInTheDocument();
    });
  });

  describe('Expired Subscription State', () => {
    const mockExpiredSubscription: UserWithSubscription = {
      ...mockPremiumSubscription,
      subscriptionBasic: {
        ...mockPremiumSubscription.subscriptionBasic,
        status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.EXPIRED,
        endDate: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      },
      isPremium: false,
      hasActiveSubscription: false,
      canAccessPremiumFeatures: false,
      subscriptionExpiresAt: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    };

    it('should display expired status correctly', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockExpiredSubscription}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText(/期限切れ/)).toBeInTheDocument();
    });

    it('should show renewal option for expired subscriptions', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockExpiredSubscription}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('更新')).toBeInTheDocument();
    });
  });

  describe('Canceled Subscription State', () => {
    const mockCanceledSubscription: UserWithSubscription = {
      ...mockPremiumSubscription,
      subscriptionBasic: {
        ...mockPremiumSubscription.subscriptionBasic,
        status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.CANCELED,
      },
      cancellation: {
        canceledAt: Timestamp.now(),
        cancelAtPeriodEnd: true,
        cancelReason: 'User requested cancellation',
        refundAmount: null,
        refundStatus: null,
      },
      hasActiveSubscription: false,
    };

    it('should display canceled status correctly', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockCanceledSubscription}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText(/キャンセル/)).toBeInTheDocument();
    });

    it('should show reactivation option for canceled subscriptions', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockCanceledSubscription}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText('再開')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading indicator when loading', () => {
      render(
        <SubscriptionStatusComponent
          subscription={null}
          loading={true}
          error={null}
        />
      );

      expect(screen.getByTestId('subscription-loading')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when error occurs', () => {
      render(
        <SubscriptionStatusComponent
          subscription={null}
          loading={false}
          error="Network error occurred"
        />
      );

      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    });

    it('should show retry button on error', () => {
      render(
        <SubscriptionStatusComponent
          subscription={null}
          loading={false}
          error="Network error occurred"
          onRetry={() => {}}
        />
      );

      expect(screen.getByText('再試行')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockPremiumSubscription}
          loading={false}
          error={null}
        />
      );

      const statusElement = screen.getByRole('region');
      expect(statusElement).toHaveAttribute('aria-label', 'サブスクリプション状況');
    });

    it('should have proper button accessibility', () => {
      render(
        <SubscriptionStatusComponent
          subscription={mockFreeSubscription}
          loading={false}
          error={null}
        />
      );

      const upgradeButton = screen.getByRole('button', { name: /アップグレード/ });
      expect(upgradeButton).toBeInTheDocument();
      expect(upgradeButton).toBeEnabled();
    });
  });

  describe('Responsive Design', () => {
    it('should render properly on mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <SubscriptionStatusComponent
          subscription={mockPremiumSubscription}
          loading={false}
          error={null}
        />
      );

      // Component should still render all essential elements
      expect(screen.getByText('1ヶ月プラン')).toBeInTheDocument();
      expect(screen.getByText('管理')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null subscription gracefully', () => {
      render(
        <SubscriptionStatusComponent
          subscription={null}
          loading={false}
          error={null}
        />
      );

      // Should show default state or loading
      expect(screen.getByText('サブスクリプション情報を読み込み中...')).toBeInTheDocument();
    });

    it('should handle subscription with missing data', () => {
      const incompleteSubscription = {
        ...mockFreeSubscription,
        subscriptionBasic: {
          ...mockFreeSubscription.subscriptionBasic,
          planType: undefined as any,
        },
      };

      render(
        <SubscriptionStatusComponent
          subscription={incompleteSubscription}
          loading={false}
          error={null}
        />
      );

      // Should fallback to safe defaults
      expect(screen.getByText('無料プラン')).toBeInTheDocument();
    });
  });
});