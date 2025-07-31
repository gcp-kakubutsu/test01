'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Brain, Calendar, Search, Shield, Users, Award, Ban, UserCheck, Eye, Plus, Loader2 } from 'lucide-react';
import styles from './page.module.scss';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const faqRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to home if already logged in
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/home');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    // Skip animations if authenticated (will redirect anyway)
    if (isAuthenticated) return;

    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      
      // Smooth scrolling for anchor links
      const handleAnchorClick = (e: Event) => {
        const anchor = e.currentTarget as HTMLAnchorElement;
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }
      };

      const anchors = document.querySelectorAll('a[href^="#"]');
      anchors.forEach(anchor => {
        anchor.addEventListener('click', handleAnchorClick);
      });

      // Remove parallax effect to ensure video stays visible



      // Intersection Observer for scroll animations
      const observerOptions = {
        threshold: 0.1, // 10%見えたらアニメーション開始
        rootMargin: '-50px 0px -50px 0px' // 上下両方向に余白を設定
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // 画面に入ったらアニメーション開始
            entry.target.setAttribute('data-animated', 'true');
          } else {
            // 画面から出たらアニメーションをリセット（毎回動作）
            entry.target.setAttribute('data-animated', 'false');
          }
        });
      }, observerOptions);

      // Observe all scroll animation elements
      const animatedElements = document.querySelectorAll(`.${styles.scrollFadeIn}, .${styles.scrollSlideLeft}, .${styles.scrollSlideRight}, .${styles.scrollScaleUp}`);
      animatedElements.forEach(el => observer.observe(el));

      // Stagger animation observer
      const staggerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const staggerElements = entry.target.querySelectorAll(`.${styles.scrollStagger}`);
          if (entry.isIntersecting) {
            // 画面に入ったら順番にアニメーション
            staggerElements.forEach((el, index) => {
              setTimeout(() => {
                el.setAttribute('data-animated', 'true');
              }, index * 80); // より速いスタッガー
            });
          } else {
            // 画面から出たら即座にリセット
            staggerElements.forEach(el => {
              el.setAttribute('data-animated', 'false');
            });
          }
        });
      }, observerOptions);

      // Observe containers with stagger elements
      const staggerContainers = document.querySelectorAll(`.${styles.featuresGrid}, .${styles.reasonsGrid}, .${styles.stepsContainer}, .${styles.safetyGrid}, .${styles.faqContainer}, .${styles.pricingGrid}`);
      staggerContainers.forEach(container => staggerObserver.observe(container));

      // Counter animation
      const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const counter = entry.target as HTMLElement;
            const target = parseInt(counter.getAttribute('data-count') || '0');
            const duration = 500;
            const increment = target / (duration / 16);
            let current = 0;

            const updateCounter = () => {
              current += increment;
              if (current < target) {
                counter.textContent = `¥${Math.floor(current).toLocaleString()}`;
                requestAnimationFrame(updateCounter);
              } else {
                counter.textContent = `¥${target.toLocaleString()}`;
              }
            };

            updateCounter();
            counterObserver.unobserve(counter);
          }
        });
      }, observerOptions);

      // Observe counter elements
      const counters = document.querySelectorAll(`.${styles.counterNumber}`);
      counters.forEach(counter => counterObserver.observe(counter));

      // Cleanup
      return () => {
        anchors.forEach(anchor => {
          anchor.removeEventListener('click', handleAnchorClick);
        });
        observer.disconnect();
        staggerObserver.disconnect();
        counterObserver.disconnect();
      };
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthenticated]);

  const toggleFAQ = (index: number) => {
    const faqItem = faqRefs.current[index];
    if (!faqItem) return;
    
    const isActive = faqItem.classList.contains(styles.active);
    
    // Close all FAQ items
    faqRefs.current.forEach(item => {
      if (item) item.classList.remove(styles.active);
    });
    
    // Open clicked item if it wasn't active
    if (!isActive) {
      faqItem.classList.add(styles.active);
    }
  };

  const handleAgeConfirmation = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (confirm('あなたは18歳以上ですか？')) {
      // Check if there's a selected plan stored
      const selectedPlan = sessionStorage.getItem('selectedPlan');
      if (selectedPlan) {
        // If plan is selected, go to signup (which will redirect to subscription after signup)
        router.push('/signup');
      } else {
        // Otherwise, proceed normally
        router.push(e.currentTarget.pathname);
      }
    }
  };

  const handlePricingClick = (plan: string) => {
    if (confirm('あなたは18歳以上ですか？')) {
      // Store the selected plan in sessionStorage
      sessionStorage.setItem('selectedPlan', plan);
      // Redirect to login page
      router.push('/login');
    }
  };

  // Show loading only during initial auth check
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-white">読み込み中...</p>
      </div>
    );
  }

  // If authenticated, show redirect message briefly
  if (isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-white">ホームへ移動中...</p>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <video 
          autoPlay 
          muted 
          loop 
          playsInline 
          className={styles.heroVideo}
          preload="auto"
          poster="/img/woman.jpeg"
        >
          <source src="/img/girl.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            あなたの性癖に合う嬢と<br />秘密の出会いを。
          </h1>
          <p className={styles.heroSubtitle}>
            理想の相性を見つける、大人のための<br className={styles.sp} />プレミアムマッチングサイト
          </p>
          <div className={styles.heroCta}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAgeConfirmation}>
              <Heart size={20} />
              Nukuneに参加
            </Link>
            <Link href="/login" className={`${styles.btn} ${styles.btnSecondary}`}>
              <span>ログイン</span>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className={`${styles.section} ${styles.about}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>Nukuneとは？</h2>
          <div className={styles.aboutContent}>
            <div className={`${styles.aboutText} ${styles.scrollSlideLeft}`}>
              <p>Nukuneは、真の繋がりを求める大人のための革新的なプラットフォームです。私たちは、充実した親密な生活が全体的な幸福に大きく貢献すると信じています。</p>
              <br />
              <p>当サービスは、あなたの願いを真に理解し共有するパートナーを見つけるための、安全で簡単、そして尊重に満ちた環境を提供します。完全匿名システムで、あなたのプライバシーを最優先に保護いたします。</p>
            </div>
            <div className={`${styles.aboutImage} ${styles.scrollSlideRight}`}>
              <Image src="/img/woman.jpeg" alt="高級感のある大人の出会い" width={600} height={400} />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`${styles.section} ${styles.features}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>充実の機能で理想の出会い探し</h2>
          <div className={styles.featuresGrid}>
            <div className={`${styles.featureCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.featureIcon}>
                <Brain />
              </div>
              <h3 className={styles.featureTitle}>AIによる最適なマッチング</h3>
              <p className={styles.featureDescription}>AIが相性や好みを分析し、理想の相手を提案。あなたの出会い探しをスムーズにサポートします。</p>
            </div>
            <div className={`${styles.featureCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={`${styles.featureIcon} ${styles.faCalendarHeart}`}>
                <Calendar />
              </div>
              <h3 className={styles.featureTitle}>「会いたい」を投稿</h3>
              <p className={styles.featureDescription}>あなたの希望や理想のデートを投稿して、特別な人との出会いのチャンスを広げましょう。</p>
            </div>
            <div className={`${styles.featureCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.featureIcon}>
                <Search />
              </div>
              <h3 className={styles.featureTitle}>高度な検索機能</h3>
              <p className={styles.featureDescription}>詳細な条件や好みでプロフィールを絞り込み、理想の相手を見つけて直接つながりましょう。</p>
            </div>
          </div>
        </div>
      </section>

      {/* Reasons Section */}
      <section className={`${styles.section} ${styles.reasons}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>Nukuneが選ばれる理由</h2>
          <div className={styles.reasonsGrid}>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <p className={styles.reasonText}>プレミアム機能も安心価格で。女性はほとんどの機能を無料で利用できます！</p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <p className={styles.reasonText}>プライバシーは最優先。準備ができるまで本当の自分を明かさずに繋がれます。</p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <p className={styles.reasonText}>LINEやTwitterなど外部アプリは不要。Nukune内で全てのやり取りが完結します。</p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <p className={styles.reasonText}>会う前にコミュニティの評価を確認できるので、より安全な出会いが可能です。</p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <p className={styles.reasonText}>電話番号で連絡先をブロックし、知り合いとの不要な出会いを避けられます。</p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <p className={styles.reasonText}>法令遵守とユーザー保護のため、関連当局に届出済みです。</p>
            </div>
          </div>
        </div>
      </section>

      {/* Start Guide Section */}
      <section className={`${styles.section} ${styles.startGuide}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>簡単スタートガイド</h2>
          <div className={`${styles.guideContainer} ${styles.scrollScaleUp}`}>
            <div className={styles.guideHeader}>
              <span className={styles.guideBadge}>男性の方</span>
            </div>
            <div className={styles.stepsContainer}>
              <div className={`${styles.stepCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
                <div className={styles.stepNumber}>1</div>
                <h3 className={styles.stepTitle}>プロフィール設定</h3>
                <p className={styles.stepDescription}>理想のマッチングのため、プロフィールを詳細に記入しましょう。</p>
              </div>
              <div className={`${styles.stepCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
                <div className={styles.stepNumber}>2</div>
                <h3 className={styles.stepTitle}>本人確認</h3>
                <p className={styles.stepDescription}>信頼できるコミュニティのため、本人確認にご協力ください。</p>
              </div>
              <div className={`${styles.stepCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
                <div className={styles.stepNumber}>3</div>
                <h3 className={styles.stepTitle}>プラン選択</h3>
                <p className={styles.stepDescription}>プレミアムプランに登録して、全ての機能を利用しましょう。</p>
              </div>
              <div className={`${styles.stepCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
                <div className={styles.stepNumber}>4</div>
                <h3 className={styles.stepTitle}>積極的なアプローチ</h3>
                <p className={styles.stepDescription}>マッチを待つだけでなく、積極的に検索したり投稿したりしましょう！</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety Section */}
      <section className={`${styles.section} ${styles.safety}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>安全への取り組み</h2>
          <div className={styles.safetyGrid}>
            <div className={`${styles.safetyCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.safetyHeader}>
                <div className={styles.safetyIcon}>
                  <UserCheck />
                </div>
                <h3 className={styles.safetyTitle}>本人確認</h3>
              </div>
              <p className={styles.safetyDescription}>プロフィールの信頼性とユーザーの安全のため、本人確認書類の提出を必須としています。</p>
            </div>
            <div className={`${styles.safetyCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.safetyHeader}>
                <div className={styles.safetyIcon}>
                  <Shield />
                </div>
                <h3 className={styles.safetyTitle}>24時間監視体制</h3>
              </div>
              <p className={styles.safetyDescription}>不審なアクティビティやポリシー違反を、運営チームとAIシステムが常時監視しています。</p>
            </div>
            <div className={`${styles.safetyCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.safetyHeader}>
                <div className={styles.safetyIcon}>
                  <Users />
                </div>
                <h3 className={styles.safetyTitle}>厳格なユーザー行動規範</h3>
              </div>
              <p className={styles.safetyDescription}>ハラスメント行為は一切容認しません。違反者には警告または永久追放処分を行います。</p>
            </div>
            <div className={`${styles.safetyCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.safetyHeader}>
                <div className={styles.safetyIcon}>
                  <Ban />
                </div>
                <h3 className={styles.safetyTitle}>通報・ブロック機能</h3>
              </div>
              <p className={styles.safetyDescription}>不適切な行動をとるユーザーを簡単に通報・ブロックできます。</p>
            </div>
            <div className={`${styles.safetyCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.safetyHeader}>
                <div className={styles.safetyIcon}>
                  <Eye />
                </div>
                <h3 className={styles.safetyTitle}>ニックネーム登録</h3>
              </div>
              <p className={styles.safetyDescription}>ニックネームで利用できるため、本名は非公開。個人情報が共有されることはありません。</p>
            </div>
            <div className={`${styles.safetyCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.safetyHeader}>
                <div className={styles.safetyIcon}>
                  <Award />
                </div>
                <h3 className={styles.safetyTitle}>公的機関への届出済み</h3>
              </div>
              <p className={styles.safetyDescription}>法令遵守とユーザー保護のため、関連当局に届出済みです。<br /></p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className={`${styles.section} ${styles.faq}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>よくあるご質問</h2>
          <div className={styles.faqContainer}>
            {[
              {
                question: '料金はどのようになっていますか？',
                answer: '男性会員様には月額定額制の有料プランをご用意しております。'
              },
              {
                question: 'プライバシーは守られますか？',
                answer: 'はい、完全匿名システムを採用しており、ニックネームでのご利用が可能です。本名や個人情報が他のユーザーに公開されることはありません。'
              },
              {
                question: '安全性について教えてください',
                answer: '24時間監視体制、本人確認の必須化、通報・ブロック機能など、多層的な安全対策を実施しています。また、関連当局への届出も完了しております。'
              },
              {
                question: 'どのような人が利用していますか？',
                answer: '真剣な出会いを求める18歳以上の大人の方々にご利用いただいております。幅広い年齢層の方が、理想のパートナー探しにご活用されています。'
              }
            ].map((item, index) => (
              <div key={index} className={`${styles.faqItem} ${styles.scrollStagger}`} ref={(el) => {
                if (el) faqRefs.current[index] = el;
              }}>
                <div className={styles.faqQuestion} onClick={() => toggleFAQ(index)}>
                  <h3>{item.question}</h3>
                  <Plus className={styles.faqIcon} />
                </div>
                <div className={styles.faqAnswer}>
                  <p>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className={`${styles.section} ${styles.pricing}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>料金プラン</h2>
          <p className={`${styles.sectionSubtitle} ${styles.scrollFadeIn}`}>
            Nukuneは登録無料で利用できるマッチングサービスですが、良質な出会いを提供するために男性会員様には女性とのやりとりに付随する機能は月額定額制の有料プランで提供しています。
          </p>
          <div className={styles.pricingGrid}>
            <div className={`${styles.pricingCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.pricingHeader}>
                <h3 className={styles.pricingTitle}>1ヶ月プラン</h3>
                <div className={`${styles.pricingPrice} ${styles.counterNumber}`} data-count="2000">¥2,000</div>
                <div className={styles.pricingPeriod}>月額</div>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>全ての基本機能</li>
                <li>無制限メッセージ</li>
                <li>プロフィール閲覧</li>
                <li>マッチング機能</li>
                <li>カスタマーサポート</li>
              </ul>
              <div className={styles.pricingCta}>
                <button className={styles.pricingBtn} onClick={() => handlePricingClick('1month')}>プラン登録</button>
              </div>
            </div>
            <div className={`${styles.pricingCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.pricingHeader}>
                <h3 className={styles.pricingTitle}>6ヶ月プラン</h3>
                <div className={`${styles.pricingPrice} ${styles.counterNumber}`} data-count="1500">¥1,500</div>
                <div className={styles.pricingPeriod}>月額</div>
                <span className={styles.pricingDiscount}>25%お得</span>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>全ての基本機能</li>
                <li>無制限メッセージ</li>
                <li>プロフィール閲覧</li>
                <li>マッチング機能</li>
                <li>優先サポート</li>
                <li>特別検索機能</li>
              </ul>
              <div className={styles.pricingCta}>
                <button className={styles.pricingBtn} onClick={() => handlePricingClick('6month')}>プラン登録</button>
              </div>
            </div>
            <div className={`${styles.pricingCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.pricingHeader}>
                <h3 className={styles.pricingTitle}>12ヶ月プラン</h3>
                <div className={`${styles.pricingPrice} ${styles.counterNumber}`} data-count="1000">¥1,000</div>
                <div className={styles.pricingPeriod}>月額</div>
                <span className={styles.pricingDiscount}>50%お得</span>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>全ての基本機能</li>
                <li>無制限メッセージ</li>
                <li>プロフィール閲覧</li>
                <li>マッチング機能</li>
                <li>VIPサポート</li>
                <li>特別検索機能</li>
                <li>プレミアムバッジ</li>
              </ul>
              <div className={styles.pricingCta}>
                <button className={styles.pricingBtn} onClick={() => handlePricingClick('12month')}>プラン登録</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`${styles.section} ${styles.cta}`}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2 className={`${styles.ctaTitle} ${styles.scrollFadeIn}`}>性癖に正直な出会いを。</h2>
            <p className={`${styles.ctaSubtitle} ${styles.scrollFadeIn}`}>
              今すぐNukuneに参加して、より充実した関係を築くための一歩を踏み出しましょう。
            </p>
            <Link 
              href="/signup" 
              className={`${styles.btn} ${styles.btnPrimary} ${styles.scrollScaleUp} ${styles.enhancedHover}`}
              onClick={handleAgeConfirmation}
            >
              <Heart size={20} />
              今すぐ登録
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}