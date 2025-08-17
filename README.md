md
# Nukune (ヌクネ)

安全で信頼性の高い出会いをサポートするマッチングアプリケーション。Instagram風のUIとAI機能を備えた、日本語対応のモバイルファーストアプリです。

## 技術スタック

### フロントエンド
- **フレームワーク**: Next.js 15.3.3 (App Router + React Server Components)
- **UI ライブラリ**: React 18.3.1 + React DOM 18.3.1
- **スタイリング**: 
  - Tailwind CSS 3.4.1
  - shadcn/ui (Radix UI コンポーネント)
  - Sass 1.89.2
  - tailwindcss-animate 1.0.7
- **フォーム管理**: 
  - react-hook-form 7.54.2
  - Zod 3.24.2 (バリデーション)
- **状態管理**: 
  - React Context API (認証状態)
  - TanStack Query 5.66.0 (データフェッチング)

### バックエンド & インフラ
- **BaaS**: Firebase 11.8.1
  - Firebase Auth (認証)
  - Firestore (NoSQLデータベース)
  - Firebase Storage (ファイルストレージ)
  - Firebase Admin SDK 12.3.0
- **データベース**: MySQL2 3.14.3 (追加データストア)
- **ホスティング**: Firebase App Hosting (Cloud Run へのデプロイ)
- **キャッシュ**: LRU Cache 11.1.0

### AI & 機械学習
- **AIフレームワーク**: Google Genkit 1.8.0
- **AI プロバイダー**: Google AI (@genkit-ai/googleai 1.8.0)
- **Next.js 統合**: @genkit-ai/next 1.8.0

### 開発ツール
- **言語**: TypeScript 5.x
- **ビルドツール**: 
  - Next.js Turbopack (開発サーバー)
  - PostCSS 8.x
- **コード品質**:
  - ESLint 9.30.0 (Next.js設定込み)
  - TypeScript Compiler (型チェック)
- **パッケージ管理**: npm
- **パッチ管理**: patch-package 8.0.0

### UIコンポーネント
- **Radix UI Components**:
  - アコーディオン、アラートダイアログ、アバター
  - チェックボックス、ダイアログ、ドロップダウンメニュー
  - ラベル、メニューバー、ポップオーバー
  - プログレスバー、ラジオグループ、スクロールエリア
  - セレクト、セパレーター、スライダー
  - スイッチ、タブ、トースト、ツールチップ
- **アイコン**: Lucide React 0.475.0
- **チャート**: Recharts 2.15.1
- **コマンドパレット**: cmdk 1.1.1
- **カレンダー**: react-day-picker 8.10.1

### ユーティリティ
- **日付処理**: date-fns 3.6.0
- **クラス名管理**: 
  - clsx 2.1.1
  - class-variance-authority 0.7.1
  - tailwind-merge 3.0.1
- **JWT処理**: jsonwebtoken 9.0.2
- **環境変数管理**: dotenv 16.6.1

### セキュリティ & パフォーマンス
- **セキュリティヘッダー**: 
  - Content Security Policy
  - Strict Transport Security
  - X-Frame-Options, X-Content-Type-Options
- **画像最適化**: Next.js Image Optimization
- **キャッシング戦略**: 
  - CDN キャッシング
  - Stale-While-Revalidate
- **バンドル最適化**: optimizePackageImports

