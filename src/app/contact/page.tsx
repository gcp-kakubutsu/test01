
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";

export default function ContactPage() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // API呼び出しをシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log({ name, email, subject, message });

    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setIsLoading(false);
    toast({
      title: "メッセージ送信完了！",
      description: "お問い合わせありがとうございます。近日中に返信いたします。",
    });
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader className="text-center">
          <Mail className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">お問い合わせ</CardTitle>
          <CardDescription className="text-lg">
            ご質問やフィードバックがありますか？お気軽にお知らせください！
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base">お名前</Label>
                <Input id="name" placeholder="山田太郎" required value={name} onChange={e => setName(e.target.value)} className="text-base p-3" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">メールアドレス</Label>
                <Input id="email" type="email" placeholder="your@example.com" required value={email} onChange={e => setEmail(e.target.value)} className="text-base p-3" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-base">件名</Label>
              <Input id="subject" placeholder="お問い合わせ内容について..." required value={subject} onChange={e => setSubject(e.target.value)} className="text-base p-3" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message" className="text-base">メッセージ本文</Label>
              <Textarea id="message" placeholder="こちらにメッセージをご記入ください..." rows={6} required value={message} onChange={e => setMessage(e.target.value)} className="text-base p-3" />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full text-lg py-3" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 送信中...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" /> 送信する
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
