"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  MessageCircle,
  Mail,
  Phone,
  Clock,
  HelpCircle,
  FileText,
  Shield,
  Heart,
  AlertCircle,
  Send,
  ChevronRight,
  Loader2,
  Search,
  Users,
  CreditCard,
  Settings,
  Bug,
  Star
} from 'lucide-react';
import Link from 'next/link';

const FAQ_ITEMS = [
  {
    category: "料金・支払い",
    icon: CreditCard,
    questions: [
      {
        q: "料金プランについて教えてください",
        a: "1ヶ月プラン（¥1,980）、3ヶ月プラン（¥4,650）、6ヶ月プラン（¥8,100）、12ヶ月プラン（¥13,800）をご用意しています。長期プランほどお得になります。"
      },
      {
        q: "支払い方法は何が使えますか？",
        a: "クレジットカード（Visa、MasterCard、American Express、JCB）をご利用いただけます。"
      },
      {
        q: "解約はいつでもできますか？",
        a: "はい、いつでも解約可能です。解約後も契約期間終了まではサービスをご利用いただけます。"
      }
    ]
  },
  {
    category: "アカウント",
    icon: Users,
    questions: [
      {
        q: "プロフィールの変更方法は？",
        a: "プロフィールページの「編集」ボタンから、写真や自己紹介文などを変更できます。"
      },
      {
        q: "退会したい場合はどうすればいいですか？",
        a: "設定ページから退会手続きを行えます。退会すると全データが削除されますのでご注意ください。"
      },
      {
        q: "パスワードを忘れてしまいました",
        a: "ログイン画面の「パスワードを忘れた方」からリセット手続きを行ってください。"
      }
    ]
  },
  {
    category: "技術的な問題",
    icon: Bug,
    questions: [
      {
        q: "アプリが正常に動作しません",
        a: "ブラウザのキャッシュをクリアするか、別のブラウザでお試しください。問題が続く場合はお問い合わせください。"
      },
      {
        q: "写真がアップロードできません",
        a: "画像サイズが10MB以下であることを確認してください。JPEG、PNG形式に対応しています。"
      },
      {
        q: "通知が届きません",
        a: "ブラウザの通知設定とアプリの通知設定をご確認ください。"
      }
    ]
  }
];

const CONTACT_OPTIONS = [
  {
    icon: Mail,
    title: "メールでお問い合わせ",
    description: "24時間受付中",
    value: "support@nukune.com",
    action: "メールを送る"
  }
];

export default function SupportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    subject: '',
    category: '',
    message: '',
    email: currentUser?.email || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredFAQ = FAQ_ITEMS.filter(category => {
    if (selectedCategory && category.category !== selectedCategory) return false;
    if (!searchQuery) return true;
    
    return category.questions.some(
      q => q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
           q.a.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contactForm.subject || !contactForm.message) {
      toast({
        title: "エラー",
        description: "件名とメッセージを入力してください。",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      toast({
        title: "送信完了",
        description: "お問い合わせを受け付けました。2営業日以内にご返信いたします。",
      });
      setContactForm({
        subject: '',
        category: '',
        message: '',
        email: currentUser?.email || ''
      });
      setIsSubmitting(false);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            サポートセンター
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            よくある質問・お問い合わせ
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="質問を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Button
          variant="outline"
          className="flex flex-col items-center gap-2 h-auto py-4"
          onClick={() => router.push('/subscription')}
        >
          <CreditCard className="h-5 w-5 text-pink-500" />
          <span className="text-xs">料金プラン</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col items-center gap-2 h-auto py-4"
          onClick={() => router.push('/settings')}
        >
          <Settings className="h-5 w-5 text-pink-500" />
          <span className="text-xs">設定</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col items-center gap-2 h-auto py-4"
          onClick={() => router.push('/profile/edit')}
        >
          <Users className="h-5 w-5 text-pink-500" />
          <span className="text-xs">プロフィール</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col items-center gap-2 h-auto py-4"
          onClick={() => setSelectedCategory(null)}
        >
          <HelpCircle className="h-5 w-5 text-pink-500" />
          <span className="text-xs">FAQ</span>
        </Button>
      </div>

      {/* FAQ Section */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-pink-500" />
          よくある質問
        </h2>

        {/* Category Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <Button
            size="sm"
            variant={selectedCategory === null ? "default" : "outline"}
            onClick={() => setSelectedCategory(null)}
            className={selectedCategory === null ? "bg-pink-500 hover:bg-pink-600 text-white" : ""}
          >
            すべて
          </Button>
          {FAQ_ITEMS.map((category) => (
            <Button
              key={category.category}
              size="sm"
              variant={selectedCategory === category.category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.category)}
              className={selectedCategory === category.category ? "bg-pink-500 hover:bg-pink-600 text-white" : ""}
            >
              {category.category}
            </Button>
          ))}
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredFAQ.map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.category}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Icon className="h-5 w-5 text-pink-500" />
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {category.questions.map((item, index) => (
                    <div
                      key={index}
                      className="border-b last:border-b-0 pb-3 last:pb-0"
                    >
                      <button
                        className="w-full text-left"
                        onClick={() => setExpandedQuestion(
                          expandedQuestion === `${category.category}-${index}` 
                            ? null 
                            : `${category.category}-${index}`
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-gray-800 dark:text-gray-100">
                            {item.q}
                          </p>
                          <ChevronRight 
                            className={`h-4 w-4 text-gray-400 transition-transform ${
                              expandedQuestion === `${category.category}-${index}` 
                                ? 'rotate-90' 
                                : ''
                            }`}
                          />
                        </div>
                      </button>
                      {expandedQuestion === `${category.category}-${index}` && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          {item.a}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>


      {/* Contact Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-pink-500" />
            お問い合わせフォーム
          </CardTitle>
          <CardDescription>
            以下のフォームからお問い合わせください。2営業日以内にご返信いたします。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                placeholder="your@email.com"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="category">カテゴリー</Label>
              <select
                id="category"
                value={contactForm.category}
                onChange={(e) => setContactForm({...contactForm, category: e.target.value})}
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
              >
                <option value="">選択してください</option>
                <option value="payment">料金・支払い</option>
                <option value="account">アカウント</option>
                <option value="technical">技術的な問題</option>
                <option value="other">その他</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="subject">件名 <span className="text-red-500">*</span></Label>
              <Input
                id="subject"
                value={contactForm.subject}
                onChange={(e) => setContactForm({...contactForm, subject: e.target.value})}
                placeholder="お問い合わせの件名"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="message">メッセージ <span className="text-red-500">*</span></Label>
              <Textarea
                id="message"
                value={contactForm.message}
                onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                placeholder="お問い合わせ内容をご記入ください"
                rows={6}
                required
              />
            </div>
            
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  送信中...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  送信する
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card className="bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-300">
                緊急のお問い合わせ
              </h3>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                アカウントの不正利用や緊急を要する問題については、
                メールでご連絡ください。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}