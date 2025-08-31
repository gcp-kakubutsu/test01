/**
 * Error Toast Component for Subscription System
 * Provides user-friendly error notifications with retry capabilities
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, RefreshCw, AlertCircle, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SubscriptionError } from '@/lib/errors/subscriptionErrors';

interface ErrorToastProps {
  error: SubscriptionError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorToast({ 
  error, 
  onRetry, 
  onDismiss, 
  className,
  compact = false 
}: ErrorToastProps) {
  const getIcon = () => {
    switch (error.category) {
      case 'network':
        return <WifiOff className="h-5 w-5" />;
      case 'payment':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getSeverityColor = () => {
    switch (error.severity) {
      case 'low':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'medium':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'high':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'critical':
        return 'bg-red-100 border-red-300 text-red-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIconColor = () => {
    switch (error.severity) {
      case 'low':
        return 'text-yellow-600';
      case 'medium':
        return 'text-orange-600';
      case 'high':
        return 'text-red-600';
      case 'critical':
        return 'text-red-700';
      default:
        return 'text-gray-600';
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm",
          getSeverityColor(),
          className
        )}
      >
        <div className={cn("flex-shrink-0", getIconColor())}>
          {getIcon()}
        </div>
        <span className="flex-1 font-medium">{error.userMessage}</span>
        {error.retryable && onRetry && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRetry}
            className="h-6 w-6 p-0 hover:bg-white/20"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-6 w-6 p-0 hover:bg-white/20"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border p-4 shadow-lg",
        getSeverityColor(),
        className
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Close button */}
      {onDismiss && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-white/20"
          aria-label="エラーを閉じる"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <div className="flex gap-3">
        {/* Error icon */}
        <div className={cn("flex-shrink-0", getIconColor())}>
          {getIcon()}
        </div>

        <div className="flex-1 space-y-2">
          {/* Error title */}
          <div className="font-semibold">
            {error.category === 'payment' && 'お支払いエラー'}
            {error.category === 'network' && 'ネットワークエラー'}
            {error.category === 'auth' && '認証エラー'}
            {error.category === 'validation' && '入力エラー'}
            {error.category === 'service' && 'サービスエラー'}
            {!['payment', 'network', 'auth', 'validation', 'service'].includes(error.category) && 'エラー'}
          </div>

          {/* Error message */}
          <div className="text-sm leading-relaxed">
            {error.userMessage}
          </div>

          {/* Additional information for specific error types */}
          {error.code === 'CARD_DECLINED' && (
            <div className="text-xs bg-white/50 rounded p-2 mt-2">
              <p className="font-medium">対処方法：</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>カード情報（番号、有効期限、セキュリティコード）を確認</li>
                <li>別のカードをお試しください</li>
                <li>カード会社にお問い合わせください</li>
              </ul>
            </div>
          )}

          {error.category === 'network' && (
            <div className="text-xs bg-white/50 rounded p-2 mt-2">
              <p className="font-medium">対処方法：</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>インターネット接続を確認してください</li>
                <li>しばらく時間を置いてお試しください</li>
                <li>ページを再読み込みしてください</li>
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {error.retryable && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="bg-white/80 hover:bg-white border-current text-current"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                再試行
              </Button>
            )}

            {error.category === 'payment' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open('/support', '_blank')}
                className="bg-white/80 hover:bg-white border-current text-current"
              >
                サポートに問い合わせ
              </Button>
            )}
          </div>

          {/* Error code for debugging (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs opacity-60 mt-2 font-mono">
              エラーコード: {error.code}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook for managing error toast state
export function useErrorToast() {
  const [error, setError] = React.useState<SubscriptionError | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  const showError = React.useCallback((newError: SubscriptionError) => {
    setError(newError);
    setIsVisible(true);
  }, []);

  const hideError = React.useCallback(() => {
    setIsVisible(false);
    // Keep error for potential retry
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
    setIsVisible(false);
  }, []);

  const retryLastAction = React.useCallback(() => {
    // This would be implemented by the calling component
    hideError();
  }, [hideError]);

  return {
    error,
    isVisible,
    showError,
    hideError,
    clearError,
    retryLastAction,
  };
}

// Toast container component for global error display
interface ErrorToastContainerProps {
  children: React.ReactNode;
}

export function ErrorToastContainer({ children }: ErrorToastContainerProps) {
  return (
    <div className="relative">
      {children}
      {/* Global error toast portal */}
      <div
        id="error-toast-portal"
        className="fixed top-4 right-4 z-50 space-y-2 max-w-md"
        aria-live="polite"
        aria-atomic="false"
      />
    </div>
  );
}