"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

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
    // Firebase permission error
    if (error.message.includes('Missing or insufficient permissions')) {
      return {
        hasError: true,
        error: new Error('アクセス権限がありません。ログインし直すか、しばらくお待ちください。')
      };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
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