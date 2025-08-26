export interface GirlProfile {
  id: number;
  shop_profile_id: number;
  name: string;
  katakana?: string;
  hiragana?: string;
  alphabet?: string;
  birth_day?: string;
  age?: number;
  blood?: string;
  entry_day?: string;
  height?: number;
  weight?: number;
  bust?: number;
  cup?: string;
  waist?: number;
  hip?: number;
  catch_copy?: string;
  seikantai?: string;
  hobby?: string;
  tokui_play?: string;
  charm_point?: string;
  favorite?: string;
  hatsutaiken?: string;
  birth_place?: string;
  star?: string;
  mobile_email?: string;
  pc_email?: string;
  is_face: boolean;
  is_sake: boolean;
  is_tobacco: boolean;
  is_new_face: boolean;
  is_displayed: boolean;
  is_sokuhime: number;
  character?: string;
  shop_comment?: string;
  girl_comment?: string;
  comment?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ShopProfile {
  id: number;
  name: string;
  name_kana?: string;
  alphabet?: string;
  shop_job_type_id: number;
  is_delivery: boolean;
  is_partner: boolean;
  tel?: string;
  email?: string;
  website_url?: string;
  reception_start_time?: string;
  business_hours_from?: string;
  business_hours_to?: string;
  business_days?: any;
  access_notes?: string;
  postal_code?: string;
  area_prefecture_id?: number;
  area_prefectural_municipality_id?: number;
  address_detail?: string;
  latitude?: number;
  longitude?: number;
  minimum_price?: number;
  pricing_system_image_url?: string;
  introduction_text?: string;
  support_24h: boolean;
  genre1?: string;
  genre2?: string;
  genre3?: string;
  shop_image_url?: string;
  shop_real_image_url?: string;
  whatsnews?: string;
  is_active: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AreaPrefecture {
  id: number;
  area_large_id: number;
  sort_order: number;
  name: string;
  alphabet: string;
  created_at: string;
  updated_at: string;
}

export interface AreaPrefecturalMunicipality {
  id: number;
  area_prefecture_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GirlImageUrl {
  id: number;
  girl_profile_id: number;
  image_type: number;
  image_url: string;
  real_image_url?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PhotoDiary {
  id: number;
  girl_profile_id: number;
  title?: string;
  content?: string;
  images?: string[];  // Array of image URLs
  created_at: string;
  updated_at: string;
}

export interface GirlWithDetails extends GirlProfile {
  shop: ShopProfile;
  prefecture?: AreaPrefecture;
  municipality?: AreaPrefecturalMunicipality;
  images: GirlImageUrl[];
  location?: string;
  photoDiaries?: PhotoDiary[];
  girlTypes?: Array<{id: number, name: string} | string>; // Girl types can be objects or strings
}