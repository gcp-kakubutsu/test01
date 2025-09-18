import { cachedQuery } from './db-optimized';

type OptionCategoryKey =
  | 'recording'
  | 'cosplay'
  | 'toy'
  | 'deepthroat'
  | 'throating'
  | 'anal'
  | 'group';

type GirlTypeCategoryKey = 'sadist' | 'masochist';

interface OptionRow {
  id: number;
  name: string | null;
}

interface GirlTypeRow {
  id: number;
  name: string | null;
}

interface OptionCategoryCache {
  expires: number;
  data: Record<OptionCategoryKey, number[]>;
}

interface GirlTypeCache {
  expires: number;
  nameToId: Map<string, number>;
  categories: Record<GirlTypeCategoryKey, number[]>;
}

const OPTION_CATEGORY_PATTERNS: Record<OptionCategoryKey, RegExp[]> = {
  recording: [/(撮影|動画|写真|録画|録音|撮り)/i],
  cosplay: [/(コスプレ|衣装|制服|コスチューム|変装)/i],
  toy: [/(電マ|ローター|バイブ|玩具|おもちゃ|ディルド|トーイ|ウーマナイザー)/i],
  deepthroat: [/(イラマ|ディープスロート|喉奥|deep throat|deepthroat)/i],
  throating: [/(ごっくん|ゴックン|飲む|精飲|飲精|フェラ飲)/i],
  anal: [/(アナル|\baf\b|a\.f|肛門|後背位|バック挿入|尻プレイ)/i],
  group: [/(3p|３p|4p|４p|複数|グループ|トリプル|ダブル|乱交|3人|４人|ダブピ)/i]
};

const GIRL_TYPE_PATTERNS: Record<GirlTypeCategoryKey, RegExp[]> = {
  sadist: [/(ドs|どs|\bs女|\bs子|サド|女王|クイーン|S気質|M責め|SM責め)/i],
  masochist: [/(ドm|どm|マゾ|受け身|M気質|被虐|ピュアM|M属性)/i]
};

const OPTION_CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const GIRL_TYPE_CACHE_TTL = 1000 * 60 * 30;

let optionCategoryCache: OptionCategoryCache | null = null;
let girlTypeCache: GirlTypeCache | null = null;

function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\s　]+/g, '')
    .toLowerCase();
}

function categorizeOptionName(name: string | null): OptionCategoryKey[] {
  if (!name) return [];
  const normalized = normalizeText(name);
  const categories: OptionCategoryKey[] = [];
  (Object.entries(OPTION_CATEGORY_PATTERNS) as [OptionCategoryKey, RegExp[]][]).forEach(([key, patterns]) => {
    if (patterns.some(pattern => pattern.test(normalized))) {
      categories.push(key);
    }
  });
  return categories;
}

function categorizeGirlTypeName(name: string | null): GirlTypeCategoryKey[] {
  if (!name) return [];
  const normalized = normalizeText(name);
  const categories: GirlTypeCategoryKey[] = [];
  (Object.entries(GIRL_TYPE_PATTERNS) as [GirlTypeCategoryKey, RegExp[]][]).forEach(([key, patterns]) => {
    if (patterns.some(pattern => pattern.test(normalized))) {
      categories.push(key);
    }
  });
  return categories;
}

function uniquifyIds(ids: number[]): number[] {
  return Array.from(new Set(ids.filter(id => Number.isFinite(id))));
}

async function loadOptionCategoryIds(): Promise<Record<OptionCategoryKey, number[]>> {
  const rows = await cachedQuery<OptionRow>(
    'SELECT id, name FROM shop_options',
    [],
    'meta:shop-options',
    OPTION_CACHE_TTL
  );

  const categoryBuckets: Record<OptionCategoryKey, number[]> = {
    recording: [],
    cosplay: [],
    toy: [],
    deepthroat: [],
    throating: [],
    anal: [],
    group: []
  };

  rows.forEach(row => {
    categorizeOptionName(row.name).forEach(category => {
      categoryBuckets[category].push(row.id);
    });
  });

  (Object.keys(categoryBuckets) as OptionCategoryKey[]).forEach(key => {
    categoryBuckets[key] = uniquifyIds(categoryBuckets[key]);
  });

  return categoryBuckets;
}

async function getOptionCache(): Promise<OptionCategoryCache> {
  if (optionCategoryCache && optionCategoryCache.expires > Date.now()) {
    return optionCategoryCache;
  }

  const data = await loadOptionCategoryIds();
  optionCategoryCache = {
    data,
    expires: Date.now() + OPTION_CACHE_TTL
  };
  return optionCategoryCache;
}

async function loadGirlTypeCache(): Promise<GirlTypeCache> {
  const rows = await cachedQuery<GirlTypeRow>(
    'SELECT id, name FROM girl_types',
    [],
    'meta:girl-types',
    GIRL_TYPE_CACHE_TTL
  );

  const nameToId = new Map<string, number>();
  const categories: Record<GirlTypeCategoryKey, number[]> = {
    sadist: [],
    masochist: []
  };

  rows.forEach(row => {
    if (!row.name) return;
    const normalized = normalizeText(row.name);
    nameToId.set(normalized, row.id);
    nameToId.set(row.name.trim().toLowerCase(), row.id);
    const categoriesForName = categorizeGirlTypeName(row.name);
    categoriesForName.forEach(category => {
      categories[category].push(row.id);
    });
  });

  (Object.keys(categories) as GirlTypeCategoryKey[]).forEach(key => {
    categories[key] = uniquifyIds(categories[key]);
  });

  return {
    expires: Date.now() + GIRL_TYPE_CACHE_TTL,
    nameToId,
    categories
  };
}

async function getGirlTypeCache(): Promise<GirlTypeCache> {
  if (!girlTypeCache || girlTypeCache.expires <= Date.now()) {
    girlTypeCache = await loadGirlTypeCache();
  }
  return girlTypeCache;
}

export async function getOptionCategoryIds(): Promise<Record<OptionCategoryKey, number[]>> {
  const cache = await getOptionCache();
  return cache.data;
}

export async function resolveGirlTypeIdentifiers(identifiers: string[]): Promise<{ ids: number[]; unresolved: string[] }> {
  if (identifiers.length === 0) {
    return { ids: [], unresolved: [] };
  }

  const cache = await getGirlTypeCache();
  const ids = new Set<number>();
  const unresolved: string[] = [];

  identifiers.forEach(identifier => {
    const trimmed = identifier.trim();
    if (!trimmed) return;

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      ids.add(numeric);
      return;
    }

    const normalized = normalizeText(trimmed);
    const resolved = cache.nameToId.get(normalized);
    if (resolved !== undefined) {
      ids.add(resolved);
    } else {
      unresolved.push(trimmed);
    }
  });

  return {
    ids: Array.from(ids),
    unresolved
  };
}

export async function getGirlTypeCategoryIds(): Promise<Record<GirlTypeCategoryKey, number[]>> {
  const cache = await getGirlTypeCache();
  return cache.categories;
}
