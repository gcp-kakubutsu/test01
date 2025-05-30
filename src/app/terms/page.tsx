
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";

export default function TermsPage() {
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    // クライアントサイドでのみ実行
    setLastUpdated(new Date().toLocaleDateString('ja-JP'));
  }, []);

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <FileText className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">利用規約</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-muted-foreground leading-relaxed">
          {lastUpdated && <p className="text-sm">最終更新日: {lastUpdated}</p>}

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">1. 規約への同意</h2>
            <p>NukuConnect（以下「本サービス」）にアクセスまたは利用することにより、お客様は本利用規約（以下「本規約」）に拘束されることに同意したものとみなされます。本規約のすべてに同意しない場合は、本サービスを利用しないでください。当社はいつでも本規約を変更することができ、かかる変更は本サービスへの掲載をもって効力を生じるものとします。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">2. 利用資格</h2>
            <p>本サービスを利用するには、18歳以上である必要があります。本サービスを利用することにより、お客様はこの年齢要件を満たしていることを表明し、保証するものとします。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">3. ユーザーの行動</h2>
            <p>お客様は、自身の行動、および本サービスに送信、投稿、表示するデータ、テキスト、情報、ユーザー名、グラフィック、画像、写真、プロフィール、音声・動画クリップ、リンク（以下「コンテンツ」）について単独で責任を負うものとします。お客様は、本サービスを不正利用したり、他者による不正利用を助けたりしないことに同意するものとします。</p>
            <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
              <li>ヌードや性的に露骨なコンテンツを投稿しないこと。</li>
              <li>他のユーザーに対する嫌がらせ、虐待、脅迫を行わないこと。</li>
              <li>本サービスを違法または不正な目的で使用しないこと。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">4. AI認証</h2>
            <p>当社のAIプロフィール認証ツールは安全性を高めるために設計されていますが、完全ではありません。NukuConnectはAIによる評価の正確性について責任を負いません。ユーザーは常に注意を払う必要があります。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">5. 契約解除</h2>
            <p>当社は、当社の単独の裁量により、理由の如何を問わず、また本規約の違反を含むがこれに限定されないいかなる理由であれ、事前の通知または責任を負うことなく、直ちにお客様のアカウントを終了または一時停止し、本サービスへのアクセスを禁止することができるものとします。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">6. 保証の否認</h2>
            <p>本サービスは「現状有姿」かつ「提供可能な範囲」で提供されます。NukuConnectは、明示または黙示を問わず、いかなる保証も行わず、これによりその他すべての保証を否認し、否定します。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">7. 準拠法</h2>
            <p>本規約は、[あなたの管轄区域]の法律に従って規律され、解釈されるものとします。ただし、抵触法の規定は考慮されません。</p>
          </section>

          <p className="mt-8 text-center font-semibold">これらの規約をよくお読みください。NukuConnectのご利用は、これらの利用規約への同意を意味します。</p>
        </CardContent>
      </Card>
    </div>
  );
}
