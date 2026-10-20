import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  FiClock,
  FiSearch,
  FiTrash2,
  FiExternalLink,
  FiEye,
  FiCheckCircle,
  FiShare2,
  FiCopy,
  FiCheck,
  FiLayers,
  FiCalendar,
  FiCode,
} from 'react-icons/fi';
import { FaFacebook, FaTiktok } from 'react-icons/fa6';
import {
  getAutoPostHistory,
  deleteAutoPostItem,
  clearAutoPostHistory,
  subscribeAutoPostHistory,
  type AutoPostItem,
} from './autoPostStorage';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { apiUrl } from '../../services/apiClient';
import { fetchTikTokPosts } from '../../services/tiktokService';

interface PostHistoryViewProps {
  onNavigateTab?: (tab: string) => void;
}

// Helper to extract listing/property code from formatted content/caption (safe against any type)
export function extractListingCode(caption?: unknown, fallbackId?: unknown): string {
  const capStr = typeof caption === 'string' ? caption : '';
  const idStr = fallbackId != null ? String(fallbackId) : '';

  if (!capStr) {
    return idStr ? idStr.replace(/^(FB-DB-|TT-DB-|autopost_)/, '').slice(0, 12) : '-';
  }

  // 1. Matches: "Code : C240101", "Listing Code: #1234", "รหัส : ABC", "Code: C-1234"
  const codeRegex = /(?:code|listing\s*code|property\s*code|รหัส(?:ทรัพย์)?|ref(?:\s*no\.?)?|id)\s*[:：#\-]?\s*([A-Za-z0-9\-_#]+)/i;
  const match = capStr.match(codeRegex);
  if (match && match[1] && match[1].length >= 2) {
    return match[1].trim();
  }

  // 2. Look for [CODE] bracket pattern like [C12345] or [BK-102]
  const bracketMatch = capStr.match(/\[([A-Za-z0-9\-_]{2,15})\]/);
  if (bracketMatch && bracketMatch[1]) {
    return bracketMatch[1].trim();
  }

  // 3. Look for explicit hashtag like #C12345 or #BK102
  const hashMatch = capStr.match(/#([A-Za-z]+[0-9]{3,})/);
  if (hashMatch && hashMatch[1]) {
    return hashMatch[1].trim();
  }

  return idStr ? idStr.replace(/^(FB-DB-|TT-DB-|autopost_)/, '').slice(0, 12) : '-';
}

// Helper to extract bedrooms from specs, caption, or projectName
export function extractBedrooms(specs?: unknown, caption?: unknown, projectName?: unknown): string {
  const specsStr = typeof specs === 'string' ? specs : '';
  const capStr = typeof caption === 'string' ? caption : '';
  const projStr = typeof projectName === 'string' ? projectName : '';
  const combined = `${specsStr} ${capStr} ${projStr}`;

  if (/studio/i.test(combined)) {
    return 'Studio';
  }

  const match = combined.match(/(\d+)\s*(?:bed(?:room)?|br|ห้องนอน)/i);
  if (match && match[1]) {
    return `${match[1]} Bed`;
  }

  return specsStr ? specsStr.split('·')[0].trim() : '-';
}

// Helper to extract price
export function extractPrice(price?: unknown, caption?: unknown): string {
  if (price != null && price !== '') {
    const p = typeof price === 'number' ? `฿${price.toLocaleString()}` : String(price).trim();
    if (p) {
      return p.startsWith('฿') || p.toLowerCase().includes('baht') || p.toLowerCase().includes('thb') ? p : `฿${p}`;
    }
  }

  const capStr = typeof caption === 'string' ? caption : '';
  if (!capStr) return '-';

  const match = capStr.match(/(?:฿|THB|ราคา|price[:\s]*)\s*([0-9,]+(?:\.\d+)?)\s*(?:บาท|\/month|\/mo|\/เดือน|thb)?/i);
  if (match && match[1]) {
    return `฿${match[1]}`;
  }

  const numMatch = capStr.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*(?:บาท|\/mo|\/month|\/เดือน|thb|THB)/i);
  if (numMatch && numMatch[1]) {
    return `฿${numMatch[1]}`;
  }

  return '-';
}

// Helper to extract condo / project name
export function extractCondoName(projectName?: unknown, headline?: unknown, caption?: unknown): string {
  const pName = typeof projectName === 'string' ? projectName.trim() : (projectName != null ? String(projectName).trim() : '');
  if (pName) return pName;

  const hLine = typeof headline === 'string' ? headline.trim() : (headline != null ? String(headline).trim() : '');
  if (hLine) return hLine;

  const capStr = typeof caption === 'string' ? caption : '';
  if (!capStr) return '—';

  const firstLine = capStr.split('\n')[0].trim().replace(/^[🏙️✨💎🏠🏢📍\s*#]+/, '');
  if (firstLine.length > 0 && firstLine.length < 50) {
    return firstLine.split('|')[0].trim();
  }
  return '—';
}

import { ErrorBoundary } from '../../components/ui/ErrorBoundary';

const PostHistoryViewContent: React.FC<PostHistoryViewProps> = ({ onNavigateTab }) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const [history, setHistory] = useState<AutoPostItem[]>(() => {
    // Purge any legacy sample items from localStorage and normalize
    try {
      const raw = localStorage.getItem('estate_social_autopost_history_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned: AutoPostItem[] = [];
          for (const p of parsed) {
            if (!p || typeof p !== 'object') continue;
            const idStr = String(p.id || '');
            if (!idStr || idStr === 'PUB-202610-001' || idStr === 'PUB-202610-002') continue;
            cleaned.push({
              ...p,
              id: idStr,
              projectName: p.projectName != null ? String(p.projectName) : '',
              price: p.price != null ? String(p.price) : '',
              specs: p.specs != null ? String(p.specs) : '',
              status: p.status || 'PUBLISHED',
              createdAt: typeof p.createdAt === 'number' && !isNaN(p.createdAt) ? p.createdAt : Date.now(),
              images: [],
            });
          }
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('estate_social_autopost_history_v1', JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
    } catch {}
    return getAutoPostHistory();
  });

  const [historyFilter, setHistoryFilter] = useState<'all' | 'published' | 'scheduled' | 'failed'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyDetailItem, setHistoryDetailItem] = useState<AutoPostItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRetryingPostId, setIsRetryingPostId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  useEffect(() => {
    const unsub = subscribeAutoPostHistory((items) => {
      setHistory(Array.isArray(items) ? items : []);
    });

    // Fetch DB posts from backend (Facebook + TikTok)
    const fetchDbPosts = async () => {
      try {
        const res = await fetch(apiUrl('/api/facebook/posts?limit=100'));
        let mappedFbItems: AutoPostItem[] = [];
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.posts) && data.posts.length > 0) {
            mappedFbItems = data.posts
              .filter((p: any) => p && (p.id != null || p.facebook_post_id))
              .map((p: any) => {
                const slot = p.page_slot || (p.page_id === '494870343703559' || p.page_id === '61593000699921' ? 2 : 1);
                const captionStr = typeof p.caption === 'string' ? p.caption : '';
                const bedroomMatch = captionStr.match(/(\d+)\s*(bed|bedroom|ห้องนอน)/i);
                const bedroomVal = bedroomMatch ? bedroomMatch[1] : '';
                const pId = String(p.id != null ? p.id : Date.now());

                return {
                  id: `FB-DB-${pId}`,
                  projectName: p.headline ? String(p.headline) : '',
                  listingType: 'RENT' as const,
                  price: '',
                  specs: bedroomVal ? `${bedroomVal} Bed` : '',
                  images: [], // Never store images in history
                  originalUrl: p.original_url || undefined,
                  facebook: {
                    enabled: true,
                    pageId: p.page_id || '',
                    pageName: p.page_name || (slot === 2 ? 'Facebook Page 2' : 'Facebook Page 1'),
                    headline: p.headline || '',
                    caption: captionStr,
                    cta: '',
                    hashtags: p.hashtags || '',
                  },
                  instagram: { enabled: false, accountId: '', accountName: '', caption: '', firstCommentHashtags: '', locationTag: '' },
                  tiktok: { enabled: false, accountId: '', accountName: '', hook: '', caption: '', sound: '', privacy: 'public' as const, allowComments: true, allowDuet: true },
                  scheduleType: p.status === 'SCHEDULED' ? 'SCHEDULED' as const : 'NOW' as const,
                  scheduledAt: p.scheduled_at,
                  status: p.status === 'PUBLISHED' ? 'PUBLISHED' as const : p.status === 'SCHEDULED' ? 'SCHEDULED' as const : 'FAILED' as const,
                  createdAt: p.created_at ? (new Date(p.created_at).getTime() || Date.now()) : Date.now(),
                  platformResults: {
                    facebook: {
                      status: p.status === 'PUBLISHED' ? 'success' as const : p.status === 'SCHEDULED' ? 'scheduled' as const : 'failed' as const,
                      postId: p.facebook_post_id,
                      postUrl: p.permalink_url,
                      error: p.error_message,
                      pageId: p.page_id,
                      pageSlot: slot,
                      timestamp: p.published_at ? (new Date(p.published_at).getTime() || Date.now()) : Date.now(),
                    },
                    instagram: { status: 'skipped' as const },
                    tiktok: { status: 'skipped' as const },
                  },
                };
              });
          }
        }

        // Fetch TikTok posts
        let mappedTikTokItems: AutoPostItem[] = [];
        try {
          const ttPosts = await fetchTikTokPosts();
          if (Array.isArray(ttPosts) && ttPosts.length > 0) {
            mappedTikTokItems = ttPosts
              .filter((tp: any) => tp && tp.id != null)
              .map((tp) => {
                const isSuccess = tp.status === 'SUCCESS';
                const isFailed = tp.status === 'FAILED';
                const tpId = String(tp.id);
                return {
                  id: `TT-DB-${tpId}`,
                  projectName: tp.title ? String(tp.title).slice(0, 60) : `TikTok (${tp.username || 'User'})`,
                  listingType: 'RENT' as const,
                  price: '',
                  specs: '',
                  images: [], // Never store images in history
                  originalUrl: undefined,
                  facebook: { enabled: false, pageId: '', pageName: '', headline: '', caption: '', cta: '', hashtags: '' },
                  instagram: { enabled: false, accountId: '', accountName: '', caption: '', firstCommentHashtags: '', locationTag: '' },
                  tiktok: {
                    enabled: true,
                    accountId: String(tp.tiktok_account_id || ''),
                    accountName: tp.username ? `@${tp.username}` : '',
                    hook: '',
                    caption: tp.title || '',
                    sound: tp.auto_add_music ? 'Auto Sound' : 'None',
                    privacy: (tp.privacy_level as any) || 'public',
                    allowComments: !tp.disable_comment,
                    allowDuet: true,
                  },
                  scheduleType: 'NOW' as const,
                  status: isSuccess ? 'PUBLISHED' as const : isFailed ? 'FAILED' as const : 'PARTIAL' as const,
                  createdAt: tp.created_at ? (new Date(tp.created_at).getTime() || Date.now()) : Date.now(),
                  platformResults: {
                    facebook: { status: 'skipped' as const },
                    instagram: { status: 'skipped' as const },
                    tiktok: {
                      status: isSuccess ? 'success' as const : isFailed ? 'failed' as const : 'scheduled' as const,
                      postId: tp.tiktok_post_id || tp.publish_id,
                      postUrl: tp.share_url || (tp.publish_id ? `https://tiktok.com/publish/${tp.publish_id}` : undefined),
                      error: tp.error_message,
                      timestamp: tp.published_at ? (new Date(tp.published_at).getTime() || Date.now()) : Date.now(),
                    },
                  },
                };
              });
          }
        } catch (e) {
          console.error('Failed to fetch TikTok posts:', e);
        }

        const allBackendItems = [...mappedFbItems, ...mappedTikTokItems];
        setHistory((prev) => {
          const combined = Array.isArray(prev) ? [...prev] : [];
          for (const item of allBackendItems) {
            if (!combined.some((c) => c && String(c.id) === String(item.id))) {
              combined.unshift(item);
            }
          }
          return combined.sort((a, b) => {
            const timeA = typeof a?.createdAt === 'number' && !isNaN(a.createdAt) ? a.createdAt : 0;
            const timeB = typeof b?.createdAt === 'number' && !isNaN(b.createdAt) ? b.createdAt : 0;
            return timeB - timeA;
          });
        });
      } catch (e) {
        console.error('Failed to fetch DB posts:', e);
      }
    };

    fetchDbPosts();
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRetryPost = async (dbId: string) => {
    setIsRetryingPostId(`FB-DB-${dbId}`);
    try {
      const res = await fetch(apiUrl(`/api/facebook/posts/${dbId}/retry`), { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('✅ Post retried and published!');
        setHistory((prev) =>
          prev.map((item) => {
            if (String(item?.id) === `FB-DB-${dbId}`) {
              return {
                ...item,
                status: 'PUBLISHED',
                platformResults: {
                  ...item.platformResults,
                  facebook: { status: 'success', postId: data.facebook_post_id, postUrl: data.permalink_url, timestamp: Date.now() },
                },
              };
            }
            return item;
          })
        );
      } else {
        showToast(`❌ Retry failed: ${data.message || 'Error'}`);
      }
    } catch {
      showToast('❌ Network error retrying post');
    } finally {
      setIsRetryingPostId(null);
    }
  };

  const handleDeleteItem = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    const idStr = String(id || '');
    if (!idStr) return;
    if (confirm('Delete this record from history?')) {
      if (idStr.startsWith('FB-DB-')) {
        const dbId = idStr.replace('FB-DB-', '');
        fetch(apiUrl(`/api/facebook/posts/${dbId}`), { method: 'DELETE' }).catch(() => {});
      }
      deleteAutoPostItem(idStr);
      setHistory((prev) => prev.filter((i) => i && String(i.id) !== idStr));
      showToast('Record deleted.');
      if (historyDetailItem && String(historyDetailItem.id) === idStr) setHistoryDetailItem(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Delete ALL posting records and clean all history? This will delete all database records and local storage.')) return;
    setIsDeletingAll(true);
    try {
      // Call backend DELETE /api/facebook/posts to delete all DB records
      await fetch(apiUrl('/api/facebook/posts'), { method: 'DELETE' }).catch(() => {});

      // Clear localStorage
      clearAutoPostHistory();
      setHistory([]);
      showToast('✅ All history data removed and cleaned.');
    } catch {
      showToast('❌ Error clearing records.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const getCaption = (item?: AutoPostItem | null): string => {
    if (!item) return '';
    return item.facebook?.caption || item.tiktok?.caption || item.instagram?.caption || '';
  };

  const getPostUrl = (item?: AutoPostItem | null): string | undefined => {
    if (!item) return undefined;
    return (
      item.platformResults?.facebook?.postUrl ||
      item.platformResults?.facebookPage1?.postUrl ||
      item.platformResults?.facebookPage2?.postUrl ||
      item.platformResults?.tiktok?.postUrl ||
      item.platformResults?.instagram?.postUrl
    );
  };

  // Filter history
  const filteredHistory = useMemo(() => {
    if (!Array.isArray(history)) return [];
    return history.filter((item) => {
      if (!item || item.id == null) return false;
      const itemId = String(item.id);
      const status = item.status || 'PUBLISHED';
      if (historyFilter === 'published' && status !== 'PUBLISHED') return false;
      if (historyFilter === 'scheduled' && status !== 'SCHEDULED') return false;
      if (historyFilter === 'failed' && status !== 'FAILED') return false;

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const caption = getCaption(item);
        const code = extractListingCode(caption, itemId).toLowerCase();
        const matchTitle = (item.projectName || '').toLowerCase().includes(q);
        const matchId = itemId.toLowerCase().includes(q);
        const matchCode = code.includes(q);
        const matchCaption = caption.toLowerCase().includes(q);
        const matchUrl = (item.originalUrl || '').toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchCode && !matchCaption && !matchUrl) return false;
      }
      return true;
    });
  }, [history, historyFilter, historySearch]);

  // Statistics
  const stats = useMemo(() => {
    const valid = Array.isArray(history) ? history.filter((i): i is AutoPostItem => Boolean(i && i.id != null)) : [];
    return {
      total: valid.length,
      published: valid.filter((i) => i.status === 'PUBLISHED').length,
      scheduled: valid.filter((i) => i.status === 'SCHEDULED').length,
      failed: valid.filter((i) => i.status === 'FAILED').length,
    };
  }, [history]);


  const statusColors: Record<string, { bg: string; color: string; border: string }> = {
    PUBLISHED: { bg: 'rgba(34,197,94,0.1)', color: '#22C55E', border: 'rgba(34,197,94,0.25)' },
    SCHEDULED: { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: 'rgba(59,130,246,0.25)' },
    FAILED:    { bg: 'rgba(239,68,68,0.1)',  color: '#EF4444', border: 'rgba(239,68,68,0.25)' },
    PARTIAL:   { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)' },
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          backgroundColor: '#1E293B', color: '#FFFFFF',
          padding: '10px 18px', borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)', zIndex: 9999,
          fontSize: '0.875rem', fontWeight: 500,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(37,99,235,0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem' }}>
              <FiClock />
            </div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Post History</h1>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0 40px' }}>
            Clean listing post records — Code, Condo Name, Price, Bedroom, Original Link, Status, Post Link
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={isDeletingAll}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(239,68,68,0.3)',
                backgroundColor: 'rgba(239,68,68,0.08)',
                color: '#EF4444',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: isDeletingAll ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <FiTrash2 style={{ fontSize: '0.875rem' }} />
              <span>{isDeletingAll ? 'Cleaning...' : 'Clean All Data'}</span>
            </button>
          )}
          <Button variant="primary" onClick={() => onNavigateTab ? onNavigateTab('auto-post') : window.location.assign('/auto-post')} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 600, padding: '8px 16px' }}>
            <FiShare2 />
            <span>Create Auto Post</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem' }}>
        {[
          { label: 'Total Posts', value: stats.total, icon: <FiLayers />, bg: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(37,99,235,0.08)', color: 'var(--accent-primary)' },
          { label: 'Published', value: stats.published, icon: <FiCheckCircle />, bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
          { label: 'Scheduled', value: stats.scheduled, icon: <FiCalendar />, bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' }}>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Posting Records</h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Code · Condo Name · Price · Bed Room · Original Link · Status · Post Link
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem' }} />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search by code, condo, link..."
                style={{ padding: '7px 12px 7px 32px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none', minWidth: '220px' }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-main)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'published', label: 'Published' },
                { id: 'scheduled', label: 'Scheduled' },
                { id: 'failed', label: 'Failed' },
              ].map((tab) => (
                <button key={tab.id} type="button" onClick={() => setHistoryFilter(tab.id as any)}
                  style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', backgroundColor: historyFilter === tab.id ? 'var(--accent-primary)' : 'transparent', color: historyFilter === tab.id ? '#FFFFFF' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Clean Table: Code | Condo Name | Price | Bed Room | Original Link | Status | Post Link | Actions */}
        {filteredHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
            <FiClock style={{ fontSize: '3rem', marginBottom: '0.75rem', opacity: 0.35 }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>No records found</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem' }}>
              {history.length === 0 ? 'No posts published yet. Post history is clean.' : 'No records match your search filter.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>Code</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Condo Name</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Price</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Bed Room</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Original Link</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Post Link</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => {
                  const itemId = String(item?.id || '');
                  const caption = getCaption(item);
                  const postUrl = getPostUrl(item);
                  const sc = (item?.status && statusColors[item.status]) || statusColors['FAILED'];
                  const isFbDb = itemId.startsWith('FB-DB-');
                  const isTt = itemId.startsWith('TT-DB-');

                  // Derived clean fields
                  const code = extractListingCode(caption, itemId);
                  const condoName = extractCondoName(item?.projectName, item?.facebook?.headline, caption);
                  const price = extractPrice(item?.price, caption);
                  const bedrooms = extractBedrooms(item?.specs, caption, item?.projectName);

                  return (
                    <tr
                      key={itemId}
                      onClick={() => setHistoryDetailItem(item)}
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {/* Code from formatted content code */}
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(37,99,235,0.08)', color: 'var(--accent-primary)', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', border: '1px solid rgba(59,130,246,0.2)' }}>
                          <FiCode style={{ fontSize: '0.75rem' }} />
                          <span>{code}</span>
                        </div>
                      </td>

                      {/* Condo Name */}
                      <td style={{ padding: '12px', maxWidth: '240px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={condoName}>
                          {condoName}
                        </div>
                      </td>

                      {/* Price */}
                      <td style={{ padding: '12px', color: price !== '-' ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {price}
                      </td>

                      {/* Bed Room */}
                      <td style={{ padding: '12px', color: bedrooms !== '-' ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {bedrooms}
                      </td>

                      {/* Original Link */}
                      <td style={{ padding: '12px' }} onClick={(e) => e.stopPropagation()}>
                        {item.originalUrl ? (
                          <a
                            href={item.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={item.originalUrl}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#1877F2', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(24,119,242,0.08)' }}
                          >
                            <FaFacebook style={{ fontSize: '0.75rem' }} />
                            <span>Original Link</span>
                            <FiExternalLink style={{ fontSize: '0.625rem' }} />
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.6875rem', fontWeight: 700, backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, display: 'inline-block' }}>
                            {item.status || 'PUBLISHED'}
                          </span>
                          {item.status === 'FAILED' && isFbDb && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRetryPost(itemId.replace('FB-DB-', '')); }}
                              disabled={isRetryingPostId === itemId}
                              style={{ alignSelf: 'flex-start', padding: '2px 8px', fontSize: '0.625rem', borderRadius: '4px', border: '1px solid #1877F2', backgroundColor: 'rgba(24,119,242,0.1)', color: '#1877F2', cursor: 'pointer', fontWeight: 600 }}
                            >
                              {isRetryingPostId === itemId ? 'Retrying...' : '↻ Retry'}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Post Link */}
                      <td style={{ padding: '12px' }} onClick={(e) => e.stopPropagation()}>
                        {postUrl ? (
                          <a
                            href={postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: isTt ? (isDark ? '#00F2FE' : '#0891B2') : '#1877F2', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', backgroundColor: isTt ? 'rgba(0,242,254,0.08)' : 'rgba(24,119,242,0.08)' }}
                          >
                            {isTt ? <FaTiktok style={{ fontSize: '0.75rem' }} /> : <FaFacebook style={{ fontSize: '0.75rem' }} />}
                            <span>Post Link</span>
                            <FiExternalLink style={{ fontSize: '0.625rem' }} />
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setHistoryDetailItem(item)}
                            title="View details"
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <FiEye />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteItem(itemId, e)}
                            title="Delete record"
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', backgroundColor: 'transparent', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal (No photo/image storage) */}
      {historyDetailItem && (
        <Modal
          isOpen={Boolean(historyDetailItem)}
          onClose={() => setHistoryDetailItem(null)}
          title={`Listing Record: ${extractCondoName(historyDetailItem.projectName, historyDetailItem.facebook?.headline, getCaption(historyDetailItem))}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>

            {/* Key fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Code', value: extractListingCode(getCaption(historyDetailItem), historyDetailItem.id) },
                { label: 'Condo Name', value: extractCondoName(historyDetailItem.projectName, historyDetailItem.facebook?.headline, getCaption(historyDetailItem)) },
                { label: 'Price', value: extractPrice(historyDetailItem.price, getCaption(historyDetailItem)) },
                { label: 'Bed Room', value: extractBedrooms(historyDetailItem.specs, getCaption(historyDetailItem), historyDetailItem.projectName) },
                { label: 'Status', value: historyDetailItem.status || 'PUBLISHED' },
                {
                  label: 'Created At',
                  value: (() => {
                    try {
                      const d = new Date(historyDetailItem.createdAt);
                      return isNaN(d.getTime()) ? '-' : d.toLocaleString();
                    } catch {
                      return '-';
                    }
                  })(),
                },
              ].map((f) => (
                <div key={f.label} style={{ backgroundColor: 'var(--bg-main)', borderRadius: '8px', padding: '0.625rem 0.75rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>{f.label}</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* Original Input Link */}
            {historyDetailItem.originalUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <FiExternalLink style={{ color: 'var(--accent-primary)', flexShrink: 0, fontSize: '0.875rem' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '2px' }}>Original Link</div>
                  <a href={historyDetailItem.originalUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'none', wordBreak: 'break-all' }}>
                    {historyDetailItem.originalUrl}
                  </a>
                </div>
              </div>
            )}

            {/* Post Link */}
            {getPostUrl(historyDetailItem) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <FaFacebook style={{ color: '#1877F2', flexShrink: 0, fontSize: '0.875rem' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '2px' }}>Published Post Link</div>
                  <a href={getPostUrl(historyDetailItem)!} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: '#1877F2', textDecoration: 'none', wordBreak: 'break-all' }}>
                    {getPostUrl(historyDetailItem)}
                  </a>
                </div>
              </div>
            )}

            {/* Formatted Content */}
            {getCaption(historyDetailItem) && (
              <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Formatted Content (Caption)</div>
                  <button
                    type="button"
                    onClick={() => handleCopy(getCaption(historyDetailItem), 'modal')}
                    style={{ border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedKey === 'modal' ? <FiCheck /> : <FiCopy />}
                    <span>Copy</span>
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', maxHeight: '240px', overflowY: 'auto', lineHeight: 1.6 }}>
                  {getCaption(historyDetailItem)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <Button variant="secondary" onClick={() => setHistoryDetailItem(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export const PostHistoryView: React.FC<PostHistoryViewProps> = (props) => (
  <ErrorBoundary fallbackTitle="Post History View Error">
    <PostHistoryViewContent {...props} />
  </ErrorBoundary>
);
