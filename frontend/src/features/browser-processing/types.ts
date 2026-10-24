export type BrowserProcessingMode = 'chrome_assisted' | 'local_enhance' | 'authorized_api';

export type ImageJobStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY_FOR_USER'
  | 'AWAITING_DOWNLOAD'
  | 'PROCESSING_LOCAL'
  | 'PROCESSING_API'
  | 'VALIDATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

export interface BrowserProfile {
  id: number;
  profile_key: string;
  display_name: string;
  email?: string;
  integration_id: string;
  status: 'connected' | 'registered' | 'disconnected';
  last_seen_at?: string;
  associated_tab_groups?: {
    groups?: string[];
  };
}

export interface BrowserTabItem {
  id: string;
  title: string;
  url: string;
  hostname: string;
  is_chatgpt: boolean;
  is_connected: boolean;
  is_selected: boolean;
}

export interface BrowserGroupItem {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  tabs_count: number;
  tabs: BrowserTabItem[];
}

export interface ProcessingLane {
  id: number;
  lane_key: string;
  display_name: string;
  processing_mode: BrowserProcessingMode;
  profile_id?: number;
  profile_name?: string;
  group_name?: string;
  target_tab_title?: string;
  prompt_template_id?: string;
  output_format?: string;
  concurrency?: number;
  status: 'idle' | 'processing' | 'paused';
}

export interface ImageProcessingJob {
  id: number;
  job_id: string;
  property_id: string;
  property_name: string;
  source_image_id: string;
  original_position: number;
  source_file_path?: string;
  source_file_url?: string;
  original_file_hash?: string;
  processing_mode: BrowserProcessingMode;
  lane_id?: string;
  prompt_template_id?: string;
  prompt_version?: string;
  resolved_prompt?: string;
  selected_profile?: string;
  selected_tab_group?: string;
  selected_target_tab?: string;
  output_file_ref?: string;
  output_file_path?: string;
  output_file_url?: string;
  output_width?: number;
  output_height?: number;
  output_file_hash?: string;
  status: ImageJobStatus;
  attempt_count: number;
  error_message?: string;
  strict_preservation_active: boolean;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
}

export interface JobEvent {
  id: number;
  job_id: string;
  from_state: string;
  to_state: string;
  message: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface DownloadManagerStatus {
  watch_directory: string;
  is_active: boolean;
  auto_advance_queue: boolean;
  last_detected_file?: string;
  last_detected_at?: string;
  active_jobs_count: number;
}
