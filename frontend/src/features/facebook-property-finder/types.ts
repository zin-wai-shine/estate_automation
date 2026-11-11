export interface FinderProject {
  id: number;
  project_name: string;
  thai_name: string;
  english_name: string;
  alternative_spellings: string;
  keywords_thai: string;
  keywords_english: string;
  property_type: string;
  listing_type: string;
  target_min_price: number;
  target_max_price: number;
  target_min_size_sqm: number;
  target_max_size_sqm: number;
  owner_keywords: string;
  agent_exclusion_keywords: string;
  image_analysis_enabled: boolean;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FinderSource {
  id: number;
  source_type: string;
  source_name: string;
  source_url: string;
  authorization_status: string;
  enabled: boolean;
  last_checked_at?: string;
  last_error?: string;
  created_at?: string;
}

export interface FinderAnalysis {
  id: number;
  post_id: number;
  project_id?: number;
  project_name?: string;
  owner_classification: 'OWNER_CLAIMED' | 'LIKELY_OWNER' | 'AGENT' | 'PROPERTY_AGENCY' | 'UNCLEAR';
  confidence: number;
  property_type?: string;
  listing_type?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  building?: string;
  floor?: string;
  parking?: string;
  project_match_status?: 'MATCHED' | 'POSSIBLE_MATCH' | 'UNMATCHED' | 'MULTIPLE_PROJECTS';
  size_sqm?: number | null;
  rental_price?: number | null;
  sale_price?: number | null;
  furniture?: string;
  available_date?: string;
  contact_info?: string;
  important_conditions?: string;
  evidence?: string;
  reasons?: string;
  missing_info?: string;
  ocr_text?: string;
  image_analyzed?: boolean;
  analysis_status?: string;
  analyzed_at?: string;
}

export interface FinderPost {
  id: number;
  source: string;
  source_type: string;
  source_group: string;
  post_id: string;
  post_url: string;
  post_text: string;
  images: string; // JSON array string
  author_display_name: string;
  content_hash?: string;
  published_at?: string;
  collected_at: string;
  collection_method: string;
  permissions_status: string;
  is_duplicate: boolean;
  is_relevant: boolean;
  matched_project_id?: number;
  project?: FinderProject;
  analysis?: FinderAnalysis;
  created_at: string;
}

export interface FinderOverviewStats {
  total_collected: number;
  relevant_posts: number;
  owner_claimed: number;
  likely_owner: number;
  likely_agent: number;
  property_agency: number;
  unclear: number;
  duplicate_posts: number;
  pending_analysis: number;
  processing_errors: number;
}

export interface RawPostAnalysisResult {
  post_id: number;
  is_duplicate: boolean;
  project_name: string;
  matched_project_id?: number;
  matched_project?: FinderProject;
  project_match_status: 'MATCHED' | 'POSSIBLE_MATCH' | 'UNMATCHED' | 'MULTIPLE_PROJECTS';
  owner_classification: 'OWNER_CLAIMED' | 'LIKELY_OWNER' | 'AGENT' | 'PROPERTY_AGENCY' | 'UNCLEAR';
  confidence: number;
  listing_type: string;
  rental_price?: number | null;
  sale_price?: number | null;
  building?: string;
  floor?: string;
  size_sqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  furniture?: string;
  parking?: string;
  contact_info?: string;
  evidence?: string;
  reasons?: string;
  missing_info?: string;
  post_url?: string;
  source_info?: string;
  raw_content: string;
}
