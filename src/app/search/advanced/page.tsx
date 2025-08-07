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
}

// 性癖・プレイスタイルのタグ
const personalityTags = [
  '10代', '身長150cm以下', '身長151cm以上', 'Eカップ以上',
  'お酒を飲む人', 'タバコを吸わない人'
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
  const { isPremium } = useSubscription()
  const { toast } = useToast()
  const isMobile = useMediaQuery('(max-width: 768px)')

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

  // 動的に計算されるページ数（フィルタリング後のカウントを使用）
  const totalPages = Math.ceil(filteredTotalCount / LIMIT)

  // 初期パラメータの読み込み
  useEffect(() => {
    const tags = searchParams.get('tags')
    const location = searchParams.get('location')
    const time = searchParams.get('time')
    const quick = searchParams.get('quick')
    const q = searchParams.get('q')
    
    if (tags) setSelectedTags(tags.split(','))
    if (location && areas.prefectures.length > 0) {
      // locationパラメータが来た場合、都道府県名を抽出して設定
      const prefectureNames = areas.prefectures.map(p => p.prefecture_name)
      const normalizedLocation = normalizeLocationName(location, prefectureNames)
      setSelectedArea(normalizedLocation)
    }
    if (time) setSelectedTime(time)
    if (quick === 'true') setPrioritizeQuickMeet(true)
    if (q) {
      setSearchQuery(q)
      setSearchQueryInput(q)
    }
  }, [searchParams, areas.prefectures])

  // 位置情報取得
  useEffect(() => {
    const getLocation = async () => {
      const locationInfo = await getCurrentLocation()
      if (locationInfo.coordinates) {
        setUserLocation(locationInfo.coordinates)
      }
    }
    getLocation()
  }, [])

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
  
  // エリアデータ取得後、locationパラメータに対応するエリアを設定
  useEffect(() => {
    if (areas.prefectures.length > 0 && !areaInitialized) {
      const location = searchParams.get('location')
      if (location) {
        const prefectureNames = areas.prefectures.map(p => p.prefecture_name)
        const normalizedLocation = normalizeLocationName(location, prefectureNames)
        
        // 都道府県から探す
        const matchedPrefecture = areas.prefectures.find((p: AreaData) => 
          p.prefecture_name === normalizedLocation
        )
        
        if (matchedPrefecture) {
          setSelectedArea(matchedPrefecture.prefecture_name)
          setAreaInitialized(true)
        } else {
          // 市区町村から探す
          const matchedMunicipality = areas.municipalities.find((m: AreaData) => 
            m.full_name?.includes(normalizedLocation) || 
            m.municipality_name?.includes(normalizedLocation)
          )
          
          if (matchedMunicipality) {
            setSelectedArea(matchedMunicipality.full_name || '')
            setAreaInitialized(true)
          }
        }
      }
    }
  }, [areas, searchParams, areaInitialized])

  // ユーザーデータ取得はcurrentPage変更時のフィルタリング処理に統合

  // 特殊フィルタリングタグかどうかをチェック
  const specialFilterTags = ['10代', '身長150cm以下', '身長151cm以上', 'Eカップ以上', 'お酒を飲む人', 'タバコを吸わない人']
  const hasSpecialFilters = selectedTags.some(tag => specialFilterTags.includes(tag))

  // ユーザーデータ取得とフィルタリング処理
  const fetchFilteredUsers = useCallback(async () => {
    try {
      setLoading(true)
      
      // 新しいデータを取得する前に、既存のデータをクリア
      setUsers([])
      setFilteredUsers([])
      setFilteredTotalCount(0)
      
      // エリアが選択されていて、そのエリアに女の子がいない場合は早期リターン
      if (selectedArea && selectedArea !== 'all') {
        // 選択されたエリアの女の子数を確認
        const selectedAreaData = [...areas.prefectures, ...areas.municipalities].find(
          area => area.prefecture_name === selectedArea || area.full_name === selectedArea
        )
        
        if (selectedAreaData && selectedAreaData.girl_count === 0) {
          console.log('Selected area has 0 girls, skipping API call')
          setLoading(false)
          return
        }
      }
      
      // キーワード検索がある場合は全件取得、それ以外はフィルターに応じて調整
      const hasKeywordSearch = searchQuery.trim() !== ''
      const hasAnyFilters = 
        hasSpecialFilters || 
        selectedTags.length > 0 || 
        hasKeywordSearch || 
          selectedStyles.length > 0 ||
        (selectedArea && selectedArea !== 'all') ||
        prioritizeQuickMeet
      
      // キーワード検索時は全件（1000件まで）、その他フィルター時は200件
      const fetchLimit = hasKeywordSearch ? 1000 : (hasAnyFilters ? 200 : LIMIT)
      const offset = hasAnyFilters ? 0 : (currentPage - 1) * LIMIT
      
      // Use optimized API endpoint
      let apiUrl = `/api/mysql-girls-fast?limit=${fetchLimit}&offset=${offset}`
      if (selectedArea && selectedArea !== 'all') {
        apiUrl += `&area=${encodeURIComponent(selectedArea)}`
      }
      if (ageRange[0] !== 18 || ageRange[1] !== 50) {
        apiUrl += `&ageMin=${ageRange[0]}&ageMax=${ageRange[1]}`
      }
      console.log('⚡ Fetching from optimized API:', apiUrl)
      
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
        console.warn('Optimized API failed, falling back to regular API:', error)
        
        // Fallback to regular API endpoint
        const fallbackUrl = apiUrl.replace('/api/mysql-girls-fast', '/api/mysql-girls')
        console.log('Using fallback API:', fallbackUrl)
        
        try {
          response = await fetch(fallbackUrl)
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          
          data = await response.json()
        } catch (fallbackError) {
          console.error('Fallback API also failed:', fallbackError)
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
        console.error('No data received')
        setFilteredUsers([])
        setFilteredTotalCount(0)
        setLoading(false)
        return
      }
      
      const mappedUsers: UserProfile[] = data.girls.map((user: any) => ({
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
        is_tobacco: user.is_tobacco
      }))
      
      // Update total count
      setTotalCount(data.total || 0)
      setUsers(mappedUsers)
      
      // デバッグ: エリアフィルタリングの結果を確認
      console.log('Fetched users count:', mappedUsers.length)
      console.log('Total count from API:', data.total)
      console.log('Selected area:', selectedArea)
      
      // APIから返されたデータが0件の場合は、確実に空の配列を設定
      if (mappedUsers.length === 0 || data.total === 0) {
        console.log('No users found for the selected area')
        setUsers([])  // usersも空にする
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
  }, [currentPage, LIMIT, hasSpecialFilters, selectedArea, selectedTags, searchQuery, selectedStyles, prioritizeQuickMeet, areas, toast])

  useEffect(() => {
    fetchFilteredUsers()
  }, [fetchFilteredUsers])

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
    console.log('Client-side filtering - users count:', users.length)
    console.log('Selected area:', selectedArea)
    console.log('First 3 users:', users.slice(0, 3).map(u => ({ name: u.name, age: u.age, location: u.location })))
    
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
          // 地域名かどうかをチェック
          const isAreaName = areas.prefectures.some(p => 
            p.prefecture_name.toLowerCase().includes(singleQuery)
          ) || areas.municipalities.some(m => 
            m.municipality_name?.toLowerCase().includes(singleQuery) ||
            m.full_name?.toLowerCase().includes(singleQuery)
          )
          
          if (isAreaName) {
            // 地域名の場合は、その地域のユーザーのみ表示
            filtered = filtered.filter(user => 
              user.location.toLowerCase().includes(singleQuery)
            )
            
            // 該当地域にユーザーがいない場合は空配列を返す
            if (filtered.length === 0) {
              console.log(`No users found in area: ${singleQuery}`)
            }
          } else {
            // 通常の検索（名前、プロフィール、興味）
            filtered = filtered.filter(user => 
              user.name.toLowerCase().includes(singleQuery) ||
              user.bio.toLowerCase().includes(singleQuery) ||
              user.interests.some(interest => interest.toLowerCase().includes(singleQuery))
            )
          }
        }
      } else {
        // 複数キーワードの場合はAND検索
        // まず地域名キーワードをチェック
        const areaKeywords = keywords.filter(keyword => 
          areas.prefectures.some(p => 
            p.prefecture_name.toLowerCase().includes(keyword)
          ) || areas.municipalities.some(m => 
            m.municipality_name?.toLowerCase().includes(keyword) ||
            m.full_name?.toLowerCase().includes(keyword)
          )
        )
        
        // 地域名が含まれている場合、まずその地域でフィルタリング
        if (areaKeywords.length > 0) {
          filtered = filtered.filter(user => 
            areaKeywords.every(areaKeyword => 
              user.location.toLowerCase().includes(areaKeyword)
            )
          )
        }
        
        // 残りのキーワードでフィルタリング
        const nonAreaKeywords = keywords.filter(k => !areaKeywords.includes(k))
        if (nonAreaKeywords.length > 0) {
          filtered = filtered.filter(user => {
            return nonAreaKeywords.every(keyword => {
              // 各キーワードは名前、プロフィール、興味、身体情報のいずれかにマッチすればOK
              const userStr = [
                user.name,
                user.bio,
                ...user.interests,
                user.age ? user.age.toString() : '不明',
                user.height ? `${user.height}cm` : '',
                user.cup ? `${user.cup}カップ` : ''
              ].join(' ').toLowerCase()
              
              return userStr.includes(keyword)
            })
          })
        }
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
        
        // 10代: 18-19歳
        if (selectedTags.includes('10代') && user.age >= 18 && user.age <= 19) {
          matchesSpecialTags = true
        }
        
        // 身長150cm以下
        if (selectedTags.includes('身長150cm以下') && user.height && user.height <= 150) {
          matchesSpecialTags = true
        }
        
        // 身長151cm以上
        if (selectedTags.includes('身長151cm以上') && user.height && user.height >= 151) {
          matchesSpecialTags = true
        }
        
        // Eカップ以上
        if (selectedTags.includes('Eカップ以上') && user.cup) {
          const cupOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
          const userCupIndex = cupOrder.indexOf(user.cup.toUpperCase())
          const eCupIndex = cupOrder.indexOf('E')
          if (userCupIndex >= eCupIndex) {
            matchesSpecialTags = true
          }
        }
        
        // お酒を飲む人（is_sake=true）
        if (selectedTags.includes('お酒を飲む人') && user.is_sake === true) {
          matchesSpecialTags = true
        }
        
        // タバコを吸わない人（is_tobacco=false）
        if (selectedTags.includes('タバコを吸わない人') && user.is_tobacco === false) {
          matchesSpecialTags = true
        }
        
        // OR条件：通常タグまたは特殊タグのいずれかにマッチ
        return matchesNormalTags || matchesSpecialTags
      })
    }

    // エリアフィルターはサーバーサイドで処理済み

    // 年齢フィルター（特殊タグが選択されていない場合のみ適用）
    const hasAgeSpecialTag = selectedTags.includes('10代')
    if (!hasAgeSpecialTag) {
      const beforeCount = filtered.length
      // デフォルト範囲（18-50）の場合はNULL年齢も含める、それ以外は除外
      const isDefaultRange = ageRange[0] === 18 && ageRange[1] === 50
      filtered = filtered.filter(user => {
        if (user.age === null || user.age === undefined) {
          return isDefaultRange // デフォルト範囲の時のみNULL年齢を表示
        }
        return user.age >= ageRange[0] && user.age <= ageRange[1]
      })
      console.log(`Age filter applied: ${beforeCount} -> ${filtered.length} (Range: ${ageRange[0]}-${ageRange[1]}, Default: ${isDefaultRange})`)
      console.log('Filtered users with null age:', filtered.filter(u => u.age === null || u.age === undefined).length)
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
            if (user.name.toLowerCase().includes(query)) score += 15
            if (user.bio.toLowerCase().includes(query)) score += 10
            if (user.location.toLowerCase().includes(query)) score += 8
            if (user.interests.some(i => i.toLowerCase().includes(query))) score += 5
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

    console.log('Client-side filtering result:', filtered.length)
    console.log('Final filtered users (first 3):', filtered.slice(0, 3).map(u => ({ name: u.name, age: u.age, location: u.location })))
    
    setFilteredUsers(filtered)
    setFilteredTotalCount(filtered.length)
  }, [users, searchQuery, selectedTags, selectedArea, ageRange, selectedStyles, sortBy, userLocation, prioritizeQuickMeet])

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
  
  // エリア変更時は即座にデータをクリア
  useEffect(() => {
    console.log('Area changed to:', selectedArea)
    // エリアが変更されたら、即座に表示をクリア
    setUsers([])
    setFilteredUsers([])
    setFilteredTotalCount(0)
  }, [selectedArea])
  
  // 年齢変更は別途処理（ページリセットしない）
  useEffect(() => {
    // 年齢が変更されても現在のページを維持
  }, [ageRange])

  // いいね送信
  const handleLike = async (userId: string) => {
    if (!currentUser) {
      toast({
        title: 'ログインが必要です',
        description: 'いいねを送るにはログインしてください'
      })
      router.push('/login')
      return
    }

    try {
      await sendLike(currentUser.uid, userId)
      toast({
        title: 'いいねを送りました',
        description: 'お相手に通知が送られます'
      })
    } catch (error) {
      toast({
        title: 'エラー',
        description: 'いいねの送信に失敗しました',
        variant: 'destructive'
      })
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
          <p className="text-xs text-gray-500 mt-1">
            年齢(25, 25歳)、身長(160cm, 160cm以上)、カップ(Dカップ, Eカップ以上)、地域名、「不明」で年齢不明者<br/>
            複数単語はスペース区切りでAND検索（例: 渋谷 160cm Dカップ）
          </p>
        </div>

        {/* 性癖・プレイスタイル */}
        <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            <Heart className="w-4 h-4" />
            性癖・プレイスタイル
          </h3>
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
                <span className="text-sm text-gray-500 ml-2">
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
            {(hasSpecialFilters 
              ? filteredUsers.slice((currentPage - 1) * LIMIT, currentPage * LIMIT)
              : filteredUsers
            ).map(user => (
            <Card key={user.id} className={styles.profileCard}>
              <div className={styles.profileImage}>
                <Image
                  src={user.imageUrl}
                  alt={user.name}
                  fill
                  className="object-cover"
                />
                <div className={styles.profileBlur} />
              </div>
              <CardContent className={styles.profileInfo}>
                <h3 className={styles.profileName}>{user.name}</h3>
                <div className={styles.profileDetails}>
                  <span>{user.age ? `${user.age}歳` : '不明'}</span>
                  <span>•</span>
                  <span>{user.location}</span>
                  {user.distance && (
                    <>
                      <span>•</span>
                      <span>{Math.round(user.distance)}km</span>
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
                <p className={styles.profileBio}>{user.bio}</p>
                <div className={styles.profileActions}>
                  <Button
                    variant="outline"
                    className={styles.actionLike}
                    onClick={() => handleLike(user.id)}
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
            <h3 className={styles.emptyTitle}>該当するユーザーが見つかりません</h3>
            <p className={styles.emptyText}>
              フィルター条件を変更してもう一度お試しください
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