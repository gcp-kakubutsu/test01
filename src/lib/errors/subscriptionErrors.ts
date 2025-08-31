/**
 * Subscription Error Handling System
 * Defines custom error classes and handling for subscription-related errors
 */

// Base error class for subscription-related errors
export class SubscriptionError extends Error {
  public readonly code: string;
  public readonly category: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly userMessage: string;
  public readonly retryable: boolean;
  public readonly metadata?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    category: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    userMessage: string,
    retryable: boolean = false,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'SubscriptionError';
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.userMessage = userMessage;
    this.retryable = retryable;
    this.metadata = metadata;
  }
}

// Payment-related errors
export class PaymentError extends SubscriptionError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    retryable: boolean = true,
    metadata?: Record<string, any>
  ) {
    super(message, code, 'payment', 'high', userMessage, retryable, metadata);
    this.name = 'PaymentError';
  }
}

// Network-related errors
export class NetworkError extends SubscriptionError {
  constructor(
    message: string,
    code: string,
    userMessage: string = 'ネットワーク接続に問題があります。しばらく時間を置いてお試しください。',
    metadata?: Record<string, any>
  ) {
    super(message, code, 'network', 'medium', userMessage, true, metadata);
    this.name = 'NetworkError';
  }
}

// Validation errors
export class ValidationError extends SubscriptionError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    metadata?: Record<string, any>
  ) {
    super(message, code, 'validation', 'low', userMessage, false, metadata);
    this.name = 'ValidationError';
  }
}

// Authentication errors
export class AuthError extends SubscriptionError {
  constructor(
    message: string,
    code: string,
    userMessage: string = 'ログインが必要です。再度ログインしてお試しください。',
    metadata?: Record<string, any>
  ) {
    super(message, code, 'auth', 'medium', userMessage, false, metadata);
    this.name = 'AuthError';
  }
}

// Service unavailable errors
export class ServiceUnavailableError extends SubscriptionError {
  constructor(
    message: string,
    code: string = 'SERVICE_UNAVAILABLE',
    userMessage: string = 'サービスが一時的に利用できません。しばらく時間を置いてお試しください。',
    metadata?: Record<string, any>
  ) {
    super(message, code, 'service', 'critical', userMessage, true, metadata);
    this.name = 'ServiceUnavailableError';
  }
}

