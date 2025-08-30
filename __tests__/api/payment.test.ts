/**
 * Unit Tests for Payment API
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/payment/webhook/route';
import { PaymentError, ERROR_CODES } from '@/lib/errors/subscriptionErrors';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  getFirebaseAdminApp: jest.fn(),
  getFirestoreAdmin: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
      })),
    })),
    runTransaction: jest.fn(),
  })),
}));

// Mock crypto for signature verification
const mockCrypto = {
  createHmac: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'mock-signature'),
    })),
  })),
  timingSafeEqual: jest.fn(() => true),
};
jest.mock('crypto', () => mockCrypto);

describe('Payment Webhook API', () => {
  const mockValidWebhookPayload = {
    event_type: 'payment.succeeded',
    event_id: 'evt_test_123',
    created_at: new Date().toISOString(),
    data: {
      id: 'payment_test_123',
      user_id: 'user_test_123',
      subscription_id: 'sub_test_123',
      plan_id: 'plan_1month',
      amount: 1980,
      currency: 'JPY',
      status: 'succeeded',
      payment_method_id: 'pm_test_123',
      metadata: {
        plan_type: '1month',
        billing_cycle: 'monthly',
      },
    },
    signature: 'mock-signature',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TRANSACTION_HUB_WEBHOOK_SECRET = 'test-webhook-secret';
  });

  afterEach(() => {
    delete process.env.TRANSACTION_HUB_WEBHOOK_SECRET;
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid webhook signature', async () => {
      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'x-transaction-hub-signature': 'mock-signature',
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockValidWebhookPayload),
      });

      const response = await POST(request);
      
      expect(response.status).not.toBe(401);
    });

    it('should reject invalid webhook signature', async () => {
      mockCrypto.timingSafeEqual.mockReturnValueOnce(false);

      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'x-transaction-hub-signature': 'invalid-signature',
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockValidWebhookPayload),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(401);
      
      const responseData = await response.json();
      expect(responseData.error).toBe('Invalid signature');
    });

    it('should reject webhooks without signature header', async () => {
      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockValidWebhookPayload),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(401);
    });
  });

  describe('Payment Success Events', () => {
    it('should process payment.succeeded event correctly', async () => {
      const mockPlanDoc = {
        exists: () => true,
        data: () => ({
          planType: '1month',
          billingCycle: 'monthly',
          amount: 1980,
        }),
      };

      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          email: 'test@example.com',
          createdAt: Timestamp.now(),
        }),
      };

      const mockTransaction = {
        get: jest.fn()
          .mockResolvedValueOnce(mockUserDoc)
          .mockResolvedValueOnce(mockPlanDoc),
        update: jest.fn(),
      };

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn(),
            set: jest.fn(),
          })),
        })),
        runTransaction: jest.fn((callback) => callback(mockTransaction)),
      };

      require('@/lib/firebase/admin').getFirestoreAdmin.mockReturnValue(mockFirestore);

      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'x-transaction-hub-signature': 'mock-signature',
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockValidWebhookPayload),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.status).toBe('success');
      expect(responseData.event_id).toBe(mockValidWebhookPayload.event_id);
      
      // Verify user data was updated
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isPremium: true,
          hasActiveSubscription: true,
          canAccessPremiumFeatures: true,
        })
      );
    });

    it('should handle payment.failed event correctly', async () => {
      const failedPaymentPayload = {
        ...mockValidWebhookPayload,
        event_type: 'payment.failed',
        data: {
          ...mockValidWebhookPayload.data,
          status: 'failed',
          failure_reason: 'card_declined',
        },
      };

      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          subscriptionBasic: {
            status: 'active',
          },
        }),
      };

      const mockTransaction = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
        update: jest.fn(),
      };

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: jest.fn(),
          })),
        })),
        runTransaction: jest.fn((callback) => callback(mockTransaction)),
      };

      require('@/lib/firebase/admin').getFirestoreAdmin.mockReturnValue(mockFirestore);

      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'x-transaction-hub-signature': 'mock-signature',
          'content-type': 'application/json',
        },
        body: JSON.stringify(failedPaymentPayload),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      
      // Verify subscription was marked as past_due
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'subscriptionBasic.status': 'past_due',
          canAccessPremiumFeatures: false,
        })
      );
    });
  });

  describe('Subscription Events', () => {
    it('should handle subscription.canceled event correctly', async () => {
      const canceledSubscriptionPayload = {
        ...mockValidWebhookPayload,
        event_type: 'subscription.canceled',
        data: {
          ...mockValidWebhookPayload.data,
          metadata: {
            cancelReason: 'User requested cancellation',
          },
        },
      };

      const mockUserDoc = {
        exists: () => true,
        data: () => ({}),
      };

      const mockTransaction = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
        update: jest.fn(),
      };

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: jest.fn(),
          })),
        })),
        runTransaction: jest.fn((callback) => callback(mockTransaction)),
      };

      require('@/lib/firebase/admin').getFirestoreAdmin.mockReturnValue(mockFirestore);

      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'x-transaction-hub-signature': 'mock-signature',
          'content-type': 'application/json',
        },
        body: JSON.stringify(canceledSubscriptionPayload),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      
      // Verify subscription was canceled
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'subscriptionBasic.status': 'canceled',
          'subscriptionBasic.autoRenew': false,
          cancellation: expect.objectContaining({
            cancelAtPeriodEnd: true,
            cancelReason: 'User requested cancellation',
          }),
        })
      );
    });
  });

  describe('Idempotency Control', () => {
    it('should handle duplicate events gracefully', async () => {
      const mockEventDoc = {
        exists: () => true,
      };

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue(mockEventDoc),
          })),
        })),
      };

      require('@/lib/firebase/admin').getFirestoreAdmin.mockReturnValue(mockFirestore);

      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'x-transaction-hub-signature': 'mock-signature',
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockValidWebhookPayload),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.status).toBe('already_processed');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON payload', async () => {
      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'x-transaction-hub-signature': 'mock-signature',
          'content-type': 'application/json',
        },
        body: 'invalid-json',
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      
      const responseData = await response.json();
      expect(responseData.error).toBe('Internal server error');
    });

    it('should handle missing required fields', async () => {
      const invalidPayload = {
        event_type: 'payment.succeeded',
        // Missing event_id and data
      };

      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'x-transaction-hub-signature': 'mock-signature',
          'content-type': 'application/json',
        },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
    });

    it('should handle user not found error', async () => {
      const mockUserDoc = {
        exists: () => false,
      };

      const mockTransaction = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: jest.fn(),
          })),
        })),
        runTransaction: jest.fn((callback) => callback(mockTransaction)),
      };

      require('@/lib/firebase/admin').getFirestoreAdmin.mockReturnValue(mockFirestore);

      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'x-transaction-hub-signature': 'mock-signature',
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockValidWebhookPayload),
      });

      const response = await POST(request);
      
      // Should still return success but log warning
      expect(response.status).toBe(200);
    });

    it('should handle Firebase transaction errors', async () => {
      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: jest.fn(),
          })),
        })),
        runTransaction: jest.fn().mockRejectedValue(new Error('Transaction failed')),
      };

      require('@/lib/firebase/admin').getFirestoreAdmin.mockReturnValue(mockFirestore);

      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'POST',
        headers: {
          'x-transaction-hub-signature': 'mock-signature',
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockValidWebhookPayload),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
    });
  });

  describe('Health Check', () => {
    it('should respond to GET requests with health status', async () => {
      const request = new NextRequest('https://example.com/api/payment/webhook', {
        method: 'GET',
      });

      // Mock the GET handler
      const { GET } = require('@/app/api/payment/webhook/route');
      const response = await GET();
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.status).toBe('healthy');
      expect(responseData.service).toBe('payment-webhook');
    });
  });
});