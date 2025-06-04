"use client";

import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';

interface WelcomePageProps {
  onComplete: () => void;
  onStartOnboarding?: () => void;
}

export default function WelcomePage({ onComplete, onStartOnboarding }: WelcomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0306A] via-[#FF69B4] to-[#FF1493] flex flex-col items-center justify-center p-6 text-white">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">
          ようこそ、Nukuneへ
        </h1>
        
        {/* Illustration Area */}
        <div className="relative my-12 flex justify-center items-center">
          {/* Hearts floating around */}
          <div className="absolute -top-4 -left-8 animate-bounce delay-100">
            <Heart className="h-8 w-8 fill-current text-red-400 opacity-80" />
          </div>
          <div className="absolute -top-8 right-4 animate-bounce delay-300">
            <Heart className="h-6 w-6 fill-current text-orange-300 opacity-70" />
          </div>
          <div className="absolute -bottom-2 -right-6 animate-bounce delay-500">
            <Heart className="h-5 w-5 fill-current text-pink-300 opacity-60" />
          </div>
          
          {/* Main illustration placeholder - could be replaced with actual SVG/image */}
          <div className="relative">
            {/* Decorative leaves/plants */}
            <div className="absolute -left-12 top-8 w-16 h-20 bg-gradient-to-br from-orange-300 to-red-400 rounded-full opacity-80 transform rotate-12"></div>
            <div className="absolute -right-12 top-12 w-12 h-16 bg-gradient-to-br from-pink-300 to-orange-400 rounded-full opacity-70 transform -rotate-12"></div>
            
            {/* People silhouettes */}
            <div className="flex items-center justify-center space-x-8">
              {/* Male figure */}
              <div className="relative">
                <div className="w-16 h-16 bg-white rounded-full mb-2"></div>
                <div className="w-12 h-20 bg-white rounded-t-lg mx-auto"></div>
                <div className="w-8 h-12 bg-white rounded-lg mx-auto -mt-2"></div>
              </div>
              
              {/* Female figure */}
              <div className="relative">
                <div className="w-16 h-16 bg-white rounded-full mb-2"></div>
                <div className="w-12 h-20 bg-white rounded-t-lg mx-auto"></div>
                <div className="w-10 h-16 bg-white rounded-full mx-auto -mt-4"></div>
              </div>
            </div>
            
            {/* More decorative elements */}
            <div className="absolute -bottom-8 left-4 w-8 h-12 bg-gradient-to-t from-green-400 to-teal-400 rounded-full opacity-60"></div>
            <div className="absolute -bottom-6 right-8 w-6 h-10 bg-gradient-to-t from-blue-400 to-purple-400 rounded-full opacity-50"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md text-center space-y-8 mb-12">
        <div className="space-y-4">
          <p className="text-lg leading-relaxed">
            私たちは、<br />
            オープンで思いやりのあるセクシュアルな関係を<br />
            構築できるコミュニティを目指して、<br />
            このサービスを立ち上げました。
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-base leading-relaxed">
            このサービスを通じて<br />
            性的指向や性自認に関わらず、<br />
            心も体も満たされるような素敵な出会いを<br />
            見つけてほしいと願っています。
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-base leading-relaxed">
            好奇心あふれる皆さんが、深いつながりを築き、<br />
            新しい発見を楽しむことができる場を提供します。
          </p>
        </div>
      </div>

      {/* CTA Button */}
      <div className="w-full max-w-sm mb-8">
        <Button
          onClick={onStartOnboarding || onComplete}
          className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white border-2 border-white/30 rounded-full py-4 text-lg font-semibold transition-all duration-300 shadow-lg"
        >
          はじめる
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center text-sm opacity-90 max-w-sm">
        <p className="leading-relaxed">
          Nukuneでは安全で信頼できる環境を提供するために、<br />
          本人確認のご協力をお願いしています。
        </p>
      </div>

      {/* Floating hearts animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 animate-ping delay-1000">
          <Heart className="h-3 w-3 fill-current text-white opacity-30" />
        </div>
        <div className="absolute top-1/3 right-1/3 animate-ping delay-2000">
          <Heart className="h-4 w-4 fill-current text-pink-200 opacity-40" />
        </div>
        <div className="absolute bottom-1/4 left-1/3 animate-ping delay-3000">
          <Heart className="h-3 w-3 fill-current text-red-200 opacity-35" />
        </div>
      </div>
    </div>
  );
}