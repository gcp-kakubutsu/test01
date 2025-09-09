'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Brain, Search, Shield, Users, Award, Ban, UserCheck, Eye, Plus, Loader2, MapPin } from 'lucide-react';
import styles from './page.module.scss';
import { Footer } from '@/components/layout/Footer';
import { SNSSection } from '@/components/layout/SNSSection';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import MatchingSearch from '@/components/home/MatchingSearch';
import { isLineApp } from '@/lib/utils/browser';
import { CampaignBanner } from '@/components/CampaignBanner';

export default function LandingPage() {
  const faqRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [forceShowContent, setForceShowContent] = useState(false);
  const [isInLineApp, setIsInLineApp] = useState(false);
  const [showStickyButtons, setShowStickyButtons] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCampaignBanner, setShowCampaignBanner] = useState(false);
  const [hasPassedMiddle, setHasPassedMiddle] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  // セクションリスト定義
  const sections = [
    { id: 'about', name: 'NUKUNEとは', icon: '🌸' },
    { id: 'features', name: '機能紹介', icon: '⚡' },
    { id: 'solutions', name: '課題解決', icon: '💡' },
    { id: 'matching', name: 'マッチング検索', icon: '🔍' },
    { id: 'reasons', name: '他サイトとの違い', icon: '🆚' },
    { id: 'guide', name: 'スタートガイド', icon: '📖' },
    { id: 'safety', name: '安全への取り組み', icon: '🛡️' },
    { id: 'faq', name: 'よくある質問', icon: '❓' },
    { id: 'pricing', name: '料金プラン', icon: '💰' },
  ];

  // スムーズスクロール関数
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -80; // ヘッダーの高さ分オフセット
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
      setIsMenuOpen(false); // メニューを閉じる
    }
  };

  // Check if we're in LINE browser
  useEffect(() => {
    setIsInLineApp(isLineApp());
  }, []);

  // メニューが開いたときにbodyのスクロールを無効化
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // クリーンアップ
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // スクロール検知でスティッキーボタンとキャンペーンバナーの表示制御
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const heroBottom = heroRef.current.getBoundingClientRect().bottom;
        // ヒーローセクションが画面外に出たらスティッキーボタンを表示
        setShowStickyButtons(heroBottom < 0);
      }

      // ページの中央を通過したかチェック
      const scrollPosition = window.scrollY + window.innerHeight / 2;
      const documentHeight = document.documentElement.scrollHeight / 2;
      
      if (!hasPassedMiddle && scrollPosition > documentHeight) {
        setHasPassedMiddle(true);
        
        // ログインしていない場合は毎回表示
        if (!isAuthenticated) {
          setShowCampaignBanner(true);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // 初期状態をチェック

    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasPassedMiddle, isAuthenticated]);

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
      {/* Campaign Banner */}
      {showCampaignBanner && (
        <CampaignBanner 
          onClose={() => setShowCampaignBanner(false)}
        />
      )}

      {/* ハンバーガーメニューボタン */}
      <button 
        className={`${styles.menuToggle} ${isMenuOpen ? styles.menuToggleOpen : ''}`}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="メニューを開く"
      >
        <span className={styles.menuToggleLine}></span>
        <span className={styles.menuToggleLine}></span>
        <span className={styles.menuToggleLine}></span>
      </button>

      {/* ナビゲーションメニュー */}
      <div className={`${styles.navigationMenu} ${isMenuOpen ? styles.navigationMenuOpen : ''}`}>
        <nav className={styles.navigationContent}>
          <h3 className={styles.navigationTitle}>セクション</h3>
          <ul className={styles.navigationList}>
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => scrollToSection(section.id)}
                  className={styles.navigationItem}
                >
                  <span className={styles.navigationIcon}>{section.icon}</span>
                  <span className={styles.navigationName}>{section.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      
      {/* Sticky Buttons - ヒーローセクションから離れたら表示 */}
      <div className={`${styles.stickyButtons} ${showStickyButtons ? styles.stickyButtonsVisible : ''}`}>
        <Link 
          href="/signup" 
          className={`${styles.btn} ${styles.btnPrimary}`} 
          onClick={handleAgeConfirmation}
        >
          <Heart size={24} />
          無料で参加
        </Link>
        <Link 
          href="/login" 
          className={`${styles.btn} ${styles.btnSecondary}`}
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
            <span className={styles.heroTitleLine1}>
              <span className={styles.heroKeyword}>相性</span>
              <span className={styles.heroTitlePlain}>で選ぶ</span>
              <span className={styles.heroKeyword}>最短</span>
              <span className={styles.heroTitlePlain}>の出会い</span>
            </span>
            <span className={styles.heroTitleLine2}>
              <span className={styles.mobilePart1}>あなたに合う</span>
              <span className={styles.mobilePart2}>キャストだけ表示</span>
            </span>
          </h1>
          <p className={styles.heroSubtitle}>
            エリア・来店時間・嗜好を一括判定<br />
            従来の風俗サイトより速く・的確に
          </p>
          <div className={styles.heroCta}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAgeConfirmation}>
              <Heart size={24} />
              無料で参加
            </Link>
            <Link href="/login" className={`${styles.btn} ${styles.btnSecondary}`}>
              <span>ログイン</span>
            </Link>
          </div>
          <div className={styles.heroLocationInfo}>
            <div className={styles.locationInfoContent}>
              <p className={styles.locationInfoLine1}>全国登録キャスト15万人</p>
              <div className={styles.locationInfoLine2}>
                現在地・希望条件・60分以内の空き枠をもとに最速にご案内します
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className={`${styles.section} ${styles.about} ${styles.sectionSlideLeft}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>NUKUNEとは</h2>
          <div className={styles.aboutContent}>
            <div className={`${styles.aboutText} ${styles.scrollSlideLeft}`}>
              <p className={styles.aboutLead}>
                あなたの性癖や嗜好に寄り添い、最適なキャストをご案内する性癖コンシェルジュ「NUKUNE(ヌクネ)」
              </p>
              <h3 className={styles.aboutBrand} style={{ color: '#D4AF37', fontSize: '1.5em', fontWeight: 'bold', margin: '20px 0' }}>
                条件入力は一度だけ。<br />すぐに会える、<br />新しい体験。
              </h3>
              
              <div className={styles.aboutSection}>
                <p>
                  NUKUNEは「風俗情報サイトのデータ」を活用し、検索から予約までをワンストップで実現します。
                </p>
              </div>
              
              <div className={styles.aboutFeatures}>
                <div className={styles.featureItem}>
                  <p>現在地からのGPS検索で、近くの相性ぴったりなキャストをご提案</p>
                </div>
                <div className={styles.featureItem}>
                  <p>気になるキャストがいれば、『君に決めた』を押すだけで、提携先の風俗サイト経由で即予約</p>
                </div>
              </div>
              
              <div className={styles.ageNotice}>
                <p>NUKUNEは18歳未満の方は<br className="sp" />ご利用いただけません。</p>
              </div>
              
              <div className={styles.aboutTagline}>
                <p>検索~予約までスムーズに完結。<br />
                あなたの特別な時間を演出する、<br />
                信頼できるパートナー。</p>
                <p className={styles.brandStatement} style={{ fontSize: '1.5em', fontWeight: 'bold', marginTop: '15px' }}>それがNUKUNEです。</p>
              </div>
            </div>
            <div className={`${styles.aboutImage} ${styles.scrollSlideRight}`}>
              <Image src="/img/woman.jpeg" alt="高級感のある大人の出会い" width={600} height={400} />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={`${styles.section} ${styles.features} ${styles.sectionSlideRight}`}>
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
              <h3 className={styles.featureTitle}>AIによる最適マッチング</h3>
              <p className={styles.featureDescription}>AIが相性や好みを分析し、理想の相手を提案。あなたの出会い探しをスムーズにサポートします。</p>
            </div>
            <div className={`${styles.featureCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <div className={styles.featureIcon}>
                <Shield />
              </div>
              <h3 className={styles.featureTitle}>事前確認システム</h3>
              <p className={styles.featureDescription}>事前に会う前に女性のプレイスタイル・対応可能な内容・性格の詳細がわかります。希望に応えられる女性だけと出会えます。</p>
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
      <section id="solutions" className={`${styles.section} ${styles.solutions} ${styles.sectionSlideLeft}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>
            <span className={styles.titleLine1}>こんなとき、</span>
            <span className={styles.titleLine2}>NUKUNEが一発解決</span>
          </h2>
          <div className={styles.solutionsIntro}>
            <p className={styles.solutionsProblem}>
              急に時間ができたから、<br className={styles.mobileBreak} />
              今すぐ遊びたい！
              <span className={styles.nukitaiText} style={{ fontWeight: 'bold', color: '#b8b2a7' }}>今すぐNUKIたい！</span><br />
              そんな気分になっても、遊ぶ場所を探すのが面倒だから、結局あきらめてしまった。そんな経験はありませんか？
            </p>
          </div>

          <div className={styles.problemsGrid}>
            <div className={`${styles.problemCard} ${styles.scrollStagger}`}>
              <div className={styles.problemIcon}>✕</div>
              <p>風俗サイトでの情報検索は時間がかかる</p>
            </div>
            <div className={`${styles.problemCard} ${styles.scrollStagger}`}>
              <div className={styles.problemIcon}>✕</div>
              <p>見知らぬ土地だと遊びに行く場所を迷ってしまう</p>
            </div>
            <div className={`${styles.problemCard} ${styles.scrollStagger}`}>
              <div className={styles.problemIcon}>✕</div>
              <p>新規のお店に行く勇気がない</p>
            </div>
            <div className={`${styles.problemCard} ${styles.scrollStagger}`}>
              <div className={styles.problemIcon}>✕</div>
              <p>やっと見つけたキャストが予約完売してしまった</p>
            </div>
            <div className={`${styles.problemCard} ${styles.scrollStagger}`}>
              <div className={styles.problemIcon}>✕</div>
              <p>性癖、嗜好が合わずに遊びを断念した</p>
            </div>
          </div>

          <div className={styles.solutionBridge}>
            <div className={styles.solutionArrow}>↓</div>
          </div>

          <div className={styles.solutionCard}>
            <div className={styles.solutionHeader}>
              <h3 className={styles.solutionTitle}>
                <div>NUKUNEは、</div>
                <div>そんな悩みを解決する</div>
                <div><span className={styles.solutionHighlight}>&ldquo;性癖コンシェルジュ&rdquo;</span></div>
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
                  <p>今いる場所から、最短60分以内の空き枠がある優先キャストのみ表示しています</p>
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
                今までなかった<br />
                驚愕の検索サイト<br />
                <span className={styles.solutionBrand}>
                  <span style={{display: 'block', fontSize: '0.9em'}}>性癖コンシェルジュ</span>
                  <span style={{display: 'block'}}>NUKUNE< br />(ヌクネ)</span>
                </span>
              </p>
              <p style={{ marginTop: '20px', fontSize: '1.2rem', color: '#D4AF37', lineHeight: '1.5' }}>
                相手に求める理想のデータを<br />入力して<br />お試し検索してみよう！
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Matching Search Section */}
      <section id="matching" className={`${styles.section} ${styles.matchingSearch} ${styles.sectionSlideRight}`}>
        <div className={styles.container}>
          <div className={`${styles.scrollFadeIn} max-w-4xl mx-auto`}>
            <MatchingSearch />
          </div>
        </div>
      </section>

      {/* Reasons Section */}
      <section id="reasons" className={`${styles.section} ${styles.reasons} ${styles.sectionSlideLeft}`}>
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
                <span className={styles.reasonNew}>NUKUNE：AI分析により合致度の高い候補のみを優先表示</span>
              </p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>詳細プレイ確認</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：会うまで対応内容が不明確</span>
                <span className={styles.reasonNew}>NUKUNE：事前に全ての希望を確認・調整可能</span>
              </p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>リアルタイムマッチング</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：店舗の空き状況だけ確認</span>
                <span className={styles.reasonNew}>NUKUNE：今すぐ会える、相性の合う女性をリアルタイムでご案内</span>
              </p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>性癖完全対応</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：検索に時間がかかる</span>
                <span className={styles.reasonNew}>NUKUNE：あなたの容姿・性癖・嗜好に合うキャストをすぐに提案</span>
              </p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>検索から予約</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：情報検索に時間がかかる</span>
                <span className={styles.reasonNew}>NUKUNE：現在地・年齢・スタイル・性癖から、最短で検索＆予約まで完了</span>
              </p>
            </div>
            <div className={`${styles.reasonCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
              <h3 className={styles.reasonTitle}>匿名性の確保</h3>
              <p className={styles.reasonText}>
                <span className={styles.reasonOld}>従来：個人情報の登録が必須</span>
                <span className={styles.reasonNew}>NUKUNE：本人確認は運営のみ。他ユーザーには完全匿名で安心利用</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Start Guide Section */}
      <section id="guide" className={`${styles.section} ${styles.startGuide} ${styles.sectionSlideRight}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>
            今すぐNUKUNEを<br />無料体験！
            <br />
            簡単スタートガイド
          </h2>
          <div className={`${styles.guideContainer} ${styles.scrollScaleUp}`}>
            <div className={styles.guideHeader}>
              <span className={styles.guideBadge}>男性の方限定</span>
            </div>
            <div className={styles.stepsContainer}>
              <div className={`${styles.stepCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
                <h3 className={styles.stepTitle}>❶プロフィール設定について</h3>
                <div className={styles.stepDescription}>
                  <p>理想の出会いを探すなら、プロフィールは詳しく入力しましょう。<br />NUKUNEでは、以下の機能を活用できます。</p>
                  <div className={styles.stepPoints}>
                    <p className={styles.stepPoint}>⑴いいね・メモ機能で気になるキャストを自分だけで管理</p>
                    <p className={styles.stepPoint}>⑵気分に合わせてプロフィールを変更 → 新しいタイプを即提案</p>
                    <p className={styles.stepPoint}>⑶マッチ履歴や投稿機能で、自分だけの出会い記録を作成</p>
                  </div>
                  <p className={styles.stepEmphasis}>あなたのプロフィールが充実するほど、精度の高いマッチングが実現します。</p>
                </div>
              </div>

              <div className={`${styles.stepCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
                <h3 className={styles.stepTitle}>❷ 7日間お試しで検索してみる</h3>
                <div className={styles.stepDescription}>
                  <div className={styles.stepPoints}>
                    <p className={styles.stepPoint}>⑴まずは無料登録。</p>
                    <p className={styles.stepPoint}>⑵プロフィール（性癖・嗜好・相手に求める条件）を設定すると、位置情報と空き状況から、今すぐ会える条件に合うキャストだけを優先表示します。</p>
                    <p className={styles.stepPoint}>⑶NUKUNEは、いまだけ<span style={{ color: '#FF0000' }}>7日間お試し無料キャンペーン</span>実施中。</p>
                  </div>
                  <p>※R18／男性（18歳以上）のみ利用可です。</p>
                  <p>※キャンペーン期間（12/31）迄</p>
                  <p>※位置情報をOFFの方は、駅名・エリアを入力して検索できます。</p>
                  <p>※無料トライアル終了後は自動継続（¥1,980/月〜¥1,150/月から選択可）になります。いつでも解約可／初回請求日や解約方法は最終確認画面に表示します。</p>
                </div>
              </div>

              <div className={`${styles.stepCard} ${styles.scrollStagger} ${styles.enhancedHover}`}>
                <h3 className={styles.stepTitle}>❸ 気になるキャストがいたら？</h3>
                <div className={styles.stepDescription}>
                  <div className={styles.stepPoints}>
                    <p className={styles.stepPoint}><span style={{ color: '#D4AF37', fontWeight: 'bold' }}>「君に決めた」を押す</span><br />クリック後には提携サイトの予約画面へ移動します（全て無料にてご利用できます）。提携サイトにて、サービス料金・利用時間・日時などをご確認のうえ、そのまま店舗経由にてご予約いただき、サービスをご利用ください。予約承認後は「ナビ開始」にて目的地までご案内になります。</p>
                    <p className={styles.stepPoint}><span style={{ color: '#D4AF37', fontWeight: 'bold' }}>「メモ」を押す</span><br />気になる点をメモ保存。マイページのメモ から一覧できます。後で見返してそのまま予約へ。</p>
                    <p className={styles.stepPoint}><span style={{ color: '#D4AF37', fontWeight: 'bold' }}>「いいね」を押す</span><br />気になるキャストをキープ。マイページのいいね で管理し、タイミングが合えば即予約。</p>
                  </div>
                  <p>※提携先での予約・決済・キャンセルは提携サイトの規約に従ってください。</p>
                  <p>※安全のため、来店前に年齢確認・本人確認が必要な場合があります。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety Section */}
      <section id="safety" className={`${styles.section} ${styles.safety} ${styles.sectionSlideLeft}`}>
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
              <p className={styles.safetyDescription}>本人確認書類（18歳以上・高校生不可）の提出を必須としています。</p>
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
                  <MapPin />
                </div>
                <h3 className={styles.safetyTitle}>『今すぐ会える』<br />GPS検索</h3>
              </div>
              <p className={styles.safetyDescription}>位置情報サービスをオンにすると、現在地から最短ルートで今すぐ会えるキャストを表示します。
※プライバシーが気になる方は、駅名や地域を入力して検索することも可能です。</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className={`${styles.section} ${styles.faq} ${styles.sectionSlideRight}`}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>よくあるご質問</h2>
          <div className={styles.faqContainer}>
            {[
              {
                question: 'なぜ合致度の高い候補のみを優先表示できるのか？',
                answer: 'NUKUNEは、全国 15万人以上のキャストデータ（2025.09.01現在）を連携。\nさらに以下の仕組みで、高いマッチング精度を実現しています。\n 1. 豊富なデータベース\n　容姿・性癖・嗜好まで登録された国内最大級キャスト数。\n 2. 即時性のある検索\n　GPSで「今すぐ会える」キャストだけを優先表示。\n 3. 精密なマッチング\n　あなたの性癖や好みに基づいた絞り込みで、圧倒的な成約率を実現。'
              },
              {
                question: '風俗サイトとの違いは？',
                answer: '従来の風俗サイトは、写真やプロフィールだけで選ぶため\n「実際に会ったら違った…」となることも少なくありません。\n\nNUKUNEなら、GPS機能で今いる場所から検索でき、\nさらに性癖や好みに合わせて一発検索。\n検索から予約までスムーズに進み、最短で失敗しない出会いを実現します。'
              },
              {
                question: '料金について',
                answer: 'NUKUNEは、男性会員様向けに月額定額制の有料プランをご用意しています。\n追加料金はなく、安心してご利用いただけます。\n\nサービスをご利用いただくには、18歳以上（高校生不可）で、\nクレジットカード登録が必要です。\n対応ブランド：MasterCard／JCB／American Express／Diners Club'
              },
              {
                question: 'プライバシーは守られますか？',
                answer: 'はい。NUKUNEでは 完全匿名システム を採用しています。\nニックネームで利用でき、本名や個人情報が公開されることは一切ありません。\nまた、ご利用の際には プライバシーポリシー・利用規約への同意 を必須とし、安心・安全にサービスをご利用いただけます。'
              },
              {
                question: '安全性について',
                answer: 'NUKUNEは、有人監視（10:00–22:00）＋24時間AI監視 によるダブル体制で不正利用を防止。\n本人確認や通報機能など、多層的な安全対策を実施しています。\n\n法令を遵守し、安心してご利用いただける環境を提供しています。'
              },
              {
                question: 'どのような人が利用していますか？',
                answer: '「今夜は誰かに会いたい」「空いた時間を楽しみたい」──そんな気分の時に。\nNUKUNEなら、あなたの好みに合うキャストをすぐに見つけ、\nシンプルな手順で予約まで完結できます。\n多くの大人の男性に選ばれている、安心のマッチングサービスです。'
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
              完全定額制で追加料金なし。<br />
              <br />
              NUKUNEは月額料金だけで使える安心のマッチングサービス。<br />
              登録から検索・予約まですべてがワンストップで完結します。
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section - LUXE DATE Style */}
      <section id="pricing" className={`${styles.section} ${styles.pricing} ${styles.sectionSlideRight}`}>
        <div className={styles.container}>
          <div className={styles.pricingHeader}>
            <h2 className={`${styles.sectionTitle} ${styles.scrollFadeIn}`}>
              <span className={styles.titleLine1}>NUKUNE 利用料金</span>
              <span className={styles.titleLine2}>（男性会員様）</span>
            </h2>
            <p className={`${styles.pricingSubtitle} ${styles.scrollFadeIn}`}>
              NUKUNEは、登録無料でご利用いただけます。<br />
              さらに、あなたに合ったキャストを&ldquo;すぐに&rdquo;探せる「性癖マッチング検索」は、男性会員様限定の月額プランにてご提供しています。<br />
              安心して始められる無料登録から、目的に合わせて最適なプランをお選びください。
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
            <h2 className={`${styles.ctaTitle} ${styles.scrollFadeIn}`}>
              <span className={styles.ctaTitleLine1}>性癖、嗜好に</span>
              <span className={styles.ctaTitleLine2}>正直な出会いを</span>
            </h2>
            <p className={`${styles.ctaSubtitle} ${styles.scrollFadeIn}`}>
            今すぐ、NUKUNE(ヌクネ)に参加して、自分の理想とする素敵なキャストとの<br />出会いに踏み出しましょう
            </p>
            <Link 
              href="/signup" 
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleAgeConfirmation}
              style={{ padding: '1.2rem 2rem', fontSize: '18.4px', minWidth: '180px' }}
            >
              <Heart size={24} />
              今すぐ登録
            </Link>
          </div>
        </div>
      </section>

      {/* SNS Section */}
      <SNSSection />

      {/* Footer */}
      <Footer />
    </div>
  );
}