export type PropertyStatus =
  | 'NEW'
  | 'IMPORTING'
  | 'IMPORTED'
  | 'PROCESSING'
  | 'CONTENT_READY'
  | 'IMAGES_READY'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ARCHIVED';

export type ListingType = 'RENT' | 'SALE' | 'RENT_AND_SALE';
export type PropertyType = 'CONDO' | 'HOUSE' | 'TOWNHOUSE' | 'LAND' | 'COMMERCIAL';

export interface Property {
  id: number;
  code: string;
  projectId?: number;
  projectName?: string;
  propertyType: PropertyType;
  listingType: ListingType;
  title: string;
  description: string;
  rentPrice?: number;
  salePrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  floor?: string;
  btsMrt?: string;
  ownerType?: 'OWNER' | 'AGENT';
  contactInfo?: string;
  furnishing?: string;
  address?: string;
  bts?: string;
  mrt?: string;
  status: PropertyStatus;
  sourceUrl: string;
  sourceAuthor?: string;
  originalImages: string[];
  enhancedImages: string[];
  finalImages: string[];
  fbContent?: {
    title: string;
    description: string;
    price: string;
    cta: string;
    hashtags: string;
  };
  tikTokContent?: {
    hook: string;
    highlights: string;
    price: string;
    cta: string;
    hashtags: string;
  };
  validationResult?: {
    status: 'PASS' | 'WARNING' | 'ERROR';
    messages: string[];
  };
  createdAt: string;
}

export interface Project {
  id: number;
  name: string;
  code: string;
  district: string;
  province: string;
  bts?: string;
  mrt?: string;
  defaultImageCount: number;
  status: 'ACTIVE' | 'INACTIVE';
  assets: string[];
}

export interface PromptTemplate {
  id: number;
  name: string;
  category: 'FACEBOOK_RENT' | 'FACEBOOK_SALE' | 'TIKTOK' | 'EN_TRANSLATION' | 'IMAGE_ENHANCE';
  model: string;
  version: string;
  active: boolean;
  templateText: string;
}

export interface AutomationSettings {
  mode: 'MANUAL' | 'SEMI_AUTOMATIC' | 'AUTOMATIC';
  autoImport: boolean;
  autoContentGen: boolean;
  autoImageEnhance: boolean;
  autoWatermark: boolean;
  autoValidation: boolean;
  approvalRequired: boolean;
  autoFbPublish: boolean;
  autoTikTokPublish: boolean;
  googleSheetsSync: boolean;
  autoPurgePublishedImages: boolean;
}

export interface FacebookPageInfo {
  id: string;
  name: string;
  category?: string;
  is_connected: boolean;
}

export interface FacebookConnectionStatus {
  connected: boolean;
  facebook_user_id?: string;
  name?: string;
  expires_at?: string;
  status?: 'CONNECTED' | 'EXPIRED' | 'DISCONNECTED';
  pages?: FacebookPageInfo[];
}

export interface ImportSourceData {
  id: number;
  property_id: number;
  facebook_url: string;
  facebook_post_id?: string;
  facebook_page_id?: string;
  source_type: string;
  original_content?: string;
  original_timestamp?: string;
  import_timestamp: string;
  import_status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'MANUAL_REQUIRED';
  import_error?: string;
}

export interface PropertyImageData {
  id: number;
  property_id: number;
  source_url?: string;
  storage_key: string;
  public_url: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  status: 'ORIGINAL' | 'ENHANCED' | 'WATERMARKED' | 'PURGED';
}

export type ImportStrategy =
  | 'AUTO_WITH_MANUAL_FALLBACK'
  | 'OFFICIAL_API_FIRST'
  | 'BROWSER_WHEN_AVAILABLE'
  | 'MANUAL_ONLY';

export interface PropertyImportPreview {
  property_id: number;
  source_url: string;
  source_name?: string;
  provider: string;
  original_content?: string;
  original_time?: string;
  import_status: string;
  import_error?: string;
  images: PropertyImageData[];
}

export interface BrowserSessionInfo {
  id: number;
  session_name: string;
  status: 'CONNECTED' | 'EXPIRED' | 'REQUIRES_RECONNECT';
  last_used_at: string;
  expires_at: string;
}
