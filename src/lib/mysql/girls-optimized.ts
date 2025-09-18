import { cachedQuery, hasCacheKey } from './db-optimized';
import { MySQLGirlProfile } from './girls';
import { getOptionCategoryIds, getGirlTypeCategoryIds, resolveGirlTypeIdentifiers } from './metadata-cache';

/**
 * Optimized fetch with caching and parallel queries
 */
export async function fetchOptimizedGirls(
  limitCount: number = 200,
  offset: number = 0,
  area?: string | null,
  ageMin: number = 18,
  ageMax: number = 50,
  girlTypes?: string[] | null,
  girlId?: string | null,
  userLat?: number | null,
  userLng?: number | null,
  maxDistance?: number | null,
  recordingDuringPlay?: string | null,
  isSadist?: string | null,
  isMasochist?: string | null,
  partnerHeight?: string | null,
  partnerWeight?: string | null,
  partnerLocation?: string | null,
  cosplayPreference?: number | null,
  toyPlayPreference?: number | null,
  deepthroatPreference?: number | null,
  throatingPreference?: number | null,
  analPlayPreference?: number | null,
  groupPlayPreference?: number | null,
  preferredGirlTypeIds?: number[] | null,
  preferredBodyTypes?: string[] | null
): Promise<{ girls: MySQLGirlProfile[], total: number }> {
  // If girlId is specified, fetch only that specific girl
  if (girlId) {
    const girlQuery = `
      SELECT DISTINCT
        g.id,
        g.name,
        g.age,
        g.height,
        g.bust,
        g.waist,
        g.hip,
        g.cup,
        g.hobby,
        g.comment,
        g.shop_profile_id,
        g.is_displayed,
        s.name as shop_name,
        s.tel as shop_tel,
        s.latitude as shop_latitude,
        s.longitude as shop_longitude,
        IFNULL(p.name, '') as location,
        (
          SELECT GROUP_CONCAT(gt.name SEPARATOR ',')
          FROM girl_status gs
          INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
          WHERE gs.girl_profile_id = g.id
        ) as girl_types_json
      FROM girl_profiles g
      LEFT JOIN shop_profiles s ON g.shop_profile_id = s.id
      LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
      WHERE g.id = ?
      LIMIT 1
    `;
    
    const girlResult = await cachedQuery(girlQuery, [parseInt(girlId)], `girl:${girlId}`, 3600);
    
    if (girlResult.length === 0) {
      return { girls: [], total: 0 };
    }
    
    // Fetch images for this girl
    const imageQuery = `
      SELECT girl_profile_id, real_image_url, image_url
      FROM girl_image_urls
      WHERE girl_profile_id = ?
      ORDER BY id ASC
      LIMIT 10
    `;
    
    const images = await cachedQuery(imageQuery, [parseInt(girlId)], `girl_images:${girlId}`, 3600);
    
    const girl = girlResult[0];
    girl.images = images.filter((img: any) => img.girl_profile_id === girl.id);
    
    return { girls: [girl], total: 1 };
  }

  const [optionCategoryIds, girlTypeCategories] = await Promise.all([
    getOptionCategoryIds(),
    getGirlTypeCategoryIds()
  ]);

  // Generate cache key based on parameters
  const girlTypesStr = girlTypes ? girlTypes.sort().join(',') : '';
  const locationStr = userLat && userLng ? `${userLat.toFixed(2)}_${userLng.toFixed(2)}` : 'no_loc';
  const distStr = maxDistance ? `d${maxDistance}` : 'no_dist';
  const girlTypeStr = preferredGirlTypeIds ? preferredGirlTypeIds.sort().join(',') : '';
  const bodyTypeStr = preferredBodyTypes ? preferredBodyTypes.sort().join(',') : '';
  const hasLocationPreference = Boolean(partnerLocation && partnerLocation !== 'こだわらない');
  const normalizedPartnerLocation = hasLocationPreference ? partnerLocation!.trim() : null;
  const escapedPartnerLocation = normalizedPartnerLocation ? normalizedPartnerLocation.replace(/'/g, "''") : null;
  const partnerLocationKey = normalizedPartnerLocation ?? (partnerLocation ?? 'n');
  const userPrefsStr = `${recordingDuringPlay || 'n'}:${isSadist || 'n'}:${isMasochist || 'n'}:${partnerHeight || 'n'}:${partnerWeight || 'n'}:${partnerLocationKey}:${cosplayPreference || 0}:${toyPlayPreference || 0}:${deepthroatPreference || 0}:${throatingPreference || 0}:${analPlayPreference || 0}:${groupPlayPreference || 0}:${girlTypeStr}:${bodyTypeStr}`;
  const cacheKey = `girls:${limitCount}:${offset}:${area || 'all'}:${ageMin}:${ageMax}:${girlTypesStr}:${locationStr}:${distStr}:${userPrefsStr}`;
  const countCacheKey = `count:${area || 'all'}:${ageMin}:${ageMax}:${girlTypesStr}:${locationStr}:${distStr}:${userPrefsStr}`;
  
  if (hasLocationPreference && normalizedPartnerLocation) {
    console.log('📍 [MySQL] Partner location preference prioritized:', normalizedPartnerLocation);
  }
  
  // Build optimized WHERE clause
  let whereConditions = [
    'g.is_displayed = 1',
    'g.deleted_at IS NULL',
    's.is_active = 1',
    's.deleted_at IS NULL',
    `(g.age IS NULL OR g.age BETWEEN ${ageMin} AND ${ageMax})`
  ];
  
  if (area && area !== 'all') {
    const escapedArea = area.replace(/'/g, "''");
    console.log('🔍 Searching for area:', area);
    console.log('🔍 Age range:', ageMin, '-', ageMax);
    console.log('🔍 Limit:', limitCount, 'Offset:', offset);
    
    // エリア名の正規化（都道府県名のみの場合と市区町村を含む場合に対応）
    const areaConditions = [];
    
    // 都道府県名の完全一致
    areaConditions.push(`p.name = '${escapedArea}'`);
    
    // 市区町村名での検索を追加
    areaConditions.push(`m.name = '${escapedArea}'`);
    
    // 都府県の接尾辞を柔軟に処理
    const suffixPattern = /[都府県]$/;
    if (suffixPattern.test(escapedArea)) {
      // 接尾辞を除いた形でも検索
      const withoutSuffix = escapedArea.replace(suffixPattern, '');
      areaConditions.push(`p.name LIKE '${withoutSuffix}%'`);
      // 接尾辞なしの完全一致も追加
      areaConditions.push(`p.name = '${withoutSuffix}'`);
    } else if (!escapedArea.match(/[区市町村]$/)) {
      // 市区町村の接尾辞がない、かつ都道府県の接尾辞もない場合のみ
      areaConditions.push(`p.name LIKE '${escapedArea}%'`);
      areaConditions.push(`p.name = '${escapedArea}都'`);
      areaConditions.push(`p.name = '${escapedArea}府'`);
      areaConditions.push(`p.name = '${escapedArea}県'`);
    }
    
    whereConditions.push(
      `(${areaConditions.join(' OR ')})`
    );
  }
  
  // Add girl types filtering if specified
  let girlTypesJoin = '';
  if (girlTypes && girlTypes.length > 0) {
    const { ids: resolvedGirlTypeIds, unresolved } = await resolveGirlTypeIdentifiers(girlTypes);
    const conditions: string[] = [];
    if (resolvedGirlTypeIds.length > 0) {
      conditions.push(`girl_status.girl_types_id IN (${resolvedGirlTypeIds.join(',')})`);
    }
    if (unresolved.length > 0) {
      const escapedNames = unresolved.map(name => `'${name.replace(/'/g, "''")}'`).join(',');
      conditions.push(`gt.name IN (${escapedNames})`);
    }

    if (conditions.length > 0) {
      const joinedSource = unresolved.length > 0
        ? `FROM girl_status
          INNER JOIN girl_types gt ON girl_status.girl_types_id = gt.id`
        : 'FROM girl_status';

      girlTypesJoin = `
        INNER JOIN (
          SELECT DISTINCT girl_status.girl_profile_id
          ${joinedSource}
          WHERE ${conditions.join(' OR ')}
        ) girl_type_filter ON g.id = girl_type_filter.girl_profile_id
      `;

      if (unresolved.length > 0) {
        console.warn('⚠️  未解決の女の子タイプ名が存在します:', unresolved);
      }
    }
  }
  
  // Add distance filtering if max distance specified
  if (maxDistance && userLat && userLng) {
    whereConditions.push(
      `(
        s.latitude IS NULL OR s.longitude IS NULL
        OR ST_Distance_Sphere(POINT(s.longitude, s.latitude), POINT(${userLng}, ${userLat})) / 1000 <= ${maxDistance}
      )`
    );
  }
  
  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
  
  // Build preference scoring query parts
  let preferenceScoreSelect = '';
  let preferenceJoins = '';
  let scoreComponents: string[] = [];
  let locationPrioritySelect = '';
  
  // 撮影オプションのスコア
  if (recordingDuringPlay === 'はい') {
    const optionIds = optionCategoryIds.recording;
    if (optionIds.length > 0) {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          WHERE go.shop_option_id IN (${optionIds.join(',')})
        ) recording_opt ON g.id = recording_opt.girl_profile_id`;
      scoreComponents.push(`CASE WHEN recording_opt.girl_profile_id IS NOT NULL THEN 30 ELSE 0 END`);
    } else {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          INNER JOIN shop_options so ON go.shop_option_id = so.id
          WHERE so.name LIKE '%撮影%' OR so.name LIKE '%動画%' OR so.name LIKE '%写真%'
        ) recording_opt ON g.id = recording_opt.girl_profile_id`;
      scoreComponents.push(`CASE WHEN recording_opt.girl_profile_id IS NOT NULL THEN 30 ELSE 0 END`);
    }
  }
  
  // コスプレオプションのスコア（嗜好レベル4以上の場合）
  if (cosplayPreference && cosplayPreference >= 4) {
    const optionIds = optionCategoryIds.cosplay;
    if (optionIds.length > 0) {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          WHERE go.shop_option_id IN (${optionIds.join(',')})
        ) cosplay_opt ON g.id = cosplay_opt.girl_profile_id`;
    } else {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          INNER JOIN shop_options so ON go.shop_option_id = so.id
          WHERE so.name LIKE '%コスプレ%' OR so.name LIKE '%衣装%' OR so.name LIKE '%制服%'
        ) cosplay_opt ON g.id = cosplay_opt.girl_profile_id`;
    }
    // 嗜好レベルに応じてスコアを調整（レベル4:20点、レベル5:30点）
    const cosplayScore = cosplayPreference === 5 ? 30 : 20;
    scoreComponents.push(`CASE WHEN cosplay_opt.girl_profile_id IS NOT NULL THEN ${cosplayScore} ELSE 0 END`);
  }
  
  // おもちゃオプションのスコア（嗜好レベル4以上の場合）
  if (toyPlayPreference && toyPlayPreference >= 4) {
    const optionIds = optionCategoryIds.toy;
    if (optionIds.length > 0) {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          WHERE go.shop_option_id IN (${optionIds.join(',')})
        ) toy_opt ON g.id = toy_opt.girl_profile_id`;
    } else {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          INNER JOIN shop_options so ON go.shop_option_id = so.id
          WHERE so.name LIKE '%電マ%' OR so.name LIKE '%ローター%' OR so.name LIKE '%バイブ%' 
             OR so.name LIKE '%おもちゃ%' OR so.name LIKE '%玩具%'
        ) toy_opt ON g.id = toy_opt.girl_profile_id`;
    }
    // 嗜好レベルに応じてスコアを調整（レベル4:20点、レベル5:30点）
    const toyScore = toyPlayPreference === 5 ? 30 : 20;
    scoreComponents.push(`CASE WHEN toy_opt.girl_profile_id IS NOT NULL THEN ${toyScore} ELSE 0 END`);
  }
  
  // イラマチオオプションのスコア（嗜好レベル4以上の場合）
  if (deepthroatPreference && deepthroatPreference >= 4) {
    const optionIds = optionCategoryIds.deepthroat;
    if (optionIds.length > 0) {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          WHERE go.shop_option_id IN (${optionIds.join(',')})
        ) deepthroat_opt ON g.id = deepthroat_opt.girl_profile_id`;
    } else {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          INNER JOIN shop_options so ON go.shop_option_id = so.id
          WHERE so.name LIKE '%イラマ%' OR so.name LIKE '%ディープスロート%' OR so.name LIKE '%喉奥%'
             OR so.name LIKE '%深い%' OR so.name LIKE '%ディープ%'
        ) deepthroat_opt ON g.id = deepthroat_opt.girl_profile_id`;
    }
    // 嗜好レベルに応じてスコアを調整（レベル4:20点、レベル5:30点）
    const deepthroatScore = deepthroatPreference === 5 ? 30 : 20;
    scoreComponents.push(`CASE WHEN deepthroat_opt.girl_profile_id IS NOT NULL THEN ${deepthroatScore} ELSE 0 END`);
  }
  
  // ごっくんオプションのスコア（嗜好レベル4以上の場合）
  if (throatingPreference && throatingPreference >= 4) {
    const optionIds = optionCategoryIds.throating;
    if (optionIds.length > 0) {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          WHERE go.shop_option_id IN (${optionIds.join(',')})
        ) throating_opt ON g.id = throating_opt.girl_profile_id`;
    } else {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          INNER JOIN shop_options so ON go.shop_option_id = so.id
          WHERE so.name LIKE '%ごっくん%' OR so.name LIKE '%ゴックン%' OR so.name LIKE '%飲む%'
             OR so.name LIKE '%口内発射%' OR so.name LIKE '%精飲%'
        ) throating_opt ON g.id = throating_opt.girl_profile_id`;
    }
    // 嗜好レベルに応じてスコアを調整（レベル4:20点、レベル5:30点）
    const throatingScore = throatingPreference === 5 ? 30 : 20;
    scoreComponents.push(`CASE WHEN throating_opt.girl_profile_id IS NOT NULL THEN ${throatingScore} ELSE 0 END`);
  }
  
  // アナルプレイオプションのスコア（嗜好レベル4以上の場合）
  if (analPlayPreference && analPlayPreference >= 4) {
    const optionIds = optionCategoryIds.anal;
    if (optionIds.length > 0) {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          WHERE go.shop_option_id IN (${optionIds.join(',')})
        ) anal_opt ON g.id = anal_opt.girl_profile_id`;
    } else {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT go.girl_profile_id
          FROM girl_options go
          INNER JOIN shop_options so ON go.shop_option_id = so.id
          WHERE so.name LIKE '%アナル%' OR so.name LIKE '%AF%' OR so.name LIKE '%A.F%'
             OR so.name LIKE '%肛門%' OR so.name LIKE '%お尻%'
        ) anal_opt ON g.id = anal_opt.girl_profile_id`;
    }
    // 嗜好レベルに応じてスコアを調整（レベル4:20点、レベル5:30点）
    const analScore = analPlayPreference === 5 ? 30 : 20;
    scoreComponents.push(`CASE WHEN anal_opt.girl_profile_id IS NOT NULL THEN ${analScore} ELSE 0 END`);
  }
  
  // 複数人プレイオプションのスコア（嗜好レベル4以上の場合）
  if (groupPlayPreference && groupPlayPreference >= 4) {
    const optionIds = optionCategoryIds.group;
    if (optionIds.length > 0) {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT so.shop_profile_id AS shop_id
          FROM shop_options so
          WHERE so.id IN (${optionIds.join(',')})
        ) group_shop ON s.id = group_shop.shop_id`;
    } else {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT s.id as shop_id
          FROM shop_profiles s
          INNER JOIN shop_options so ON so.shop_profile_id = s.id
          WHERE so.name LIKE '%3P%' OR so.name LIKE '%4P%' OR so.name LIKE '%複数%'
             OR so.name LIKE '%グループ%' OR so.name LIKE '%多人数%'
        ) group_shop ON s.id = group_shop.shop_id`;
    }
    // 嗜好レベルに応じてスコアを調整（レベル4:20点、レベル5:30点）
    const groupScore = groupPlayPreference === 5 ? 30 : 20;
    scoreComponents.push(`CASE WHEN group_shop.shop_id IS NOT NULL THEN ${groupScore} ELSE 0 END`);
  }
  
  // 女の子タイプのスコア（選択されたタイプとのマッチング）
  if (preferredGirlTypeIds && preferredGirlTypeIds.length > 0) {
    // 各タイプごとにスコアリング（複数マッチでボーナス）
    const girlTypeIdStr = preferredGirlTypeIds.join(',');
    preferenceJoins += `
      LEFT JOIN (
        SELECT girl_profile_id,
               COUNT(DISTINCT girl_types_id) as match_count
        FROM girl_status
        WHERE girl_types_id IN (${girlTypeIdStr})
        GROUP BY girl_profile_id
      ) girl_type_match ON g.id = girl_type_match.girl_profile_id`;
    
    // マッチした数に応じてスコアを付与（1つで50点、2つで80点、3つ以上で100点）
    scoreComponents.push(`
      CASE 
        WHEN girl_type_match.match_count >= 3 THEN 100
        WHEN girl_type_match.match_count = 2 THEN 80
        WHEN girl_type_match.match_count = 1 THEN 50
        ELSE 0
      END`);
  }
  
  // 相手の体型のスコア（簡略化版でパフォーマンス改善）
  if (preferredBodyTypes && preferredBodyTypes.length > 0 && !preferredBodyTypes.includes('こだわらない')) {
    // グラマー・巨乳好きの場合
    if (preferredBodyTypes.some(type => ['グラマー', '巨乳'].includes(type))) {
      scoreComponents.push(`
        CASE 
          WHEN g.cup IN ('E','F','G','H','I','J','K') THEN 40
          WHEN g.cup = 'D' THEN 20
          ELSE 0
        END`);
    }
    // ぽっちゃり系好きの場合
    else if (preferredBodyTypes.some(type => ['ぽっちゃり', 'ややぽっちゃり', 'やややっちゃり'].includes(type))) {
      scoreComponents.push(`
        CASE 
          WHEN g.weight > 55 THEN 40
          WHEN g.weight > 50 THEN 20
          ELSE 0
        END`);
    }
    // スリム系好きの場合
    else if (preferredBodyTypes.some(type => ['スリム', '細め', 'やや細め'].includes(type))) {
      scoreComponents.push(`
        CASE 
          WHEN g.weight < 50 THEN 40
          WHEN g.weight < 55 THEN 20
          ELSE 0
        END`);
    }
  }
  
  // S/Mマッチング
  if (isSadist === 'はい') {
    const masochistIds = girlTypeCategories.masochist;
    if (masochistIds.length > 0) {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT gs.girl_profile_id
          FROM girl_status gs
          WHERE gs.girl_types_id IN (${masochistIds.join(',')})
        ) m_girls ON g.id = m_girls.girl_profile_id`;
    } else {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT gs.girl_profile_id
          FROM girl_status gs
          INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
          WHERE gt.name LIKE '%ドM%' OR gt.name LIKE '%M%'
        ) m_girls ON g.id = m_girls.girl_profile_id`;
    }
    scoreComponents.push(`CASE WHEN m_girls.girl_profile_id IS NOT NULL THEN 50 ELSE 0 END`);
  } else if (isMasochist === 'はい') {
    // ユーザーがMの場合、ドSの女性を探す
    const sadistIds = girlTypeCategories.sadist;
    if (sadistIds.length > 0) {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT gs.girl_profile_id
          FROM girl_status gs
          WHERE gs.girl_types_id IN (${sadistIds.join(',')})
        ) s_girls ON g.id = s_girls.girl_profile_id`;
    } else {
      preferenceJoins += `
        LEFT JOIN (
          SELECT DISTINCT gs.girl_profile_id
          FROM girl_status gs
          INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
          WHERE gt.name LIKE '%ドS%' OR gt.name LIKE '%S%'
        ) s_girls ON g.id = s_girls.girl_profile_id`;
    }
    scoreComponents.push(`CASE WHEN s_girls.girl_profile_id IS NOT NULL THEN 50 ELSE 0 END`);
  }
  
  // 年齢スコア (年齢が範囲内なら20点、範囲から5歳以内なら10点)
  scoreComponents.push(`
    CASE 
      WHEN g.age IS NULL THEN 0
      WHEN g.age BETWEEN ${ageMin} AND ${ageMax} THEN 20
      WHEN g.age >= ${ageMin - 5} AND g.age <= ${ageMax + 5} THEN 10
      ELSE 0
    END`);
  
  // 身長スコア
  if (partnerHeight && partnerHeight !== 'こだわらない') {
    const heightMatch = partnerHeight.match(/(\d+).*[～~-].*(\d+)/);
    if (heightMatch) {
      const minHeight = parseInt(heightMatch[1]);
      const maxHeight = parseInt(heightMatch[2]);
      scoreComponents.push(`
        CASE 
          WHEN g.height BETWEEN ${minHeight} AND ${maxHeight} THEN 15
          WHEN ABS(g.height - ${minHeight}) <= 10 OR ABS(g.height - ${maxHeight}) <= 10 THEN 7
          ELSE 0
        END`);
    }
  }
  
  // 体重スコア
  if (partnerWeight && partnerWeight !== 'こだわらない') {
    if (partnerWeight.includes('以下')) {
      const match = partnerWeight.match(/(\d+)kg以下/);
      if (match) {
        const maxWeight = parseInt(match[1]);
        scoreComponents.push(`
          CASE 
            WHEN g.weight <= ${maxWeight} THEN 15
            WHEN g.weight <= ${maxWeight + 5} THEN 7
            ELSE 0
          END`);
      }
    } else if (partnerWeight.includes('以上')) {
      const match = partnerWeight.match(/(\d+)kg以上/);
      if (match) {
        const minWeight = parseInt(match[1]);
        scoreComponents.push(`
          CASE 
            WHEN g.weight >= ${minWeight} THEN 15
            WHEN g.weight >= ${minWeight - 5} THEN 7
            ELSE 0
          END`);
      }
    } else {
      const match = partnerWeight.match(/(\d+).*[～~-].*(\d+)/);
      if (match) {
        const minWeight = parseInt(match[1]);
        const maxWeight = parseInt(match[2]);
        scoreComponents.push(`
          CASE 
            WHEN g.weight BETWEEN ${minWeight} AND ${maxWeight} THEN 15
            WHEN ABS(g.weight - ${minWeight}) <= 5 OR ABS(g.weight - ${maxWeight}) <= 5 THEN 7
            ELSE 0
          END`);
      }
    }
  }
  
  // 居住地スコア
  if (hasLocationPreference && escapedPartnerLocation) {
    scoreComponents.push(`
      CASE 
        WHEN p.name = '${escapedPartnerLocation}' OR m.name = '${escapedPartnerLocation}' THEN 25
        WHEN p.name LIKE '%${escapedPartnerLocation}%' OR m.name LIKE '%${escapedPartnerLocation}%' OR '${escapedPartnerLocation}' LIKE CONCAT('%', p.name, '%') OR '${escapedPartnerLocation}' LIKE CONCAT('%', m.name, '%') THEN 15
        ELSE 0
      END`);
    locationPrioritySelect = `,
      CASE 
        WHEN p.name = '${escapedPartnerLocation}' OR m.name = '${escapedPartnerLocation}' THEN 0
        WHEN p.name LIKE '${escapedPartnerLocation}%' OR m.name LIKE '${escapedPartnerLocation}%' THEN 1
        WHEN p.name LIKE '%${escapedPartnerLocation}%' OR m.name LIKE '%${escapedPartnerLocation}%' THEN 2
        ELSE 3
      END as location_priority`;
  }
  
  // スコア計算のSELECT句を構築
  if (scoreComponents.length > 0) {
    preferenceScoreSelect = `, (${scoreComponents.join(' + ')}) as preference_score`;
  } else {
    preferenceScoreSelect = ', 0 as preference_score';
  }
  
  // Distance calculation and order by clause
  let distanceSelect = '';
  let areaJoin = '';
  let orderByClause = 'ORDER BY (g.age IS NULL), g.created_at DESC';
  const locationOrderPrefixInline = hasLocationPreference ? 'location_priority ASC, ' : '';
  const locationOrderPrefixMultiline = hasLocationPreference ? 'location_priority ASC,\n      ' : '';
  
  if (userLat && userLng) {
    // area_smallsテーブルから位置情報を取得するJOINを追加
    areaJoin = `
      LEFT JOIN (
        SELECT area_prefecture_id, 
               AVG(latitude) as area_lat, 
               AVG(longitude) as area_lng,
               MIN(ST_Distance_Sphere(
                 POINT(longitude, latitude), 
                 POINT(${userLng}, ${userLat})
               ) / 1000) as min_distance_km
        FROM area_smalls
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        GROUP BY area_prefecture_id
      ) area_loc ON s.area_prefecture_id = area_loc.area_prefecture_id`;
    
    // 位置情報がある場合は距離計算を追加
    distanceSelect = `,
      CASE 
        WHEN s.latitude IS NOT NULL AND s.longitude IS NOT NULL 
        THEN ST_Distance_Sphere(POINT(s.longitude, s.latitude), POINT(${userLng}, ${userLat})) / 1000
        WHEN area_loc.area_lat IS NOT NULL AND area_loc.area_lng IS NOT NULL
        THEN ST_Distance_Sphere(POINT(area_loc.area_lng, area_loc.area_lat), POINT(${userLng}, ${userLat})) / 1000
        ELSE 999999
      END as distance_km,
      -- より簡潔な最短距離を使用
      COALESCE(area_loc.min_distance_km, 999999) as area_min_distance`;
  }
  
  // スコアと距離の複合ソート（近い女の子を絶対優先）
  if (scoreComponents.length > 0 && userLat) {
    orderByClause = `ORDER BY 
      ${locationOrderPrefixMultiline}-- 距離帯による絶対的な優先順位
      CASE 
        WHEN distance_km <= 20 THEN 1    -- 20km以内: 最優先
        WHEN distance_km <= 50 THEN 2    -- 50km以内: 次優先  
        WHEN distance_km <= 100 THEN 3   -- 100km以内: 3番目
        WHEN distance_km <= 200 THEN 4   -- 200km以内: 4番目
        ELSE 5                            -- それ以上: 最後
      END ASC,
      -- 同じ距離帯内でのソート（スコアと距離のバランス）
      CASE 
        WHEN distance_km <= 20 THEN (distance_km * 10) - (preference_score * 2)    -- スコアの影響大
        WHEN distance_km <= 50 THEN (distance_km * 20) - preference_score          -- スコアの影響中
        WHEN distance_km <= 100 THEN (distance_km * 50) - (preference_score * 0.5) -- スコアの影響小
        ELSE distance_km * 100                                                      -- スコア無視
      END ASC,
      g.created_at DESC`;
  } else if (userLat) {
    // 位置情報のみの場合は距離優先
    orderByClause = `ORDER BY ${locationOrderPrefixInline}distance_km ASC, g.created_at DESC`;
  } else if (scoreComponents.length > 0) {
    orderByClause = `ORDER BY ${locationOrderPrefixInline}preference_score DESC, g.created_at DESC`;
  } else if (hasLocationPreference) {
    orderByClause = `ORDER BY location_priority ASC, g.created_at DESC`;
  }
  
  // Optimized query with distance calculation
  const girlsQuery = `
    SELECT STRAIGHT_JOIN
      g.id,
      g.name,
      g.age,
      g.height,
      g.weight,
      g.bust,
      g.cup,
      g.waist,
      g.hip,
      g.is_sake,
      g.is_tobacco,
      IFNULL(COALESCE(g.comment, g.catch_copy), '') as bio,
      IFNULL(g.hobby, '') as hobby,
      s.id as shop_id,
      s.name as shop_name,
      s.latitude,
      s.longitude,
      IFNULL(p.name, '') as location,
      IFNULL(m.name, '') as municipality,
      (
        SELECT gi.image_url 
        FROM girl_image_urls gi 
        WHERE gi.girl_profile_id = g.id 
        ORDER BY gi.id ASC
        LIMIT 1
      ) as imageUrl,
      (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', gt.id, 'name', gt.name))
        FROM girl_status gs
        INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
        WHERE gs.girl_profile_id = g.id
      ) as girl_types_json
      ${distanceSelect}
      ${preferenceScoreSelect}
      ${locationPrioritySelect}
    FROM girl_profiles g
    INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
    ${girlTypesJoin}
    ${preferenceJoins}
    LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
    LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id
    ${areaJoin}
    ${whereClause}
    ${orderByClause}
    LIMIT ${limitCount} OFFSET ${offset}
  `;
  
  // Count query (simplified)
  const countQuery = `
    SELECT COUNT(*) as total
    FROM girl_profiles g
    INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
    ${girlTypesJoin}
    ${area && area !== 'all' ? 'LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id' : ''}
    ${area && area !== 'all' ? 'LEFT JOIN area_prefectural_municipalities m ON s.area_prefectural_municipality_id = m.id' : ''}
    ${whereClause}
  `;
  
  // Debug: サーバー側でスコアリング状況を出力
  if (scoreComponents.length > 0) {
    console.log('🎯 [MySQL] Scoring enabled with', scoreComponents.length, 'components');
    console.log('📍 [MySQL] Location:', userLat ? `${userLat}, ${userLng}` : 'No location');
    console.log('⚙️ [MySQL] Preferences:', {
      girlTypes: preferredGirlTypeIds?.length || 0,
      bodyTypes: preferredBodyTypes?.length || 0,
      location: partnerLocation || 'none'
    });
  }
  
  // Execute both queries in parallel with caching
  // モバイルの場合はキャッシュTTLを短くする
  const isMobileRequest = limitCount === 1000 && area && area.includes('都');
  const girlsCacheTTL = isMobileRequest ? 30000 : 60000; // モバイルは30秒、PCは1分
  const countCacheTTL = isMobileRequest ? 60000 : 300000; // モバイルは1分、PCは5分
  
  const [girlsResult, countResult] = await Promise.all([
    cachedQuery<any>(girlsQuery, [], cacheKey, girlsCacheTTL),
    cachedQuery<any>(countQuery, [], countCacheKey, countCacheTTL)
  ]);
  
  console.log(`📊 Area: ${area}, Found: ${girlsResult.length} girls, Total: ${countResult[0]?.total || 0}`);
  
  // デバッグ: 最初の3人のスコアを表示
  if (girlsResult.length > 0 && scoreComponents.length > 0) {
    console.log('🎯 Top 3 girls with scores:');
    girlsResult.slice(0, 3).forEach((girl: any, idx: number) => {
      console.log(`  ${idx + 1}. ${girl.name}: score=${girl.preference_score || 0}, distance=${girl.distance_km?.toFixed(1) || 'N/A'}km`);
    });
  }
  
  // Process results
  const girls: MySQLGirlProfile[] = girlsResult.map(row => ({
    id: row.id.toString(),
    name: row.name || 'Unknown',
    age: row.age || null,
    height: row.height || undefined,
    bust: row.bust || undefined,
    cup: row.cup || undefined,
    waist: row.waist || undefined,
    hip: row.hip || undefined,
    location: row.location,
    municipality: row.municipality || undefined,
    bio: row.bio || '',
    interests: parseInterests(row.hobby || ''),
    imageUrl: row.imageUrl || '/img/noimage.jpg',
    bodyType: undefined,
    style: undefined,
    isOnline: Math.random() > 0.7,
    lastActive: new Date().toISOString(),
    is_sake: row.is_sake === 1 || row.is_sake === true,
    is_tobacco: row.is_tobacco === 1 || row.is_tobacco === true,
    shopName: row.shop_name,
    shopId: row.shop_id,
    // Shop object for distance calculation
    shop: {
      id: row.shop_id,
      name: row.shop_name,
      latitude: row.latitude,
      longitude: row.longitude
    },
    // 計算済みの距離を追加
    distance_km: row.distance_km || undefined,
    // Girl types from girl_status table (parse JSON if string, otherwise use as-is)
    girlTypes: (() => {
      if (!row.girl_types_json) return [];
      // MySQLのJSON型は自動的にパースされることがある
      if (typeof row.girl_types_json === 'string') {
        try {
          return JSON.parse(row.girl_types_json);
        } catch (e) {
          console.error('Failed to parse girl_types_json:', row.girl_types_json);
          return [];
        }
      }
      // 既にオブジェクト/配列の場合はそのまま使用
      return Array.isArray(row.girl_types_json) ? row.girl_types_json : [];
    })()
  }));
  
  const total = countResult[0]?.total || 0;
  
  return { girls, total };
}

/**
 * Prefetch next page for instant loading
 */
export async function prefetchNextPage(
  currentOffset: number,
  limitCount: number = 200,
  area?: string | null,
  ageMin: number = 18,
  ageMax: number = 50,
  girlTypes?: string[] | null,
  girlId?: string | null,
  userLat?: number | null,
  userLng?: number | null,
  maxDistance?: number | null,
  recordingDuringPlay?: string | null,
  isSadist?: string | null,
  isMasochist?: string | null,
  partnerHeight?: string | null,
  partnerWeight?: string | null,
  partnerLocation?: string | null,
  cosplayPreference?: number | null,
  toyPlayPreference?: number | null,
  deepthroatPreference?: number | null,
  throatingPreference?: number | null,
  analPlayPreference?: number | null,
  groupPlayPreference?: number | null,
  preferredGirlTypeIds?: number[] | null,
  preferredBodyTypes?: string[] | null
): Promise<void> {
  // Don't prefetch if fetching specific girl
  if (girlId) return;
  const nextOffset = currentOffset + limitCount;
  const girlTypesStr = girlTypes ? girlTypes.sort().join(',') : '';
  const locationStr = userLat && userLng ? `${userLat.toFixed(2)}_${userLng.toFixed(2)}` : 'no_loc';
  const distStr = maxDistance ? `d${maxDistance}` : 'no_dist';
  const girlTypeStr = preferredGirlTypeIds ? preferredGirlTypeIds.sort().join(',') : '';
  const bodyTypeStr = preferredBodyTypes ? preferredBodyTypes.sort().join(',') : '';
  const userPrefsStr = `${recordingDuringPlay || 'n'}:${isSadist || 'n'}:${isMasochist || 'n'}:${partnerHeight || 'n'}:${partnerWeight || 'n'}:${partnerLocation || 'n'}:${cosplayPreference || 0}:${toyPlayPreference || 0}:${deepthroatPreference || 0}:${throatingPreference || 0}:${analPlayPreference || 0}:${groupPlayPreference || 0}:${girlTypeStr}:${bodyTypeStr}`;
  const cacheKey = `girls:${limitCount}:${nextOffset}:${area || 'all'}:${ageMin}:${ageMax}:${girlTypesStr}:${locationStr}:${distStr}:${userPrefsStr}`;
  
  // Check if already cached
  if (!hasCacheKey(cacheKey)) {
    setTimeout(() => {
      fetchOptimizedGirls(limitCount, nextOffset, area, ageMin, ageMax, girlTypes, null, userLat, userLng, maxDistance, recordingDuringPlay, isSadist, isMasochist, partnerHeight, partnerWeight, partnerLocation, cosplayPreference, toyPlayPreference, deepthroatPreference, throatingPreference, analPlayPreference, groupPlayPreference, preferredGirlTypeIds, preferredBodyTypes)
        .catch(error => console.error('⚠️  Failed to prefetch next page:', error));
    }, 100);
  }
}

/**
 * Batch fetch multiple girl profiles by IDs
 */
export async function batchFetchGirls(ids: string[]): Promise<MySQLGirlProfile[]> {
  if (ids.length === 0) return [];
  
  const placeholders = ids.map(() => '?').join(',');
  const query = `
    SELECT 
      g.id,
      g.name,
      g.age,
      g.height,
      g.bust,
      g.cup,
      g.waist,
      g.hip,
      g.is_sake,
      g.is_tobacco,
      IFNULL(COALESCE(g.comment, g.catch_copy), '') as bio,
      IFNULL(g.hobby, '') as hobby,
      s.name as shop_name,
      IFNULL(p.name, '') as location,
      IFNULL(m.name, '') as municipality,
      (
        SELECT gi.image_url 
        FROM girl_image_urls gi 
        WHERE gi.girl_profile_id = g.id 
        ORDER BY gi.id ASC
        LIMIT 1
      ) as imageUrl,
      (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', gt.id, 'name', gt.name))
        FROM girl_status gs
        INNER JOIN girl_types gt ON gs.girl_types_id = gt.id
        WHERE gs.girl_profile_id = g.id
      ) as girl_types_json
    FROM girl_profiles g
    INNER JOIN shop_profiles s ON g.shop_profile_id = s.id
    LEFT JOIN area_prefectures p ON s.area_prefecture_id = p.id
    WHERE g.id IN (${placeholders})
      AND g.is_displayed = 1
      AND g.deleted_at IS NULL
  `;
  
  const cacheKey = `batch:${ids.join(',')}`;
  const results = await cachedQuery<any>(query, ids, cacheKey, 60000);
  
  return results.map(row => ({
    id: row.id.toString(),
    name: row.name || 'Unknown',
    age: row.age || null,
    height: row.height || undefined,
    bust: row.bust || undefined,
    cup: row.cup || undefined,
    waist: row.waist || undefined,
    hip: row.hip || undefined,
    location: row.municipality ? `${row.location} ${row.municipality}` : row.location,
    bio: row.bio || '',
    interests: parseInterests(row.hobby || ''),
    imageUrl: row.imageUrl || '/img/noimage.jpg',
    bodyType: undefined,
    style: undefined,
    isOnline: Math.random() > 0.7,
    lastActive: new Date().toISOString(),
    is_sake: row.is_sake === 1 || row.is_sake === true,
    is_tobacco: row.is_tobacco === 1 || row.is_tobacco === true,
    shopName: row.shop_name,
    // Girl types from girl_status table (parse JSON if string, otherwise use as-is)
    girlTypes: (() => {
      if (!row.girl_types_json) return [];
      // MySQLのJSON型は自動的にパースされることがある
      if (typeof row.girl_types_json === 'string') {
        try {
          return JSON.parse(row.girl_types_json);
        } catch (e) {
          console.error('Failed to parse girl_types_json:', row.girl_types_json);
          return [];
        }
      }
      // 既にオブジェクト/配列の場合はそのまま使用
      return Array.isArray(row.girl_types_json) ? row.girl_types_json : [];
    })()
  }));
}

function parseInterests(hobby: string): string[] {
  if (!hobby) return [];
  
  // Split by common delimiters
  const interests = hobby
    .split(/[、,・]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .slice(0, 5);
  
  return interests.length > 0 ? interests : ['カフェ巡り', '映画鑑賞'];
}

const girlsOptimized = {
  fetchOptimizedGirls,
  prefetchNextPage,
  batchFetchGirls
};

export default girlsOptimized;
