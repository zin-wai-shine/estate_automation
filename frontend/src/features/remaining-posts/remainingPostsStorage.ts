import type { Property } from '../../types';

export const checkSocialPlatform = (inputUrl: string): 'facebook' | 'tiktok' | 'unknown' => {
  const trimmed = (inputUrl || '').trim().toLowerCase();
  if (!trimmed) return 'unknown';
  if (
    trimmed.includes('tiktok.com') ||
    trimmed.includes('vt.tiktok.com') ||
    trimmed.includes('vm.tiktok.com')
  ) {
    return 'tiktok';
  }
  if (
    trimmed.includes('facebook.com') ||
    trimmed.includes('fb.watch') ||
    trimmed.includes('fb.com') ||
    trimmed.includes('fb.me')
  ) {
    return 'facebook';
  }
  return 'unknown';
};

export interface RemainingPostImage {
  index: number;
  facebook_photo_id?: string;
  source_url: string;
  stored_url: string;
  width: number;
  height: number;
  status: string;
}

export interface RemainingPostSource {
  platform: string;
  original_url: string;
  canonical_url: string;
  source_type: string;
  source_name: string;
  post_id: string;
  created_time: string;
  extraction_method: string;
}

export interface RemainingPostPropertyData {
  project_name: string;
  listing_type: string;
  price: string;
  currency: string;
  bedrooms: string;
  bathrooms: string;
  size_sqm: string;
  floor: string;
  building: string;
  unit_number: string;
  furnished: string;
  nearest_transit: string;
  location: string;
  move_in_status: string;
  contact_name: string;
  contact_phone: string;
  contact_line: string;
}

export interface RemainingPost {
  id: string;
  facebook_url: string;
  platform?: 'facebook' | 'tiktok';
  socialMediaType?: 'facebook' | 'tiktok';
  projectName: string;
  source: RemainingPostSource | null;
  caption: string;
  languages: string[];
  propertyData: RemainingPostPropertyData;
  originalImages: RemainingPostImage[];
  enhancedPhotos: Record<number, string>; // map of photoIndex -> enhancedUrl
  watermarkedPhotos?: Record<number, string>; // map of photoIndex -> watermarkedUrl
  aiGeneratedOutputs: Record<string, string>; // map of boxId -> generated content
  aiGeneratedCopy: string;
  workflowFormatName?: string;
  autoProcessed?: boolean;
  code?: string;
  isPosted?: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'estate_remaining_posts_v1';
const UPDATE_EVENT_NAME = 'estate_remaining_posts_updated';
const FB_IMPORT_SESSION_KEY = 'estate_facebook_import_session_v1';

export const getRemainingPosts = (): RemainingPost[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse remaining posts from localStorage:', err);
  }
  return [];
};

export const saveRemainingPost = (
  postData: Omit<RemainingPost, 'id' | 'createdAt'> & { id?: string; createdAt?: number }
): RemainingPost => {
  const current = getRemainingPosts();
  const id = postData.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = postData.createdAt || Date.now();

  const platform: 'facebook' | 'tiktok' =
    postData.platform ||
    postData.socialMediaType ||
    (postData.source?.platform === 'tiktok' ? 'tiktok' : undefined) ||
    (postData.facebook_url && postData.facebook_url.includes('tiktok') ? 'tiktok' : 'facebook');

  const defaultName = platform === 'tiktok'
    ? (postData.source?.post_id ? `TikTok Post #${postData.source.post_id}` : `TikTok Listing ${new Date(createdAt).toLocaleDateString()}`)
    : (postData.source?.post_id ? `Facebook Post #${postData.source.post_id}` : `Facebook Listing ${new Date(createdAt).toLocaleDateString()}`);

  const newPost: RemainingPost = {
    ...postData,
    id,
    platform,
    socialMediaType: platform,
    createdAt,
    projectName:
      postData.projectName ||
      postData.propertyData?.project_name ||
      defaultName,
  };

  // Avoid duplicates by Facebook URL + short time frame or existing ID
  const filtered = current.filter((p) => p.id !== id);
  const updated = [newPost, ...filtered];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(UPDATE_EVENT_NAME));
  } catch (err) {
    console.error('Failed to save remaining post to localStorage:', err);
  }

  return newPost;
};

