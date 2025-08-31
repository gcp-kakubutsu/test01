/**
 * Transaction Hub API Integration
 * Handles payment processing, subscription management, and transaction tracking
 */

import { PlanInfo, PaymentStatus } from '@/types/subscription';
import { 
  PaymentError, 
  NetworkError, 
  ServiceUnavailableError,
  analyzeError, 
  logSubscriptionError,
  ERROR_CODES 
} from '@/lib/errors/subscriptionErrors';
import { withRetry } from '@/lib/utils/retryHandler';

// Environment configuration
const TRANSACTION_HUB_BASE_URL = process.env.NEXT_PUBLIC_TRANSACTION_HUB_URL || 'https://api.transaction-hub.com/v1';
const TRANSACTION_HUB_API_KEY = process.env.TRANSACTION_HUB_API_KEY || process.env.NEXT_PUBLIC_TRANSACTION_HUB_API_KEY;
const TRANSACTION_HUB_WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL + '/api/payment/webhook';

// Check if we're in development mode without API key
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const IS_MOCK_MODE = IS_DEVELOPMENT && !TRANSACTION_HUB_API_KEY;

// Request/Response interfaces
interface CreatePaymentSessionRequest {
  user_id: string;
  plan_id: string;
  amount: number;
  currency: 'JPY';
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, any>;
}

interface CreatePaymentSessionResponse {
  session_id: string;
  checkout_url: string;
  expires_at: string;
  status: 'pending' | 'active' | 'expired';
}

interface PaymentSessionStatus {
  session_id: string;
  status: 'pending' | 'completed' | 'failed' | 'canceled' | 'expired';
  payment_id?: string;
  subscription_id?: string;
  failure_reason?: string;
  completed_at?: string;
}

interface CreateSubscriptionRequest {
  user_id: string;
  plan_id: string;
  payment_method_id: string;
  trial_days?: number;
  metadata?: Record<string, any>;
}

interface CreateSubscriptionResponse {
  subscription_id: string;
  status: 'active' | 'trialing' | 'incomplete';
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
}

interface CancelSubscriptionRequest {
  subscription_id: string;
  cancel_at_period_end?: boolean;
  cancellation_reason?: string;
}

interface CancelSubscriptionResponse {
  subscription_id: string;
  status: 'canceled';
  canceled_at: string;
  cancel_at_period_end: boolean;
}

