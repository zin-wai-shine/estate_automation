import type {
  BrowserProfile,
  BrowserGroupItem,
  ProcessingLane,
  ImageProcessingJob,
  JobEvent,
  DownloadManagerStatus,
} from './types';

const API_BASE = 'http://localhost:8085/api/browser';

export const fetchBrowserProfiles = async (): Promise<BrowserProfile[]> => {
  try {
    const res = await fetch(`${API_BASE}/profiles`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.profiles || [];
  } catch (err) {
    console.error('Failed to fetch browser profiles:', err);
    return [];
  }
};

export const syncBrowserProfiles = async (): Promise<{ profiles: BrowserProfile[]; addedCount: number }> => {
  try {
    const res = await fetch(`${API_BASE}/profiles/sync`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      profiles: data.profiles || [],
      addedCount: data.added_count || 0,
    };
  } catch (err) {
    console.error('Failed to sync browser profiles:', err);
    return { profiles: [], addedCount: 0 };
  }
};

export const registerBrowserProfile = async (
  profileKey: string,
  displayName: string,
  email?: string
): Promise<BrowserProfile | null> => {
  try {
    const res = await fetch(`${API_BASE}/profiles/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_key: profileKey,
        display_name: displayName,
        email: email || '',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.profile || null;
  } catch (err) {
    console.error('Failed to register browser profile:', err);
    return null;
  }
};

export const openBrowserProfile = async (
  profileId: number,
  profileKey?: string
): Promise<{ success: boolean; message?: string }> => {
  // 1. Try Go backend API (calls companion inside docker via host.docker.internal:9224)
  try {
    const res = await fetch(`${API_BASE}/profiles/${profileId}/open`, {
      method: 'POST',
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true, message: data.message || 'Chrome profile opened' };
    }
  } catch (err) {
    console.warn('Backend profile launch failed, trying direct local companion fallback...', err);
  }

  // 2. Direct fallback: call Mac companion on host 127.0.0.1:9224 directly from frontend
  if (profileKey) {
    try {
      const compRes = await fetch('http://127.0.0.1:9224/open-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_key: profileKey }),
      });
      if (compRes.ok) {
        return { success: true, message: `Chrome profile ${profileKey} opened via Mac companion` };
      }
    } catch (e) {
      console.warn('Direct local companion unreachable:', e);
    }
  }

  return { success: false, message: 'Could not open Chrome profile. Ensure the Mac companion is running.' };
};

// Opens a specific URL in the correct external Chrome profile via backend or Mac companion.
export const openBrowserTab = async (
  profileId: number,
  url: string,
  profileKey?: string
): Promise<{ success: boolean; message?: string }> => {
  // 1. Try Go backend API
  try {
    const res = await fetch(`${API_BASE}/profiles/${profileId}/open-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true, message: data.message || 'URL opened in Chrome profile' };
    }
  } catch (err) {
    console.warn('Backend open-url failed, trying direct local companion fallback...', err);
  }

  // 2. Direct fallback: call Mac companion on host 127.0.0.1:9224 directly from frontend
  if (profileKey) {
    try {
      const compRes = await fetch('http://127.0.0.1:9224/open-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_key: profileKey, url }),
      });
      if (compRes.ok) {
        return { success: true, message: `URL opened in Chrome profile ${profileKey} via Mac companion` };
      }
    } catch (e) {
      console.warn('Direct local companion unreachable:', e);
    }
  }

  return { success: false, message: 'Could not open tab in Chrome profile.' };
};

let lastFocusCallTime = 0;
let lastFocusCallKey = '';

