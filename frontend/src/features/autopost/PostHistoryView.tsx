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
  FiImage,
  FiCalendar,
  FiCopy,
  FiCheck,
  FiLayers,
  FiAlertCircle,
} from 'react-icons/fi';
import {
  FaFacebook,
  FaInstagram,
  FaTiktok,
} from 'react-icons/fa6';
import {
  getAutoPostHistory,
  deleteAutoPostItem,
  clearAutoPostHistory,
  subscribeAutoPostHistory,
  type AutoPostItem,
  type AutoPostImage,
} from './autoPostStorage';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { apiUrl } from '../../services/apiClient';
import { fetchTikTokPosts, type TikTokPublishPost } from '../../services/tiktokService';

interface PostHistoryViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const PostHistoryView: React.FC<PostHistoryViewProps> = ({ onNavigateTab }) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const [history, setHistory] = useState<AutoPostItem[]>(() => getAutoPostHistory());
  const [historyFilter, setHistoryFilter] = useState<'all' | 'facebook' | 'page1' | 'page2' | 'instagram' | 'tiktok' | 'scheduled'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyDetailItem, setHistoryDetailItem] = useState<AutoPostItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isRetryingPostId, setIsRetryingPostId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAutoPostHistory((items) => {
      setHistory(items);
    });

    // Also fetch DB posts from backend (Facebook + TikTok)
    const fetchDbPosts = async () => {
      try {
        const res = await fetch(apiUrl('/api/facebook/posts?limit=50'));
        let mappedFbItems: AutoPostItem[] = [];
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.posts) && data.posts.length > 0) {
            mappedFbItems = data.posts.map((p: any) => {
              let parsedImgs: string[] = [];
              try {
                parsedImgs = JSON.parse(p.image_urls || '[]');
              } catch (e) {}

              const autoPostImgs: AutoPostImage[] = parsedImgs.map((url, i) => ({
                id: `db-img-${p.id}-${i}`,
                url,
                name: `photo_${i + 1}.jpg`,
                isCover: i === 0,
              }));

              const slot = p.page_slot || (p.page_id === '494870343703559' || p.page_id === '61593000699921' ? 2 : 1);

              return {
                id: `FB-DB-${p.id}`,
                projectName: p.headline || `Facebook Post (Page ${slot})`,
                listingType: 'RENT',
                price: '',
                specs: '',
                images: autoPostImgs,
                facebook: {
                  enabled: true,
                  pageId: p.page_id,
                  pageName: p.page_name || (slot === 2 ? 'Facebook Page 2' : 'Facebook Page 1'),
                  headline: p.headline,
                  caption: p.caption,
                  cta: '',
                  hashtags: p.hashtags || '',
                },
                instagram: { enabled: false, accountId: '', accountName: '', caption: '', firstCommentHashtags: '', locationTag: '' },
                tiktok: { enabled: false, accountId: '', accountName: '', hook: '', caption: '', sound: '', privacy: 'public', allowComments: true, allowDuet: true },
                scheduleType: p.status === 'SCHEDULED' ? 'SCHEDULED' : 'NOW',
                scheduledAt: p.scheduled_at,
                status: p.status === 'PUBLISHED' ? 'PUBLISHED' : p.status === 'SCHEDULED' ? 'SCHEDULED' : 'FAILED',
                createdAt: new Date(p.created_at).getTime() || Date.now(),
                platformResults: {
                  facebook: {
                    status: p.status === 'PUBLISHED' ? 'success' : p.status === 'SCHEDULED' ? 'scheduled' : 'failed',
                    postId: p.facebook_post_id,
                    postUrl: p.permalink_url,
                    error: p.error_message,
                    pageId: p.page_id,
                    pageSlot: slot,
                    timestamp: p.published_at ? new Date(p.published_at).getTime() : Date.now(),
                  },
                  instagram: { status: 'skipped' },
                  tiktok: { status: 'skipped' },
                },
              };
            });
          }
        }

        // Fetch real TikTok posts
        let mappedTikTokItems: AutoPostItem[] = [];
        try {
          const ttPosts = await fetchTikTokPosts();
          if (Array.isArray(ttPosts) && ttPosts.length > 0) {
            mappedTikTokItems = ttPosts.map((tp) => {
              let photoList: string[] = [];
              try {
                photoList = JSON.parse(tp.photo_images || '[]');
              } catch (e) {}

              const autoPostImgs: AutoPostImage[] = photoList.map((url, i) => ({
                id: `tt-img-${tp.id}-${i}`,
                url,
                name: `tiktok_photo_${i + 1}.jpg`,
                isCover: i === 0,
              }));

              const isSuccess = tp.status === 'SUCCESS';
              const isFailed = tp.status === 'FAILED';

              return {
                id: `TT-DB-${tp.id}`,
                projectName: tp.title ? tp.title.slice(0, 40) + '...' : `TikTok Photo Mode (${tp.username})`,
                listingType: 'RENT',
                price: '',
                specs: '',
                images: autoPostImgs,
                facebook: {
                  enabled: false,
                  pageId: '',
                  pageName: '',
                  headline: '',
                  caption: '',
                  cta: '',
                  hashtags: '',
                },
                instagram: { enabled: false, accountId: '', accountName: '', caption: '', firstCommentHashtags: '', locationTag: '' },
                tiktok: {
                  enabled: true,
                  accountId: String(tp.tiktok_account_id),
                  accountName: `@${tp.username}`,
                  hook: '',
                  caption: tp.title,
                  sound: tp.auto_add_music ? 'Auto Recommended Sound' : 'None',
                  privacy: tp.privacy_level as any,
                  allowComments: !tp.disable_comment,
                  allowDuet: true,
                },
                scheduleType: 'NOW',
                status: isSuccess ? 'PUBLISHED' : isFailed ? 'FAILED' : 'PARTIAL',
                createdAt: tp.created_at ? new Date(tp.created_at).getTime() : Date.now(),
                platformResults: {
                  facebook: { status: 'skipped' },
                  instagram: { status: 'skipped' },
                  tiktok: {
                    status: isSuccess ? 'success' : isFailed ? 'failed' : 'scheduled',
                    postId: tp.tiktok_post_id || tp.publish_id,
                    postUrl: tp.share_url || (tp.publish_id ? `https://tiktok.com/publish/${tp.publish_id}` : undefined),
                    error: tp.error_message,
                    timestamp: tp.published_at ? new Date(tp.published_at).getTime() : Date.now(),
                  },
                },
              };
            });
          }
        } catch (e) {
          console.error('Failed to fetch TikTok posts:', e);
        }

        const allBackendItems = [...mappedFbItems, ...mappedTikTokItems];

        // Merge with local storage without duplicates
        setHistory((prev) => {
          const combined = [...prev];
          for (const item of allBackendItems) {
            if (!combined.some((c) => c.id === item.id)) {
              combined.unshift(item);
            }
          }
          return combined.sort((a, b) => b.createdAt - a.createdAt);
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
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
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
      const res = await fetch(`http://localhost:8085/api/facebook/posts/${dbId}/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('✅ Post retried and published successfully!');
        setHistory((prev) =>
          prev.map((item) => {
            if (item.id === `FB-DB-${dbId}`) {
              return {
                ...item,
                status: 'PUBLISHED',
                platformResults: {
                  ...item.platformResults,
                  facebook: {
                    status: 'success',
                    postId: data.facebook_post_id,
                    postUrl: data.permalink_url,
                    timestamp: Date.now(),
                  },
                },
              };
            }
            return item;
          })
        );
      } else {
        showToast(`❌ Retry failed: ${data.message || 'Error'}`);
      }
    } catch (err: any) {
      showToast('❌ Network error retrying post');
    } finally {
      setIsRetryingPostId(null);
    }
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this posting record from history?')) {
      deleteAutoPostItem(id);
      showToast('Record deleted.');
      if (historyDetailItem?.id === id) {
        setHistoryDetailItem(null);
      }
    }
  };

  // Filter history
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Platform filter
      if (historyFilter === 'facebook' && !item.facebook?.enabled && !item.platformResults?.facebookPage1 && !item.platformResults?.facebookPage2) {
        return false;
      }
      if (historyFilter === 'page1') {
        const isP1 =
          item.facebook?.pageSlot === 1 ||
          item.facebook?.pageId === '1287202894475973' ||
          item.facebook?.pageId === '61568058604134' ||
          item.platformResults?.facebook?.pageId === '1287202894475973' ||
          item.platformResults?.facebook?.pageId === '61568058604134' ||
          item.platformResults?.facebookPage1?.status === 'success' ||
          item.platformResults?.facebookPage1?.status === 'scheduled';
        if (!isP1) return false;
      }
      if (historyFilter === 'page2') {
        const isP2 =
          item.facebook?.pageSlot === 2 ||
          item.facebook?.pageId === '494870343703559' ||
          item.facebook?.pageId === '61593000699921' ||
          item.platformResults?.facebook?.pageId === '494870343703559' ||
          item.platformResults?.facebook?.pageId === '61593000699921' ||
          item.platformResults?.facebookPage2?.status === 'success' ||
          item.platformResults?.facebookPage2?.status === 'scheduled';
        if (!isP2) return false;
      }
      if (historyFilter === 'instagram' && !item.instagram?.enabled) return false;
      if (historyFilter === 'tiktok' && !item.tiktok?.enabled) return false;
      if (historyFilter === 'scheduled' && item.status !== 'SCHEDULED') return false;

      // Search query
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchTitle = item.projectName.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchFb = (item.facebook?.caption || '').toLowerCase().includes(q);
        const matchIg = (item.instagram?.caption || '').toLowerCase().includes(q);
        const matchTt = (item.tiktok?.caption || '').toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchFb && !matchIg && !matchTt) return false;
      }

      return true;
    });
  }, [history, historyFilter, historySearch]);

  // Statistics
  const stats = useMemo(() => {
    const total = history.length;
    const published = history.filter((i) => i.status === 'PUBLISHED').length;
    const scheduled = history.filter((i) => i.status === 'SCHEDULED').length;
    const totalImages = history.reduce((acc, curr) => acc + (curr.images?.length || 0), 0);
    return { total, published, scheduled, totalImages };
  }, [history]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#1E293B',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            zIndex: 9999,
            fontSize: '0.875rem',
            fontWeight: 500,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Top Header Title with Quick Navigation to Create Auto Post */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.125rem',
              }}
            >
              <FiClock />
            </div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
              Post History
            </h1>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0 40px' }}>
            Review, monitor, and manage your multi-channel published and scheduled listings across Facebook, Instagram, and TikTok
          </p>
        </div>

        {/* Action Button: Navigate to New Auto Post */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button
            variant="primary"
            onClick={() => onNavigateTab ? onNavigateTab('auto-post') : window.location.assign('/auto-post')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              padding: '8px 16px',
            }}
          >
            <FiShare2 />
            <span>Create Auto Post</span>
          </Button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.875rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            <FiLayers />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Posts</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.total}</div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: '#22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            <FiCheckCircle />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Published Live</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.published}</div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            <FiCalendar />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Scheduled Posts</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.scheduled}</div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(168, 85, 247, 0.12)' : 'rgba(147, 51, 234, 0.08)',
              color: '#A855F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            <FiImage />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Photos Published</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.totalImages}</div>
          </div>
        </div>
      </div>

      {/* Main History Table Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Posting History
            </h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Post ID · Platform · Status · Errors · Published URL
            </span>
          </div>

          {/* Search & Filter Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem' }} />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history by title, ID, caption..."
                style={{
                  padding: '7px 12px 7px 32px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  minWidth: '240px',
                }}
              />
            </div>

            {/* Platform Filter Tabs */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-main)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'facebook', label: 'Facebook (All)' },
                { id: 'page1', label: 'FB Page 1' },
                { id: 'page2', label: 'FB Page 2' },
                { id: 'instagram', label: 'Instagram' },
                { id: 'tiktok', label: 'TikTok' },
                { id: 'scheduled', label: 'Scheduled' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryFilter(tab.id as any)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: historyFilter === tab.id ? 'var(--accent-primary)' : 'transparent',
                    color: historyFilter === tab.id ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {history.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (confirm('Clear all posting history records? This cannot be undone.')) {
                    clearAutoPostHistory();
                    showToast('Cleared posting history');
                  }
                }}
                style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#EF4444' }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* History Table */}
        {filteredHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
            <FiClock style={{ fontSize: '3rem', marginBottom: '0.75rem', opacity: 0.35 }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
              No posting records found
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem' }}>
              {history.length === 0
                ? 'You have not published any listings through Auto Post yet.'
                : 'No records match your active search and filter criteria.'}
            </p>
            {history.length === 0 && (
              <Button
                variant="primary"
                onClick={() => onNavigateTab ? onNavigateTab('auto-post') : window.location.assign('/auto-post')}
                style={{ fontSize: '0.8125rem' }}
              >
                Create Your First Post
              </Button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Post ID</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Property & Cover</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Platforms</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Errors</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Published URLs</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => {
                  const cover = item.images?.find((i) => i.isCover) || item.images?.[0];

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setHistoryDetailItem(item)}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Post ID */}
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {item.id}
                      </td>

                      {/* Property & Cover */}
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {cover ? (
                            <img
                              src={cover.url}
                              alt={item.projectName}
                              style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: '42px', height: '42px', borderRadius: '6px', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FiImage style={{ color: 'var(--text-muted)' }} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.projectName}</div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              {item.price} · {item.images?.length || 0} photos
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Platforms */}
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {item.platformResults?.facebookPage1?.status === 'success' && (
                            <span
                              title={`Facebook Page 1: ${item.platformResults.facebookPage1.pageName || 'Slot 1'}`}
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#1877F2',
                                color: '#FFFFFF',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                              }}
                            >
                              <FaFacebook style={{ fontSize: '0.6875rem' }} />
                              <span>P1</span>
                            </span>
                          )}
                          {item.platformResults?.facebookPage2?.status === 'success' && (
                            <span
                              title={`Facebook Page 2: ${item.platformResults.facebookPage2.pageName || 'Slot 2'}`}
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#8B5CF6',
                                color: '#FFFFFF',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                              }}
                            >
                              <FaFacebook style={{ fontSize: '0.6875rem' }} />
                              <span>P2</span>
                            </span>
                          )}
                          {(!item.platformResults?.facebookPage1 && !item.platformResults?.facebookPage2 && item.facebook?.enabled) && (
                            (() => {
                              const slot = item.facebook?.pageSlot || (item.facebook?.pageId === '494870343703559' || item.facebook?.pageId === '61593000699921' ? 2 : 1);
                              return (
                                <span
                                  title={`Facebook Page ${slot}: ${item.facebook.pageName || item.facebook.pageId}`}
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: slot === 2 ? '#8B5CF6' : '#1877F2',
                                    color: '#FFFFFF',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  <FaFacebook style={{ fontSize: '0.6875rem' }} />
                                  <span>P{slot}</span>
                                </span>
                              );
                            })()
                          )}
                          {item.instagram?.enabled && (
                            <span
                              title={`Instagram: ${item.instagram.accountName}`}
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '4px',
                                background: 'linear-gradient(45deg, #F58529, #D62976, #962FBF)',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.6875rem',
                              }}
                            >
                              <FaInstagram />
                            </span>
                          )}
                          {item.tiktok?.enabled && (
                            <span
                              title={`TikTok: ${item.tiktok.accountName}`}
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '4px',
                                backgroundColor: '#000000',
                                color: '#00F2FE',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.6875rem',
                                border: '1px solid rgba(254, 44, 85, 0.4)',
                              }}
                            >
                              <FaTiktok />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            backgroundColor:
                              item.status === 'PUBLISHED'
                                ? 'rgba(34, 197, 94, 0.12)'
                                : item.status === 'SCHEDULED'
                                ? 'rgba(59, 130, 246, 0.12)'
                                : 'rgba(239, 68, 68, 0.12)',
                            color:
                              item.status === 'PUBLISHED'
                                ? '#22C55E'
                                : item.status === 'SCHEDULED'
                                ? '#3B82F6'
                                : '#EF4444',
                            border: `1px solid ${
                              item.status === 'PUBLISHED'
                                ? 'rgba(34, 197, 94, 0.25)'
                                : item.status === 'SCHEDULED'
                                ? 'rgba(59, 130, 246, 0.25)'
                                : 'rgba(239, 68, 68, 0.25)'
                            }`,
                          }}
                        >
                          {item.status}
                        </span>
                      </td>

                      {/* Errors */}
                      <td style={{ padding: '12px' }}>
                        {item.platformResults?.facebook?.error || item.status === 'FAILED' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                              <FiAlertCircle style={{ flexShrink: 0 }} />
                              <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.platformResults?.facebook?.error || 'Publishing failed'}>
                                {item.platformResults?.facebook?.error || 'Publishing failed'}
                              </span>
                            </span>
                            {item.id.startsWith('FB-DB-') && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRetryPost(item.id.replace('FB-DB-', ''));
                                }}
                                disabled={isRetryingPostId === item.id}
                                style={{
                                  alignSelf: 'flex-start',
                                  padding: '2px 8px',
                                  fontSize: '0.6875rem',
                                  borderRadius: '4px',
                                  border: '1px solid #1877F2',
                                  backgroundColor: 'rgba(24, 119, 242, 0.1)',
                                  color: '#1877F2',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                              >
                                {isRetryingPostId === item.id ? 'Retrying...' : '↻ Retry'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#22C55E', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                            <FiCheckCircle />
                            <span>None (0 errors)</span>
                          </span>
                        )}
                      </td>

                      {/* Published URLs */}
                      <td style={{ padding: '12px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {item.platformResults?.facebookPage1?.postUrl && (
                            <a
                              href={item.platformResults.facebookPage1.postUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: '#1877F2',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.75rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(24, 119, 242, 0.08)',
                                fontWeight: 600,
                              }}
                            >
                              <FaFacebook style={{ fontSize: '0.6875rem' }} />
                              <span>View Page 1</span>
                              <FiExternalLink style={{ fontSize: '0.625rem' }} />
                            </a>
                          )}
                          {item.platformResults?.facebookPage2?.postUrl && (
                            <a
                              href={item.platformResults.facebookPage2.postUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: '#8B5CF6',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.75rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                                fontWeight: 600,
                              }}
                            >
                              <FaFacebook style={{ fontSize: '0.6875rem' }} />
                              <span>View Page 2</span>
                              <FiExternalLink style={{ fontSize: '0.625rem' }} />
                            </a>
                          )}
                          {!item.platformResults?.facebookPage1 && !item.platformResults?.facebookPage2 && item.platformResults?.facebook?.postUrl && item.facebook?.enabled && (
                            (() => {
                              const slot = item.facebook?.pageSlot || (item.facebook?.pageId === '494870343703559' || item.facebook?.pageId === '61593000699921' ? 2 : 1);
                              return (
                                <a
                                  href={item.platformResults.facebook.postUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    color: slot === 2 ? '#8B5CF6' : '#1877F2',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '0.75rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: slot === 2 ? 'rgba(139, 92, 246, 0.08)' : 'rgba(24, 119, 242, 0.08)',
                                    fontWeight: 600,
                                  }}
                                >
                                  <FaFacebook style={{ fontSize: '0.6875rem' }} />
                                  <span>View P{slot}</span>
                                  <FiExternalLink style={{ fontSize: '0.625rem' }} />
                                </a>
                              );
                            })()
                          )}
                          {item.platformResults?.instagram?.postUrl && item.instagram?.enabled && (
                            <a
                              href={item.platformResults.instagram.postUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: '#E4405F',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.75rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(228, 64, 95, 0.08)',
                              }}
                            >
                              <FaInstagram style={{ fontSize: '0.6875rem' }} />
                              <span>View IG</span>
                              <FiExternalLink style={{ fontSize: '0.625rem' }} />
                            </a>
                          )}
                          {item.platformResults?.tiktok?.postUrl && item.tiktok?.enabled && (
                            <a
                              href={item.platformResults.tiktok.postUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: isDark ? '#00F2FE' : '#0891B2',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.75rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(0, 242, 254, 0.08)',
                              }}
                            >
                              <FaTiktok style={{ fontSize: '0.6875rem' }} />
                              <span>View TT</span>
                              <FiExternalLink style={{ fontSize: '0.625rem' }} />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setHistoryDetailItem(item)}
                            title="View published copies and photos"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'transparent',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FiEye />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                            title="Delete record"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              backgroundColor: 'transparent',
                              color: '#EF4444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
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

      {/* MODAL: Detailed Record Inspection */}
      {historyDetailItem && (
        <Modal
          isOpen={Boolean(historyDetailItem)}
          onClose={() => setHistoryDetailItem(null)}
          title={`Published Record: ${historyDetailItem.projectName} (${historyDetailItem.id})`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            {/* Photos Strip */}
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Photos ({historyDetailItem.images?.length || 0})
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {historyDetailItem.images?.map((img, i) => (
                  <div
                    key={img.id || i}
                    onClick={() => setLightboxUrl(img.url)}
                    style={{
                      width: '70px',
                      height: '70px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      cursor: 'pointer',
                      border: img.isCover ? '2px solid #F59E0B' : '1px solid var(--border-color)',
                      position: 'relative',
                    }}
                    title={`${img.name} (Click to zoom)`}
                  >
                    <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Copies Per Platform */}
            {historyDetailItem.facebook?.enabled && (
              <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1877F2', fontWeight: 600, fontSize: '0.8125rem' }}>
                    <FaFacebook />
                    <span>Facebook Page ({historyDetailItem.facebook.pageName})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(historyDetailItem.facebook.caption, 'fb')}
                    style={{ border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedKey === 'fb' ? <FiCheck /> : <FiCopy />}
                    <span>Copy</span>
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                  {historyDetailItem.facebook.caption}
                </div>
              </div>
            )}

            {historyDetailItem.instagram?.enabled && (
              <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E4405F', fontWeight: 600, fontSize: '0.8125rem' }}>
                    <FaInstagram />
                    <span>Instagram ({historyDetailItem.instagram.accountName})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(historyDetailItem.instagram.caption, 'ig')}
                    style={{ border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedKey === 'ig' ? <FiCheck /> : <FiCopy />}
                    <span>Copy</span>
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                  {historyDetailItem.instagram.caption}
                </div>
              </div>
            )}

            {historyDetailItem.tiktok?.enabled && (
              <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#00F2FE' : '#0891B2', fontWeight: 600, fontSize: '0.8125rem' }}>
                    <FaTiktok />
                    <span>TikTok ({historyDetailItem.tiktok.accountName})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(historyDetailItem.tiktok.caption, 'tt')}
                    style={{ border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedKey === 'tt' ? <FiCheck /> : <FiCopy />}
                    <span>Copy</span>
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div style={{ marginBottom: '4px' }}><strong>Hook: </strong>{historyDetailItem.tiktok.hook}</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{historyDetailItem.tiktok.caption}</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setHistoryDetailItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(5px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxUrl}
            alt="Preview"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      )}
    </div>
  );
};
