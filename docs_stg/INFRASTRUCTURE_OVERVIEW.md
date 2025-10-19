# Nukune インフラストラクチャ全体像

このドキュメントは、Nukuneアプリケーションのインフラストラクチャ全体を説明します。

## 📊 アーキテクチャ図（概念）

```
┌─────────────────────────────────────────────────────────────┐
│                         ユーザー                              │
│                    (ブラウザ/LINEブラウザ)                     │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Firebase App Hosting / Cloud Run                │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Next.js 15 Application (Port 9002)           │   │
│  │                                                       │   │
│  │  • React Server Components                           │   │
│  │  • API Routes (/api/*)                              │   │
│  │  • Google Genkit (AI機能)                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  固定IP (Cloud NAT経由で送信)                                │
└───────┬─────────────────┬─────────────────┬────────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐  ┌──────────────┐  ┌─────────────────┐
│   Firebase    │  │  Cloud SQL   │  │  外部API        │
│   Services    │  │   (MySQL)    │  │                 │
└───────────────┘  └──────────────┘  └─────────────────┘
```

---

## 🏗️ インフラコンポーネントの詳細

### 1. フロントエンド & アプリケーション層

#### Firebase App Hosting (Cloud Run)

**役割**: Next.jsアプリケーションのホスティング

**実体**: Google Cloud Runで動作するサーバーレスコンテナプラットフォーム

**特徴**:
- サーバーレスコンテナプラットフォーム
- 自動スケーリング（1〜50インスタンス）
- リクエストに応じて自動的に起動/停止
- フルマネージド（サーバー管理不要）

**リソース設定** (`apphosting.yaml`で定義):
```yaml
minInstances: 1      # 常時1インスタンス起動で高速レスポンス
maxInstances: 50     # 最大50インスタンスまでスケール
concurrency: 100     # 1インスタンスあたり100同時リクエスト処理
cpu: 4               # 4コアCPU
memoryMiB: 8192      # 8GBメモリ
```

#### Next.js アプリケーション

**フレームワーク**: Next.js 15（App Router）

**開発ポート**: 9002（本番環境ではCloud Runが自動的にポート割り当て）

**主な機能**:
- SSR (Server-Side Rendering)
- React Server Components
- API Routes (`src/app/api/*`)
- AI機能 (Google Genkit)

**主要ページ**:
- `/` - ランディングページ
- `/home` - マッチング（スワイプ）ページ
- `/profile/edit` - プロフィール編集
- `/messages` - メッセージ一覧
- `/admin/*` - 管理者ページ（隠しURL）

---

### 2. データベース層

このアプリは**2つのデータベース**を使用するハイブリッド構成です。

#### A. Firebase Firestore (NoSQL)

**用途**: ユーザーデータ、リアルタイム機能

**保存データ**:
- `users` - ユーザープロフィール
- `messages` - メッセージ（チャット）
- `matches` - マッチング情報
- `subscriptions` - サブスクリプション状態
- `memos` - ユーザーが女性プロフィールに付けるメモ

**特徴**:
- リアルタイム同期（WebSocket経由）
- オフライン対応
- セキュリティルールによるアクセス制御
- 自動スケーリング
- 読み取り/書き込み回数で課金

**実装ファイル**: `src/lib/firebase/client.ts`

**セキュリティルール例**:
```javascript
match /users/{userId} {
  // 認証されたユーザーは全てのプロフィールを読める
  allow read: if request.auth != null;

  // ユーザーは自分のデータのみ書き込める
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

#### B. Cloud SQL (MySQL)

**用途**: 大量データの検索・フィルタリング

**保存データ**:
- 女性プロフィール（大量データ）
- 店舗情報
- 地域データ
- 出勤スケジュール

**特徴**:
- 複雑なクエリに最適（WHERE句、JOIN、GROUP BYなど）
- インデックスによる高速検索
- コネクションプール使用（`src/lib/mysql/db-optimized.ts`）
- LRUキャッシュでメタデータキャッシング
- インスタンス稼働時間とストレージで課金

**パフォーマンス最適化**:
- クエリキャッシュ (`src/lib/cache/queryCache.ts`)
- ロケーションキャッシュ (`src/lib/cache/locationCache.ts`)
- メタデータキャッシュ
- コネクションプーリング

**なぜ2つのDBを使うのか？**

| 用途 | Firestore | MySQL |
|------|-----------|-------|
| ユーザープロフィール | ✅ 最適 | ❌ |
| リアルタイムチャット | ✅ 最適 | ❌ |
| 複雑な検索クエリ | ❌ 遅い | ✅ 最適 |
| 大量データの絞り込み | ❌ コスト高 | ✅ 最適 |
| リアルタイム同期 | ✅ ネイティブサポート | ❌ |

**結論**: それぞれの強みを活かすハイブリッド構成

---

### 3. 認証層

#### Firebase Authentication

**役割**: ユーザー認証とセッション管理

**認証方法**:
- メール/パスワード認証

**特徴**:
- JWT（JSON Web Token）ベース認証
- セッション管理
- トークン自動更新
- LINE ブラウザ対応（特殊処理あり）

**認証フロー**:
```
1. ユーザーログイン（メール/パスワード）
   ↓
