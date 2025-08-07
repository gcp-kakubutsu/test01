/**
 * 有料会員限定メッセージの設定
 * 各機能ごとにカスタマイズ可能なメッセージを定義
 */

export const PREMIUM_MESSAGES = {
  // プロフィール詳細表示
  profile: {
    title: "有料会員限定",
    description: "プロフィールの詳細は有料会員のみ閲覧できます",
    buttonText: "有料プランを見る",
    features: [] as string[]
  },
  
  // コミュニティ機能
  community: {
    title: "コミュニティは有料会員限定",
    description: "コミュニティは有料会員のみ利用できます",
    buttonText: "有料プランを見る",
    features: [
      "様々なテーマのコミュニティに参加",
      "自由に投稿・コメント",
      "同じ興味を持つ人と繋がる",
      "限定イベントへの参加"
    ]
  },
  
  // メッセージ機能（将来的に追加する場合）
  message: {
    title: "メッセージは有料会員限定",
    description: "メッセージ機能は有料会員のみ利用できます",
    buttonText: "有料プランを見る",
    features: [
      "マッチした相手とメッセージ交換",
      "写真の送受信",
      "既読機能",
      "メッセージの無制限送信"
    ]
  },
  
  // 詳細検索機能
  advancedSearch: {
    title: "詳細検索は有料会員限定",
    description: "詳細な検索条件は有料会員のみ利用できます",
    buttonText: "有料プランを見る",
    features: [
      "年齢・地域での絞り込み",
      "趣味・興味での検索",
      "オンライン状態の確認",
      "最終ログイン時間の表示"
    ]
  },
  
  // いいね無制限
  unlimitedLikes: {
    title: "いいね無制限は有料会員限定",
    description: "無制限のいいねは有料会員のみ利用できます",
    buttonText: "有料プランを見る",
    features: [
      "1日のいいね数無制限",
      "スーパーいいね機能",
      "いいねした相手の確認",
      "いいねの取り消し機能"
    ]
  }
};

// メッセージを取得するヘルパー関数
export function getPremiumMessage(feature: keyof typeof PREMIUM_MESSAGES) {
  return PREMIUM_MESSAGES[feature];
}