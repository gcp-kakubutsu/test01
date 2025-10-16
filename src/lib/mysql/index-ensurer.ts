import type mysql from 'mysql2/promise';

interface ColumnSpec {
  name: string;
  length?: number;
}

interface IndexSpec {
  table: string;
  name: string;
  columns: ColumnSpec[];
  type?: 'BTREE' | 'FULLTEXT';
  parser?: string;
  description?: string;
}

interface ColumnInfo {
  dataType: string;
  characterMaximumLength: number | null;
  columnType: string;
}

const REQUIRED_INDEXES: IndexSpec[] = [
  {
    table: 'girl_profiles',
    name: 'idx_girl_profiles_display_shop_age',
    columns: [
      { name: 'is_displayed' },
      { name: 'deleted_at' },
      { name: 'shop_profile_id' },
      { name: 'age' }
    ],
    description: '高速な公開済みキャスト一覧の抽出用'
  },
  {
    table: 'girl_profiles',
    name: 'idx_girl_profiles_shop_display_created',
    columns: [
      { name: 'shop_profile_id' },
      { name: 'is_displayed' },
      { name: 'deleted_at' },
      { name: 'created_at' }
    ],
    description: '新着順ソートのためのカバリングインデックス'
  },
  {
    table: 'shop_profiles',
    name: 'idx_shop_profiles_active_area',
    columns: [
      { name: 'is_active' },
      { name: 'deleted_at' },
      { name: 'area_prefecture_id' }
    ],
    description: '稼働店舗の都道府県フィルタ用'
  },
  {
    table: 'shop_profiles',
    name: 'idx_shop_profiles_area_municipality',
    columns: [
      { name: 'area_prefecture_id' },
      { name: 'area_prefectural_municipality_id' }
    ],
    description: '市区町村での検索最適化'
  },
  {
    table: 'shop_profiles',
    name: 'idx_shop_profiles_geo',
    columns: [
      { name: 'latitude' },
      { name: 'longitude' }
    ],
    description: '位置情報検索向けの緯度経度インデックス'
  },
  {
    table: 'girl_status',
    name: 'idx_girl_status_girl_type',
    columns: [
      { name: 'girl_profile_id' },
      { name: 'girl_types_id' }
    ],
    description: '女の子タイプのJOIN高速化'
  },
  {
    table: 'girl_status',
    name: 'idx_girl_status_type_girl',
    columns: [
      { name: 'girl_types_id' },
      { name: 'girl_profile_id' }
    ],
    description: '女の子タイプID指定時の抽出'
  },
  {
    table: 'girl_options',
    name: 'idx_girl_options_option_girl',
    columns: [
      { name: 'shop_option_id' },
      { name: 'girl_profile_id' }
    ],
    description: 'オプション種別→キャスト抽出用'
  },
  {
    table: 'girl_options',
    name: 'idx_girl_options_girl_option',
    columns: [
      { name: 'girl_profile_id' },
      { name: 'shop_option_id' }
    ],
    description: 'キャスト別オプション取得用'
  },
  {
    table: 'shop_options',
    name: 'idx_shop_options_shop_id',
    columns: [
      { name: 'shop_profile_id' },
      { name: 'id' }
    ],
    description: '店舗オプションの存在チェック用'
  },
  {
    table: 'shop_options',
    name: 'idx_shop_options_name_prefix',
    columns: [
      { name: 'name', length: 191 }
    ],
    description: '店舗オプション名の前方一致検索用'
  },
  {
    table: 'area_prefectures',
    name: 'idx_area_prefectures_name_prefix',
    columns: [
      { name: 'name', length: 64 }
    ],
    description: '都道府県名検索用'
  },
  {
    table: 'area_prefectural_municipalities',
    name: 'idx_area_municipalities_name_prefix',
    columns: [
      { name: 'name', length: 64 }
    ],
    description: '市区町村名検索用'
  },
  {
    table: 'girl_image_urls',
    name: 'idx_girl_image_urls_profile',
    columns: [
      { name: 'girl_profile_id' },
      { name: 'id' }
    ],
    description: '最初の画像取得の性能改善'
  },
  {
    table: 'girl_schedules',
    name: 'idx_girl_schedules_date_girl',
    columns: [
      { name: 'schedule_date' },
      { name: 'girl_profile_id' }
    ],
    description: '本日出勤フィルタの高速化'
  }
];

