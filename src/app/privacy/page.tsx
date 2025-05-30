
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

export default function PrivacyPage() {
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    // クライアントサイドでのみ実行
    setLastUpdated(new Date().toLocaleDateString('ja-JP'));
  }, []);


  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">プライバシーポリシー</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-muted-foreground leading-relaxed">
          {lastUpdated && <p className="text-sm">最終更新日: {lastUpdated}</p>}

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">1. はじめに</h2>
            <p>Nukune（以下「当社」）は、お客様のプライバシー保護に努めています。本プライバシーポリシーは、お客様が当社のモバイルアプリケーションおよびウェブサイト（総称して「本サービス」）を利用する際に、当社がお客様の情報をどのように収集、使用、開示、保護するかを説明するものです。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">2. 収集する情報</h2>
            <p>当社は、様々な方法でお客様に関する情報を収集することがあります。本サービスを通じて収集する可能性のある情報は以下の通りです。</p>
            <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
              <li><strong>個人データ：</strong>お客様が本サービスに登録する際、または本サービスに関連する様々な活動に参加する際に自発的に提供する、氏名、メールアドレス、性別、年齢、写真、興味などの個人を特定できる情報。</li>
              <li><strong>派生データ：</strong>お客様が本サービスにアクセスした際に当社のサーバーが自動的に収集する情報。例えば、IPアドレス、ブラウザの種類、オペレーティングシステム、アクセス時間、本サービスへのアクセス直前および直後に閲覧したページなど。</li>
              <li><strong>プロフィール認証データ：</strong>AIによるプロフィール認証のためにお客様が提供する画像および説明文。これらは安全性と信頼性の分析のために処理されます。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">3. お客様情報の利用</h2>
            <p>お客様に関する正確な情報を保有することにより、当社は円滑で効率的、かつカスタマイズされた体験を提供することができます。具体的には、本サービスを通じて収集したお客様の情報を以下の目的で利用することがあります。</p>
            <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
              <li>お客様のアカウント作成および管理。</li>
              <li>他のユーザーとのマッチング。</li>
              <li>本サービスおよび提供内容の改善。</li>
              <li>本サービスの利用状況および傾向の監視・分析による体験向上。</li>
              <li>安全性および認証目的でのプロフィールデータに対するAI主導の分析実行。</li>
              <li>不正取引の防止、盗難の監視、および犯罪行為からの保護。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">4. お客様情報の開示</h2>
            <p>当社は、特定の状況においてお客様に関して収集した情報を共有することがあります。お客様の情報は以下のように開示される場合があります。</p>
             <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
                <li><strong>法律による場合または権利保護のため：</strong>法的手続きに対応するため、当社のポリシーの潜在的な違反を調査または是正するため、あるいは他者の権利、財産、安全を保護するために、お客様に関する情報の開示が必要であると当社が判断した場合。</li>
                <li><strong>第三者サービスプロバイダー：</strong>データ分析、AI処理、ホスティングサービス、顧客サービス、マーケティング支援など、当社のためにまたは当社に代わってサービスを実行する第三者とお客様の情報を共有する場合があります。</li>
             </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">5. お客様情報のセキュリティ</h2>
            <p>当社は、お客様の個人情報を保護するために、管理的、技術的、物理的なセキュリティ対策を講じています。当社がお客様から提供された個人情報を保護するために合理的な措置を講じている一方で、当社の努力にもかかわらず、いかなるセキュリティ対策も完璧または不可侵ではなく、いかなるデータ送信方法も傍受やその他の種類の誤用から保証されるものではないことをご承知おきください。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">6. 未成年者に関するポリシー</h2>
            <p>当社は、18歳未満の子供から情報を故意に勧誘したり、マーケティングを行ったりすることはありません。18歳未満の子供から収集したデータに気づいた場合は、以下に記載の連絡先情報を使用して当社にご連絡ください。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">7. お問い合わせ</h2>
            <p>本プライバシーポリシーに関するご質問やご意見がございましたら、privacy@nukune.example.com までご連絡ください。</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
