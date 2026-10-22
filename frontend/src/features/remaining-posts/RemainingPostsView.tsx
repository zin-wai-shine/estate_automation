import React, { useState, useEffect, useMemo, useCallback } from 'react';
import JSZip from 'jszip';
import { useTheme } from '../../context/ThemeContext';
import {
  getRemainingPosts,
  deleteRemainingPost,
  clearAllRemainingPosts,
  subscribeRemainingPosts,
  loadPostIntoFacebookImport,
  getRemainingPostCode,
  toggleRemainingPostStatus,
  type RemainingPost,
  type RemainingPostImage,
} from './remainingPostsStorage';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  FiExternalLink,
  FiCopy,
  FiCheck,
  FiTrash2,
  FiDownload,
  FiSearch,
  FiX,
  FiClock,
  FiLayers,
  FiImage,
  FiFileText,
  FiChevronLeft,
  FiChevronRight,
  FiZoomIn,
  FiZoomOut,
  FiArrowRight,
  FiAlertCircle,
  FiEye,
  FiCheckCircle,
  FiCalendar,
  FiHome,
  FiTag,
  FiSliders,
  FiMaximize2,
  FiDroplet,
  FiMapPin,
  FiPlus,
} from 'react-icons/fi';
import { FaFacebook, FaTiktok } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

interface RemainingPostsViewProps {
  onNavigateTab?: (tab: string) => void;
}

interface LightboxState {
  isOpen: boolean;
  images: Array<{
    originalUrl?: string;
    enhancedUrl: string;
    photoIndex?: number;
    name?: string;
  }>;
  currentIndex: number;
  isOriginalActive?: boolean;
}

interface ExtractedEnglishInfo {
  condoName: string;
  bedrooms: string;
  size: string;
  floor: string;
  price: string;
}

