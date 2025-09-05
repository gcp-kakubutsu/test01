'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

interface CampaignBannerProps {
  onClose?: () => void;
}

export function CampaignBanner({ onClose }: CampaignBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const handleImageClick = () => {
    // バナークリックでサインアップページへ遷移
    window.location.href = '/signup';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      
      {/* Banner Image */}
      <div className="relative max-w-md w-full">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute -top-2 -right-2 z-20 p-2 rounded-full bg-white shadow-lg hover:bg-gray-100 transition-colors"
          aria-label="閉じる"
        >
          <X className="w-5 h-5 text-gray-800" />
        </button>

        {/* Clickable banner image */}
        <div 
          className="cursor-pointer rounded-lg overflow-hidden shadow-2xl"
          onClick={handleImageClick}
        >
          <Image 
            src="/img/banner.webp" 
            alt="キャンペーンバナー" 
            width={400}
            height={600}
            className="w-full h-auto object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
}