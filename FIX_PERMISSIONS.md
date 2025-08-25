# Firebase App Hosting 権限修正手順

## 1. Firebase Console で確認
https://console.firebase.google.com/project/nukune/settings/iam

## 2. 必要なサービスアカウント
- `firebase-apphosting-compute@nukune.iam.gserviceaccount.com`

## 3. 必要な権限（ロール）
- Cloud Run Admin
- Cloud Run Service Agent  
- Service Account User
- Cloud Build Service Account
- Firebase App Hosting Service Agent

## 4. GCP Console での確認
https://console.cloud.google.com/iam-admin/iam?project=nukune

## 5. サービスアカウントに付与すべき権限
```
roles/run.admin
roles/iam.serviceAccountUser
roles/cloudbuild.builds.editor
roles/artifactregistry.writer
```

## 6. 権限を修正後
- Firebase Studioから再度デプロイ
- または新しいバックエンドを作成

## 注意
プロジェクトをShareした際に、デフォルトのサービスアカウント権限が変更される場合があります。
特にOwner権限を持つユーザーが複数いる場合、権限の競合が発生することがあります。