'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { uploadProfileImageForAdmin } from '@/lib/firebase/storage'
import { ImagePositionAdjuster } from '@/components/ui/image-position-adjuster'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { 
  Loader2, 
  Upload, 
  X, 
  UserPlus,
  Calendar,
  Mail,
  Lock,
  MapPin,
  Heart,
  Camera,
  Sparkles
} from 'lucide-react'

const INTERESTS_OPTIONS = [
  '映画鑑賞', '読書', '音楽', 'カラオケ', 'ゲーム', 'アニメ・マンガ',
  '料理', 'グルメ', 'カフェ巡り', 'お酒', '旅行', 'ドライブ',
  'スポーツ観戦', 'ジム・筋トレ', 'ヨガ', 'ランニング', 'ダンス',
  'アウトドア', 'キャンプ', '写真', 'アート', 'ファッション',
  'ペット', '美容', 'ショッピング'
]

const formSchema = z.object({
  username: z.string().min(1, '名前を入力してください'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
  confirmPassword: z.string(),
  birthYear: z.string().min(1, '生年を選択してください'),
  birthMonth: z.string().min(1, '生月を選択してください'),
  birthDay: z.string().min(1, '生日を選択してください'),
  location: z.string().min(1, '居住地を入力してください'),
  bio: z.string().optional(),
  interests: z.array(z.string()).min(1, '趣味・興味を1つ以上選択してください'),
  profilePhoto: z.any().optional(),
  confirmAge: z.boolean().refine((val) => val === true, {
    message: '18歳以上であることを確認してください',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
})

export default function RegisterGirlPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isAuthenticated, currentUser, isLoading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null)
  const [showImageAdjuster, setShowImageAdjuster] = useState(false)
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null)
  const [adjustedPhotoBlob, setAdjustedPhotoBlob] = useState<Blob | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      birthYear: '',
      birthMonth: '',
      birthDay: '',
      location: '',
      bio: '',
      interests: [],
      profilePhoto: null,
      confirmAge: false,
    },
  })

  // Check authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 83 }, (_, i) => (currentYear - 18 - i).toString())
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'))

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white mb-4">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <p>認証状態を確認中...</p>
        </div>
      </div>
    )
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return null
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      console.log('Selected file:', file.name, file.type, file.size)
      const reader = new FileReader()
      reader.onloadend = () => {
        console.log('File read complete, showing image adjuster')
        setTempImageUrl(reader.result as string)
        setShowImageAdjuster(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleImageSave = (croppedBlob: Blob) => {
    setAdjustedPhotoBlob(croppedBlob)
    form.setValue('profilePhoto', croppedBlob)
    
    // Create preview URL
    const url = URL.createObjectURL(croppedBlob)
    setProfilePhotoPreview(url)
    setShowImageAdjuster(false)
    setTempImageUrl(null)
  }

  const handleImageCancel = () => {
    setShowImageAdjuster(false)
    setTempImageUrl(null)
  }

  const removePhoto = () => {
    form.setValue('profilePhoto', null)
    setProfilePhotoPreview(null)
    setAdjustedPhotoBlob(null)
    if (profilePhotoPreview) {
      URL.revokeObjectURL(profilePhotoPreview)
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const birthDate = `${values.birthYear}-${values.birthMonth}-${values.birthDay}`
      
      // Create user first without photo
      const response = await fetch('/api/admin/create-girl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          username: values.username,
          birthDate,
          location: values.location,
          bio: values.bio || '',
          interests: values.interests,
          profilePhotoUrl: '', // Will be updated after photo upload
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '登録に失敗しました')
      }

      // If user creation was successful and we have a photo, upload it
      if (result.uid && adjustedPhotoBlob) {
        try {
          console.log('Uploading photo for user:', result.uid)
          console.log('Current auth user:', currentUser?.uid)
          console.log('Is authenticated:', isAuthenticated)
          
          const file = new File([adjustedPhotoBlob], 'profile.jpg', { type: 'image/jpeg' })
          // Use admin upload function which stores in admin-uploads folder
          const profilePhotoUrl = await uploadProfileImageForAdmin(
            result.uid,
            file,
            'main'
          )
          console.log('Uploaded photo URL:', profilePhotoUrl)

          // Update user document with photo URL
          const updateResponse = await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: result.uid,
              profilePhotoUrl,
            }),
          })

          if (!updateResponse.ok) {
            console.warn('Failed to update user with photo URL')
          }
        } catch (photoError) {
          console.error('Photo upload error:', photoError)
          toast({
            title: '警告',
            description: 'ユーザーは作成されましたが、写真のアップロードに失敗しました',
            variant: 'destructive',
          })
        }
      }

      toast({
        title: '登録成功',
        description: result.message || '女性ユーザーが正常に登録されました',
      })

      form.reset()
      setProfilePhotoPreview(null)
      setAdjustedPhotoBlob(null)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      toast({
        title: 'エラー',
        description: error.message || '登録中にエラーが発生しました',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white mb-4">
            <UserPlus className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            女性ユーザー登録
          </h1>
          <p className="text-gray-600 mt-2">管理者専用ページ</p>
        </div>
        
        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
          <CardContent className="p-6 sm:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* プロフィール写真 */}
                <div className="mb-8">
                  <FormField
                    control={form.control}
                    name="profilePhoto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-base font-semibold text-gray-700 mb-4">
                          <Camera className="h-5 w-5 text-pink-500" />
                          プロフィール写真
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            {profilePhotoPreview ? (
                              <div className="relative group mx-auto w-64 h-64 sm:w-80 sm:h-80 bg-gray-100 rounded-lg overflow-hidden">
                                <img
                                  src={profilePhotoPreview}
                                  alt="プロフィール写真プレビュー"
                                  className="w-full h-full object-contain shadow-lg"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Button
                                    type="button"
                                    onClick={removePhoto}
                                    variant="destructive"
                                    size="lg"
                                    className="rounded-full"
                                  >
                                    <X className="h-5 w-5 mr-2" />
                                    削除
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center w-full h-64 sm:h-80 bg-gradient-to-br from-pink-50 to-purple-50 border-2 border-dashed border-pink-300 rounded-2xl cursor-pointer hover:border-pink-400 transition-all duration-300 hover:shadow-lg">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                  <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center mb-4">
                                    <Upload className="h-10 w-10 text-pink-500" />
                                  </div>
                                  <p className="mb-2 text-base text-gray-700 font-medium">
                                    写真をアップロード
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    PNG, JPG, GIF (最大 5MB)
                                  </p>
                                </div>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={handlePhotoChange}
                                />
                              </label>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 基本情報セクション */}
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-pink-500" />
                    基本情報
                  </h3>

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-600">名前</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="名前を入力" 
                            className="h-12 text-base border-gray-300 focus:border-pink-400 focus:ring-pink-400"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="birthYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-600">生年</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12 text-base border-gray-300 focus:border-pink-400">
                                <SelectValue placeholder="年" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {years.map((year) => (
                                <SelectItem key={year} value={year}>
                                  {year}年
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="birthMonth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-600">生月</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12 text-base border-gray-300 focus:border-pink-400">
                                <SelectValue placeholder="月" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {months.map((month) => (
                                <SelectItem key={month} value={month}>
                                  {month}月
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="birthDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-600">生日</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12 text-base border-gray-300 focus:border-pink-400">
                                <SelectValue placeholder="日" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {days.map((day) => (
                                <SelectItem key={day} value={day}>
                                  {day}日
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-pink-500" />
                          居住地
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="例: 東京都渋谷区" 
                            className="h-12 text-base border-gray-300 focus:border-pink-400 focus:ring-pink-400"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* アカウント情報セクション */}
                <div className="space-y-5 pt-6 border-t">
                  <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                    <Lock className="h-5 w-5 text-pink-500" />
                    アカウント情報
                  </h3>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <Mail className="h-4 w-4 text-pink-500" />
                          メールアドレス
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="email@example.com" 
                            className="h-12 text-base border-gray-300 focus:border-pink-400 focus:ring-pink-400"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-600">パスワード</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="6文字以上" 
                              className="h-12 text-base border-gray-300 focus:border-pink-400 focus:ring-pink-400"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-600">パスワード（確認）</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="パスワードを再入力" 
                              className="h-12 text-base border-gray-300 focus:border-pink-400 focus:ring-pink-400"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* プロフィール情報セクション */}
                <div className="space-y-5 pt-6 border-t">
                  <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                    <Heart className="h-5 w-5 text-pink-500" />
                    プロフィール情報
                  </h3>

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-600">自己紹介</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="自己紹介を入力..." 
                            className="min-h-[120px] text-base border-gray-300 focus:border-pink-400 focus:ring-pink-400 resize-none" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="interests"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-600">趣味・興味</FormLabel>
                        <div className="mt-3">
                          <div className="flex flex-wrap gap-2">
                            {INTERESTS_OPTIONS.map((interest) => (
                              <label
                                key={interest}
                                className="relative"
                              >
                                <input
                                  type="checkbox"
                                  value={interest}
                                  checked={field.value?.includes(interest)}
                                  onChange={(e) => {
                                    const updatedInterests = e.target.checked
                                      ? [...(field.value || []), interest]
                                      : field.value?.filter((i) => i !== interest) || []
                                    field.onChange(updatedInterests)
                                  }}
                                  className="sr-only"
                                />
                                <Badge
                                  variant={field.value?.includes(interest) ? "default" : "outline"}
                                  className={`cursor-pointer transition-all duration-200 ${
                                    field.value?.includes(interest)
                                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white border-transparent hover:from-pink-600 hover:to-purple-600'
                                      : 'hover:border-pink-400 hover:text-pink-600'
                                  }`}
                                >
                                  {interest}
                                </Badge>
                              </label>
                            ))}
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="confirmAge"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4 bg-pink-50 border-pink-200">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1 h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium text-gray-700 cursor-pointer">
                          18歳以上であることを確認します
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-14 text-base font-semibold bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      登録中...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-5 w-5" />
                      女性ユーザーを登録
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {showImageAdjuster && tempImageUrl && (
        <ImagePositionAdjuster
          imageUrl={tempImageUrl}
          onSave={handleImageSave}
          onCancel={handleImageCancel}
          circular={false}
        />
      )}
    </div>
  )
}