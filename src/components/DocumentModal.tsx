'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onFullyRead: () => void;
  documentType: 'terms' | 'privacy';
}

export default function DocumentModal({
  isOpen,
  onClose,
  title,
  content,
  onFullyRead,
  documentType
}: DocumentModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHasScrolledToBottom(false);
    }
  }, [isOpen]);

  const handleScroll = () => {
    if (!scrollRef.current || !contentRef.current) return;

    const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollElement) return;

    const scrollTop = scrollElement.scrollTop;
    const scrollHeight = scrollElement.scrollHeight;
    const clientHeight = scrollElement.clientHeight;

    // Check if user has scrolled to within 50px of the bottom
    if (scrollHeight - scrollTop - clientHeight < 50) {
      if (!hasScrolledToBottom) {
        setHasScrolledToBottom(true);
        onFullyRead();
      }
    }
  };

  const handleClose = () => {
    if (!hasScrolledToBottom) {
      alert(`${title}を最後まで読んでください。`);
      return;
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <ScrollArea 
          ref={scrollRef}
          className="h-[60vh] px-6 py-4"
          onScrollCapture={handleScroll}
        >
          <div ref={contentRef} className="prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t bg-gray-50">
          {!hasScrolledToBottom && (
            <div className="flex items-center gap-2 text-sm text-amber-600 mb-3">
              <AlertCircle className="h-4 w-4" />
              <span>最後までスクロールしてお読みください</span>
            </div>
          )}
          
          <Button 
            onClick={handleClose}
            disabled={!hasScrolledToBottom}
            className="w-full"
          >
            {hasScrolledToBottom ? '閉じる' : '最後まで読んでから閉じる'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}