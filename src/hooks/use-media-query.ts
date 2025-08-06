import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    
    const updateMatch = () => setMatches(media.matches)
    
    // 初期値を設定
    updateMatch()
    
    // リスナーを追加
    media.addEventListener('change', updateMatch)
    
    // クリーンアップ
    return () => media.removeEventListener('change', updateMatch)
  }, [query])

  return matches
}