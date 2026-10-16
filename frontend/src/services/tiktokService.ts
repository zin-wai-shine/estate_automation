import { apiUrl } from './apiClient';

export interface TikTokAccount {
  id: number;
  open_id: string;
  union_id?: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  token_hint: string;
  token_status: 'VALID' | 'EXPIRED' | 'MISSING' | 'UNTESTED' | 'INVALID' | 'RECONNECT_REQUIRED';
  scope?: string;
  permissions?: string;
  can_publish_photo_mode: boolean;
  can_upload_video: boolean;
  test_passed: boolean;
  auto_publish_enabled: boolean;
  last_tested_at?: string;
  last_error?: string;
  token_expires_at?: string;
  environment?: string;
  follower_count?: number;
  created_at?: string;
}

export interface TikTokPublishPost {
  id: number;
  tiktok_account_id: number;
  open_id: string;
  username: string;
  publish_id: string;
  title: string;
  privacy_level: string;
  disable_comment: boolean;
  auto_add_music: boolean;
  media_type: string;
  post_mode: string;
  photo_images: string;
  photo_cover_index: number;
  status: 'DRAFT' | 'QUEUED' | 'PROCESSING_DOWNLOAD' | 'PROCESSING_UPLOAD' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  tiktok_post_id?: string;
  share_url?: string;
  error_message?: string;
  published_at?: string;
  created_at?: string;
}

export interface PublishTikTokPhotoPayload {
  account_id: number;
  title: string;
  photo_images: string[];
  photo_cover_index?: number;
  privacy_level?: string;
  disable_comment?: boolean;
  auto_add_music?: boolean;
}

/**
 * Initiates official TikTok Login Kit flow server-side
 */
export async function startTikTokOAuthFlow(): Promise<void> {
  const resp = await fetch(apiUrl('/api/auth/tiktok/start'));
  const data = await resp.json();
  if (data.status === 'success' && data.auth_url) {
    window.location.href = data.auth_url;
  } else {
    throw new Error(data.message || 'Failed to initiate TikTok authorization');
  }
}

/**
 * Retrieves all authorized TikTok accounts from backend database
 */
export async function fetchTikTokAccounts(): Promise<TikTokAccount[]> {
  const resp = await fetch(apiUrl('/api/tiktok/accounts'));
  if (!resp.ok) {
    throw new Error(`Failed to fetch TikTok accounts: ${resp.statusText}`);
  }
  const result = await resp.json();
  return result.data || [];
}

/**
 * Tests connection and tokens with TikTok Sandbox / Live API
 */
export async function testTikTokAccount(id: number): Promise<TikTokAccount> {
  const resp = await fetch(apiUrl(`/api/tiktok/accounts/${id}/test`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await resp.json();
  if (!resp.ok || result.status !== 'success') {
    throw new Error(result.message || 'TikTok verification failed');
  }
  return result.data;
}

/**
 * Refreshes TikTok access tokens
 */
export async function refreshTikTokAccount(id: number): Promise<TikTokAccount> {
  const resp = await fetch(apiUrl(`/api/tiktok/accounts/${id}/refresh`), {
    method: 'POST',
  });
  const result = await resp.json();
  if (!resp.ok || result.status !== 'success') {
    throw new Error(result.message || 'TikTok token refresh failed');
  }
  return result.data;
}

/**
 * Disconnects TikTok account and revokes tokens
 */
export async function disconnectTikTokAccount(id: number): Promise<void> {
  const resp = await fetch(apiUrl(`/api/tiktok/accounts/${id}/disconnect`), {
    method: 'POST',
  });
  if (!resp.ok) {
    throw new Error('Failed to disconnect TikTok account');
  }
}

/**
 * Toggles auto publish for TikTok account
 */
export async function toggleTikTokAutoPublish(id: number, enabled: boolean): Promise<TikTokAccount> {
  const resp = await fetch(apiUrl(`/api/tiktok/accounts/${id}/auto-publish`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  const result = await resp.json();
  if (!resp.ok) {
    throw new Error(result.error || 'Failed to toggle auto publish');
  }
  return result.data;
}

/**
 * Submits a Photo Mode carousel post to TikTok Content Posting API
 */
export async function publishTikTokPhotoPost(payload: PublishTikTokPhotoPayload): Promise<TikTokPublishPost> {
  const resp = await fetch(apiUrl('/api/tiktok/publish'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await resp.json();
  if (!resp.ok || result.status !== 'success') {
    throw new Error(result.message || result.error || 'Failed to initialize TikTok photo publish');
  }
  return result.data;
}

/**
 * Polls real publishing status from TikTok Content Posting API
 */
export async function pollTikTokPublishStatus(publishId: string): Promise<TikTokPublishPost> {
  const resp = await fetch(apiUrl(`/api/tiktok/publish/${encodeURIComponent(publishId)}/status`));
  const result = await resp.json();
  if (!resp.ok || result.status !== 'success') {
    throw new Error(result.message || 'Failed to fetch publishing status');
  }
  return result.data;
}

/**
 * Fetches real TikTok post history
 */
export async function fetchTikTokPosts(): Promise<TikTokPublishPost[]> {
  const resp = await fetch(apiUrl('/api/tiktok/posts'));
  if (!resp.ok) {
    throw new Error('Failed to load TikTok posts');
  }
  const result = await resp.json();
  return result.data || [];
}
