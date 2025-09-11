/**
 * @file プラン表示および料金ユーティリティ
 * @summary フロントエンドの料金表に基づくプラン名/月額料金/期間（月数）のマッピングを提供します。
 * @spec 主な仕様:
 * - プラン種別ごとの表示名・月額料金・期間（月数）を一元管理
 * - 旧データ（文字列）からのプラン推定（厳格なバリデーション）
 * @limits 制限事項:
 * - 料金はフロント側の定義に依存（バックエンドの異なる料金体系とは同期されない場合があります）
 */

import type { PlanType } from '@/types/subscription';

/**
 * @typedef {Object} PlanDisplay
 * @property {string} name - 日本語のプラン表示名
 * @property {number} monthlyPrice - 月額料金（税込）
 * @property {number} months - 契約月数（無料プランは 0）
 */
export interface PlanDisplay {
  /** 日本語のプラン表示名 */
  name: string;
  /** 月額料金（税込） */
  monthlyPrice: number;
  /** 契約月数（無料プランは 0） */
  months: number;
}

/**
 * @constant PLAN_PRICING_MAP
 * @type {Record<PlanType, PlanDisplay>}
 * @description プラン種別から表示情報へのマッピング
 */
export const PLAN_PRICING_MAP: Record<PlanType, PlanDisplay> = {
  free: { name: '無料プラン', monthlyPrice: 0, months: 0 },
  '1month': { name: '1ヶ月プラン', monthlyPrice: 1980, months: 1 },
  '3month': { name: '3ヶ月プラン', monthlyPrice: 1550, months: 3 },
  '6month': { name: '6ヶ月プラン', monthlyPrice: 1350, months: 6 },
  '12month': { name: '12ヶ月プラン', monthlyPrice: 1150, months: 12 }
};

/**
 * @function getPlanDisplayName
 * @description プラン種別から日本語のプラン名を取得します。
 * @param {PlanType} planType - プラン種別
 * @returns {string} 日本語のプラン名
 */
export function getPlanDisplayName(planType: PlanType): string {
  return PLAN_PRICING_MAP[planType]?.name ?? String(planType);
}

/**
 * @function getPlanMonthlyPrice
 * @description プラン種別から月額料金（税込）を取得します。
 * @param {PlanType} planType - プラン種別
 * @returns {number} 月額料金（税込）
 */
export function getPlanMonthlyPrice(planType: PlanType): number {
  return PLAN_PRICING_MAP[planType]?.monthlyPrice ?? 0;
}

/**
 * @function getPlanMonths
 * @description プラン種別から契約月数を取得します。
 * @param {PlanType} planType - プラン種別
 * @returns {number} 契約月数（無料プランは 0）
 */
export function getPlanMonths(planType: PlanType): number {
  return PLAN_PRICING_MAP[planType]?.months ?? 0;
}

/**
 * @function resolvePlanType
 * @description 旧データなどからプラン種別を推定して返します。未対応の値は null を返します。
 * @param {unknown} value - 任意の入力（例: '1month', '3month' など）
 * @returns {PlanType | null} 推定したプラン種別、該当なしの場合は null
 */
export function resolvePlanType(value: unknown): PlanType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'free':
      return 'free';
    case '1month':
    case 'one_month':
    case '1-month':
    case '1m':
      return '1month';
    case '3month':
    case 'three_month':
    case '3-month':
    case '3m':
      return '3month';
    case '6month':
    case 'six_month':
    case '6-month':
    case '6m':
      return '6month';
    case '12month':
    case 'twelve_month':
    case '12-month':
    case '12m':
      return '12month';
    default:
      return null;
  }
}


