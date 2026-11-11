import type {
  FinderProject,
  FinderSource,
  FinderPost,
  FinderAnalysis,
  FinderOverviewStats,
  RawPostAnalysisResult,
} from './types';

const API_BASE = '/api/property-finder';

export const fetchFinderOverview = async (): Promise<FinderOverviewStats> => {
  const res = await fetch(`${API_BASE}/overview`);
  if (!res.ok) throw new Error('Failed to fetch overview stats');
  const json = await res.json();
  return json.data;
};

export const fetchFinderProjects = async (): Promise<FinderProject[]> => {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  const json = await res.json();
  return json.data || [];
};

export const createFinderProject = async (project: Partial<FinderProject>): Promise<FinderProject> => {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create project');
  }
  const json = await res.json();
  return json.data;
};

export const updateFinderProject = async (id: number, project: Partial<FinderProject>): Promise<FinderProject> => {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error('Failed to update project');
  const json = await res.json();
  return json.data;
};

export const deleteFinderProject = async (id: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete project');
};

export const toggleFinderProject = async (id: number): Promise<FinderProject> => {
  const res = await fetch(`${API_BASE}/projects/${id}/toggle`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to toggle project');
  const json = await res.json();
  return json.data;
};

export const fetchFinderSources = async (): Promise<FinderSource[]> => {
  const res = await fetch(`${API_BASE}/sources`);
  if (!res.ok) throw new Error('Failed to fetch sources');
  const json = await res.json();
  return json.data || [];
};

export const createFinderSource = async (source: Partial<FinderSource>): Promise<FinderSource> => {
  const res = await fetch(`${API_BASE}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(source),
  });
  if (!res.ok) throw new Error('Failed to create source');
  const json = await res.json();
  return json.data;
};

export const deleteFinderSource = async (id: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/sources/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete source');
};

export interface FetchPostsParams {
  project_id?: string;
  classification?: string;
  listing_type?: string;
  min_price?: string;
  max_price?: string;
  min_size?: string;
  bedrooms?: string;
  search?: string;
  sort_by?: string;
  page?: number;
  limit?: number;
}

export const fetchFinderPosts = async (params: FetchPostsParams = {}): Promise<{ posts: FinderPost[]; total: number }> => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== 'all') {
      sp.append(k, String(v));
    }
  });

  const res = await fetch(`${API_BASE}/posts?${sp.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch posts');
  const json = await res.json();
  return {
    posts: json.data || [],
    total: json.meta?.total || 0,
  };
};

export const fetchFinderPost = async (id: number): Promise<FinderPost> => {
  const res = await fetch(`${API_BASE}/posts/${id}`);
  if (!res.ok) throw new Error('Failed to fetch post');
  const json = await res.json();
  return json.data;
};

export const importFinderPost = async (post: Partial<FinderPost>, autoAnalyze: boolean = true): Promise<FinderPost> => {
  const res = await fetch(`${API_BASE}/posts?auto_analyze=${autoAnalyze}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(post),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to import post');
  }
  const json = await res.json();
  return json.data;
};

export const batchImportFinderPosts = async (posts: Partial<FinderPost>[], autoAnalyze: boolean = true): Promise<any> => {
  const res = await fetch(`${API_BASE}/batch-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts, auto_analyze: autoAnalyze }),
  });
  if (!res.ok) throw new Error('Failed to batch import posts');
  return res.json();
};

export const analyzeFinderPost = async (id: number): Promise<FinderAnalysis> => {
  const res = await fetch(`${API_BASE}/posts/${id}/analyze`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger AI analysis');
  const json = await res.json();
  return json.data;
};

export const deleteFinderPost = async (id: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/posts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete post');
};

export const fetchFinderSettings = async (): Promise<Record<string, string>> => {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  const json = await res.json();
  return json.data || {};
};

export const updateFinderSettings = async (settings: Record<string, string>): Promise<void> => {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
};

export const loadSampleFinderPosts = async (): Promise<FinderPost[]> => {
  const res = await fetch(`${API_BASE}/test-sample`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to load sample posts');
  const json = await res.json();
  return json.data || [];
};

export const testTelegramNotification = async (botToken?: string, chatID?: string): Promise<string> => {
  const res = await fetch(`${API_BASE}/telegram/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_token: botToken, chat_id: chatID }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Telegram test failed');
  return json.message;
};

export const analyzeRawPostContent = async (rawContent: string): Promise<{
  status: string;
  total_detected: number;
  results: RawPostAnalysisResult[];
}> => {
  const res = await fetch(`${API_BASE}/analyze-raw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_content: rawContent }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to analyze raw content');
  }
  return res.json();
};