2. Firebase Auth がJWTトークン発行
   ↓
3. AuthContext (React) でクライアント側セッション管理
   ↓
4. /api/auth/session でサーバー側セッション検証
   ↓
5. 保護されたページへのアクセス許可
```

**実装ファイル**:
- クライアント側: `src/contexts/AuthContext.tsx`
- Firebase初期化: `src/lib/firebase/client.ts`
- セッションAPI: `src/app/api/auth/session/route.ts`

**LINE ブラウザ特別対応**:
- 500msタイムアウト（ページロード遅延を防ぐ）
- Cookie処理の回避策
- ブラウザ検出 (`src/lib/utils/browser-detection.ts`)

---

### 4. ストレージ層

#### Firebase Storage

**用途**: 画像・ファイル保管

**保存データ**:
- ユーザープロフィール画像
- チャット添付画像
- その他アップロードファイル

**特徴**:
- CDN経由で高速配信（世界中にエッジサーバー）
- セキュリティルールで制御
- 自動画像最適化（リサイズ、WebP変換）
- ストレージ容量と転送量で課金

**セキュリティルール例**:
```javascript
match /{allPaths=**} {
  // 認証済みユーザーのみアクセス可能
  allow read, write: if request.auth != null;
}
```

#### 外部画像ソース

アプリは複数の外部画像ソースも使用（`next.config.ts`で設定）:
- `firebasestorage.googleapis.com` - Firebase Storage
- `nukipedia.jp` - 外部コンテンツ
- `purelovers.com` - 外部コンテンツ
- `nukipedia-frontend.s3.ap-northeast-1.amazonaws.com` - AWS S3
- `placehold.co` - プレースホルダー画像

**画像最適化設定**:
```javascript
images: {
  formats: ['image/webp'],  // WebP形式で配信
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  minimumCacheTTL: 60,  // 最小60秒キャッシュ
}
```

---

### 5. ネットワーク層（固定IP）

#### VPC (Virtual Private Cloud) アーキテクチャ

```
Cloud Run (アプリケーション)
    ↓
VPC Connector (サーバーレス VPC アクセス)
    ↓
VPC Network (default)
    ↓
Cloud Router (ルーティング管理)
    ↓
Cloud NAT (Network Address Translation)
    ↓
静的IPアドレス (予約済みグローバルIP)
    ↓
外部サービス (決済、外部API等)
```

**なぜ固定IPが必要？**
1. **決済サービスのホワイトリスト登録**
   - Telecom Credit等の決済プロバイダーがIPアドレス制限を要求
2. **外部APIのIP制限対応**
   - セキュリティ要件として送信元IPの固定が必要
3. **監査・ログ管理**
   - アクセス元を特定しやすくする

**コンポーネント詳細**:

1. **VPC Connector**
   - Cloud Run（サーバーレス）をVPCネットワークに接続
   - IP範囲: 例 `10.8.0.0/28`（16個のIPアドレス）
   - 最小/最大インスタンス: 2〜10

2. **Cloud Router**
   - VPCのルーティングを管理
   - BGPルーティングプロトコル使用
   - リージョン: `asia-northeast1`

3. **Cloud NAT**
   - 送信トラフィックに固定IPを割り当て
   - `ALL_TRAFFIC` モード（すべての送信トラフィック）
   - 手動で静的IPを指定

4. **静的IP（グローバル）**
   - GCPで予約した固定IPアドレス
   - リージョナルIP（特定リージョンに固定）
   - 外部サービスにこのIPを登録

**設定ファイル**: `apphosting.yaml`
```yaml
vpcAccess:
  egress: ALL_TRAFFIC
  networkInterfaces:
    - network: projects/nukune/global/networks/default
      subnetwork: projects/nukune/regions/asia-northeast1/subnetworks/default
