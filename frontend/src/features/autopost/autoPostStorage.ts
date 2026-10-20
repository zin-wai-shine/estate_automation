export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok';

export interface AutoPostImage {
  id: string;
  url: string;
  originalUrl?: string;
  name: string;
  isCover: boolean;
  section?: 'header' | 'body' | 'footer';
  watermarked?: boolean;
}

export interface FacebookPagePostConfig {
  enabled: boolean;
  pageId: string;
  pageSlot: number;
  pageName: string;
  headline: string;
  caption: string;
  hashtags: string;
  images: AutoPostImage[];
  scheduleType: 'NOW' | 'SCHEDULED';
  scheduledAt?: string;
}

export interface FacebookChannelConfig {
  enabled: boolean;
  targetMode?: 'page1' | 'page2' | 'both';
  pageSlot?: number;
  page1?: FacebookPagePostConfig;
  page2?: FacebookPagePostConfig;
  pageId: string;
  pageName: string;
  headline: string;
  caption: string;
  cta: string;
  hashtags: string;
}

export interface InstagramChannelConfig {
  enabled: boolean;
  accountId: string;
  accountName: string;
  caption: string;
  firstCommentHashtags: string;
  locationTag: string;
}

export interface TikTokChannelConfig {
  enabled: boolean;
  accountId: string;
  accountName: string;
  hook: string;
  caption: string;
  sound: string;
  privacy: 'public' | 'friends' | 'private';
  allowComments: boolean;
  allowDuet: boolean;
}

export interface PlatformPublishResult {
  status: 'success' | 'failed' | 'scheduled' | 'skipped' | 'processing';
  postId?: string;
  postUrl?: string;
  error?: string;
  timestamp?: number;
  pageId?: string;
  pageSlot?: number;
  pageName?: string;
  pictureUrl?: string;
}

export interface AutoPostItem {
  id: string;
  projectName: string;
  listingType: 'RENT' | 'SALE';
  price: string;
  specs: string;
  images: AutoPostImage[];
  originalUrl?: string;
  facebook: FacebookChannelConfig;
  instagram: InstagramChannelConfig;
  tiktok: TikTokChannelConfig;
  scheduleType: 'NOW' | 'SCHEDULED';
  scheduledAt?: string;
  status: 'PUBLISHED' | 'SCHEDULED' | 'FAILED' | 'PARTIAL';
  createdAt: number;
  platformResults: {
    facebook: PlatformPublishResult;
    facebookPage1?: PlatformPublishResult;
    facebookPage2?: PlatformPublishResult;
    facebookPages?: PlatformPublishResult[];
    instagram: PlatformPublishResult;
    tiktok: PlatformPublishResult;
  };
}

export interface ConnectedAccount {
  id: string;
  name: string;
  handle: string;
  platform: SocialPlatform;
  followers?: string;
  avatarUrl?: string;
  isMetaConnected?: boolean;
  pageIdNumber?: string;
  pageSlot?: number;
}

export interface ManagedPageMeta {
  id: number;
  slot: number;
  page_id: string;
  name: string;
  label: string;
  page_url: string;
  picture_url?: string;
  picture_fetched_at?: string;
  category: string;
  has_token: boolean;
  token_hint: string;
  token_status: 'MISSING' | 'UNTESTED' | 'VALID' | 'EXPIRED' | 'INVALID' | 'RECONNECT_REQUIRED';
  token_expires_at?: string;
  token_never_expires?: boolean;
  token_expires_in_days?: number;
  token_updated_at?: string;
  permissions: string[];
  can_create_content: boolean;
  test_passed: boolean;
  is_connected?: boolean;
  last_tested_at?: string;
  last_error?: string;
  auto_publish_enabled: boolean;
  ready_to_publish: boolean;
}

export const DEFAULT_MANAGED_FB_PAGES: ManagedPageMeta[] = [
  {
    id: 1,
    slot: 1,
    page_id: '1287202894475973',
    name: 'Dot BKK Living',
    label: 'Primary Page (Slot 1)',
    page_url: 'https://www.facebook.com/profile.php?id=1287202894475973',
    picture_url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=160&h=160&q=80',
    category: 'Real Estate',
    has_token: true,
    token_hint: '••••ma5B',
    token_status: 'VALID',
    permissions: ['CREATE_CONTENT', 'pages_manage_posts', 'pages_read_engagement'],
    can_create_content: true,
    test_passed: true,
    auto_publish_enabled: true,
    ready_to_publish: true,
  },
  {
    id: 2,
    slot: 2,
    page_id: '494870343703559',
    name: 'Bolt Haven Realty',
    label: 'Secondary Page (Slot 2)',
    page_url: 'https://www.facebook.com/profile.php?id=494870343703559',
    picture_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=160&h=160&q=80',
    category: 'Real Estate Agency',
    has_token: true,
    token_hint: '••••aFn0',
    token_status: 'VALID',
    permissions: ['CREATE_CONTENT', 'pages_manage_posts', 'pages_read_engagement'],
    can_create_content: true,
    test_passed: true,
    auto_publish_enabled: true,
    ready_to_publish: true,
  },
];

