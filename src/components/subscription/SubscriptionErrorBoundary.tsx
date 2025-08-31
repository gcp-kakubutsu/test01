/**
 * Subscription Error Boundary
 * Catches and handles React errors within subscription components
 */

import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Mail } from 'lucide-react';
import { logSubscriptionError, SubscriptionError } from '@/lib/errors/subscriptionErrors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class SubscriptionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate a unique error ID for tracking
    const errorId = `sub_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error
    const subscriptionError = new SubscriptionError(
      error.message,
      'REACT_ERROR',
      'ui',
      'high',
      'アプリでエラーが発生しました。ページを再読み込みしてお試しください。',
      true,
      {
        errorId: this.state.errorId,
        componentStack: errorInfo.componentStack,
        errorBoundary: 'SubscriptionErrorBoundary',
      }
    );

    logSubscriptionError(subscriptionError, 'React Error Boundary');
    
    // Call the onError prop if provided
    this.props.onError?.(error, errorInfo);

    // In production, report to error tracking service
    if (process.env.NODE_ENV === 'production') {
      try {
        // Example: Send to error tracking service
        // window.errorTracker?.captureException(error, {
        //   tags: { component: 'SubscriptionErrorBoundary' },
        //   extra: { errorInfo, errorId: this.state.errorId }
        // });
      } catch (reportingError) {
        console.error('Failed to report error to tracking service:', reportingError);
      }
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleContactSupport = () => {
    const errorDetails = this.state.errorId ? 
      `エラーID: ${this.state.errorId}\n\n` : '';
    
    const subject = encodeURIComponent('サブスクリプション機能でエラーが発生しました');
    const body = encodeURIComponent(
      `${errorDetails}エラーの詳細を教えてください：\n\n` +
      `発生日時: ${new Date().toLocaleString('ja-JP')}\n` +
      `ページ: ${window.location.href}\n` +
      `ブラウザ: ${navigator.userAgent}\n\n` +
      `何をしていた時にエラーが発生しましたか？\n\n`
    );
    
    window.open(`mailto:support@nukune.com?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="border-red-200 bg-red-50 max-w-lg mx-auto">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-full">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-red-900">
                  アプリケーションエラー
                </CardTitle>
                <CardDescription className="text-red-700">
                  サブスクリプション機能でエラーが発生しました
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-red-800 leading-relaxed">
                申し訳ございません。予期しないエラーが発生しました。
                以下のボタンから復旧をお試しいただくか、
                問題が継続する場合はサポートまでお問い合わせください。
              </p>
            </div>

            {/* Error details for development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-3">
                <h4 className="font-medium text-red-900 mb-2">開発情報:</h4>
                <pre className="text-xs text-red-800 whitespace-pre-wrap font-mono">
                  {this.state.error.message}
                </pre>
                {this.state.errorId && (
                  <p className="text-xs text-red-600 mt-2">
                    Error ID: {this.state.errorId}
                  </p>
                )}
              </div>
            )}

            {/* Error ID for production */}
            {process.env.NODE_ENV === 'production' && this.state.errorId && (
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-600">
                  エラーID: <code className="font-mono">{this.state.errorId}</code>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  お問い合わせの際は、このエラーIDをお知らせください。
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={this.handleRetry}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                再試行
              </Button>
              
              <Button
                variant="outline"
                onClick={this.handleReload}
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                ページを再読み込み
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <Home className="h-4 w-4 mr-2" />
                ホームに戻る
              </Button>
              
              <Button
                variant="outline"
                onClick={this.handleContactSupport}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <Mail className="h-4 w-4 mr-2" />
                サポートに連絡
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export function withSubscriptionErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <SubscriptionErrorBoundary fallback={fallback}>
      <Component {...props} />
    </SubscriptionErrorBoundary>
  );

  WrappedComponent.displayName = `withSubscriptionErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manually reporting errors from components
export function useErrorReporting() {
  const reportError = React.useCallback((error: Error, context?: string, metadata?: Record<string, any>) => {
    const subscriptionError = new SubscriptionError(
      error.message,
      'MANUAL_REPORT',
      'ui',
      'medium',
      'エラーが報告されました',
      false,
      {
        ...metadata,
        context,
        reportedAt: new Date().toISOString(),
      }
    );

    logSubscriptionError(subscriptionError, context);
  }, []);

  return { reportError };
}