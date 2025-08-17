#!/bin/bash

# ngrokでローカル開発環境をLINEブラウザから確認するためのスクリプト

echo "🚀 Starting ngrok tunnel for LINE browser testing..."
echo ""
echo "=================================="
echo "手順:"
echo "1. このスクリプトがngrokトンネルを開始します"
echo "2. 生成されたHTTPS URLをコピーしてください"
echo "3. LINEのトークで自分にURLを送信してください"
echo "4. LINEブラウザでリンクをタップして開いてください"
echo "=================================="
echo ""

# 開発サーバーが起動しているか確認
if ! lsof -i :9002 > /dev/null; then
    echo "⚠️  開発サーバーが起動していません。"
    echo "別のターミナルで以下を実行してください:"
    echo "npm run dev"
    echo ""
    read -p "開発サーバーを起動したらEnterキーを押してください..."
fi

# ngrokを起動
echo "🔗 ngrokトンネルを開始中..."
ngrok http 9002