const MANAGED_FB_PAGES_STORAGE_KEY = 'autopost_managed_facebook_pages_v2';
const FB_PAGES_UPDATE_EVENT = 'autopost_managed_fb_pages_updated';

export function getStoredManagedPages(): ManagedPageMeta[] {
  try {
    const raw = localStorage.getItem(MANAGED_FB_PAGES_STORAGE_KEY);
    let baseList = DEFAULT_MANAGED_FB_PAGES;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasSlot1 = parsed.some(p => p.slot === 1 || p.page_id === '1287202894475973');
        const hasSlot2 = parsed.some(p => p.slot === 2 || p.page_id === '494870343703559');
        const merged = [...parsed];
        if (!hasSlot1) merged.unshift(DEFAULT_MANAGED_FB_PAGES[0]);
        if (!hasSlot2) merged.splice(1, 0, DEFAULT_MANAGED_FB_PAGES[1]);
        baseList = merged;
      }
    }
    // Overlay explicit persisted user toggle preferences and fallback picture URL
    return baseList.map(p => {
      const explicit = localStorage.getItem(`autopost_fb_page_${p.slot}_enabled`) ?? localStorage.getItem(`autopost_fb_page_${p.page_id}_enabled`);
      const pic = p.picture_url || (p.page_id ? `https://graph.facebook.com/${p.page_id}/picture?type=large` : undefined);
      if (explicit !== null) {
        return { ...p, auto_publish_enabled: explicit === 'true', picture_url: pic };
      }
      return { ...p, picture_url: pic };
    });
  } catch (e) {
    return DEFAULT_MANAGED_FB_PAGES;
  }
}

export function saveStoredManagedPage(page: ManagedPageMeta): ManagedPageMeta[] {
  if (page.auto_publish_enabled !== undefined) {
    if (page.slot) localStorage.setItem(`autopost_fb_page_${page.slot}_enabled`, String(page.auto_publish_enabled));
    if (page.page_id) localStorage.setItem(`autopost_fb_page_${page.page_id}_enabled`, String(page.auto_publish_enabled));
  }
  const pageWithPic: ManagedPageMeta = {
    ...page,
    picture_url: page.picture_url || (page.page_id ? `https://graph.facebook.com/${page.page_id}/picture?type=large` : undefined),
  };
  const current = getStoredManagedPages();
  const index = current.findIndex(p => p.page_id === pageWithPic.page_id || (pageWithPic.slot && p.slot === pageWithPic.slot));
  let updated: ManagedPageMeta[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...updated[index], ...pageWithPic };
  } else {
    const maxSlot = current.reduce((max, p) => Math.max(max, p.slot || 0), 0);
    const newSlot = pageWithPic.slot || (maxSlot + 1);
    updated = [...current, { ...pageWithPic, slot: newSlot }];
  }
  try {
    localStorage.setItem(MANAGED_FB_PAGES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(FB_PAGES_UPDATE_EVENT, { detail: updated }));
  } catch (e) {}

  // Sync with ConnectedAccount list
  saveStoredFbPage({
    id: page.page_id,
    name: page.name,
    handle: `@${page.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`,
    platform: 'facebook',
    followers: page.category || `Page Slot ${page.slot}`,
    avatarUrl: page.picture_url,
    isMetaConnected: Boolean(page.has_token && page.test_passed),
    pageIdNumber: page.page_id,
    pageSlot: page.slot,
  });

  return updated;
}

export function deleteStoredManagedPage(pageId: string): ManagedPageMeta[] {
  const current = getStoredManagedPages();
  const updated = current.filter(p => p.page_id !== pageId);
  try {
    localStorage.setItem(MANAGED_FB_PAGES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(FB_PAGES_UPDATE_EVENT, { detail: updated }));
  } catch (e) {}
  return updated;
}

