"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F9E4EB] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-[#F0306A]" />
          </div>
          <CardTitle className="text-2xl font-bold">メールアドレスの確認</CardTitle>
          <CardDescription>
            登録いただいたメールアドレスに確認メールを送信しました
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-gray-600 space-y-2">
            <p>メール内のリンクをクリックして、メールアドレスの確認を完了してください。</p>
            <p>確認が完了したら、ログインページからサインインできます。</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
            <p className="font-semibold mb-2">メールが届かない場合：</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>迷惑メールフォルダをご確認ください</li>
              <li>メールアドレスが正しく入力されているか確認してください</li>
              <li>数分待ってもメールが届かない場合は、再度新規登録してください</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Button 
              className="w-full bg-[#F0306A] hover:bg-[#d91f5a]"
              onClick={() => router.push("/login")}
            >
              ログインページへ
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.push("/")}
            >
              トップページへ戻る
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}