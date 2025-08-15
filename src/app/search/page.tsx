'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SearchPage() {
  const router = useRouter()
  
  useEffect(() => {
    // /search/advanced?time=now へリダイレクト
    router.replace('/search/advanced?time=now')
  }, [router])
  
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p>リダイレクト中...</p>
      </div>
    </div>
  )
}