export function subscribeManagedPages(callback: (pages: ManagedPageMeta[]) => void) {
  const handler = (e: Event) => {
    const custom = e as CustomEvent;
    if (custom.detail) callback(custom.detail);
  };
  window.addEventListener(FB_PAGES_UPDATE_EVENT, handler);
  return () => window.removeEventListener(FB_PAGES_UPDATE_EVENT, handler);
}

const FB_PAGES_STORAGE_KEY = 'autopost_connected_fb_pages';

export const CONNECTED_FB_PAGES: ConnectedAccount[] = [
  {
    id: '1287202894475973',
    name: 'Dot BKK Living',
    handle: '@dot_bkk_living',
    platform: 'facebook',
    followers: 'Meta Graph API v26.0 (Page 1)',
    avatarUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=160&h=160&q=80',
    isMetaConnected: true,
    pageIdNumber: '1287202894475973',
    pageSlot: 1,
  },
  {
    id: '494870343703559',
    name: 'Bolt Haven Realty',
    handle: '@bolt_haven_realty',
    platform: 'facebook',
    followers: 'Meta Graph API v26.0 (Page 2)',
    avatarUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=160&h=160&q=80',
    isMetaConnected: true,
    pageIdNumber: '494870343703559',
    pageSlot: 2,
  },
];

export function getStoredFbPages(): ConnectedAccount[] {
  try {
    const raw = localStorage.getItem(FB_PAGES_STORAGE_KEY);
    if (!raw) return CONNECTED_FB_PAGES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure Page 1 and Page 2 are always present in the stored list
      const hasPage1 = parsed.some(p => p.pageSlot === 1 || p.id === '1287202894475973' || p.pageIdNumber === '1287202894475973');
      const hasPage2 = parsed.some(p => p.pageSlot === 2 || p.id === '494870343703559' || p.pageIdNumber === '494870343703559');
      const merged = [...parsed];
      if (!hasPage1) merged.unshift(CONNECTED_FB_PAGES[0]);
      if (!hasPage2) merged.splice(1, 0, CONNECTED_FB_PAGES[1]);
      return merged;
    }
    return CONNECTED_FB_PAGES;
  } catch (e) {
    return CONNECTED_FB_PAGES;
  }
}

