'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Brain, Search, Shield, Users, Award, Ban, UserCheck, Eye, Plus, Loader2 } from 'lucide-react';
import styles from './page.module.scss';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import MatchingSearch from '@/components/home/MatchingSearch';

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

    // モバイルでも確実に動作するように初期化
    const initializeAnimations = () => {
      
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
      
      // 初期状態を設定（リロード時の対応）
      animatedElements.forEach((el, index) => {
        // 要素が最初から画面内にある場合
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const isInViewport = rect.top < windowHeight && rect.bottom > 0;
        
        if (isInViewport) {
          // 少し遅延させてアニメーションを開始（モバイル対応で遅延を増やす）
          const delay = ('ontouchstart' in window) ? 200 + (index * 50) : 100 + (index * 30);
          setTimeout(() => {
            el.setAttribute('data-animated', 'true');
          }, delay);
        } else {
          el.setAttribute('data-animated', 'false');
        }
        
        observer.observe(el);
      });

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
      
      // スタッガーアニメーションの初期化
      staggerContainers.forEach(container => {
        const rect = container.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isInViewport) {
          const staggerElements = container.querySelectorAll(`.${styles.scrollStagger}`);
          staggerElements.forEach((el, index) => {
            setTimeout(() => {
              el.setAttribute('data-animated', 'true');
            }, 100 + (index * 80));
          });
        } else {
          const staggerElements = container.querySelectorAll(`.${styles.scrollStagger}`);
          staggerElements.forEach(el => {
            el.setAttribute('data-animated', 'false');
          });
        }
        
        staggerObserver.observe(container);
      });

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
    };
    
    // モバイルでの初期化を確実にする
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeAnimations);
    } else {
      // すでにDOMが読み込まれている場合
      initializeAnimations();
    }
    
    // さらに確実にするため、少し遅延させて再実行
    const timer = setTimeout(initializeAnimations, 500);
    
    // モバイルデバイスの場合は追加で遅延実行
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      setTimeout(initializeAnimations, 1000);
    }

    return () => {
      clearTimeout(timer);
      document.removeEventListener('DOMContentLoaded', initializeAnimations);
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
            <span className={styles.heroTitleLine1}>あなたの性癖に合う嬢と</span>
            <span className={styles.heroTitleLine2}>出逢えるマッチングサイト</span>
          </h1>
          <p className={styles.heroSubtitle}>
            従来の風俗サイトでは実現できなかった<br />
            革新的なマッチングシステム
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
              <h3 className={styles.aboutSubtitle}>従来の風俗ポータルサイトの問題点</h3>
              <p className={styles.aboutProblem}>「写真と実物が違った」「自分の好みを理解してもらえなかった」「プレイスタイルが合わなかった」</p>
              <p>このような失敗経験はありませんか？従来のサイトでは、表面的な情報だけで選ぶしかなく、本当の相性は会ってみるまでわかりませんでした。</p>
              <br />
              <h3 className={styles.aboutSubtitle}>Nukuneが提供する革新的な解決策</h3>
              <p>AIマッチング技術により、あなたの性癖・好み・プレイスタイルを詳細に分析。本当に相性の良い女性だけを厳選してご紹介します。</p>
              <br />
              <p>もう「思っていたのと違った」という失敗はありません。事前に相性度がわかるから、安心して理想の出会いを実現できます。</p>
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
              <div className={styles.featureIcon}>
                <Shield />
              </div>
              <h3 className={styles.featureTitle}>事前確認システム</h3>
              <p className={styles.featureDescription}>会う前に女性のプレイスタイル・対応可能な内容・性格の詳細。希望に100%応えられる女性だけと出会えます。</p>
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

      {/* Matching Search Section */}
      <section className={`${styles.section} ${styles.matchingSearch}`}>
        <div className={styles.container}>
          <div className={`${styles.scrollFadeIn} max-w-4xl mx-auto`}>
            <MatchingSearch />
          </div>
        </div>
      </section>

      {/* Reasons Section */}
      <section className={`${styles.section} ${styles.reasons}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>従来の風俗サイトとの決定的な違い</h2>
          <div className={styles.reasonsGrid}>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>相性保証システム</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：写真とプロフィールだけで判断</span>
                <span className={styles.reasonNew}>Nukune：AI分析により95%以上の相性マッチを保証</span>
              </p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>詳細プレイ確認</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：会うまで対応内容が不明確</span>
                <span className={styles.reasonNew}>Nukune：事前に全ての希望を確認・調整可能</span>
              </p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>リアルタイムマッチング</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：店舗の空き状況のみ確認</span>
                <span className={styles.reasonNew}>Nukune：今すぐ会える相性の良い女性を即座に検索</span>
              </p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>性癖完全対応</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：一般的なサービスのみ</span>
                <span className={styles.reasonNew}>Nukune：あなたの性癖に100%対応できる女性を厳選</span>
              </p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>安心安全なプレイ</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：女性とメッセージは不可</span>
                <span className={styles.reasonNew}>Nukune：LINEなどのアプリは不要。Nukune内で全てのやり取りが完結します。</span>
              </p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>匿名性の確保</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：個人情報の登録が必須</span>
                <span className={styles.reasonNew}>Nukune：完全匿名で安心して利用可能</span>
              </p>
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
              <p className={styles.safetyDescription}>NUKUNEでは、法令遵守に基づきインターネット異性紹介事業の届出しております。(受理番号54250003000)<br /></p>
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
                question: 'なぜ95%以上の相性マッチを保証できるのですか？',
                answer: '革新的なAI技術により、あなたの性癖・好み・プレイスタイルを詳細に分析。数万件のマッチングデータを基に、本当に相性の良い女性だけを厳選してご紹介するため、高い満足度を実現しています。'
              },
              {
                question: '従来の風俗サイトとは何が違うのですか？',
                answer: '従来のサイトは写真と簡単なプロフィールだけで選ぶため、実際に会ってみて「思っていたのと違った」という失敗が多発していました。Nukuneでは事前に相性度がわかり、プレイスタイルも詳細に確認できるため、失敗しない出会いを実現します。'
              },
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