// Error codes enum
export const ERROR_CODES = {
  // Payment errors
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CARD_DECLINED: 'CARD_DECLINED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INVALID_CARD: 'INVALID_CARD',
  EXPIRED_CARD: 'EXPIRED_CARD',
  PAYMENT_TIMEOUT: 'PAYMENT_TIMEOUT',
  
  // Subscription errors
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_CANCELED: 'SUBSCRIPTION_CANCELED',
  TRIAL_ALREADY_USED: 'TRIAL_ALREADY_USED',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  
  // Network errors
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // Auth errors
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Validation errors
  INVALID_PLAN_ID: 'INVALID_PLAN_ID',
  INVALID_USER_ID: 'INVALID_USER_ID',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  
  // Service errors
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

// User-friendly error messages mapping
export const ERROR_MESSAGES: Record<string, string> = {
  // Payment messages
  [ERROR_CODES.PAYMENT_FAILED]: 'お支払い処理が失敗しました。カード情報を確認の上、再度お試しください。',
  [ERROR_CODES.CARD_DECLINED]: 'カードが承認されませんでした。別のカードをお試しいただくか、カード会社にお問い合わせください。',
  [ERROR_CODES.INSUFFICIENT_FUNDS]: '残高不足です。別のカードをお試しいただくか、残高をご確認ください。',
  [ERROR_CODES.INVALID_CARD]: '無効なカード情報です。カード番号、有効期限、セキュリティコードをご確認ください。',
  [ERROR_CODES.EXPIRED_CARD]: 'カードの有効期限が切れています。別のカードをお試しください。',
  [ERROR_CODES.PAYMENT_TIMEOUT]: 'お支払い処理がタイムアウトしました。しばらく時間を置いてお試しください。',
  
  // Subscription messages
  [ERROR_CODES.SUBSCRIPTION_NOT_FOUND]: 'サブスクリプション情報が見つかりません。',
  [ERROR_CODES.SUBSCRIPTION_EXPIRED]: 'サブスクリプションの期限が切れています。',
  [ERROR_CODES.SUBSCRIPTION_CANCELED]: 'サブスクリプションがキャンセルされています。',
  [ERROR_CODES.TRIAL_ALREADY_USED]: 'トライアルは既にご利用済みです。',
  [ERROR_CODES.PLAN_NOT_FOUND]: '選択されたプランが見つかりません。',
  
  // Network messages
  [ERROR_CODES.NETWORK_TIMEOUT]: 'ネットワーク接続がタイムアウトしました。インターネット接続をご確認の上、再度お試しください。',
  [ERROR_CODES.CONNECTION_FAILED]: 'サーバーとの接続に失敗しました。しばらく時間を置いてお試しください。',
  [ERROR_CODES.SERVER_ERROR]: 'サーバーでエラーが発生しました。しばらく時間を置いてお試しください。',
  
  // Auth messages
  [ERROR_CODES.AUTHENTICATION_REQUIRED]: 'ログインが必要です。',
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'この操作を行う権限がありません。',
  [ERROR_CODES.TOKEN_EXPIRED]: 'セッションが期限切れです。再度ログインしてください。',
  
  // Validation messages
  [ERROR_CODES.INVALID_PLAN_ID]: '無効なプランが選択されています。',
  [ERROR_CODES.INVALID_USER_ID]: '無効なユーザー情報です。',
  [ERROR_CODES.REQUIRED_FIELD_MISSING]: '必要な項目が入力されていません。',
  
  // Service messages
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'サービスが一時的に利用できません。しばらく時間を置いてお試しください。',
  [ERROR_CODES.MAINTENANCE_MODE]: 'システムメンテナンス中です。しばらく時間を置いてお試しください。',
  [ERROR_CODES.RATE_LIMITED]: 'リクエストが多すぎます。しばらく時間を置いてお試しください。',
};

// Error factory functions
export const createPaymentError = (
  errorCode: string,
  originalError?: Error,
  metadata?: Record<string, any>
): PaymentError => {
  const message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES[ERROR_CODES.PAYMENT_FAILED];
  
  return new PaymentError(
    originalError?.message || `Payment error: ${errorCode}`,
    errorCode,
    message,
    true,
    {
      ...metadata,
      originalError: originalError?.message,
      timestamp: new Date().toISOString(),
    }
  );
};

export const createNetworkError = (
  originalError?: Error,
  metadata?: Record<string, any>
): NetworkError => {
  return new NetworkError(
    originalError?.message || 'Network connection failed',
    ERROR_CODES.CONNECTION_FAILED,
    ERROR_MESSAGES[ERROR_CODES.CONNECTION_FAILED],
    {
      ...metadata,
      originalError: originalError?.message,
      timestamp: new Date().toISOString(),
    }
  );
};

export const createAuthError = (
  errorCode: string = ERROR_CODES.AUTHENTICATION_REQUIRED,
  originalError?: Error,
  metadata?: Record<string, any>
): AuthError => {
  const message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES[ERROR_CODES.AUTHENTICATION_REQUIRED];
  
  return new AuthError(
    originalError?.message || `Auth error: ${errorCode}`,
    errorCode,
    message,
    {
      ...metadata,
      originalError: originalError?.message,
      timestamp: new Date().toISOString(),
    }
  );
};

export const createValidationError = (
  errorCode: string,
  fieldName?: string,
  metadata?: Record<string, any>
): ValidationError => {
  const baseMessage = ERROR_MESSAGES[errorCode] || '入力内容に問題があります。';
  const message = fieldName ? `${fieldName}: ${baseMessage}` : baseMessage;
  
  return new ValidationError(
    `Validation error: ${errorCode}`,
    errorCode,
    message,
    {
      ...metadata,
      fieldName,
      timestamp: new Date().toISOString(),
    }
  );
};

// Error analyzer function
export const analyzeError = (error: unknown): SubscriptionError => {
  // If it's already a SubscriptionError, return as-is
  if (error instanceof SubscriptionError) {
    return error;
  }

  // If it's a regular Error, analyze its properties
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Check for payment errors
    if (message.includes('card') && message.includes('declined')) {
      return createPaymentError(ERROR_CODES.CARD_DECLINED, error);
    }
    
    if (message.includes('insufficient') && message.includes('fund')) {
      return createPaymentError(ERROR_CODES.INSUFFICIENT_FUNDS, error);
    }
    
    if (message.includes('expired')) {
      return createPaymentError(ERROR_CODES.EXPIRED_CARD, error);
    }
    
    if (message.includes('timeout')) {
      return createNetworkError(error);
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return createNetworkError(error);
    }
    
    if (message.includes('auth') || message.includes('unauthorized')) {
      return createAuthError(ERROR_CODES.AUTHENTICATION_REQUIRED, error);
    }
    
    if (message.includes('permission')) {
      return createAuthError(ERROR_CODES.INSUFFICIENT_PERMISSIONS, error);
    }
    
    // Default to payment error for unrecognized errors
    return createPaymentError(ERROR_CODES.PAYMENT_FAILED, error);
  }

  // For non-Error objects, create a generic error
  return new SubscriptionError(
    'Unknown error occurred',
    'UNKNOWN_ERROR',
    'subscription',
    'medium',
    '予期しないエラーが発生しました。しばらく時間を置いてお試しください。',
    true,
    { originalError: String(error), timestamp: new Date().toISOString() }
  );
};

// Error logging function
export const logSubscriptionError = (
  error: SubscriptionError,
  context?: string,
  userId?: string
): void => {
  const logData = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      category: error.category,
      severity: error.severity,
      userMessage: error.userMessage,
      retryable: error.retryable,
      metadata: error.metadata,
    },
    context,
    userId,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Subscription Error]', logData);
  }

  // In production, send to error tracking service
  // This would integrate with services like Sentry, LogRocket, etc.
  if (process.env.NODE_ENV === 'production') {
    try {
      // Example: Send to error tracking service
      // window.errorTracker?.captureError(error, logData);
      
      // For now, just log to console
      console.error('[Subscription Error]', logData);
    } catch (loggingError) {
      console.error('Failed to log subscription error:', loggingError);
    }
  }
};

// Grace period helper
export const isInGracePeriod = (
  subscriptionEndDate: Date | null,
  gracePeriodDays: number = 3
): boolean => {
  if (!subscriptionEndDate) return false;
  
  const now = new Date();
  const gracePeriodEnd = new Date(subscriptionEndDate);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
  
  return now <= gracePeriodEnd && now > subscriptionEndDate;
};

export const getGracePeriodDaysRemaining = (
  subscriptionEndDate: Date | null,
  gracePeriodDays: number = 3
): number => {
  if (!subscriptionEndDate) return 0;
  
  const now = new Date();
  const gracePeriodEnd = new Date(subscriptionEndDate);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
  
  if (now > gracePeriodEnd) return 0;
  
  const diffMs = gracePeriodEnd.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};