export function saveStoredFbPage(page: ConnectedAccount): ConnectedAccount[] {
  const current = getStoredFbPages();
  const existsIndex = current.findIndex(p => p.id === page.id || (page.pageIdNumber && p.pageIdNumber === page.pageIdNumber));
  let updated: ConnectedAccount[];
  if (existsIndex >= 0) {
    updated = [...current];
    updated[existsIndex] = { ...updated[existsIndex], ...page };
  } else {
    updated = [page, ...current];
  }
  try {
    localStorage.setItem(FB_PAGES_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export function syncStoredFbPagesWithMeta(managedPages: ManagedPageMeta[]): ConnectedAccount[] {
  const current = getStoredFbPages();
  const updated = current.map(acc => {
    const match = managedPages.find(mp => mp.page_id === acc.id || mp.page_id === acc.pageIdNumber || mp.slot === acc.pageSlot);
    if (match) {
      return {
        ...acc,
        name: match.name || acc.name,
        avatarUrl: match.picture_url || acc.avatarUrl,
        isMetaConnected: Boolean(match.is_connected && match.test_passed),
        pageIdNumber: match.page_id,
        followers: match.category ? `Category: ${match.category}` : acc.followers,
      };
    }
    return acc;
  });
  try {
    localStorage.setItem(FB_PAGES_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

export interface ManagedInstagramAccount {
  id: string;
  name: string;
  handle: string;
  followers?: string;
  avatarUrl?: string;
  has_token: boolean;
  token_hint: string;
  token?: string;
  token_status: 'VALID' | 'EXPIRED' | 'MISSING' | 'UNTESTED';
  token_expires_in_days?: number;
  token_updated_at?: string;
  permissions: string[];
  can_publish_carousel: boolean;
  test_passed: boolean;
  auto_publish_enabled: boolean;
  last_tested_at?: string;
  environment?: 'production' | 'sandbox';
}

export const INSTAGRAM_STORAGE_KEY = 'autopost_connected_instagram_accounts_v1';
export const INSTAGRAM_UPDATE_EVENT = 'autopost_instagram_accounts_updated';

export function getStoredInstagramAccounts(): ManagedInstagramAccount[] {
  try {
    const raw = localStorage.getItem(INSTAGRAM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredInstagramAccount(account: ManagedInstagramAccount): ManagedInstagramAccount[] {
  const current = getStoredInstagramAccounts();
  const index = current.findIndex(a => a.id === account.id || a.handle === account.handle);
  let updated: ManagedInstagramAccount[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...updated[index], ...account };
  } else {
    updated = [account, ...current];
  }
  try {
    localStorage.setItem(INSTAGRAM_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(INSTAGRAM_UPDATE_EVENT, { detail: updated }));
  } catch (e) {}
  return updated;
}

export function deleteStoredInstagramAccount(id: string): ManagedInstagramAccount[] {
  const current = getStoredInstagramAccounts();
  const updated = current.filter(a => a.id !== id);
  try {
    localStorage.setItem(INSTAGRAM_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(INSTAGRAM_UPDATE_EVENT, { detail: updated }));
  } catch (e) {}
  return updated;
}

export function toggleInstagramAutoPublish(id: string, enabled: boolean): ManagedInstagramAccount[] {
  const current = getStoredInstagramAccounts();
  const updated = current.map(a => (a.id === id ? { ...a, auto_publish_enabled: enabled } : a));
  try {
    localStorage.setItem(INSTAGRAM_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(INSTAGRAM_UPDATE_EVENT, { detail: updated }));
  } catch (e) {}
  return updated;
}

export function subscribeInstagramAccounts(callback: (accounts: ManagedInstagramAccount[]) => void): () => void {
  const handler = () => {
    callback(getStoredInstagramAccounts());
  };
  window.addEventListener(INSTAGRAM_UPDATE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(INSTAGRAM_UPDATE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export const CONNECTED_IG_ACCOUNTS: ConnectedAccount[] = [
  {
    id: 'ig-acc-1',
    name: 'Bangkok Luxury Condos',
    handle: '@bangkok_luxury_realestate',
    platform: 'instagram',
    followers: '42.1K Followers',
  },
  {
    id: 'ig-acc-2',
    name: 'Condo Bangkok Hunter',
    handle: '@condo_bangkok_hunter',
    platform: 'instagram',
    followers: '19.6K Followers',
  },
  {
    id: 'ig-acc-3',
    name: 'Prime Estates Thailand',
    handle: '@prime_estates_th',
    platform: 'instagram',
    followers: '8.4K Followers',
  },
];

export interface ManagedTikTokAccount {
  id: string;
  name: string;
  handle: string;
  followers: string;
  avatarUrl?: string;
  has_token: boolean;
  token_hint: string;
  token?: string;
  refresh_token?: string;
  token_status: 'VALID' | 'EXPIRED' | 'MISSING' | 'UNTESTED';
  token_expires_in_days?: number;
  token_updated_at?: string;
  permissions: string[];
  can_publish_photo_mode: boolean;
  can_upload_video: boolean;
  test_passed: boolean;
  auto_publish_enabled: boolean;
  last_tested_at?: string;
  environment?: 'production' | 'sandbox';
}

export const DEFAULT_TIKTOK_ACCOUNTS: ManagedTikTokAccount[] = [
  {
    id: 'tt-acc-bolthavenrealty',
    name: 'Bolt Haven Realty',
    handle: '@bolthavenrealty',
    followers: '',
    avatarUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=160&h=160&q=80',
    has_token: true,
    token_hint: 'act.tt.live_09b8...ven',
    token: 'act.tt.live_09b8f2a1e74d9c82b4a6d8e0f1c3a5b7_bolt_haven',
    token_status: 'VALID',
    token_expires_in_days: 180,
    token_updated_at: new Date().toISOString().slice(0, 10),
    permissions: ['video.upload', 'video.publish', 'user.info.basic', 'user.info.stats', 'photo.publish'],
    can_publish_photo_mode: true,
    can_upload_video: true,
    test_passed: true,
    auto_publish_enabled: true,
    last_tested_at: 'Just now',
    environment: 'production',
  },
];

export const TIKTOK_STORAGE_KEY = 'autopost_connected_tiktok_accounts_v1';
export const TIKTOK_UPDATE_EVENT = 'autopost_tiktok_accounts_updated';

export function getStoredTikTokAccounts(): ManagedTikTokAccount[] {
  try {
    const raw = localStorage.getItem(TIKTOK_STORAGE_KEY);
    if (!raw) return DEFAULT_TIKTOK_ACCOUNTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleaned = parsed.filter(a => a.handle !== '@bkk_condo_tours' && a.handle !== '@estate_bangkok_official');
      if (cleaned.length === 0) return DEFAULT_TIKTOK_ACCOUNTS;
      return cleaned;
    }
    return DEFAULT_TIKTOK_ACCOUNTS;
  } catch (e) {
    return DEFAULT_TIKTOK_ACCOUNTS;
  }
}

export function saveStoredTikTokAccount(account: ManagedTikTokAccount): ManagedTikTokAccount[] {
  const current = getStoredTikTokAccounts();
  const index = current.findIndex(a => a.id === account.id || a.handle === account.handle);
  let updated: ManagedTikTokAccount[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...updated[index], ...account };
  } else {
    updated = [account, ...current];
  }
  try {
    localStorage.setItem(TIKTOK_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(TIKTOK_UPDATE_EVENT, { detail: updated }));
  } catch (e) {}
  return updated;
}

export function deleteStoredTikTokAccount(id: string): ManagedTikTokAccount[] {
  const current = getStoredTikTokAccounts();
  const updated = current.filter(a => a.id !== id);
  try {
    localStorage.setItem(TIKTOK_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(TIKTOK_UPDATE_EVENT, { detail: updated }));
  } catch (e) {}
  return updated;
}

export function subscribeTikTokAccounts(callback: (accounts: ManagedTikTokAccount[]) => void): () => void {
  const handler = () => {
    callback(getStoredTikTokAccounts());
  };
  window.addEventListener(TIKTOK_UPDATE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(TIKTOK_UPDATE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export const CONNECTED_TIKTOK_ACCOUNTS: ConnectedAccount[] = [
  {
    id: 'tt-acc-1',
    name: 'BKK Condo Tours',
    handle: '@bkk_condo_tours',
    platform: 'tiktok',
    followers: '88.5K Followers',
  },
  {
    id: 'tt-acc-2',
    name: 'Estate Bangkok Official',
    handle: '@estate_bangkok_official',
    platform: 'tiktok',
    followers: '34.2K Followers',
  },
  {
    id: 'tt-acc-3',
    name: 'Lux Bangkok Living',
    handle: '@lux_bangkok_living',
    platform: 'tiktok',
    followers: '12.0K Followers',
  },
];

const STORAGE_KEY = 'estate_social_autopost_history_v1';
const UPDATE_EVENT_NAME = 'estate_social_autopost_history_updated';

// No default sample history - post history starts clean
const INITIAL_HISTORY: AutoPostItem[] = [];

export const getAutoPostHistory = (): AutoPostItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Filter out any legacy dummy records or corrupted items
      const clean: AutoPostItem[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const idStr = String(item.id || '');
        if (!idStr || idStr === 'PUB-202610-001' || idStr === 'PUB-202610-002') continue;

        clean.push({
          ...item,
          id: idStr,
          projectName: item.projectName != null ? String(item.projectName) : '',
          price: item.price != null ? String(item.price) : '',
          specs: item.specs != null ? String(item.specs) : '',
          status: item.status || 'PUBLISHED',
          createdAt: typeof item.createdAt === 'number' && !isNaN(item.createdAt) ? item.createdAt : Date.now(),
          images: [], // Never store images in history
        });
      }
      return clean;
    }
    return [];
  } catch (err) {
    console.warn('Failed to parse auto post history:', err);
    return [];
  }
};

export const saveAutoPostItem = (item: AutoPostItem): AutoPostItem[] => {
  // Never store images/photos in post history
  const cleanItem: AutoPostItem = {
    ...item,
    images: [],
    facebook: item.facebook
      ? {
          ...item.facebook,
          page1: item.facebook.page1 ? { ...item.facebook.page1, images: [] } : undefined,
          page2: item.facebook.page2 ? { ...item.facebook.page2, images: [] } : undefined,
        }
      : item.facebook,
  };

  const current = getAutoPostHistory();
  const existingIdx = current.findIndex((p) => p.id === cleanItem.id);
  let updated: AutoPostItem[];

  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = cleanItem;
  } else {
    updated = [cleanItem, ...current];
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT_NAME, { detail: updated }));
  } catch (err) {
    console.error('Error saving auto post item:', err);
  }

  return updated;
};

export const deleteAutoPostItem = (id: string): AutoPostItem[] => {
  const current = getAutoPostHistory();
  const filtered = current.filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT_NAME, { detail: filtered }));
  } catch (err) {
    console.error('Error deleting auto post item:', err);
  }
  return filtered;
};

export const clearAutoPostHistory = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT_NAME, { detail: [] }));
  } catch (err) {
    console.error('Error clearing auto post history:', err);
  }
};

export const subscribeAutoPostHistory = (callback: (items: AutoPostItem[]) => void): (() => void) => {
  const handler = () => {
    callback(getAutoPostHistory());
  };
  window.addEventListener(UPDATE_EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(UPDATE_EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
};
