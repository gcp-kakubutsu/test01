import Image from 'next/image';

export default function LegalPage() {
  return (
    <main className="py-2 min-h-[calc(100vh-80px)]">
      <div className="max-w-6xl mx-auto px-8">
        <h1 className="font-['Playfair_Display','Noto_Serif_JP',serif] text-[28px] sm:text-[46px] font-semibold text-center mb-8 text-[#F9FAFB] whitespace-nowrap">
          特定商取引法に基づく表示
        </h1>
        <p className="text-center text-gray-400 mb-12 text-lg">
          PEDIA株式会社のサービス利用に関する法的情報
        </p>
        
        <div className="bg-[rgba(17,24,39,0.95)] rounded-[20px] p-8 sm:p-12 border border-[rgba(212,175,55,0.2)] backdrop-blur-[10px] space-y-8">
          <Section title="役務提供事業者">
            <p className="text-[#F9FAFB]">PEDIA 株式会社</p>
          </Section>

          <Section title="運営責任者">
            <p className="text-[#F9FAFB]">代表取締役 桐山 一喜</p>
          </Section>

          <Section title="電話番号">
            <p className="text-[#F9FAFB]">050-8886-7777</p>
            <p className="text-gray-400 text-sm mt-1">
              ※サービスに関するお問い合わせはメールにて承ります
            </p>
          </Section>

          <Section title="メールアドレス">
            <p className="text-[#F9FAFB]">info@pedia.co.jp</p>
          </Section>

          <Section title="役務の対価">
            <p className="text-[#F9FAFB] leading-relaxed">
              購入手続きの際に画面に表示されます。<br />
              なお、販売価格以外に、インターネット接続料金、通信料金などはお客様のご負担となります。
            </p>
          </Section>

          <Section title="お支払方法">
            <p className="text-[#F9FAFB] leading-relaxed">
              ・クレジットカード決済<br />
              （※明細の請求名は「PEDIA」となります。）
            </p>
          </Section>

          <Section title="役務の提供時期">
            <p className="text-[#F9FAFB] leading-relaxed">
              本人確認が終了していることを前提に、お申し込み完了後、お客様が nukune サービスの利用契約を解約するまで、または当社が nukune サービスの利用契約を解約するまで。<br />
              nukune サービスの利用の継続を希望しない場合は、お客様ご自身で nukune サービスの利用契約の解約手続きを行っていただく必要があります。
            </p>
          </Section>

          <Section title="途中退会の場合">
            <p className="text-[#F9FAFB] leading-relaxed">
              本サービスから退会することを希望する場合、本サービスの退会申請フォームから契約終了の通知を当社に送付し、当社が指示する方法により有料プラン解約手続きを行うものとします。
            </p>
          </Section>

          <Section title="返金について">
            <div className="text-[#F9FAFB] space-y-3 leading-relaxed">
              <p>
                決済内容記載の期間の途中において解約手続きを行った場合、購入したサブスクリプションの役務提供期間の未使用部分の料金はお客様からのご請求により、以下に沿って返金いたします。
              </p>
              <p className="bg-[rgba(139,30,63,0.1)] border border-[rgba(139,30,63,0.3)] p-5 rounded-xl mt-3">
                返金額＝お客様が実際に支払った額－割引のない1か月プランの金額に利用された月数（ひと月に満たない利用日数がある場合、切り上げて、ひと月として算定します）を乗じた額－事務手数料3,000円
              </p>
              <p>
                なお、上記金額がマイナスになる場合、返金は行いません。
              </p>
            </div>
          </Section>

          <Section title="役務提供後におけるその取引についての特約事項">
            <p className="text-[#F9FAFB] leading-relaxed">
              ・資金決済に関する法律に基づき払い戻しが認められる場合以外は払い戻しいたしません
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[rgba(212,175,55,0.1)] pb-6 last:border-0">
      <h2 className="text-xl font-semibold text-[#D4AF37] mb-4">{title}</h2>
      {children}
    </div>
  );
}