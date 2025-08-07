'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, MapPin, Clock, Calendar } from 'lucide-react'
import { GoldSwitch } from '@/components/ui/gold-switch'
import { Label } from '@/components/ui/label'
import { getCurrentLocation, getNearestLocationName } from '@/lib/utils/location'
import { useToast } from '@/hooks/use-toast'
import styles from './MatchingSearch.module.scss'

export default function MatchingSearch() {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTime, setSelectedTime] = useState<string>('いまから')
  const [prioritizeQuickMeet, setPrioritizeQuickMeet] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [location, setLocation] = useState('')
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)

  const personalityTags = [
    'やさしめ',
    'リード上手',
    'じっくり派',
    '甘やかし系',
    '濃密タイプ',
    'スピード重視'
  ]

  const timeTags = [
    'いまから',
    '1時間以内',
    '今夜'
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

  const handleSearch = () => {
    // Map time options to search page format
    const timeMap: { [key: string]: string } = {
      'いまから': 'now',
      '1時間以内': '1hour',
      '今夜': 'tonight'
    }

    // Build URL parameters
    const params = new URLSearchParams()
    
    if (selectedTags.length > 0) {
      params.append('tags', selectedTags.join(','))
    }
    
    if (location) {
      params.append('location', location)
    }
    
    if (selectedTime) {
      params.append('time', timeMap[selectedTime] || 'now')
    }

    if (prioritizeQuickMeet) {
      params.append('quick', 'true')
    }

    if (searchQuery) {
      params.append('q', searchQuery)
    }

    // Navigate to advanced search page with parameters
    router.push(`/search/advanced?${params.toString()}`)
  }

  return (
    <div className="w-full">
      {/* Main search section */}
      <div className={`${styles.searchContainer} rounded-3xl p-8 md:p-10 shadow-2xl border`}>
        <h2 className={`text-2xl md:text-3xl font-bold ${styles.textPrimary} text-center mb-8`}>
          性癖が合う嬢を探す？
        </h2>

        {/* Personality tags */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {personalityTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`btn-custom ${styles.tagButton} ${selectedTags.includes(tag) ? styles.selected : ''}`}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: selectedTags.includes(tag) ? '600' : '500',
                  transition: 'all 0.3s',
                  border: '1px solid'
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
            <Search 
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#D4AF37] w-5 h-5" 
            />
            <Input
              type="text"
              placeholder="もっと詳しく検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 ${styles.inputField} h-14 rounded-2xl focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20 transition-all`}
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
                className={`${styles.inputField} h-14 rounded-2xl focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20 transition-all`}
              />
            </div>
            <Button
              onClick={handleGetCurrentLocation}
              variant="outline"
              className={`btn-custom ${styles.locationButton}`}
              disabled={isLoadingLocation}
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
                className={`btn-custom ${styles.tagButton} ${selectedTime === tag ? styles.selected : ''}`}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: selectedTime === tag ? '600' : '500',
                  transition: 'all 0.3s',
                  border: '1px solid',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                {tag === 'いまから' && <Clock className="inline w-3 h-3 mr-1" />}
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Priority toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-3">
            <GoldSwitch
              id="quick-meet"
              checked={prioritizeQuickMeet}
              onCheckedChange={setPrioritizeQuickMeet}
            />
            <Label htmlFor="quick-meet" className={`${styles.textSecondary} cursor-pointer`}>
              すぐ会える相手を優先
            </Label>
          </div>
        </div>

        {/* Search button */}
        <div className="text-center mb-3">
          <Button
            className={`btn-primary ${styles.primaryButton}`}
            onClick={handleSearch}
          >
            候補を見る（無料）
          </Button>
        </div>

        <p className={`text-sm ${styles.textSecondary} text-center mt-6`}>
          登録後、入力した性癖と条件を引き継いで候補を表示します。
        </p>
      </div>
    </div>
  )
}