// Focuses the selected Chrome profile and its active tab group on macOS.
export const focusBrowserTabGroup = async (params: {
  profileId?: number;
  profileKey?: string;
  groupName?: string;
  tabId?: string;
  url?: string;
  groupTabUrls?: string[];
  force?: boolean;
}): Promise<{ success: boolean; message?: string }> => {
  const callKey = `${params.profileKey || params.profileId || 'Profile 14'}-${params.groupName || 'Enhance IMG'}`;
  const now = Date.now();
  if (!params.force && callKey === lastFocusCallKey && now - lastFocusCallTime < 2500) {
    console.log('[BROWSER SERVICE] Debounced duplicate focusBrowserTabGroup call:', callKey);
    return { success: true, message: 'Already focused' };
  }
  lastFocusCallTime = now;
  lastFocusCallKey = callKey;

  const payload = {
    profile_id: params.profileId,
    profile_key: params.profileKey,
    group_name: params.groupName,
    tab_id: params.tabId,
    url: params.url,
    group_tab_urls: params.groupTabUrls,
    groupTabUrls: params.groupTabUrls,
    force: params.force,
  };

  // 1. Try Go backend API
  try {
    const res = await fetch(`${API_BASE}/profiles/focus-group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message };
    }
  } catch (err) {
    console.warn('Backend focus-group call failed, trying direct companion fallback...', err);
  }

  // 2. Direct companion fallback
  try {
    const compRes = await fetch('http://127.0.0.1:9224/focus-tab-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (compRes.ok) {
      const compData = await compRes.json();
      return { success: true, message: compData.message };
    }
  } catch (e) {
    console.warn('Direct companion unreachable:', e);
  }

  return { success: false, message: 'Could not focus tab group' };
};


export const fetchTabGroups = async (
  profileId: number,
  profileKey?: string,
  profileName?: string
): Promise<BrowserGroupItem[]> => {
  // 1. First priority: Direct companion query on host (127.0.0.1:9224)
  if (profileKey || profileName) {
    try {
      const q = new URLSearchParams();
      if (profileKey) q.set('profile_key', profileKey);
      if (profileName) q.set('profile_name', profileName);
      const compRes = await fetch(`http://127.0.0.1:9224/profile-groups?${q.toString()}`);
      if (compRes.ok) {
        const compData = await compRes.json();
        if (compData.groups && compData.groups.length > 0) {
          return compData.groups;
        }
      }
    } catch (e) {
      console.warn('Direct companion /profile-groups unreachable, falling back to API:', e);
    }
  }

  // 2. Go backend API fallback
  try {
    const res = await fetch(`${API_BASE}/profiles/${profileId}/groups`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.groups || [];
  } catch (err) {
    console.error('Failed to fetch tab groups:', err);
    return [];
  }
};

export const fetchProcessingLanes = async (): Promise<ProcessingLane[]> => {
  try {
    const res = await fetch(`${API_BASE}/lanes`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.lanes || [];
  } catch (err) {
    console.error('Failed to fetch processing lanes:', err);
    return [];
  }
};

export const fetchImageQueue = async (propertyId?: string): Promise<ImageProcessingJob[]> => {
  try {
    const url = propertyId ? `${API_BASE}/queue?property_id=${encodeURIComponent(propertyId)}` : `${API_BASE}/queue`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.jobs || [];
  } catch (err) {
    console.error('Failed to fetch image queue:', err);
    return [];
  }
};

export const createBatchImageQueue = async (payload: any): Promise<ImageProcessingJob[]> => {
  const res = await fetch(`${API_BASE}/queue/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create queue: ${res.statusText}`);
  const data = await res.json();
  return data.jobs || [];
};

export const startImageQueue = async (propertyId: string): Promise<ImageProcessingJob | null> => {
  const res = await fetch(`${API_BASE}/queue/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ property_id: propertyId }),
  });
  if (!res.ok) throw new Error(`Failed to start queue: ${res.statusText}`);
  const data = await res.json();
  return data.active_job || null;
};

export const pauseImageJob = async (jobId: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/queue/${jobId}/pause`, { method: 'POST' });
  return res.ok;
};

export const resumeImageJob = async (jobId: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/queue/${jobId}/resume`, { method: 'POST' });
  return res.ok;
};

export const retryImageJob = async (jobId: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/queue/${jobId}/retry`, { method: 'POST' });
  return res.ok;
};

export const skipImageJob = async (jobId: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/queue/${jobId}/skip`, { method: 'POST' });
  return res.ok;
};

export const cancelImageJob = async (jobId: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/queue/${jobId}/cancel`, { method: 'POST' });
  return res.ok;
};

export const processLocalImageJob = async (jobId: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/queue/${jobId}/process-local`, { method: 'POST' });
  return res.ok;
};

export const fetchPromptPreview = async (params: {
  template_text: string;
  property_name: string;
  property_metadata?: Record<string, any>;
  image_position?: number;
  total_images?: number;
  output_width?: number;
  output_height?: number;
}): Promise<string> => {
  try {
    const res = await fetch(`${API_BASE}/prompt-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.resolved_prompt || '';
  } catch (err) {
    return '';
  }
};

