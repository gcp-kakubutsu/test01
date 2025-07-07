
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">プライバシーポリシー</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">第1条　収集する利用者情報及び収集方法</h2>
            <p className="mb-4">本ポリシーにおいて、「利用者情報」とは、利用者の識別に係る情報、通信サービス上の行動履歴、その他利用者又は利用者の端末に関連して生成又は蓄積された情報であって、本ポリシーに基づき当社が収集するものを意味するものとします。</p>
            <p className="mb-4">本サービスにおいて当社が収集する利用者情報は、その収集方法に応じて、以下のようなものとなります。</p>
            
            <div className="space-y-4 pl-4">
              <div>
                <h3 className="font-semibold mb-2">(1)利用者からご提供いただく情報</h3>
                <p className="mb-2">本サービスを利用するために、又は本サービスの利用を通じて利用者からご提供いただく情報は以下のとおりです。</p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li>利用者の氏名、生年月日、性別等プロフィールに関する情報</li>
                  <li>利用者のメールアドレス、電話番号等連絡先に関する情報</li>
                  <li>利用者の肖像を含む静止画、動画情報</li>
                  <li>利用者の本サービスの利用状況に関する情報</li>
                  <li>利用者のクレジットカード情報、口座情報等決済に必要な情報</li>
                  <li>入力フォームその他当社が定める方法を通じて利用者が入力又は送信する情報</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">(2)利用者が本サービスの利用において、他のサービスと連携を許可することにより、当該他のサービスからご提供いただく情報</h3>
                <p className="mb-2">利用者が、本サービスを利用するにあたり、ソーシャルネットワーキングサービス等の他のサービスとの連携を許可した場合には、その許可の際にご同意いただいた内容に基づき、以下の情報を当該外部サービスから収集します。</p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li>当該外部サービスで利用者が利用するID</li>
                  <li>その他当該外部サービスのプライバシー設定により利用者が連携先に開示を認めた情報</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">(3)利用者が本サービスを利用するにあたって、当社が収集する情報</h3>
                <p className="mb-2">当社は、本サービスへのアクセス状況やそのご利用方法に関する情報を収集することがあります。これには以下の情報が含まれます。</p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li>リファラ</li>
                  <li>ＩＰアドレス</li>
                  <li>サーバーアクセスログに関する情報</li>
                  <li>Cookie、ADID、IDFAその他の識別子</li>
                  <li>位置情報</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">第2条　利用目的</h2>
            <p className="mb-4">本サービスのサービス提供にかかわる利用者情報の具体的な利用目的は以下のとおりです。</p>
            <ol className="list-decimal list-inside space-y-2 pl-4">
              <li>本サービスに関する登録の受付、本人確認、利用者認証、利用者設定の記録、利用料金の決済計算、マッチングのための利用者情報の掲載等本サービスの提供、維持、保護及び改善のため</li>
              <li>利用者のトラフィック測定及び行動測定のため</li>
              <li>広告の配信、表示及び効果測定のため</li>
              <li>本サービスに関するご案内、お問い合わせ等への対応のため</li>
              <li>本サービスに関する当社の規約、ポリシー等（以下「規約等」といいます。）に違反する行為に対する対応のため</li>
              <li>本サービスに関する規約等の変更などを通知するため</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">第3条　第三者提供</h2>
            <p className="mb-4">当社は、利用者情報のうち、個人情報及び個人関連情報については、あらかじめ利用者の同意を得ないで、第三者（日本国外にある者を含みます。）に提供しません。但し、次に掲げる必要があり第三者（日本国外にある者を含みます。）に提供する場合はこの限りではありません。</p>
            <ol className="list-decimal list-inside space-y-2 pl-4">
              <li>当社が利用目的の達成に必要な範囲内において個人情報の取扱いの全部又は一部を委託する場合</li>
              <li>合併その他の事由による事業の承継に伴って個人情報が提供される場合</li>
              <li>本ポリシーにおいて公表した提携先又は情報収集モジュール提供者へ個人情報又は個人関連情報が提供される場合</li>
              <li>国の機関もしくは地方公共団体又はその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、利用者の同意を得ることによって当該事務の遂行に支障を及ぼすおそれがある場合</li>
              <li>その他、個人情報の保護に関する法律（以下「個人情報保護法」といいます。）その他の法令で認められる場合</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">第4条　個人情報の開示</h2>
            <p className="mb-4">当社は、利用者から、個人情報保護法の定めに基づき個人情報の開示を求められたときは、利用者ご本人からのご請求であることを確認の上で、利用者に対し、遅滞なく開示を行います（当該個人情報が存在しないときにはその旨を通知いたします。）。但し、個人情報保護法その他の法令により、当社が開示の義務を負わない場合は、この限りではありません。なお、個人情報の開示につきましては、手数料（1件あたり3,000円）を頂戴しておりますので、あらかじめ御了承ください。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">第5条　個人情報の訂正及び利用停止等</h2>
            <ol className="list-decimal list-inside space-y-4 pl-4">
              <li>当社は、利用者から、個人情報が真実でないという理由によって個人情報保護法の定めに基づきその個人情報等の訂正を求められた場合には、利用者ご本人からのご請求であることを確認の上で遅滞なく必要な調査を行い、その結果に基づき、個人情報の内容の訂正を行い、その旨を利用者に通知します。なお、訂正を行わない旨の決定をしたときは、利用者に対しその旨を通知いたします。</li>
              
              <li>当社は、利用者から、以下の各号の理由によって個人情報保護法の定めに基づきその個人情報等の利用の停止又は消去を求められた場合には、利用者ご本人からのご請求であることを確認の上で遅滞なく必要な調査を行い、その結果に基づき、個人情報の利用停止又は消去行い、その旨を利用者に通知します。なお、利用停止又は消去を行わない旨の決定をしたときは、利用者に対しその旨を通知いたします。
                <ul className="list-disc list-inside space-y-1 pl-4 mt-2">
                  <li>偽りその他不正の手段により収集されたものである場合</li>
                  <li>個人情報等を利用する必要がなくなったとき</li>
                  <li>その他個人情報保護法に定めのある場合</li>
                </ul>
              </li>
              
              <li>当社は、利用者から、以下の各号の理由によって個人情報保護法の定めに基づき利用者の個人情報について第三者提供の停止を求められた場合、利用者ご本人からのご請求であることを確認の上で、個人情報の第三者提供の停止を行い、その旨を利用者に通知します。
                <ul className="list-disc list-inside space-y-1 pl-4 mt-2">
                  <li>利用者の同意なく個人情報等を第三者（日本国外にある者を含みます。）に提供した場合</li>
                  <li>個人情報等を利用する必要がなくなったとき</li>
                  <li>その他個人情報保護法に定めのある場合</li>
                </ul>
              </li>
              
              <li>個人情報保護法その他の法令により、当社が訂正、利用停止、消去、第三者提供の停止等の義務を負わない場合は前3項の規定は適用されません。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">第6条　安全管理措置</h2>
            <p>当社は、個人情報を利用目的の範囲内で正確・完全・最新の内容に保つよう努め、不正なアクセス、漏えい、改ざん、滅失、き損等を防止するため、現時点での技術水準に合わせた必要かつ適切な安全管理措置を講じ、必要に応じて是正してまいります。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">第7条　お問い合わせ窓口</h2>
            <p>ご意見、ご質問、苦情のお申出その他利用者情報の取扱いに関するお問い合わせは、以下の窓口までお願いいたします。</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">第8条　プライバシーポリシーの変更手続</h2>
            <p>当社は、必要に応じて、本ポリシーを変更します。但し、法令上利用者の同意が必要となるような本ポリシーの変更を行う場合、変更後の本ポリシーは、当社所定の方法で変更に同意した利用者に対してのみ適用されるものとします。なお、当社は、本ポリシーを変更する場合には、変更後の本ポリシーの施行時期及び内容を当社のウェブサイト上での表示その他の適切な方法により周知し、又は利用者に通知します。</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
