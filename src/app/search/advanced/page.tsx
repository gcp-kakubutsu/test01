'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Heart, MessageCircle, MapPin, Clock, Filter, Grid3x3, List, Search, Check, ChevronsUpDown } from 'lucide-react'
// Removed direct import - will fetch via API
import { sendLike } from '@/lib/firebase/actions'
import { useToast } from '@/hooks/use-toast'
import { getCurrentLocation, sortUsersByDistance, type LocationCoordinates } from '@/lib/utils/location'
import { getLocationCoordinates } from '@/lib/utils/japanLocations'
import { useUserProfile } from '@/lib/firebase/hooks'
import { useSubscription } from '@/hooks/useSubscription'
import Image from 'next/image'
import styles from './search.module.scss'
import './search-dialog.css'

interface UserProfile {
  id: string
  name: string
  age: number
  height?: number
  bust?: number
  cup?: string
  waist?: number
  hip?: number
  location: string
  bio: string
  interests: string[]
  imageUrl: string
  bodyType?: string
  style?: string
  distance?: number
  isOnline?: boolean
  lastActive?: string
  is_sake?: boolean
  is_tobacco?: boolean
  createdAt?: string
  matchScore?: number // おすすめ度スコア
  isGirlProfile?: boolean // MySQLの女の子データかどうか
}

// 性癖・プレイスタイルのタグ
const personalityTags = [
  '10代', '20代', '30代', '40代', '50代',
  '身長150cm以下', '身長155cm以下', '身長160cm以下',
  '身長165cm以上',
  'Bカップ以下', 'Cカップ', 'Dカップ', 'Eカップ',
  'Fカップ', 'Gカップ以上',
  'お酒を飲む人', 'お酒を飲まない人', 'タバコを吸う人', 'タバコを吸わない人'
]


// スタイルオプション
const styleTypes = ['清楚系', 'ギャル系', 'お姉さん系', '妹系', '人妻系', 'モデル系']

// 時間オプション
const timeOptions = [
  { value: 'now', label: 'いまから' },
  { value: '1hour', label: '1時間以内' },
  { value: 'tonight', label: '今夜' }
]

interface AreaData {
  prefecture_id?: number
  prefecture_name: string
  municipality_id?: number
  municipality_name?: string
  full_name?: string
  girl_count: number
}

// 都道府県名を正規化する関数（DBから取得した都道府県名に基づいて処理）
const normalizeLocationName = (location: string, prefecturesList: string[]): string => {
  // 完全一致をチェック
  if (prefecturesList.includes(location)) {
    return location
  }
  
  // 部分一致をチェック（市区町村名が含まれている場合）
  for (const prefecture of prefecturesList) {
    if (location.includes(prefecture)) {
      return prefecture
    }
  }
  
  // マッチしない場合はそのまま返す
  return location
}

function AdvancedSearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, currentUser } = useAuth()
  const { profile: userProfile } = useUserProfile()
  const { isPremium, loading: subscriptionLoading } = useSubscription()
  const { toast } = useToast()
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  // 有料会員状態を直接使用
  // subscriptionLoadingがfalseでisPremiumがfalseの場合のみモザイクを適用

  // State
  const [users, setUsers] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showMobileFilter, setShowMobileFilter] = useState(false)
  const [areas, setAreas] = useState<{ prefectures: AreaData[], municipalities: AreaData[] }>({ 
    prefectures: [], 
    municipalities: [] 
  })
  const [currentPage, setCurrentPage] = useState(1)
  const LIMIT = 20

  // Filters
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedGirlTypes, setSelectedGirlTypes] = useState<string[]>([])
  const [selectedArea, setSelectedArea] = useState('all')
  const [selectedTime, setSelectedTime] = useState('now')
  const [ageRange, setAgeRange] = useState([18, 50])
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('recommend')
  const [filtersApplied, setFiltersApplied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchQueryInput, setSearchQueryInput] = useState('') // 入力値を別管理
  const [prioritizeQuickMeet, setPrioritizeQuickMeet] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [filteredTotalCount, setFilteredTotalCount] = useState(0)
  const [openAreaPopover, setOpenAreaPopover] = useState(false)
  const [areaInitialized, setAreaInitialized] = useState(false)
  const [locationFilteredServerSide, setLocationFilteredServerSide] = useState(false)

  // 動的に計算されるページ数（フィルタリング後のカウントを使用）
  const totalPages = Math.ceil(filteredTotalCount / LIMIT)

  // locationパラメータから座標を取得
  const [locationFromParam, setLocationFromParam] = useState<string>('')
  const [locationCoordinates, setLocationCoordinates] = useState<LocationCoordinates | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [userSelectedArea, setUserSelectedArea] = useState(false) // ユーザーが手動でエリアを選択したか
  
  // 初期パラメータの読み込み（初回のみ）
  useEffect(() => {
    if (!isInitialLoad) return;
    
    const tags = searchParams.get('tags')
    const girlTypes = searchParams.get('girlTypes')
    const location = searchParams.get('location')
    const time = searchParams.get('time')
    const quick = searchParams.get('quick')
    const q = searchParams.get('q')
    
    if (tags) setSelectedTags(tags.split(','))
    if (girlTypes) setSelectedGirlTypes(girlTypes.split(','))
    if (location) {
      setLocationFromParam(location)
      // locationパラメータが来た場合、検索クエリとして設定
      setSearchQuery(location)
      setSearchQueryInput(location)
      // エリア選択をallにリセット（キーワード検索で処理）
      setSelectedArea('all')
    }
    if (time) setSelectedTime(time)
    if (quick === 'true') setPrioritizeQuickMeet(true)
    if (q && !location) {
      setSearchQuery(q)
      setSearchQueryInput(q)
    }
    
    setIsInitialLoad(false)
  }, [searchParams, isInitialLoad])

  // 位置情報取得（初回のみ）
  useEffect(() => {
    const getLocation = async () => {
      // locationパラメータがある場合はGPS取得をスキップ
      if (locationFromParam) return;
      
      const locationInfo = await getCurrentLocation()
      if (locationInfo.coordinates) {
        setUserLocation(locationInfo.coordinates)
      }
    }
    getLocation()
  }, [locationFromParam])

  // エリアデータ取得
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await fetch('/api/areas')
        if (response.ok) {
          const data = await response.json()
          setAreas(data)
        }
      } catch (error) {
        console.error('Error fetching areas:', error)
      }
    }
    fetchAreas()
  }, [])
  
  // エリアデータ取得後の初期化（削除）

  // ユーザーデータ取得はcurrentPage変更時のフィルタリング処理に統合

  // 特殊フィルタリングタグかどうかをチェック
  const specialFilterTags = ['10代', '20代', '30代', '40代', '50代', '身長150cm以下', '身長155cm以下', '身長160cm以下', '身長165cm以上', 'Bカップ以下', 'Cカップ', 'Dカップ', 'Eカップ', 'Fカップ', 'Gカップ以上', 'お酒を飲む人', 'お酒を飲まない人', 'タバコを吸う人', 'タバコを吸わない人']
  const hasSpecialFilters = selectedTags.some(tag => specialFilterTags.includes(tag))

  // ユーザーデータ取得とフィルタリング処理
  const fetchFilteredUsers = useCallback(async () => {
    try {
      setLoading(true)
      
      // locationパラメータがある場合はエリアフィルターをスキップ
      if (!locationFromParam && selectedArea && selectedArea !== 'all') {
        // 選択されたエリアの女の子数を確認
        const selectedAreaData = [...areas.prefectures, ...areas.municipalities].find(
          area => area.prefecture_name === selectedArea || area.full_name === selectedArea
        )
        
        if (selectedAreaData && selectedAreaData.girl_count === 0) {
          setLoading(false)
          return
        }
      }
      
      // キーワード検索がある場合の処理
      const hasKeywordSearch = searchQuery.trim() !== ''
      let searchAreaName: string | null = null
      let nonLocationKeywords = searchQuery.trim()
      
      // キーワードが地域名の場合の処理
      let isLocationKeywordSearch = false
      if (hasKeywordSearch) {
        const query = searchQuery.toLowerCase().trim()
        
        // 地域名パターンをチェック
        const isLocationSearch = query.includes('区') || 
                                 query.includes('市') || 
                                 query.includes('町') || 
                                 query.includes('村') ||
                                 query.includes('都') ||
                                 query.includes('道') ||
                                 query.includes('府') ||
                                 query.includes('県')
        
        if (isLocationSearch) {
          // 地域検索の場合、全データから検索するためにフラグを設定
          isLocationKeywordSearch = true
          nonLocationKeywords = '' // 地域検索の場合はキーワードをクリア
        } else {
          // 地域検索でない場合のみ、通常のキーワード検索として扱う
          nonLocationKeywords = query
        }
      }
      
      const hasNonLocationKeywordSearch = nonLocationKeywords.trim() !== ''
      const hasAnyFilters = 
        hasSpecialFilters || 
        selectedTags.length > 0 || 
        hasNonLocationKeywordSearch || 
          selectedStyles.length > 0 ||
        (selectedArea && selectedArea !== 'all') ||
        searchAreaName !== null ||
        prioritizeQuickMeet
      
      // フィルターがある場合は、ページングを考慮して適切な量を取得
      // 特殊フィルターや地域・キーワード検索がある場合は、クライアントサイドでフィルタリングするため多めに取得
      const needsClientFiltering = hasSpecialFilters || hasNonLocationKeywordSearch || isLocationKeywordSearch
      
      // エリアフィルター（選択されたエリアまたは検索キーワードから抽出されたエリア）を最優先
      // ユーザーがエリアを選択した場合はそちらを優先
      let effectiveArea = null;
      if (userSelectedArea && selectedArea !== 'all') {
        // ユーザーが手動で選択した場合
        effectiveArea = selectedArea;
      } else if (!userSelectedArea && selectedArea !== 'all' && !locationFromParam) {
        // URLパラメータがない場合の通常のエリア選択
        effectiveArea = selectedArea;
      } else if (searchAreaName) {
        // 検索キーワードから抽出されたエリア
        effectiveArea = searchAreaName;
      }
      
      // 地域フィルターがサーバーサイドで適用されているかを記録
      setLocationFilteredServerSide(!!searchAreaName)
      
      // エリアが選択されている場合、または特殊フィルターがある場合は、より多くのデータを取得
      let fetchLimit = LIMIT
      if (effectiveArea || needsClientFiltering || isLocationKeywordSearch) {
        // エリアフィルターまたは特殊フィルターの場合、全データを取得（上限1000件）
        fetchLimit = 1000
      } else if (hasAnyFilters) {
        fetchLimit = LIMIT * 2
      }
      
      const offset = needsClientFiltering ? 0 : (currentPage - 1) * LIMIT
      
      // Use optimized API endpoint
      let apiUrl = `/api/mysql-girls-fast?limit=${fetchLimit}&offset=${offset}`
      
      // エリアフィルターを適用（ユーザーが選択した場合はそちらを優先）
      if (effectiveArea) {
        apiUrl += `&area=${encodeURIComponent(effectiveArea)}`
        // モバイルデバイスの場合、キャッシュをバイパスするためのタイムスタンプを追加
        const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
        if (isMobile && effectiveArea.includes('東京')) {
          apiUrl += `&_t=${Date.now()}`
        }
      }
      
      if (ageRange[0] !== 18 || ageRange[1] !== 50) {
        apiUrl += `&ageMin=${ageRange[0]}&ageMax=${ageRange[1]}`
      }
      
      if (selectedGirlTypes.length > 0) {
        apiUrl += `&girlTypes=${encodeURIComponent(selectedGirlTypes.join(','))}`
      }
      
      // Try optimized API first, fallback to regular API if it fails
      let response: Response | null = null
      let data: any = null
      
      try {
        // Try the optimized API endpoint first
        response = await fetch(apiUrl)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        data = await response.json()
      } catch (error) {
        
        // Fallback to regular API endpoint
        const fallbackUrl = apiUrl.replace('/api/mysql-girls-fast', '/api/mysql-girls')
        
        try {
          response = await fetch(fallbackUrl)
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          
          data = await response.json()
        } catch (fallbackError) {
          // Continue with empty data rather than throwing
          data = { girls: [], total: 0 }
          setFilteredUsers([])
          setFilteredTotalCount(0)
          setLoading(false)
          return
        }
      }
      
      // Data is already parsed in the try-catch block above
      if (!data) {
        setFilteredUsers([])
        setFilteredTotalCount(0)
        setLoading(false)
        return
      }
      
      // モバイルでのデータ取得結果の確認（デバッグ用、通常はコメントアウト）
      // if (typeof window !== 'undefined' && effectiveArea && effectiveArea.includes('東京')) {
      //   const isMobile = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      //   if (isMobile) {
      //     console.log(`Mobile API response for ${effectiveArea}:`, {
      //       totalGirls: data.girls.length,
      //       expectedTotal: data.total,
      //       fetchLimit: fetchLimit,
      //       apiUrl: apiUrl
      //     });
      //   }
      // }
      
      const mappedUsers: UserProfile[] = data.girls.map((user: any) => {
        // ユーザーの位置情報があり、店舗の位置情報がある場合は距離を計算
        let distance: number | undefined;
        if (userLocation) {
          // 店舗の座標がある場合
          if (user.shop?.latitude && user.shop?.longitude) {
            const R = 6371; // 地球の半径（km）
            const dLat = (user.shop.latitude - userLocation.lat) * Math.PI / 180;
            const dLng = (user.shop.longitude - userLocation.lng) * Math.PI / 180;
            const a = 
              Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(user.shop.latitude * Math.PI / 180) * 
              Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance = R * c;
          } else if (user.latitude && user.longitude) {
            // 互換性のために直接座標もチェック
            const R = 6371;
            const dLat = (user.latitude - userLocation.lat) * Math.PI / 180;
            const dLng = (user.longitude - userLocation.lng) * Math.PI / 180;
            const a = 
              Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(user.latitude * Math.PI / 180) * 
              Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance = R * c;
          } else if (user.location) {
            // 座標がない場合、地域名から概算座標を取得
            const coords = getLocationCoordinates(user.location);
            if (coords) {
              const R = 6371;
              const dLat = (coords.lat - userLocation.lat) * Math.PI / 180;
              const dLng = (coords.lng - userLocation.lng) * Math.PI / 180;
              const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(coords.lat * Math.PI / 180) * 
                Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              distance = R * c;
            }
          }
        }
        
        return {
          id: user.id,
          name: user.name,
          age: user.age,
          height: user.height,
          bust: user.bust,
          cup: user.cup,
          waist: user.waist,
          hip: user.hip,
          location: user.location,
          bio: user.bio,
          interests: user.interests,
          imageUrl: user.imageUrl,
          bodyType: user.bodyType,
          style: user.style,
          isOnline: user.isOnline,
          lastActive: user.lastActive,
          is_sake: user.is_sake,
          is_tobacco: user.is_tobacco,
          distance: distance,
          isGirlProfile: true // MySQLの女の子データであることを示す
        };
      })
      
      // Update total count
      setTotalCount(data.total || 0)
      setUsers(mappedUsers)
      
      // APIから返されたデータが0件の場合は、確実に空の配列を設定
      if (mappedUsers.length === 0 || data.total === 0) {
        setUsers([])
        setFilteredUsers([])
        setFilteredTotalCount(0)
      } else {
        // データがある場合
        if (!hasSpecialFilters) {
          // 特殊フィルターがない場合は、そのまま使用
          setFilteredUsers(mappedUsers)
          setFilteredTotalCount(data.total || 0)
        }
        // 特殊フィルターがある場合は、クライアントサイドフィルタリングで処理
        // ただし、usersは更新されているので、後続のuseEffectで処理される
      }
    } catch (error) {
      console.error('Error fetching filtered users:', error)
      
      // エラーの詳細をログに出力
      if (error instanceof TypeError) {
        console.error('Response type error:', error.message)
      } else if (error instanceof Error) {
        console.error('Fetch error:', error.message)
      }
      
      // ユーザーに分かりやすいエラーメッセージ
      let errorMessage = 'ユーザー情報の取得に失敗しました。'
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          errorMessage = 'データが見つかりませんでした。'
        } else if (error.message.includes('500')) {
          errorMessage = 'サーバーエラーが発生しました。'
        }
      }
      
      toast({
        title: 'エラー',
        description: `${errorMessage} ページを再読み込みしてください。`,
        variant: 'destructive'
      })
      
      // エラー時は空の配列を設定
      setUsers([])
      setFilteredUsers([])
      setFilteredTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, LIMIT, hasSpecialFilters, selectedArea, selectedTags, searchQuery, selectedStyles, prioritizeQuickMeet, ageRange, areas, toast, userLocation, userSelectedArea, locationFromParam, selectedGirlTypes])

  // データ取得のタイミングを制御
  useEffect(() => {
    // 初回ロードが完了していない場合はスキップ
    if (isInitialLoad) return;
    
    // エリアデータが読み込まれていない場合はスキップ
    if (areas.prefectures.length === 0) return;
    
    // デバウンスしてデータ取得
    const timer = setTimeout(() => {
      fetchFilteredUsers();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [currentPage, selectedArea, selectedTags, searchQuery, selectedStyles, prioritizeQuickMeet, ageRange, sortBy, areas.prefectures.length, isInitialLoad, fetchFilteredUsers])

  // 現在の候補から利用可能な年齢範囲を計算（コメントアウト - 常に18-50を使用）
  /*
  useEffect(() => {
    if (users.length > 0) {
      // 年齢の特殊フィルタリングを考慮
      let targetUsers = [...users]
      
      // 検索クエリでフィルタリング
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        targetUsers = targetUsers.filter(user => 
          user.name.toLowerCase().includes(query) ||
          user.bio.toLowerCase().includes(query) ||
          user.interests.some(interest => interest.toLowerCase().includes(query))
        )
      }
      
      // 通常タグと特殊タグでフィルタリング（年齢関連の特殊タグは除く）
      const nonAgeSpecialTags = selectedTags.filter(tag => tag !== '10代')
      if (nonAgeSpecialTags.length > 0) {
        targetUsers = targetUsers.filter(user => {
          const matchesNormalTags = nonAgeSpecialTags.some(tag => 
            user.interests.includes(tag)
          )
          
          let matchesSpecialTags = false
          if (nonAgeSpecialTags.includes('身長150cm以下') && user.height && user.height <= 150) {
            matchesSpecialTags = true
          }
          if (nonAgeSpecialTags.includes('身長151cm以上') && user.height && user.height >= 151) {
            matchesSpecialTags = true
          }
          if (nonAgeSpecialTags.includes('Eカップ以上') && user.cup) {
            const cupOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
            const userCupIndex = cupOrder.indexOf(user.cup.toUpperCase())
            const eCupIndex = cupOrder.indexOf('E')
            if (userCupIndex >= eCupIndex) {
              matchesSpecialTags = true
            }
          }
          if (nonAgeSpecialTags.includes('お酒を飲む人') && user.is_sake === true) {
            matchesSpecialTags = true
          }
          if (nonAgeSpecialTags.includes('タバコを吸わない人') && user.is_tobacco === false) {
            matchesSpecialTags = true
          }
          
          return matchesNormalTags || matchesSpecialTags
        })
      }
      
      
      // スタイルフィルター  
      if (selectedStyles.length > 0) {
        targetUsers = targetUsers.filter(user => 
          user.style && selectedStyles.includes(user.style)
        )
      }
      
      if (targetUsers.length > 0) {
        const ages = targetUsers.map(user => user.age)
        const minAge = Math.min(...ages)
        const maxAge = Math.max(...ages)
        setAvailableAgeRange([minAge, maxAge])
      }
    }
  }, [users, searchQuery, selectedTags, selectedStyles])
  */

  // クライアントサイドフィルタリング
  useEffect(() => {
    
    // usersが空の場合は、filteredUsersも空にして早期リターン
    if (users.length === 0) {
      setFilteredUsers([])
      setFilteredTotalCount(0)
      return
    }
    
    let filtered = [...users]

    // 検索クエリフィルター（拡張検索）
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      
      // スペースで分割して複数キーワード対応
      const keywords = query.split(/\s+/).filter(k => k.length > 0)
      
      // 単一キーワードの場合は特殊検索も含む
      if (keywords.length === 1) {
        const singleQuery = keywords[0]
        
        // 特殊検索条件
        if (singleQuery === '不明' || singleQuery === '年齢不明') {
          // 年齢が不明な人のみを検索
          filtered = filtered.filter(user => user.age === null || user.age === undefined)
        } else if (!isNaN(parseInt(singleQuery)) && parseInt(singleQuery) >= 18 && parseInt(singleQuery) <= 99) {
          // 数字のみの場合は年齢として検索
          const targetAge = parseInt(singleQuery)
          filtered = filtered.filter(user => user.age === targetAge)
        } else if (singleQuery.includes('歳') || singleQuery.includes('才')) {
          // 「○○歳」「○○才」の形式で年齢検索
          const ageMatch = singleQuery.match(/(\d+)/)
          if (ageMatch) {
            const targetAge = parseInt(ageMatch[1])
            filtered = filtered.filter(user => user.age === targetAge)
          }
        } else if (singleQuery.includes('cm')) {
          // 身長検索（例：「160cm」「160cm以上」「160cm以下」）
          const heightMatch = singleQuery.match(/(\d+)cm/)
          if (heightMatch) {
            const targetHeight = parseInt(heightMatch[1])
            if (singleQuery.includes('以上')) {
              filtered = filtered.filter(user => user.height && user.height >= targetHeight)
            } else if (singleQuery.includes('以下')) {
              filtered = filtered.filter(user => user.height && user.height <= targetHeight)
            } else {
              filtered = filtered.filter(user => user.height === targetHeight)
            }
          }
        } else if (singleQuery.match(/[a-kA-K]カップ/)) {
          // カップサイズ検索（例：「Dカップ」「Eカップ以上」）
          const cupMatch = singleQuery.match(/([a-kA-K])カップ/)
          if (cupMatch) {
            const targetCup = cupMatch[1].toUpperCase()
            const cupOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
            const targetIndex = cupOrder.indexOf(targetCup)
            
            if (singleQuery.includes('以上')) {
              filtered = filtered.filter(user => {
                if (!user.cup) return false
                const userIndex = cupOrder.indexOf(user.cup.toUpperCase())
                return userIndex >= targetIndex
              })
            } else {
              filtered = filtered.filter(user => user.cup && user.cup.toUpperCase() === targetCup)
            }
          }
        } else {
          // 通常の検索（名前、プロフィール、興味、地域を含む）
          // 地域検索も含めて全て同じロジックで処理
          filtered = filtered.filter(user => 
            (user.name && user.name.toLowerCase().includes(singleQuery)) ||
            (user.bio && user.bio.toLowerCase().includes(singleQuery)) ||
            (user.interests && user.interests.some(interest => interest && interest.toLowerCase().includes(singleQuery))) ||
            (user.location && user.location.toLowerCase().includes(singleQuery))
          )
        }
      } else {
        // 複数キーワードの場合はAND検索
        filtered = filtered.filter(user => {
          return keywords.every(keyword => {
            // 各キーワードは名前、プロフィール、興味、身体情報、地域のいずれかにマッチすればOK
            const userStr = [
              user.name,
              user.bio,
              ...user.interests,
              user.location,
              user.age ? user.age.toString() : '不明',
              user.height ? `${user.height}cm` : '',
              user.cup ? `${user.cup}カップ` : ''
            ].join(' ').toLowerCase()
            
            return userStr.includes(keyword)
          })
        })
      }
    }

    // タグフィルター（特殊タグと通常タグのOR検索）
    if (selectedTags.length > 0) {
      filtered = filtered.filter(user => {
        // 通常のタグマッチング
        const matchesNormalTags = selectedTags.some(tag => 
          user.interests.includes(tag)
        )
        
        // 特殊タグのマッチング
        let matchesSpecialTags = false
        
        // 年代フィルター
        if (selectedTags.includes('10代') && user.age >= 18 && user.age <= 19) {
          matchesSpecialTags = true
        }
        if (selectedTags.includes('20代') && user.age >= 20 && user.age <= 29) {
          matchesSpecialTags = true
        }
        if (selectedTags.includes('30代') && user.age >= 30 && user.age <= 39) {
          matchesSpecialTags = true
        }
        if (selectedTags.includes('40代') && user.age >= 40 && user.age <= 49) {
          matchesSpecialTags = true
        }
        if (selectedTags.includes('50代') && user.age >= 50 && user.age <= 59) {
          matchesSpecialTags = true
        }
        
        // 身長フィルター
        if (selectedTags.includes('身長150cm以下') && user.height && user.height <= 150) {
          matchesSpecialTags = true
        }
        if (selectedTags.includes('身長155cm以下') && user.height && user.height <= 155) {
          matchesSpecialTags = true
        }
        if (selectedTags.includes('身長160cm以下') && user.height && user.height <= 160) {
          matchesSpecialTags = true
        }
        if (selectedTags.includes('身長165cm以上') && user.height && user.height >= 165) {
          matchesSpecialTags = true
        }
        
        // カップサイズフィルター
        if (user.cup) {
          const cupOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
          const userCupIndex = cupOrder.indexOf(user.cup.toUpperCase())
          
          if (selectedTags.includes('Bカップ以下') && userCupIndex <= cupOrder.indexOf('B')) {
            matchesSpecialTags = true
          }
          if (selectedTags.includes('Cカップ') && userCupIndex === cupOrder.indexOf('C')) {
            matchesSpecialTags = true
          }
          if (selectedTags.includes('Dカップ') && userCupIndex === cupOrder.indexOf('D')) {
            matchesSpecialTags = true
          }
          if (selectedTags.includes('Eカップ') && userCupIndex === cupOrder.indexOf('E')) {
            matchesSpecialTags = true
          }
          if (selectedTags.includes('Fカップ') && userCupIndex === cupOrder.indexOf('F')) {
            matchesSpecialTags = true
          }
          if (selectedTags.includes('Gカップ以上') && userCupIndex >= cupOrder.indexOf('G')) {
            matchesSpecialTags = true
          }
        }
        
        // お酒・タバコフィルター
        if (selectedTags.includes('お酒を飲む人') && user.is_sake === true) {
          matchesSpecialTags = true
        }
        if (selectedTags.includes('お酒を飲まない人') && user.is_sake === false) {
          matchesSpecialTags = true
        }
        if (selectedTags.includes('タバコを吸う人') && user.is_tobacco === true) {
          matchesSpecialTags = true
        }
        if (selectedTags.includes('タバコを吸わない人') && user.is_tobacco === false) {
          matchesSpecialTags = true
        }
        
        // OR条件：通常タグまたは特殊タグのいずれかにマッチ
        return matchesNormalTags || matchesSpecialTags
      })
    }

    // エリアフィルターはサーバーサイドで処理済み

    // 年齢フィルター（特殊タグが選択されていない場合のみ適用）
    const hasAgeSpecialTag = selectedTags.some(tag => ['10代', '20代', '30代', '40代', '50代'].includes(tag))
    if (!hasAgeSpecialTag) {
      // デフォルト範囲（18-50）の場合はNULL年齢も含める、それ以外は除外
      const isDefaultRange = ageRange[0] === 18 && ageRange[1] === 50
      filtered = filtered.filter(user => {
        if (user.age === null || user.age === undefined) {
          return isDefaultRange // デフォルト範囲の時のみNULL年齢を表示
        }
        return user.age >= ageRange[0] && user.age <= ageRange[1]
      })
    }


    // スタイルフィルター
    if (selectedStyles.length > 0) {
      filtered = filtered.filter(user => 
        user.style && selectedStyles.includes(user.style)
      )
    }

    // 時間フィルター（すぐ会える相手を優先）
    if (prioritizeQuickMeet) {
      // オンラインまたは最近アクティブなユーザーを優先
      filtered.sort((a, b) => {
        const aScore = a.isOnline ? 2 : (a.lastActive ? 1 : 0)
        const bScore = b.isOnline ? 2 : (b.lastActive ? 1 : 0)
        return bScore - aScore
      })
    }

    // ソート処理
    switch (sortBy) {
      case 'new':
        // 新着順：IDが大きい（新しい）順に並べる
        filtered.sort((a, b) => {
          // IDを数値として比較（IDが数値文字列の場合）
          const aId = parseInt(a.id) || 0
          const bId = parseInt(b.id) || 0
          return bId - aId
        })
        break
      case 'distance':
        // 距離順：userLocationがある場合のみ
        if (userLocation) {
          filtered = sortUsersByDistance(filtered, userLocation)
        } else {
          // 位置情報がない場合は地域名でソート
          filtered.sort((a, b) => a.location.localeCompare(b.location))
        }
        break
      case 'recommend':
      default:
        // おすすめ順：マッチングスコアを計算してソート
        filtered = filtered.map(user => {
          let score = 0
          
          // 年齢が設定されている人を優先
          if (user.age !== null && user.age !== undefined) {
            score += 10
          }
          
          // プロフィール充実度
          if (user.bio && user.bio.length > 50) score += 5
          if (user.height) score += 3
          if (user.bust) score += 3
          if (user.cup) score += 3
          if (user.interests.length > 3) score += 5
          
          // オンライン状態
          if (user.isOnline) score += 20
          
          // 検索クエリとのマッチ度
          if (searchQuery) {
            const query = searchQuery.toLowerCase()
            if (user.name && user.name.toLowerCase().includes(query)) score += 15
            if (user.bio && user.bio.toLowerCase().includes(query)) score += 10
            if (user.location && user.location.toLowerCase().includes(query)) score += 8
            if (user.interests && user.interests.some(i => i && i.toLowerCase().includes(query))) score += 5
          }
          
          // 選択されたタグとのマッチ
          const matchedTags = selectedTags.filter(tag => user.interests.includes(tag))
          score += matchedTags.length * 10
          
          return { ...user, matchScore: score }
        })
        
        // スコアで降順ソート
        filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        break
    }

    
    setFilteredUsers(filtered)
    setFilteredTotalCount(filtered.length)
  }, [users, searchQuery, selectedTags, selectedArea, ageRange, selectedStyles, sortBy, userLocation, prioritizeQuickMeet, locationFilteredServerSide, areas])

  // 年齢範囲が利用可能な範囲を超えた場合の調整（コメントアウト - 常に18-50を使用）
  /*
  useEffect(() => {
    const [currentMin, currentMax] = ageRange
    const [availableMin, availableMax] = availableAgeRange
    
    let needsUpdate = false
    let newMin = currentMin
    let newMax = currentMax
    
    if (currentMin < availableMin) {
      newMin = availableMin
      needsUpdate = true
    }
    if (currentMax > availableMax) {
      newMax = availableMax
      needsUpdate = true
    }
    if (currentMin > availableMax) {
      newMin = availableMin
      newMax = availableMax
      needsUpdate = true
    }
    if (currentMax < availableMin) {
      newMin = availableMin
      newMax = availableMax
      needsUpdate = true
    }
    
    if (needsUpdate) {
      setAgeRange([newMin, newMax])
    }
  }, [availableAgeRange]) // ageRangeを依存配列から削除して無限ループを防ぐ
  */

  // フィルター変更時にページを1に戻す（年齢以外）
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedTags, selectedArea, selectedStyles, sortBy, prioritizeQuickMeet])
  
  // エリア変更時の処理（削除）
  
  // 年齢変更は別途処理（ページリセットしない）
  useEffect(() => {
    // 年齢が変更されても現在のページを維持
  }, [ageRange])

  // いいね送信
  const handleLike = async (user: UserProfile) => {
    if (!currentUser) {
      toast({
        title: 'ログインが必要です',
        description: 'いいねを送るにはログインしてください'
      })
      router.push('/login')
      return
    }

    // 有料会員チェック - subscriptionLoadingが完了してからチェック
    if (!subscriptionLoading && !isPremium) {
      toast({
        title: '有料会員限定',
        description: 'いいねを送るには有料会員登録が必要です',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/subscription')}
          >
            有料会員になる
          </Button>
        ),
      })
      return
    }

    // subscriptionLoading中は何もしない
    if (subscriptionLoading) {
      console.log('Subscription status is still loading...')
      return
    }

    try {
      console.log('Sending like from:', currentUser.uid, 'to:', user.id, 'isPremium:', isPremium)
      
      // MySQLの女の子データの場合は追加情報を送る
      const options = user.isGirlProfile ? {
        toGirlName: user.name,
        toGirlId: user.id,
        isGirlProfile: true
      } : undefined;
      
      // MySQLの女の子の場合、特別なIDを使用
      const targetId = user.isGirlProfile ? `mysql_girl_${user.id}` : user.id;
      
      const result = await sendLike(currentUser.uid, targetId, options)
      
      if (result.alreadyLiked) {
        toast({
          title: '既にいいねを送っています',
          description: `${user.name}さんには既にいいねを送信済みです。`,
        })
      } else if (result.isMatch) {
        toast({
          title: 'マッチしました！🎉',
          description: `${user.name}さんとマッチしました！メッセージを送ってみましょう。`,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/messages/${result.matchId}`)}
            >
              メッセージを送る
            </Button>
          ),
        })
      } else {
        toast({
          title: 'いいねを送りました！',
          description: `${user.name}さんにいいねを送りました。`
        })
      }
    } catch (error: any) {
      console.error('Like error:', error)
      console.error('Error details:', error.message, error.code)
      
      // Firebaseの権限エラーの場合
      if (error?.code === 'permission-denied' || 
          error?.message?.includes('Missing or insufficient permissions') ||
          error?.message?.includes('有料会員のみ')) {
        
        // サブスクリプション情報を再確認
        console.log('Permission denied. Current premium status:', isPremium)
        
        toast({
          title: '権限エラー',
          description: '有料会員登録を確認してください。ページをリロードして再度お試しください。',
          variant: 'destructive',
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              ページをリロード
            </Button>
          ),
        })
      } else {
        toast({
          title: 'エラー',
          description: 'いいねの送信に失敗しました。しばらく時間をおいて再度お試しください。',
          variant: 'destructive'
        })
      }
    }
  }

  // メッセージ画面へ
  const handleMessage = (userId: string) => {
    if (!currentUser) {
      toast({
        title: 'ログインが必要です',
        description: 'メッセージを送るにはログインしてください'
      })
      router.push('/login')
      return
    }

    if (!isPremium) {
      toast({
        title: 'プレミアム会員限定',
        description: 'メッセージ機能は有料会員のみ利用可能です',
        variant: 'destructive'
      })
      return
    }

    router.push(`/messages/${userId}`)
  }

  // フィルターリセット
  const resetFilters = () => {
    setSearchQuery('')
    setSearchQueryInput('')
    setSelectedTags([])
    setSelectedArea('all')
    setSelectedTime('now')
    setAgeRange([18, 50])
    setSelectedStyles([])
    setPrioritizeQuickMeet(false)
    setSortBy('recommend')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  return (
    <div className={styles.searchContainer}>
      {/* フィルターサイドバー */}
      <aside className={`${styles.filterSidebar} ${showMobileFilter ? styles.active : ''}`}>
        <div className={styles.filterHeader}>
          <h2 className={styles.filterTitle}>絞り込み検索</h2>
          <button onClick={resetFilters} className={styles.filterReset}>
            リセット
          </button>
        </div>

        {/* エリア */}
        <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            <MapPin className="w-4 h-4" />
            エリア
          </h3>
          {/* モバイル用Dialog */}
          {isMobile ? (
            <>
              <Button
                variant="outline"
                onClick={() => setOpenAreaPopover(true)}
                className={`w-full justify-between ${styles.filterSelect}`}
              >
                {selectedArea === 'all' ? 'すべてのエリア' : 
                  (() => {
                    // 市区町村が選択されている場合は、フルネームで表示
                    const municipality = areas.municipalities.find(m => m.municipality_name === selectedArea);
                    return municipality ? municipality.full_name : selectedArea;
                  })()
                }
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
              <Dialog open={openAreaPopover} onOpenChange={setOpenAreaPopover}>
                <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-hidden dialog-content-mobile">
                  <DialogHeader>
                    <DialogTitle>エリアを選択</DialogTitle>
                  </DialogHeader>
                  <Command>
                    <CommandInput placeholder="都道府県名や市区町村名で検索..." />
                    <CommandEmpty>該当するエリアが見つかりません</CommandEmpty>
                    <CommandList className="max-h-[50vh] overflow-y-auto">
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      setSelectedArea('all')
                      setUserSelectedArea(false) // 全エリアに戻した場合
                      // locationパラメータがある場合は検索クエリに戻す
                      if (locationFromParam) {
                        setSearchQuery(locationFromParam)
                        setSearchQueryInput(locationFromParam)
                      }
                      setOpenAreaPopover(false)
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        selectedArea === 'all' ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    すべてのエリア
                  </CommandItem>
                </CommandGroup>
                
                {/* 人気の都道府県（女の子がいるエリア） */}
                {areas.prefectures.filter(p => p.girl_count > 0).length > 0 && (
                  <CommandGroup heading="人気の都道府県">
                    {areas.prefectures
                      .filter(p => p.girl_count > 0)
                      .slice(0, 10)
                      .map((prefecture) => (
                      <CommandItem
                        key={`pref-${prefecture.prefecture_id}`}
                        value={prefecture.prefecture_name}
                        onSelect={(currentValue: string) => {
                          setSelectedArea(currentValue)
                          setUserSelectedArea(true) // ユーザーが手動で選択
                          // エリアを選択したら検索クエリをクリア
                          if (locationFromParam) {
                            setSearchQuery('')
                            setSearchQueryInput('')
                          }
                          setOpenAreaPopover(false)
                        }}
                        className="font-medium"
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selectedArea === prefecture.prefecture_name ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        <span className="flex-1">{prefecture.prefecture_name}</span>
                        <span className="ml-auto text-sm font-semibold text-[#F0306A]">
                          {prefecture.girl_count.toLocaleString()}名
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                
                {/* すべての都道府県 */}
                {areas.prefectures.length > 0 && (
                  <CommandGroup heading="すべての都道府県">
                    {areas.prefectures.map((prefecture) => (
                      <CommandItem
                        key={`all-pref-${prefecture.prefecture_id}`}
                        value={prefecture.prefecture_name}
                        onSelect={(currentValue: string) => {
                          setSelectedArea(currentValue)
                          setUserSelectedArea(true) // ユーザーが手動で選択
                          // エリアを選択したら検索クエリをクリア
                          if (locationFromParam) {
                            setSearchQuery('')
                            setSearchQueryInput('')
                          }
                          setOpenAreaPopover(false)
                        }}
                        className={prefecture.girl_count === 0 ? "opacity-50" : ""}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selectedArea === prefecture.prefecture_name ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        <span className="flex-1">{prefecture.prefecture_name}</span>
                        <span className={`ml-auto text-sm ${
                          prefecture.girl_count > 0 ? 'text-muted-foreground' : 'text-gray-400'
                        }`}>
                          {prefecture.girl_count > 0 ? `${prefecture.girl_count.toLocaleString()}名` : '対象なし'}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                
                {/* 人気の市区町村（TOP 20） */}
                {areas.municipalities.filter(m => m.girl_count > 0).length > 0 && (
                  <CommandGroup heading="人気の市区町村">
                    {areas.municipalities
                      .filter(m => m.girl_count > 0)
                      .slice(0, 20)
                      .map((municipality) => (
                      <CommandItem
                        key={`muni-${municipality.municipality_id}`}
                        value={municipality.full_name || ''}
                        onSelect={(currentValue: string) => {
                          // 市区町村名だけを送信（"東京 渋谷区"の場合は"渋谷区"だけ）
                          setSelectedArea(municipality.municipality_name || currentValue)
                          setUserSelectedArea(true) // ユーザーが手動で選択
                          // エリアを選択したら検索クエリをクリア
                          if (locationFromParam) {
                            setSearchQuery('')
                            setSearchQueryInput('')
                          }
                          setOpenAreaPopover(false)
                        }}
                        className="font-medium"
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selectedArea === municipality.full_name ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        <span className="flex-1">{municipality.full_name}</span>
                        <span className="ml-auto text-sm font-semibold text-[#F0306A]">
                          {municipality.girl_count.toLocaleString()}名
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            /* デスクトップ用Popover */
            <Popover open={openAreaPopover} onOpenChange={setOpenAreaPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openAreaPopover}
                  className={`w-full justify-between ${styles.filterSelect}`}
                >
                  {selectedArea === 'all' ? 'すべてのエリア' : 
                    (() => {
                      // 市区町村が選択されている場合は、フルネームで表示
                      const municipality = areas.municipalities.find(m => m.municipality_name === selectedArea);
                      return municipality ? municipality.full_name : selectedArea;
                    })()
                  }
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start" side="bottom" sideOffset={5}>
                <Command>
                  <CommandInput placeholder="都道府県名や市区町村名で検索..." />
                  <CommandEmpty>該当するエリアが見つかりません</CommandEmpty>
                  <CommandList className="max-h-[400px] overflow-y-auto">
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedArea('all')
                          setUserSelectedArea(false) // 全エリアに戻した場合
                          // locationパラメータがある場合は検索クエリに戻す
                          if (locationFromParam) {
                            setSearchQuery(locationFromParam)
                            setSearchQueryInput(locationFromParam)
                          }
                          setOpenAreaPopover(false)
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selectedArea === 'all' ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        すべてのエリア
                      </CommandItem>
                    </CommandGroup>
                    
                    {/* 人気の都道府県（女の子がいるエリア） */}
                    {areas.prefectures.filter(p => p.girl_count > 0).length > 0 && (
                      <CommandGroup heading="人気の都道府県">
                        {areas.prefectures
                          .filter(p => p.girl_count > 0)
                          .slice(0, 10)
                          .map((prefecture) => (
                          <CommandItem
                            key={`pref-${prefecture.prefecture_id}`}
                            value={prefecture.prefecture_name}
                            onSelect={(currentValue: string) => {
                              setSelectedArea(currentValue)
                              setUserSelectedArea(true) // ユーザーが手動で選択
                              // エリアを選択したら検索クエリをクリア
                              if (locationFromParam) {
                                setSearchQuery('')
                                setSearchQueryInput('')
                              }
                              setOpenAreaPopover(false)
                            }}
                            className="font-medium"
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedArea === prefecture.prefecture_name ? 'opacity-100' : 'opacity-0'
                              }`}
                            />
                            <span className="flex-1">{prefecture.prefecture_name}</span>
                            <span className="ml-auto text-sm font-semibold text-[#F0306A]">
                              {prefecture.girl_count.toLocaleString()}名
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    
                    {/* すべての都道府県 */}
                    {areas.prefectures.length > 0 && (
                      <CommandGroup heading="すべての都道府県">
                        {areas.prefectures.map((prefecture) => (
                          <CommandItem
                            key={`all-pref-${prefecture.prefecture_id}`}
                            value={prefecture.prefecture_name}
                            onSelect={(currentValue: string) => {
                              setSelectedArea(currentValue)
                              setUserSelectedArea(true) // ユーザーが手動で選択
                              // エリアを選択したら検索クエリをクリア
                              if (locationFromParam) {
                                setSearchQuery('')
                                setSearchQueryInput('')
                              }
                              setOpenAreaPopover(false)
                            }}
                            className={prefecture.girl_count === 0 ? "opacity-50" : ""}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedArea === prefecture.prefecture_name ? 'opacity-100' : 'opacity-0'
                              }`}
                            />
                            <span className="flex-1">{prefecture.prefecture_name}</span>
                            <span className={`ml-auto text-sm ${
                              prefecture.girl_count > 0 ? 'text-muted-foreground' : 'text-gray-400'
                            }`}>
                              {prefecture.girl_count > 0 ? `${prefecture.girl_count.toLocaleString()}名` : '対象なし'}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    
                    {/* 人気の市区町村（TOP 20） */}
                    {areas.municipalities.filter(m => m.girl_count > 0).length > 0 && (
                      <CommandGroup heading="人気の市区町村">
                        {areas.municipalities
                          .filter(m => m.girl_count > 0)
                          .slice(0, 20)
                          .map((municipality) => (
                          <CommandItem
                            key={`muni-${municipality.municipality_id}`}
                            value={municipality.full_name || ''}
                            onSelect={(currentValue: string) => {
                              // 市区町村名だけを送信（"東京 渋谷区"の場合は"渋谷区"だけ）
                              setSelectedArea(municipality.municipality_name || currentValue)
                              setUserSelectedArea(true) // ユーザーが手動で選択
                              // エリアを選択したら検索クエリをクリア
                              if (locationFromParam) {
                                setSearchQuery('')
                                setSearchQueryInput('')
                              }
                              setOpenAreaPopover(false)
                            }}
                            className="font-medium"
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedArea === municipality.full_name ? 'opacity-100' : 'opacity-0'
                              }`}
                            />
                            <span className="flex-1">{municipality.full_name}</span>
                            <span className="ml-auto text-sm font-semibold text-[#F0306A]">
                              {municipality.girl_count.toLocaleString()}名
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* キーワード検索 */}
        <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            <Search className="w-4 h-4" />
            キーワード検索
          </h3>
          <Input
            type="text"
            placeholder="例: 渋谷区, 25歳, 160cm以上, Dカップ, 不明"
            value={searchQueryInput}
            onChange={(e) => setSearchQueryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearchQuery(searchQueryInput)
              }
            }}
            className={styles.filterInput}
          />
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            年齢(25, 25歳)、身長(160cm, 160cm以上)、カップ(Dカップ, Eカップ以上)、地域名、「不明」で年齢不明者<br/>
            複数単語はスペース区切りでAND検索（例: 渋谷 160cm Dカップ）
          </p>
        </div>

        {/* 性癖・プレイスタイル - 特殊フィルタリング */}
        <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            <Heart className="w-4 h-4" />
            性癖・プレイスタイル
          </h3>
          <div className="mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">特殊フィルタリング</span>
          </div>
          <div className={styles.tagFilters}>
            {personalityTags.map(tag => (
              <label key={tag} className={styles.tagFilter}>
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTags([...selectedTags, tag])
                    } else {
                      setSelectedTags(selectedTags.filter(t => t !== tag))
                    }
                  }}
                />
                <span>{tag}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 時間帯 */}
        <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            <Clock className="w-4 h-4" />
            時間帯
          </h3>
          <div className={styles.timeFilters}>
            {timeOptions.map(option => (
              <label key={option.value} className={styles.timeFilter}>
                <input
                  type="radio"
                  name="time"
                  value={option.value}
                  checked={selectedTime === option.value}
                  onChange={(e) => setSelectedTime(e.target.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="prioritizeQuickMeet"
              checked={prioritizeQuickMeet}
              onChange={(e) => setPrioritizeQuickMeet(e.target.checked)}
              className="w-4 h-4 text-gold-500 rounded"
            />
            <label htmlFor="prioritizeQuickMeet" className={styles.textSecondary}>
              すぐ会える相手を優先
            </label>
          </div>
        </div>

        {/* 年齢 */}
        <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            年齢
          </h3>
          <div className={styles.rangeContainer}>
            <div className={styles.rangeDisplay}>
              <span>{ageRange[0]}歳</span>
              <span>{ageRange[1]}歳</span>
            </div>
            <Slider
              value={ageRange}
              onValueChange={setAgeRange}
              min={18}
              max={50}
              step={1}
              className={styles.rangeSlider}
            />
          </div>
        </div>


        {/* スタイル（一時的にコメントアウト） */}
        {/* <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            スタイル
          </h3>
          <div className={styles.tagFilters}>
            {styleTypes.map(type => (
              <label key={type} className={styles.tagFilter}>
                <input
                  type="checkbox"
                  checked={selectedStyles.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedStyles([...selectedStyles, type])
                    } else {
                      setSelectedStyles(selectedStyles.filter(t => t !== type))
                    }
                  }}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div> */}
      </aside>

      {/* メインコンテンツ */}
      <main className={styles.searchMain}>
        <div className={styles.searchHeader}>
          <div>
            <div className={styles.searchResultsCount}>
              <span>{filteredTotalCount}</span>名の候補が見つかりました
              {totalPages > 1 && (
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                  （{currentPage} / {totalPages} ページ）
                </span>
              )}
            </div>
            {/* アクティブなフィルター表示 */}
            <div className="flex flex-wrap gap-2 mt-2">
              {searchQuery && (
                <Badge variant="secondary" className="bg-gold-500/10 text-gold-500 border-gold-500/30">
                  検索: {searchQuery}
                </Badge>
              )}
              {selectedTags.map(tag => (
                <Badge key={tag} variant="secondary" className="bg-gold-500/10 text-gold-500 border-gold-500/30">
                  {tag}
                </Badge>
              ))}
              {selectedArea !== 'all' && (
                <Badge variant="secondary" className="bg-gold-500/10 text-gold-500 border-gold-500/30">
                  {selectedArea}
                </Badge>
              )}
              {(ageRange[0] !== 18 || ageRange[1] !== 50) && (
                <Badge variant="secondary" className="bg-gold-500/10 text-gold-500 border-gold-500/30">
                  {ageRange[0]}歳〜{ageRange[1]}歳
                </Badge>
              )}
              {prioritizeQuickMeet && (
                <Badge variant="secondary" className="bg-gold-500/10 text-gold-500 border-gold-500/30">
                  すぐ会える
                </Badge>
              )}
            </div>
          </div>
          <div className={styles.searchControls}>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className={styles.sortSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommend">おすすめ順</SelectItem>
                <SelectItem value="new">新着順</SelectItem>
                <SelectItem value="distance">距離が近い順</SelectItem>
              </SelectContent>
            </Select>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === 'list' ? styles.active : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ユーザーカード */}
        {filteredUsers.length > 0 && (
          <div className={viewMode === 'grid' ? styles.profilesGrid : styles.profilesList}>
            {filteredUsers.slice((currentPage - 1) * LIMIT, currentPage * LIMIT).map(user => (
            <Card key={user.id} className={styles.profileCard}>
              <div 
                className={styles.profileImage}
                onClick={() => {
                  // 有料ユーザーかつMySQLの女の子データの場合のみ詳細ページへ遷移
                  if (isPremium && user.isGirlProfile) {
                    router.push(`/girl/${user.id}`)
                  } else if (!isPremium) {
                    toast({
                      title: '有料会員限定',
                      description: 'プロフィール詳細を見るには有料会員登録が必要です',
                      action: (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push('/subscription')}
                        >
                          有料会員になる
                        </Button>
                      ),
                    })
                  }
                }}
                style={{ cursor: user.isGirlProfile ? 'pointer' : 'default' }}
              >
                <Image
                  src={user.imageUrl}
                  alt={user.name}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className={viewMode === 'list' ? "object-contain" : "object-cover"}
                  style={!subscriptionLoading && !isPremium ? { filter: 'blur(8px)' } : {}}
                />
                {!subscriptionLoading && !isPremium && <div className={styles.profileBlur} />}
              </div>
              <CardContent className={styles.profileInfo}>
                <h3 
                  className={styles.profileName}
                  onClick={() => {
                    // 有料ユーザーかつMySQLの女の子データの場合のみ詳細ページへ遷移
                    if (isPremium && user.isGirlProfile) {
                      router.push(`/girl/${user.id}`)
                    } else if (!isPremium) {
                      toast({
                        title: '有料会員限定',
                        description: 'プロフィール詳細を見るには有料会員登録が必要です',
                        action: (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push('/subscription')}
                          >
                            有料会員になる
                          </Button>
                        ),
                      })
                    }
                  }}
                  style={{ cursor: user.isGirlProfile ? 'pointer' : 'default' }}
                >
                  {user.name}
                </h3>
                <div className={styles.profileDetails}>
                  <span>{user.age ? `${user.age}歳` : '不明'}</span>
                  <span>•</span>
                  <span>{user.location}</span>
                  {user.distance !== undefined && (
                    <>
                      <span>•</span>
                      <span className="text-gold-500 font-semibold">
                        {user.distance < 1 
                          ? `${Math.round(user.distance * 1000)}m先` 
                          : `${user.distance.toFixed(1)}km先`}
                      </span>
                    </>
                  )}
                </div>
                {/* 身体情報 */}
                <div className={styles.profileDetails} style={{ marginTop: '4px' }}>
                  {user.height && <span>T{user.height}cm</span>}
                  {user.bust && user.waist && user.hip && (
                    <>
                      {user.height && <span>•</span>}
                      <span>B{user.bust}{user.cup ? `(${user.cup})` : ''} W{user.waist} H{user.hip}</span>
                    </>
                  )}
                </div>
                <div className={styles.profileTags}>
                  {user.interests.slice(0, 3).map(interest => (
                    <Badge key={interest} variant="secondary" className={styles.profileTag}>
                      {interest}
                    </Badge>
                  ))}
                </div>
                <p className={viewMode === 'list' ? styles.profileBioFull : styles.profileBio}>
                  {user.bio}
                </p>
                <div className={styles.profileActions}>
                  <Button
                    variant="outline"
                    className={styles.actionLike}
                    onClick={() => handleLike(user)}
                  >
                    <Heart className="w-4 h-4" />
                    いいね
                  </Button>
                  <Button
                    className={styles.actionMessage}
                    onClick={() => handleMessage(user.id)}
                  >
                    <MessageCircle className="w-4 h-4" />
                    メッセージ
                  </Button>
                </div>
              </CardContent>
            </Card>
            ))}
          </div>
        )}

        {filteredUsers.length === 0 && (
          <div className={styles.emptyState}>
            <Search className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>
              {selectedArea && selectedArea !== 'all' 
                ? `${selectedArea}には現在女性がいません`
                : '該当する女性が見つかりません'}
            </h3>
            <p className={styles.emptyText}>
              {selectedArea && selectedArea !== 'all' ? (
                <>
                  近隣のエリアを探してみてください。<br />
                  またはフィルター条件を変更してお試しください。
                </>
              ) : (
                'フィルター条件を変更してもう一度お試しください'
              )}
            </p>
            <Button onClick={resetFilters}>
              フィルターをリセット
            </Button>
          </div>
        )}

        {/* ページネーション */}
        {filteredTotalCount > LIMIT && totalPages > 1 && (
          <div className={styles.pagination}>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={styles.paginationButton}
            >
              前へ
            </Button>
            
            <div className={styles.paginationNumbers}>
              {/* 最初のページと省略記号は中間のロジックに統合済み */}
              
              {/* 中間のページ番号 */}
              {(() => {
                const pageNumbers = [];
                const maxVisible = 5; // 表示する最大ページ数
                const sideCount = Math.floor(maxVisible / 2); // 現在ページの左右に表示する数
                
                if (totalPages <= 7) {
                  // 7ページ以下なら全部表示
                  for (let i = 1; i <= totalPages; i++) {
                    pageNumbers.push(i);
                  }
                } else {
                  // 動的に表示範囲を計算
                  let start = Math.max(1, currentPage - sideCount);
                  let end = Math.min(totalPages, currentPage + sideCount);
                  
                  // 開始位置が1に近い場合、終了位置を調整
                  if (start === 1) {
                    end = Math.min(totalPages, maxVisible);
                  }
                  
                  // 終了位置が最後に近い場合、開始位置を調整
                  if (end === totalPages) {
                    start = Math.max(1, totalPages - maxVisible + 1);
                  }
                  
                  // 最初のページを追加（現在の範囲に含まれていない場合）
                  if (start > 1) {
                    pageNumbers.push(1);
                    if (start > 2) {
                      pageNumbers.push('...');
                    }
                  }
                  
                  // 現在の範囲のページ番号を追加
                  for (let i = start; i <= end; i++) {
                    pageNumbers.push(i);
                  }
                  
                  // 最後のページを追加（現在の範囲に含まれていない場合）
                  if (end < totalPages) {
                    if (end < totalPages - 1) {
                      pageNumbers.push('...');
                    }
                    pageNumbers.push(totalPages);
                  }
                }
                
                return pageNumbers.map((pageNum, index) => {
                  if (pageNum === '...') {
                    return <span key={`ellipsis-${index}`} className={styles.paginationEllipsis}>...</span>;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum as number)}
                      className={`${styles.paginationNumber} ${currentPage === pageNum ? styles.active : ''}`}
                    >
                      {pageNum}
                    </button>
                  );
                });
              })()}
              
              {/* 最後のページと省略記号は中間のロジックに統合済み */}
            </div>
            
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={styles.paginationButton}
            >
              次へ
            </Button>
            
            {/* ページジャンプ - 別の行に配置 */}
            {totalPages > 10 && (
              <div className={styles.pageJump} style={{ flexBasis: '100%', justifyContent: 'center', display: 'flex' }}>
                <span className={styles.pageJumpText}>ページ: </span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                    }
                  }}
                  className={styles.pageJumpInput}
                />
                <span className={styles.pageJumpText}>/ {totalPages}</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* モバイルフィルタートグル */}
      <button
        className={styles.mobileFilterToggle}
        onClick={() => setShowMobileFilter(!showMobileFilter)}
      >
        <Filter className="w-6 h-6" />
      </button>

      {/* モバイルオーバーレイ */}
      {showMobileFilter && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setShowMobileFilter(false)}
        />
      )}

      {/* 絞り込み検索ボタン */}
      <button
        className={styles.applyFilterButton}
        onClick={() => {
          setSearchQuery(searchQueryInput) // 検索を実行
          setFiltersApplied(true)
          toast({
            title: "フィルターを適用しました",
            description: `${filteredTotalCount}名の候補が見つかりました`
          })
        }}
      >
        <Search className="w-5 h-5" />
        絞り込み検索
      </button>
    </div>
  )
}

// Suspense boundary wrapper
export default function AdvancedSearchPage() {
  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
        </div>
      }
    >
      <AdvancedSearchContent />
    </Suspense>
  )
}