'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, MapPin, Clock, User, Ruler, Heart, Sparkles, Settings } from 'lucide-react'
import { GoldSwitch } from '@/components/ui/gold-switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiSelect, type Option } from '@/components/ui/multi-select'
import { getCurrentLocation, getNearestLocationName } from '@/lib/utils/location'
import { useToast } from '@/hooks/use-toast'
import styles from './MatchingSearch.module.scss'
import { useGirlSearch } from '@/lib/hooks/useGirlSearch'
import { useAuth } from '@/contexts/AuthContext'
import { getMalePreferences } from '@/lib/firebase/malePreferences'

export default function MatchingSearch() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentUser } = useAuth()
  const { girls, loading: searchLoading, error: searchError, searchGirlsByPreferences } = useGirlSearch()
  const [selectedAge, setSelectedAge] = useState<string>('')
  const [selectedHeight, setSelectedHeight] = useState<string>('')
  const [selectedBust, setSelectedBust] = useState<string>('')
  const [selectedDrinking, setSelectedDrinking] = useState<string>('')
  const [selectedSmoking, setSelectedSmoking] = useState<string>('')
  const [selectedGirlTypes, setSelectedGirlTypes] = useState<string[]>([])
  const [girlTypeOptions, setGirlTypeOptions] = useState<Option[]>([])
  const [selectedTime, setSelectedTime] = useState<string>('いまから')
  const [prioritizeQuickMeet, setPrioritizeQuickMeet] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [location, setLocation] = useState('')
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [hasPreferences, setHasPreferences] = useState(false)

  const ageOptions = ['10代', '20代', '30代', '40代', '50代']
  const heightOptions = ['身長150cm以下', '身長155cm以下', '身長160cm以下', '身長165cm以上']
  const bustOptions = ['Bカップ以下', 'Cカップ', 'Dカップ', 'Eカップ', 'Fカップ', 'Gカップ以上']
  const drinkingOptions = ['お酒を飲む人', 'お酒を飲まない人']
  const smokingOptions = ['タバコを吸う人', 'タバコを吸わない人']

  const timeTags = [
    'いまから',
    '1時間以内',
    '今夜'
  ]

  // Check if user has preferences set
  useEffect(() => {
    const checkPreferences = async () => {
      if (currentUser) {
        try {
          const prefs = await getMalePreferences(currentUser.uid)
          setHasPreferences(prefs?.isComplete === true && prefs?.girlTypeIds?.length > 0)
        } catch (error) {
          console.error('Failed to check preferences:', error)
        }
      }
    }
    checkPreferences()
  }, [currentUser])

  // Fetch girl types on component mount
  useEffect(() => {
    const fetchGirlTypes = async () => {
      try {
        const response = await fetch('/api/girl-types')
        const data = await response.json()
        
        // Convert to options format for multi-select - use name as both value and label
        // Sort by class_id and then by id to maintain consistent order
        const options: Option[] = data.allTypes
          .sort((a: any, b: any) => {
            if (a.class_id !== b.class_id) {
              return a.class_id - b.class_id;
            }
            return a.id - b.id;
          })
          .map((type: any) => ({
            value: type.name,
            label: type.name
          }))
        
        setGirlTypeOptions(options)
      } catch (error) {
        console.error('Failed to fetch girl types:', error)
      }
    }
    
    fetchGirlTypes()
  }, [])


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
    
    const selectedTags = []
    if (selectedAge) selectedTags.push(selectedAge)
    if (selectedHeight) selectedTags.push(selectedHeight)
    if (selectedBust) selectedTags.push(selectedBust)
    if (selectedDrinking) selectedTags.push(selectedDrinking)
    if (selectedSmoking) selectedTags.push(selectedSmoking)
    
    if (selectedTags.length > 0) {
      params.append('tags', selectedTags.join(','))
    }
    
    if (selectedGirlTypes.length > 0) {
      params.append('girlTypes', selectedGirlTypes.join(','))
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

  const handlePreferenceSearch = async () => {
    if (!currentUser) {
      toast({
        title: "ログインが必要です",
        description: "この機能を使用するにはログインしてください。",
        variant: "destructive",
      })
      router.push('/login')
      return
    }

    if (!hasPreferences) {
      toast({
        title: "詳細設定が必要です",
        description: "まずプロフィールの詳細設定を完了してください。",
        variant: "destructive",
      })
      router.push('/profile/preferences')
      return
    }

    // Search using preferences and navigate to results
    await searchGirlsByPreferences()
    
    // Navigate to search results page with special flag
    router.push('/search/advanced?preferenceSearch=true')
  }

  return (
    <div className="w-full">
      {/* Main search section */}
      <div className={`${styles.searchContainer} rounded-3xl p-8 md:p-10 shadow-2xl border`}>
        <h2 className={`text-2xl md:text-3xl font-bold ${styles.textPrimary} text-center mb-8`}>
          理想の嬢を詳細検索
        </h2>

        {/* Preference selectors */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Age selector */}
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1 text-sm font-medium">
                <User className="w-4 h-4 text-[#D4AF37]" />
                <span>年齢</span>
              </Label>
              <Select value={selectedAge} onValueChange={setSelectedAge}>
                <SelectTrigger className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/50">
                  <SelectValue placeholder="下限なし 〜 上限なし" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">下限なし 〜 上限なし</SelectItem>
                  {ageOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Height selector */}
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1 text-sm font-medium">
                <Ruler className="w-4 h-4 text-[#D4AF37]" />
                <span>身長</span>
              </Label>
              <Select value={selectedHeight} onValueChange={setSelectedHeight}>
                <SelectTrigger className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/50">
                  <SelectValue placeholder="下限なし 〜 上限なし" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">下限なし 〜 上限なし</SelectItem>
                  {heightOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bust selector */}
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1 text-sm font-medium">
                <Heart className="w-4 h-4 text-[#D4AF37]" />
                <span>バスト</span>
              </Label>
              <Select value={selectedBust} onValueChange={setSelectedBust}>
                <SelectTrigger className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/50">
                  <SelectValue placeholder="指定なし" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">指定なし</SelectItem>
                  {bustOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drinking preference selector */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">
                🍺 お酒
              </Label>
              <Select value={selectedDrinking} onValueChange={setSelectedDrinking}>
                <SelectTrigger className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/50">
                  <SelectValue placeholder="指定なし" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">指定なし</SelectItem>
                  {drinkingOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Smoking preference selector */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">
                🚬 タバコ
              </Label>
              <Select value={selectedSmoking} onValueChange={setSelectedSmoking}>
                <SelectTrigger className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/50">
                  <SelectValue placeholder="指定なし" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">指定なし</SelectItem>
                  {smokingOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time selector moved to grid */}
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1 text-sm font-medium">
                <Clock className="w-4 h-4 text-[#D4AF37]" />
                <span>希望日時</span>
              </Label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger className="h-12 rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeTags.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Girl types multi-select */}
        <div className="mb-6">
          <Label className="flex items-center gap-1 text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span>タイプで絞り込み（複数選択可）</span>
          </Label>
          <MultiSelect
            options={girlTypeOptions}
            selected={selectedGirlTypes}
            onChange={setSelectedGirlTypes}
            placeholder="明るい、癒し系、巨乳など..."
            className="rounded-xl border-[#D4AF37]/20 focus:border-[#D4AF37]/50"
            maxDisplay={5}
          />
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

        {/* Search buttons */}
        <div className="flex flex-col gap-3 mb-3">
          {/* Normal search */}
          <Button
            className={`btn-primary ${styles.primaryButton} w-full`}
            onClick={handleSearch}
          >
            <Search className="w-4 h-4 mr-2" />
            候補を見る（無料）
          </Button>
          
          {/* Preference-based search */}
          {currentUser && (
            <Button
              className={`${styles.secondaryButton} w-full`}
              onClick={handlePreferenceSearch}
              variant="outline"
              disabled={searchLoading}
            >
              <Settings className="w-4 h-4 mr-2" />
              {searchLoading ? '検索中...' : 'あなたの詳細設定で検索'}
            </Button>
          )}
        </div>

        <p className={`text-sm ${styles.textSecondary} text-center mt-6`}>
          {hasPreferences 
            ? '詳細設定に基づいて、あなたに最適な女の子を検索します。'
            : '登録後、入力した性癖と条件を引き継いで候補を表示します。'}
        </p>
      </div>
    </div>
  )
}