function getEnglishPropertyInfo(post: RemainingPost): ExtractedEnglishInfo {
  // 1. Check AI generated copies first (Rental, TikTok, etc.)
  const aiTexts: string[] = [];
  if (post.aiGeneratedOutputs) {
    aiTexts.push(...Object.values(post.aiGeneratedOutputs));
  }
  if (post.aiGeneratedCopy) {
    aiTexts.push(post.aiGeneratedCopy);
  }

  for (const text of aiTexts) {
    if (!text) continue;
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // Look for the standard English property line with pipes:
    // e.g. "Regent Home Bangna | 1 Bedroom | 28 Sq.m. | 17th Floor, Building D | 11,000 THB"
    for (const line of lines) {
      if (line.includes('|')) {
        const parts = line.split('|').map((p) => p.trim());
        if (parts.length >= 2) {
          const hasSpecs = parts.some((p) =>
            /bedroom|bed|sq\.?m|sqm|thb|studio|floor|building/i.test(p)
          );
          if (hasSpecs) {
            const rawName = parts[0].replace(/^[#\*\-•\s]+/, '').trim();
            // Ensure rawName doesn't contain Thai characters
            const isEnglish = !/[\u0E00-\u0E7F]/.test(rawName);
            if (isEnglish && rawName.length > 2) {
              const bedPart = parts.find((p) => /bedroom|bed|studio/i.test(p));
              const sizePart = parts.find((p) => /sq\.?m/i.test(p));
              const floorPart = parts.find((p) => /floor|building/i.test(p));
              const pricePart = parts.find((p) => /thb|฿|\d+,\d+/i.test(p));

              return {
                condoName: rawName,
                bedrooms: bedPart || (post.propertyData?.bedrooms ? `${post.propertyData.bedrooms} Bed` : ''),
                size: sizePart || (post.propertyData?.size_sqm ? `${post.propertyData.size_sqm} Sq.m.` : ''),
                floor: floorPart || (post.propertyData?.floor ? `Floor ${post.propertyData.floor}` : ''),
                price: pricePart ? pricePart.replace(/[^0-9,]/g, '') : (post.propertyData?.price || ''),
              };
            }
          }
        }
      }
    }

    // 2. Scan hashtags for clean project name (e.g. #RegentHomeBangna)
    for (const line of lines) {
      if (line.includes('#')) {
        const tags = line.match(/#[a-zA-Z0-9_-]+/g) || [];
        const projectTag = tags.find((t) =>
          !/^(#condo|#bangkok|#rent|#forrent|#bts|#mrt|#thailand|#property|#realestate|#newproject|#readytomovein)$/i.test(t)
        );
        if (projectTag) {
          const splitName = projectTag.replace(/^#/, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
          if (splitName.length > 2 && !/[\u0E00-\u0E7F]/.test(splitName)) {
            return {
              condoName: splitName,
              bedrooms: post.propertyData?.bedrooms ? `${post.propertyData.bedrooms} Bed` : '',
              size: post.propertyData?.size_sqm ? `${post.propertyData.size_sqm} Sq.m.` : '',
              floor: post.propertyData?.floor ? `Floor ${post.propertyData.floor}` : '',
              price: post.propertyData?.price || '',
            };
          }
        }
      }
    }
  }

  // 3. Clean up raw project_name by removing Thai rental noises
  let fallbackName = (post.propertyData?.project_name || post.projectName || '').trim();
  fallbackName = fallbackName
    .replace(/^ให้เช่า\s*\/?\s*/i, '')
    .replace(/^For\s*Rent\s*\/?\s*/i, '')
    .replace(/\s*\/?\s*For\s*Rent/i, '')
    .replace(/\s*\d+[,.]?\d*\s*(฿|THB|บาท)?$/i, '')
    .trim();

  // If fallbackName is still Thai or empty, try nearest transit or location
  if (/^[\u0E00-\u0E7F\s\W\d]+$/.test(fallbackName) || !fallbackName) {
    if (post.propertyData?.nearest_transit && !/[\u0E00-\u0E7F]/.test(post.propertyData.nearest_transit)) {
      fallbackName = `Condo near ${post.propertyData.nearest_transit}`;
    } else if (post.propertyData?.location && !/[\u0E00-\u0E7F]/.test(post.propertyData.location)) {
      fallbackName = `Condo in ${post.propertyData.location}`;
    } else {
      fallbackName = 'Bangkok Condo Listing';
    }
  }

  return {
    condoName: fallbackName,
    bedrooms: post.propertyData?.bedrooms ? `${post.propertyData.bedrooms} Bed` : '',
    size: post.propertyData?.size_sqm ? `${post.propertyData.size_sqm} Sq.m.` : '',
    floor: post.propertyData?.floor ? `Floor ${post.propertyData.floor}` : '',
    price: post.propertyData?.price || '',
  };
}

interface FormatMeta {
  title: string;
  icon: string;
  charCount: string;
  wordCount: string;
}

function getFormatInfo(boxKey: string, index: number, copyText: string): FormatMeta {
  const k = boxKey.toLowerCase();
  let title = `Format ${index + 1}`;
  let icon = '📋';

  if (k.includes('rental')) {
    title = 'Rental Listing Copy';
    icon = '📋';
  } else if (k.includes('tiktok')) {
    title = 'TikTok Video Script';
    icon = '🎬';
  } else if (k.includes('sale')) {
    title = 'Sale & Yield Summary';
    icon = '🏷️';
  } else if (k.includes('line')) {
    title = 'LINE OA Blast';
    icon = '💬';
  } else if (k.includes('media') || k.includes('caption') || k.includes('social')) {
    title = 'Social Media Caption';
    icon = '📱';
  } else {
    // Check text hints
    if (/tiktok|hook|scene|voiceover/i.test(copyText)) {
      title = 'TikTok Script';
      icon = '🎬';
    } else if (/rental|deposit|terms|bts|mrt|condo/i.test(copyText)) {
      title = index === 0 ? 'Rental Listing Copy' : `Rental Format ${index + 1}`;
      icon = '📋';
    } else if (/sale|yield|roi|price/i.test(copyText)) {
      title = 'Sale Listing Copy';
      icon = '🏷️';
    }
  }

  const charCount = copyText.length.toLocaleString();
  const wordCount = copyText.trim() ? copyText.trim().split(/\s+/).length.toLocaleString() : '0';

  return { title, icon, charCount, wordCount };
}

export const RemainingPostsView: React.FC<RemainingPostsViewProps> = ({ onNavigateTab }) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const [posts, setPosts] = useState<RemainingPost[]>(() => getRemainingPosts());
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook' | 'tiktok'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_posted' | 'posted'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Detail Modal ("View the whole of things") State
  const [viewingPost, setViewingPost] = useState<RemainingPost | null>(null);
  const [modalActiveCopyKey, setModalActiveCopyKey] = useState<string>('default');
  const [isModalCaptionExpanded, setIsModalCaptionExpanded] = useState<boolean>(false);

  // Lightbox Modal state
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // Subscribe to storage changes in real time
  useEffect(() => {
    const unsubscribe = subscribeRemainingPosts(() => {
      const latest = getRemainingPosts();
      setPosts(latest);
      // Keep viewing post updated if it is currently open
      setViewingPost((prev) => {
        if (!prev) return null;
        return latest.find((p) => p.id === prev.id) || null;
      });
    });
    return unsubscribe;
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Toggle Posted / Not Posted status
  const handleToggleStatus = (post: RemainingPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = toggleRemainingPostStatus(post.id);
    if (updated) {
      showToast(`Status updated to ${updated.isPosted ? '"Posted"' : '"Not Posted"'}!`);
    }
  };

  // Open in Facebook Import
  const handleOpenInFacebookImport = (post: RemainingPost) => {
    loadPostIntoFacebookImport(post);
    if (onNavigateTab) {
      onNavigateTab('facebook-import');
    }
  };

  // Open Detail Modal
  const handleOpenDetailModal = (post: RemainingPost) => {
    setViewingPost(post);
    const boxKeys = post.aiGeneratedOutputs ? Object.keys(post.aiGeneratedOutputs) : [];
    setModalActiveCopyKey(boxKeys[0] || 'default');
    setIsModalCaptionExpanded(false);
  };

  // Download Post Photos as ZIP
  const handleDownloadPhotosZip = async (post: RemainingPost) => {
    showToast(`Packaging ${post.originalImages?.length || 0} photos...`);
    try {
      const zip = new JSZip();
      const folderName = (post.propertyData?.project_name || post.projectName || 'post_photos').replace(/[^a-zA-Z0-9_-]/g, '_');
      const folder = zip.folder(folderName);

      for (let i = 0; i < (post.originalImages || []).length; i++) {
        const img = post.originalImages[i];
        const isWatermarked = post.watermarkedPhotos && post.watermarkedPhotos[img.index];
        const isEnhanced = post.enhancedPhotos && post.enhancedPhotos[img.index];
        const targetUrl = isWatermarked
          ? post.watermarkedPhotos![img.index]
          : isEnhanced
          ? post.enhancedPhotos[img.index]
          : (img.stored_url || img.source_url);

        try {
          const fetchUrl = targetUrl.startsWith('http')
            ? targetUrl
            : `http://localhost:8085${targetUrl}`;
          const res = await fetch(fetchUrl);
          const blob = await res.blob();
          const fileName = `photo_${img.index}${isWatermarked ? '_watermarked' : isEnhanced ? '_enhanced' : ''}.jpg`;
          folder?.file(fileName, blob);
        } catch (e) {
          console.warn(`Failed to package photo #${img.index} in zip:`, e);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${folderName}_photos.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Photos downloaded successfully!');
    } catch (err: any) {
      console.error('Failed to create photos zip:', err);
      showToast('Error downloading photos');
    }
  };

  // Filter posts
  const filteredPosts = useMemo(() => {
    let list = posts;

    // Filter by Platform (Facebook vs TikTok)
    if (platformFilter === 'tiktok') {
      list = list.filter(
        (p) =>
          p.platform === 'tiktok' ||
          p.socialMediaType === 'tiktok' ||
          p.source?.platform === 'tiktok' ||
          Boolean(p.facebook_url && p.facebook_url.includes('tiktok'))
      );
    } else if (platformFilter === 'facebook') {
      list = list.filter(
        (p) =>
          p.platform !== 'tiktok' &&
          p.socialMediaType !== 'tiktok' &&
          p.source?.platform !== 'tiktok' &&
          !Boolean(p.facebook_url && p.facebook_url.includes('tiktok'))
      );
    }

    // Filter by Posted status
    if (statusFilter === 'posted') {
      list = list.filter((p) => Boolean(p.isPosted));
    } else if (statusFilter === 'not_posted') {
      list = list.filter((p) => !Boolean(p.isPosted));
    }

    // Filter by text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => {
        const code = getRemainingPostCode(p).toLowerCase();
        const condo = (p.propertyData?.project_name || p.projectName || '').toLowerCase();
        const caption = (p.caption || '').toLowerCase();
        const location = (p.propertyData?.location || '').toLowerCase();
        const price = (p.propertyData?.price || '').toLowerCase();
        const bedrooms = (p.propertyData?.bedrooms || '').toLowerCase();
        const availableDate = (p.propertyData?.move_in_status || '').toLowerCase();
        return (
          code.includes(q) ||
          condo.includes(q) ||
          caption.includes(q) ||
          location.includes(q) ||
          price.includes(q) ||
          bedrooms.includes(q) ||
          availableDate.includes(q) ||
          (p.facebook_url && p.facebook_url.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [posts, platformFilter, statusFilter, searchQuery]);

  const postedCount = useMemo(() => posts.filter((p) => Boolean(p.isPosted)).length, [posts]);
  const notPostedCount = useMemo(() => posts.filter((p) => !Boolean(p.isPosted)).length, [posts]);
  const fbCount = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.platform !== 'tiktok' &&
          p.socialMediaType !== 'tiktok' &&
          p.source?.platform !== 'tiktok' &&
          !Boolean(p.facebook_url && p.facebook_url.includes('tiktok'))
      ).length,
    [posts]
  );
  const ttCount = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.platform === 'tiktok' ||
          p.socialMediaType === 'tiktok' ||
          p.source?.platform === 'tiktok' ||
          Boolean(p.facebook_url && p.facebook_url.includes('tiktok'))
      ).length,
    [posts]
  );

  // Open Lightbox
  const handleOpenLightbox = (post: RemainingPost, startIndex = 0) => {
    if (!post.originalImages || post.originalImages.length === 0) return;
    const galleryItems = post.originalImages.map((img) => ({
      originalUrl: img.stored_url || img.source_url,
      enhancedUrl: (post.enhancedPhotos && post.enhancedPhotos[img.index]) || img.stored_url || img.source_url,
      photoIndex: img.index,
      name: `Photo #${img.index}`,
    }));

    setLightbox({
      isOpen: true,
      images: galleryItems,
      currentIndex: startIndex,
      isOriginalActive: false,
    });
    setLightboxZoom(1);
  };

  const handleNextLightbox = useCallback(() => {
    setLightbox((prev) => {
      if (!prev || prev.images.length <= 1) return prev;
      return {
        ...prev,
        currentIndex: (prev.currentIndex + 1) % prev.images.length,
        isOriginalActive: false,
      };
    });
    setLightboxZoom(1);
  }, []);

  const handlePrevLightbox = useCallback(() => {
    setLightbox((prev) => {
      if (!prev || prev.images.length <= 1) return prev;
      return {
        ...prev,
        currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length,
        isOriginalActive: false,
      };
    });
    setLightboxZoom(1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightbox?.isOpen) {
        setLightbox(null);
      } else if (lightbox?.isOpen && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
        handleNextLightbox();
      } else if (lightbox?.isOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
        handlePrevLightbox();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox?.isOpen, handleNextLightbox, handlePrevLightbox]);

  const activeLightboxItem = lightbox?.images[lightbox.currentIndex];
  const activeViewUrl = lightbox?.isOriginalActive
    ? activeLightboxItem?.originalUrl || activeLightboxItem?.enhancedUrl
    : activeLightboxItem?.enhancedUrl;

  return (
    <div
      style={{
        padding: '1.5rem',
        maxWidth: '1440px',
        margin: '0 auto',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#10B981',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <FiCheck />
          {toastMessage}
        </div>
      )}

      {/* Embedded CSS for property cards & gallery */}
      <style>{`
        .property-card {
          border-color: var(--border-color);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .property-card:hover {
          border-color: rgba(255, 255, 255, 0.3);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
        }
        .property-card-img {
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .property-card:hover .property-card-img {
          transform: scale(1.06);
        }
        .gallery-thumb-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.625rem;
          max-height: 520px;
          overflow-y: auto;
          padding: 2px 4px 2px 2px;
        }
        .gallery-thumb-grid::-webkit-scrollbar {
          width: 5px;
        }
        .gallery-thumb-grid::-webkit-scrollbar-track {
          background: transparent;
        }
        .gallery-thumb-grid::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 4px;
        }
        .gallery-thumb-item {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          min-height: 0;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .gallery-thumb-item:hover {
          border-color: rgba(59, 130, 246, 0.7) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
        }
        .gallery-thumb-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .gallery-thumb-item:hover .gallery-thumb-img {
          transform: scale(1.06);
        }
      `}</style>

      {/* ======================================================== */}
      {/* PAGE HEADER                                              */}
      {/* ======================================================== */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          paddingBottom: '0.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.025em',
              }}
            >
              Remaining Posts
            </h1>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.08)',
                color: isDark ? '#93C5FD' : '#2563EB',
                border: isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(37, 99, 235, 0.2)',
              }}
            >
              {posts.length} {posts.length === 1 ? 'listing' : 'listings'}
            </span>
          </div>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              margin: '0.375rem 0 0 0',
            }}
          >
            Review saved Facebook listings, manage AI captions, and track posting status.
          </p>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {posts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearAllModal(true)}
              style={{
                height: '36px',
                fontSize: '0.8125rem',
                padding: '0 0.875rem',
                color: 'var(--status-danger, #EF4444)',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
              }}
            >
              <FiTrash2 style={{ marginRight: '6px' }} />
              Clear All
            </Button>
          )}

          {onNavigateTab && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigateTab('facebook-import')}
              style={{
                height: '36px',
                fontSize: '0.8125rem',
                padding: '0 1rem',
                borderRadius: '8px',
                fontWeight: 600,
              }}
            >
              <FiPlus style={{ marginRight: '6px', fontSize: '15px' }} />
              Import New Post
            </Button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* FILTER & SEARCH TOOLBAR (Clean & Minimal)                */}
      {/* ======================================================== */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.875rem',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0 0.75rem',
            height: '36px',
            width: '280px',
            maxWidth: '100%',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          <FiSearch style={{ color: 'var(--text-muted)', fontSize: '14px', marginRight: '8px', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search code, condo, price, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
            >
              <FiX style={{ fontSize: '13px' }} />
            </button>
          )}
        </div>

        {/* Filter Tabs Container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          {/* Platform Filter Tabs (All / Facebook / TikTok) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F4F4F5',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '3px',
              gap: '2px',
            }}
          >
            {[
              { id: 'all', label: 'All', count: posts.length, icon: null },
              { id: 'facebook', label: 'Facebook', count: fbCount, icon: <FaFacebook style={{ color: '#1877F2', fontSize: '11px' }} /> },
              { id: 'tiktok', label: 'TikTok', count: ttCount, icon: <FaTiktok style={{ color: '#FE2C55', fontSize: '10px' }} /> },
            ].map((item) => {
              const active = platformFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPlatformFilter(item.id as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: active ? 600 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: active
                      ? (isDark ? '#27272A' : '#FFFFFF')
                      : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: active ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      opacity: active ? 0.9 : 0.6,
                      fontWeight: 500,
                    }}
                  >
                    ({item.count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status Filter Tabs (All / Not Posted / Posted) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F4F4F5',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '3px',
              gap: '2px',
            }}
          >
            {[
              { id: 'all', label: 'All Status', count: posts.length },
              { id: 'not_posted', label: 'Not Posted', count: notPostedCount, dot: '#94A3B8' },
              { id: 'posted', label: 'Posted', count: postedCount, dot: '#22C55E' },
            ].map((item) => {
              const active = statusFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: active ? 600 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: active
                      ? (isDark ? '#27272A' : '#FFFFFF')
                      : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: active ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.dot && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: item.dot,
                        display: 'inline-block',
                      }}
                    />
                  )}
                  <span>{item.label}</span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      opacity: active ? 0.9 : 0.6,
                      fontWeight: 500,
                    }}
                  >
                    ({item.count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PREMIUM PROPERTIES CARD GRID                             */}
      {/* ======================================================== */}
      {filteredPosts.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '1rem',
            padding: '4rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.08)',
              color: isDark ? '#60A5FA' : '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}
          >
            <FiLayers />
          </div>
          <div>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {searchQuery || statusFilter !== 'all'
                ? 'No matching property listings found'
                : 'No remaining posts yet'}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.375rem 0 0 0', maxWidth: '420px' }}>
              {searchQuery || statusFilter !== 'all'
                ? 'Try clearing your search query or reset your status filter.'
                : 'Processed Facebook listings with copywriting formats and photos are automatically saved here.'}
            </p>
          </div>
          {onNavigateTab && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigateTab('facebook-import')}
              style={{ marginTop: '0.5rem' }}
            >
              Go to Facebook Import
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 245px))',
              gap: '1.125rem',
              alignItems: 'stretch',
            }}
          >
            {filteredPosts.map((post) => {
              const isTikTok =
                post.platform === 'tiktok' ||
                post.socialMediaType === 'tiktok' ||
                post.source?.platform === 'tiktok' ||
                Boolean(post.facebook_url && post.facebook_url.includes('tiktok'));
              const code = getRemainingPostCode(post);
              const englishInfo = getEnglishPropertyInfo(post);
              let condoName = englishInfo.condoName;
              if (isTikTok && condoName.startsWith('Facebook Post #')) {
                condoName = condoName.replace('Facebook Post #', 'TikTok Post #');
              } else if (isTikTok && condoName === 'Bangkok Condo Listing') {
                condoName = 'TikTok Property Listing';
              }
              const firstPhoto = post.originalImages && post.originalImages[0];
              const hasWatermarkedPhoto = Boolean(post.watermarkedPhotos && Object.keys(post.watermarkedPhotos).length > 0);
              const hasEnhancedPhoto = Boolean(post.enhancedPhotos && Object.keys(post.enhancedPhotos).length > 0);
              const thumbnailSrc = firstPhoto
                ? ((hasWatermarkedPhoto && post.watermarkedPhotos?.[firstPhoto.index]) ||
                   (hasEnhancedPhoto && post.enhancedPhotos[firstPhoto.index]) ||
                   firstPhoto.stored_url ||
                   firstPhoto.source_url)
                : null;
              const thumbFinalUrl = thumbnailSrc
                ? (thumbnailSrc.startsWith('http') ? thumbnailSrc : `http://localhost:8085${thumbnailSrc}`)
                : null;

              // Bedroom info
              const bedroomsText = englishInfo.bedrooms || (post.propertyData?.bedrooms
                ? `${post.propertyData.bedrooms} Bed`
                : post.propertyData?.size_sqm
                ? 'Studio'
                : '-');

              // Price info
              const rawPrice = englishInfo.price || post.propertyData?.price || '';
              const numPrice = Number(rawPrice.replace(/,/g, ''));
              const priceVal = isNaN(numPrice) || !numPrice ? '' : numPrice.toLocaleString();
              const isRent = (post.propertyData?.listing_type || 'RENT').toUpperCase() === 'RENT';
              const isPosted = Boolean(post.isPosted);

              return (
                <div
                  key={post.id}
                  className="property-card"
                  onClick={() => handleOpenDetailModal(post)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: 'pointer',
                    backgroundColor: isDark ? '#141414' : '#F4F4F5',
                    boxShadow: isDark
                      ? '0 2px 10px rgba(0, 0, 0, 0.4)'
                      : '0 1px 6px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  {/* Square Image */}
                  {thumbFinalUrl ? (
                    <img
                      src={thumbFinalUrl}
                      alt={condoName}
                      className="property-card-img"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <FiImage style={{ fontSize: '36px', opacity: 0.4 }} />
                    </div>
                  )}

                  {/* Top Floating Controls */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      right: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      zIndex: 2,
                    }}
                  >
                    {/* Left: Listing Type & Platform Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(0, 0, 0, 0.65)',
                          color: '#FFFFFF',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                        }}
                      >
                        {isRent ? 'For Rent' : 'For Sale'}
                      </span>

                      {isTikTok ? (
                        <span
                          title="TikTok Listing"
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            padding: '3px 7px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(0, 0, 0, 0.65)',
                            color: '#FFFFFF',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(254, 44, 85, 0.4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <FaTiktok style={{ color: '#FE2C55', fontSize: '9px' }} />
                          <span>TikTok</span>
                        </span>
                      ) : (
                        <span
                          title="Facebook Listing"
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            padding: '3px 7px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(0, 0, 0, 0.65)',
                            color: '#FFFFFF',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(24, 119, 242, 0.4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <FaFacebook style={{ color: '#1877F2', fontSize: '10px' }} />
                          <span>Facebook</span>
                        </span>
                      )}
                    </div>

                    {/* Right: Status Pill & Delete Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(post);
                        }}
                        title="Click to toggle status"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          backgroundColor: 'rgba(0, 0, 0, 0.65)',
                          color: '#FFFFFF',
                          backdropFilter: 'blur(8px)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: isPosted ? '#22C55E' : '#A1A1AA',
                            display: 'inline-block',
                          }}
                        />
                        <span>{isPosted ? 'Posted' : 'Not Posted'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(post.id);
                        }}
                        title="Delete listing (ask confirmation)"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          backgroundColor: 'rgba(0, 0, 0, 0.65)',
                          color: '#FFFFFF',
                          backdropFilter: 'blur(8px)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <FiTrash2 style={{ fontSize: '11px' }} />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Overlay: Condo name, Price, Bedrooms */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '1.5rem 0.75rem 0.75rem 0.75rem',
                      background: 'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.45) 30%, rgba(0, 0, 0, 0.9) 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      zIndex: 2,
                    }}
                  >
                    {/* Condo Name (English from AI format) */}
                    <h3
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        lineHeight: 1.3,
                        color: '#FFFFFF',
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={condoName}
                    >
                      {condoName}
                    </h3>

                    {/* Price & Bedrooms Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                        <span
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            color: '#FFFFFF',
                          }}
                        >
                          {priceVal ? `฿${priceVal}` : 'POA'}
                        </span>
                        {priceVal && isRent && (
                          <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'rgba(255, 255, 255, 0.75)' }}>
                            / mo
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          color: 'rgba(255, 255, 255, 0.9)',
                          backgroundColor: 'rgba(255, 255, 255, 0.16)',
                          backdropFilter: 'blur(4px)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          flexShrink: 0,
                        }}
                      >
                        {bedroomsText}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* LISTINGS COUNTER FOOTER */}
          <div
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              Showing <strong>{filteredPosts.length}</strong> of <strong>{posts.length}</strong> property listings
            </span>
            <span>
              {postedCount} Posted · {notPostedCount} Not Posted
            </span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DETAIL MODAL: 2 COLUMNS (LEFT: FORMAT, RIGHT: IMAGES)    */}
      {/* ======================================================== */}
      {viewingPost && (() => {
        const isTikTok =
          viewingPost.platform === 'tiktok' ||
          viewingPost.socialMediaType === 'tiktok' ||
          viewingPost.source?.platform === 'tiktok' ||
          Boolean(viewingPost.facebook_url && viewingPost.facebook_url.includes('tiktok'));
        const code = getRemainingPostCode(viewingPost);
        const englishInfo = getEnglishPropertyInfo(viewingPost);
        let condoName = englishInfo.condoName;
        if (isTikTok && condoName.startsWith('Facebook Post #')) {
          condoName = condoName.replace('Facebook Post #', 'TikTok Post #');
        } else if (isTikTok && condoName === 'Bangkok Condo Listing') {
          condoName = 'TikTok Property Listing';
        }
        const isRent = (viewingPost.propertyData?.listing_type || 'RENT').toUpperCase() === 'RENT';
        const rawPrice = englishInfo.price || viewingPost.propertyData?.price || '';
        const numPrice = Number(rawPrice.replace(/,/g, ''));
        const priceVal = isNaN(numPrice) || !numPrice ? '' : numPrice.toLocaleString();
        const rawMoveIn = (viewingPost.propertyData?.move_in_status || '').trim();
        const isReadyToMoveIn = !rawMoveIn || rawMoveIn.toLowerCase().includes('ready');
        const availableDateDisplay = isReadyToMoveIn ? 'Ready to Move In' : rawMoveIn;
        const isPosted = Boolean(viewingPost.isPosted);

        const bedroomsText = englishInfo.bedrooms || (viewingPost.propertyData?.bedrooms
          ? `${viewingPost.propertyData.bedrooms} Bed`
          : viewingPost.propertyData?.size_sqm
          ? 'Studio'
          : '-');

        const copyOutputs = viewingPost.aiGeneratedOutputs || {};
        const copyKeys = Object.keys(copyOutputs);
        const formatEntries = copyKeys.length > 0
          ? copyKeys.map((key, idx) => ({
              key,
              text: copyOutputs[key] || '',
              ...getFormatInfo(key, idx, copyOutputs[key] || ''),
            }))
          : viewingPost.aiGeneratedCopy
          ? [{
              key: 'default',
              text: viewingPost.aiGeneratedCopy,
              ...getFormatInfo('default', 0, viewingPost.aiGeneratedCopy),
            }]
          : [];

        const activeEntry = formatEntries.find((f) => f.key === modalActiveCopyKey) || formatEntries[0];
        const activeCopyText = activeEntry ? activeEntry.text : (viewingPost.aiGeneratedCopy || '');

        return (
          <Modal
            isOpen={Boolean(viewingPost)}
            onClose={() => setViewingPost(null)}
            maxWidth="1200px"
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {condoName}
                </span>

                {/* Social Media Type Badge */}
                {isTikTok ? (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(254, 44, 85, 0.15)',
                      color: '#FE2C55',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid rgba(254, 44, 85, 0.3)',
                    }}
                  >
                    <FaTiktok style={{ fontSize: '10px' }} />
                    <span>TikTok</span>
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(24, 119, 242, 0.15)',
                      color: '#1877F2',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid rgba(24, 119, 242, 0.3)',
                    }}
                  >
                    <FaFacebook style={{ fontSize: '11px' }} />
                    <span>Facebook</span>
                  </span>
                )}

                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {code}
                </span>
                {priceVal && (
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    ฿{priceVal} {isRent ? '/ mo' : ''}
                  </span>
                )}
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {bedroomsText}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  · {availableDateDisplay}
                </span>
              </div>
            }
            headerExtra={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(viewingPost)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-secondary)',
                  }}
                  title="Click to toggle posted status"
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: isPosted ? '#22C55E' : '#A1A1AA',
                      display: 'inline-block',
                    }}
                  />
                  <span>{isPosted ? 'Posted' : 'Not Posted'}</span>
                </button>

                {viewingPost.facebook_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(viewingPost.facebook_url, '_blank')}
                    title={`Open original post on ${isTikTok ? 'TikTok' : 'Facebook'}`}
                  >
                    {isTikTok ? (
                      <FaTiktok style={{ marginRight: '5px', color: '#FE2C55' }} />
                    ) : (
                      <FaFacebook style={{ marginRight: '5px', color: '#1877F2' }} />
                    )}
                    {isTikTok ? 'View on TikTok' : 'View on Facebook'}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewingPost(null);
                    handleOpenInFacebookImport(viewingPost);
                  }}
                >
                  <FiExternalLink style={{ marginRight: '5px' }} />
                  {isTikTok ? 'Open in Import' : 'Open in FB Import'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirmId(viewingPost.id)}
                  style={{
                    color: 'var(--status-danger, #EF4444)',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.25)',
                  }}
                  title="Delete this listing"
                >
                  <FiTrash2 style={{ marginRight: '5px' }} />
                  Delete
                </Button>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* TWO COLUMN WORKSPACE: LEFT = FORMATS, RIGHT = IMAGES */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
                  gap: '1.25rem',
                  alignItems: 'start',
                }}
              >
                {/* ========================================= */}
                {/* LEFT COLUMN: READY TO POST FORMATS       */}
                {/* ========================================= */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '1.125rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem',
                  }}
                >
                  {/* Header & Multi-Format Tabs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.08)',
                            color: isDark ? '#60A5FA' : '#2563EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                          }}
                        >
                          <FiFileText />
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Content Formats
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                            color: 'var(--text-muted)',
                            fontWeight: 500,
                          }}
                        >
                          {formatEntries.length} {formatEntries.length === 1 ? 'format' : 'formats'}
                        </span>
                      </div>
                    </div>

                    {/* Multiple Format Switcher Tabs */}
                    {formatEntries.length > 1 && (
                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          padding: '4px',
                          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.03)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          overflowX: 'auto',
                        }}
                      >
                        {formatEntries.map((fmt, idx) => {
                          const active = (modalActiveCopyKey === fmt.key) || (!modalActiveCopyKey && idx === 0);
                          return (
                            <button
                              key={fmt.key}
                              type="button"
                              onClick={() => setModalActiveCopyKey(fmt.key)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: active ? 600 : 500,
                                cursor: 'pointer',
                                border: 'none',
                                backgroundColor: active
                                  ? (isDark ? '#27272A' : '#FFFFFF')
                                  : 'transparent',
                                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                                boxShadow: active ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span>{fmt.icon}</span>
                              <span>{fmt.title}</span>
                              <span
                                style={{
                                  fontSize: '0.6875rem',
                                  opacity: active ? 0.85 : 0.6,
                                  fontWeight: 400,
                                }}
                              >
                                ({fmt.charCount})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Professional Content Format Box */}
                  {activeCopyText ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* Format Box Header Toolbar */}
                      <div
                        style={{
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                          border: '1px solid var(--border-color)',
                          borderBottom: 'none',
                          borderRadius: '8px 8px 0 0',
                          padding: '0.625rem 0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                        }}
                      >
                        {/* Format title and stats */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {activeEntry?.title || 'Listing Copy'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>·</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {activeEntry?.charCount || '0'} chars · {activeEntry?.wordCount || '0'} words
                          </span>
                        </div>

                        {/* Dedicated Copy Button */}
                        <button
                          type="button"
                          onClick={() => handleCopyText(activeCopyText, `modal_${modalActiveCopyKey}`)}
                          title="Copy full format text to clipboard"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: copiedKey === `modal_${modalActiveCopyKey}`
                              ? '#10B981'
                              : (isDark ? '#3B82F6' : '#2563EB'),
                            color: '#FFFFFF',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {copiedKey === `modal_${modalActiveCopyKey}` ? (
                            <>
                              <FiCheck style={{ fontSize: '13px' }} />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <FiCopy style={{ fontSize: '13px' }} />
                              <span>Copy Format</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Text Display Body */}
                      <div
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: '0 0 8px 8px',
                          padding: '1.125rem 1.25rem',
                          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#FFFFFF',
                          fontSize: '0.84375rem',
                          lineHeight: 1.65,
                          color: 'var(--text-primary)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: 'inherit',
                          minHeight: '340px',
                          maxHeight: '460px',
                          overflowY: 'auto',
                        }}
                      >
                        {activeCopyText}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                        padding: '2rem 1rem',
                        textAlign: 'center',
                        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.02)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      No AI formatted copies generated for this listing yet. Click &quot;Open in FB Import&quot; to generate copies.
                    </div>
                  )}

                  {/* Original Facebook Caption (Collapsible) */}
                  {viewingPost.caption && (
                    <div
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.625rem 0.875rem',
                        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.01)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                        onClick={() => setIsModalCaptionExpanded(!isModalCaptionExpanded)}
                      >
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                          Original Facebook caption ({viewingPost.caption.length.toLocaleString()} chars)
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {isModalCaptionExpanded ? 'Collapse' : 'Expand'}
                          <FiChevronRight
                            style={{
                              transform: isModalCaptionExpanded ? 'rotate(90deg)' : 'none',
                              transition: 'transform 0.15s ease',
                            }}
                          />
                        </span>
                      </div>

                      {isModalCaptionExpanded && (
                        <div
                          style={{
                            marginTop: '0.625rem',
                            padding: '0.75rem',
                            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#F9FAFB',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            lineHeight: 1.55,
                            whiteSpace: 'pre-wrap',
                            color: 'var(--text-secondary)',
                            maxHeight: '160px',
                            overflowY: 'auto',
                          }}
                        >
                          {viewingPost.caption}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ========================================= */}
                {/* RIGHT COLUMN: IMAGES GALLERY              */}
                {/* ========================================= */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '1.125rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FiImage style={{ color: 'var(--text-secondary)', fontSize: '15px' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Images ({viewingPost.originalImages?.length || 0})
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        · Click to enlarge
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadPhotosZip(viewingPost)}
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        transition: 'all 0.15s ease',
                      }}
                      title="Download photos as zip"
                    >
                      <FiDownload style={{ fontSize: '12px' }} />
                      <span>Download (.zip)</span>
                    </button>
                  </div>

                  {viewingPost.originalImages && viewingPost.originalImages.length > 0 ? (
                    <div className="gallery-thumb-grid">
                      {viewingPost.originalImages.map((img, idx) => {
                        const isWatermarked = viewingPost.watermarkedPhotos && viewingPost.watermarkedPhotos[img.index];
                        const isEnhanced = viewingPost.enhancedPhotos && viewingPost.enhancedPhotos[img.index];
                        const imgSrc = isWatermarked
                          ? viewingPost.watermarkedPhotos![img.index]
                          : isEnhanced
                          ? viewingPost.enhancedPhotos[img.index]
                          : (img.stored_url || img.source_url);
                        const fullUrl = imgSrc.startsWith('http') ? imgSrc : `http://localhost:8085${imgSrc}`;

                        return (
                          <div
                            key={img.index}
                            onClick={() => handleOpenLightbox(viewingPost, idx)}
                            className="gallery-thumb-item"
                            title={`Photo #${img.index} - Click to view`}
                          >
                            <img
                              src={fullUrl}
                              alt={`Photo #${img.index}`}
                              className="gallery-thumb-img"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.opacity = '0.35';
                              }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                top: '6px',
                                left: '6px',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                backdropFilter: 'blur(6px)',
                                WebkitBackdropFilter: 'blur(6px)',
                                color: '#FFFFFF',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                lineHeight: 1.2,
                                zIndex: 2,
                                pointerEvents: 'none',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                              }}
                            >
                              #{img.index}
                            </span>
                            {isEnhanced && (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: '6px',
                                  right: '6px',
                                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                                  backdropFilter: 'blur(6px)',
                                  WebkitBackdropFilter: 'blur(6px)',
                                  color: '#38BDF8',
                                  border: '1px solid rgba(56, 189, 248, 0.35)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.5625rem',
                                  fontWeight: 600,
                                  lineHeight: 1.2,
                                  zIndex: 2,
                                  pointerEvents: 'none',
                                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                                }}
                              >
                                AI ✨
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem' }}>
                      No photos extracted for this post.
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: CLEAN SPECIFICATIONS SUMMARY */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.875rem 1rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Condo Project</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                    {condoName}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Listing Code</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                    {code}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Price</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                    {priceVal ? `฿${priceVal} ${isRent ? '/ month' : ''}` : '-'}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Bed / Bath / Size</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                    {bedroomsText}{' '}
                    {viewingPost.propertyData?.bathrooms ? `· ${viewingPost.propertyData.bathrooms} Bath` : ''}{' '}
                    {viewingPost.propertyData?.size_sqm ? `· ${viewingPost.propertyData.size_sqm} sqm` : ''}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Available Date</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                    {availableDateDisplay}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Floor & Location</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                    {viewingPost.propertyData?.floor ? `Fl ${viewingPost.propertyData.floor}` : ''} {viewingPost.propertyData?.location ? `· ${viewingPost.propertyData.location}` : '-'}
                  </p>
                </div>
              </div>

              {/* Bottom Close Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingPost(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ======================================================== */}
      {/* FULLSCREEN STUDIO LIGHTBOX MODAL                         */}
      {/* ======================================================== */}
      {lightbox && lightbox.isOpen && activeLightboxItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={() => setLightbox(null)}
        >
          {/* Top Bar */}
          <div
            style={{
              height: '56px',
              padding: '0 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(10, 14, 20, 0.85)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.875rem' }}>
                Photo {lightbox.currentIndex + 1} of {lightbox.images.length}
              </span>
              {activeLightboxItem.originalUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) =>
                      prev ? { ...prev, isOriginalActive: !prev.isOriginalActive } : null
                    )
                  }
                  style={{
                    backgroundColor: lightbox.isOriginalActive ? '#F59E0B' : '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {lightbox.isOriginalActive ? 'Showing Original' : 'Showing Enhanced (AI)'}
                </button>
              )}
            </div>

            {/* Zoom & Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(z + 0.25, 3))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  padding: '6px',
                }}
                title="Zoom In"
              >
                <FiZoomIn style={{ fontSize: '16px' }} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(z - 0.25, 0.5))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  padding: '6px',
                }}
                title="Zoom Out"
              >
                <FiZoomOut style={{ fontSize: '16px' }} />
              </button>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  padding: '6px',
                  marginLeft: '8px',
                }}
                title="Close Lightbox"
              >
                <FiX style={{ fontSize: '20px' }} />
              </button>
            </div>
          </div>

          {/* Center Image with Prev / Next Navigation */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.images.length > 1 && (
              <button
                type="button"
                onClick={handlePrevLightbox}
                style={{
                  position: 'absolute',
                  left: '20px',
                  zIndex: 10,
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <FiChevronLeft style={{ fontSize: '22px' }} />
              </button>
            )}

            {activeViewUrl && (
              <img
                src={activeViewUrl.startsWith('http') ? activeViewUrl : `http://localhost:8085${activeViewUrl}`}
                alt="Fullscreen preview"
                style={{
                  maxWidth: '90vw',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  transform: `scale(${lightboxZoom})`,
                  transition: 'transform 0.15s ease',
                  userSelect: 'none',
                }}
              />
            )}

            {lightbox.images.length > 1 && (
              <button
                type="button"
                onClick={handleNextLightbox}
                style={{
                  position: 'absolute',
                  right: '20px',
                  zIndex: 10,
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <FiChevronRight style={{ fontSize: '22px' }} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (() => {
        const targetPost = posts.find((p) => p.id === deleteConfirmId);
        const targetName = targetPost ? getEnglishPropertyInfo(targetPost).condoName : 'this listing';
        return (
          <Modal
            isOpen={Boolean(deleteConfirmId)}
            onClose={() => setDeleteConfirmId(null)}
            title="Delete Listing"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>"{targetName}"</strong> from Remaining Posts? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    deleteRemainingPost(deleteConfirmId);
                    setDeleteConfirmId(null);
                    if (viewingPost?.id === deleteConfirmId) {
                      setViewingPost(null);
                    }
                    showToast('Listing removed from Remaining Posts');
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Clear All Confirmation Modal */}
      {showClearAllModal && (
        <Modal
          isOpen={showClearAllModal}
          onClose={() => setShowClearAllModal(false)}
          title="Clear All Remaining Posts"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Are you sure you want to delete all stored remaining listings? This will wipe the stored listings list.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="outline" size="sm" onClick={() => setShowClearAllModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  clearAllRemainingPosts();
                  setShowClearAllModal(false);
                  setViewingPost(null);
                  showToast('All remaining posts cleared');
                }}
              >
                Clear All
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
