'use client'

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
import { MultiSelect, type Option } from '@/components/ui/multi-select'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Heart, StickyNote, MapPin, Clock, Filter, Grid3x3, List, Search, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getCurrentLocation, type LocationCoordinates } from '@/lib/utils/location'
import { getLocationCoordinates } from '@/lib/utils/japanLocations'
import { useUserProfile } from '@/lib/firebase/hooks'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useLikeOptimistic } from '@/lib/hooks/useLikeOptimistic'
import { useMemoOptimistic } from '@/lib/hooks/useMemoOptimistic'
import Image from 'next/image'
import styles from './search.module.scss'
import './search-dialog.css'
import { fetchWithDedup, roundLocation, generateCacheKey } from '@/lib/utils/api-request-manager'

interface GirlType {
  id?: number
  name: string
}

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
  municipality?: string
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
  girlTypes?: (string | GirlType)[] // Girl types from database - can be string or object
  serverOrder?: number // サーバー側の元の順序（距離順の最適化を維持）
}

// 性癖・プレイスタイルのタグ
const personalityTags = [
  '10代', '20代', '30代', '40代', '50代',
  '身長150cm以下', '身長155cm以下', '身長160cm以下',
  '身長165cm以上',
  'Bカップ以下', 'Cカップ', 'Dカップ', 'Eカップ',
  'Fカップ', 'Gカップ以上',
  'お酒を飲む人', 'お酒を飲まない人', 'タバコを吸う人', 'タバコを吸わない人',
  '撮影OK', 'コスプレ対応', 'おもちゃプレイ', 'イラマ・ディープスロート',
  'ごっくんOK', 'アナル対応', '複数プレイ', 'ドS女王様', 'ドM受け身'
]

const serverFilterTagConfig: Record<
  string,
  (params: Record<string, any>) => void
> = {
  '撮影OK': params => {
    params.recordingDuringPlay = 'はい'
  },
  'コスプレ対応': params => {
    params.cosplayPreference = Math.max(params.cosplayPreference ?? 0, 4)
  },
  'おもちゃプレイ': params => {
    params.toyPlayPreference = Math.max(params.toyPlayPreference ?? 0, 4)
  },
  'イラマ・ディープスロート': params => {
    params.deepthroatPreference = Math.max(params.deepthroatPreference ?? 0, 4)
  },
  'ごっくんOK': params => {
    params.throatingPreference = Math.max(params.throatingPreference ?? 0, 4)
  },
  'アナル対応': params => {
    params.analPlayPreference = Math.max(params.analPlayPreference ?? 0, 4)
  },
  '複数プレイ': params => {
    params.groupPlayPreference = Math.max(params.groupPlayPreference ?? 0, 4)
  },
  'ドS女王様': params => {
    params.isMasochist = 'はい'
  },
  'ドM受け身': params => {
    params.isSadist = 'はい'
  }
}

const serverFilterTagSet = new Set(Object.keys(serverFilterTagConfig))

const clientFilterTagSet = new Set([
  '10代', '20代', '30代', '40代', '50代',
  '身長150cm以下', '身長155cm以下', '身長160cm以下',
  '身長165cm以上',
  'Bカップ以下', 'Cカップ', 'Dカップ', 'Eカップ',
  'Fカップ', 'Gカップ以上',
  'お酒を飲む人', 'お酒を飲まない人', 'タバコを吸う人', 'タバコを吸わない人',
  'ドS女王様', 'ドM受け身'
])

type ClientConstraints = {
  heightUpper?: number
  heightLower?: number
  ageMin?: number
  ageMax?: number
  cupMinIndex?: number
  cupMaxIndex?: number
  requireSake?: boolean | null
  requireTobacco?: boolean | null
  girlTypePatterns?: RegExp[]
}

interface ParsedQuery {
  areaKeyword: string | null
  generalKeywords: string[]
  serverTags: Set<string>
  clientConstraints: ClientConstraints
  hasNonLocationKeywordSearch: boolean
}

const CUP_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

const AGE_TAG_RANGES: Record<string, [number, number]> = {
  '10代': [18, 19],
  '20代': [20, 29],
  '30代': [30, 39],
  '40代': [40, 49],
  '50代': [50, 59]
}

const DEFAULT_AGE_RANGE: [number, number] = [18, 50]
const ageTagSet = new Set<string>(Object.keys(AGE_TAG_RANGES))

const computeAgeRangeFromTags = (tags: Iterable<string>): [number, number] | null => {
  let minAge: number | null = null
  let maxAge: number | null = null

  for (const tag of tags) {
    const range = AGE_TAG_RANGES[tag]
    if (!range) continue
    const [candidateMin, candidateMax] = range
    minAge = minAge === null ? candidateMin : Math.min(minAge, candidateMin)
    maxAge = maxAge === null ? candidateMax : Math.max(maxAge, candidateMax)
  }

  if (minAge === null || maxAge === null) {
    return null
  }

  const clampedMin = Math.max(DEFAULT_AGE_RANGE[0], minAge)
  const clampedMax = Math.max(clampedMin, Math.min(DEFAULT_AGE_RANGE[1], maxAge))
  return [clampedMin, clampedMax]
}

const getCupIndex = (cup?: string | null): number | null => {
  if (!cup) return null
  const normalized = cup.toString().trim().toUpperCase()
  const index = CUP_ORDER.indexOf(normalized)
  return index >= 0 ? index : null
}

const getCupLabelFromIndex = (index?: number): string | null => {
  if (index === undefined || index === null) return null
  if (index < 0 || index >= CUP_ORDER.length) return null
  return CUP_ORDER[index] ?? null
}

const mergeConstraints = (base: ClientConstraints, update: ClientConstraints): ClientConstraints => {
  const merged: ClientConstraints = { ...base }

  if (update.heightUpper !== undefined) {
    merged.heightUpper = merged.heightUpper !== undefined
      ? Math.min(merged.heightUpper, update.heightUpper)
      : update.heightUpper
  }
  if (update.heightLower !== undefined) {
    merged.heightLower = merged.heightLower !== undefined
      ? Math.max(merged.heightLower, update.heightLower)
      : update.heightLower
  }
  if (update.ageMin !== undefined) {
    merged.ageMin = merged.ageMin !== undefined
      ? Math.max(merged.ageMin, update.ageMin)
      : update.ageMin
  }
  if (update.ageMax !== undefined) {
    merged.ageMax = merged.ageMax !== undefined
      ? Math.min(merged.ageMax, update.ageMax)
      : update.ageMax
  }
  if (update.cupMinIndex !== undefined) {
    merged.cupMinIndex = merged.cupMinIndex !== undefined
      ? Math.max(merged.cupMinIndex, update.cupMinIndex)
      : update.cupMinIndex
  }
  if (update.cupMaxIndex !== undefined) {
    merged.cupMaxIndex = merged.cupMaxIndex !== undefined
      ? Math.min(merged.cupMaxIndex, update.cupMaxIndex)
      : update.cupMaxIndex
  }
  if (update.requireSake !== undefined) {
    merged.requireSake = update.requireSake
  }
  if (update.requireTobacco !== undefined) {
    merged.requireTobacco = update.requireTobacco
  }
  if (update.girlTypePatterns && update.girlTypePatterns.length > 0) {
    merged.girlTypePatterns = [
      ...(merged.girlTypePatterns ?? []),
      ...update.girlTypePatterns
    ]
  }

  return merged
}

