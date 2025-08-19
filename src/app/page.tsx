'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Brain, Search, Shield, Users, Award, Ban, UserCheck, Eye, Plus, Loader2, MapPin } from 'lucide-react';
import styles from './page.module.scss';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import MatchingSearch from '@/components/home/MatchingSearch';
import { isLineApp } from '@/lib/utils/browser';

export default function LandingPage() {
  const faqRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [forceShowContent, setForceShowContent] = useState(false);
  const [isInLineApp, setIsInLineApp] = useState(false);
  const [showStickyButtons, setShowStickyButtons] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  // Check if we're in LINE browser
  useEffect(() => {
    setIsInLineApp(isLineApp());
  }, []);

  // スクロール検知でスティッキーボタンの表示制御
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const heroBottom = heroRef.current.getBoundingClientRect().bottom;
        // ヒーローセクションが画面外に出たらスティッキーボタンを表示
        setShowStickyButtons(heroBottom < 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // 初期状態をチェック

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Timeout for loading state - especially for LINE browser
  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        console.log('Loading timeout reached, forcing content display');
        setForceShowContent(true);
      }
    }, isInLineApp ? 3000 : 5000); // 3 seconds for LINE, 5 seconds for others

    return () => clearTimeout(loadingTimeout);
  }, [isLoading, isInLineApp]);

  // Redirect to home if already logged in
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/home');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    // Skip animations if authenticated (will redirect anyway)
    if (isAuthenticated) return;

    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768;
    
    // アニメーション初期化（モバイルでも動作するが、異なる設定）
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

      // Bidirectional Intersection Observer for scroll animations
      const observerOptions = {
        threshold: isMobile ? 0 : 0.1,
        rootMargin: isMobile ? '0px 0px 0px 0px' : '-50px 0px -50px 0px'
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-animated', 'true');
          } else {
            // 双方向アニメーション: 要素が画面外に出たら即座にリセット（上下両方向）
            entry.target.setAttribute('data-animated', 'false');
          }
        });
      }, observerOptions);

      // Observe all scroll animation elements
      const animatedElements = document.querySelectorAll(`.${styles.scrollFadeIn}, .${styles.scrollSlideLeft}, .${styles.scrollSlideRight}, .${styles.scrollScaleUp}`);
      
      animatedElements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const isInViewport = rect.top < windowHeight && rect.bottom > 0;
        
        if (isInViewport) {
          const delay = isMobile ? 50 + (index * 20) : 100 + (index * 30);
          setTimeout(() => {
            el.setAttribute('data-animated', 'true');
          }, delay);
        } else {
          el.setAttribute('data-animated', 'false');
        }
        
        observer.observe(el);
      });
      
      // Observe section slide animations
      const sectionElements = document.querySelectorAll(`.${styles.sectionSlideLeft}, .${styles.sectionSlideRight}`);
      
      const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-section-animated', 'true');
          } else {
            // 双方向アニメーション: 画面外に出たら即座にリセット（上下両方向で毎回動作）
            entry.target.setAttribute('data-section-animated', 'false');
          }
        });
      }, {
        threshold: isMobile ? 0.05 : 0.1,
        rootMargin: isMobile ? '0px' : '-50px 0px'
      });
      
      sectionElements.forEach(section => {
        const rect = section.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const isInViewport = rect.top < windowHeight && rect.bottom > 0;
        
        if (isInViewport) {
          section.setAttribute('data-section-animated', 'true');
        } else {
          section.setAttribute('data-section-animated', 'false');
        }
        
        sectionObserver.observe(section);
      });

      // Stagger animation observer with bidirectional support
      const staggerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const staggerElements = entry.target.querySelectorAll(`.${styles.scrollStagger}`);
          if (entry.isIntersecting) {
            staggerElements.forEach((el, index) => {
              const delay = isMobile ? 0 : index * 80;
              setTimeout(() => {
                el.setAttribute('data-animated', 'true');
              }, delay);
            });
          } else {
            // 双方向アニメーション: 画面外に出たら即座にリセット
            staggerElements.forEach(el => {
              el.setAttribute('data-animated', 'false');
            });
          }
        });
      }, observerOptions);

      // Observe containers with stagger elements
      const staggerContainers = document.querySelectorAll(`.${styles.featuresGrid}, .${styles.reasonsGrid}, .${styles.stepsContainer}, .${styles.safetyGrid}, .${styles.faqContainer}, .${styles.pricingGrid}`);
      
      staggerContainers.forEach(container => {
        const rect = container.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isInViewport) {
          const staggerElements = container.querySelectorAll(`.${styles.scrollStagger}`);
          staggerElements.forEach((el, index) => {
            const delay = isMobile ? 50 + (index * 40) : 100 + (index * 80);
            setTimeout(() => {
              el.setAttribute('data-animated', 'true');
            }, delay);
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
        sectionObserver.disconnect();
      };
    };
    
    // 初期化（モバイル・デスクトップ両方）
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeAnimations);
    } else {
      initializeAnimations();
    }

    return () => {
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
    // Store the selected plan in sessionStorage first
    sessionStorage.setItem('selectedPlan', plan);
    
    // Try to show confirmation dialog
    try {
      const isAdult = confirm('あなたは18歳以上ですか？');
      if (isAdult) {
        // Redirect to subscription page with plan parameter
        router.push(`/subscription?plan=${plan}`);
      } else {
        // Clear the stored plan if user says no
        sessionStorage.removeItem('selectedPlan');
      }
    } catch (error) {
      // If popup is blocked, redirect directly with a warning page parameter
      console.log('Popup blocked, redirecting with age confirmation required');
      router.push(`/subscription?plan=${plan}&age_confirm=required`);
    }
  };

  // Show loading only during initial auth check (with timeout)
  if (isLoading && !forceShowContent) {
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
      {/* Sticky Buttons - ヒーローセクションから離れたら表示 */}
      <div className={`${styles.stickyButtons} ${showStickyButtons ? styles.stickyButtonsVisible : ''}`}>
        <Link 
          href="/signup" 
          className={`${styles.stickyBtn} ${styles.stickyBtnPrimary}`} 
          onClick={handleAgeConfirmation}
        >
          <Heart size={18} />
          <span>Nukuneに参加</span>
        </Link>
        <Link 
          href="/login" 
          className={`${styles.stickyBtn} ${styles.stickyBtnSecondary}`}
        >
          <span>ログイン</span>
        </Link>
      </div>

      {/* Background animated boxes */}
      <div className={styles.bgBoxesContainer}>
        <div className={styles.bgBox}></div>
        <div className={styles.bgBox}></div>
        <div className={styles.bgBox}></div>
        <div className={styles.bgBox}></div>
        <div className={styles.bgBox}></div>
      </div>
      {/* Hero Section */}
      <section ref={heroRef} className={styles.hero}>
        <video 
          autoPlay 
          muted 
          loop 
          playsInline 
          className={styles.heroVideo}
          preload="auto"
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
      <section className={`${styles.section} ${styles.about} ${styles.sectionSlideLeft}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>NUKUNEとは</h2>
          <div className={styles.aboutContent}>
            <div className={`${styles.aboutText} ${styles.scrollSlideLeft}`}>
              <p className={styles.aboutLead}>
                あなたの性癖や嗜好に寄り添い、<br className={styles.mobileBreak} />
                最適なキャストをご案内する
              </p>
              <h3 className={styles.aboutBrand}>
                <span className={styles.brandLine1}>性癖マッチングコンシェルジュ</span>
                <span className={styles.brandLine2}>「NUKUNE」</span>
              </h3>
              
              <div className={styles.aboutSection}>
                <p>
                  インターネット異性紹介事業（届出受理番号 54250003000）として、法令を遵守し、安全・安心な出会いの場を提供しています。
                </p>
                <p>
                  大手風俗情報サイトと提携し、当日案内可能なキャスト情報をリアルタイムでお届けします。
                </p>
              </div>
              
              <div className={styles.aboutFeatures}>
                <div className={styles.featureItem}>
                  <p>現在地からのGPS検索で、近くの相性ぴったりなキャストをご提案</p>
                </div>
                <div className={styles.featureItem}>
                  <p>気になるキャストがいれば、ニックネームでリクエストするだけで、提携先経由で予約まで完結</p>
                </div>
              </div>
              
              <div className={styles.ageNotice}>
                <p>NUKUNEは18歳未満の方は<br className="sp" />ご利用いただけません。</p>
              </div>
              
              <div className={styles.aboutTagline}>
                <p>あなたの特別な時間を演出する、<br className="sp" />信頼できるパートナー。</p>
                <p className={styles.brandStatement}>それがNUKUNEです。</p>
              </div>
            </div>
            <div className={`${styles.aboutImage} ${styles.scrollSlideRight}`}>
              <Image src="/img/woman.jpeg" alt="高級感のある大人の出会い" width={600} height={400} />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`${styles.section} ${styles.features} ${styles.sectionSlideRight}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>
            <span className={styles.titleLine1}>充実の機能で</span>
            <span className={styles.titleLine2}>理想の出会い探し</span>
          </h2>
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

      {/* Solutions Section - こんなとき、NUKUNEが解決します */}
      <section className={`${styles.section} ${styles.solutions} ${styles.sectionSlideLeft}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>
            <span className={styles.titleLine1}>こんなとき、</span>
            <span className={styles.titleLine2}>NUKUNEが解決します</span>
          </h2>
          <div className={styles.solutionsIntro}>
            <p className={styles.solutionsProblem}>
              急に時間ができたとき、知らない土地で遊びたいとき、<br />
              「どこに行けばいいのかわからない…」そんな経験はありませんか？
            </p>
          </div>

          <div className={styles.problemsGrid}>
            <div className={`${styles.problemCard} ${styles.scrollStagger}`}>
              <div className={styles.problemIcon}>✕</div>
              <p>風俗サイトでの検索は時間がかかる</p>
            </div>
            <div className={`${styles.problemCard} ${styles.scrollStagger}`}>
              <div className={styles.problemIcon}>✕</div>
              <p>無料案内所に行くのは面倒</p>
            </div>
            <div className={`${styles.problemCard} ${styles.scrollStagger}`}>
              <div className={styles.problemIcon}>✕</div>
              <p>飛び込みで店に行く勇気がない</p>
            </div>
            <div className={`${styles.problemCard} ${styles.scrollStagger}`}>
              <div className={styles.problemIcon}>✕</div>
              <p>やっと見つけたお目当ての嬢が予約完売</p>
            </div>
            <div className={`${styles.problemCard} ${styles.scrollStagger}`}>
              <div className={styles.problemIcon}>✕</div>
              <p>時間や性癖が合わずに断念</p>
            </div>
          </div>

          <div className={styles.solutionBridge}>
            <div className={styles.solutionArrow}>↓</div>
          </div>

          <div className={styles.solutionCard}>
            <div className={styles.solutionHeader}>
              <span className={styles.solutionBadge}>Solution</span>
              <h3 className={styles.solutionTitle}>
                NUKUNE（ヌクネ）は、そんな悩みを解消する<br />
                <span className={styles.solutionHighlight}>"性癖コンシェルジュ"</span>です
              </h3>
            </div>
            
            <div className={styles.solutionFeatures}>
              <div className={styles.solutionFeature}>
                <div className={styles.solutionFeatureIcon}>
                  <Search />
                </div>
                <div className={styles.solutionFeatureText}>
                  <h4>一括検索</h4>
                  <p>登録した性癖や趣味嗜好に合わせて、あなたにぴったりの風俗嬢を一括検索</p>
                </div>
              </div>
              
              <div className={styles.solutionFeature}>
                <div className={styles.solutionFeatureIcon}>
                  <MapPin />
                </div>
                <div className={styles.solutionFeatureText}>
                  <h4>GPS検索</h4>
                  <p>最短で遊びに行けるキャストをすぐにご案内</p>
                </div>
              </div>
              
              <div className={styles.solutionFeature}>
                <div className={styles.solutionFeatureIcon}>
                  <Heart />
                </div>
                <div className={styles.solutionFeatureText}>
                  <h4>スムーズなキャスティング</h4>
                  <p>あなたの理想と今の状況にマッチする相手を、スムーズにキャスティング</p>
                </div>
              </div>
            </div>

            <div className={styles.solutionCta}>
              <p className={styles.solutionTagline}>
                今までなかった新しいサービス<br />
                <span className={styles.solutionBrand}>性癖マッチング NUKUNE</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Matching Search Section */}
      <section className={`${styles.section} ${styles.matchingSearch} ${styles.sectionSlideRight}`}>
        <div className={styles.container}>
          <div className={`${styles.scrollFadeIn} max-w-4xl mx-auto`}>
            <MatchingSearch />
          </div>
        </div>
      </section>

      {/* Reasons Section */}
      <section className={`${styles.section} ${styles.reasons} ${styles.sectionSlideLeft}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>
            <span className={styles.titleLine1}>従来の風俗サイトとの</span>
            <span className={styles.titleLine2}>決定的な違い</span>
          </h2>
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
      <section className={`${styles.section} ${styles.startGuide} ${styles.sectionSlideRight}`}>
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
      <section className={`${styles.section} ${styles.safety} ${styles.sectionSlideLeft}`}>
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
      <section className={`${styles.section} ${styles.faq} ${styles.sectionSlideRight}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>よくあるご質問</h2>
          <div className={styles.faqContainer}>
            {[
              {
                question: 'なぜ95%以上の相性マッチを保証できるのですか？',
                answer: 'NUKUNEでは、女性ユーザー数が、全国に15万人登録されております。(2025.09現在)\n\n驚愕の性癖マッチング率はなんと95%！\n\n性癖、性的、嗜好マッチング業界の中では、ダントツのNO.1\n\n今いる現在位置情報から、自分好みで最も近くにいる女性を、即検索しご提案しております。\nすぐヌキたい！そんな男性達をNUKUNEは応援します。'
              },
              {
                question: '従来の風俗サイトとは何が違うのですか？',
                answer: '従来のサイトは写真と簡単なプロフィールだけで選ぶため、\n実際に会ってみて「思っていたのと違った」という失敗が多発していました。\n\nNukuneでは事前に相性度がわかり、\nプレイスタイルも詳細に確認できるため、\n失敗しない出会いを実現します。'
              },
              {
                question: '料金はどのようになっていますか？',
                answer: '男性会員様には月額定額制の有料プランをご用意しております。\n\n詳しい料金プランは会員登録後にご確認いただけます。'
              },
              {
                question: 'プライバシーは守られますか？',
                answer: 'はい、完全匿名システムを採用しており、\nニックネームでのご利用が可能です。\n\n本名や個人情報が他のユーザーに公開されることはありません。'
              },
              {
                question: '安全性について教えてください',
                answer: '24時間監視体制、本人確認の必須化、\n通報・ブロック機能など、\n多層的な安全対策を実施しています。\n\nまた、関連当局への届出も完了しております。'
              },
              {
                question: 'どのような人が利用していますか？',
                answer: '真剣な出会いを求める18歳以上の大人の方々に\nご利用いただいております。\n\n幅広い年齢層の方が、\n理想のパートナー探しにご活用されています。'
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

      {/* Fixed Price Section */}
      <section className={`${styles.section} ${styles.fixedPrice} ${styles.sectionSlideLeft}`}>
        <div className={styles.container}>
          <div className={`${styles.fixedPriceContent} ${styles.scrollFadeIn}`}>
            <h2 className={styles.fixedPriceTitle}>
              <span className={styles.goldAccent}>完全定額制</span>で安心
            </h2>
            <p className={styles.fixedPriceDescription}>
              NUKUNEは月額料金だけで利用できる、完全定額制のマッチングサービスです。<br />
              メッセージのやり取りや閲覧に追加課金が発生することはありません。<br />
              登録からマッチング、やり取り、予約まで、すべて月額料金に含まれています。
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section - LUXE DATE Style */}
      <section className={`${styles.section} ${styles.pricing} ${styles.sectionSlideRight}`}>
        <div className={styles.container}>
          <div className={styles.pricingHeader}>
            <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>
              <span className={styles.titleLine1}>NUKUNE 利用料金</span>
              <span className={styles.titleLine2}>（男性会員様）</span>
            </h2>
            <p className={`${styles.pricingSubtitle} ${styles.scrollFadeIn}`}>
              NUKUNEは登録無料でお使いいただけます。<br />
              ただし、良質な出会いを提供するため、男性会員様のキャスト検索機能は<br />
              月額定額制の有料プランで提供しています。
            </p>
          </div>

          {/* 共通機能表示 */}
          <div className={styles.commonFeatures}>
            <h3 className={styles.commonFeaturesTitle}>料金プラン</h3>
            <div className={styles.featuresBox}>
              <div className={styles.featureItem}>
                <span className={styles.checkIcon}>✓</span>
                <span>全ての基本機能</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.checkIcon}>✓</span>
                <span>プロフィール閲覧</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.checkIcon}>✓</span>
                <span>マッチング機能</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.checkIcon}>✓</span>
                <span>カスタマーサポート</span>
              </div>
            </div>
          </div>

          <div className={styles.pricingGrid}>
            {/* 1ヶ月プラン */}
            <div className={`${styles.pricingCard} ${styles.scrollStagger}`}>
              <div className={styles.planBadge}>期間限定！</div>
              <div className={styles.planHeader}>
                <h3 className={styles.planTitle}>1ヶ月プラン</h3>
                <div className={styles.priceWrapper}>
                  <span className={styles.priceLabel}>月額</span>
                  <span className={`${styles.priceAmount} ${styles.counterNumber}`} data-count="1980">¥1,980</span>
                  <span className={styles.priceTax}>円/月</span>
                </div>
                <div className={styles.priceTaxLabel}>（税込）</div>
                <div className={styles.totalPrice}>（一括1,980円）</div>
                <div className={styles.specialOffer}>3,480円が期間限定で1,980円に！</div>
              </div>
              <button className={styles.planButton} onClick={() => handlePricingClick('1month')}>
                プラン登録
              </button>
            </div>

            {/* 3ヶ月プラン */}
            <div className={`${styles.pricingCard} ${styles.scrollStagger}`}>
              <div className={styles.planBadge}>少しお得</div>
              <div className={styles.planHeader}>
                <h3 className={styles.planTitle}>3ヶ月プラン</h3>
                <div className={styles.priceWrapper}>
                  <span className={styles.priceLabel}>月額</span>
                  <span className={`${styles.priceAmount} ${styles.counterNumber}`} data-count="1550">¥1,550</span>
                  <span className={styles.priceTax}>円/月</span>
                </div>
                <div className={styles.priceTaxLabel}>（税込）</div>
                <div className={styles.totalPrice}>（一括4,650円）</div>
                <div className={styles.discountBadge}>最大56%お得なプラン</div>
              </div>
              <button className={styles.planButton} onClick={() => handlePricingClick('3month')}>
                プラン登録
              </button>
            </div>

            {/* 6ヶ月プラン - 人気 */}
            <div className={`${styles.pricingCard} ${styles.pricingCardPopular} ${styles.scrollStagger}`}>
              <div className={styles.planBadge}>一番人気！</div>
              <div className={styles.planHeader}>
                <h3 className={styles.planTitle}>6ヶ月プラン</h3>
                <div className={styles.priceWrapper}>
                  <span className={styles.priceLabel}>月額</span>
                  <span className={`${styles.priceAmount} ${styles.counterNumber}`} data-count="1350">¥1,350</span>
                  <span className={styles.priceTax}>円/月</span>
                </div>
                <div className={styles.priceTaxLabel}>（税込）</div>
                <div className={styles.totalPrice}>（一括8,100円）</div>
                <div className={styles.discountBadge}>最大62%お得なプラン</div>
              </div>
              <button className={`${styles.planButton} ${styles.planButtonPopular}`} onClick={() => handlePricingClick('6month')}>
                プラン登録
              </button>
            </div>

            {/* 12ヶ月プラン */}
            <div className={`${styles.pricingCard} ${styles.scrollStagger}`}>
              <div className={styles.planBadge}>一番お得！</div>
              <div className={styles.planHeader}>
                <h3 className={styles.planTitle}>12ヶ月プラン</h3>
                <div className={styles.priceWrapper}>
                  <span className={styles.priceLabel}>月額</span>
                  <span className={`${styles.priceAmount} ${styles.counterNumber}`} data-count="1150">¥1,150</span>
                  <span className={styles.priceTax}>円/月</span>
                </div>
                <div className={styles.priceTaxLabel}>（税込）</div>
                <div className={styles.totalPrice}>（一括13,800円）</div>
                <div className={styles.discountBadge}>最大67%お得なプラン</div>
              </div>
              <button className={styles.planButton} onClick={() => handlePricingClick('12month')}>
                プラン登録
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`${styles.section} ${styles.cta} ${styles.sectionSlideLeft}`}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2 className={`${styles.ctaTitle} ${styles.scrollFadeIn}`}>性癖、嗜好に正直な出会いを</h2>
            <p className={`${styles.ctaSubtitle} ${styles.scrollFadeIn}`}>
            今すぐ、NUKUNE(ヌクネ)に参加して、自分の理想とする素敵なキャストとの<br />出会いに踏み出しましょう
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