```

---

### 6. AI機能

#### Google Genkit

**用途**: AI機能の実装フレームワーク

**機能**:
- プロフィール検証
- コンテンツモデレーション
- 推奨マッチング（将来実装予定）

**実装場所**: `src/ai/flows/`

**実行環境**:
- Next.jsアプリケーション内で動作
- サーバーサイド処理

**開発サーバー**:
```bash
npm run genkit:dev      # Genkit開発サーバー起動
npm run genkit:watch    # ファイル監視モード
```

**プロバイダー**: Google AI (`@genkit-ai/googleai`)

**環境変数**: `GOOGLE_GENKIT_API_KEY`

---

### 7. デプロイ & CI/CD

#### Git連携による自動デプロイ

```
開発者
  ↓ (コード修正)
GitHub リポジトリ (staging ブランチ)
  ↓ (git push)
Firebase App Hosting (ビルドトリガー)
  ↓ (自動検知)
ビルドプロセス
  ↓ (npm install, npm run build)
Dockerコンテナイメージ作成
  ↓
Google Container Registry
  ↓
Cloud Run デプロイ
  ↓
本番環境更新（新リビジョン）
  ↓ (トラフィック切り替え)
ユーザーに新バージョン提供
```

**デプロイフロー詳細**:

1. **コミット & プッシュ**
   ```bash
   git add .
   git commit -m "feat: 新機能追加"
   git push origin staging
   ```

2. **Firebase App Hostingが変更を検知**
   - GitHubのWebhookで通知
   - 自動的にビルドジョブを開始

3. **ビルドプロセス**
   - 依存関係インストール (`npm install`)
   - Next.jsビルド (`npm run build`)
   - Dockerイメージ作成

4. **デプロイ**
   - Container RegistryにPush
   - Cloud Runに新リビジョンをデプロイ
   - 徐々にトラフィックを新バージョンに移行

5. **ロールバック機能**
   - 問題があれば前のリビジョンに即座に戻せる
   - Cloud Runコンソールから手動操作可能

**ビルド設定**: `apphosting.yaml`で管理

**通知**: Firebase Consoleでビルド成功/失敗を確認可能

---

## 🔄 リクエストフロー例

### ケース1: ユーザーが女性プロフィールを検索する場合

```
1. ユーザー: 検索条件を入力（地域: 東京、年齢: 20-25歳）
   ↓
2. ブラウザ: Next.jsアプリにHTTPリクエスト
   GET /api/mysql-girls-fast?area=tokyo&age=20-25
   ↓
3. Cloud Run: Next.js API Routeが処理
   src/app/api/mysql-girls-fast/route.ts
   ↓
4. キャッシュチェック: クエリキャッシュを確認
   - ヒット → キャッシュから返却（超高速）
   - ミス → 次へ
   ↓
5. Cloud SQL (MySQL): データを検索
   SELECT * FROM girls
   WHERE area = 'tokyo' AND age BETWEEN 20 AND 25
   ORDER BY last_login DESC
   ↓
6. 結果をキャッシュ: LRUキャッシュに保存（60秒TTL）
   ↓
7. レスポンス: JSON形式で返却
   {
     "girls": [...],
     "total": 152,
     "cached": false
   }
   ↓
8. ブラウザ: TanStack Queryでデータ管理、UIに表示
   ↓
9. ユーザー: 検索結果を閲覧
```

**パフォーマンス**:
- 初回: 200-500ms
- キャッシュヒット時: 10-50ms
- CDNキャッシュ有効時: 5-20ms

---

### ケース2: ユーザーが「いいね」をする場合

```
1. ユーザー: いいねボタンをクリック（女性ID: girl_123）
   ↓
2. React (Optimistic Update): 即座にUIを更新
   - ハートアイコンを赤色に変更（ユーザー体験向上）
   ↓
3. Next.js API: いいね情報を保存リクエスト
   POST /api/likes
   Body: { girlId: 'girl_123' }
   ↓
4. Cloud Run: API Routeが処理
   src/app/api/likes/route.ts
   ↓
5. Firebase Auth: ユーザートークン検証
   - トークン有効 → 続行
   - 無効 → 401エラー返却
   ↓
6. Firestore: likesコレクションに保存
   db.collection('likes').add({
     userId: 'user_abc',
     girlId: 'girl_123',
     timestamp: now()
   })
   ↓
7. リアルタイムリスナー: 他デバイスにも即座に同期
   WebSocket経由で変更を通知
   ↓
