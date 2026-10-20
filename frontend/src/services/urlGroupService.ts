import { apiUrl } from './apiClient';

export interface UrlGroupItem {
  id: number;
  serial: string;
  raw_text: string;
  urls_json?: string;
  url_count: number;
  created_at: string;
  updated_at: string;
}

export async function fetchUrlGroups(): Promise<UrlGroupItem[]> {
  const res = await fetch(apiUrl('/api/url-groups'));
  if (!res.ok) {
    throw new Error('Failed to fetch URL groups');
  }
  const json = await res.json();
  return json.data || [];
}

export async function createUrlGroup(rawText: string): Promise<UrlGroupItem> {
  const res = await fetch(apiUrl('/api/url-groups'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw_text: rawText }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save URL group');
  }

  const json = await res.json();
  return json.data;
}

export async function deleteUrlGroup(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/url-groups/${id}`), {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to delete URL group');
  }
}

export async function clearAllUrlGroups(): Promise<void> {
  const res = await fetch(apiUrl('/api/url-groups'), {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to clear URL groups');
  }
}
