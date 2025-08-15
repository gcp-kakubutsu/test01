"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { isLineApp } from '@/lib/utils/browser';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Firebase permission error - don't show error for unauthenticated users
    if (error.message.includes('Missing or insufficient permissions')) {
      // Check if we're in LINE browser
      const inLineApp = typeof window !== 'undefined' && isLineApp();
      
      // In LINE browser or for permission errors, don't show error boundary
      if (inLineApp) {
        console.log('Permission error in LINE browser, suppressing error boundary');
        return { hasError: false, error: null };
      }
      
      return {
        hasError: true,
        error: new Error('アクセス権限がありません。ログインし直すか、しばらくお待ちください。')
      };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Check if we're in LINE browser
    const inLineApp = typeof window !== 'undefined' && isLineApp();
    
    // Log error with browser info
    console.error('ErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      inLineApp,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
      errorInfo
    });
    
    // Special handling for LINE browser
    if (inLineApp) {
      console.log('Error occurred in LINE browser, applying compatibility mode');
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-black">
          <Card className="max-w-md w-full p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">エラーが発生しました</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {this.state.error?.message || '予期しないエラーが発生しました。'}
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                ページを再読み込み
              </Button>
              <Button
                variant="outline"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full"
              >
                再試行
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}