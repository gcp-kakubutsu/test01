'use client';

import React from 'react';
import { Building, CheckCircle } from 'lucide-react';
import styles from './company.module.scss';

export default function CompanyPage() {
  return (
    <main className={styles.mainContent}>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>会社概要</h1>
        <p className={styles.pageSubtitle}>PEDIA株式会社について</p>
        
        <div className={styles.contentCard}>
          <div className={styles.companyHeader}>
            <h2 className={styles.companyName}>PEDIA株式会社</h2>
            <p className={styles.companyTagline}>
              風俗業界の情報提供で、より良い出会いの場を創造する
            </p>
          </div>

          <div className={styles.companyInfo}>
            <div className={styles.infoSection}>
              <h3 className={styles.infoTitle}>
                <Building size={20} />
                会社情報
              </h3>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>企業名</span>
                <span className={styles.infoValue}>PEDIA株式会社</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>所在地</span>
                <span className={styles.infoValue}>〒464-0075<br />愛知県名古屋市千種区<br />内山1丁目9番2号</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>メール</span>
                <span className={styles.infoValue}>info@nukune.com</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}></span>
                <span className={styles.infoValue}>インターネット異性紹介事業<br />(届出受理番号 54250003000)<br />愛知県公安委員会に<br />異性紹介事業届出及び受理済み</span>
              </div>
            </div>
          </div>

          <div className={styles.businessContent}>
            <h3>事業内容</h3>
            <ul className={styles.businessList}>
              <li>
                <CheckCircle size={16} />
                サイト名：NUKUNE（ヌクネ）
              </li>
              <li>
                <CheckCircle size={16} />
                運営者：NUKUNE運営事務局
              </li>
              <li>
                <CheckCircle size={16} />
                サービス内容：<br />性癖マッチングサービス<br />NUKUNEの運営
              </li>
              <li>
                <CheckCircle size={16} />
                連絡先：info@nukune.com
              </li>
            </ul>
          </div>

          <div className={styles.missionSection}>
            <h3 className={styles.missionTitle}>私たちのミッション</h3>
            <p className={styles.missionText}>
              PEDIA株式会社は、風俗業界における情報の透明性と安全性を重視し、
              利用者の皆様により良いサービスを提供することを目指しています。
              適切な情報提供を通じて、業界全体の健全な発展に貢献し、
              すべての関係者が安心して利用できる環境を構築してまいります。
            </p>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>2025</div>
              <div className={styles.statLabel}>設立年</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>100%</div>
              <div className={styles.statLabel}>法令遵守</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}