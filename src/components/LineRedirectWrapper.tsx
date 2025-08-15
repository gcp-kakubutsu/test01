"use client";

import { useEffect, useState } from 'react';
import { isLineApp } from '@/lib/utils/browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, AlertCircle } from 'lucide-react';

export function LineRedirectWrapper({ children }: { children: React.ReactNode }) {
  const [isLine, setIsLine] = useState(false);
  const [showRedirect, setShowRedirect] = useState(false);
  const [hasAttemptedAuth, setHasAttemptedAuth] = useState(false);

  useEffect(() => {
    const lineApp = isLineApp();
    setIsLine(lineApp);
    
    if (lineApp) {
      // Check if user has attempted auth but failed
      const authAttempted = sessionStorage.getItem('lineAuthAttempted');
      if (authAttempted) {
        setShowRedirect(true);
        setHasAttemptedAuth(true);
      }
    }
  }, []);

  const handleOpenInBrowser = () => {
    const currentUrl = window.location.href;
    // This will prompt LINE to open in external browser
    window.location.href = `https://line.me/R/msg/text/?${encodeURIComponent('Nukuneを開く\n' + currentUrl)}`;
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('URLをコピーしました。SafariやChromeで開いてください。');
  };

  const handleContinueAnyway = () => {
    sessionStorage.setItem('lineAuthAttempted', 'true');
    setShowRedirect(false);
  };

  // Show redirect suggestion for LINE browser users who have auth issues
  if (isLine && showRedirect) {
    return (
      <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-yellow-600 mb-2">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">LINEブラウザをご利用中です</span>
            </div>
            <CardTitle>標準ブラウザでの利用を推奨</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              LINEブラウザでは一部機能が制限される場合があります。
              より快適にご利用いただくため、SafariやChromeなどの標準ブラウザでの利用をお勧めします。
            </p>
            
            <div className="space-y-2">
              <Button 
                onClick={handleOpenInBrowser}
                className="w-full bg-[#06C755] hover:bg-[#05a847] text-white"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                標準ブラウザで開く
              </Button>
              
              <Button 
                onClick={handleCopyUrl}
                variant="outline"
                className="w-full"
              >
                URLをコピー
              </Button>
              
              <Button 
                onClick={handleContinueAnyway}
                variant="ghost"
                className="w-full text-sm text-gray-500"
              >
                このまま続ける
              </Button>
            </div>
            
            <div className="text-xs text-gray-500 space-y-1">
              <p>※ LINEブラウザで続ける場合：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>ログイン状態が保持されない場合があります</li>
                <li>一部の機能が利用できない場合があります</li>
                <li>画像アップロードが制限される場合があります</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}