8. レスポンス: 成功を返却
   { "success": true, "likeId": "like_xyz" }
   ↓
9. ブラウザ: 確認メッセージ表示（もし失敗したらOptimistic Updateを巻き戻し）
```

**Optimistic Updateのメリット**:
- ユーザーは待たずに即座にフィードバックを得られる
- ネットワーク遅延を感じさせない
- UX向上

**実装**: `src/lib/hooks/useLikeOptimistic.ts`

---

### ケース3: チャットメッセージ送信（リアルタイム）

```
1. ユーザーA: メッセージ入力「こんにちは！」
   ↓
2. ブラウザA: Firestoreに直接書き込み（クライアントSDK）
   db.collection('messages').add({
     conversationId: 'conv_123',
     senderId: 'user_a',
     text: 'こんにちは！',
     timestamp: serverTimestamp()
   })
   ↓
3. Firestore: セキュリティルールで検証
   - 送信者が会話の参加者か確認
   - OK → 保存
   ↓
4. リアルタイムリスナー: WebSocketで変更を配信
   ↓
5. ブラウザB（相手）: onSnapshotコールバック発火
   新しいメッセージを受信
   ↓
6. ブラウザB: UIを自動更新
   「こんにちは！」と表示
   ↓
7. 両方のブラウザ: 同期完了（遅延数百ms以下）
```

**リアルタイム性**:
- 通常の遅延: 100-300ms
- WebSocket接続維持
- オフライン時はローカルキャッシュに保存、オンライン復帰時に同期

---

## 🌍 環境構成

### 本番環境 (Production)

| 項目 | 設定値 |
|------|--------|
| GCPプロジェクト | `nukune` |
| Firebase プロジェクト | `nukune` |
| 対象ブランチ | `master` |
| Cloud Run リージョン | `asia-northeast1` (東京) |
| URL | Firebase App Hostingが提供するURL |
| リソース | CPU: 4コア, メモリ: 8GB |
| インスタンス数 | 1〜50（自動スケール） |
| 固定IP | 設定済み（Cloud NAT経由） |

### ステージング環境 (Staging) - 構築予定

| 項目 | 設定値 |
|------|--------|
| GCPプロジェクト | `nukune-stg` ✅ 作成済み |
| Firebase プロジェクト | `nukune-stg01-475508` ✅ 作成済み |
| 対象ブランチ | `staging` |
| Cloud Run リージョン | `asia-northeast1` (東京) |
| URL | 構築後に発行される |
| リソース | CPU: 2コア, メモリ: 4GB（コスト削減） |
| インスタンス数 | 0〜10（使わない時は0） |
| 固定IP | これから設定 |

### 開発環境 (Local)

| 項目 | 設定値 |
|------|--------|
| 実行環境 | ローカルマシン |
| ポート | 9002 |
| Firebase | 本番/ステージング環境を選択可能 |
| MySQL | ローカルまたはCloud SQL接続 |
| ホットリロード | 有効（Turbopack） |

**環境切り替え**:
- `.env.local` ファイルで環境変数を管理
- Firebaseプロジェクトを切り替え可能

---

## 💰 コストが発生する主なサービス

### 1. Cloud Run (Firebase App Hosting)

**課金要素**:
- CPU時間: リクエスト処理時間
- メモリ使用量
- リクエスト数
- ネットワーク送信（egress）

**無料枠** (月あたり):
- 200万リクエスト
- 36万GB秒のメモリ
- 18万vCPU秒
- 1GB ネットワーク送信

**推定コスト** (中規模トラフィック):
- 月間10万リクエスト: $5-15
- 月間100万リクエスト: $30-80

### 2. Cloud SQL (MySQL)

**課金要素**:
- インスタンス稼働時間（CPU/メモリ）
- ストレージ容量
- バックアップストレージ
- ネットワーク送信

**推定コスト**:
- `db-n1-standard-2` (2vCPU, 7.5GB): 約$100/月
- ストレージ 100GB SSD: 約$17/月
- 合計: 約$120/月

**コスト削減策**:
- ステージング環境は夜間停止
- 開発環境は共有インスタンス使用

### 3. Firebase Firestore

**課金要素**:
- ドキュメント読み取り回数
- ドキュメント書き込み回数
- ドキュメント削除回数
- ストレージ容量
- ネットワーク送信

**無料枠** (日あたり):
- 50,000 読み取り
- 20,000 書き込み
- 20,000 削除
- 1GB ストレージ

**推定コスト** (アクティブユーザー1000人):
- 読み取り: 100万回/月 → $3.60
- 書き込み: 20万回/月 → $3.60
- ストレージ: 10GB → $1.80
- 合計: 約$10/月

### 4. Firebase Storage

**課金要素**:
- ストレージ容量
- ダウンロード（ネットワーク送信）
- アップロード（ネットワーク受信）
- 操作回数

**無料枠**:
- 5GB ストレージ
- 1GB/日 ダウンロード
- 20,000 ダウンロード操作/日

**推定コスト** (画像50GB):
- ストレージ: 50GB → $2.50/月
- ダウンロード: 100GB/月 → $12/月
- 合計: 約$15/月

### 5. Cloud NAT

**課金要素**:
- NAT ゲートウェイ時間
- データ処理量（GB単位）

**推定コスト**:
- ゲートウェイ: $0.044/時間 × 730時間 = $32/月
- データ処理: 100GB × $0.045 = $4.50/月
- 合計: 約$37/月

### 6. VPC Connector

**課金要素**:
- インスタンス時間
- スループット

**推定コスト**:
- 2インスタンス常時稼働: 約$15/月

### 7. Firebase Authentication

**課金**:
- 基本無料（月間10,000アクティブユーザーまで無料）
- 超過分: $0.0055/ユーザー

**推定コスト**:
- 5,000ユーザー: 無料
- 15,000ユーザー: $27.50/月

---

### 💡 月額コスト概算（本番環境）

| サービス | 推定コスト |
|---------|-----------|
| Cloud Run | $30-80 |
| Cloud SQL | $120 |
| Firestore | $10 |
| Storage | $15 |
| Cloud NAT | $37 |
| VPC Connector | $15 |
| Firebase Auth | $0-30 |
| **合計** | **$230-310/月** |

### 💡 ステージング環境のコスト削減

- Cloud Run: minInstances=0 で **$10-20**
- Cloud SQL: 小型インスタンス + 夜間停止で **$30-50**
- その他サービス: 利用量少ないため **$10-20**
- **ステージング合計: $50-90/月**

---

## 🔐 セキュリティ設定

### 1. Firestore Security Rules

**目的**: データベースレベルでのアクセス制御

**例**:
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーコレクション
    match /users/{userId} {
      // 認証済みユーザーは全プロフィール閲覧可能
      allow read: if request.auth != null;

      // 自分のプロフィールのみ編集可能
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // メッセージコレクション
    match /messages/{messageId} {
      // 会話の参加者のみアクセス可能
      allow read, write: if request.auth != null &&
        request.auth.uid in resource.data.participants;
    }
  }
}
```

