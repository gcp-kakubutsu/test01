/**
 * Unit Tests for Subscription Error Handling
 */

import {
  SubscriptionError,
  PaymentError,
  NetworkError,
  ValidationError,
  AuthError,
  ServiceUnavailableError,
  ERROR_CODES,
  ERROR_MESSAGES,
  analyzeError,
  createPaymentError,
  createNetworkError,
  createAuthError,
  createValidationError,
  logSubscriptionError,
  isInGracePeriod,
  getGracePeriodDaysRemaining,
} from '@/lib/errors/subscriptionErrors';

// Mock console.error for logging tests
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('Subscription Error Classes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SubscriptionError Base Class', () => {
    it('should create a basic subscription error', () => {
      const error = new SubscriptionError(
        'Test error',
        'TEST_CODE',
        'test',
        'medium',
        'テストエラーです',
        true,
        { testData: 'test' }
      );

      expect(error.name).toBe('SubscriptionError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.category).toBe('test');
      expect(error.severity).toBe('medium');
      expect(error.userMessage).toBe('テストエラーです');
      expect(error.retryable).toBe(true);
      expect(error.metadata).toEqual({ testData: 'test' });
    });
  });

  describe('PaymentError Class', () => {
    it('should create a payment error with correct defaults', () => {
      const error = new PaymentError(
        'Payment failed',
        ERROR_CODES.PAYMENT_FAILED,
        'お支払いに失敗しました'
      );

      expect(error.name).toBe('PaymentError');
      expect(error.category).toBe('payment');
      expect(error.severity).toBe('high');
      expect(error.retryable).toBe(true);
    });

    it('should create non-retryable payment error', () => {
      const error = new PaymentError(
        'Card declined',
        ERROR_CODES.CARD_DECLINED,
        'カードが承認されませんでした',
        false
      );

      expect(error.retryable).toBe(false);
    });
  });

  describe('NetworkError Class', () => {
    it('should create a network error with correct defaults', () => {
      const error = new NetworkError(
        'Network timeout',
        ERROR_CODES.NETWORK_TIMEOUT
      );

      expect(error.name).toBe('NetworkError');
      expect(error.category).toBe('network');
      expect(error.severity).toBe('medium');
      expect(error.retryable).toBe(true);
      expect(error.userMessage).toBe('ネットワーク接続に問題があります。しばらく時間を置いてお試しください。');
    });
  });

  describe('ValidationError Class', () => {
    it('should create a validation error', () => {
      const error = new ValidationError(
        'Invalid plan ID',
        ERROR_CODES.INVALID_PLAN_ID,
        '無効なプランIDです'
      );

      expect(error.name).toBe('ValidationError');
      expect(error.category).toBe('validation');
      expect(error.severity).toBe('low');
      expect(error.retryable).toBe(false);
    });
  });

  describe('AuthError Class', () => {
    it('should create an auth error with default message', () => {
      const error = new AuthError(
        'Authentication required',
        ERROR_CODES.AUTHENTICATION_REQUIRED
      );

      expect(error.name).toBe('AuthError');
      expect(error.category).toBe('auth');
      expect(error.severity).toBe('medium');
      expect(error.retryable).toBe(false);
      expect(error.userMessage).toBe('ログインが必要です。再度ログインしてお試しください。');
    });
  });

  describe('ServiceUnavailableError Class', () => {
    it('should create a service unavailable error', () => {
      const error = new ServiceUnavailableError(
        'Service down',
        ERROR_CODES.SERVICE_UNAVAILABLE
      );

      expect(error.name).toBe('ServiceUnavailableError');
      expect(error.category).toBe('service');
      expect(error.severity).toBe('critical');
      expect(error.retryable).toBe(true);
    });
  });
});

describe('Error Factory Functions', () => {
  describe('createPaymentError', () => {
    it('should create payment error with correct mapping', () => {
      const error = createPaymentError(ERROR_CODES.CARD_DECLINED);

      expect(error.code).toBe(ERROR_CODES.CARD_DECLINED);
      expect(error.userMessage).toBe(ERROR_MESSAGES[ERROR_CODES.CARD_DECLINED]);
      expect(error.metadata).toHaveProperty('timestamp');
    });

    it('should include original error in metadata', () => {
      const originalError = new Error('Original error message');
      const error = createPaymentError(ERROR_CODES.PAYMENT_FAILED, originalError);

      expect(error.metadata?.originalError).toBe('Original error message');
    });
  });

  describe('createNetworkError', () => {
    it('should create network error with defaults', () => {
      const error = createNetworkError();

      expect(error.code).toBe(ERROR_CODES.CONNECTION_FAILED);
      expect(error.userMessage).toBe(ERROR_MESSAGES[ERROR_CODES.CONNECTION_FAILED]);
    });
  });

  describe('createAuthError', () => {
    it('should create auth error with custom code', () => {
      const error = createAuthError(ERROR_CODES.TOKEN_EXPIRED);

      expect(error.code).toBe(ERROR_CODES.TOKEN_EXPIRED);
      expect(error.userMessage).toBe(ERROR_MESSAGES[ERROR_CODES.TOKEN_EXPIRED]);
    });
  });

  describe('createValidationError', () => {
    it('should create validation error with field name', () => {
      const error = createValidationError(ERROR_CODES.REQUIRED_FIELD_MISSING, 'email');

      expect(error.userMessage).toContain('email');
      expect(error.metadata?.fieldName).toBe('email');
    });
  });
});