const deriveConstraintsFromTags = (tagSet: Set<string>): ClientConstraints => {
  let constraints: ClientConstraints = {}

  tagSet.forEach(tag => {
    const ageRange = AGE_TAG_RANGES[tag]
    if (ageRange) {
      const [minAge, maxAge] = ageRange
      constraints = mergeConstraints(constraints, {
        ageMin: minAge,
        ageMax: maxAge
      })
    }
  })

  if (tagSet.has('身長150cm以下')) {
    constraints = mergeConstraints(constraints, { heightUpper: 150 })
  }
  if (tagSet.has('身長155cm以下')) {
    constraints = mergeConstraints(constraints, { heightUpper: 155 })
  }
  if (tagSet.has('身長160cm以下')) {
    constraints = mergeConstraints(constraints, { heightUpper: 160 })
  }
  if (tagSet.has('身長165cm以上')) {
    constraints = mergeConstraints(constraints, { heightLower: 165 })
  }

  if (tagSet.has('Bカップ以下')) {
    constraints = mergeConstraints(constraints, { cupMaxIndex: getCupIndex('B') ?? undefined })
  }
  if (tagSet.has('Cカップ')) {
    const idx = getCupIndex('C')
    constraints = mergeConstraints(constraints, {
      cupMinIndex: idx ?? undefined,
      cupMaxIndex: idx ?? undefined
    })
  }
  if (tagSet.has('Dカップ')) {
    const idx = getCupIndex('D')
    constraints = mergeConstraints(constraints, {
      cupMinIndex: idx ?? undefined,
      cupMaxIndex: idx ?? undefined
    })
  }
  if (tagSet.has('Eカップ')) {
    const idx = getCupIndex('E')
    constraints = mergeConstraints(constraints, {
      cupMinIndex: idx ?? undefined,
      cupMaxIndex: idx ?? undefined
    })
  }
  if (tagSet.has('Fカップ')) {
    const idx = getCupIndex('F')
    constraints = mergeConstraints(constraints, {
      cupMinIndex: idx ?? undefined,
      cupMaxIndex: idx ?? undefined
    })
  }
  if (tagSet.has('Gカップ以上')) {
    constraints = mergeConstraints(constraints, { cupMinIndex: getCupIndex('G') ?? undefined })
  }

  if (tagSet.has('お酒を飲む人')) {
    constraints = mergeConstraints(constraints, { requireSake: true })
  }
  if (tagSet.has('お酒を飲まない人')) {
    constraints = mergeConstraints(constraints, { requireSake: false })
  }
  if (tagSet.has('タバコを吸う人')) {
    constraints = mergeConstraints(constraints, { requireTobacco: true })
  }
  if (tagSet.has('タバコを吸わない人')) {
    constraints = mergeConstraints(constraints, { requireTobacco: false })
  }

  const girlTypePatterns: RegExp[] = []
  if (tagSet.has('ドS女王様')) {
    girlTypePatterns.push(/(ドs|ドＳ|ｓ女|Ｓ女|サド|女王|クイーン|S気質)/i)
  }
  if (tagSet.has('ドM受け身')) {
    girlTypePatterns.push(/(ドm|ドＭ|ｍ女|Ｍ女|マゾ|受け身|M気質)/i)
  }
  if (girlTypePatterns.length > 0) {
    constraints = mergeConstraints(constraints, { girlTypePatterns })
  }

  return constraints
}

const parseSearchQuery = (raw: string): ParsedQuery => {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      areaKeyword: null,
      generalKeywords: [],
      serverTags: new Set(),
      clientConstraints: {},
      hasNonLocationKeywordSearch: false
    }
  }

  const serverTags = new Set<string>()
  let clientConstraints: ClientConstraints = {}
  const generalKeywords: string[] = []
  let areaKeyword: string | null = null
  const locationSuffixRegex = /[区市町村]$/

  const tokens = trimmed.split(/\s+/)
  tokens.forEach(token => {
    const normalizedToken = token.trim()
    if (!normalizedToken) return
    const lowerToken = normalizedToken.toLowerCase()

    if (!areaKeyword && locationSuffixRegex.test(normalizedToken)) {
      areaKeyword = normalizedToken
      return
    }

    let matched = false

    const heightCandidate = lowerToken.replace(/身長/g, '')
    const heightMatch = heightCandidate.match(/(\d{2,3})\s*cm(以上|以下)?/)
    if (heightMatch) {
      const value = parseInt(heightMatch[1])
      if (!Number.isNaN(value)) {
        if (heightMatch[2] === '以上') {
          clientConstraints = mergeConstraints(clientConstraints, { heightLower: value })
        } else if (heightMatch[2] === '以下') {
          clientConstraints = mergeConstraints(clientConstraints, { heightUpper: value })
        } else {
          clientConstraints = mergeConstraints(clientConstraints, { heightUpper: value, heightLower: value })
        }
        matched = true
      }
    }

    if (!matched) {
      const ageCandidate = lowerToken.replace(/年齢/g, '')
      const ageMatch = ageCandidate.match(/(\d{1,2})\s*(?:歳|才)(以上|以下)?/)
      if (ageMatch) {
        const value = parseInt(ageMatch[1])
        if (!Number.isNaN(value)) {
          if (ageMatch[2] === '以上') {
            clientConstraints = mergeConstraints(clientConstraints, { ageMin: value })
          } else if (ageMatch[2] === '以下') {
            clientConstraints = mergeConstraints(clientConstraints, { ageMax: value })
          } else {
            clientConstraints = mergeConstraints(clientConstraints, { ageMin: value, ageMax: value })
          }
          matched = true
        }
      }
    }

    if (!matched) {
      const cupMatch = normalizedToken.toUpperCase().match(/([A-K])カップ(以上|以下)?/)
      if (cupMatch) {
        const index = getCupIndex(cupMatch[1])
        if (index !== null) {
          if (cupMatch[2] === '以上') {
            clientConstraints = mergeConstraints(clientConstraints, { cupMinIndex: index })
          } else if (cupMatch[2] === '以下') {
            clientConstraints = mergeConstraints(clientConstraints, { cupMaxIndex: index })
          } else {
            clientConstraints = mergeConstraints(clientConstraints, { cupMinIndex: index, cupMaxIndex: index })
          }
          matched = true
        }
      }
    }

    const lower = normalizedToken.toLowerCase()
    if (!matched) {
      if (/(撮影|動画|写真|録画|録音)/i.test(normalizedToken)) {
        serverTags.add('撮影OK')
        matched = true
      } else if (/(コスプレ|衣装|制服)/i.test(normalizedToken)) {
        serverTags.add('コスプレ対応')
        matched = true
      } else if (/(電マ|ローター|バイブ|玩具|おもちゃ)/i.test(normalizedToken)) {
        serverTags.add('おもちゃプレイ')
        matched = true
      } else if (/(イラマ|ディープスロート|dee?p)/i.test(lower)) {
        serverTags.add('イラマ・ディープスロート')
        matched = true
      } else if (/(ごっくん|精飲|飲精)/i.test(normalizedToken)) {
        serverTags.add('ごっくんOK')
        matched = true
      } else if (/(アナル|af|ＡＦ)/i.test(normalizedToken)) {
        serverTags.add('アナル対応')
        matched = true
      } else if (/(3p|４p|複数|乱交)/i.test(normalizedToken)) {
        serverTags.add('複数プレイ')
        matched = true
      } else if (/(ドs|ドＳ|サド|女王|クイーン)/i.test(normalizedToken)) {
        clientConstraints = mergeConstraints(clientConstraints, {
          girlTypePatterns: [/(ドs|ドＳ|ｓ女|Ｓ女|サド|女王|クイーン|S気質)/i]
        })
        matched = true
      } else if (/(ドm|ドＭ|マゾ|受け身)/i.test(normalizedToken)) {
        clientConstraints = mergeConstraints(clientConstraints, {
          girlTypePatterns: [/(ドm|ドＭ|ｍ女|Ｍ女|マゾ|受け身|M気質)/i]
        })
        matched = true
      } else if (/(お酒|飲酒)/i.test(normalizedToken)) {
        if (/(飲まない|苦手|嫌)/i.test(normalizedToken)) {
          clientConstraints = mergeConstraints(clientConstraints, { requireSake: false })
        } else {
          clientConstraints = mergeConstraints(clientConstraints, { requireSake: true })
        }
        matched = true
      } else if (/(タバコ|喫煙|煙草)/i.test(normalizedToken)) {
        if (/(吸わない|苦手|嫌)/i.test(normalizedToken)) {
          clientConstraints = mergeConstraints(clientConstraints, { requireTobacco: false })
        } else {
          clientConstraints = mergeConstraints(clientConstraints, { requireTobacco: true })
        }
        matched = true
      }
    }

    if (!matched) {
      generalKeywords.push(lower)
    }
  })

  const hasNonLocationKeywordSearch =
    generalKeywords.length > 0 ||
    Object.keys(clientConstraints).length > 0 ||
    serverTags.size > 0

  return {
    areaKeyword,
    generalKeywords,
    serverTags,
    clientConstraints,
    hasNonLocationKeywordSearch
  }
}

