
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ShieldCheck, Users, MessageCircle, Search, Award, PhoneOff, UserCheck, Eye, TrendingUp, Smile, Info as InfoIcon, HelpCircle as HelpCircleIcon } from 'lucide-react'; // Renamed to avoid conflict

const features = [
  {
    title: 'AIによる最適なマッチング',
    description: 'AIが相性や好みを分析し、理想の相手を提案。あなたの出会い探しをスムーズにサポートします。',
    icon: <TrendingUp className="h-10 w-10 text-primary mb-4" />,
    image: "https://placehold.co/300x200.png?text=AIマッチング",
    dataAiHint: "AI 男女",
  },
  {
    title: '「会いたい」を投稿',
    description: 'あなたの希望や理想のデートを投稿して、特別な人との出会いのチャンスを広げましょう。',
    icon: <MessageCircle className="h-10 w-10 text-primary mb-4" />,
    image: "https://placehold.co/300x200.png?text=デート投稿",
    dataAiHint: "男女 デート",
  },
  {
    title: '高度な検索機能',
    description: '詳細な条件や好みでプロフィールを絞り込み、理想の相手を見つけて直接つながりましょう。',
    icon: <Search className="h-10 w-10 text-primary mb-4" />,
    image: "https://placehold.co/300x200.png?text=プロフィール検索",
    dataAiHint: "検索 男女",
  },
];

const whyNukuConnect = [
  { title: '手頃な価格設定', description: 'プレミアム機能も安心価格で。女性はほとんどの機能を無料で利用できます！', icon: <Smile className="h-6 w-6 text-accent" /> },
  { title: '完全匿名制', description: 'プライバシーは最優先。準備ができるまで本当の自分を明かさずに繋がれます。', icon: <Eye className="h-6 w-6 text-accent" /> },
  { title: 'アプリ内コミュニケーション', description: 'LINEやTwitterなど外部アプリは不要。NukuConnect内で全てのやり取りが完結します。', icon: <MessageCircle className="h-6 w-6 text-accent" /> },
  { title: 'ユーザー評価', description: '会う前にコミュニティの評価を確認できるので、より安全な出会いが可能です。', icon: <UserCheck className="h-6 w-6 text-accent" /> },
  { title: 'プライバシー管理', description: '電話番号で連絡先をブロックし、知り合いとの不要な出会いを避けられます。', icon: <PhoneOff className="h-6 w-6 text-accent" /> },
];

const safetyFeatures = [
  { title: '本人確認', description: 'プロフィールの信頼性とユーザーの安全のため、本人確認書類の提出を必須としています。', icon: <UserCheck className="h-8 w-8 text-primary" /> },
  { title: '24時間監視体制', description: '不審なアクティビティやポリシー違反を、運営チームとAIシステムが常時監視しています。', icon: <ShieldCheck className="h-8 w-8 text-primary" /> },
  { title: '厳格なユーザー行動規範', description: 'ハラスメント行為は一切容認しません。違反者には警告または永久追放処分を行います。', icon: <Users className="h-8 w-8 text-primary" /> },
  { title: '通報・ブロック機能', description: '不適切な行動をとるユーザーを簡単に通報・ブロックできます。', icon: <CheckCircle className="h-8 w-8 text-primary" /> },
  { title: 'ニックネーム登録', description: 'ニックネームで利用できるため、本名は非公開。個人情報が共有されることはありません。', icon: <Eye className="h-8 w-8 text-primary" /> },
  { title: '公的機関への届出済み', description: '法令遵守とユーザー保護のため、関連当局に届出済みです。', icon: <Award className="h-8 w-8 text-primary" /> },
];

const faqItems = [
  {
    question: 'NukuConnectは無料で使えますか？',
    answer: '基本機能はどなたでも無料でご利用いただけます。女性はほとんどの機能を無料で楽しめます。男性はプレミアムプランにアップグレードすることで、全ての機能にアクセス可能になります。料金プランも手頃な価格からご用意しています。',
  },
  {
    question: '身元はバレますか？',
    answer: 'NukuConnectは匿名性を重視して設計されています。ニックネームで利用でき、本名は公開されません。また、知人とのマッチングを防ぐための電話番号ブロック機能なども提供しています。',
  },
  {
    question: 'NukuConnectはどのように安全性を確保していますか？',
    answer: '本人確認、24時間監視体制、厳格な行動規範、簡単な通報・ブロック機能など、複数の安全対策を講じています。お客様の安全が私たちの最優先事項です。',
  },
  {
    question: '誰がNukuConnectを利用できますか？',
    answer: 'NukuConnectは18歳以上の方を対象としています。',
  },
];