### 開発環境
- **Node.js**: 推奨バージョン 18.x 以上
- **開発ポート**: 9002 (デフォルトの3000ではなく)
- **TypeScript設定**: 
  - ES2017 ターゲット
  - Strict モード有効
  - パスエイリアス: @/* → src/*

## はじめに

開発を始めるには、まず依存関係をインストールし、開発サーバーを起動します。

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:9002` を開いてください。これがローカル開発環境でアプリを確認する方法です。

## Firebaseの設定

このアプリケーションはFirebaseの各種サービス（認証、Firestoreデータベースなど）を利用します。
Firebaseプロジェクトをセットアップし、必要な設定情報をアプリケーションに提供する必要があります。

1.  **Firebaseプロジェクトの作成:**
    *   [Firebaseコンソール](https://console.firebase.google.com/) にアクセスし、新しいFirebaseプロジェクトを作成するか、既存のプロジェクトを使用します。

2.  **ウェブアプリの登録:**
    *   Firebaseプロジェクト内で、新しいウェブアプリを登録します。
    *   「プロジェクトの設定」 > 「全般」タブの「マイアプリ」セクションで、「アプリを追加」をクリックし、ウェブ (`</>`) を選択します。
    *   アプリのニックネーム（例: Nukune Web）を登録します。

3.  **Firebase SDK構成の取得:**
    *   ウェブアプリを登録すると、`firebaseConfig` オブジェクトが表示されます。このオブジェクトには、APIキーやプロジェクトIDなどの重要な情報が含まれています。

4.  **.envファイルの作成と設定:**
    *   プロジェクトのルートディレクトリ（`package.json` と同じ階層）に `.env` という名前のファイルを作成します（`.env.local` でも構いません）。
    *   以下の内容を `.env` ファイルにコピーし、`YOUR_..._HERE` の部分を、手順3で取得したご自身のFirebaseプロジェクトの値に置き換えてください。

    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY_HERE
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN_HERE
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID_HERE
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET_HERE
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID_HERE
    NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID_HERE
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID_HERE # これはオプションです
    ```

    **注意:** `.env` ファイルはGitリポジトリにコミットしないでください。`.gitignore` ファイルに `.env` が含まれていることを確認してください。
    **重要:** `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`（例: `your-project-id.firebaseapp.com`）は、主にFirebase SDKが認証処理に内部的に使用するドメインです。通常、開発したアプリをブラウザで直接表示するためのURLではありません。

5.  **開発サーバーの再起動:**
    *   `.env` ファイルを作成または編集した後は、Next.jsの開発サーバーを再起動してください（ターミナルで `Ctrl+C` を押して停止し、再度 `npm run dev` を実行）。これにより、新しい環境変数がアプリケーションに読み込まれます。

6.  **Firebase Authentication の有効化:**
    *   Firebaseコンソールの「Authentication」セクションで、「始める」をクリックします。
    *   「ログイン方法」タブで、「メール/パスワード」プロバイダを有効にします。

7.  **Firestore Database の設定:**
    *   Firebaseコンソールの「Firestore Database」セクションで、「データベースの作成」をクリックします。
    *   テストモードまたは本番モードを選択して開始します（開発初期はテストモードで問題ありませんが、本番リリース前には適切なセキュリティルールを設定してください）。
    *   ロケーションを選択します。

## 開発とデプロイ

### ローカル開発
上記「はじめに」の通り `npm run dev` を実行し、 `http://localhost:9002` で開発中のアプリを確認できます。

### LINEブラウザでのローカルテスト（ngrok使用）

開発中のアプリをLINEブラウザで確認するには、ngrokを使用してローカル環境を外部からアクセス可能にします。

#### 前提条件
- ngrokのインストール（[公式サイト](https://ngrok.com/)からダウンロード）
- ngrokアカウントの作成とauthtokenの設定（初回のみ）
- 開発サーバーが起動していること（`npm run dev`）

#### 初回セットアップ（ngrokを初めて使う場合）

1. **ngrokアカウントを作成**:
   - [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup) にアクセス
   - 無料アカウントを作成（GitHubまたはGoogleアカウントでも可）

2. **authtokenを設定**:
```bash
# セットアップスクリプトを実行
./scripts/setup-ngrok.sh
# プロンプトに従ってauthtokenを入力

# または手動で設定
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

#### 手順

1. **開発サーバーを起動**（ターミナル1）:
```bash
npm run dev
```

2. **ngrokトンネルを作成**（ターミナル2）:
```bash
# 方法1: スクリプトを使用（推奨）
./scripts/start-ngrok.sh

# 方法2: 直接コマンドを実行
ngrok http 9002
```

3. **生成されたURLを確認**:
ngrokが起動すると、以下のような情報が表示されます：
```
Forwarding  https://xxxxx-xx-xx-xxx-xxx.ngrok-free.app -> http://localhost:9002
```
この `https://xxxxx-xx-xx-xxx-xxx.ngrok-free.app` がLINEブラウザでアクセスするURLです。

4. **LINEでURLを共有**:
- LINEのトークで自分宛てにURLを送信
- 送信したリンクをタップしてLINEブラウザで開く

#### 注意事項
- ngrokの無料プランでは、URLは一時的なものです（セッション毎に変わります）
- 8時間でセッションがタイムアウトします
- 初回アクセス時にngrokの警告画面が表示される場合があります（「Visit Site」をクリック）
  - アプリ内では自動的にこの警告をスキップするヘッダーが設定されています
- Firebase認証のリダイレクトURLにngrokドメインを追加する必要がある場合があります
- ngrok使用時は開発ツールのコンソールでログを確認できます

#### トラブルシューティング

**Q: LINEブラウザで認証がうまくいかない**
A: 以下を確認してください：
1. Firebase ConsoleでAuthentication > 設定 > 承認済みドメインにngrokのドメインを追加
2. Firestoreのセキュリティルールが正しく設定されているか確認（FIRESTORE_RULES.mdを参照）
3. デバッグパネル（画面右下の紫ボタン）でFirebase接続状態を確認

**Q: セッションが保持されない**
A: LINEブラウザは特殊なCookie処理をするため、セッション管理に問題が生じることがあります。`/api/subscription/check`エンドポイントなど、LINEブラウザ専用の処理が正しく動作しているか確認してください。

**Q: モザイクや有料会員機能の動作確認**
A: ブラウザのコンソールログを確認するために、以下を利用できます：
- vconsole（モバイルデバッグツール）を導入
- ngrokのWeb Interfaceで通信ログを確認（`http://127.0.0.1:4040`）

```
 1. ngrokアカウントを作成
    - https://dashboard.ngrok.com/signup にアクセス
    - 無料アカウントを作成（GitHub/Googleでログインも可）
  2. authtokenを取得
    - ログイン後、https://dashboard.ngrok.com/get-started/your-aut
  htoken にアクセス
    - 表示されているauthtokenをコピー
  3. authtokenを設定
  ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
  4. 再度ngrokを起動
  ./scripts/start-ngrok.sh
```

### デプロイ（アプリの公開）
作成したアプリをインターネット上で公開するには、「デプロイ」作業が必要です。
このプロジェクトは `apphosting.yaml` を含んでおり、Firebase App Hosting へのデプロイを想定しています。
Firebase App Hosting を利用すると、Firebaseが提供する公開URL（例: `[あなたのプロジェクトID].web.app` や `[あなたのアプリ名].apphosting.dev`）でアプリがアクセス可能になります。

デプロイ手順については、Firebaseの公式ドキュメントをご確認ください。
*   Firebase App Hosting: [https://firebase.google.com/docs/hosting/app-hosting](https://firebase.google.com/docs/hosting/app-hosting)

`nukune-11e6f.firebaseapp.com` で "Site Not Found" と表示されるのは、そのアドレス（Firebase Hostingのデフォルトアドレス）にはまだ何もウェブサイトがデプロイされていないためです。Firebase App Hosting でデプロイした場合、通常これとは異なるURLが割り当てられます。

## 主なページ

*   `src/app/page.tsx`: ランディングページ
*   `src/app/home/page.tsx`: ログイン後のメインのマッチング（スワイプ）ページ
*   `src/app/profile/edit/page.tsx`: プロフィール編集ページ
*   `src/app/messages/page.tsx`: メッセージ一覧ページ

## AI機能 (Genkit)

AI関連の機能は `src/ai/flows/` ディレクトリにあります。
開発時には、Genkitの開発サーバーを別途起動する必要がある場合があります。

```bash
npm run genkit:dev
# または変更を監視する場合
npm run genkit:watch
```

## Firebase Security Rules のデプロイ方法

### Firebase Studioユーザー向け：Firebaseコンソールを使用した方法（推奨）

1. **Firebaseコンソールにアクセス**
   - [Firebase Console](https://console.firebase.google.com)にアクセス
   - 対象のプロジェクトを選択

2. **Firestore セキュリティルールを編集**
   - 左側のメニューから「Firestore Database」を選択
   - 上部のタブから「ルール」をクリック
   - オンラインエディタでルールを直接編集

3. **ルールを公開**
   - ルールの編集が完了したら、「公開」ボタンをクリック
   - 変更は即座に反映されます（新しいクエリには最大1分、既存のリスナーには最大10分かかる場合があります）

### Storage セキュリティルールも同様に設定

1. **Storage ルールの編集**
   - Firebaseコンソールの「Storage」セクションを選択
   - 「ルール」タブをクリック
   - ルールを編集して「公開」

### 現在のプロジェクトのセキュリティルール

**Firestore ルール (firestore.rules):**
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection rules
    match /users/{userId} {
      // 認証されたユーザーは全てのユーザープロフィールを読める（マッチング用）
      allow read: if request.auth != null;
      
      // ユーザーは自分のデータのみ書き込める
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Messages collection rules
    match /messages/{messageId} {
      // 会話の参加者のみ読み書き可能
      allow read, write: if request.auth != null && 
        (request.auth.uid in resource.data.participants ||
         request.auth.uid in request.resource.data.participants);
    }
    
    // Matches collection rules
    match /matches/{matchId} {
      // マッチに関わるユーザーのみ読み書き可能
      allow read, write: if request.auth != null && 
        (request.auth.uid in resource.data.users ||
         request.auth.uid in request.resource.data.users);
    }
  }
}
```

**Storage ルール (storage.rules):**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 注意事項

- **テスト環境**: 開発中は上記のようなシンプルなルールで問題ありませんが、本番環境ではより厳格なルールを設定してください
- **Firebase CLI vs コンソール**: Firebase CLIでデプロイすると、コンソールで設定したルールが上書きされます。チーム開発では統一した方法を使用してください
- **ルールシミュレーター**: Firebaseコンソールのルールタブには、ルールをテストできるシミュレーターがあります。公開前に必ずテストしてください

## 管理者用秘密URL

以下のURLは管理者のみがアクセス可能な隠しページです。これらのURLは通常のナビゲーションからはアクセスできません。

### 1. 女性ユーザー手動登録ページ
- URL: `/admin/register-girl`
- 機能: 管理者が手動で女性ユーザーを登録できます
- アクセス制限: URLを知っている人のみ

### 2. API経由女性ユーザー登録ページ
- URL: `/admin/api-register-girl`
- 機能: 外部APIから女性ユーザーデータを取得して一括登録（将来的な実装用）
- アクセス制限: 共通パスワードによる認証が必要
- デフォルトパスワード: `nukune-api-2024`（環境変数 `API_REGISTER_PASSWORD` で変更可能）

**注意事項:**
- これらのURLは公開しないでください
- APIパスワードは本番環境では必ず変更してください
- API統合機能は現在プレースホルダーのみで、実際のAPI仕様に合わせて実装が必要です
