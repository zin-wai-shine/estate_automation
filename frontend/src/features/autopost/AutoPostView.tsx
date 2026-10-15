import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  FiShare2,
  FiUploadCloud,
  FiImage,
  FiTrash2,
  FiStar,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiExternalLink,
  FiEye,
  FiCopy,
  FiLayers,
  FiCalendar,
  FiX,
  FiSearch,
  FiRefreshCw,
  FiSliders,
  FiPlus,
  FiInfo,
  FiMaximize2,
  FiSend,
  FiEdit3,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import {
  FaFacebook,
  FaInstagram,
  FaTiktok,
  FaHeart,
  FaComment,
  FaBookmark,
  FaRegHeart,
  FaRegComment,
  FaRegBookmark,
  FaMusic,
} from 'react-icons/fa6';
import { SiMeta } from 'react-icons/si';
import { HiSparkles } from 'react-icons/hi2';
import {
  getAutoPostHistory,
  saveAutoPostItem,
  deleteAutoPostItem,
  clearAutoPostHistory,
  subscribeAutoPostHistory,
  getStoredFbPages,
  saveStoredFbPage,
  type ConnectedAccount,
  CONNECTED_FB_PAGES,
  CONNECTED_IG_ACCOUNTS,
  CONNECTED_TIKTOK_ACCOUNTS,
  type AutoPostItem,
  type AutoPostImage,
  type SocialPlatform,
  type PlatformPublishResult,
  type ManagedPageMeta,
  syncStoredFbPagesWithMeta,
} from './autoPostStorage';
import { FacebookPageTokenManagerModal } from './FacebookPageTokenManagerModal';
import { FacebookPageSelectionModal } from './FacebookPageSelectionModal';
import {
  getRemainingPosts,
  type RemainingPost,
} from '../remaining-posts/remainingPostsStorage';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import Select from 'react-select';

interface SwitchToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeColor?: string;
  label?: string;
  disabled?: boolean;
  isDark?: boolean;
}

const SwitchToggle: React.FC<SwitchToggleProps> = ({
  checked,
  onChange,
  activeColor = 'var(--accent-primary)',
  label,
  disabled = false,
  isDark = false,
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'none',
        border: 'none',
        padding: '2px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
      }}
    >
      {label && (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: checked ? activeColor : 'var(--text-muted)',
            transition: 'color 0.2s ease',
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          width: '38px',
          height: '22px',
          borderRadius: '9999px',
          backgroundColor: checked ? activeColor : (isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)'),
          position: 'relative',
          transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: checked ? `0 2px 8px ${activeColor}55` : 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            position: 'absolute',
            top: '2px',
            left: '2px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.28)',
            transform: checked ? 'translateX(16px)' : 'translateX(0px)',
            transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </button>
  );
};