**テスト**: Firebaseコンソールのルールシミュレーターで検証

### 2. Storage Security Rules

**目的**: ファイルアップロード/ダウンロードの制御

**例**:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // プロフィール画像
    match /profiles/{userId}/{fileName} {
      // 本人のみアップロード可能
      allow write: if request.auth.uid == userId;

      // 認証済みユーザーは閲覧可能
      allow read: if request.auth != null;
    }
  }
}
```

### 3. Content Security Policy (CSP)

**目的**: XSS攻撃の防止

**設定場所**: `next.config.ts`

**主要ディレクティブ**:
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https://firebasestorage.googleapis.com;
connect-src 'self' https://*.googleapis.com wss://*.firebaseio.com;
```

### 4. HTTPS & Security Headers

**設定ヘッダー** (`next.config.ts`):
```javascript
{
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)'
}
```

### 5. Firebase Authentication

**セキュリティ機能**:
- トークン自動検証
- セッション期限管理
- 不正ログイン検知（Firebase提供）
- パスワード強度チェック

**実装**:
- サーバー側検証: `/api/auth/session`
- クライアント側: `AuthContext.tsx`

### 6. API Route保護

**パターン1: 認証必須**
```typescript
export async function GET(request: Request) {
  const token = request.headers.get('Authorization');
  const user = await verifyToken(token);

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 処理続行
}
```

**パターン2: 管理者のみ**
```typescript
const adminPassword = process.env.API_REGISTER_PASSWORD;
if (providedPassword !== adminPassword) {
  return new Response('Forbidden', { status: 403 });
}
```

### 7. 環境変数管理

**機密情報**:
- `.env.local` ファイル（gitignore済み）
- Firebase App Hostingの環境変数設定
- 本番とステージングで別々の値を使用