// API client class
export class TransactionHubAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = TRANSACTION_HUB_BASE_URL;
    this.apiKey = TRANSACTION_HUB_API_KEY || '';
    
    // In development mode without API key, use mock mode
    if (IS_MOCK_MODE) {
      console.warn('[TransactionHub] Running in mock mode - no actual payments will be processed');
      this.apiKey = 'mock-api-key-for-development';
    } else if (!this.apiKey) {
      throw new Error('TRANSACTION_HUB_API_KEY is not configured');
    }
  }

  // Private method for making API requests
  private async makeRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    // Mock mode - return fake responses for development
    if (IS_MOCK_MODE) {
      return this.getMockResponse<T>(endpoint, method, data);
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Nukune/1.0'
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Map HTTP status codes to appropriate error types
        let subscriptionError;
        
        switch (response.status) {
          case 400:
            subscriptionError = new PaymentError(
              `Bad request: ${errorData.message || 'Invalid request data'}`,
              ERROR_CODES.INVALID_PLAN_ID,
              '無効なリクエストです。入力内容をご確認ください。',
              false,
              { statusCode: response.status, responseData: errorData }
            );
            break;
            
          case 401:
            subscriptionError = new PaymentError(
              'Authentication failed',
              ERROR_CODES.AUTHENTICATION_REQUIRED,
              '認証に失敗しました。再度お試しください。',
              false,
              { statusCode: response.status }
            );
            break;
            
          case 402:
            subscriptionError = new PaymentError(
              errorData.message || 'Payment required',
              ERROR_CODES.PAYMENT_FAILED,
              errorData.user_message || 'お支払いが必要です。',
              true,
              { statusCode: response.status, responseData: errorData }
            );
            break;
            
          case 429:
            subscriptionError = new ServiceUnavailableError(
              'Too many requests',
              ERROR_CODES.RATE_LIMITED,
              'リクエストが多すぎます。しばらく時間を置いてお試しください。',
              { statusCode: response.status, retryAfter: response.headers.get('retry-after') }
            );
            break;
            
          case 500:
          case 502:
          case 503:
          case 504:
            subscriptionError = new ServiceUnavailableError(
              `Server error: ${response.status}`,
              ERROR_CODES.SERVER_ERROR,
              'サーバーでエラーが発生しました。しばらく時間を置いてお試しください。',
              { statusCode: response.status }
            );
            break;
            
          default:
            subscriptionError = new PaymentError(
              `Transaction Hub API error: ${response.status} ${response.statusText}`,
              ERROR_CODES.PAYMENT_FAILED,
              '決済サービスでエラーが発生しました。しばらく時間を置いてお試しください。',
              true,
              { statusCode: response.status, responseData: errorData }
            );
        }
        
        logSubscriptionError(subscriptionError, `TransactionHub API ${method} ${endpoint}`);
        throw subscriptionError;
      }

      return await response.json();
    } catch (error) {
      // If it's already a subscription error, re-throw it
      if (error instanceof PaymentError || error instanceof ServiceUnavailableError) {
        throw error;
      }
      
      // Handle network errors
      const subscriptionError = new NetworkError(
        error instanceof Error ? error.message : 'Network request failed',
        ERROR_CODES.CONNECTION_FAILED,
        'ネットワーク接続に問題があります。インターネット接続をご確認の上、再度お試しください。',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
      
      logSubscriptionError(subscriptionError, `TransactionHub API ${method} ${endpoint}`);
      throw subscriptionError;
    }
  }

  /**
   * Create a payment session for plan purchase
   */
  async createPaymentSession(request: CreatePaymentSessionRequest): Promise<CreatePaymentSessionResponse> {
    return await this.makeRequest<CreatePaymentSessionResponse>(
      '/payment/sessions',
      'POST',
      {
        ...request,
        webhook_url: TRANSACTION_HUB_WEBHOOK_URL,
      }
    );
  }

  /**
   * Get payment session status
   */
  async getPaymentSessionStatus(sessionId: string): Promise<PaymentSessionStatus> {
    return await this.makeRequest<PaymentSessionStatus>(`/payment/sessions/${sessionId}`);
  }

  /**
   * Create a subscription
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> {
    return await this.makeRequest<CreateSubscriptionResponse>(
      '/subscriptions',
      'POST',
      {
        ...request,
        webhook_url: TRANSACTION_HUB_WEBHOOK_URL,
      }
    );
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(request: CancelSubscriptionRequest): Promise<CancelSubscriptionResponse> {
    return await this.makeRequest<CancelSubscriptionResponse>(
      `/subscriptions/${request.subscription_id}/cancel`,
      'POST',
      {
        cancel_at_period_end: request.cancel_at_period_end ?? true,
        cancellation_reason: request.cancellation_reason || 'User requested cancellation'
      }
    );
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<any> {
    return await this.makeRequest(`/subscriptions/${subscriptionId}`);
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscriptionId: string, updates: any): Promise<any> {
    return await this.makeRequest(
      `/subscriptions/${subscriptionId}`,
      'PUT',
      updates
    );
  }

  /**
   * Create a refund
   */
  async createRefund(paymentId: string, amount?: number, reason?: string): Promise<any> {
    return await this.makeRequest(
      '/refunds',
      'POST',
      {
        payment_id: paymentId,
        amount,
        reason: reason || 'Customer requested refund'
      }
    );
  }

  /**
   * Get user's payment methods
   */
  async getPaymentMethods(userId: string): Promise<any[]> {
    return await this.makeRequest(`/users/${userId}/payment-methods`);
  }

  /**
   * Add payment method for user
   */
  async addPaymentMethod(userId: string, paymentMethodData: any): Promise<any> {
    return await this.makeRequest(
      `/users/${userId}/payment-methods`,
      'POST',
      paymentMethodData
    );
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    await this.makeRequest(
      `/users/${userId}/payment-methods/${paymentMethodId}`,
      'DELETE'
    );
  }
}

// Utility functions for client-side payment processing
export class PaymentProcessor {
  private static instance: TransactionHubAPI | null = null;

  private static getInstance(): TransactionHubAPI {
    if (!PaymentProcessor.instance) {
      PaymentProcessor.instance = new TransactionHubAPI();
    }
    return PaymentProcessor.instance;
  }