const hasGirlTypeKeyword = (user: UserProfile, patterns: RegExp[]): boolean => {
  if (!user.girlTypes || user.girlTypes.length === 0) return false
  return user.girlTypes.some(type => {
    if (!type) return false
    const name =
      typeof type === 'string'
        ? type
        : (typeof type === 'object' && 'name' in type ? (type as { name?: string | null }).name ?? '' : '')
    if (!name) return false
    const normalized = name.toString().toLowerCase()
    return patterns.some(pattern => pattern.test(normalized))
  })
}

const matchesClientConstraints = (user: UserProfile, constraints: ClientConstraints): boolean => {
  if (constraints.heightUpper !== undefined) {
    const height = user.height ?? null
    if (height === null || height > constraints.heightUpper) {
      return false
    }
  }
  if (constraints.heightLower !== undefined) {
    const height = user.height ?? null
    if (height === null || height < constraints.heightLower) {
      return false
    }
  }
  if (constraints.ageMin !== undefined) {
    const age = user.age ?? null
    if (age === null || age < constraints.ageMin) {
      return false
    }
  }
  if (constraints.ageMax !== undefined) {
    const age = user.age ?? null
    if (age === null || age > constraints.ageMax) {
      return false
    }
  }
  if (constraints.cupMinIndex !== undefined || constraints.cupMaxIndex !== undefined) {
    const index = getCupIndex(user.cup)
    if (index === null) {
      return false
    }
    if (constraints.cupMinIndex !== undefined && index < constraints.cupMinIndex) {
      return false
    }
    if (constraints.cupMaxIndex !== undefined && index > constraints.cupMaxIndex) {
      return false
    }
  }
  if (constraints.requireSake !== undefined) {
    if (constraints.requireSake === true && user.is_sake !== true) {
      return false
    }
    if (constraints.requireSake === false && user.is_sake !== false) {
      return false
    }
  }
  if (constraints.requireTobacco !== undefined) {
    if (constraints.requireTobacco === true && user.is_tobacco !== true) {
      return false
    }
    if (constraints.requireTobacco === false && user.is_tobacco !== false) {
      return false
    }
  }
  if (constraints.girlTypePatterns && constraints.girlTypePatterns.length > 0) {
    if (!hasGirlTypeKeyword(user, constraints.girlTypePatterns)) {
      return false
    }
  }
  return true
}


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
  const { hasPremium: isPremium, isLoading: subscriptionLoading } = useSubscription()
  const { toast } = useToast()
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  // 有料会員状態を直接使用
  // subscriptionLoadingがfalseでisPremiumがfalseの場合のみモザイクを適用

  // 楽観的UIフック
  const { handleLikeOptimistic, likingStates, isLiked } = useLikeOptimistic()
  const { prefetchMemoPage, handleMemoNavigation, navigatingStates } = useMemoOptimistic()
  
  // State
  const [users, setUsers] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [hasInitialDataLoaded, setHasInitialDataLoaded] = useState(false) // 初回データ取得完了フラグ
  const [loading, setLoading] = useState(true) // 初回はローディング表示、2回目以降は高速化のためfalse
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showMobileFilter, setShowMobileFilter] = useState(false)
  const [areas, setAreas] = useState<{ prefectures: AreaData[], municipalities: AreaData[] }>({ 
    prefectures: [], 
    municipalities: [] 
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [sortedDataCache, setSortedDataCache] = useState<UserProfile[] | null>(null) // ソート済みデータのキャッシュ
  const [initialFetchDone, setInitialFetchDone] = useState(false) // 初回データ取得完了フラグ
  const LIMIT = 20 // 20 items per page for pagination

  // Filters
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedGirlTypes, setSelectedGirlTypes] = useState<string[]>([]) // For girl types filter
  const [availableGirlTypes, setAvailableGirlTypes] = useState<string[]>([]) // Available girl types from DB
  const [girlTypeOptions, setGirlTypeOptions] = useState<Option[]>([]) // For MultiSelect component
  const [selectedArea, setSelectedArea] = useState('all')
  const [selectedTime, setSelectedTime] = useState('now')
  const [ageRange, setAgeRange] = useState<[number, number]>(() => [...DEFAULT_AGE_RANGE] as [number, number])
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('distance') // デフォルトを距離順に変更
  const [filtersApplied, setFiltersApplied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchQueryInput, setSearchQueryInput] = useState('') // 入力値を別管理
  const [prioritizeQuickMeet, setPrioritizeQuickMeet] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [filteredTotalCount, setFilteredTotalCount] = useState(0)
  const [openAreaPopover, setOpenAreaPopover] = useState(false)
  const [locationFilteredServerSide, setLocationFilteredServerSide] = useState(false)
  const [useClientFiltering, setUseClientFiltering] = useState(false)
  const [pageCache, setPageCache] = useState<Record<number, UserProfile[]>>({})

  // 動的に計算されるページ数（フィルタリング後のカウントを使用）
  const totalPages = Math.ceil(filteredTotalCount / LIMIT)

  // locationパラメータから座標を取得
  const [locationFromParam, setLocationFromParam] = useState<string>('')
  const [locationCoordinates, setLocationCoordinates] = useState<LocationCoordinates | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [userSelectedArea, setUserSelectedArea] = useState(false) // ユーザーが手動でエリアを選択したか
  const fetchSignatureRef = useRef<string>('')
  const fetchedPagesRef = useRef<Set<number>>(new Set())
  const pendingPagesRef = useRef<Set<number>>(new Set())
  const tagsKey = useMemo(() => [...selectedTags].sort().join('|'), [selectedTags])
  const stylesKey = useMemo(() => [...selectedStyles].sort().join('|'), [selectedStyles])
  const girlTypesKey = useMemo(() => [...selectedGirlTypes].sort().join('|'), [selectedGirlTypes])
  const ageMin = ageRange[0]
  const ageMax = ageRange[1]
  const userLat = userLocation?.lat ?? null
  const userLng = userLocation?.lng ?? null
  const majorFilterKey = useMemo(
    () =>
      JSON.stringify({
        selectedArea,
        tagsKey,
        searchQuery,
        stylesKey,
        prioritizeQuickMeet,
        ageMin,
        ageMax,
        girlTypesKey,
        userSelectedArea,
        locationFromParam,
        userLat,
        userLng
      }),
    [
      selectedArea,
      tagsKey,
      searchQuery,
      stylesKey,
      prioritizeQuickMeet,
      ageMin,
      ageMax,
      girlTypesKey,
      userSelectedArea,
      locationFromParam,
      userLat,
      userLng
    ]
  )
  const prevMajorKeyRef = useRef<string | null>(null)

  const displayedUsers = useMemo(() => {
    if (useClientFiltering) {
      return filteredUsers.slice((currentPage - 1) * LIMIT, currentPage * LIMIT)
    }
    const pageUsers = pageCache[currentPage]
    if (pageUsers && pageUsers.length > 0) {
      return pageUsers
    }
    return filteredUsers.slice((currentPage - 1) * LIMIT, currentPage * LIMIT)
  }, [useClientFiltering, filteredUsers, currentPage, LIMIT, pageCache])
  const overallCount = useMemo(() => {
    if (totalCount > 0) return totalCount
    return filteredTotalCount
  }, [totalCount, filteredTotalCount])
  const currentPageCount = displayedUsers.length
  const hiddenCount = Math.max(overallCount - currentPageCount, 0)
  
  // 初期パラメータの読み込み（初回のみ）
  useEffect(() => {
    if (!isInitialLoad) return;
    
    const tags = searchParams.get('tags')
    const girlTypes = searchParams.get('girlTypes')
    const location = searchParams.get('location')
    const area = searchParams.get('area')
    const time = searchParams.get('time')
    const quick = searchParams.get('quick')
    const q = searchParams.get('q')
    
    if (tags) setSelectedTags(tags.split(','))
    if (girlTypes) setSelectedGirlTypes(girlTypes.split(','))
    if (area) {
      // /search/advanced?area=東京都 など
      setSelectedArea(area)
      setUserSelectedArea(true)
      // area 指定時は検索クエリは使用しない
      setSearchQuery('')
      setSearchQueryInput('')
    } else if (location) {
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

  // 位置情報取得（ログイン状態に関係なく全ユーザーが利用可能）
  useEffect(() => {
    const getLocation = async () => {
      try {
        const locationInfo = await getCurrentLocation(true) // 住所取得をスキップして高速化
        if (locationInfo.coordinates) {
          setUserLocation(locationInfo.coordinates)
          console.log('📍 位置情報取得成功:', locationInfo.coordinates)
        }
      } catch (error) {
        console.error('位置情報取得エラー:', error)
        // 位置情報が取得できない場合、フォールバックとして東京駅の座標を設定
        console.log('📍 位置情報取得失敗 - 東京エリアをデフォルト表示に設定')
        // userLocationはnullのままにして、API側でフォールバック処理
      }
    }

    // ログイン状態に関係なく位置情報を取得
    // これにより、未ログインユーザーも近くの女性を見ることができる
    if (!locationFromParam) {
      getLocation()
    }
  }, [locationFromParam]) // isAuthenticatedを依存配列から削除

  // エリアデータ取得
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await fetch('/api/areas')
        if (!response.ok) {
          throw new Error(`Failed to fetch areas: ${response.status}`)
        }

        const data = await response.json()
        setAreas({
          prefectures: data.prefectures ?? [],
          municipalities: data.municipalities ?? []
        })
      } catch (error) {
        console.error('Error fetching areas:', error)
        setAreas({ prefectures: [], municipalities: [] })
      }
    }
    fetchAreas()
  }, [])
  
  // Fetch available girl types
  useEffect(() => {
    const fetchGirlTypes = async () => {
      try {
        const response = await fetch('/api/girl-types')
        if (response.ok) {
          const data = await response.json()
          
          // Sort types by class_id and id to maintain consistent order from DB
          const sortedTypes = data.allTypes
            .sort((a: any, b: any) => {
              if (a.class_id !== b.class_id) {
                return a.class_id - b.class_id;
              }
              return a.id - b.id;
            })
            .map((type: any) => type.name)
          
          setAvailableGirlTypes(sortedTypes)
          
          // Create options for MultiSelect
          const options: Option[] = sortedTypes.map((type: string) => ({
            value: type,
            label: type
          }))
          setGirlTypeOptions(options)
        }
      } catch (error) {
        console.error('Error fetching girl types:', error)
      }
    }
    fetchGirlTypes()
  }, [])
  
  // エリアデータ取得後の初期化（削除）

  // ユーザーデータ取得はcurrentPage変更時のフィルタリング処理に統合

  const clientSelectedTags = useMemo(
    () => selectedTags.filter(tag => clientFilterTagSet.has(tag)),
    [selectedTags]
  )

  const handleTagChange = useCallback((newTags: string[]) => {
    setSelectedTags(newTags)

    const derivedRange = computeAgeRangeFromTags(newTags)
    if (derivedRange) {
      setAgeRange(prev => {
        if (prev[0] === derivedRange[0] && prev[1] === derivedRange[1]) {
          return prev
        }
        return derivedRange
      })
      return
    }

    setAgeRange(prev => {
      if (prev[0] === DEFAULT_AGE_RANGE[0] && prev[1] === DEFAULT_AGE_RANGE[1]) {
        return prev
      }
      return [...DEFAULT_AGE_RANGE] as [number, number]
    })
  }, [])
  const parsedQuery = useMemo(() => parseSearchQuery(searchQuery), [searchQuery])
  const hasNonLocationKeywordSearch = parsedQuery.hasNonLocationKeywordSearch
  const tagConstraints = useMemo(() => deriveConstraintsFromTags(new Set(clientSelectedTags)), [clientSelectedTags])
  const combinedConstraints = useMemo(() => mergeConstraints(tagConstraints, parsedQuery.clientConstraints), [tagConstraints, parsedQuery.clientConstraints])
  const hasClientConstraintRules = Object.keys(combinedConstraints).length > 0
  const requiresClientFiltering = useMemo(
    () =>
      hasClientConstraintRules ||
      hasNonLocationKeywordSearch ||
      selectedStyles.length > 0 ||
      prioritizeQuickMeet ||
      sortBy !== 'distance' ||
      selectedTags.some(tag => !serverFilterTagSet.has(tag) && !clientFilterTagSet.has(tag)),
    [
      hasClientConstraintRules,
      hasNonLocationKeywordSearch,
      selectedStyles.length,
      prioritizeQuickMeet,
      sortBy,
      selectedTags
    ]
  )
  useEffect(() => {
    if (useClientFiltering !== requiresClientFiltering) {
      setUseClientFiltering(requiresClientFiltering)
    }
  }, [requiresClientFiltering, useClientFiltering])

  useEffect(() => {
    const derivedRange = computeAgeRangeFromTags(clientSelectedTags)
    if (!derivedRange) {
      return
    }

    const [clampedMin, clampedMax] = derivedRange
    setAgeRange(prev => {
      if (prev[0] === clampedMin && prev[1] === clampedMax) {
        return prev
      }
      return [clampedMin, clampedMax] as [number, number]
    })
  }, [clientSelectedTags])

  // ユーザーデータ取得とフィルタリング処理
  const fetchFilteredUsers = useCallback(
    async (pageOverride?: number, reset: boolean = false) => {
      const targetPage = pageOverride ?? currentPage
      const flattenCache = (cache: Record<number, UserProfile[]>) =>
        Object.keys(cache)
          .map(Number)
          .sort((a, b) => a - b)
          .flatMap(page => cache[page])

      const clearCachedState = () => {
        setUsers([])
        setFilteredUsers([])
        setSortedDataCache(null)
        setFilteredTotalCount(0)
        setTotalCount(0)
        setPageCache({})
        fetchedPagesRef.current = new Set()
        pendingPagesRef.current = new Set()
      }

      if (reset) {
        setLoading(true)
        setHasInitialDataLoaded(false)
        setInitialFetchDone(false)
        clearCachedState()
      }

      if (!locationFromParam && selectedArea && selectedArea !== 'all') {
        const selectedAreaData = [...areas.prefectures, ...areas.municipalities].find(
          area => area.prefecture_name === selectedArea || area.full_name === selectedArea
        )

        if (selectedAreaData && selectedAreaData.girl_count === 0) {
          setLoading(false)
          setFilteredUsers([])
          setFilteredTotalCount(0)
          return
        }
      }

      const keywordArea = parsedQuery.areaKeyword
      let searchAreaName: string | null = keywordArea

      let effectiveArea: string | null = null
      if (userSelectedArea && selectedArea !== 'all') {
        effectiveArea = selectedArea
      } else if (!userSelectedArea && selectedArea !== 'all' && !locationFromParam) {
        effectiveArea = selectedArea
      } else if (searchAreaName) {
        effectiveArea = searchAreaName
      }

      setLocationFilteredServerSide(!!searchAreaName)

      const normalizedLocation = userLocation ? roundLocation(userLocation.lat, userLocation.lng, 2) : null

      const baseParams: Record<string, any> = {
        scheduleDate: 'today',
        scheduleRangeDays: 7
      }

      const constraintAgeMin = combinedConstraints.ageMin
      const constraintAgeMax = combinedConstraints.ageMax
      const sliderAgeMin = ageRange[0]
      const sliderAgeMax = ageRange[1]
      let finalAgeMin = constraintAgeMin ?? sliderAgeMin
      let finalAgeMax = constraintAgeMax ?? sliderAgeMax

      if (constraintAgeMin !== undefined) {
        finalAgeMin = Math.max(finalAgeMin, sliderAgeMin)
      } else {
        finalAgeMin = sliderAgeMin
      }

      if (constraintAgeMax !== undefined) {
        finalAgeMax = Math.min(finalAgeMax, sliderAgeMax)
      } else {
        finalAgeMax = sliderAgeMax
      }

      if (constraintAgeMin !== undefined && constraintAgeMin > sliderAgeMax) {
        finalAgeMin = constraintAgeMin
      }

      if (constraintAgeMax !== undefined && constraintAgeMax < sliderAgeMin) {
        finalAgeMax = constraintAgeMax
      }

      if (finalAgeMin > finalAgeMax) {
        const midpoint = Math.round((finalAgeMin + finalAgeMax) / 2)
        finalAgeMin = midpoint
        finalAgeMax = midpoint
      }

      if (effectiveArea) {
        baseParams.area = effectiveArea
      }
      if (finalAgeMin !== DEFAULT_AGE_RANGE[0] || finalAgeMax !== DEFAULT_AGE_RANGE[1]) {
        baseParams.ageMin = finalAgeMin
        baseParams.ageMax = finalAgeMax
      }
      if (selectedGirlTypes.length > 0) {
        baseParams.girlTypes = selectedGirlTypes.join(',')
      }

      if (combinedConstraints.heightLower !== undefined) {
        baseParams.heightMin = combinedConstraints.heightLower
      }
      if (combinedConstraints.heightUpper !== undefined) {
        baseParams.heightMax = combinedConstraints.heightUpper
      }

      const cupMinLabel = getCupLabelFromIndex(combinedConstraints.cupMinIndex)
      const cupMaxLabel = getCupLabelFromIndex(combinedConstraints.cupMaxIndex)
      if (cupMinLabel) {
        baseParams.cupMin = cupMinLabel
      }
      if (cupMaxLabel) {
        baseParams.cupMax = cupMaxLabel
      }
      if (combinedConstraints.requireSake !== undefined) {
        baseParams.requireSake = combinedConstraints.requireSake ? '1' : '0'
      }
      if (combinedConstraints.requireTobacco !== undefined) {
        baseParams.requireTobacco = combinedConstraints.requireTobacco ? '1' : '0'
      }

      const serverTagsToApply = new Set<string>()
      selectedTags.forEach(tag => {
        if (serverFilterTagSet.has(tag)) {
          serverTagsToApply.add(tag)
        }
      })
      parsedQuery.serverTags.forEach(tag => serverTagsToApply.add(tag))
      serverTagsToApply.forEach(tag => {
        const applyServerFilter = serverFilterTagConfig[tag]
        if (applyServerFilter) {
          applyServerFilter(baseParams)
        }
      })

      if (normalizedLocation) {
        baseParams.userLat = normalizedLocation.lat
        baseParams.userLng = normalizedLocation.lng
        if (!effectiveArea && !hasClientConstraintRules && !hasNonLocationKeywordSearch) {
          baseParams.maxDistance = prioritizeQuickMeet ? 50 : 80
        }
      } else if (!effectiveArea) {
        const tokyoLocation = roundLocation(35.6812, 139.7671, 2)
        baseParams.userLat = tokyoLocation.lat
        baseParams.userLng = tokyoLocation.lng
        console.log('📍 位置情報なし - 東京駅周辺の女の子をデフォルト表示')
        console.log(`🗺️ フォールバック座標: lat=${tokyoLocation.lat}, lng=${tokyoLocation.lng}`)
      }

      const querySignature = generateCacheKey(baseParams)
      if (reset || fetchSignatureRef.current !== querySignature) {
        fetchSignatureRef.current = querySignature
        if (!reset) {
          clearCachedState()
        }
      }

      const requestOptions: RequestInit = {
        method: 'GET',
        credentials: 'include',
        mode: 'cors',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }

      const buildApiUrl = (pageNumber: number) => {
        const limit = LIMIT
        const offset = (pageNumber - 1) * LIMIT
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
          scheduleDate: baseParams.scheduleDate,
          scheduleRangeDays: String(baseParams.scheduleRangeDays)
        })

        if (effectiveArea) params.append('area', effectiveArea)
        if (baseParams.ageMin !== undefined) {
          params.append('ageMin', String(baseParams.ageMin))
          params.append('ageMax', String(baseParams.ageMax))
        }
        if (baseParams.girlTypes) params.append('girlTypes', baseParams.girlTypes)
        if (baseParams.heightMin !== undefined) params.append('heightMin', String(baseParams.heightMin))
        if (baseParams.heightMax !== undefined) params.append('heightMax', String(baseParams.heightMax))
        if (baseParams.cupMin !== undefined) params.append('cupMin', String(baseParams.cupMin))
        if (baseParams.cupMax !== undefined) params.append('cupMax', String(baseParams.cupMax))
        if (baseParams.requireSake !== undefined) params.append('requireSake', String(baseParams.requireSake))
        if (baseParams.requireTobacco !== undefined) params.append('requireTobacco', String(baseParams.requireTobacco))
        if (baseParams.userLat !== undefined) {
          params.append('userLat', String(baseParams.userLat))
          params.append('userLng', String(baseParams.userLng))
        }
        if (baseParams.maxDistance !== undefined) params.append('maxDistance', String(baseParams.maxDistance))

        return `/api/mysql-girls-fast?${params.toString()}`
      }

      const cacheKeyForPage = (pageNumber: number) =>
        generateCacheKey({
          ...baseParams,
          limit: LIMIT,
          offset: (pageNumber - 1) * LIMIT
        })

      const fetchPage = async (pageNumber: number) => {
        const apiUrl = buildApiUrl(pageNumber)
        const cacheKey = cacheKeyForPage(pageNumber)
        try {
          return await fetchWithDedup(apiUrl, requestOptions, cacheKey)
        } catch (error) {
          console.error('Optimized API failed, trying fallback:', error)
          const fallbackUrl = apiUrl.replace('/api/mysql-girls-fast', '/api/mysql-girls')
          return await fetchWithDedup(fallbackUrl, requestOptions, `${cacheKey}_fallback`)
        }
      }

      const mapGirlToUser = (user: any, absoluteIndex: number): UserProfile => {
        let distance: number | undefined = user.distance_km

        if (!distance && userLocation) {
          if (user.shop?.latitude && user.shop?.longitude) {
            const R = 6371
            const dLat = (user.shop.latitude - userLocation.lat) * Math.PI / 180
            const dLng = (user.shop.longitude - userLocation.lng) * Math.PI / 180
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(userLocation.lat * Math.PI / 180) *
                Math.cos(user.shop.latitude * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2)
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
            distance = R * c
          } else if (user.location) {
            const coords = getLocationCoordinates(user.location)
            if (coords) {
              const R = 6371
              const dLat = (coords.lat - userLocation.lat) * Math.PI / 180
              const dLng = (coords.lng - userLocation.lng) * Math.PI / 180
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(userLocation.lat * Math.PI / 180) *
                  Math.cos(coords.lat * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2)
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
              distance = R * c
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
          municipality: user.municipality,
          bio: user.bio,
          interests: user.interests,
          imageUrl: user.imageUrl,
          bodyType: user.bodyType,
          style: user.style,
          isOnline: user.isOnline,
          lastActive: user.lastActive,
          is_sake: user.is_sake,
          is_tobacco: user.is_tobacco,
          distance,
          girlTypes: user.girlTypes || [],
          isGirlProfile: true,
          serverOrder: absoluteIndex
        }
      }

      const ensurePage = async (pageNumber: number, showLoader: boolean) => {
        if (fetchedPagesRef.current.has(pageNumber) || pendingPagesRef.current.has(pageNumber)) {
          return
        }

        if (showLoader) {
          setLoading(true)
        }

        pendingPagesRef.current.add(pageNumber)

        try {
          const data = await fetchPage(pageNumber)
          if (!data) {
            return
          }

          if (data.performance) {
            console.log('⚡ API Performance:', {
              page: pageNumber,
              responseTime: `${data.performance.responseTime}ms`,
              cacheHitRate: `${data.performance.cacheHitRate}%`,
              averageQueryTime: `${data.performance.averageQueryTime}ms`,
              area: effectiveArea || 'all',
              withLocation: !!userLocation
            })
          }

          const serverIndexBase = (pageNumber - 1) * LIMIT
          const mappedUsers = (data.girls || []).map((user: any, index: number) =>
            mapGirlToUser(user, serverIndexBase + index)
          )

          let flattenedUsers: UserProfile[] = []
          setPageCache(prev => {
            const newCache = { ...prev, [pageNumber]: mappedUsers }
            flattenedUsers = flattenCache(newCache)
            return newCache
          })

          setUsers(flattenedUsers)
          setSortedDataCache(flattenedUsers)
          setFilteredUsers(flattenedUsers)

          if (requiresClientFiltering) {
            setFilteredTotalCount(flattenedUsers.length)
          }

          const totalFromServer =
            typeof data.total === 'number' ? data.total : flattenedUsers.length
          setTotalCount(totalFromServer)
          if (!requiresClientFiltering) {
            setFilteredTotalCount(totalFromServer)
          }

          fetchedPagesRef.current.add(pageNumber)
        } catch (error) {
          console.error('Error fetching page:', error)

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
        } finally {
          pendingPagesRef.current.delete(pageNumber)
          if (showLoader) {
            setHasInitialDataLoaded(true)
            setLoading(false)
          }
        }
      }

      const shouldShowLoader = !hasInitialDataLoaded || targetPage === currentPage
      await ensurePage(targetPage, shouldShowLoader)

      if (!hasInitialDataLoaded) {
        setHasInitialDataLoaded(true)
      }
      setInitialFetchDone(true)
    },
    [
      LIMIT,
      ageRange,
      areas,
      currentPage,
      hasInitialDataLoaded,
      locationFromParam,
      prioritizeQuickMeet,
      selectedArea,
      selectedGirlTypes,
      selectedTags,
      combinedConstraints,
      hasClientConstraintRules,
      hasNonLocationKeywordSearch,
      parsedQuery,
      requiresClientFiltering,
      toast,
      userLocation,
      userSelectedArea
    ]
  )
  // データ取得のタイミングを制御（フィルター条件が変わった時のみ再取得）
  useEffect(() => {
    if (isInitialLoad) return;

    const hasSameKey = prevMajorKeyRef.current === majorFilterKey
    prevMajorKeyRef.current = majorFilterKey
    if (hasSameKey) return

    fetchFilteredUsers(1, true)
  }, [majorFilterKey, isInitialLoad, fetchFilteredUsers])

  useEffect(() => {
    if (isInitialLoad) return;
    if (!initialFetchDone) return;
    fetchFilteredUsers(currentPage);
  }, [currentPage, isInitialLoad, initialFetchDone, fetchFilteredUsers])

  useEffect(() => {
    if (!initialFetchDone) return;
    if (useClientFiltering) {
      const needed = currentPage * LIMIT;
      if (filteredUsers.length < needed && users.length < totalCount) {
        const nextPage = Math.floor(users.length / LIMIT) + 1;
        if (nextPage > 0) {
          fetchFilteredUsers(nextPage);
        }
      }
    } else {
      const pageData = pageCache[currentPage];
      const needsFetch = !pageData || pageData.length === 0;
      if (needsFetch && (currentPage - 1) * LIMIT < totalCount) {
        fetchFilteredUsers(currentPage);
      }
    }
  }, [
    LIMIT,
    currentPage,
    filteredUsers.length,
    users.length,
    totalCount,
    useClientFiltering,
    initialFetchDone,
    fetchFilteredUsers,
    pageCache
  ])

  useEffect(() => {
    if (useClientFiltering) return
    setFilteredUsers(users)
    setFilteredTotalCount(totalCount)
  }, [useClientFiltering, users, totalCount])

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
    if (!useClientFiltering) {
      return
    }

    if (users.length === 0) {
      setFilteredUsers([])
      setFilteredTotalCount(0)
      return
    }

    const baseUsers = sortedDataCache ? [...sortedDataCache] : [...users]
    const generalKeywords = parsedQuery.generalKeywords
    const interestTags = selectedTags.filter(tag => !clientFilterTagSet.has(tag) && !serverFilterTagSet.has(tag))

    const applyFilters = (constraintOverride?: ClientConstraints): UserProfile[] => {
      let results = [...baseUsers]

      if (interestTags.length > 0) {
        results = results.filter(user =>
          interestTags.some(tag => user.interests.includes(tag))
        )
      }

      const effectiveConstraints = constraintOverride ?? (hasClientConstraintRules ? combinedConstraints : {})

      if (Object.keys(effectiveConstraints).length > 0) {
        results = results.filter(user => matchesClientConstraints(user, effectiveConstraints))
      }

      if (selectedGirlTypes.length > 0) {
        results = results.filter(user => {
          if (!user.girlTypes || user.girlTypes.length === 0) return false
          return selectedGirlTypes.some(selectedType =>
            user.girlTypes!.some(userType => {
              const userTypeName =
                typeof userType === 'object' && userType !== null && 'name' in userType
                  ? (userType as { name?: string | null }).name
                  : userType
              return userTypeName === selectedType
            })
          )
        })
      }

      if (generalKeywords.length > 0) {
        results = results.filter(user => {
          const userStr = [
            user.name,
            user.bio,
            ...(user.interests ?? []),
            user.location,
            user.municipality || '',
            user.age ? user.age.toString() : '不明',
            user.height ? `${user.height}cm` : '',
            user.cup ? `${user.cup}カップ` : ''
          ]
            .join(' ')
            .toLowerCase()

          return generalKeywords.every(keyword => userStr.includes(keyword))
        })
      }

      return results
    }

    let filtered = applyFilters()

    if (filtered.length === 0 && combinedConstraints.heightUpper !== undefined) {
      filtered = applyFilters({
        ...combinedConstraints,
        heightUpper: combinedConstraints.heightUpper + 5
      })
    }

    if (filtered.length === 0 && combinedConstraints.cupMinIndex !== undefined) {
      filtered = applyFilters({
        ...combinedConstraints,
        cupMinIndex: Math.max((combinedConstraints.cupMinIndex ?? 0) - 1, 0)
      })
    }

    const hasAgeSpecialTag =
      clientSelectedTags.includes('10代') ||
      clientSelectedTags.includes('20代') ||
      clientSelectedTags.includes('30代') ||
      clientSelectedTags.includes('40代') ||
      clientSelectedTags.includes('50代') ||
      combinedConstraints.ageMin !== undefined ||
      combinedConstraints.ageMax !== undefined

    const isDefaultRange = ageRange[0] === 18 && ageRange[1] === 50
    filtered = filtered.filter(user => {
      if (user.age === null || user.age === undefined) {
        return isDefaultRange || hasAgeSpecialTag
      }
      return user.age >= ageRange[0] && user.age <= ageRange[1]
    })

    if (selectedStyles.length > 0) {
      filtered = filtered.filter(user => user.style && selectedStyles.includes(user.style))
    }

    if (prioritizeQuickMeet) {
      filtered.sort((a, b) => {
        const aScore = a.isOnline ? 2 : (a.lastActive ? 1 : 0)
        const bScore = b.isOnline ? 2 : (b.lastActive ? 1 : 0)
        return bScore - aScore
      })
    }

    switch (sortBy) {
      case 'new':
        filtered.sort((a, b) => {
          const aId = parseInt(a.id) || 0
          const bId = parseInt(b.id) || 0
          return bId - aId
        })
        break
      case 'distance':
        if (filtered.length > 0 && filtered[0].serverOrder !== undefined) {
          filtered.sort((a, b) => {
            const orderA = a.serverOrder ?? 999999
            const orderB = b.serverOrder ?? 999999
            return orderA - orderB
          })
        } else if (!userLocation) {
          filtered.sort((a, b) => a.location.localeCompare(b.location))
        }
        break
      case 'recommend':
      default:
        filtered = filtered.map(user => {
          let score = 0

          if (user.girlTypes && user.girlTypes.length > 0) {
            score += user.girlTypes.length * 15
            if (user.girlTypes.some(type => {
              const typeName = typeof type === 'object' && type !== null && 'name' in type ? type.name : type
              return typeName.includes('エロ')
            })) score += 20
            if (user.girlTypes.some(type => {
              const typeName = typeof type === 'object' && type !== null && 'name' in type ? type.name : type
              return typeName.includes('巨乳')
            })) score += 15
            if (user.girlTypes.some(type => {
              const typeName = typeof type === 'object' && type !== null && 'name' in type ? type.name : type
              return typeName.includes('癒し')
            })) score += 12
          }

          if (user.age !== null && user.age !== undefined) {
            score += 10
          }

          if (user.bio && user.bio.length > 50) score += 5
          if (user.height) score += 3
          if (user.bust) score += 3
          if (user.cup) score += 3
          if (user.interests.length > 3) score += 5

          if (user.isOnline) score += 20

          if (searchQuery) {
            const query = searchQuery.toLowerCase()
            if (user.name && user.name.toLowerCase().includes(query)) score += 15
            if (user.bio && user.bio.toLowerCase().includes(query)) score += 10
            if (user.location && user.location.toLowerCase().includes(query)) score += 8
            if (user.interests && user.interests.some(i => i && i.toLowerCase().includes(query))) score += 5
            if (user.girlTypes && user.girlTypes.some(type => {
              const typeName = typeof type === 'object' && type !== null && 'name' in type ? type.name : type
              return typeName.toLowerCase().includes(query)
            })) score += 25
          }

          const matchedTags = selectedTags.filter(tag => user.interests.includes(tag))
          score += matchedTags.length * 10

          if (selectedGirlTypes.length > 0 && user.girlTypes) {
            const matchedTypes = selectedGirlTypes.filter(selectedType =>
              user.girlTypes!.some(userType => {
                const userTypeName = typeof userType === 'object' && userType !== null && 'name' in userType ? userType.name : userType
                return userTypeName === selectedType
              })
            )
            score += matchedTypes.length * 30
          }

          return { ...user, matchScore: score }
        })

        filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        break
    }

    setFilteredUsers(filtered)
    setFilteredTotalCount(filtered.length)
  }, [
    useClientFiltering,
    users,
    sortedDataCache,
    combinedConstraints,
    hasClientConstraintRules,
    parsedQuery,
    clientSelectedTags,
    selectedTags,
    selectedGirlTypes,
    selectedStyles,
    sortBy,
    userLocation,
    prioritizeQuickMeet,
    ageRange,
    searchQuery
  ])

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

  // ページ変更時のスクロール処理を含む関数
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    
    // スマホ対応のスクロール処理
    setTimeout(() => {
      // iOS Safariを含むモバイルブラウザで確実に動作
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0; // iOS Safari用のフォールバック
      // 追加の保険として、html要素にもスクロール
      if ('scrollBehavior' in document.documentElement.style) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo(0, 0);
      }
    }, 100); // 少し遅延を入れて、DOMの更新後にスクロール
  };

  // フィルター変更時にページを1に戻す（年齢以外）
  useEffect(() => {
    setCurrentPage(1)
  }, [
    selectedArea,
    tagsKey,
    searchQuery,
    stylesKey,
    prioritizeQuickMeet,
    ageMin,
    ageMax,
    girlTypesKey,
    sortBy,
    userSelectedArea,
    locationFromParam,
    userLat,
    userLng
  ])
  
  // エリア変更時の処理（削除）
  
  // 年齢変更は別途処理（ページリセットしない）
  useEffect(() => {
    // 年齢が変更されても現在のページを維持
  }, [ageRange])

  // 削除: handleLike と handleMessage - 楽観的UIフックを直接使用するため不要

  // フィルターリセット
  const resetFilters = () => {
    setSearchQuery('')
    setSearchQueryInput('')
    setSelectedTags([])
    setSelectedGirlTypes([])
    setSelectedArea('all')
    setSelectedTime('now')
    setAgeRange([...DEFAULT_AGE_RANGE] as [number, number])
    setSelectedStyles([])
    setPrioritizeQuickMeet(false)
    setSortBy('recommend')
  }

  // ローディング表示を削除（即座にコンテンツを表示）
  // LINEブラウザ対応: 初期ローディングを表示しない

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
                            selectedArea === municipality.municipality_name ? 'opacity-100' : 'opacity-0'
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
                                selectedArea === municipality.municipality_name ? 'opacity-100' : 'opacity-0'
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

        {/* 女の子タイプフィルター */}
        <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            <Heart className="w-4 h-4" />
            女の子タイプ
          </h3>
          <MultiSelect
            options={girlTypeOptions}
            selected={selectedGirlTypes}
            onChange={setSelectedGirlTypes}
            placeholder="タイプを選択（複数選択可）"
            className={styles.filterSelect}
            maxDisplay={3}
          />
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
            <strong>検索可能な項目:</strong><br/>
            • 年齢: 25, 25歳, 不明（年齢不明者）<br/>
            • 身長: 160cm, 160cm以上, 160cm以下<br/>
            • カップ: Dカップ, Eカップ以上<br/>
            • 地域: 渋谷区, 新宿区 等（区/市/町/村はエリア検索）<br/>
            • その他: 名前, プロフィール, 趣味<br/>
            <strong>複数検索:</strong> スペース区切りでAND検索（例: 渋谷 160cm Dカップ）<br/>
            ※上記は今すぐ会えるキャスト数です。<br/>人数はリアルタイムで変動します。
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
          <MultiSelect
            options={personalityTags.map(tag => ({ value: tag, label: tag }))}
            selected={selectedTags}
            onChange={handleTagChange}
            placeholder="条件を選択（複数選択可）"
            className={styles.filterSelect}
            maxDisplay={3}
          />
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
              <span>{currentPageCount.toLocaleString('ja-JP')}</span>名を表示中
              {totalPages > 1 && (
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                  （{currentPage} / {totalPages} ページ）
                </span>
              )}
              {overallCount > currentPageCount && (
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                  （全{overallCount.toLocaleString('ja-JP')}名／残り{hiddenCount.toLocaleString('ja-JP')}名）
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
              {selectedGirlTypes.map(type => (
                <Badge key={`girl-type-${type}`} variant="secondary" className="bg-pink-500/10 text-pink-500 border-pink-500/30">
                  ✨ {type}
                </Badge>
              ))}
              {selectedTags
                .filter(tag => !ageTagSet.has(tag))
                .map(tag => (
                <Badge key={tag} variant="secondary" className="bg-gold-500/10 text-gold-500 border-gold-500/30">
                  {tag}
                </Badge>
              ))}
              {selectedArea !== 'all' && (
                <Badge variant="secondary" className="bg-gold-500/10 text-gold-500 border-gold-500/30">
                  {selectedArea}
                </Badge>
              )}
              {(ageRange[0] !== DEFAULT_AGE_RANGE[0] || ageRange[1] !== DEFAULT_AGE_RANGE[1]) && (
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
        {displayedUsers.length > 0 && (
          <div className={viewMode === 'grid' ? styles.profilesGrid : styles.profilesList}>
            {displayedUsers.map(user => (
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
                  {/* Girl Types with special styling */}
                  {user.girlTypes && user.girlTypes.slice(0, 2).map(type => (
                    <Badge 
                      key={`type-${typeof type === 'object' && type !== null && 'id' in type ? type.id : type}`} 
                      variant="secondary" 
                      className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500/40 text-pink-300"
                    >
                      ✨ {typeof type === 'object' && type !== null && 'name' in type ? type.name : type}
                    </Badge>
                  ))}
                  {/* Regular interests */}
                  {user.interests.slice(0, user.girlTypes?.length ? 1 : 3).map(interest => (
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
                    disabled={likingStates[`mysql_girl_${user.id}`]}
                    onClick={async (e) => {
                      e.stopPropagation()
                      
                      // ログインチェック
                      if (!currentUser) {
                        toast({
                          title: 'ログインが必要です',
                          description: 'いいねを送るにはログインしてください',
                          variant: 'destructive'
                        })
                        router.push('/login')
                        return
                      }
                      
                      // 有料会員チェック
                      if (!isPremium && !subscriptionLoading) {
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
                      
                      // 楽観的更新でいいねを送信（高速化）
                      const targetId = `mysql_girl_${user.id}`
                      handleLikeOptimistic(
                        currentUser.uid,
                        targetId,
                        user.name,
                        {
                          toGirlName: user.name,
                          toGirlId: user.id,
                          isGirlProfile: true
                        }
                      ).catch(error => {
                        console.error('Like error:', error)
                      })
                    }}
                  >
                    {likingStates[`mysql_girl_${user.id}`] ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        送信中...
                      </>
                    ) : (
                      <>
                        <Heart className="w-4 h-4" />
                        いいね
                      </>
                    )}
                  </Button>
                  <Button
                    className={styles.actionMessage}
                    disabled={navigatingStates[user.id]}
                    onMouseEnter={() => prefetchMemoPage(user.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      
                      // ログインチェック
                      if (!currentUser) {
                        toast({
                          title: 'ログインが必要です',
                          description: 'メモを使うにはログインしてください',
                          variant: 'destructive'
                        })
                        router.push('/login')
                        return
                      }
                      
                      // 有料会員チェック
                      if (!isPremium && !subscriptionLoading) {
                        toast({
                          title: '有料会員限定',
                          description: 'メモ機能を使うには有料会員登録が必要です',
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
                      
                      // 高速ナビゲーション（プリフェッチ済み）
                      handleMemoNavigation(user.id, user.name)
                    }}
                  >
                    {navigatingStates[user.id] ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        移動中...
                      </>
                    ) : (
                      <>
                        <StickyNote className="w-4 h-4" />
                        メモ
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            ))}
          </div>
        )}

        {/* ローディング表示 */}
        {loading && !hasInitialDataLoaded && (
          <div className={styles.emptyState}>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">女性を検索中...</p>
          </div>
        )}

        {/* データがない場合の表示（ローディング完了後のみ） */}
        {!loading && filteredTotalCount === 0 && (
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
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
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
                      onClick={() => handlePageChange(pageNum as number)}
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
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
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
                      handlePageChange(page);
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

      {/* モバイルオーバーレイ */}
      {showMobileFilter && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setShowMobileFilter(false)}
        />
      )}

      {/* 絞り込み検索ボタン（フィルターパネルの表示切り替え機能付き） */}
      <button
        className={styles.applyFilterButton}
        onClick={() => {
          // モバイルの場合はフィルターパネルを表示
          if (window.innerWidth <= 1024) {
            setShowMobileFilter(!showMobileFilter)
          } else {
            // デスクトップの場合は検索を実行
            setSearchQuery(searchQueryInput)
            setFiltersApplied(true)
            toast({
              title: "フィルターを適用しました",
              description: `${filteredTotalCount}名の候補が見つかりました`
            })
          }
        }}
      >
        <Filter className="w-5 h-5" />
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