**重要な環境変数**:
```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_PROJECT_ID

# MySQL
MYSQL_HOST
MYSQL_USER
MYSQL_PASSWORD

# API Keys
GOOGLE_GENKIT_API_KEY
API_REGISTER_PASSWORD
```

---

## 📊 モニタリング & ログ

### Cloud Run (Firebase App Hosting) ログ

**確認場所**:
- Firebase Console > App Hosting > ビルド/デプロイログ
- GCP Console > Cloud Run > ログ

**ログの種類**:
- アクセスログ（リクエスト/レスポンス）
- エラーログ（500エラー等）
- アプリケーションログ（console.log出力）

### Cloud SQL ログ

**確認場所**: GCP Console > SQL > ログ

**監視項目**:
- スロークエリ（1秒以上）
- 接続エラー
- デッドロック

### Firebase コンソール

**Analytics**:
- ユーザー数
- アクティブユーザー
- 画面遷移

**Performance Monitoring**:
- ページロード時間
- APIレスポンス時間

**Crashlytics** (設定すれば):
- クライアントエラー追跡

---

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. ビルドエラー

**症状**: Firebase App Hostingでビルドが失敗

**確認事項**:
- ビルドログを確認（Firebase Console）
- 環境変数が正しく設定されているか
- `package.json` の依存関係

**解決策**:
```bash
# ローカルでビルドテスト
npm run build

# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install
```

#### 2. データベース接続エラー

**症状**: `Error: connect ETIMEDOUT`

**確認事項**:
- Cloud SQL インスタンスが起動しているか
- Cloud Runサービスに Cloud SQL 接続が追加されているか
- VPC Connector が正しく設定されているか

**解決策**:
- GCP Console > Cloud SQL で接続確認
- Cloud Runの「接続」タブでCloud SQL追加

#### 3. 認証エラー

**症状**: ログインできない、401エラー

**確認事項**:
- Firebase Console > Authentication > 承認済みドメイン
- デプロイしたドメインが追加されているか
- トークンの有効期限

**解決策**:
- 承認済みドメインにアプリのURLを追加
- ログアウト→再ログイン

#### 4. 固定IPが機能しない

**症状**: 外部サービスから「不正なIPアドレス」エラー

**確認事項**:
- VPC Connector作成済みか
- Cloud NAT設定済みか
- `apphosting.yaml` の `vpcAccess` 設定

**確認方法**:
```bash
# アプリから自分のIPを確認
curl https://your-app-url/api/check-public-ip
```

---

## 📚 参考リンク

### 公式ドキュメント

- [Firebase App Hosting](https://firebase.google.com/docs/app-hosting)
- [Cloud Run](https://cloud.google.com/run/docs)
- [Cloud SQL](https://cloud.google.com/sql/docs)
- [Firebase Firestore](https://firebase.google.com/docs/firestore)
- [Cloud NAT](https://cloud.google.com/nat/docs)
- [VPC](https://cloud.google.com/vpc/docs)
- [Next.js 15](https://nextjs.org/docs)

### 内部ドキュメント

- `README.md` - プロジェクト概要
- `CLAUDE.md` - 開発ガイド
- `docs/STAGING_SETUP.md` - ステージング環境構築手順

---

## 📝 まとめ

Nukuneアプリケーションのインフラは以下の7つの主要コンポーネントで構成されています：

| # | コンポーネント | 役割 | 技術 |
|---|---------------|------|------|
| 1 | アプリケーション | ホスティング | Firebase App Hosting / Cloud Run |
| 2 | データベース | データ保存 | Firestore + Cloud SQL (MySQL) |
| 3 | 認証 | ユーザー管理 | Firebase Authentication |
| 4 | ストレージ | ファイル保存 | Firebase Storage |
| 5 | ネットワーク | 固定IP | VPC + Cloud NAT |
| 6 | AI | 機械学習 | Google Genkit |
| 7 | デプロイ | CI/CD | Git連携自動デプロイ |

**特徴**:
- ✅ サーバーレスアーキテクチャ（管理不要）
- ✅ 自動スケーリング（トラフィックに応じて自動調整）
- ✅ ハイブリッドデータベース（FirestoreとMySQLの長所を活用）
- ✅ 固定IP（セキュリティ要件対応）
- ✅ 完全自動デプロイ（git pushで本番反映）

**ステージング環境構築** = これら全ての構成を複製して、テスト用の独立した環境を作ること

何か特定の部分について、もっと詳しく知りたいことはありますか？