export const deleteRemainingPost = (id: string): void => {
  const current = getRemainingPosts();
  const updated = current.filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(UPDATE_EVENT_NAME));
  } catch (err) {
    console.error('Failed to delete remaining post:', err);
  }
};

export const clearAllRemainingPosts = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(UPDATE_EVENT_NAME));
  } catch (err) {
    console.error('Failed to clear remaining posts:', err);
  }
};

export const getRemainingPostsCount = (): number => {
  return getRemainingPosts().length;
};

export const subscribeRemainingPosts = (callback: () => void): (() => void) => {
  const handler = () => callback();
  window.addEventListener(UPDATE_EVENT_NAME, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) callback();
  });
  return () => {
    window.removeEventListener(UPDATE_EVENT_NAME, handler);
  };
};

/**
 * Loads a RemainingPost back into Facebook Import session so the user can inspect,
 * edit, re-enhance, or re-generate.
 */
export const loadPostIntoFacebookImport = (post: RemainingPost): void => {
  const sessionState = {
    url: post.facebook_url,
    source: post.source,
    caption: post.caption,
    languages: post.languages || [],
    images: post.originalImages || [],
    propertyData: post.propertyData,
    currentStepIndex: 9, // Complete step
    logs: [
      {
        timestamp: new Date().toLocaleTimeString('en-GB'),
        message: `Restored post "${post.projectName}" from Remaining Posts`,
        level: 'info',
      },
    ],
    pipelineError: null,
    pipelineErrorCode: null,
    browserState: 'Browser Ready',
    aiGeneratedOutputs: post.aiGeneratedOutputs || {},
    aiGeneratedCopy: post.aiGeneratedCopy || '',
    activeAIBoxId: Object.keys(post.aiGeneratedOutputs || {})[0] || 'ai-box-rental',
    selectedFormatId: 'workflow-format-default',
    manualMode: false,
    autoImport: true,
    preferredMethod: 'auto',
    enhancedPhotos: post.enhancedPhotos || {},
  };

  try {
    localStorage.setItem(FB_IMPORT_SESSION_KEY, JSON.stringify(sessionState));
    // Dispatch custom event so FacebookImportView can reload immediately if already mounted
    window.dispatchEvent(new CustomEvent('estate_fb_import_load_post', { detail: sessionState }));
  } catch (err) {
    console.error('Failed to load remaining post into Facebook import session:', err);
  }
};

/**
 * Derives a clean, readable listing code for a RemainingPost
 */
export const getRemainingPostCode = (post: RemainingPost): string => {
  if (post.code && post.code.trim()) return post.code.trim();
  if (post.propertyData?.unit_number && post.propertyData.unit_number.trim()) {
    return `UNIT-${post.propertyData.unit_number.trim()}`;
  }
  if (post.source?.post_id && post.source.post_id.trim()) {
    const pid = post.source.post_id.trim();
    return `FB-${pid.length > 5 ? pid.slice(-5) : pid}`;
  }
  const cleanId = (post.id || '').replace(/^post_/, '');
  return `EA-${cleanId.slice(0, 5).toUpperCase()}`;
};

/**
 * Toggles a post between 'Posted' and 'Not Posted' status
 */
export const toggleRemainingPostStatus = (id: string): RemainingPost | null => {
  const current = getRemainingPosts();
  let updatedPost: RemainingPost | null = null;
  const updated = current.map((p) => {
    if (p.id === id) {
      updatedPost = { ...p, isPosted: !p.isPosted };
      return updatedPost;
    }
    return p;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(UPDATE_EVENT_NAME));
  } catch (err) {
    console.error('Failed to toggle post status:', err);
  }
  return updatedPost;
};

/**
 * Updates partial fields of a RemainingPost
 */
export const updateRemainingPost = (id: string, updates: Partial<RemainingPost>): RemainingPost | null => {
  const current = getRemainingPosts();
  let updatedPost: RemainingPost | null = null;
  const updated = current.map((p) => {
    if (p.id === id) {
      updatedPost = { ...p, ...updates };
      return updatedPost;
    }
    return p;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(UPDATE_EVENT_NAME));
  } catch (err) {
    console.error('Failed to update remaining post:', err);
  }
  return updatedPost;
};

