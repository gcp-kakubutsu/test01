
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, HeartHandshake, Target } from "lucide-react";
import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <HeartHandshake className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Nukuneについて</CardTitle>
        </CardHeader>
        <CardContent className="space-y-10 text-lg text-muted-foreground leading-relaxed">
          <section className="text-center">
            <p className="max-w-3xl mx-auto">
              Nukuneへようこそ。ここは真の繋がりが花開く場所です。私たちは、現代社会において有意義な関係を育むためには、共通の興味や深い適合性が力になると信じています。
            </p>
            <div className="my-8">
              <Image
                src="/img/nukune-about.jpg"
                alt="Nukuneコミュニティ"
                width={800}
                height={400}
                className="rounded-lg shadow-lg mx-auto"
                data-ai-hint="男女 語り合い"
              />
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-semibold text-secondary-foreground mb-4 flex items-center">
                <Target className="h-8 w-8 text-accent mr-3" /> 私たちの使命
              </h2>
              <p>
                私たちの使命は、大人の皆さんが本当に自分の欲求や好みを理解してくれるパートナーを見つけるための、安全で、敬意に満ちた、革新的なプラットフォームを提供することです。私たちは障壁を取り除き、繋がりの探求をエキサイティングで充実したものにすることを目指しています。Nukuneでは、あなたが永続的な絆を築き、親密な生活を豊かにするためのお手伝いをすることにコミットしています。
              </p>
            </div>
            <div className="relative h-64 md:h-80 rounded-lg overflow-hidden shadow-md">
                <Image
                    src="/img/nukune-simei.jpg"
                    alt="共有する目標"
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint="カップル 未来"
                />
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-semibold text-secondary-foreground mb-6 text-center flex items-center justify-center">
              <Users className="h-8 w-8 text-accent mr-3" /> 始めた理由
            </h2>
            <p className="max-w-3xl mx-auto text-center">
              Nukuneは、誰もが自分自身の最も深い部分と調和する交友関係を見つける権利があるという考えから生まれました。刹那的な交流に満ちた世界で、表面的な特徴以上のものに基づいた本物のマッチングを優先する空間の必要性を感じました。私たちは、テクノロジーを使って人間の繋がりをより意味のある方法で促進することに情熱を注いでいます。
            </p>
          </section>

        </CardContent>
      </Card>
    </div>
  );
}