interface AutoPostViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const AutoPostView: React.FC<AutoPostViewProps> = ({ onNavigateTab }) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  // ----------------------------------------------------
  // Form State: Media & Basic Info
  // ----------------------------------------------------
  const [projectName, setProjectName] = useState('Ideo Sukhumvit 93');
  const [listingType, setListingType] = useState<'RENT' | 'SALE'>('RENT');
  const [price, setPrice] = useState('฿18,000 / mo');
  const [specs, setSpecs] = useState('Studio · 28 Sqm · 28th Floor · BTS Bang Chak 15m');

  const [images, setImages] = useState<AutoPostImage[]>([
    {
      id: 'img-1',
      url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      name: 'Living Room & Bedroom.jpg',
      isCover: true,
    },
    {
      id: 'img-2',
      url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      name: 'Kitchen & Dining Area.jpg',
      isCover: false,
    },
    {
      id: 'img-3',
      url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      name: 'Modern Bathroom.jpg',
      isCover: false,
    },
    {
      id: 'img-4',
      url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      name: 'Balcony City View.jpg',
      isCover: false,
    },
  ]);

  // Drag and drop state for images
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
  const [hoveredBadgeIndex, setHoveredBadgeIndex] = useState<number | null>(null);
  const lastSwapTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const [isDropzoneActive, setIsDropzoneActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------
  // Form State: Platform Dedicated Content Boxes
  // ----------------------------------------------------
  // Facebook Page Boxes: Page 1 (61568058604134) & Page 2 (61593000699921)
  const [fbPage1Enabled, setFbPage1Enabled] = useState(true);
  const [fbPage2Enabled, setFbPage2Enabled] = useState(true);
  const fbEnabled = fbPage1Enabled || fbPage2Enabled;
  const fbTargetMode: 'both' | 'page1' | 'page2' =
    fbPage1Enabled && fbPage2Enabled ? 'both' : fbPage2Enabled ? 'page2' : 'page1';
  const [fbPagesList, setFbPagesList] = useState<ConnectedAccount[]>(getStoredFbPages());
  const [fbPageId, setFbPageId] = useState('1287202894475973');
  const [managedPages, setManagedPages] = useState<ManagedPageMeta[]>([]);
  const [isTokenManagerModalOpen, setIsTokenManagerModalOpen] = useState(false);
  const [isPageSelectionModalOpen, setIsPageSelectionModalOpen] = useState(false);
  const [refreshingPageId, setRefreshingPageId] = useState<string | null>(null);
  const [testingPageId, setTestingPageId] = useState<string | null>(null);

  const page1Meta = useMemo(
    () => managedPages.find(p => p.slot === 1 || p.page_id === '1287202894475973'),
    [managedPages]
  );
  const page2Meta = useMemo(
    () => managedPages.find(p => p.slot === 2 || p.page_id === '494870343703559'),
    [managedPages]
  );

  const page1PageId = page1Meta?.page_id || '1287202894475973';
  const page2PageId = page2Meta?.page_id || '494870343703559';
  const page1Name = page1Meta?.name || 'Dot BKK Living';
  const page2Name = page2Meta?.name || 'Bolt Haven Realty';
  const page1Picture = page1Meta?.picture_url;
  const page2Picture = page2Meta?.picture_url;
  const page1Connected = Boolean(page1Meta?.is_connected && page1Meta?.test_passed);
  const page2Connected = Boolean(page2Meta?.is_connected && page2Meta?.test_passed);
  const page1TokenStatus = (page1Meta?.token_status || 'MISSING').toUpperCase();
  const page2TokenStatus = (page2Meta?.token_status || 'MISSING').toUpperCase();

  const formatTokenValidity = (status?: string, hasToken?: boolean) => {
    if (!hasToken || status === 'MISSING') return 'Token Missing';
    if (status === 'RECONNECT_REQUIRED' || status === 'INVALID' || status === 'EXPIRED') return 'Reconnect Required';
    if (status === 'VALID') return 'Valid';
    if (status === 'UNTESTED') return 'Untested';
    return status || 'Token Missing';
  };

  const formatTokenStatus = (status?: string, fallback = 'Ready') => {
    if (!status) return fallback;
    const s = status.trim().toUpperCase();
    switch (s) {
      case 'VALID':
        return 'Valid';
      case 'MISSING':
        return 'Token Missing';
      case 'RECONNECT_REQUIRED':
      case 'INVALID':
        return 'Reconnect Required';
      case 'EXPIRED':
        return 'Expired';
      case 'UNTESTED':
        return 'Untested';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }
  };

  // Page 1 Dedicated Content (Slot 1: 61568058604134) - Fully Isolated
  const [fbHeadline, setFbHeadline] = useState('✨ High-Floor Modern Studio at Ideo Sukhumvit 93 for Rent!');
  const [fbCaption, setFbCaption] = useState(
    `🏙️ ให้เช่าคอนโด Ideo Sukhumvit 93 ขนาด 28 ตร.ม. ชั้น 28 แต่งครบพร้อมอยู่!
ราคาเพียง 18,000 บาท/เดือน (สัญญา 1 ปี)
ติด BTS บางจาก เพียง 15 เมตร เดินทางสะดวกมาก วิวเมืองโล่งสวย
เฟอร์นิเจอร์และเครื่องใช้ไฟฟ้าครบครัน: แอร์, ทีวี, ตู้เย็น, ไมโครเวฟ, เครื่องซักผ้า, ดิจิตอลดอร์ล็อก หิ้วกระเป๋าเข้าอยู่ได้ทันที

📲 สอบถาม/นัดชมห้องจริง Line ID: @estatebangkok | โทร 081-234-5678

#IdeoSukhumvit93 #CondoForRent #BTSBangChak #BangkokCondo #RealEstateBangkok`
  );
  const [fbCta, setFbCta] = useState('');
  const [fbHashtags, setFbHashtags] = useState('#IdeoSukhumvit93 #CondoForRent #BTSBangChak #BangkokCondo');
  const [fbImages, setFbImages] = useState<AutoPostImage[]>([]);
  const [fbScheduleType, setFbScheduleType] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [fbScheduledAt, setFbScheduledAt] = useState('');

  // Page 2 Dedicated Content (Slot 2: 61593000699921) - Fully Isolated, Never Mixed
  const [fbPage2Headline, setFbPage2Headline] = useState('🏙️ Premium High-Floor City Living | Ideo Sukhumvit 93 Studio For Rent');
  const [fbPage2Caption, setFbPage2Caption] = useState(
    `✨ คอนโดคุณภาพเยี่ยมติดบันได BTS บางจาก (15 เมตร)
ให้เช่า Ideo Sukhumvit 93 สตูดิโอขนาด 28 ตร.ม. ชั้น 28 แต่งสวยพร้อมเข้าอยู่ทันที
เพียง 18,000 บาท/เดือน (สัญญา 1 ปี / ประกัน 2 เดือน ล่วงหน้า 1 เดือน)

จุดเด่นห้อง:
• ชั้นสูง วิวพาโนรามา ไม่มีตึกบัง ลมพัดเย็นสบาย
• เครื่องใช้ไฟฟ้าและเฟอร์นิเจอร์ครบ (Smart TV, เครื่องซักผ้า, ตู้เย็น, ไมโครเวฟ)
• ส่วนกลางระดับโรงแรม สระว่ายน้ำ 2 สระ ฟิตเนส Co-working space

💬 ติดต่อนัดชมห้องล่วงหน้า:
Line: @estatebangkok | โทร: 081-234-5678

#IdeoSukhumvit #BangkokCondoRental #BTSBangChak #BangkokProperty #CondoLiving`
  );
  const [fbPage2Hashtags, setFbPage2Hashtags] = useState('#IdeoSukhumvit #BangkokCondoRental #BTSBangChak #BangkokProperty');
  const [fbPage2Images, setFbPage2Images] = useState<AutoPostImage[]>([]);
  const [fbPage2ScheduleType, setFbPage2ScheduleType] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [fbPage2ScheduledAt, setFbPage2ScheduledAt] = useState('');

  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [metaPageName, setMetaPageName] = useState('');
  const [metaPageIdInput, setMetaPageIdInput] = useState('');
  const [metaPageFollowers, setMetaPageFollowers] = useState('');
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);

  // Meta Graph API v26.0 Live Connection State
  interface MetaConnectionInfo {
    status: 'CONNECTED' | 'EXPIRED' | 'ERROR' | 'UNCONFIGURED' | 'CHECKING';
    connected: boolean;
    meta_app_id: string;
    facebook_page_id: string;
    facebook_page_url: string;
    page_name: string;
    graph_api_version: string;
    graph_base_url: string;
    has_token: boolean;
    permissions: string[];
    can_create_content: boolean;
    error_message?: string;
    checked_at?: string;
  }

  const [metaStatus, setMetaStatus] = useState<MetaConnectionInfo | null>(null);
  const [isCheckingMetaStatus, setIsCheckingMetaStatus] = useState(false);
  const [isTestingMetaConn, setIsTestingMetaConn] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    passed: boolean;
    message: string;
    permissions?: string[];
  } | null>(null);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [newTokenInput, setNewTokenInput] = useState('');
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isConfirmPublishModalOpen, setIsConfirmPublishModalOpen] = useState(false);

  // Instagram Box
  const [igEnabled, setIgEnabled] = useState(true);
  const [igAccountId, setIgAccountId] = useState(CONNECTED_IG_ACCOUNTS[0].id);
  const [igCaption, setIgCaption] = useState(
    `Elevated city living next to BTS Bang Chak 🏙️✨

Ideo Sukhumvit 93 · 28 Sq.m. Studio on the 28th floor with uninterrupted skyline views. Fully furnished with premium appliances, walk-in layout, and turnkey readiness.

📍 Ideo Sukhumvit 93 (BTS Bang Chak 15m)
💰 ฿18,000 / month
🛋️ Fully Furnished | Ready to move in

📩 DM or contact Line: @estatebangkok for private viewings`
  );
  const [igFirstCommentHashtags, setIgFirstCommentHashtags] = useState(
    '#BangkokCondo #BangkokRealEstate #CondoForRent #SukhumvitCondo #IdeoSukhumvit93 #BTSBangChak #BangkokLiving #InteriorInspo #LuxuryCondoBangkok'
  );
  const [igLocationTag, setIgLocationTag] = useState('Ideo Sukhumvit 93, Sukhumvit Road, Bangkok');

  // TikTok Box
  const [ttEnabled, setTtEnabled] = useState(true);
  const [ttAccountId, setTtAccountId] = useState(CONNECTED_TIKTOK_ACCOUNTS[0].id);
  const [ttHook, setTtHook] = useState('Is this the best condo value under 20k in Sukhumvit? 😱✨');
  const [ttCaption, setTtCaption] = useState(
    `Only 15 meters from BTS Bang Chak! High floor 28 sqm studio with insane city skyline views for 18,000 THB/month. Would you live here? 👇 Comment below! #BangkokCondo #CondoTour #BKKLiving #IdeoSukhumvit93`
  );
  const [ttSound, setTtSound] = useState('Trending Luxury Real Estate Beat (Original Sound)');
  const [ttPrivacy, setTtPrivacy] = useState<'public' | 'friends' | 'private'>('public');
  const [ttAllowComments, setTtAllowComments] = useState(true);
  const [ttAllowDuet, setTtAllowDuet] = useState(true);

  // Scheduling & Publishing state
  const [scheduleType, setScheduleType] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  // ----------------------------------------------------
  // react-select custom styles & options
  // ----------------------------------------------------
  const selectStyles = useMemo(() => ({
    control: (base: any, state: any) => ({
      ...base,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
      borderColor: state.isFocused
        ? 'var(--accent-primary)'
        : isDark
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.15)',
      borderRadius: '8px',
      boxShadow: state.isFocused ? '0 0 0 2px var(--accent-primary-alpha)' : 'none',
      minHeight: '38px',
      fontSize: '0.8125rem',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      opacity: state.isDisabled ? 0.6 : 1,
      transition: 'all 0.15s ease',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--accent-primary)' : isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
      },
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
      borderRadius: '10px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.35)',
      zIndex: 9999,
      padding: '4px',
      overflow: 'hidden',
    }),
    menuList: (base: any) => ({
      ...base,
      padding: '2px',
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'var(--accent-primary)'
        : state.isFocused
        ? isDark
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.05)'
        : 'transparent',
      color: state.isSelected
        ? '#FFFFFF'
        : isDark
        ? '#F3F4F6'
        : '#1F2937',
      fontSize: '0.8125rem',
      borderRadius: '6px',
      padding: '8px 12px',
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
      '&:active': {
        backgroundColor: 'var(--accent-primary)',
        color: '#FFFFFF',
      },
    }),
    singleValue: (base: any) => ({
      ...base,
      color: isDark ? '#F9FAFB' : '#111827',
      fontWeight: 500,
      fontSize: '0.8125rem',
    }),
    input: (base: any) => ({
      ...base,
      color: isDark ? '#F9FAFB' : '#111827',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: 'var(--text-muted)',
      fontSize: '0.8125rem',
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base: any, state: any) => ({
      ...base,
      color: state.isFocused ? 'var(--accent-primary)' : 'var(--text-muted)',
      padding: '6px 8px',
      '&:hover': {
        color: 'var(--text-primary)',
      },
    }),
  }), [isDark]);

  const igAccountOptions = useMemo(() => CONNECTED_IG_ACCOUNTS.map((acc) => ({
    value: acc.id,
    label: `${acc.handle} (${acc.followers})`,
    handle: acc.handle,
    followers: acc.followers,
  })), []);

  const ttAccountOptions = useMemo(() => CONNECTED_TIKTOK_ACCOUNTS.map((acc) => ({
    value: acc.id,
    label: `${acc.handle} (${acc.followers})`,
    handle: acc.handle,
    followers: acc.followers,
  })), []);

  const ttSoundOptions = useMemo(() => [
    { value: 'Trending Luxury Real Estate Beat (Original Sound)', label: 'Trending Luxury Real Estate Beat (Original Sound)' },
    { value: 'Chill Bangkok Sunset Lo-Fi (BPM 85)', label: 'Chill Bangkok Sunset Lo-Fi (BPM 85)' },
    { value: 'Deep House Modern Interior Vibe', label: 'Deep House Modern Interior Vibe' },
    { value: 'Viral Aesthetic Vlog Sound #4', label: 'Viral Aesthetic Vlog Sound #4' },
  ], []);

  const ttPrivacyOptions = useMemo(() => [
    { value: 'public', label: 'Public (Everyone)' },
    { value: 'friends', label: 'Friends' },
    { value: 'private', label: 'Private (Only Me)' },
  ], []);

  // ----------------------------------------------------
  // Interactive Modals & Previews
  // ----------------------------------------------------
  const [activePlatformTab, setActivePlatformTab] = useState<'all' | 'facebook' | 'instagram' | 'tiktok'>('all');
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform | null>(null);
  const [previewFbTab, setPreviewFbTab] = useState<'page1' | 'page2'>('page1');
  const [isPublishingModalOpen, setIsPublishingModalOpen] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{
    step: number;
    total: number;
    text: string;
    completed: boolean;
    isSuccess?: boolean;
    createdItem?: AutoPostItem;
  }>({
    step: 0,
    total: 3,
    text: '',
    completed: false,
    isSuccess: false,
  });

  // Lightbox for photos
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Remaining Posts Import Drawer / Modal
  const [isRemainingPostsModalOpen, setIsRemainingPostsModalOpen] = useState(false);
  const [remainingPostsList, setRemainingPostsList] = useState<RemainingPost[]>([]);

  // History details modal
  const [historyDetailItem, setHistoryDetailItem] = useState<AutoPostItem | null>(null);

  // History table
  const [history, setHistory] = useState<AutoPostItem[]>(() => getAutoPostHistory());
  const [historyFilter, setHistoryFilter] = useState<'all' | 'facebook' | 'instagram' | 'tiktok' | 'scheduled'>('all');
  const [historySearch, setHistorySearch] = useState('');

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAutoPostHistory((items) => {
      setHistory(items);
    });
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // ----------------------------------------------------
  // Image Upload & Reordering Logic
  // ----------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: AutoPostImage[] = Array.from(files).map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      url: URL.createObjectURL(file),
      name: file.name,
      isCover: images.length === 0 && idx === 0,
    }));

    setImages((prev) => {
      const merged = [...prev, ...newImages];
      // Ensure only the first image has isCover true
      return merged.map((img, i) => ({ ...img, isCover: i === 0 }));
    });

    showToast(`📸 Added ${newImages.length} image${newImages.length > 1 ? 's' : ''}!`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropzoneActive(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newImages: AutoPostImage[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file, idx) => ({
        id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        url: URL.createObjectURL(file),
        name: file.name,
        isCover: images.length === 0 && idx === 0,
      }));

    if (newImages.length > 0) {
      setImages((prev) => {
        const merged = [...prev, ...newImages];
        return merged.map((img, i) => ({ ...img, isCover: i === 0 }));
      });
      showToast(`📸 Uploaded ${newImages.length} images!`);
    }
  };

  // Custom title inline editing state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  const handleStartEditTitle = (img: AutoPostImage, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(img.id);
    setTempTitle(img.name);
  };

  const handleSaveTitle = (id: string) => {
    if (tempTitle.trim()) {
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, name: tempTitle.trim() } : img))
      );
    }
    setEditingTitleId(null);
  };

  // Move directly to first position (Make Cover)
  const handleMakeCover = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const copy = [...prev];
      const [selected] = copy.splice(index, 1);
      copy.unshift(selected);
      return copy.map((img, i) => ({ ...img, isCover: i === 0 }));
    });
    showToast(`⭐ "${images[index].name}" is now Cover Photo (#1)!`);
  };

  // Delete image
  const handleDeleteImage = (index: number) => {
    setImages((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((img, i) => ({ ...img, isCover: i === 0 }));
    });
  };

  // Professional smooth drag & drop reordering where other photos slide fluidly into place
  const handleDragStart = (e: any, index: number) => {
    isDraggingRef.current = true;
    lastSwapTimeRef.current = Date.now();
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      if (e.currentTarget) {
        // Drag the whole card container rather than just the inner img
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        e.dataTransfer.setDragImage(target, rect.width / 2, rect.height / 2);
      }
    }
    // Delay setting dragged index so the browser captures the whole card in full opacity for the drag ghost image
    requestAnimationFrame(() => {
      setDraggedImageIndex(index);
    });
  };

  const handleDragEnter = (targetIndex: number) => {
    if (draggedImageIndex === null || draggedImageIndex === targetIndex) return;
    const now = Date.now();
    // Throttle swaps slightly (150ms) to let spring animations settle smoothly without flip-flop jitter
    if (now - lastSwapTimeRef.current < 150) return;
    lastSwapTimeRef.current = now;

    setImages((prev) => {
      const copy = [...prev];
      const [dragged] = copy.splice(draggedImageIndex, 1);
      copy.splice(targetIndex, 0, dragged);
      return copy.map((img, i) => ({ ...img, isCover: i === 0 }));
    });
    setDraggedImageIndex(targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  const handlePhotoClick = (url: string) => {
    if (isDraggingRef.current) return;
    setLightboxUrl(url);
  };

  // ----------------------------------------------------
  // Remaining Posts Import Modal
  // ----------------------------------------------------
  const handleOpenRemainingPostsModal = () => {
    const posts = getRemainingPosts();
    setRemainingPostsList(posts);
    setIsRemainingPostsModalOpen(true);
  };

  const handleSelectRemainingPost = (post: RemainingPost) => {
    setProjectName(post.projectName || post.propertyData?.project_name || 'Listing');
    setListingType((post.propertyData?.listing_type?.toUpperCase() === 'SALE' ? 'SALE' : 'RENT'));
    if (post.propertyData?.price) {
      setPrice(`฿${post.propertyData.price}`);
    }

    const specParts: string[] = [];
    if (post.propertyData?.bedrooms) specParts.push(`${post.propertyData.bedrooms} Bed`);
    if (post.propertyData?.size_sqm) specParts.push(`${post.propertyData.size_sqm} Sqm`);
    if (post.propertyData?.floor) specParts.push(`Floor ${post.propertyData.floor}`);
    if (post.propertyData?.nearest_transit) specParts.push(post.propertyData.nearest_transit);
    if (specParts.length > 0) setSpecs(specParts.join(' · '));

    // Load images
    const loadedImages: AutoPostImage[] = [];
    if (post.originalImages && post.originalImages.length > 0) {
      post.originalImages.forEach((img, idx) => {
        const enhanced = post.enhancedPhotos && post.enhancedPhotos[img.index];
        loadedImages.push({
          id: `rem-${post.id}-${idx}`,
          url: enhanced || img.stored_url || img.source_url,
          name: `Photo #${img.index} (${post.projectName}).jpg`,
          isCover: idx === 0,
        });
      });
    }

    if (loadedImages.length > 0) {
      setImages(loadedImages);
    }

    // Auto-fill copies
    const thaiCopy =
      (post.aiGeneratedOutputs && (post.aiGeneratedOutputs['ai-box-rental'] || post.aiGeneratedOutputs['ai-box-1'])) ||
      post.aiGeneratedCopy ||
      post.caption;

    if (thaiCopy) {
      setFbHeadline(`✨ ${post.projectName} - Ready for ${post.propertyData?.listing_type || 'Rent'}`);
      setFbCaption(thaiCopy);
    }

    const tiktokCopy =
      post.aiGeneratedOutputs &&
      (post.aiGeneratedOutputs['ai-box-tiktok'] || post.aiGeneratedOutputs['ai-box-2']);
    if (tiktokCopy) {
      const lines = tiktokCopy.split('\n').filter((l) => l.trim());
      if (lines.length > 0) setTtHook(lines[0]);
      setTtCaption(tiktokCopy);
    }

    setIsRemainingPostsModalOpen(false);
    showToast(`✅ Loaded "${post.projectName}" with ${loadedImages.length} images!`);
  };

  // ----------------------------------------------------
  // Facebook Meta Connection Handlers
  // ----------------------------------------------------
  const fetchMetaConnectionStatus = async () => {
    setIsCheckingMetaStatus(true);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/page/status');
      if (res.ok) {
        const data = await res.json();
        setMetaStatus(data);
        if (data.facebook_page_id) {
          const officialPage: ConnectedAccount = {
            id: data.facebook_page_id,
            name: data.page_name && data.page_name !== 'Facebook Business Page' ? data.page_name : `Facebook Page (${data.facebook_page_id})`,
            handle: `@${data.facebook_page_id}`,
            platform: 'facebook',
            followers: `Meta Graph API ${data.graph_api_version || 'v26.0'}`,
            isMetaConnected: data.connected,
            pageIdNumber: data.facebook_page_id,
          };
          const updated = saveStoredFbPage(officialPage);
          setFbPagesList(updated);
          setFbPageId(data.facebook_page_id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch Meta connection status:', e);
    } finally {
      setIsCheckingMetaStatus(false);
    }
  };

  const fetchManagedPages = async () => {
    try {
      const res = await fetch('http://localhost:8085/api/facebook/pages');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.pages)) {
          setManagedPages(data.pages);
          const synced = syncStoredFbPagesWithMeta(data.pages);
          setFbPagesList(synced);
        }
      }
    } catch (e) {
      console.error('Failed to load managed facebook pages:', e);
    }
  };

  const handleRefreshPageInfo = async (pageId: string) => {
    setRefreshingPageId(pageId);
    try {
      const res = await fetch(`http://localhost:8085/api/facebook/pages/${pageId}/refresh`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.page) {
        const targetPage = data.page as ManagedPageMeta;
        setManagedPages(prev => prev.map(p => (p.page_id === pageId || p.slot === targetPage.slot ? { ...p, ...targetPage } : p)));
        showToast(`✅ Refreshed Facebook Page info for "${targetPage.name || pageId}" from Meta Graph API!`);
        fetchManagedPages();
      } else {
        const errMsg = data.message || 'Could not refresh Page information';
        showToast(`⚠️ ${errMsg}`);
        fetchManagedPages();
      }
    } catch (e: any) {
      showToast('❌ Network error refreshing Facebook Page info');
    } finally {
      setRefreshingPageId(null);
    }
  };

  const handleCopyPage1ToPage2 = () => {
    setFbPage2Headline(fbHeadline);
    setFbPage2Caption(fbCaption);
    setFbPage2Hashtags(fbHashtags);
    setFbPage2Images([...(fbImages.length > 0 ? fbImages : images)]);
    showToast('📋 Copied Page 1 content into Page 2. Tweak and customize freely!');
  };

  const handleDifferentiatePage2 = () => {
    setFbPage2Headline(
      fbHeadline.includes('✨')
        ? fbHeadline.replace('✨', '🏙️ [Page 2 Exclusive]')
        : `🏙️ [Page 2 Exclusive] ${fbHeadline}`
    );
    setFbPage2Caption(
      `[Special Community Listing for Page 2]\n\n${fbCaption}`
    );
    showToast('✨ Differentiated copy generated for Page 2!');
  };

  useEffect(() => {
    fetchMetaConnectionStatus();
    fetchManagedPages();

    // Automatic periodic synchronization to detect Page name, logo, or token changes
    const interval = setInterval(() => {
      fetchManagedPages();
    }, 5 * 60 * 1000);

    // Listen for OAuth completion from popup
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FB_AUTH_SUCCESS') {
        showToast('✅ Facebook Account connected! Loading discovered pages...');
        fetchManagedPages();
        fetchMetaConnectionStatus();
        setIsPageSelectionModalOpen(true);
      }
    };
    window.addEventListener('message', handleOAuthMessage);

    // Detect redirect with ?fb_connected=true
    const params = new URLSearchParams(window.location.search);
    if (params.get('fb_connected') === 'true') {
      showToast('✅ Facebook Account connected! Select your pages to continue.');
      fetchManagedPages();
      setIsPageSelectionModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, []);

  const handleConnectFacebookOAuth = async () => {
    setIsConnectingMeta(true);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/auth/start');
      const data = await res.json();
      if (data.auth_url) {
        const width = 640;
        const height = 720;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(
          data.auth_url,
          'MetaOAuthPopup',
          `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no`
        );
        showToast('Opening official Facebook authorization window...');
      } else {
        window.open('https://www.facebook.com/v26.0/dialog/oauth', '_blank');
      }
    } catch (e) {
      showToast('❌ Failed to start Facebook authorization');
    } finally {
      setIsConnectingMeta(false);
    }
  };

  const handleTestPageConnection = async (pageId: string) => {
    setTestingPageId(pageId);
    try {
      const res = await fetch(`http://localhost:8085/api/facebook/pages/${pageId}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.test_result) {
        if (data.test_result.passed) {
          showToast(`✅ Page (${pageId}) Test PASSED! Access verified with CREATE_CONTENT.`);
        } else {
          showToast(`⚠️ Page (${pageId}) Test: ${data.test_result.message || 'Verification failed'}`);
        }
        await fetchManagedPages();
      } else {
        showToast(`❌ Connection test failed: ${data.message || 'Unknown error'}`);
      }
    } catch (e) {
      showToast('❌ Network error running connection test');
    } finally {
      setTestingPageId(null);
    }
  };

  const handleTestMetaConnection = async () => {
    setIsTestingMetaConn(true);
    setTestResult(null);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/page/test', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.connected && data.can_create_content) {
        setTestResult({
          tested: true,
          passed: true,
          message: `Connection Verified! Page "${data.page_name}" (ID: ${data.facebook_page_id}) has CREATE_CONTENT access via Meta Graph API ${data.graph_api_version}.`,
          permissions: data.permissions || [],
        });
        showToast('✅ Facebook Page connection & permissions verified!');
      } else {
        const err = data.error_message || (data.status === 'EXPIRED' ? 'Token expired or revoked.' : 'Page lacks CREATE_CONTENT permission or token invalid.');
        setTestResult({
          tested: true,
          passed: false,
          message: err,
          permissions: data.permissions || [],
        });
        showToast(`⚠️ Connection test: ${data.status || 'Failed'}`);
      }
      setMetaStatus(data);
    } catch (err: any) {
      setTestResult({
        tested: true,
        passed: false,
        message: 'Network error connecting to backend API.',
      });
      showToast('❌ Failed to test connection');
    } finally {
      setIsTestingMetaConn(false);
    }
  };

  const handleSavePageAccessToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenInput.trim()) {
      showToast('⚠️ Please enter a Page Access Token');
      return;
    }
    setIsSavingToken(true);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/page/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newTokenInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('✅ Page Access Token updated & validated successfully!');
        setIsTokenModalOpen(false);
        setNewTokenInput('');
        await fetchMetaConnectionStatus();
      } else {
        showToast(`❌ Error: ${data.message || 'Failed to update token'}`);
      }
    } catch (err: any) {
      showToast('❌ Network error updating token');
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleConnectCustomMetaPage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaPageName.trim()) {
      showToast('⚠️ Please enter a Facebook Page Name');
      return;
    }
    const newAccount: ConnectedAccount = {
      id: `fb-meta-${Date.now()}`,
      name: metaPageName.trim(),
      handle: `@${metaPageName.toLowerCase().replace(/[^a-z0-9_]/g, '')}`,
      platform: 'facebook',
      followers: metaPageFollowers.trim() || 'Verified Meta Page',
      isMetaConnected: true,
      pageIdNumber: metaPageIdInput.trim() || undefined,
    };
    const updated = saveStoredFbPage(newAccount);
    setFbPagesList(updated);
    setFbPageId(newAccount.id);
    setIsMetaModalOpen(false);
    setMetaPageName('');
    setMetaPageIdInput('');
    setMetaPageFollowers('');
    showToast(`✅ Successfully linked "${newAccount.name}" with Facebook Meta!`);
  };

  const handleStartMetaOAuthLogin = async () => {
    setIsConnectingMeta(true);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/auth/start');
      const data = await res.json();
      if (data.auth_url) {
        window.open(data.auth_url, '_blank');
        showToast('Opening official Meta OAuth authorization...');
      } else {
        window.open('https://www.facebook.com/v26.0/dialog/oauth', '_blank');
      }
    } catch (err) {
      window.open('https://www.facebook.com/login', '_blank');
    } finally {
      setIsConnectingMeta(false);
    }
  };

  // ----------------------------------------------------
  // AI Channel Copy Generator
  // ----------------------------------------------------
  const handleAIGenerateCopies = () => {
    // Generates high quality differentiated copy for each channel based on current info
    const cleanProject = projectName || 'Luxury Bangkok Residence';
    const cleanPrice = price || 'Competitive Rate';
    const cleanSpecs = specs || 'Prime Sukhumvit Location';

    // 1. Facebook: Clean unified Title and Description
    setFbHeadline(`🏢 ${cleanProject} - ${listingType === 'SALE' ? 'คอนโดหรูเพื่อการลงทุน / ขาย' : 'ห้องสวยแต่งครบพร้อมเข้าอยู่'}`);
    setFbCaption(
      `💎 โครงการ: ${cleanProject}\n` +
      `📍 จุดเด่น: ${cleanSpecs}\n` +
      `💰 ราคา: ${cleanPrice}\n\n` +
      `ห้องตกแต่งครบสไตล์ Modern Luxury เฟอร์นิเจอร์บิวท์อิน เครื่องใช้ไฟฟ้าพรีเมียมครบครัน ส่วนกลางระดับ 5 ดาว สระว่ายน้ำลอยฟ้า ฟิตเนสครบวงจร ทำเลดีเยี่ยมใกล้ระบบขนส่งสาธารณะ เดินทางสะดวกสบายมากครับ\n\n` +
      `• สัญญาเช่าขั้นต่ำ 1 ปี (ประกัน 2 เดือน, ล่วงหน้า 1 เดือน)\n` +
      `• มีบริการดูแลตลอดสัญญาเช่า\n\n` +
      `📲 สนใจนัดชมห้องจริงได้ทุกวัน Line ID: @estatebangkok | โทร 081-234-5678\n\n` +
      `#${cleanProject.replace(/\s+/g, '')} #BangkokRealEstate #CondoFor${listingType === 'SALE' ? 'Sale' : 'Rent'} #BTS #คอนโดติดรถไฟฟ้า`
    );
    setFbCta('');
    setFbHashtags('');

    // 2. Instagram: Minimalist, Aesthetic spacing, DM cta
    setIgCaption(
      `Serene luxury redefined at ${cleanProject} 🏙️✨\n\n` +
      `Experience refined Bangkok living in this meticulously styled unit featuring ${cleanSpecs}.\n\n` +
      `✨ ${cleanProject}\n` +
      `🏷️ ${cleanPrice}\n` +
      `🔑 Turnkey Ready | Modern Furnishings\n\n` +
      `Tap link in bio or send a direct message for a personalized tour walkthrough.`
    );
    setIgFirstCommentHashtags(
      `#${cleanProject.replace(/\s+/g, '')} #BangkokCondo #LuxuryInteriors #BangkokLiving #PropertyInvestment #ThailandRealEstate #CondoLifeBangkok`
    );
    setIgLocationTag(`${cleanProject}, Bangkok, Thailand`);

    // 3. TikTok: Catchy hook in first 3 seconds, Photo Mode Carousel script
    setTtHook(`Is this Bangkok's prettiest condo under ${cleanPrice}? 😱✨`);
    setTtCaption(
      `Would you live in this unit at ${cleanProject}? High floor, city view, and only steps from the station! Swipe through the photos and let us know what you think in the comments 👇✨ #${cleanProject.replace(/\s+/g, '')} #BangkokCondo #RealEstateTikTok #RoomTour`
    );

    showToast('✨ AI generated tailored content for Facebook, Instagram, and TikTok!');
  };

  // ----------------------------------------------------
  // Publishing Workflow Execution
  // ----------------------------------------------------
  const selectedChannelsCount = (fbPage1Enabled ? 1 : 0) + (fbPage2Enabled ? 1 : 0) + (igEnabled ? 1 : 0) + (ttEnabled ? 1 : 0);

  const handleStartPublish = () => {
    if (selectedChannelsCount === 0) {
      alert('Please enable at least one social media channel (Facebook, Instagram, or TikTok).');
      return;
    }
    if (images.length === 0) {
      alert('Please upload at least one image before publishing.');
      return;
    }

    if (scheduleType === 'SCHEDULED') {
      if (!scheduledDateTime) {
        alert('Please pick a date and time for scheduled publication.');
        return;
      }
      const schedTime = new Date(scheduledDateTime).getTime();
      if (schedTime <= Date.now()) {
        alert('Scheduled publication time must be in the future.');
        return;
      }
      handleExecuteSchedule();
      return;
    }

    // Explicit confirmation requirement before publishing live to Facebook Page
    if (fbEnabled) {
      setIsConfirmPublishModalOpen(true);
    } else {
      executePublishWorkflow();
    }
  };

  const handleExecuteSchedule = async () => {
    const postId = `PUB-${Date.now().toString().slice(-6)}`;
    const randomSeed = Math.floor(100000 + Math.random() * 900000);

    let fbScheduleErr: string | undefined;
    let fbP1Result: PlatformPublishResult | undefined;
    let fbP2Result: PlatformPublishResult | undefined;

    if (fbEnabled) {
      if (fbTargetMode === 'both') {
        const p1Images = fbImages.length > 0 ? fbImages : images;
        const p2Images = fbPage2Images.length > 0 ? fbPage2Images : images;
        const p1Sched = fbScheduledAt ? new Date(fbScheduledAt).toISOString() : new Date(scheduledDateTime).toISOString();
        const p2Sched = fbPage2ScheduledAt ? new Date(fbPage2ScheduledAt).toISOString() : new Date(scheduledDateTime).toISOString();

        try {
          const schedRes = await fetch('http://localhost:8085/api/facebook/publish-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pages: [
                {
                  page_id: page1PageId,
                  headline: fbHeadline.trim(),
                  caption: fbCaption.trim(),
                  hashtags: fbHashtags.trim(),
                  image_urls: p1Images.map((img) => img.url),
                  scheduled_at: p1Sched,
                },
                {
                  page_id: page2PageId,
                  headline: fbPage2Headline.trim(),
                  caption: fbPage2Caption.trim(),
                  hashtags: fbPage2Hashtags.trim(),
                  image_urls: p2Images.map((img) => img.url),
                  scheduled_at: p2Sched,
                },
              ],
            }),
          });
          const schedData = await schedRes.json();
          if (schedRes.ok && Array.isArray(schedData.results)) {
            const r1 = schedData.results.find((r: any) => r.page_id === page1PageId);
            const r2 = schedData.results.find((r: any) => r.page_id === page2PageId);
            if (r1) {
              fbP1Result = {
                status: r1.success ? 'scheduled' : 'failed',
                error: r1.error,
                timestamp: Date.now(),
                pageId: page1PageId,
                pageSlot: 1,
              };
            }
            if (r2) {
              fbP2Result = {
                status: r2.success ? 'scheduled' : 'failed',
                error: r2.error,
                timestamp: Date.now(),
                pageId: page2PageId,
                pageSlot: 2,
              };
            }
            if (!r1?.success || !r2?.success) {
              fbScheduleErr = `Partial Schedule: P1=${r1?.status || 'fail'}, P2=${r2?.status || 'fail'}`;
            }
          } else {
            fbScheduleErr = schedData.message || 'Failed to schedule batch on backend';
          }
        } catch (err: any) {
          fbScheduleErr = err.message || 'Network error while scheduling batch';
        }
      } else {
        const isSlot2 = fbTargetMode === 'page2';
        const targetPageId = isSlot2 ? page2PageId : page1PageId;
        const targetHeadline = isSlot2 ? fbPage2Headline : fbHeadline;
        const targetCaption = isSlot2 ? fbPage2Caption : fbCaption;
        const targetHashtags = isSlot2 ? fbPage2Hashtags : fbHashtags;
        const targetImages = isSlot2
          ? (fbPage2Images.length > 0 ? fbPage2Images : images)
          : (fbImages.length > 0 ? fbImages : images);
        const targetSched = isSlot2
          ? (fbPage2ScheduledAt ? new Date(fbPage2ScheduledAt).toISOString() : new Date(scheduledDateTime).toISOString())
          : (fbScheduledAt ? new Date(fbScheduledAt).toISOString() : new Date(scheduledDateTime).toISOString());

        try {
          const schedRes = await fetch('http://localhost:8085/api/facebook/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              page_id: targetPageId,
              headline: targetHeadline.trim(),
              caption: targetCaption.trim(),
              hashtags: targetHashtags.trim(),
              image_urls: targetImages.map((img) => img.url),
              scheduled_at: targetSched,
            }),
          });
          const schedData = await schedRes.json();
          if (!schedRes.ok || schedData.status !== 'success') {
            fbScheduleErr = schedData.message || 'Failed to schedule post on backend queue';
          } else {
            const singleSchedResult: PlatformPublishResult = {
              status: 'scheduled',
              timestamp: Date.now(),
              pageId: targetPageId,
              pageSlot: isSlot2 ? 2 : 1,
            };
            if (isSlot2) {
              fbP2Result = singleSchedResult;
            } else {
              fbP1Result = singleSchedResult;
            }
          }
        } catch (err: any) {
          fbScheduleErr = err.message || 'Network error while scheduling post';
        }
      }
    }

    const newItem: AutoPostItem = {
      id: postId,
      projectName: projectName || 'Bangkok Property',
      listingType,
      price,
      specs,
      images,
      facebook: {
        enabled: fbEnabled,
        targetMode: fbTargetMode,
        pageId: fbTargetMode === 'page2' ? page2PageId : page1PageId,
        pageName:
          fbTargetMode === 'both'
            ? `Both Pages (${page1Name} & ${page2Name})`
            : fbTargetMode === 'page2'
            ? `${page2Name} (${page2PageId})`
            : `${page1Name} (${page1PageId})`,
        headline: fbHeadline,
        caption: fbCaption,
        cta: fbCta,
        hashtags: fbHashtags,
        page1: {
          enabled: fbTargetMode === 'both' || fbTargetMode === 'page1',
          pageId: page1PageId,
          pageSlot: 1,
          pageName: `${page1Name} (${page1PageId})`,
          headline: fbHeadline,
          caption: fbCaption,
          hashtags: fbHashtags,
          images: fbImages.length > 0 ? fbImages : images,
          scheduleType: fbScheduleType,
          scheduledAt: fbScheduledAt,
        },
        page2: {
          enabled: fbTargetMode === 'both' || fbTargetMode === 'page2',
          pageId: page2PageId,
          pageSlot: 2,
          pageName: `${page2Name} (${page2PageId})`,
          headline: fbPage2Headline,
          caption: fbPage2Caption,
          hashtags: fbPage2Hashtags,
          images: fbPage2Images.length > 0 ? fbPage2Images : images,
          scheduleType: fbPage2ScheduleType,
          scheduledAt: fbPage2ScheduledAt,
        },
      },
      instagram: {
        enabled: igEnabled,
        accountId: igAccountId,
        accountName: CONNECTED_IG_ACCOUNTS.find((a) => a.id === igAccountId)?.handle || '@instagram',
        caption: igCaption,
        firstCommentHashtags: igFirstCommentHashtags,
        locationTag: igLocationTag,
      },
      tiktok: {
        enabled: ttEnabled,
        accountId: ttAccountId,
        accountName: CONNECTED_TIKTOK_ACCOUNTS.find((a) => a.id === ttAccountId)?.handle || '@tiktok',
        hook: ttHook,
        caption: ttCaption,
        sound: ttSound,
        privacy: ttPrivacy,
        allowComments: ttAllowComments,
        allowDuet: ttAllowDuet,
      },
      scheduleType: 'SCHEDULED',
      scheduledAt: scheduledDateTime,
      status: fbScheduleErr ? 'FAILED' : 'SCHEDULED',
      createdAt: Date.now(),
      platformResults: {
        facebook: {
          status: fbEnabled ? (fbScheduleErr ? 'failed' : 'scheduled') : 'skipped',
          error: fbScheduleErr,
          timestamp: Date.now(),
        },
        facebookPage1: fbP1Result,
        facebookPage2: fbP2Result,
        instagram: {
          status: igEnabled ? 'scheduled' : 'skipped',
          timestamp: Date.now(),
        },
        tiktok: {
          status: ttEnabled ? 'scheduled' : 'skipped',
          timestamp: Date.now(),
        },
      },
    };

    saveAutoPostItem(newItem);
    setIsPublishingModalOpen(true);
    setPublishProgress({
      step: 4,
      total: 4,
      text: fbScheduleErr ? `Failed to schedule: ${fbScheduleErr}` : 'Listing successfully scheduled in queue!',
      completed: true,
      createdItem: newItem,
    });
  };

  const executePublishWorkflow = async () => {
    setIsConfirmPublishModalOpen(false);
    setIsPublishingModalOpen(true);

    const postId = `PUB-${Date.now().toString().slice(-6)}`;
    const randomSeed = Math.floor(100000 + Math.random() * 900000);

    let fbResult: PlatformPublishResult = {
      status: fbEnabled ? 'failed' : 'skipped',
    };
    let fbP1Result: PlatformPublishResult | undefined;
    let fbP2Result: PlatformPublishResult | undefined;

    setPublishProgress({
      step: 1,
      total: 4,
      text: 'Preserving image order and preparing high-resolution upload payloads...',
      completed: false,
    });

    try {
      // Step 1: Pre-process
      await new Promise((r) => setTimeout(r, 400));

      // Step 2: Official Meta Graph API v26.0 Facebook Publishing
      if (fbEnabled) {
        if (fbTargetMode === 'both') {
          setPublishProgress({
            step: 2,
            total: 4,
            text: `Publishing simultaneously to ${page1Name} and ${page2Name} via Meta Graph API v26.0...`,
            completed: false,
          });

          const p1Images = fbImages.length > 0 ? fbImages : images;
          const p2Images = fbPage2Images.length > 0 ? fbPage2Images : images;

          const batchPayload = {
            pages: [
              {
                page_id: page1PageId,
                headline: fbHeadline.trim(),
                caption: fbCaption.trim(),
                hashtags: fbHashtags.trim(),
                image_urls: p1Images.map((img) => img.url),
              },
              {
                page_id: page2PageId,
                headline: fbPage2Headline.trim(),
                caption: fbPage2Caption.trim(),
                hashtags: fbPage2Hashtags.trim(),
                image_urls: p2Images.map((img) => img.url),
              },
            ],
          };

          const res = await fetch('http://localhost:8085/api/facebook/publish-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchPayload),
          });

          const data = await res.json();
          if (res.ok && Array.isArray(data.results)) {
            const r1 = data.results.find((r: any) => r.page_id === page1PageId);
            const r2 = data.results.find((r: any) => r.page_id === page2PageId);

            if (r1) {
              fbP1Result = {
                status: r1.success ? 'success' : 'failed',
                postId: r1.facebook_post_id,
                postUrl: r1.permalink_url,
                error: r1.error,
                timestamp: Date.now(),
                pageId: page1PageId,
                pageSlot: 1,
              };
            }
            if (r2) {
              fbP2Result = {
                status: r2.success ? 'success' : 'failed',
                postId: r2.facebook_post_id,
                postUrl: r2.permalink_url,
                error: r2.error,
                timestamp: Date.now(),
                pageId: page2PageId,
                pageSlot: 2,
              };
            }

            const p1Ok = fbP1Result?.status === 'success';
            const p2Ok = fbP2Result?.status === 'success';

            fbResult = {
              status: p1Ok && p2Ok ? 'success' : p1Ok || p2Ok ? 'success' : 'failed',
              postId: fbP1Result?.postId || fbP2Result?.postId,
              postUrl: fbP1Result?.postUrl || fbP2Result?.postUrl,
              error: (!p1Ok || !p2Ok) ? `P1: ${fbP1Result?.error || 'OK'}, P2: ${fbP2Result?.error || 'OK'}` : undefined,
              timestamp: Date.now(),
            };
          } else {
            fbResult = {
              status: 'failed',
              error: data.message || 'Batch publishing failed',
              timestamp: Date.now(),
            };
          }
        } else {
          // Single Page Publishing (Page 1 or Page 2)
          const isSlot2 = fbTargetMode === 'page2';
          const targetPageId = isSlot2 ? page2PageId : page1PageId;
          const targetHeadline = isSlot2 ? fbPage2Headline : fbHeadline;
          const targetCaption = isSlot2 ? fbPage2Caption : fbCaption;
          const targetHashtags = isSlot2 ? fbPage2Hashtags : fbHashtags;
          const targetImages = isSlot2
            ? (fbPage2Images.length > 0 ? fbPage2Images : images)
            : (fbImages.length > 0 ? fbImages : images);

          setPublishProgress({
            step: 2,
            total: 4,
            text: `Uploading ${targetImages.length} photos to Facebook Page (${targetPageId}) via Meta Graph API v26.0...`,
            completed: false,
          });

          const singlePayload = {
            page_id: targetPageId,
            headline: targetHeadline.trim(),
            caption: targetCaption.trim(),
            hashtags: targetHashtags.trim(),
            image_urls: targetImages.map((img) => img.url),
          };

          const res = await fetch('http://localhost:8085/api/facebook/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(singlePayload),
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            const singleResult: PlatformPublishResult = {
              status: 'success',
              postId: data.facebook_post_id,
              postUrl: data.permalink_url,
              timestamp: Date.now(),
              pageId: targetPageId,
              pageSlot: isSlot2 ? 2 : 1,
            };
            fbResult = singleResult;
            if (isSlot2) {
              fbP2Result = singleResult;
            } else {
              fbP1Result = singleResult;
            }
          } else {
            const failResult: PlatformPublishResult = {
              status: 'failed',
              error: data.message || 'Meta Graph API error during publication',
              timestamp: Date.now(),
              pageId: targetPageId,
              pageSlot: isSlot2 ? 2 : 1,
            };
            fbResult = failResult;
            if (isSlot2) {
              fbP2Result = failResult;
            } else {
              fbP1Result = failResult;
            }
          }
        }
      }

      // Step 3: Instagram
      setPublishProgress({
        step: 3,
        total: 4,
        text: igEnabled
          ? 'Uploading Instagram Carousel with 1st-comment hashtags...'
          : 'Skipping Instagram...',
        completed: false,
      });
      await new Promise((r) => setTimeout(r, 500));

      // Step 4: TikTok
      setPublishProgress({
        step: 4,
        total: 4,
        text: ttEnabled
          ? 'Pushing TikTok Photo Mode Carousel with background sound...'
          : 'Skipping TikTok...',
        completed: false,
      });
      await new Promise((r) => setTimeout(r, 500));

      const isOverallSuccess = !fbEnabled || fbResult.status === 'success';

      const newItem: AutoPostItem = {
        id: postId,
        projectName: projectName || 'Bangkok Property',
        listingType,
        price,
        specs,
        images,
        facebook: {
          enabled: fbEnabled,
          targetMode: fbTargetMode,
          pageId: fbTargetMode === 'page2' ? page2PageId : page1PageId,
          pageName:
            fbTargetMode === 'both'
              ? `Both Pages (${page1Name} & ${page2Name})`
              : fbTargetMode === 'page2'
              ? `${page2Name} (${page2PageId})`
              : `${page1Name} (${page1PageId})`,
          headline: fbHeadline,
          caption: fbCaption,
          cta: fbCta,
          hashtags: fbHashtags,
          page1: {
            enabled: fbTargetMode === 'both' || fbTargetMode === 'page1',
            pageId: page1PageId,
            pageSlot: 1,
            pageName: `${page1Name} (${page1PageId})`,
            headline: fbHeadline,
            caption: fbCaption,
            hashtags: fbHashtags,
            images: fbImages.length > 0 ? fbImages : images,
            scheduleType: fbScheduleType,
            scheduledAt: fbScheduledAt,
          },
          page2: {
            enabled: fbTargetMode === 'both' || fbTargetMode === 'page2',
            pageId: page2PageId,
            pageSlot: 2,
            pageName: `${page2Name} (${page2PageId})`,
            headline: fbPage2Headline,
            caption: fbPage2Caption,
            hashtags: fbPage2Hashtags,
            images: fbPage2Images.length > 0 ? fbPage2Images : images,
            scheduleType: fbPage2ScheduleType,
            scheduledAt: fbPage2ScheduledAt,
          },
        },
        instagram: {
          enabled: igEnabled,
          accountId: igAccountId,
          accountName: CONNECTED_IG_ACCOUNTS.find((a) => a.id === igAccountId)?.handle || '@instagram',
          caption: igCaption,
          firstCommentHashtags: igFirstCommentHashtags,
          locationTag: igLocationTag,
        },
        tiktok: {
          enabled: ttEnabled,
          accountId: ttAccountId,
          accountName: CONNECTED_TIKTOK_ACCOUNTS.find((a) => a.id === ttAccountId)?.handle || '@tiktok',
          hook: ttHook,
          caption: ttCaption,
          sound: ttSound,
          privacy: ttPrivacy,
          allowComments: ttAllowComments,
          allowDuet: ttAllowDuet,
        },
        scheduleType: 'NOW',
        status: isOverallSuccess ? 'PUBLISHED' : 'FAILED',
        createdAt: Date.now(),
        platformResults: {
          facebook: fbResult,
          facebookPage1: fbP1Result,
          facebookPage2: fbP2Result,
          instagram: {
            status: igEnabled ? 'success' : 'skipped',
            postId: igEnabled ? `ig_${randomSeed}` : undefined,
            postUrl: igEnabled ? `https://instagram.com/p/${randomSeed}` : undefined,
            timestamp: Date.now(),
          },
          tiktok: {
            status: ttEnabled ? 'success' : 'skipped',
            postId: ttEnabled ? `tt_${randomSeed}` : undefined,
            postUrl: ttEnabled ? `https://tiktok.com/@video/${randomSeed}` : undefined,
            timestamp: Date.now(),
          },
        },
      };

      saveAutoPostItem(newItem);

      setPublishProgress({
        step: 4,
        total: 4,
        text: isOverallSuccess
          ? (fbTargetMode === 'both'
            ? 'Simultaneously published to both Facebook Page 1 and Page 2 via Meta Graph API!'
            : 'Published successfully to Meta Graph API!')
          : `Facebook publishing encountered an issue: ${fbResult.error || 'Check access token or permissions'}`,
        completed: true,
        isSuccess: isOverallSuccess,
        createdItem: newItem,
      });
    } catch (err: any) {
      setPublishProgress({
        step: 4,
        total: 4,
        text: `Publication failed: ${err.message}`,
        completed: true,
        isSuccess: false,
      });
    }
  };

  // ----------------------------------------------------
  // Filtered History
  // ----------------------------------------------------
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (historyFilter === 'facebook' && !item.facebook.enabled) return false;
      if (historyFilter === 'instagram' && !item.instagram.enabled) return false;
      if (historyFilter === 'tiktok' && !item.tiktok.enabled) return false;
      if (historyFilter === 'scheduled' && item.status !== 'SCHEDULED') return false;

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchTitle = item.projectName.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchPrice = item.price.toLowerCase().includes(q);
        return matchTitle || matchId || matchPrice;
      }
      return true;
    });
  }, [history, historyFilter, historySearch]);

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this post from history?')) {
      deleteAutoPostItem(id);
      showToast('Deleted post record');
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            color: 'var(--text-primary)',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 9999,
            fontWeight: 500,
            fontSize: '0.875rem',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <FiCheckCircle style={{ color: '#22C55E', fontSize: '1.125rem' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Responsive & Sticky Style for 2-column Layout */}
      <style>{`
        @media (max-width: 860px) {
          .auto-post-two-col-layout {
            grid-template-columns: 1fr !important;
          }
          .auto-post-sticky-left {
            position: relative !important;
            top: auto !important;
            max-height: none !important;
            overflow-y: visible !important;
          }
        }
        .auto-post-sticky-left {
          position: sticky;
          top: 72px;
          align-self: start;
          max-height: calc(100vh - 88px);
          overflow-y: auto;
          z-index: 10;
        }
        .auto-post-sticky-left::-webkit-scrollbar {
          width: 5px;
        }
        .auto-post-sticky-left::-webkit-scrollbar-track {
          background: transparent;
        }
        .auto-post-sticky-left::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 4px;
        }
        .auto-post-sticky-left::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.5);
        }
      `}</style>

      {/* 2-Column Main Workspace */}
      <div
        className="auto-post-two-col-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(330px, 450px) 1fr',
          gap: '1.5rem',
          alignItems: 'start',
          marginBottom: '2rem',
        }}
      >
        {/* ======================================================== */}
        {/* LEFT COLUMN: Photos & Media (Sticky, stays in place)      */}
        {/* ======================================================== */}
        <div
          className="auto-post-sticky-left"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: '72px',
            alignSelf: 'start',
            maxHeight: 'calc(100vh - 88px)',
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {/* Photo Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FiImage />
              </div>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Property Photos
                </h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  First photo is your <strong>Cover Thumbnail</strong>
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '20px',
                backgroundColor: images.length > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: images.length > 0 ? '#22C55E' : '#EF4444',
                border: `1px solid ${images.length > 0 ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              }}
            >
              {images.length} Photos
            </span>
          </div>

          {/* Action buttons row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/*"
              style={{ display: 'none' }}
            />
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                flex: 1,
                justifyContent: 'center',
                height: '36px',
                padding: '0 14px',
                borderRadius: '6px',
              }}
            >
              <FiUploadCloud />
              <span>Upload Photos</span>
            </Button>

            <Button
              variant="secondary"
              onClick={handleOpenRemainingPostsModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                height: '36px',
                padding: '0 14px',
                borderRadius: '6px',
              }}
              title="Import photos and details from Remaining Posts"
            >
              <FiLayers style={{ color: 'var(--accent-primary)' }} />
              <span>From Remaining</span>
            </Button>
          </div>

        {/* Upload Dropzone */}
        {images.length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDropzoneActive(true);
            }}
            onDragLeave={() => setIsDropzoneActive(false)}
            onDrop={handleDropFiles}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDropzoneActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: '12px',
              padding: '2.5rem 1rem',
              textAlign: 'center',
              backgroundColor: isDropzoneActive
                ? (isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)')
                : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                margin: '0 auto 0.75rem',
              }}
            >
              <FiUploadCloud />
            </div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
              Click or drag property photos here
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
              Supports JPG, PNG, WebP up to 30 images. First image will automatically be your cover thumbnail.
            </p>
          </div>
        ) : (
          <div>
            {/* Compact Reordering Grid with smooth layout animation */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
                gap: '0.625rem',
              }}
            >
              {images.map((img, index) => {
                const isFirst = index === 0;
                const isDragged = draggedImageIndex === index;

                return (
                  <motion.div
                    layout
                    key={img.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    transition={{
                      type: 'spring',
                      damping: 28,
                      stiffness: 400,
                      mass: 0.8,
                    }}
                    onClick={() => handlePhotoClick(img.url)}
                    title="Click to view full size · Drag to reorder"
                    style={{
                      borderRadius: '10px',
                      overflow: 'hidden',
                      backgroundColor: '#000000',
                      height: '115px',
                      border: isDragged
                        ? '2px dashed var(--accent-primary)'
                        : isFirst
                        ? '2px solid #F59E0B'
                        : '1px solid var(--border-color)',
                      boxShadow: isDragged
                        ? '0 8px 20px rgba(0,0,0,0.2)'
                        : isFirst
                        ? '0 2px 10px rgba(245, 158, 11, 0.3)'
                        : 'var(--shadow-sm)',
                      opacity: isDragged ? 0.35 : 1,
                      transform: isDragged ? 'scale(0.96)' : 'scale(1)',
                      position: 'relative',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    {/* Full Size Image Thumbnail - native browser drag disabled so the whole card container is dragged */}
                    <img
                      src={img.url}
                      alt={img.name}
                      draggable={false}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        ...({ WebkitUserDrag: 'none' } as any),
                        transition: 'transform 0.2s ease',
                      }}
                    />

                    {/* Top-Left: Cover Star Badge (#1) or Quick "Set 1st" Button (#2, #3, ...) */}
                    {isFirst ? (
                      <div
                        title="👑 #1 Cover Photo (Displayed 1st on feeds and carousels)"
                        style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          zIndex: 15,
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: '#F59E0B',
                          color: '#000000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                          cursor: 'default',
                        }}
                      >
                        <FiStar style={{ fill: '#000000', fontSize: '0.75rem' }} />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMakeCover(index);
                        }}
                        title="Click to set as #1 Cover Photo"
                        style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          zIndex: 15,
                          height: '24px',
                          padding: '0 6px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          backgroundColor: 'rgba(0, 0, 0, 0.65)',
                          color: '#FFFFFF',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          backdropFilter: 'blur(4px)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#F59E0B';
                          e.currentTarget.style.borderColor = '#F59E0B';
                          e.currentTarget.style.color = '#000000';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                          e.currentTarget.style.color = '#FFFFFF';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <FiStar style={{ fontSize: '0.6875rem' }} />
                        <span>#{index + 1}</span>
                      </button>
                    )}

                    {/* Top-Right: Delete Button (Overlaid on image, comfortable 30x30px clickable size) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(index);
                      }}
                      title="Delete photo"
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        zIndex: 15,
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        backdropFilter: 'blur(4px)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#EF4444';
                        e.currentTarget.style.borderColor = '#EF4444';
                        e.currentTarget.style.transform = 'scale(1.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <FiTrash2 />
                    </button>
                  </motion.div>
                );
              })}

              {/* Add More Photos Slot */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDropzoneActive(true);
                }}
                onDragLeave={() => setIsDropzoneActive(false)}
                onDrop={handleDropFiles}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '10px',
                  minHeight: '115px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  gap: '4px',
                  transition: 'border-color 0.2s ease, color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.color = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <FiPlus style={{ fontSize: '1.25rem' }} />
                <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>Add Photos</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECOND (RIGHT) COLUMN: Social Media Boxes & Publishing   */}
      {/* ======================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
        {/* Right Column Header with Platform Switcher */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Social Media Content
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Dedicated caption, hashtags, and settings for each channel
            </span>
          </div>

          {/* Platform Tabs */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-main)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActivePlatformTab('all')}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activePlatformTab === 'all' ? 'var(--accent-primary)' : 'transparent',
                color: activePlatformTab === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              All Channels
            </button>

            <button
              type="button"
              onClick={() => setActivePlatformTab('facebook')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activePlatformTab === 'facebook' ? '#1877F2' : 'transparent',
                color: activePlatformTab === 'facebook' ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FaFacebook />
              <span>Facebook</span>
              {fbEnabled && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />}
            </button>

            <button
              type="button"
              onClick={() => setActivePlatformTab('instagram')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activePlatformTab === 'instagram' ? '#E4405F' : 'transparent',
                color: activePlatformTab === 'instagram' ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FaInstagram />
              <span>Instagram</span>
              {igEnabled && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />}
            </button>

            <button
              type="button"
              onClick={() => setActivePlatformTab('tiktok')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activePlatformTab === 'tiktok' ? (isDark ? '#00F2FE' : '#0891B2') : 'transparent',
                color: activePlatformTab === 'tiktok' ? '#000000' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FaTiktok />
              <span>TikTok</span>
              {ttEnabled && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />}
            </button>
          </div>
        </div>

        {/* Social Media Boxes Stack (One card per row, full width) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          {/* ==================================================== */}
          {/* Top Facebook Multi-Page Connection & Discovery Bar   */}
          {/* ==================================================== */}
          {(activePlatformTab === 'all' || activePlatformTab === 'facebook') && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#1877F2',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.125rem',
                    boxShadow: '0 2px 6px rgba(24, 119, 242, 0.25)',
                  }}
                >
                  <SiMeta />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Facebook Multi-Page Management
                    </span>
                    <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#1877F2', backgroundColor: 'rgba(24, 119, 242, 0.1)', padding: '2px 7px', borderRadius: '4px' }}>
                      Meta Graph API v26.0
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    Official OAuth authorization, automatic Page discovery, and independent posting channels
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Connect / Reconnect Facebook Account button */}
                <button
                  type="button"
                  onClick={handleConnectFacebookOAuth}
                  disabled={isConnectingMeta}
                  style={{
                    backgroundColor: '#1877F2',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: isConnectingMeta ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(24, 119, 242, 0.3)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Authorize your Facebook Account using official Meta OAuth flow"
                >
                  <SiMeta />
                  <span>
                    {isConnectingMeta
                      ? 'Connecting...'
                      : page1TokenStatus === 'EXPIRED' || page1TokenStatus === 'RECONNECT_REQUIRED'
                      ? 'Reconnect Facebook'
                      : 'Connect Facebook Account'}
                  </span>
                </button>

                {/* Select Facebook Pages button */}
                <button
                  type="button"
                  onClick={() => setIsPageSelectionModalOpen(true)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #1877F2',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: '#1877F2',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                  }}
                  title="Discover and select Facebook Pages to connect"
                >
                  <FiSliders />
                  <span>Select Pages to Connect</span>
                </button>

                {/* Sync All Pages button */}
                <button
                  type="button"
                  onClick={async () => {
                    showToast('Syncing all Facebook Pages from Meta...');
                    await fetch('http://localhost:8085/api/facebook/pages/refresh-all', { method: 'POST' });
                    fetchManagedPages();
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                  title="Sync all connected Facebook Pages from Meta Graph API"
                >
                  <FiRefreshCw />
                  <span>Sync All</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* BOX 1A: Facebook Page 1 (61568058604134)             */}
          {/* ==================================================== */}
          {(activePlatformTab === 'all' || activePlatformTab === 'facebook') && (
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: fbPage1Enabled ? '2px solid rgba(24, 119, 242, 0.45)' : '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: fbPage1Enabled ? '0 4px 20px rgba(24, 119, 242, 0.08)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Box Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: '#1877F2',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(24, 119, 242, 0.3)',
                      overflow: 'hidden',
                      position: 'relative',
                      border: '1px solid rgba(24, 119, 242, 0.25)',
                    }}
                  >
                    {page1Picture ? (
                      <img
                        src={page1Picture}
                        alt={page1Name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <FaFacebook />
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {page1Name}
                      </h3>
                      <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#1877F2', backgroundColor: 'rgba(24, 119, 242, 0.1)', padding: '2px 7px', borderRadius: '4px' }}>
                        Slot 1
                      </span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'var(--bg-main)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        Meta Graph API v26.0
                      </span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Page ID: {page1PageId}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => (onNavigateTab ? onNavigateTab('facebook-tokens') : setIsTokenManagerModalOpen(true))}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(24, 119, 242, 0.3)',
                      borderRadius: '7px',
                      padding: '4px 10px',
                      color: '#1877F2',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: 'rgba(24, 119, 242, 0.05)',
                      transition: 'all 0.15s ease',
                    }}
                    title="Open Page Token Manager menu"
                  >
                    <FiSliders />
                    <span>Page Tokens</span>
                  </button>

                  {/* Enable Switch Toggle */}
                  <SwitchToggle
                    checked={fbPage1Enabled}
                    onChange={(val) => {
                      if (val && (!page1Connected || !page1Meta?.can_create_content)) {
                        showToast('⚠️ Auto-publishing requires a valid token with verified CREATE_CONTENT permission. Run "Test Connection" first.');
                        return;
                      }
                      setFbPage1Enabled(val);
                    }}
                    activeColor="#1877F2"
                    label={fbPage1Enabled ? 'Active' : 'Off'}
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* Status Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '0.875rem',
                  fontSize: '0.6875rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Verified API Connection Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: page1Connected ? '#22C55E' : '#EF4444',
                        boxShadow: page1Connected ? '0 0 6px rgba(34, 197, 94, 0.6)' : '0 0 6px rgba(239, 68, 68, 0.6)',
                      }}
                    />
                    <span>
                      Connection:{' '}
                      <strong style={{ color: page1Connected ? '#22C55E' : '#EF4444' }}>
                        {page1Connected ? 'Connected' : 'Disconnected'}
                      </strong>
                    </span>
                  </div>

                  <span style={{ color: 'var(--border-color)', opacity: 0.6 }}>|</span>

                  {/* Token Validity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Token:</span>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor:
                          page1TokenStatus === 'VALID'
                            ? 'rgba(34, 197, 94, 0.12)'
                            : page1TokenStatus === 'MISSING'
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(245, 158, 11, 0.12)',
                        color:
                          page1TokenStatus === 'VALID'
                            ? '#22C55E'
                            : page1TokenStatus === 'MISSING'
                            ? '#EF4444'
                            : '#F59E0B',
                        border: `1px solid ${
                          page1TokenStatus === 'VALID'
                            ? 'rgba(34, 197, 94, 0.25)'
                            : page1TokenStatus === 'MISSING'
                            ? 'rgba(239, 68, 68, 0.25)'
                            : 'rgba(245, 158, 11, 0.25)'
                        }`,
                      }}
                    >
                      {formatTokenValidity(page1TokenStatus, page1Meta?.has_token)}
                    </span>
                  </div>

                  <span style={{ color: 'var(--border-color)', opacity: 0.6 }}>|</span>

                  {/* Publishing Permission Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Publishing:</span>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor: page1Meta?.can_create_content ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                        color: page1Meta?.can_create_content ? '#22C55E' : '#EF4444',
                        border: `1px solid ${page1Meta?.can_create_content ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                      }}
                    >
                      {page1Meta?.can_create_content ? 'CREATE_CONTENT' : 'Limited Rights'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Reconnect button if expired or reconnect required */}
                  {(page1TokenStatus === 'EXPIRED' || page1TokenStatus === 'RECONNECT_REQUIRED' || page1TokenStatus === 'INVALID') && (
                    <button
                      type="button"
                      onClick={handleConnectFacebookOAuth}
                      style={{
                        background: '#1877F2',
                        border: 'none',
                        borderRadius: '5px',
                        padding: '3px 9px',
                        color: '#FFFFFF',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 1px 4px rgba(24, 119, 242, 0.3)',
                      }}
                    >
                      <SiMeta />
                      <span>Reconnect</span>
                    </button>
                  )}

                  {/* Test Connection button */}
                  <button
                    type="button"
                    onClick={() => handleTestPageConnection(page1PageId)}
                    disabled={testingPageId === page1PageId}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(24, 119, 242, 0.3)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      color: '#1877F2',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: testingPageId === page1PageId ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(24, 119, 242, 0.05)',
                    }}
                    title="Validate Page Access Token and CREATE_CONTENT permission"
                  >
                    <FiCheckCircle style={{ animation: testingPageId === page1PageId ? 'spin 1s linear infinite' : 'none' }} />
                    <span>{testingPageId === page1PageId ? 'Testing...' : 'Test Connection'}</span>
                  </button>

                  {/* Refresh Page Info button */}
                  <button
                    type="button"
                    onClick={() => handleRefreshPageInfo(page1PageId)}
                    disabled={refreshingPageId === page1PageId}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(24, 119, 242, 0.3)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      color: '#1877F2',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: refreshingPageId === page1PageId ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(24, 119, 242, 0.05)',
                      transition: 'all 0.15s ease',
                    }}
                    title="Retrieve real Facebook Page name and profile picture from Meta Graph API"
                  >
                    <FiRefreshCw
                      style={{
                        fontSize: '0.625rem',
                        animation: refreshingPageId === page1PageId ? 'spin 1s linear infinite' : 'none',
                      }}
                    />
                    <span>{refreshingPageId === page1PageId ? 'Refreshing...' : 'Refresh Info'}</span>
                  </button>

                  {/* Manage Token button */}
                  <button
                    type="button"
                    onClick={() => (onNavigateTab ? onNavigateTab('facebook-tokens') : setIsTokenManagerModalOpen(true))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1877F2',
                      cursor: 'pointer',
                      padding: '3px 4px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.6875rem',
                    }}
                  >
                    <span>Manage Token</span>
                    <FiExternalLink style={{ fontSize: '0.625rem' }} />
                  </button>
                </div>
              </div>

              {/* Zero Mixing Callout */}
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(24, 119, 242, 0.05)',
                  border: '1px solid rgba(24, 119, 242, 0.15)',
                  fontSize: '0.6875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1rem',
                  lineHeight: 1.35,
                }}
              >
                🔒 <strong>Isolated Publishing:</strong> Content in this box will only be published to {page1Name} ({page1PageId}).
              </div>

              {/* Form Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', flex: 1 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Page 1 Title
                    </label>
                  </div>
                  <input
                    type="text"
                    value={fbHeadline}
                    onChange={(e) => setFbHeadline(e.target.value)}
                    disabled={!fbPage1Enabled}
                    placeholder="Page 1 headline (e.g. ✨ Modern Studio at Ideo Sukhumvit 93 for Rent)"
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Page 1 Description & Details
                    </label>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {fbCaption.length} characters
                    </span>
                  </div>
                  <textarea
                    value={fbCaption}
                    onChange={(e) => setFbCaption(e.target.value)}
                    disabled={!fbPage1Enabled}
                    rows={7}
                    placeholder="Write detailed property description, pricing, amenities, and contact info for Page 1..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Page 1 Hashtags
                  </label>
                  <input
                    type="text"
                    value={fbHashtags}
                    onChange={(e) => setFbHashtags(e.target.value)}
                    disabled={!fbPage1Enabled}
                    placeholder="#IdeoSukhumvit93 #BangkokCondo #CondoForRent"
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Preview Button */}
              <Button
                variant="secondary"
                onClick={() => {
                  setPreviewFbTab('page1');
                  setPreviewPlatform('facebook');
                }}
                disabled={!fbPage1Enabled}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  height: '36px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: '6px',
                  borderColor: 'rgba(24, 119, 242, 0.3)',
                  color: '#1877F2',
                  backgroundColor: 'rgba(24, 119, 242, 0.05)',
                  marginTop: '1rem',
                }}
              >
                <FiEye />
                <span>Preview Page 1 Post</span>
              </Button>
            </div>
          )}

          {/* ==================================================== */}
          {/* BOX 1B: Facebook Page 2 (61593000699921)             */}
          {/* ==================================================== */}
          {(activePlatformTab === 'all' || activePlatformTab === 'facebook') && (
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: fbPage2Enabled ? '2px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: fbPage2Enabled ? '0 4px 20px rgba(16, 185, 129, 0.08)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Box Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                      overflow: 'hidden',
                      position: 'relative',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    {page2Picture ? (
                      <img
                        src={page2Picture}
                        alt={page2Name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <FaFacebook />
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {page2Name}
                      </h3>
                      <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 7px', borderRadius: '4px' }}>
                        Slot 2
                      </span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'var(--bg-main)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        Meta Graph API v26.0
                      </span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Page ID: {page2PageId}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => (onNavigateTab ? onNavigateTab('facebook-tokens') : setIsTokenManagerModalOpen(true))}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '7px',
                      padding: '4px 10px',
                      color: '#10B981',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: 'rgba(16, 185, 129, 0.05)',
                      transition: 'all 0.15s ease',
                    }}
                    title="Open Page Token Manager menu"
                  >
                    <FiSliders />
                    <span>Page Tokens</span>
                  </button>

                  {/* Enable Switch Toggle */}
                  <SwitchToggle
                    checked={fbPage2Enabled}
                    onChange={(val) => {
                      if (val && (!page2Connected || !page2Meta?.can_create_content)) {
                        showToast('⚠️ Auto-publishing requires a valid token with verified CREATE_CONTENT permission. Run "Test Connection" first.');
                        return;
                      }
                      setFbPage2Enabled(val);
                    }}
                    activeColor="#10B981"
                    label={fbPage2Enabled ? 'Active' : 'Off'}
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* Status Row with Copy Button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '0.875rem',
                  fontSize: '0.6875rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Verified API Connection Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: page2Connected ? '#22C55E' : '#EF4444',
                        boxShadow: page2Connected ? '0 0 6px rgba(34, 197, 94, 0.6)' : '0 0 6px rgba(239, 68, 68, 0.6)',
                      }}
                    />
                    <span>
                      Connection:{' '}
                      <strong style={{ color: page2Connected ? '#22C55E' : '#EF4444' }}>
                        {page2Connected ? 'Connected' : 'Disconnected'}
                      </strong>
                    </span>
                  </div>

                  <span style={{ color: 'var(--border-color)', opacity: 0.6 }}>|</span>

                  {/* Token Validity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Token:</span>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor:
                          page2TokenStatus === 'VALID'
                            ? 'rgba(34, 197, 94, 0.12)'
                            : page2TokenStatus === 'MISSING'
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(245, 158, 11, 0.12)',
                        color:
                          page2TokenStatus === 'VALID'
                            ? '#22C55E'
                            : page2TokenStatus === 'MISSING'
                            ? '#EF4444'
                            : '#F59E0B',
                        border: `1px solid ${
                          page2TokenStatus === 'VALID'
                            ? 'rgba(34, 197, 94, 0.25)'
                            : page2TokenStatus === 'MISSING'
                            ? 'rgba(239, 68, 68, 0.25)'
                            : 'rgba(245, 158, 11, 0.25)'
                        }`,
                      }}
                    >
                      {formatTokenValidity(page2TokenStatus, page2Meta?.has_token)}
                    </span>
                  </div>

                  <span style={{ color: 'var(--border-color)', opacity: 0.6 }}>|</span>

                  {/* Publishing Permission Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Publishing:</span>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor: page2Meta?.can_create_content ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                        color: page2Meta?.can_create_content ? '#22C55E' : '#EF4444',
                        border: `1px solid ${page2Meta?.can_create_content ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                      }}
                    >
                      {page2Meta?.can_create_content ? 'CREATE_CONTENT' : 'Limited Rights'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {/* Reconnect button if expired or reconnect required */}
                  {(page2TokenStatus === 'EXPIRED' || page2TokenStatus === 'RECONNECT_REQUIRED' || page2TokenStatus === 'INVALID') && (
                    <button
                      type="button"
                      onClick={handleConnectFacebookOAuth}
                      style={{
                        background: '#10B981',
                        border: 'none',
                        borderRadius: '5px',
                        padding: '3px 9px',
                        color: '#FFFFFF',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 1px 4px rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      <SiMeta />
                      <span>Reconnect</span>
                    </button>
                  )}

                  {/* Test Connection button */}
                  <button
                    type="button"
                    onClick={() => handleTestPageConnection(page2PageId)}
                    disabled={testingPageId === page2PageId}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      color: '#10B981',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: testingPageId === page2PageId ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    }}
                    title="Validate Page Access Token and CREATE_CONTENT permission"
                  >
                    <FiCheckCircle style={{ animation: testingPageId === page2PageId ? 'spin 1s linear infinite' : 'none' }} />
                    <span>{testingPageId === page2PageId ? 'Testing...' : 'Test Connection'}</span>
                  </button>

                  {/* Refresh Page Info button */}
                  <button
                    type="button"
                    onClick={() => handleRefreshPageInfo(page2PageId)}
                    disabled={refreshingPageId === page2PageId}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      color: '#10B981',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: refreshingPageId === page2PageId ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(16, 185, 129, 0.05)',
                      transition: 'all 0.15s ease',
                    }}
                    title="Retrieve real Facebook Page name and profile picture from Meta Graph API"
                  >
                    <FiRefreshCw
                      style={{
                        fontSize: '0.625rem',
                        animation: refreshingPageId === page2PageId ? 'spin 1s linear infinite' : 'none',
                      }}
                    />
                    <span>{refreshingPageId === page2PageId ? 'Refreshing...' : 'Refresh Info'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPage1ToPage2}
                    disabled={!fbPage2Enabled}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      color: 'var(--text-secondary)',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      cursor: fbPage2Enabled ? 'pointer' : 'not-allowed',
                      opacity: fbPage2Enabled ? 1 : 0.6,
                    }}
                    title="Copy Page 1 Title, Caption and Hashtags into Page 2"
                  >
                    Copy from Page 1
                  </button>

                  <button
                    type="button"
                    onClick={() => (onNavigateTab ? onNavigateTab('facebook-tokens') : setIsTokenManagerModalOpen(true))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#10B981',
                      cursor: 'pointer',
                      padding: '3px 4px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.6875rem',
                    }}
                  >
                    <span>Manage Token</span>
                    <FiExternalLink style={{ fontSize: '0.625rem' }} />
                  </button>
                </div>
              </div>

              {/* Zero Mixing Callout */}
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  fontSize: '0.6875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1rem',
                  lineHeight: 1.35,
                }}
              >
                🔒 <strong>Isolated Publishing:</strong> Content in this box will only be published to {page2Name} ({page2PageId}).
              </div>

              {/* Form Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', flex: 1 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Page 2 Title (Independent)
                    </label>
                  </div>
                  <input
                    type="text"
                    value={fbPage2Headline}
                    onChange={(e) => setFbPage2Headline(e.target.value)}
                    disabled={!fbPage2Enabled}
                    placeholder="Page 2 headline (e.g. 🏙️ Exclusive High-Floor Studio | BTS Bang Chak)"
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Page 2 Description & Details
                    </label>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {fbPage2Caption.length} characters
                    </span>
                  </div>
                  <textarea
                    value={fbPage2Caption}
                    onChange={(e) => setFbPage2Caption(e.target.value)}
                    disabled={!fbPage2Enabled}
                    rows={7}
                    placeholder="Write custom tailored property description for Page 2 audience..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Page 2 Hashtags
                  </label>
                  <input
                    type="text"
                    value={fbPage2Hashtags}
                    onChange={(e) => setFbPage2Hashtags(e.target.value)}
                    disabled={!fbPage2Enabled}
                    placeholder="#BangkokLiving #IdeoSukhumvit #CondoNearBTS"
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Preview Button */}
              <Button
                variant="secondary"
                onClick={() => {
                  setPreviewFbTab('page2');
                  setPreviewPlatform('facebook');
                }}
                disabled={!fbPage2Enabled}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  height: '36px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: '6px',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  color: '#10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.05)',
                  marginTop: '1rem',
                }}
              >
                <FiEye />
                <span>Preview Page 2 Post</span>
              </Button>
            </div>
          )}

          {/* ==================================================== */}
          {/* BOX 2: Instagram                                     */}
          {/* ==================================================== */}
          {(activePlatformTab === 'all' || activePlatformTab === 'instagram') && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: igEnabled ? '2px solid rgba(228, 64, 95, 0.4)' : '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: igEnabled ? '0 4px 20px rgba(228, 64, 95, 0.08)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Box Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(45deg, #F58529 0%, #D62976 50%, #962FBF 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.125rem',
                  }}
                >
                  <FaInstagram />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Instagram
                  </h3>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    Carousel feed with aesthetic layout
                  </span>
                </div>
              </div>

              {/* Enable Switch Toggle */}
              <SwitchToggle
                checked={igEnabled}
                onChange={(val) => setIgEnabled(val)}
                activeColor="#E4405F"
                label={igEnabled ? 'Active' : 'Off'}
                isDark={isDark}
              />
            </div>

            {/* Target Account Selector */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Target Instagram Account
              </label>
              <Select
                value={igAccountOptions.find((opt) => opt.value === igAccountId) || igAccountOptions[0]}
                onChange={(option: any) => {
                  if (option) setIgAccountId(option.value);
                }}
                options={igAccountOptions}
                isDisabled={!igEnabled}
                styles={selectStyles}
                isSearchable={false}
                formatOptionLabel={(option: any) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontWeight: 600 }}>{option.handle}</span>
                    <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>{option.followers}</span>
                  </div>
                )}
              />
            </div>

            {/* Location Tag */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Location Tag (Instagram Geotag)
              </label>
              <input
                type="text"
                value={igLocationTag}
                onChange={(e) => setIgLocationTag(e.target.value)}
                disabled={!igEnabled}
                placeholder="e.g. Ashton Asoke, Sukhumvit Road"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  opacity: igEnabled ? 1 : 0.6,
                }}
              />
            </div>

            {/* Caption Textarea */}
            <div style={{ marginBottom: '0.875rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Instagram Caption
                </label>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: igCaption.length > 2200 ? '#EF4444' : 'var(--text-muted)',
                    fontWeight: igCaption.length > 2200 ? 700 : 400,
                  }}
                >
                  {igCaption.length} / 2,200 chars
                </span>
              </div>
              <textarea
                value={igCaption}
                onChange={(e) => setIgCaption(e.target.value)}
                disabled={!igEnabled}
                rows={7}
                placeholder="Clean aesthetic caption with line breaks and DM CTA..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  opacity: igEnabled ? 1 : 0.6,
                }}
              />
            </div>

            {/* First Comment / Hashtags (Clean IG Style) */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  1st Comment Hashtags (Clean Feed)
                </label>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Auto-posted immediately
                </span>
              </div>
              <input
                type="text"
                value={igFirstCommentHashtags}
                onChange={(e) => setIgFirstCommentHashtags(e.target.value)}
                disabled={!igEnabled}
                placeholder="#BangkokCondo #RealEstate #LuxuryLiving"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  opacity: igEnabled ? 1 : 0.6,
                }}
              />
            </div>

            {/* Preview Button */}
            <Button
              variant="secondary"
              onClick={() => setPreviewPlatform('instagram')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '36px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderRadius: '6px',
                borderColor: 'rgba(228, 64, 95, 0.3)',
                color: '#E4405F',
                backgroundColor: 'rgba(228, 64, 95, 0.05)',
              }}
            >
              <FiEye />
              <span>Preview Instagram Carousel</span>
            </Button>
          </div>
          )}

          {/* ==================================================== */}
          {/* BOX 3: TikTok                                        */}
          {/* ==================================================== */}
          {(activePlatformTab === 'all' || activePlatformTab === 'tiktok') && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: ttEnabled ? '2px solid rgba(0, 242, 254, 0.4)' : '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: ttEnabled ? '0 4px 20px rgba(0, 242, 254, 0.08)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Box Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#000000',
                    color: '#00F2FE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.125rem',
                    border: '1px solid rgba(254, 44, 85, 0.4)',
                  }}
                >
                  <FaTiktok />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    TikTok
                  </h3>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    Viral Hook & Photo Mode carousel
                  </span>
                </div>
              </div>

              {/* Enable Switch Toggle */}
              <SwitchToggle
                checked={ttEnabled}
                onChange={(val) => setTtEnabled(val)}
                activeColor={isDark ? '#00F2FE' : '#0891B2'}
                label={ttEnabled ? 'Active' : 'Off'}
                isDark={isDark}
              />
            </div>

            {/* Target Account Selector */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Target TikTok Account
              </label>
              <Select
                value={ttAccountOptions.find((opt) => opt.value === ttAccountId) || ttAccountOptions[0]}
                onChange={(option: any) => {
                  if (option) setTtAccountId(option.value);
                }}
                options={ttAccountOptions}
                isDisabled={!ttEnabled}
                styles={selectStyles}
                isSearchable={false}
                formatOptionLabel={(option: any) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontWeight: 600 }}>{option.handle}</span>
                    <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>{option.followers}</span>
                  </div>
                )}
              />
            </div>

            {/* Viral Hook (First 3 Seconds) */}
            <div style={{ marginBottom: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#FE2C55' }}>
                  ⚡ First 3-Sec Hook (TikTok Overlay)
                </label>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Grab attention immediately
                </span>
              </div>
              <input
                type="text"
                value={ttHook}
                onChange={(e) => setTtHook(e.target.value)}
                disabled={!ttEnabled}
                placeholder="e.g. Is this the best condo value under 20k? 😱"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(254, 44, 85, 0.4)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  opacity: ttEnabled ? 1 : 0.6,
                }}
              />
            </div>

            {/* Caption Textarea */}
            <div style={{ marginBottom: '0.875rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  TikTok Caption & Tags
                </label>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  {ttCaption.length} / 2,200
                </span>
              </div>
              <textarea
                value={ttCaption}
                onChange={(e) => setTtCaption(e.target.value)}
                disabled={!ttEnabled}
                rows={5}
                placeholder="Short punchy caption with question to provoke comments..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  opacity: ttEnabled ? 1 : 0.6,
                }}
              />
            </div>

            {/* Sound Selector */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                🎵 Background Music / Audio
              </label>
              <Select
                value={ttSoundOptions.find((opt) => opt.value === ttSound) || ttSoundOptions[0]}
                onChange={(option: any) => {
                  if (option) setTtSound(option.value);
                }}
                options={ttSoundOptions}
                isDisabled={!ttEnabled}
                styles={selectStyles}
                isSearchable={false}
              />
            </div>

            {/* TikTok Options & Settings */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={ttAllowComments}
                    onChange={(e) => setTtAllowComments(e.target.checked)}
                    disabled={!ttEnabled}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span>Comments</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={ttAllowDuet}
                    onChange={(e) => setTtAllowDuet(e.target.checked)}
                    disabled={!ttEnabled}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span>Duet & Stitch</span>
                </label>
              </div>

              <div style={{ minWidth: '150px' }}>
                <Select
                  value={ttPrivacyOptions.find((opt) => opt.value === ttPrivacy) || ttPrivacyOptions[0]}
                  onChange={(option: any) => {
                    if (option) setTtPrivacy(option.value);
                  }}
                  options={ttPrivacyOptions}
                  isDisabled={!ttEnabled}
                  styles={selectStyles}
                  isSearchable={false}
                />
              </div>
            </div>

            {/* Preview Button */}
            <Button
              variant="secondary"
              onClick={() => setPreviewPlatform('tiktok')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '36px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderRadius: '6px',
                borderColor: 'rgba(0, 242, 254, 0.3)',
                color: isDark ? '#00F2FE' : '#0891B2',
                backgroundColor: 'rgba(0, 242, 254, 0.05)',
              }}
            >
              <FiEye />
              <span>Preview TikTok Photo Mode</span>
            </Button>
          </div>
          )}
        </div>

        {/* SECTION 4: Social Publishing Manager */}
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
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Social Publishing Manager
            </h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Account selection · Scheduling · Multi-channel Queue & Distribution
            </span>
          </div>

          {/* Active Channels Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: fbEnabled ? 'rgba(24, 119, 242, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${fbEnabled ? 'rgba(24, 119, 242, 0.3)' : 'var(--border-color)'}`,
                color: fbEnabled ? '#1877F2' : 'var(--text-muted)',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              <FaFacebook />
              <span>Facebook Page</span>
              {fbEnabled && <FiCheckCircle style={{ color: '#22C55E' }} />}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: igEnabled ? 'rgba(228, 64, 95, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${igEnabled ? 'rgba(228, 64, 95, 0.3)' : 'var(--border-color)'}`,
                color: igEnabled ? '#E4405F' : 'var(--text-muted)',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              <FaInstagram />
              <span>Instagram</span>
              {igEnabled && <FiCheckCircle style={{ color: '#22C55E' }} />}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: ttEnabled ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${ttEnabled ? 'rgba(0, 242, 254, 0.3)' : 'var(--border-color)'}`,
                color: ttEnabled ? (isDark ? '#00F2FE' : '#0891B2') : 'var(--text-muted)',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              <FaTiktok />
              <span>TikTok</span>
              {ttEnabled && <FiCheckCircle style={{ color: '#22C55E' }} />}
            </div>
          </div>
        </div>

        {/* Schedule & Execute Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Timing Choice */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              <input
                type="radio"
                name="scheduleType"
                checked={scheduleType === 'NOW'}
                onChange={() => setScheduleType('NOW')}
                style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <span>⚡ Publish Immediately</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              <input
                type="radio"
                name="scheduleType"
                checked={scheduleType === 'SCHEDULED'}
                onChange={() => setScheduleType('SCHEDULED')}
                style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <span>🕒 Schedule for Later</span>
            </label>

            {scheduleType === 'SCHEDULED' && (
              <input
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(e) => setScheduledDateTime(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
            )}
          </div>

          {/* Big Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Button
              variant="primary"
              onClick={handleStartPublish}
              disabled={selectedChannelsCount === 0 || images.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                height: '38px',
                padding: '0 20px',
                fontSize: '0.875rem',
                fontWeight: 600,
                borderRadius: '6px',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
              }}
            >
              <FiSend />
              <span>
                {scheduleType === 'SCHEDULED'
                  ? `Schedule Post to ${selectedChannelsCount} Channel${selectedChannelsCount > 1 ? 's' : ''}`
                  : `Publish to ${selectedChannelsCount} Channel${selectedChannelsCount > 1 ? 's' : ''} Now`}
              </span>
            </Button>
          </div>
        </div>
      </div>
      </div>
      </div>



      {/* ======================================================== */}
      {/* MODAL 1: Publishing Simulation Progress Modal            */}
      {/* ======================================================== */}
      {isPublishingModalOpen && (
        <Modal
          isOpen={isPublishingModalOpen}
          onClose={() => {
            if (publishProgress.completed) setIsPublishingModalOpen(false);
          }}
          title={
            publishProgress.completed
              ? (publishProgress.isSuccess ? '🎉 Publishing Completed!' : '❌ Publishing Failed')
              : 'Publishing to Social Channels...'
          }
        >
          <div style={{ padding: '1.25rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span>Step {publishProgress.step} of {publishProgress.total}</span>
                <span>{Math.round((publishProgress.step / publishProgress.total) * 100)}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(publishProgress.step / publishProgress.total) * 100}%`,
                    background: publishProgress.completed && !publishProgress.isSuccess
                      ? '#EF4444'
                      : 'linear-gradient(90deg, #1877F2, #E4405F, #00F2FE)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* Current Step Description */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: publishProgress.completed
                  ? (publishProgress.isSuccess ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)')
                  : 'var(--bg-main)',
                border: `1px solid ${
                  publishProgress.completed
                    ? (publishProgress.isSuccess ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)')
                    : 'var(--border-color)'
                }`,
                color: publishProgress.completed
                  ? (publishProgress.isSuccess ? '#22C55E' : '#EF4444')
                  : 'var(--text-primary)',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {publishProgress.completed ? (
                publishProgress.isSuccess ? (
                  <FiCheckCircle style={{ fontSize: '1.25rem', color: '#22C55E', flexShrink: 0 }} />
                ) : (
                  <FiAlertCircle style={{ fontSize: '1.25rem', color: '#EF4444', flexShrink: 0 }} />
                )
              ) : (
                <FiRefreshCw style={{ fontSize: '1.125rem', color: 'var(--accent-primary)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
              )}
              <span>{publishProgress.text}</span>
            </div>

            {/* Platform Results List */}
            {publishProgress.completed && publishProgress.createdItem && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Live Channel Distribution
                </span>

                {publishProgress.createdItem.facebook.enabled && (
                  <>
                    {/* Page 1 Result Row if targeted */}
                    {(publishProgress.createdItem.platformResults.facebookPage1 || publishProgress.createdItem.facebook.targetMode === 'page1' || publishProgress.createdItem.facebook.targetMode === 'both') && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', border: '1px solid rgba(24, 119, 242, 0.3)', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '5px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1877F2', color: '#fff' }}>
                            {page1Picture ? <img src={page1Picture} alt={page1Name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FaFacebook style={{ fontSize: '0.875rem' }} />}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{page1Name}</span>
                              <span style={{ fontSize: '0.625rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(24, 119, 242, 0.1)', color: '#1877F2', fontFamily: 'monospace' }}>
                                {page1PageId}
                              </span>
                            </div>
                            {publishProgress.createdItem.platformResults.facebookPage1?.postId && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                                Post ID: {publishProgress.createdItem.platformResults.facebookPage1.postId}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {publishProgress.createdItem.platformResults.facebookPage1?.status === 'success' ? (
                            <>
                              <span style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FiCheck /> Published
                              </span>
                              {publishProgress.createdItem.platformResults.facebookPage1.postUrl && (
                                <a
                                  href={publishProgress.createdItem.platformResults.facebookPage1.postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    color: '#FFFFFF',
                                    backgroundColor: '#1877F2',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <span>View Page 1 Post</span>
                                  <FiExternalLink />
                                </a>
                              )}
                            </>
                          ) : publishProgress.createdItem.platformResults.facebookPage1?.status === 'scheduled' ? (
                            <span style={{ fontSize: '0.75rem', color: '#3B82F6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FiClock /> Scheduled
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 600 }}>
                              Failed ({publishProgress.createdItem.platformResults.facebookPage1?.error || 'Error'})
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Page 2 Result Row if targeted */}
                    {(publishProgress.createdItem.platformResults.facebookPage2 || publishProgress.createdItem.facebook.targetMode === 'page2' || publishProgress.createdItem.facebook.targetMode === 'both') && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', border: '1px solid rgba(16, 185, 129, 0.3)', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '5px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', color: '#fff' }}>
                            {page2Picture ? <img src={page2Picture} alt={page2Name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FaFacebook style={{ fontSize: '0.875rem' }} />}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{page2Name}</span>
                              <span style={{ fontSize: '0.625rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', fontFamily: 'monospace' }}>
                                {page2PageId}
                              </span>
                            </div>
                            {publishProgress.createdItem.platformResults.facebookPage2?.postId && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                                Post ID: {publishProgress.createdItem.platformResults.facebookPage2.postId}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {publishProgress.createdItem.platformResults.facebookPage2?.status === 'success' ? (
                            <>
                              <span style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FiCheck /> Published
                              </span>
                              {publishProgress.createdItem.platformResults.facebookPage2.postUrl && (
                                <a
                                  href={publishProgress.createdItem.platformResults.facebookPage2.postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    color: '#FFFFFF',
                                    backgroundColor: '#10B981',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <span>View Page 2 Post</span>
                                  <FiExternalLink />
                                </a>
                              )}
                            </>
                          ) : publishProgress.createdItem.platformResults.facebookPage2?.status === 'scheduled' ? (
                            <span style={{ fontSize: '0.75rem', color: '#3B82F6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FiClock /> Scheduled
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 600 }}>
                              Failed ({publishProgress.createdItem.platformResults.facebookPage2?.error || 'Error'})
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Legacy Single Result Fallback if neither sub-result exists */}
                    {!publishProgress.createdItem.platformResults.facebookPage1 && !publishProgress.createdItem.platformResults.facebookPage2 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FaFacebook style={{ color: '#1877F2', fontSize: '1.125rem' }} />
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Facebook Page ({publishProgress.createdItem.facebook.pageName})</div>
                            {publishProgress.createdItem.platformResults.facebook.postId && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                                Post ID: {publishProgress.createdItem.platformResults.facebook.postId}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {publishProgress.createdItem.platformResults.facebook.status === 'success' ? (
                            <>
                              <span style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FiCheck /> Published
                              </span>
                              {publishProgress.createdItem.platformResults.facebook.postUrl && (
                                <a
                                  href={publishProgress.createdItem.platformResults.facebook.postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    color: '#FFFFFF',
                                    backgroundColor: '#1877F2',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <span>View on Facebook</span>
                                  <FiExternalLink />
                                </a>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 600 }}>
                              Failed ({publishProgress.createdItem.platformResults.facebook.error || 'Error'})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {publishProgress.createdItem.instagram.enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FaInstagram style={{ color: '#E4405F' }} />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Instagram ({publishProgress.createdItem.instagram.accountName})</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiCheck /> Carousel Published
                    </span>
                  </div>
                )}

                {publishProgress.createdItem.tiktok.enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FaTiktok style={{ color: isDark ? '#00F2FE' : '#0891B2' }} />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>TikTok ({publishProgress.createdItem.tiktok.accountName})</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiCheck /> Photo Mode Posted
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            {publishProgress.completed && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <Button
                  variant="secondary"
                  onClick={() => setIsPublishingModalOpen(false)}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsPublishingModalOpen(false);
                    if (onNavigateTab) onNavigateTab('post-history');
                    else window.location.assign('/post-history');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiClock />
                  <span>View in Post History</span>
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: Remaining Posts Selection Modal                 */}
      {/* ======================================================== */}
      {isRemainingPostsModalOpen && (
        <Modal
          isOpen={isRemainingPostsModalOpen}
          onClose={() => setIsRemainingPostsModalOpen(false)}
          title="Import Listing from Remaining Posts"
        >
          <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {remainingPostsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                <FiLayers style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }} />
                <p style={{ margin: '0 0 0.75rem' }}>No saved posts in Remaining Posts yet.</p>
                {onNavigateTab && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsRemainingPostsModalOpen(false);
                      onNavigateTab('remaining-posts');
                    }}
                  >
                    Go to Remaining Posts
                  </Button>
                )}
              </div>
            ) : (
              remainingPostsList.map((post) => {
                const imgCount = post.originalImages?.length || 0;
                const coverUrl =
                  post.originalImages?.[0]?.stored_url ||
                  post.originalImages?.[0]?.source_url ||
                  post.enhancedPhotos?.[1] ||
                  '';

                return (
                  <div
                    key={post.id}
                    onClick={() => handleSelectRemainingPost(post)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-main)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={post.projectName}
                          style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '56px', height: '56px', borderRadius: '8px', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiImage />
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                          {post.projectName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {post.propertyData?.price ? `฿${post.propertyData.price}` : 'No price'} · {imgCount} Photos
                        </div>
                      </div>
                    </div>

                    <Button variant="secondary" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                      Select & Fill
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: Platform Live Mockup Previews                   */}
      {/* ======================================================== */}
      {previewPlatform && (
        <Modal
          isOpen={Boolean(previewPlatform)}
          onClose={() => setPreviewPlatform(null)}
          title={`Preview: ${
            previewPlatform === 'facebook'
              ? 'Facebook Page Post'
              : previewPlatform === 'instagram'
              ? 'Instagram Carousel Post'
              : 'TikTok Photo Mode'
          }`}
        >
          <div style={{ maxHeight: '75vh', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
            {/* Facebook Preview Card */}
            {previewPlatform === 'facebook' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '520px' }}>
                {/* Sub-tab toggle when Target is "Both" */}
                {fbTargetMode === 'both' && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '4px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      width: '100%',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewFbTab('page1')}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: previewFbTab === 'page1' ? '#1877F2' : 'transparent',
                        color: previewFbTab === 'page1' ? '#FFFFFF' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      📘 {page1Name} ({page1PageId})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFbTab('page2')}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: previewFbTab === 'page2' ? '#10B981' : 'transparent',
                        color: previewFbTab === 'page2' ? '#FFFFFF' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      📗 {page2Name} ({page2PageId})
                    </button>
                  </div>
                )}

                {(() => {
                  const isPreviewingPage2 = fbTargetMode === 'page2' || (fbTargetMode === 'both' && previewFbTab === 'page2');
                  const targetPageName = isPreviewingPage2 ? page2Name : page1Name;
                  const targetHeadline = isPreviewingPage2 ? fbPage2Headline : fbHeadline;
                  const targetCaption = isPreviewingPage2 ? fbPage2Caption : fbCaption;
                  const targetHashtags = isPreviewingPage2 ? fbPage2Hashtags : fbHashtags;
                  const targetImgs = isPreviewingPage2
                    ? (fbPage2Images.length > 0 ? fbPage2Images : images)
                    : (fbImages.length > 0 ? fbImages : images);
                  const targetProfilePic = isPreviewingPage2 ? page2Picture : page1Picture;

                  return (
                    <div
                      style={{
                        width: '100%',
                        backgroundColor: '#FFFFFF',
                        color: '#050505',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                        overflow: 'hidden',
                        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                      }}
                    >
                      {/* FB Post Header */}
                      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: isPreviewingPage2 ? '#10B981' : '#1877F2',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem',
                            overflow: 'hidden',
                            border: '1px solid rgba(0, 0, 0, 0.08)',
                          }}
                        >
                          {targetProfilePic ? (
                            <img
                              src={targetProfilePic}
                              alt={targetPageName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <FaFacebook />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#050505' }}>
                            {targetPageName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#65676B' }}>
                            Just now · 🌐 Public
                          </div>
                        </div>
                      </div>

                      {/* FB Post Text */}
                      <div style={{ padding: '0 16px 12px', fontSize: '0.875rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                        <strong style={{ display: 'block', marginBottom: '6px' }}>{targetHeadline}</strong>
                        {targetCaption}
                        {fbCta && <div style={{ marginTop: '8px', color: '#1877F2', fontWeight: 600 }}>{fbCta}</div>}
                        {targetHashtags && <div style={{ marginTop: '6px', color: '#1877F2' }}>{targetHashtags}</div>}
                      </div>

                      {/* FB Post Photos Grid */}
                      {targetImgs.length > 0 && (
                        <div style={{ width: '100%', backgroundColor: '#000000' }}>
                          <img
                            src={targetImgs[0].url}
                            alt="Cover"
                            style={{ width: '100%', maxHeight: '360px', objectFit: 'cover', display: 'block' }}
                          />
                          {targetImgs.length > 1 && (
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(targetImgs.length - 1, 3)}, 1fr)`, gap: '2px', marginTop: '2px' }}>
                              {targetImgs.slice(1, 4).map((img, i) => (
                                <div key={img.id} style={{ height: '90px', position: 'relative' }}>
                                  <img src={img.url} alt="Gallery" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  {i === 2 && targetImgs.length > 4 && (
                                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                      +{targetImgs.length - 4}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Instagram Preview Card */}
            {previewPlatform === 'instagram' && (
              <div
                style={{
                  width: '100%',
                  maxWidth: '430px',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  borderRadius: '16px',
                  boxShadow: '0 4px 25px rgba(0, 0, 0, 0.4)',
                  overflow: 'hidden',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                }}
              >
                {/* IG Header */}
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(45deg, #F58529, #D62976, #962FBF)', padding: '2px' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '0.75rem' }}>
                        EA
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                        {CONNECTED_IG_ACCOUNTS.find((a) => a.id === igAccountId)?.handle?.replace('@', '') || 'luxury_realestate'}
                      </div>
                      {igLocationTag && (
                        <div style={{ fontSize: '0.6875rem', color: '#A8A8A8' }}>{igLocationTag}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* IG Main Photo Carousel */}
                <div style={{ width: '100%', height: '380px', backgroundColor: '#111111', position: 'relative' }}>
                  {images[0] ? (
                    <img
                      src={images[0].url}
                      alt="Cover"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Photo</div>
                  )}
                  {images.length > 1 && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '3px 8px', borderRadius: '12px', backgroundColor: 'rgba(0,0,0,0.7)', fontSize: '0.6875rem', fontWeight: 600 }}>
                      1/{images.length}
                    </div>
                  )}
                </div>

                {/* IG Actions Bar */}
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '1.25rem', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '14px' }}>
                      <FaRegHeart />
                      <FaRegComment />
                      <FiSend />
                    </div>
                    <FaRegBookmark />
                  </div>

                  {/* Caption */}
                  <div style={{ fontSize: '0.8125rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                    <strong style={{ marginRight: '6px' }}>
                      {CONNECTED_IG_ACCOUNTS.find((a) => a.id === igAccountId)?.handle?.replace('@', '') || 'luxury_realestate'}
                    </strong>
                    {igCaption}
                  </div>

                  {/* First Comment Hashtags */}
                  {igFirstCommentHashtags && (
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#38BDF8' }}>
                      {igFirstCommentHashtags}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TikTok Preview Card */}
            {previewPlatform === 'tiktok' && (
              <div
                style={{
                  width: '320px',
                  height: '580px',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  borderRadius: '24px',
                  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.6)',
                  overflow: 'hidden',
                  position: 'relative',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                  border: '8px solid #1F2937',
                }}
              >
                {/* Background Image / Photo Mode */}
                {images[0] ? (
                  <img
                    src={images[0].url}
                    alt="TikTok Cover"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Image</div>
                )}

                {/* Top Hook Banner */}
                {ttHook && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '40px',
                      left: '14px',
                      right: '14px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      backdropFilter: 'blur(4px)',
                      borderRadius: '8px',
                      borderLeft: '4px solid #FE2C55',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                    }}
                  >
                    {ttHook}
                  </div>
                )}

                {/* Right Sidebar Icons */}
                <div style={{ position: 'absolute', right: '12px', bottom: '90px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', fontSize: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <FaHeart style={{ color: '#FE2C55' }} />
                    <span style={{ fontSize: '0.625rem', marginTop: '2px' }}>4.8K</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <FaComment />
                    <span style={{ fontSize: '0.625rem', marginTop: '2px' }}>182</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <FaBookmark />
                    <span style={{ fontSize: '0.625rem', marginTop: '2px' }}>920</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <FiShare2 />
                    <span style={{ fontSize: '0.625rem', marginTop: '2px' }}>Share</span>
                  </div>
                </div>

                {/* Bottom Overlay & Audio */}
                <div style={{ position: 'absolute', bottom: '16px', left: '12px', right: '60px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px' }}>
                    {CONNECTED_TIKTOK_ACCOUNTS.find((a) => a.id === ttAccountId)?.handle || '@bkk_condo_tours'}
                  </div>
                  <div style={{ fontSize: '0.75rem', lineHeight: 1.3, maxHeight: '60px', overflow: 'hidden' }}>
                    {ttCaption}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', marginTop: '6px', color: '#A1A1AA' }}>
                    <FaMusic style={{ color: '#00F2FE' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ttSound}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: Connect Facebook Page with Meta                 */}
      {/* ======================================================== */}
      {isMetaModalOpen && (
        <Modal
          isOpen={isMetaModalOpen}
          onClose={() => setIsMetaModalOpen(false)}
          title="Connect Facebook Page with Meta"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Meta Branding Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '1rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(24, 119, 242, 0.08)',
                border: '1px solid rgba(24, 119, 242, 0.25)',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#1877F2',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.375rem',
                  flexShrink: 0,
                }}
              >
                <SiMeta />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Meta Business Suite & Graph API
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Connect your real Facebook Page to publish photos and listings directly via Meta Graph API v19.0.
                </p>
              </div>
            </div>

            {/* Official Meta OAuth Login */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Option 1: Official Meta OAuth Login
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Log into your Facebook account with official Meta authorization dialog
                  </div>
                </div>
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleStartMetaOAuthLogin}
                  disabled={isConnectingMeta}
                  style={{
                    backgroundColor: '#1877F2',
                    borderColor: '#1877F2',
                    height: '36px',
                    padding: '0 14px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <SiMeta />
                  <span>{isConnectingMeta ? 'Connecting...' : 'Login with Meta'}</span>
                </Button>
              </div>
            </div>

            {/* Manual Facebook Page Linking */}
            <form
              onSubmit={handleConnectCustomMetaPage}
              style={{
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Option 2: Link Facebook Page Directly
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Enter your Facebook Page details to bind it to your publishing workflow
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Facebook Page Name *
                </label>
                <input
                  type="text"
                  value={metaPageName}
                  onChange={(e) => setMetaPageName(e.target.value)}
                  placeholder="e.g. Bangkok Premier Properties"
                  required
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Page ID (from Meta Settings)
                  </label>
                  <input
                    type="text"
                    value={metaPageIdInput}
                    onChange={(e) => setMetaPageIdInput(e.target.value)}
                    placeholder="e.g. 104928172938172"
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Followers / Audience
                  </label>
                  <input
                    type="text"
                    value={metaPageFollowers}
                    onChange={(e) => setMetaPageFollowers(e.target.value)}
                    placeholder="e.g. 12.5K Followers"
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setIsMetaModalOpen(false)}
                  style={{ height: '36px', padding: '0 14px', fontSize: '0.8125rem' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  style={{
                    height: '36px',
                    padding: '0 16px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    backgroundColor: '#1877F2',
                    borderColor: '#1877F2',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <SiMeta />
                  <span>Connect Page</span>
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: Image Lightbox Zoom                            */}
      {/* ======================================================== */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxUrl}
            alt="Preview"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: History Detail Modal                            */}
      {/* ======================================================== */}
      {historyDetailItem && (
        <Modal
          isOpen={Boolean(historyDetailItem)}
          onClose={() => setHistoryDetailItem(null)}
          title={`Published Record: ${historyDetailItem.projectName} (${historyDetailItem.id})`}
        >
          <div style={{ maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            {/* Photos Strip */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Photos ({historyDetailItem.images.length})
              </span>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginTop: '6px', paddingBottom: '4px' }}>
                {historyDetailItem.images.map((img, i) => (
                  <div key={img.id} style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={img.url}
                      alt={img.name}
                      style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover' }}
                    />
                    {i === 0 && (
                      <span style={{ position: 'absolute', bottom: '4px', left: '4px', padding: '1px 4px', borderRadius: '4px', backgroundColor: '#F59E0B', color: '#000', fontSize: '0.625rem', fontWeight: 700 }}>
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Facebook Copy */}
            {historyDetailItem.facebook.enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {historyDetailItem.facebook.page1?.enabled && (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid rgba(24, 119, 242, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#1877F2', fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaFacebook />
                        <span>{page1Name} ({historyDetailItem.facebook.page1?.pageId || page1PageId})</span>
                      </div>
                      {historyDetailItem.platformResults.facebookPage1?.postUrl && (
                        <a
                          href={historyDetailItem.platformResults.facebookPage1.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#1877F2', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                        >
                          <span>View Post</span>
                          <FiExternalLink />
                        </a>
                      )}
                    </div>
                    {historyDetailItem.facebook.page1.headline && (
                      <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '4px' }}>
                        {historyDetailItem.facebook.page1.headline}
                      </div>
                    )}
                    <div style={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                      {historyDetailItem.facebook.page1.caption}
                    </div>
                  </div>
                )}

                {historyDetailItem.facebook.page2?.enabled && (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#10B981', fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaFacebook />
                        <span>{page2Name} ({historyDetailItem.facebook.page2?.pageId || page2PageId})</span>
                      </div>
                      {historyDetailItem.platformResults.facebookPage2?.postUrl && (
                        <a
                          href={historyDetailItem.platformResults.facebookPage2.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#10B981', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                        >
                          <span>View Post</span>
                          <FiExternalLink />
                        </a>
                      )}
                    </div>
                    {historyDetailItem.facebook.page2.headline && (
                      <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '4px' }}>
                        {historyDetailItem.facebook.page2.headline}
                      </div>
                    )}
                    <div style={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                      {historyDetailItem.facebook.page2.caption}
                    </div>
                  </div>
                )}

                {!historyDetailItem.facebook.page1 && !historyDetailItem.facebook.page2 && (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1877F2', fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px' }}>
                      <FaFacebook />
                      <span>Facebook Page ({historyDetailItem.facebook.pageName})</span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                      {historyDetailItem.facebook.caption}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instagram Copy */}
            {historyDetailItem.instagram.enabled && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E4405F', fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px' }}>
                  <FaInstagram />
                  <span>Instagram ({historyDetailItem.instagram.accountName})</span>
                </div>
                <div style={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  {historyDetailItem.instagram.caption}
                </div>
              </div>
            )}

            {/* TikTok Copy */}
            {historyDetailItem.tiktok.enabled && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#00F2FE' : '#0891B2', fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px' }}>
                  <FaTiktok />
                  <span>TikTok ({historyDetailItem.tiktok.accountName})</span>
                </div>
                <div style={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  <strong>Hook: </strong>{historyDetailItem.tiktok.hook}
                  <br />
                  {historyDetailItem.tiktok.caption}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: Confirm Live Facebook Page Publication          */}
      {/* ======================================================== */}
      {isConfirmPublishModalOpen && (
        <Modal
          isOpen={isConfirmPublishModalOpen}
          onClose={() => setIsConfirmPublishModalOpen(false)}
          title="Confirm Live Facebook Publication"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '1rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(24, 119, 242, 0.08)',
                border: '1px solid rgba(24, 119, 242, 0.25)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#1877F2',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}
              >
                <FaFacebook />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Meta Graph API v26.0 Auto-Publishing
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  App ID: <strong>967687235797751</strong> · Mode: <strong>{fbTargetMode === 'both' ? 'Simultaneous Dual-Page' : (fbTargetMode === 'page2' ? 'Single Page 2' : 'Single Page 1')}</strong>
                </p>
              </div>
            </div>

            {/* Destinations Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(fbTargetMode === 'both' || fbTargetMode === 'page1') && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid rgba(24, 119, 242, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1877F2' }}>
                      📘 Destination 1: {page1Name} (ID: {page1PageId})
                    </span>
                    <a
                      href={`https://www.facebook.com/${page1PageId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#1877F2', fontSize: '0.6875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <span>View Page</span>
                      <FiExternalLink />
                    </a>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <strong>Headline:</strong> {fbHeadline}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    Photos: {(fbImages.length > 0 ? fbImages : images).length} items · Separate Token Slot 1
                  </div>
                </div>
              )}

              {(fbTargetMode === 'both' || fbTargetMode === 'page2') && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#10B981' }}>
                      📗 Destination 2: {page2Name} (ID: {page2PageId})
                    </span>
                    <a
                      href={`https://www.facebook.com/${page2PageId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#10B981', fontSize: '0.6875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <span>View Page</span>
                      <FiExternalLink />
                    </a>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <strong>Headline:</strong> {fbPage2Headline}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    Photos: {(fbPage2Images.length > 0 ? fbPage2Images : images).length} items · Separate Token Slot 2
                  </div>
                </div>
              )}
            </div>

            {/* Confirmation Note */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#D97706',
                fontSize: '0.75rem',
                lineHeight: 1.4,
              }}
            >
              ⚠️ <strong>Confirmation Required:</strong> Clicking confirm will immediately upload photos and create official Meta Feed Posts. Page 1 and Page 2 are published independently using their own encrypted tokens with zero content mixing.
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
              <Button
                variant="secondary"
                onClick={() => setIsConfirmPublishModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={executePublishWorkflow}
                style={{
                  backgroundColor: '#1877F2',
                  borderColor: '#1877F2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FiSend />
                <span>Confirm & Publish Live</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: Unified Facebook Page Token Manager (Page 1 & 2)*/}
      {/* ======================================================== */}
      {(isTokenManagerModalOpen || isTokenModalOpen) && (
        <FacebookPageTokenManagerModal
          isOpen={isTokenManagerModalOpen || isTokenModalOpen}
          onClose={() => {
            setIsTokenManagerModalOpen(false);
            setIsTokenModalOpen(false);
          }}
          onPagesUpdated={() => {
            fetchManagedPages();
            fetchMetaConnectionStatus();
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 8: Facebook Page Discovery & Selection Modal       */}
      {/* ======================================================== */}
      {isPageSelectionModalOpen && (
        <FacebookPageSelectionModal
          isOpen={isPageSelectionModalOpen}
          onClose={() => setIsPageSelectionModalOpen(false)}
          onPagesUpdated={() => {
            fetchManagedPages();
            fetchMetaConnectionStatus();
          }}
          onConnectFacebook={handleConnectFacebookOAuth}
        />
      )}
    </div>
  );
};
