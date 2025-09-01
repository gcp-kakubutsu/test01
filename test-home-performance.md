# /homeページ パフォーマンス改善テスト結果

## 実装した改善内容

### 改善前
1. クライアント側でfetchGirlsFromMySQLでデータ取得
2. cachedUltraSortでクライアント側ソート
3. 位置情報による並び替えをJavaScriptで実行

### 改善後
1. APIリクエストに位置情報パラメータ（userLat, userLng）を追加
2. MySQL側でST_Distance_Sphere + area_smallsを使った距離計算
3. サーバー側で距離順にソート済みデータを返却
4. クライアント側のソート処理を完全削除

## 期待される効果

### パフォーマンス
- **改善前**: データ取得 + クライアントソート = 約200-400ms
- **改善後**: データ取得のみ（ソート済み）= 約50-100ms
- **改善率**: 75%削減（4倍高速化）

### 距離表示
- サーバーから返されたdistance_kmフィールドを直接使用
- 999999（位置情報なし）の場合は非表示
- 1km未満は「XXXm先」、1km以上は「X.Xkm先」で表示

## テスト手順

1. ブラウザのDevToolsを開く
2. Consoleタブでログを確認
3. /homeページをリロード
4. 以下のログを確認：
   - "Starting optimized data fetch with server-side sorting"
   - "Using location-based sorting: lat=XX, lng=XX"
   - "Data already sorted by server (distance-based)"
   - "Top 5 girls by distance:"

## 実装ファイル
- `/src/app/home/page.tsx` - 改善済み
- `/src/app/api/mysql-girls-fast/route.ts` - 位置情報対応済み
- `/src/lib/mysql/girls-optimized.ts` - area_smallsとのJOIN実装済み