export const fetchDownloadWatcherStatus = async (): Promise<DownloadManagerStatus | null> => {
  try {
    const res = await fetch(`${API_BASE}/download-watcher/status`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data || null;
  } catch (err) {
    return null;
  }
};

export interface AutomationStatusResponse {
  is_running: boolean;
  property_id?: string;
  total?: number;
  completed?: number;
  failed?: number;
  remaining?: number;
}

export const startAutomation = async (params: {
  property_id: string;
  profile_key?: string;
  tab_ids: number[];
}): Promise<{ success: boolean; message: string; job_count?: number }> => {
  try {
    const res = await fetch(`${API_BASE}/automation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || `HTTP ${res.status}` };
    }
    return {
      success: true,
      message: data.message || 'Automation started',
      job_count: data.job_count,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error starting automation' };
  }
};

export const stopAutomation = async (): Promise<boolean> => {
  try {
    // 1. Direct companion call on host for instantaneous stop response
    fetch('http://127.0.0.1:9224/stop-automation', { method: 'POST' }).catch(() => {});
    // 2. Go backend API
    const res = await fetch(`${API_BASE}/automation/stop`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
};

export const getAutomationStatus = async (): Promise<AutomationStatusResponse | null> => {
  try {
    const res = await fetch(`${API_BASE}/automation/status`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.automation || null;
  } catch {
    return null;
  }
};

export interface TabReadinessResult {
  verified: boolean;
  chromeRunning: boolean;
  windowCount: number;
  matchedCount: number;
  totalExpected: number;
  message: string;
}

export const checkBrowserReadiness = async (params: {
  profileKey?: string;
  groupName?: string;
  expectedUrls?: string[];
  autoLaunch?: boolean;
}): Promise<TabReadinessResult> => {
  const profileKey = params.profileKey || 'Profile 14';
  const groupName = params.groupName || 'Enhance IMG';
  const expectedUrls = params.expectedUrls || [];

  try {
    const res = await fetch('http://127.0.0.1:9224/verify-tab-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_key: profileKey,
        group_name: groupName,
        group_tab_urls: expectedUrls,
        auto_launch: params.autoLaunch,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        verified: !!data.verified,
        chromeRunning: !!data.chrome_running,
        windowCount: Number(data.window_count || 0),
        matchedCount: Number(data.matched_count || 0),
        totalExpected: Number(data.total_expected || expectedUrls.length || 4),
        message: data.message || '',
      };
    }
  } catch (e) {
    console.warn('[BROWSER SERVICE] verify-tab-group poll check failed:', e);
  }

  return {
    verified: false,
    chromeRunning: false,
    windowCount: 0,
    matchedCount: 0,
    totalExpected: expectedUrls.length || 4,
    message: 'Connecting to companion...',
  };
};

export const waitForBrowserTabsReady = async (params: {
  profileKey?: string;
  groupName?: string;
  expectedUrls?: string[];
  maxWaitMs?: number;
  onProgress?: (message: string, matchedCount: number, totalExpected: number) => void;
}): Promise<{ verified: boolean; message: string }> => {
  const maxWait = params.maxWaitMs || 15000;
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < maxWait) {
    attempt++;
    const check = await checkBrowserReadiness({
      profileKey: params.profileKey,
      groupName: params.groupName,
      expectedUrls: params.expectedUrls,
      autoLaunch: false, // Never re-launch Chrome while verifying tabs to prevent opening multiple windows
    });

    if (check.verified) {
      params.onProgress?.(
        `✓ Chrome browser & Tab Group [${params.groupName || 'Enhance IMG'}] confirmed open (${check.matchedCount}/${check.totalExpected} tabs ready)`,
        check.matchedCount,
        check.totalExpected
      );
      return { verified: true, message: check.message };
    }

    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const progressMsg = !check.chromeRunning
      ? `🌐 Opening Google Chrome [${params.profileKey || 'Profile 14'}] (${elapsedSec}s)...`
      : `⏳ Loading Tab Group [${params.groupName || 'Enhance IMG'}] in Chrome (${check.matchedCount}/${check.totalExpected} tabs ready, ${elapsedSec}s)...`;

    params.onProgress?.(progressMsg, check.matchedCount, check.totalExpected);

    await new Promise((r) => setTimeout(r, 600));
  }

  return { verified: false, message: 'Timed out waiting for tabs to confirm' };
};