export default function LandingPage() {
  return (
    <div className="space-y-16 md:space-y-24">
      {/* Hero Section */}
      <section className="relative text-center py-20 md:py-32 rounded-lg overflow-hidden bg-gradient-to-br from-primary to-accent">
        <div className="absolute inset-0">
          <Image
            src="https://placehold.co/1200x600.png?text=NukuConnect背景"
            alt="NukuConnect 背景"
            layout="fill"
            objectFit="cover"
            className="opacity-30"
            data-ai-hint="男女 繋がり"
          />
        </div>
        <div className="relative container mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-6">
            心で繋がる。豊かに生きる。
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground mb-8 max-w-2xl mx-auto">
            NukuConnectは、本当の相性と共通の願いに基づいた、意義深い繋がりを見つけるお手伝いをします。より豊かな人生を。
          </p>
          <div className="space-x-4">
            <Button size="lg" asChild className="bg-background text-foreground hover:bg-background/90">
              <Link href="/signup">NukuConnectに参加</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <Link href="/login">ログイン</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Intro Section */}
      <section className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">NukuConnectとは？</h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          NukuConnectは、真の繋がりを求める大人のための革新的なプラットフォームです。私たちは、充実した親密な生活が全体的な幸福に大きく貢献すると信じています。当サービスは、あなたの願いを真に理解し共有するパートナーを見つけるための、安全で簡単、そして尊重に満ちた環境を提供します。
        </p>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-primary mb-12">充実の機能で理想のパートナー探し</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="shadow-xl hover:shadow-2xl transition-shadow duration-300 flex flex-col">
              <CardHeader className="items-center text-center">
                {feature.icon}
                <CardTitle className="text-2xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow text-center">
                <div className="relative w-full h-40 rounded-md overflow-hidden mb-4">
                    <Image src={feature.image} alt={feature.title} layout="fill" objectFit="cover" data-ai-hint={feature.dataAiHint} />
                </div>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Why NukuConnect Section */}
       <section className="bg-secondary py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-secondary-foreground mb-12">NukuConnectが選ばれる理由</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyNukuConnect.map((reason) => (
              <Card key={reason.title} className="bg-card shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {reason.icon}
                    <CardTitle className="text-xl text-primary">{reason.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{reason.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>


      {/* How to Register Section */}
      <section className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-primary mb-12">簡単スタートガイド</h2>
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-2xl font-semibold text-center text-pink-600 mb-6 p-3 bg-pink-100 rounded-lg">女性の方</h3>
            <ol className="space-y-6">
              {['プロフィール設定', '本人確認', '安全に相手探し'].map((step, index) => (
                <li key={step} className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 bg-pink-500 text-white rounded-full flex items-center justify-center font-bold text-lg mr-4">{index + 1}</div>
                  <div>
                    <h4 className="font-semibold text-lg text-pink-700">{step}</h4>
                    <p className="text-muted-foreground text-sm">
                      {index === 0 && "あなたの好みや希望を簡単にプロフィールに設定。"}
                      {index === 1 && "安全のため、簡単な認証プロセスを完了してください。"}
                      {index === 2 && "プロフィールの閲覧開始。あなたが連絡するまでプロフィールは非公開です！"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-center text-blue-600 mb-6 p-3 bg-blue-100 rounded-lg">男性の方</h3>
            <ol className="space-y-6">
              {['プロフィール設定', '本人確認', 'プラン選択', '積極的なアプローチ'].map((step, index) => (
                <li key={step} className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg mr-4">{index + 1}</div>
                  <div>
                    <h4 className="font-semibold text-lg text-blue-700">{step}</h4>
                    <p className="text-muted-foreground text-sm">
                      {index === 0 && "理想のマッチングのため、プロフィールを詳細に記入しましょう。"}
                      {index === 1 && "信頼できるコミュニティのため、本人確認にご協力ください。"}
                      {index === 2 && "プレミアムプランに登録して、全ての機能を利用しましょう。"}
                      {index === 3 && "マッチを待つだけでなく、積極的に検索したり投稿したりしましょう！"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Safety Section */}
      <section className="bg-primary-foreground py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-primary mb-12">安全への取り組み</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            {safetyFeatures.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4 p-4 bg-background rounded-lg shadow-md">
                <div className="flex-shrink-0">{feature.icon}</div>
                <div>
                  <h4 className="font-semibold text-lg text-primary">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-primary mb-12">よくあるご質問</h2>
        <Accordion type="single" collapsible className="w-full max-w-3xl mx-auto">
          {faqItems.map((item, index) => (
            <AccordionItem value={`item-${index + 1}`} key={index}>
              <AccordionTrigger className="text-lg hover:no-underline text-left">
                <div className="flex items-center">
                  <HelpCircleIcon className="h-5 w-5 mr-3 text-primary"/>
                  {item.question}
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <div className="flex items-start p-2">
                  <InfoIcon className="h-5 w-5 mr-3 text-accent flex-shrink-0 mt-1"/>
                  {item.answer}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Final Call to Action Section */}
      <section className="py-16 bg-gradient-to-tr from-accent to-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-8">素敵な出会いを見つけませんか？</h2>
          <p className="text-xl text-primary-foreground mb-10 max-w-xl mx-auto">
            今すぐNukuConnectに参加して、より充実した関係を築くための一歩を踏み出しましょう。
          </p>
          <Button size="lg" asChild className="bg-background text-foreground hover:bg-background/90 transform hover:scale-105 transition-transform duration-300 px-10 py-6 text-lg">
            <Link href="/signup">今すぐ登録</Link>
          </Button>
          <div className="mt-8">
            <Image
                src="https://placehold.co/800x300.png?text=NukuConnectで繋がる"
                alt="幸せなカップル"
                width={800}
                height={300}
                className="rounded-lg shadow-2xl mx-auto"
                data-ai-hint="カップル シルエット"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
