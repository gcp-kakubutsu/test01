'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Heart, MessageCircle, MapPin, Clock, Filter, Grid3x3, List, Search } from 'lucide-react'
// Removed direct import - will fetch via API
import { sendLike } from '@/lib/firebase/actions'
import { useToast } from '@/hooks/use-toast'
import { getCurrentLocation, sortUsersByDistance, type LocationCoordinates } from '@/lib/utils/location'
import { useUserProfile } from '@/lib/firebase/hooks'
import { useSubscription } from '@/hooks/useSubscription'
import Image from 'next/image'
import styles from './search.module.scss'

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
}

// 性癖・プレイスタイルのタグ
const personalityTags = [
  'やさしめ', 'リード上手', 'じっくり派', '甘やかし系',
  '濃密タイプ', 'スピード重視', '受け身好き', '主導タイプ',
  'ソフト系', 'ハード系', '恋人プレイ', '奉仕好き'
]

// 体型オプション
const bodyTypes = ['スリム', '普通', 'グラマー', 'ぽっちゃり']

// スタイルオプション
const styleTypes = ['清楚系', 'ギャル系', 'お姉さん系', '妹系', '人妻系', 'モデル系']

// 時間オプション
const timeOptions = [
  { value: 'now', label: 'いまから' },
  { value: '1hour', label: '1時間以内' },
  { value: 'tonight', label: '今夜' },
  { value: 'tomorrow', label: '明日' },
  { value: 'weekend', label: '週末' },
  { value: 'anytime', label: 'いつでも' }
]

interface AreaData {
  prefecture_id?: number
  prefecture_name: string
  municipality_id?: number
  municipality_name?: string
  full_name?: string
  girl_count: number
}

