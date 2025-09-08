import React from 'react';
import Image from 'next/image';
import styles from './SNSSection.module.scss';

export const SNSSection: React.FC = () => {
  return (
    <section className={styles.snsSection}>
      <div className={styles.container}>
        <h2 className={styles.title}>NUKUNE公式アカウント</h2>
        <div className={styles.iconsWrapper}>
          <a 
            href="https://www.instagram.com/nukune_official" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.iconLink}
            aria-label="Instagram"
          >
            <Image 
              src="/img/instagram-logo.png" 
              alt="Instagram" 
              width={80} 
              height={80}
              className={styles.icon}
            />
          </a>
          
          <a 
            href="https://x.com/nukune_official" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.iconLink}
            aria-label="X (Twitter)"
          >
            <div className={styles.xContainer}>
              <Image 
                src="/img/x-logo.png" 
                alt="X" 
                width={80} 
                height={80}
                className={styles.icon}
              />
            </div>
          </a>
          
          <a 
            href="https://www.tiktok.com/@nukune_official" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.iconLink}
            aria-label="TikTok"
          >
            <div className={styles.tiktokContainer}>
              <Image 
                src="/img/tiktok-logo.png" 
                alt="TikTok" 
                width={80} 
                height={80}
                className={styles.icon}
              />
            </div>
          </a>
          
          <a 
            href="https://www.youtube.com/channel/UCsMdYyKVDX54jvT2lWv0lCQ" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.iconLink}
            aria-label="YouTube"
          >
            <div className={styles.youtubeContainer}>
              <Image 
                src="/img/youtube-logo.png" 
                alt="YouTube" 
                width={80} 
                height={80}
                className={styles.icon}
              />
            </div>
          </a>
        </div>
      </div>
    </section>
  );
};