  /**
   * Initiate payment for a subscription plan
   */
  static async initiatePayment(
    userId: string,
    plan: PlanInfo,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    return withRetry(
      async () => {
        const api = PaymentProcessor.getInstance();
        
        const request: CreatePaymentSessionRequest = {
          user_id: userId,
          plan_id: plan.id,
          amount: plan.amount,
          currency: 'JPY',
          success_url: successUrl || `${window.location.origin}/subscription/success`,
          cancel_url: cancelUrl || `${window.location.origin}/subscription/cancel`,
          metadata: {
            plan_type: plan.planType,
            plan_name: plan.name,
            billing_cycle: plan.billingCycle,
            initiated_from: 'web_app'
          }
        };

        const response = await api.createPaymentSession(request);
        
        return {
          checkoutUrl: response.checkout_url,
          sessionId: response.session_id
        };
      },
      {
        maxAttempts: 3,
        baseDelay: 1000,
        exponentialBackoff: true,
        retryableErrors: [ERROR_CODES.NETWORK_TIMEOUT, ERROR_CODES.SERVER_ERROR]
      },
      'PaymentProcessor.initiatePayment',
      userId
    );
  }

  /**
   * Check payment status
   */
  static async checkPaymentStatus(sessionId: string): Promise<PaymentSessionStatus> {
    try {
      const api = PaymentProcessor.getInstance();
      return await api.getPaymentSessionStatus(sessionId);
    } catch (error) {
      console.error('[PaymentProcessor] Failed to check payment status:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
    reason?: string
  ): Promise<CancelSubscriptionResponse> {
    try {
      const api = PaymentProcessor.getInstance();
      
      const request: CancelSubscriptionRequest = {
        subscription_id: subscriptionId,
        cancel_at_period_end: cancelAtPeriodEnd,
        cancellation_reason: reason
      };

      return await api.cancelSubscription(request);
    } catch (error) {
      console.error('[PaymentProcessor] Failed to cancel subscription:', error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  static async processRefund(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<any> {
    try {
      const api = PaymentProcessor.getInstance();
      return await api.createRefund(paymentId, amount, reason);
    } catch (error) {
      console.error('[PaymentProcessor] Failed to process refund:', error);
      throw error;
    }
  }
}

// Retry mechanism for failed operations
export class RetryManager {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second

  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = RetryManager.MAX_RETRIES,
    delay: number = RetryManager.RETRY_DELAY
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`[RetryManager] Attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }

    throw lastError!;
  }
  
  // Mock response generator for development mode
  private getMockResponse<T>(endpoint: string, method: string, data?: any): T {
    console.log(`[TransactionHub Mock] ${method} ${endpoint}`, data);
    
    // Mock responses based on endpoint patterns
    if (endpoint.includes('/sessions')) {
      if (method === 'POST') {
        return {
          session_id: `mock_session_${Date.now()}`,
          checkout_url: '/subscription/upgrade?mock=true',
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          status: 'pending'
        } as unknown as T;
      }
      if (method === 'GET') {
        return {
          session_id: data?.session_id || 'mock_session_123',
          status: 'completed',
          payment_id: 'mock_payment_123',
          subscription_id: 'mock_subscription_123',
          completed_at: new Date().toISOString()
        } as unknown as T;
      }
    }
    
    if (endpoint.includes('/subscriptions')) {
      if (method === 'POST') {
        return {
          subscription_id: `mock_sub_${Date.now()}`,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          trial_end: null
        } as unknown as T;
      }
      if (method === 'DELETE') {
        return {
          subscription_id: data?.subscription_id || 'mock_sub_123',
          status: 'canceled',
          canceled_at: new Date().toISOString()
        } as unknown as T;
      }
    }
    
    if (endpoint.includes('/refunds')) {
      return {
        refund_id: `mock_refund_${Date.now()}`,
        status: 'succeeded',
        amount: data?.amount || 0,
        created_at: new Date().toISOString()
      } as unknown as T;
    }
    
    // Default mock response
    return {
      success: true,
      message: 'Mock response for development',
      data: {}
    } as unknown as T;
  }
}

// Export singleton instance for server-side usage
export const transactionHubAPI = new TransactionHubAPI();