let ensureIndexesPromise: Promise<void> | null = null;

const columnMetadataCache = new Map<string, Map<string, ColumnInfo>>();

async function getColumnInfo(
  connection: mysql.PoolConnection,
  table: string,
  column: string
): Promise<ColumnInfo | undefined> {
  const normalizedTable = table.toLowerCase();
  let tableCache = columnMetadataCache.get(normalizedTable);
  if (!tableCache) {
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT column_name, data_type, character_maximum_length, column_type
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?`,
      [table]
    );
    tableCache = new Map<string, ColumnInfo>();
    for (const row of rows) {
      tableCache.set(String(row.COLUMN_NAME).toLowerCase(), {
        dataType: String(row.DATA_TYPE).toLowerCase(),
        characterMaximumLength:
          row.CHARACTER_MAXIMUM_LENGTH === null
            ? null
            : Number(row.CHARACTER_MAXIMUM_LENGTH),
        columnType: String(row.COLUMN_TYPE)
      });
    }
    columnMetadataCache.set(normalizedTable, tableCache);
  }
  return tableCache.get(column.toLowerCase());
}

async function createIndex(connection: mysql.PoolConnection, spec: IndexSpec) {
  const columnDefinitions: string[] = [];

  for (const column of spec.columns) {
    const columnName = column.name.includes('(')
      ? column.name
      : `\`${column.name}\``;
    let lengthClause = '';

    if (column.length && !column.name.includes('(')) {
      const info = await getColumnInfo(connection, spec.table, column.name);
      if (info) {
        const isStringType = [
          'char',
          'varchar',
          'tinytext',
          'text',
          'mediumtext',
          'longtext',
          'enum',
          'set',
          'nvarchar',
          'nchar'
        ].includes(info.dataType);
        if (isStringType) {
          if (info.characterMaximumLength && Number.isFinite(info.characterMaximumLength)) {
            const safeLength = Math.min(column.length, info.characterMaximumLength);
            lengthClause = safeLength > 0 ? `(${safeLength})` : '';
          } else if (info.dataType.includes('text')) {
            const safeLength = Math.min(column.length, 191);
            lengthClause = safeLength > 0 ? `(${safeLength})` : '';
          } else {
            lengthClause = `(${column.length})`;
          }
        }
      } else {
        lengthClause = `(${column.length})`;
      }
    }

    columnDefinitions.push(`${columnName}${lengthClause}`);
  }

  const columns = columnDefinitions.join(', ');

  const indexType = spec.type === 'FULLTEXT' ? 'FULLTEXT INDEX' : 'INDEX';
  const parserClause = spec.type === 'FULLTEXT' && spec.parser
    ? ` WITH PARSER ${spec.parser}`
    : '';
  const sql = `CREATE ${indexType} \`${spec.name}\` ON \`${spec.table}\` (${columns})${parserClause}`;
  await connection.query(sql);
}

async function indexExists(connection: mysql.PoolConnection, spec: IndexSpec) {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1`,
    [spec.table, spec.name]
  );
  return rows.length > 0;
}

export async function ensurePerformanceIndexes(pool: mysql.Pool): Promise<void> {
  if (ensureIndexesPromise) {
    return ensureIndexesPromise;
  }

  ensureIndexesPromise = (async () => {
    const connection = await pool.getConnection();
    try {
      for (const spec of REQUIRED_INDEXES) {
        try {
          const exists = await indexExists(connection, spec);
          if (!exists) {
            console.log(`⚙️  Creating index ${spec.name} (${spec.description || 'no description'})`);
            await createIndex(connection, spec);
          }
        } catch (error) {
          console.error(`⚠️  Failed to ensure index ${spec.name}:`, error);
        }
      }
    } finally {
      connection.release();
    }
  })();

  try {
    await ensureIndexesPromise;
  } catch (error) {
    console.error('⚠️  Failed to ensure performance indexes', error);
    ensureIndexesPromise = null;
  }
}