export default function AdvancedSearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, currentUser } = useAuth()
  const { profile: userProfile } = useUserProfile()
  const { isPremium } = useSubscription()
  const { toast } = useToast()

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
  const [selectedBodyTypes, setSelectedBodyTypes] = useState<string[]>([])
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('recommend')
  const [filtersApplied, setFiltersApplied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [prioritizeQuickMeet, setPrioritizeQuickMeet] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  // 動的に計算されるページ数
  const totalPages = Math.ceil(totalCount / LIMIT)

  // 初期パラメータの読み込み
  useEffect(() => {
    const tags = searchParams.get('tags')
    const location = searchParams.get('location')
    const time = searchParams.get('time')
    const quick = searchParams.get('quick')
    const q = searchParams.get('q')
    
    if (tags) setSelectedTags(tags.split(','))
    if (location) setSelectedArea(location)
    if (time) setSelectedTime(time)
    if (quick === 'true') setPrioritizeQuickMeet(true)
    if (q) setSearchQuery(q)
  }, [searchParams])

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

  // ユーザーデータ取得はcurrentPage変更時のフィルタリング処理に統合

  // ユーザーデータ取得とフィルタリング処理
  const fetchFilteredUsers = useCallback(async () => {
    try {
      setLoading(true)
      
      // Calculate offset based on current page
      const offset = (currentPage - 1) * LIMIT
      
      // Fetch data from server with pagination
      const response = await fetch(`/api/mysql-girls?limit=${LIMIT}&offset=${offset}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch girls')
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
        lastActive: user.lastActive
      }))
      
      // Update total count
      setTotalCount(data.total || 0)
      setUsers(mappedUsers)
      
      setFilteredUsers(mappedUsers)
    } catch (error) {
      console.error('Error fetching filtered users:', error)
      toast({
        title: 'エラー',
        description: 'ユーザー情報の取得に失敗しました',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [currentPage, LIMIT, toast])

  useEffect(() => {
    fetchFilteredUsers()
  }, [fetchFilteredUsers])

  // クライアントサイドフィルタリング
  useEffect(() => {
    let filtered = [...users]

    // 検索クエリフィルター（名前、プロフィール、興味で検索）
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(query) ||
        user.bio.toLowerCase().includes(query) ||
        user.interests.some(interest => interest.toLowerCase().includes(query))
      )
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
        
        // やさしめ: 18-19歳
        if (selectedTags.includes('やさしめ') && user.age >= 18 && user.age <= 19) {
          matchesSpecialTags = true
        }
        
        // リード上手: 身長150cm以下
        if (selectedTags.includes('リード上手') && user.height && user.height <= 150) {
          matchesSpecialTags = true
        }
        
        // じっくり派: 身長151cm以上
        if (selectedTags.includes('じっくり派') && user.height && user.height >= 151) {
          matchesSpecialTags = true
        }
        
        // 甘やかし系: Eカップ以上
        if (selectedTags.includes('甘やかし系') && user.cup) {
          const cupOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
          const userCupIndex = cupOrder.indexOf(user.cup.toUpperCase())
          const eCupIndex = cupOrder.indexOf('E')
          if (userCupIndex >= eCupIndex) {
            matchesSpecialTags = true
          }
        }
        
        // OR条件：通常タグまたは特殊タグのいずれかにマッチ
        return matchesNormalTags || matchesSpecialTags
      })
    }

    // エリアフィルター
    if (selectedArea && selectedArea !== 'all') {
      filtered = filtered.filter(user => 
        user.location.includes(selectedArea)
      )
    }

    // 年齢フィルター（特殊タグが選択されていない場合のみ適用）
    const hasAgeSpecialTag = selectedTags.includes('やさしめ')
    if (!hasAgeSpecialTag) {
      filtered = filtered.filter(user => 
        user.age >= ageRange[0] && user.age <= ageRange[1]
      )
    }

    // 体型フィルター
    if (selectedBodyTypes.length > 0) {
      filtered = filtered.filter(user => 
        user.bodyType && selectedBodyTypes.includes(user.bodyType)
      )
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
        filtered.sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''))
        break
      case 'distance':
        if (userLocation) {
          filtered = sortUsersByDistance(filtered, userLocation)
        }
        break
      default:
        // おすすめ順（デフォルト）
        break
    }

    setFilteredUsers(filtered)
  }, [users, searchQuery, selectedTags, selectedArea, ageRange, selectedBodyTypes, selectedStyles, sortBy, userLocation, prioritizeQuickMeet])

  // フィルター変更時にページを1に戻す
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedTags, selectedArea, ageRange, selectedBodyTypes, selectedStyles, sortBy, prioritizeQuickMeet])

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
    setSelectedTags([])
    setSelectedArea('all')
    setSelectedTime('now')
    setAgeRange([18, 50])
    setSelectedBodyTypes([])
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

        {/* キーワード検索 */}
        <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            <Search className="w-4 h-4" />
            キーワード検索
          </h3>
          <Input
            type="text"
            placeholder="名前・プロフィール・趣味で検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.filterInput}
          />
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

        {/* エリア */}
        <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            <MapPin className="w-4 h-4" />
            エリア
          </h3>
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className={styles.filterSelect}>
              <SelectValue placeholder="すべてのエリア" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのエリア</SelectItem>
              
              {/* 都道府県 */}
              {areas.prefectures.length > 0 && (
                <div className="px-2 py-1 text-sm font-semibold text-muted-foreground">
                  都道府県
                </div>
              )}
              {areas.prefectures.map((prefecture) => (
                <SelectItem 
                  key={`pref-${prefecture.prefecture_id}`} 
                  value={prefecture.prefecture_name}
                >
                  {prefecture.prefecture_name} ({prefecture.girl_count}名)
                </SelectItem>
              ))}
              
              {/* 人気エリア（市区町村） */}
              {areas.municipalities.length > 0 && (
                <>
                  <div className="my-1 h-px bg-border" />
                  <div className="px-2 py-1 text-sm font-semibold text-muted-foreground">
                    人気エリア
                  </div>
                </>
              )}
              {areas.municipalities.map((municipality) => (
                <SelectItem 
                  key={`muni-${municipality.municipality_id}`} 
                  value={municipality.full_name || ''}
                >
                  {municipality.full_name} ({municipality.girl_count}名)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        {/* 体型 */}
        <div className={styles.filterSection}>
          <h3 className={styles.filterSectionTitle}>
            体型
          </h3>
          <div className={styles.tagFilters}>
            {bodyTypes.map(type => (
              <label key={type} className={styles.tagFilter}>
                <input
                  type="checkbox"
                  checked={selectedBodyTypes.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedBodyTypes([...selectedBodyTypes, type])
                    } else {
                      setSelectedBodyTypes(selectedBodyTypes.filter(t => t !== type))
                    }
                  }}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* スタイル */}
        <div className={styles.filterSection}>
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
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className={styles.searchMain}>
        <div className={styles.searchHeader}>
          <div>
            <div className={styles.searchResultsCount}>
              <span>{filteredUsers.length}</span>名の候補が見つかりました
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
        <div className={viewMode === 'grid' ? styles.profilesGrid : styles.profilesList}>
          {filteredUsers.map(user => (
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
                  <span>{user.age}歳</span>
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
        {filteredUsers.length > 0 && totalPages > 1 && (
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
          setFiltersApplied(true)
          toast({
            title: "フィルターを適用しました",
            description: `${filteredUsers.length}名の候補が見つかりました`
          })
        }}
      >
        <Search className="w-5 h-5" />
        絞り込み検索
      </button>
    </div>
  )
}