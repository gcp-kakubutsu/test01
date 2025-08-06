'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, MapPin, Clock, Calendar, Bot } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { getCurrentLocation, getNearestLocationName } from '@/lib/utils/location'
import { useToast } from '@/hooks/use-toast'

export default function MatchingSearch() {
  const { toast } = useToast()
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTime, setSelectedTime] = useState<string>('いまから')
  const [prioritizeQuickMeet, setPrioritizeQuickMeet] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [location, setLocation] = useState('')
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)

  const personalityTags = [
    'やさしめ',
    'リード上手',
    'じっくり派',
    '甘やかし系',
    '濃密タイプ',
    'スピード重視',
    '受け身好き',
    '主導タイプ'
  ]

  const timeTags = [
    'いまから',
    '1時間以内',
    '今夜',
    '日時を指定'
  ]

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleGetCurrentLocation = async () => {
    setIsLoadingLocation(true)
    setLocation('取得中...')
    
    try {
      const locationInfo = await getCurrentLocation()
      
      if (locationInfo.coordinates) {
        const { lat, lng } = locationInfo.coordinates
        
        // 詳細な住所が取得できた場合はそれを使用、できない場合は最寄りの地域名を使用
        const locationName = locationInfo.address || getNearestLocationName(lat, lng)
        
        setLocation(locationName)
        toast({
          title: "位置情報を取得しました",
          description: `${locationName}周辺で検索します。`,
        })
      } else if (locationInfo.error) {
        setLocation('')
        toast({
          title: "位置情報の取得に失敗",
          description: locationInfo.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      setLocation('')
      toast({
        title: "エラー",
        description: "位置情報の取得中にエラーが発生しました。",
        variant: "destructive",
      })
    } finally {
      setIsLoadingLocation(false)
    }
  }

  return (
    <div className="w-full">
      {/* Main search section */}
      <div className="bg-[#0f1419] rounded-3xl p-8 md:p-10 shadow-2xl border border-[#1f2937]/30">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-8">
          性癖が合う嬢を探す？
        </h2>

        {/* Personality tags */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {personalityTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="btn-custom"
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: selectedTags.includes(tag) ? '600' : '500',
                  transition: 'all 0.3s',
                  backgroundColor: selectedTags.includes(tag) ? '#D4AF37' : 'transparent',
                  color: selectedTags.includes(tag) ? '#0f1419' : '#9ca3af',
                  border: selectedTags.includes(tag) ? '1px solid #D4AF37' : '1px solid #3f4852'
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#D4AF37] w-5 h-5" />
            <Input
              type="text"
              placeholder="もっと詳しく検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#1f2937] border-[#3f4852] text-white placeholder-gray-500 h-14 rounded-2xl focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20 transition-all"
            />
          </div>
        </div>

        {/* Location input */}
        <div className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="現在地または地域名を入力"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-[#1f2937] border-[#3f4852] text-white placeholder-gray-500 h-14 rounded-2xl focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20 transition-all"
              />
            </div>
            <Button
              onClick={handleGetCurrentLocation}
              variant="outline"
              className="btn-custom"
              style={{
                backgroundColor: 'transparent',
                color: '#D4AF37',
                border: '2px solid #D4AF37',
                fontWeight: 'bold',
                padding: '0 1.5rem',
                height: '3.5rem',
                borderRadius: '1rem',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <MapPin className="w-4 h-4 mr-2" />
              現在地を使う
            </Button>
          </div>
        </div>

        {/* Time selection */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {timeTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTime(tag)}
                className="btn-custom"
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: selectedTime === tag ? '600' : '500',
                  transition: 'all 0.3s',
                  backgroundColor: selectedTime === tag ? '#D4AF37' : 'transparent',
                  color: selectedTime === tag ? '#0f1419' : '#9ca3af',
                  border: selectedTime === tag ? '1px solid #D4AF37' : '1px solid #3f4852',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                {tag === 'いまから' && <Clock className="inline w-3 h-3 mr-1" />}
                {tag === '日時を指定' && <Calendar className="inline w-3 h-3 mr-1" />}
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Priority toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-3">
            <Switch
              id="quick-meet"
              checked={prioritizeQuickMeet}
              onCheckedChange={setPrioritizeQuickMeet}
              className="data-[state=checked]:bg-[#8b7d47] data-[state=unchecked]:bg-[#3f4852]"
            />
            <Label htmlFor="quick-meet" className="text-gray-300 cursor-pointer">
              すぐ会える相手を優先
            </Label>
          </div>
        </div>

        {/* Search button */}
        <div className="text-center mb-3">
          <Button
            className="btn-primary"
            style={{
              backgroundColor: '#c73b68',
              color: 'white',
              fontWeight: 'bold',
              padding: '1.25rem 4rem',
              borderRadius: '9999px',
              fontSize: '1.125rem',
              transition: 'all 0.3s',
              border: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b02958'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#c73b68'}
          >
            候補を見る（無料）
          </Button>
        </div>

        <p className="text-sm text-gray-400 text-center mt-6">
          登録後、入力した性癖と条件を引き継いで候補を表示します。
        </p>
      </div>

      {/* AI Assistant section */}
      <div className="bg-[#0f1419] rounded-3xl p-8 md:p-10 shadow-2xl border border-[#1f2937]/30 mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#D4AF37] p-3 rounded-full">
            <Bot className="w-6 h-6 text-[#1a1f2e]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              AIマッチングアシスタント
            </h3>
            <p className="text-sm text-gray-400">
              あなたの理想の相手を見つけるお手伝いをします
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#1f2937] rounded-xl p-4 border border-[#3f4852]">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="メッセージを入力..."
                className="flex-1 bg-[#0f1419] border-[#3f4852] text-white placeholder-gray-500 rounded-xl"
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-[#d73a6a] hover:text-[#c02952] hover:bg-[#d73a6a]/10 rounded-xl"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </Button>
            </div>
          </div>

          <Button
            className="btn-custom"
            style={{
              backgroundColor: '#D4AF37',
              color: '#0f1419',
              fontWeight: 'bold',
              padding: '0.75rem',
              borderRadius: '0.75rem',
              boxShadow: '0 10px 15px -3px rgba(212, 175, 55, 0.2)',
              transition: 'all 0.3s',
              border: 'none',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.9)';
              e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(212, 175, 55, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#D4AF37';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(212, 175, 55, 0.2)';
            }}
          >
            <Bot className="w-4 h-4 mr-2" />
            AIと相談を開始する
          </Button>
        </div>
      </div>
    </div>
  )
}