#!/bin/bash

echo "🔧 ngrok セットアップスクリプト"
echo "=================================="
echo ""
echo "このスクリプトはngrokの初期設定を支援します。"
echo ""
echo "📝 手順:"
echo "1. https://dashboard.ngrok.com/signup でアカウントを作成"
echo "2. https://dashboard.ngrok.com/get-started/your-authtoken からauthtokenを取得"
echo ""
read -p "authtokenを入力してください: " AUTHTOKEN

if [ -z "$AUTHTOKEN" ]; then
    echo "❌ authtokenが入力されていません"
    exit 1
fi

echo ""
echo "🔑 authtokenを設定中..."
ngrok config add-authtoken $AUTHTOKEN

if [ $? -eq 0 ]; then
    echo "✅ ngrokの設定が完了しました！"
    echo ""
    echo "次のコマンドでngrokトンネルを開始できます:"
    echo "./scripts/start-ngrok.sh"
else
    echo "❌ 設定に失敗しました。authtokenが正しいか確認してください。"
    exit 1
fi