'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { verifyApiPassword } from '../actions'

const passwordSchema = z.object({
  password: z.string().min(1, 'パスワードを入力してください'),
})

const apiSchema = z.object({
  apiEndpoint: z.string().url('有効なAPIエンドポイントURLを入力してください'),
  apiKey: z.string().optional(),
  fetchCount: z.string().regex(/^\d+$/, '数値を入力してください').transform(Number),
})

export default function ApiRegisterGirlPage() {
  const { toast } = useToast()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
    },
  })

  const apiForm = useForm<z.infer<typeof apiSchema>>({
    resolver: zodResolver(apiSchema),
    defaultValues: {
      apiEndpoint: '',
      apiKey: '',
      fetchCount: 10,
    },
  })

  async function onPasswordSubmit(values: z.infer<typeof passwordSchema>) {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: values.password }),
      })

      const data = await response.json()

      if (data.valid) {
        setIsAuthenticated(true)
        toast({
          title: '認証成功',
          description: 'API登録画面にアクセスできます',
        })
      } else {
        toast({
          title: 'エラー',
          description: 'パスワードが正しくありません',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Password verification error:', error)
      toast({
        title: 'エラー',
        description: '認証中にエラーが発生しました',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function onApiSubmit(values: z.infer<typeof apiSchema>) {
    setIsLoading(true)
    try {
      toast({
        title: '処理中',
        description: `${values.fetchCount}件の女性データを取得しています...`,
      })

      const response = await fetch('/api/admin/fetch-girls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '登録完了',
          description: `${data.registered}件の女性ユーザーが登録されました`,
        })
        apiForm.reset()
      } else {
        throw new Error(data.error || 'API処理に失敗しました')
      }
    } catch (error: any) {
      console.error('API fetch error:', error)
      toast({
        title: 'エラー',
        description: error.message || 'API処理中にエラーが発生しました',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-pink-50 p-4 flex items-center justify-center">
        <div className="mx-auto max-w-sm w-full">
          <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
            API登録認証
          </h1>
          
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>共通パスワード</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="パスワードを入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-pink-500 hover:bg-pink-600"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    確認中...
                  </>
                ) : (
                  '認証'
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pink-50 p-4">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          API経由女性ユーザー登録（管理者用）
        </h1>
        
        <div className="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
          <p className="text-sm text-gray-700">
            外部APIから女性データを取得して一括登録します。
            APIの仕様に合わせて実装を調整する必要があります。
          </p>
        </div>

        <Form {...apiForm}>
          <form onSubmit={apiForm.handleSubmit(onApiSubmit)} className="space-y-4">
            <FormField
              control={apiForm.control}
              name="apiEndpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>APIエンドポイント</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://api.example.com/girls" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={apiForm.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>APIキー（任意）</FormLabel>
                  <FormControl>
                    <Input 
                      type="password"
                      placeholder="APIキーを入力（必要な場合）" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={apiForm.control}
              name="fetchCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>取得件数</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      placeholder="10" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-pink-500 hover:bg-pink-600"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  処理中...
                </>
              ) : (
                'APIから女性データを取得して登録'
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}