"use client";

import { Button } from '@/components/ui/button';
import { Crown, Shield, MapPin, Heart, Star, Sparkles, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import styles from './WelcomePage.module.scss';

interface WelcomePageProps {
  onComplete: () => void;
  onStartOnboarding?: () => void;
}

export default function WelcomePage({ onComplete, onStartOnboarding }: WelcomePageProps) {
  return (
    <div className={styles.welcomePage}>
      <div className={styles.container}>
        {/* Premium Header with Crown */}
        <div className={styles.header}>
          <Crown className={styles.crownIcon} />
          <h1 className={styles.title}>
            <span className={styles.titleMain}>NUKUNE</span>
            <span className={styles.titleSub}>へようこそ</span>
          </h1>
          <p className={styles.subtitle}>
            このたびは『NUKUNE』にご登録ありがとうございます
          </p>
        </div>

        {/* Main Content Card */}
        <Card className={styles.contentCard}>
          <div className={styles.cardContent}>
            <p className={styles.introduction}>
              NUKUNEは、あなたが求める容姿・性癖・嗜好に合うキャストを、<br />
              GPS機能で今いる場所から即ご紹介できる国内初のサービスです。
            </p>

            {/* Features Section */}
            <div className={styles.featuresSection}>
              <h2 className={styles.featuresTitle}>
                <Sparkles className={styles.titleIcon} />
                特徴
              </h2>
              
              <div className={styles.featuresList}>
                <div className={styles.featureItem}>
                  <div className={styles.featureNumber}>1</div>
                  <div className={styles.featureContent}>
                    <div className={styles.featureHeader}>
                      <MapPin className={styles.featureIcon} />
                      <h3 className={styles.featureTitle}>GPSで最短ルート検索</h3>
                    </div>
                    <p className={styles.featureDescription}>
                      見知らぬ土地でも迷わず安心
                    </p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <div className={styles.featureNumber}>2</div>
                  <div className={styles.featureContent}>
                    <div className={styles.featureHeader}>
                      <Star className={styles.featureIcon} />
                      <h3 className={styles.featureTitle}>最新60分以内のキャストを表示</h3>
                    </div>
                    <p className={styles.featureDescription}>
                      ユーザー登録内容をもとに容姿・性癖・嗜好が合う「今すぐ会える」女性だけを新着順にご紹介
                    </p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <div className={styles.featureNumber}>3</div>
                  <div className={styles.featureContent}>
                    <div className={styles.featureHeader}>
                      <Heart className={styles.featureIcon} />
                      <h3 className={styles.featureTitle}>ワンクリック即予約</h3>
                    </div>
                    <p className={styles.featureDescription}>
                      『君に決めた』をクリックするだけで、提携サイトからスムーズ予約
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className={styles.benefitsSection}>
              <p className={styles.benefitText}>
                新感覚の性癖コンシェルジュ『NUKUNE』を通じて、<br />
                理想的なキャストとの安心・安全な出会いをお楽しみください。
              </p>
              <div className={styles.trialInfo}>
                <Shield className={styles.shieldIcon} />
                <p>
                  無料お試し期間終了後も、有料プランにて継続してご利用いただけます。
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* CTA Section */}
        <div className={styles.ctaSection}>
          <p className={styles.ctaText}>
            今すぐ無料で登録・検索して、理想のキャストを見つけてください。
          </p>
          <Button
            onClick={onStartOnboarding || onComplete}
            className={styles.ctaButton}
          >
            <Check className={styles.buttonIcon} />
            今すぐ無料で始める
          </Button>
        </div>

        {/* Decorative Elements */}
        <div className={styles.decorativeElements}>
          <div className={styles.floatingHeart1}>
            <Heart className="w-6 h-6" />
          </div>
          <div className={styles.floatingHeart2}>
            <Heart className="w-5 h-5" />
          </div>
          <div className={styles.floatingHeart3}>
            <Heart className="w-4 h-4" />
          </div>
          <div className={styles.floatingStar1}>
            <Star className="w-5 h-5" />
          </div>
          <div className={styles.floatingStar2}>
            <Star className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}