# 有料会員限定メッセージのカスタマイズ

## 概要
有料会員限定機能のメッセージを簡単にカスタマイズできるようになりました。

## 設定ファイル
`src/config/premium-messages.ts`

## カスタマイズ可能な機能

### 1. プロフィール詳細 (`profile`)
```typescript
profile: {
  title: "有料会員限定",
  description: "プロフィールの詳細は有料会員のみ閲覧できます",
  buttonText: "有料プランを見る",
  features: []  // 機能リストは空
}
```

### 2. コミュニティ (`community`)
```typescript
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
}
```

## メッセージの変更方法

### 例1: コミュニティのタイトルを変更
```typescript
// src/config/premium-messages.ts
community: {
  title: "プレミアムコミュニティ",  // ← ここを変更
  description: "コミュニティは有料会員のみ利用できます",
  // ...
}
```

### 例2: プロフィールの説明文を変更
```typescript
// src/config/premium-messages.ts
profile: {
  title: "有料会員限定",
  description: "詳細プロフィールをご覧いただくには有料会員登録が必要です",  // ← ここを変更
  // ...
}
```

### 例3: 機能リストを追加・変更
```typescript
// src/config/premium-messages.ts
community: {
  // ...
  features: [
    "コミュニティ作成機能",  // ← 新しい機能を追加
    "無制限の投稿",
    "プライベートコミュニティへの参加",
    "コミュニティ管理機能"
  ]
}
```

## 新しい機能を追加する場合

### 1. メッセージ設定を追加
```typescript
// src/config/premium-messages.ts
export const PREMIUM_MESSAGES = {
  // 既存の設定...
  
  // 新機能を追加
  videoCall: {
    title: "ビデオ通話は有料会員限定",
    description: "ビデオ通話機能は有料会員のみ利用できます",
    buttonText: "有料プランを見る",
    features: [
      "高画質ビデオ通話",
      "画面共有機能",
      "通話履歴の保存",
      "グループ通話"
    ]
  }
};
```

### 2. コンポーネントで使用
```typescript
import { getPremiumMessage } from '@/config/premium-messages';

// コンポーネント内で
const videoCallMessage = getPremiumMessage('videoCall');

return (
  <PremiumOnlyCard 
    title={videoCallMessage.title}
    description={videoCallMessage.description}
    buttonText={videoCallMessage.buttonText}
    features={videoCallMessage.features}
  />
);
```

## 注意事項

1. **統一性を保つ**
   - すべての機能で同じトーンのメッセージを使用
   - ボタンテキストは統一する

2. **明確な説明**
   - なぜ有料会員限定なのかを説明
   - 有料会員になるメリットを明記

3. **機能リスト**
   - 具体的な機能を箇条書きで記載
   - 4-5個程度が適切

## 現在の使用箇所

| ページ | 機能 | メッセージキー |
|--------|------|---------------|
| `/girl/[id]` | プロフィール詳細 | `profile` |
| `/community` | コミュニティ | `community` |

## 今後の拡張

将来的に以下の機能も有料会員限定にする場合、同様の方法で設定可能：
- メッセージ機能 (`message`)
- 詳細検索 (`advancedSearch`)
- 無制限いいね (`unlimitedLikes`)