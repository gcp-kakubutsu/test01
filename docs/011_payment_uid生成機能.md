# 001_payment_uid生成機能

## 機能概要
Firebase側で16桁の英数字payment_uidを生成し、決済会社のsendidとして使用可能にする機能の実装。Firebaseの28桁uidでは決済会社の16桁制限に対応できない問題を解決する。

## 詳細要件

### 必要な機能
1. 16桁の英数字生成関数の実装
2. payment_uidの重複チェック機能
3. ユニークなpayment_uid生成の保証
4. エラーハンドリングとリトライ機能

### 技術仕様
- **文字セット**: 英大文字・小文字・数字（62文字）
- **長さ**: 厳密に16桁
- **重複チェック**: Firestore上での重複確認
- **リトライ**: 最大10回まで生成を試行

## Todoリスト
- [x] utils/paymentUidGenerator.tsファイルの作成
- [x] generatePaymentUid関数の実装（16桁ランダム文字列生成）
- [x] checkPaymentUidUnique関数の実装（Firestore重複チェック）
- [x] generateUniquePaymentUid関数の実装（ユニーク保証付き生成）
- [x] エラーハンドリングの実装
- [x] リトライロジックの実装
- [x] 生成文字列のバリデーション追加

## 依存関係
- Firebase/Firestore設定が完了していること
- データベース接続が確立されていること

## 受け入れ基準
- [x] 16桁の英数字が生成される
- [x] 生成されるpayment_uidは必ずユニークである
- [x] 重複チェックが正しく動作する
- [x] エラー時に適切なエラーメッセージが返される
- [x] リトライ機能が正しく動作する

## 実装ファイル
- `src/utils/paymentUidGenerator.ts` (新規作成完了)

## 推定工数
4時間

## 実装状態
- ステータス: 完了
- 優先度: 高（Phase 1の基盤機能）