describe('Error Analysis', () => {
  describe('analyzeError', () => {
    it('should return existing SubscriptionError unchanged', () => {
      const originalError = new PaymentError(
        'Test',
        ERROR_CODES.PAYMENT_FAILED,
        'テスト'
      );

      const analyzedError = analyzeError(originalError);

      expect(analyzedError).toBe(originalError);
    });

    it('should analyze card declined error', () => {
      const error = new Error('Your card was declined');
      const analyzedError = analyzeError(error);

      expect(analyzedError).toBeInstanceOf(PaymentError);
      expect(analyzedError.code).toBe(ERROR_CODES.CARD_DECLINED);
    });

    it('should analyze insufficient funds error', () => {
      const error = new Error('Insufficient funds available');
      const analyzedError = analyzeError(error);

      expect(analyzedError).toBeInstanceOf(PaymentError);
      expect(analyzedError.code).toBe(ERROR_CODES.INSUFFICIENT_FUNDS);
    });

    it('should analyze network timeout error', () => {
      const error = new Error('Request timeout occurred');
      const analyzedError = analyzeError(error);

      expect(analyzedError).toBeInstanceOf(NetworkError);
    });

    it('should analyze authentication error', () => {
      const error = new Error('Authentication failed');
      const analyzedError = analyzeError(error);

      expect(analyzedError).toBeInstanceOf(AuthError);
      expect(analyzedError.code).toBe(ERROR_CODES.AUTHENTICATION_REQUIRED);
    });

    it('should handle unknown errors', () => {
      const error = 'Unknown error string';
      const analyzedError = analyzeError(error);

      expect(analyzedError).toBeInstanceOf(SubscriptionError);
      expect(analyzedError.code).toBe('UNKNOWN_ERROR');
    });
  });
});

describe('Error Logging', () => {
  describe('logSubscriptionError', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should log error in development mode', () => {
      const error = new PaymentError(
        'Test error',
        ERROR_CODES.PAYMENT_FAILED,
        'テストエラー'
      );

      logSubscriptionError(error, 'test-context', 'test-user');

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[Subscription Error]',
        expect.objectContaining({
          error: expect.objectContaining({
            code: ERROR_CODES.PAYMENT_FAILED,
            message: 'Test error',
          }),
          context: 'test-context',
          userId: 'test-user',
        })
      );
    });

    it('should include browser information when available', () => {
      // Mock window object
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'test-browser' },
        writable: true,
      });
      Object.defineProperty(window, 'location', {
        value: { href: 'https://test.com' },
        writable: true,
      });

      const error = new PaymentError(
        'Test error',
        ERROR_CODES.PAYMENT_FAILED,
        'テストエラー'
      );

      logSubscriptionError(error, 'test-context');

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[Subscription Error]',
        expect.objectContaining({
          userAgent: 'test-browser',
          url: 'https://test.com',
        })
      );
    });

    it('should handle production logging', () => {
      process.env.NODE_ENV = 'production';

      const error = new PaymentError(
        'Test error',
        ERROR_CODES.PAYMENT_FAILED,
        'テストエラー'
      );

      logSubscriptionError(error);

      // Should still log to console in test environment
      expect(mockConsoleError).toHaveBeenCalled();
    });
  });
});

describe('Grace Period Utilities', () => {
  describe('isInGracePeriod', () => {
    it('should return true when in grace period', () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1); // Expired yesterday

      const inGracePeriod = isInGracePeriod(endDate, 3);

      expect(inGracePeriod).toBe(true);
    });

    it('should return false when grace period has ended', () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 5); // Expired 5 days ago

      const inGracePeriod = isInGracePeriod(endDate, 3);

      expect(inGracePeriod).toBe(false);
    });

    it('should return false when subscription is still active', () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1); // Expires tomorrow

      const inGracePeriod = isInGracePeriod(endDate, 3);

      expect(inGracePeriod).toBe(false);
    });

    it('should return false when endDate is null', () => {
      const inGracePeriod = isInGracePeriod(null, 3);

      expect(inGracePeriod).toBe(false);
    });
  });

  describe('getGracePeriodDaysRemaining', () => {
    it('should return correct days remaining', () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1); // Expired yesterday

      const daysRemaining = getGracePeriodDaysRemaining(endDate, 3);

      expect(daysRemaining).toBe(2); // 2 days left in grace period
    });

    it('should return 0 when grace period has ended', () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 5); // Expired 5 days ago

      const daysRemaining = getGracePeriodDaysRemaining(endDate, 3);

      expect(daysRemaining).toBe(0);
    });

    it('should return 0 when endDate is null', () => {
      const daysRemaining = getGracePeriodDaysRemaining(null, 3);

      expect(daysRemaining).toBe(0);
    });
  });
});

describe('Error Messages', () => {
  it('should have Japanese messages for all error codes', () => {
    // Test that all error codes have corresponding messages
    Object.values(ERROR_CODES).forEach(code => {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof ERROR_MESSAGES[code]).toBe('string');
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    });
  });

  it('should have appropriate messages for payment errors', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.CARD_DECLINED]).toContain('カード');
    expect(ERROR_MESSAGES[ERROR_CODES.INSUFFICIENT_FUNDS]).toContain('残高');
    expect(ERROR_MESSAGES[ERROR_CODES.EXPIRED_CARD]).toContain('有効期限');
  });

  it('should have appropriate messages for network errors', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.NETWORK_TIMEOUT]).toContain('ネットワーク');
    expect(ERROR_MESSAGES[ERROR_CODES.CONNECTION_FAILED]).toContain('接続');
  });
});