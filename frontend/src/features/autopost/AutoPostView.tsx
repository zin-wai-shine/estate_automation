import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  FiArrowRight,
  FiGrid,
  FiLayout,
  FiPhoneCall,
  FiMove,
  FiZoomIn,
  FiZoomOut,
  FiChevronLeft,
  FiChevronRight,
  FiZap,
  FiMusic,
  FiFileText,
  FiGlobe,
  FiDownload,
  FiMoreHorizontal,
  FiHome,
  FiCompass,
  FiMessageSquare,
  FiUser,
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
  FaRegThumbsUp,
  FaThumbsUp,
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
  getStoredManagedPages,
  subscribeManagedPages,
  type ConnectedAccount,
  CONNECTED_FB_PAGES,
  CONNECTED_IG_ACCOUNTS,
  CONNECTED_TIKTOK_ACCOUNTS,
  getStoredTikTokAccounts,
  subscribeTikTokAccounts,
  type ManagedTikTokAccount,
  getStoredInstagramAccounts,
  subscribeInstagramAccounts,
  type ManagedInstagramAccount,
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
import { RichPostEditor } from './RichPostEditor';
import {
  publishTikTokPhotoPost,
  pollTikTokPublishStatus,
  fetchTikTokAccounts,
} from '../../services/tiktokService';
import { apiUrl } from '../../services/apiClient';

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

export const TikTokAppIcon: React.FC<{ size?: number; rounded?: number }> = ({ size = 36, rounded = 8 }) => (
  <div
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: `${rounded}px`,
      backgroundColor: '#000000',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <svg
      viewBox="0 0 448 512"
      width={Math.round(size * 0.58)}
      height={Math.round(size * 0.58)}
      style={{ display: 'block' }}
    >
      {/* Cyan/Aqua offset (top-left) */}
      <path
        d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"
        fill="#25F4EE"
        transform="translate(-10, -8)"
      />
      {/* Pink/Red offset (bottom-right) */}
      <path
        d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"
        fill="#FE2C55"
        transform="translate(10, 8)"
      />
      {/* White center note */}
      <path
        d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"
        fill="#FFFFFF"
      />
    </svg>
  </div>
);

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
      section: 'header',
    },
    {
      id: 'img-2',
      url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      name: 'Kitchen & Dining Area.jpg',
      isCover: false,
      section: 'body',
    },
    {
      id: 'img-3',
      url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      name: 'Modern Bathroom.jpg',
      isCover: false,
      section: 'body',
    },
    {
      id: 'img-4',
      url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      name: 'Balcony City View.jpg',
      isCover: false,
      section: 'footer',
    },
  ]);

  // Three Image Sessions: Header, Body, Footer
  const [uploadTargetSection, setUploadTargetSection] = useState<'header' | 'body' | 'footer'>('body');
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const draggedImageIdRef = useRef<string | null>(null);
  const lastSwapTargetIdRef = useRef<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<'header' | 'body' | 'footer' | null>(null);

  const headerImages = useMemo(
    () => images.filter((img) => (img.section || 'body') === 'header'),
    [images]
  );
  const bodyImages = useMemo(
    () => images.filter((img) => (!img.section || img.section === 'body')),
    [images]
  );
  const footerImages = useMemo(
    () => images.filter((img) => img.section === 'footer'),
    [images]
  );

  const moveImageToSection = (imageId: string, targetSection: 'header' | 'body' | 'footer') => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === imageId);
      if (!target || target.section === targetSection) return prev;
      const withoutTarget = prev.filter((img) => img.id !== imageId);
      const updatedTarget = { ...target, section: targetSection };

      const headers = withoutTarget.filter((img) => (img.section || 'body') === 'header');
      const bodies = withoutTarget.filter((img) => (!img.section || img.section === 'body'));
      const footers = withoutTarget.filter((img) => img.section === 'footer');

      if (targetSection === 'header') headers.push(updatedTarget);
      else if (targetSection === 'body') bodies.push(updatedTarget);
      else footers.push(updatedTarget);

      const all = [...headers, ...bodies, ...footers];
      return all.map((img, idx) => ({ ...img, isCover: idx === 0 }));
    });
    showToast(`Moved image to ${targetSection.toUpperCase()}`);
  };

  const handleTriggerUpload = (section: 'header' | 'body' | 'footer') => {
    setUploadTargetSection(section);
    fileInputRef.current?.click();
  };

  const handleDeleteImageById = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      return filtered.map((img, i) => ({ ...img, isCover: i === 0 }));
    });
  };

  const handleMakeCoverById = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (!target) return prev;
      const rest = prev.filter((img) => img.id !== id);
      const headers = rest.filter((img) => (img.section || 'body') === 'header');
      const bodies = rest.filter((img) => (!img.section || img.section === 'body'));
      const footers = rest.filter((img) => img.section === 'footer');

      headers.unshift({ ...target, section: 'header', isCover: true });
      const all = [...headers, ...bodies, ...footers];
      return all.map((img, i) => ({ ...img, isCover: i === 0 }));
    });
    showToast(`⭐ Assigned as #1 Cover Photo!`);
  };

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
  const [fbPage1Enabled, setFbPage1Enabled] = useState(() => {
    const s = localStorage.getItem('autopost_fb_page_1_enabled') ?? localStorage.getItem('autopost_fb_page_1287202894475973_enabled');
    if (s !== null) return s === 'true';
    const pages = getStoredManagedPages();
    const p1 = pages.find((p) => p.slot === 1 || p.page_id === '1287202894475973');
    return p1?.auto_publish_enabled ?? true;
  });
  const [fbPage2Enabled, setFbPage2Enabled] = useState(() => {
    const s = localStorage.getItem('autopost_fb_page_2_enabled') ?? localStorage.getItem('autopost_fb_page_494870343703559_enabled');
    if (s !== null) return s === 'true';
    const pages = getStoredManagedPages();
    const p2 = pages.find((p) => p.slot === 2 || p.page_id === '494870343703559');
    return p2?.auto_publish_enabled ?? true;
  });
  const fbEnabled = fbPage1Enabled || fbPage2Enabled;
  const fbTargetMode: 'both' | 'page1' | 'page2' =
    fbPage1Enabled && fbPage2Enabled ? 'both' : fbPage2Enabled ? 'page2' : 'page1';
  const [fbPagesList, setFbPagesList] = useState<ConnectedAccount[]>(getStoredFbPages());
  const [fbPageId, setFbPageId] = useState('1287202894475973');
  const [managedPages, setManagedPages] = useState<ManagedPageMeta[]>(() => getStoredManagedPages());
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
  const [fbHeadline, setFbHeadline] = useState('High-Floor Modern Studio at Ideo Sukhumvit 93 for Rent!');
  const [fbCaption, setFbCaption] = useState(
    `ให้เช่าคอนโด Ideo Sukhumvit 93 ขนาด 28 ตร.ม. ชั้น 28 แต่งครบพร้อมอยู่!
ราคาเพียง 18,000 บาท/เดือน (สัญญา 1 ปี)
ติด BTS บางจาก เพียง 15 เมตร เดินทางสะดวกมาก วิวเมืองโล่งสวย
เฟอร์นิเจอร์และเครื่องใช้ไฟฟ้าครบครัน: แอร์, ทีวี, ตู้เย็น, ไมโครเวฟ, เครื่องซักผ้า, ดิจิตอลดอร์ล็อก หิ้วกระเป๋าเข้าอยู่ได้ทันที

สอบถาม/นัดชมห้องจริง Line ID: @estatebangkok | โทร 081-234-5678

#IdeoSukhumvit93 #CondoForRent #BTSBangChak #BangkokCondo #RealEstateBangkok`
  );
  const [fbCta, setFbCta] = useState('');
  const [fbHashtags, setFbHashtags] = useState('#IdeoSukhumvit93 #CondoForRent #BTSBangChak #BangkokCondo');
  const [fbImages, setFbImages] = useState<AutoPostImage[]>([]);
  const [fbScheduleType, setFbScheduleType] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [fbScheduledAt, setFbScheduledAt] = useState('');

  // Page 2 Dedicated Content (Slot 2: 61593000699921) - Fully Isolated, Never Mixed
  const [fbPage2Headline, setFbPage2Headline] = useState('Premium High-Floor City Living | Ideo Sukhumvit 93 Studio For Rent');
  const [fbPage2Caption, setFbPage2Caption] = useState(
    `คอนโดคุณภาพเยี่ยมติดบันได BTS บางจาก (15 เมตร)
ให้เช่า Ideo Sukhumvit 93 สตูดิโอขนาด 28 ตร.ม. ชั้น 28 แต่งสวยพร้อมเข้าอยู่ทันที
เพียง 18,000 บาท/เดือน (สัญญา 1 ปี / ประกัน 2 เดือน ล่วงหน้า 1 เดือน)

จุดเด่นห้อง:
• ชั้นสูง วิวพาโนรามา ไม่มีตึกบัง ลมพัดเย็นสบาย
• เครื่องใช้ไฟฟ้าและเฟอร์นิเจอร์ครบ (Smart TV, เครื่องซักผ้า, ตู้เย็น, ไมโครเวฟ)
• ส่วนกลางระดับโรงแรม สระว่ายน้ำ 2 สระ ฟิตเนส Co-working space

ติดต่อนัดชมห้องล่วงหน้า:
Line: @estatebangkok | โทร: 081-234-5678

#IdeoSukhumvit #BangkokCondoRental #BTSBangChak #BangkokProperty #CondoLiving`
  );
  const [fbPage2Hashtags, setFbPage2Hashtags] = useState('#IdeoSukhumvit #BangkokCondoRental #BTSBangChak #BangkokProperty');
  const [fbPage2Images, setFbPage2Images] = useState<AutoPostImage[]>([]);
  const [fbPage2ScheduleType, setFbPage2ScheduleType] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [fbPage2ScheduledAt, setFbPage2ScheduledAt] = useState('');
  const [fbPage1Html, setFbPage1Html] = useState(
    () =>
      `<b>High-Floor Modern Studio at Ideo Sukhumvit 93 for Rent!</b><br><br>ให้เช่าคอนโด Ideo Sukhumvit 93 ขนาด 28 ตร.ม. ชั้น 28 แต่งครบพร้อมอยู่!<br>ราคาเพียง 18,000 บาท/เดือน (สัญญา 1 ปี)<br>ติด BTS บางจาก เพียง 15 เมตร เดินทางสะดวกมาก วิวเมืองโล่งสวย<br>เฟอร์นิเจอร์และเครื่องใช้ไฟฟ้าครบครัน: แอร์, ทีวี, ตู้เย็น, ไมโครเวฟ, เครื่องซักผ้า, ดิจิตอลดอร์ล็อก หิ้วกระเป๋าเข้าอยู่ได้ทันที<br><br>สอบถาม/นัดชมห้องจริง Line ID: @estatebangkok | โทร 081-234-5678<br><br>#IdeoSukhumvit93 #CondoForRent #BTSBangChak #BangkokCondo #RealEstateBangkok`
  );
  const [fbPage2Html, setFbPage2Html] = useState(
    () =>
      `<b>Premium High-Floor City Living | Ideo Sukhumvit 93 Studio For Rent</b><br><br>คอนโดคุณภาพเยี่ยมติดบันได BTS บางจาก (15 เมตร)<br>ให้เช่า Ideo Sukhumvit 93 สตูดิโอขนาด 28 ตร.ม. ชั้น 28 แต่งสวยพร้อมเข้าอยู่ทันที<br>เพียง 18,000 บาท/เดือน (สัญญา 1 ปี / ประกัน 2 เดือน ล่วงหน้า 1 เดือน)<br><br>จุดเด่นห้อง:<br>• ชั้นสูง วิวพาโนรามา ไม่มีตึกบัง ลมพัดเย็นสบาย<br>• เครื่องใช้ไฟฟ้าและเฟอร์นิเจอร์ครบ (Smart TV, เครื่องซักผ้า, ตู้เย็น, ไมโครเวฟ)<br>• ส่วนกลางระดับโรงแรม สระว่ายน้ำ 2 สระ ฟิตเนส Co-working space<br><br>ติดต่อนัดชมห้องล่วงหน้า:<br>Line: @estatebangkok | โทร: 081-234-5678<br><br>#IdeoSukhumvit #BangkokCondoRental #BTSBangChak #BangkokProperty #CondoLiving`
  );

  // Two Main Workspace Sessions: 'content' | 'images'
  const [activeWorkspaceSession, setActiveWorkspaceSession] = useState<'content' | 'images'>('content');
  // Navbar Portals for clean header integration
  const [headerCenterEl, setHeaderCenterEl] = useState<HTMLElement | null>(null);
  const [headerActionEl, setHeaderActionEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderCenterEl(document.getElementById('header-center-portal'));
    setHeaderActionEl(document.getElementById('header-action-portal'));
  }, []);

  const [fbActiveSession, setFbActiveSession] = useState<'content' | 'images'>('content');
  const [fbPage1Session, setFbPage1Session] = useState<'content' | 'images'>('content');
  const [fbPage2Session, setFbPage2Session] = useState<'content' | 'images'>('content');
  const page1FileInputRef = useRef<HTMLInputElement>(null);
  const page2FileInputRef = useRef<HTMLInputElement>(null);

  const page1ImagesList = fbImages.length > 0 ? fbImages : images;
  const page2ImagesList = fbPage2Images.length > 0 ? fbPage2Images : images;

  const handleMakeCoverPage1 = (index: number) => {
    if (index === 0) return;
    const current = [...page1ImagesList];
    const [selected] = current.splice(index, 1);
    current.unshift(selected);
    setFbImages(current.map((img, i) => ({ ...img, isCover: i === 0 })));
  };

  const handleDeleteImagePage1 = (index: number) => {
    const current = [...page1ImagesList];
    const filtered = current.filter((_, i) => i !== index);
    setFbImages(filtered.map((img, i) => ({ ...img, isCover: i === 0 })));
  };

  const handleUploadPage1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newImgs: AutoPostImage[] = Array.from(files).map((file, idx) => ({
      id: `fb1-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      url: URL.createObjectURL(file),
      name: file.name,
      isCover: false,
    }));
    const merged = [...page1ImagesList, ...newImgs].map((img, i) => ({ ...img, isCover: i === 0 }));
    setFbImages(merged);
    if (page1FileInputRef.current) page1FileInputRef.current.value = '';
    showToast(`Added ${newImgs.length} photo${newImgs.length > 1 ? 's' : ''} to ${page1Name}`);
  };

  const handleResetImagesPage1 = () => {
    setFbImages([]);
    showToast(`Reset ${page1Name} photos to master property photos`);
  };

  const handleMakeCoverPage2 = (index: number) => {
    if (index === 0) return;
    const current = [...page2ImagesList];
    const [selected] = current.splice(index, 1);
    current.unshift(selected);
    setFbPage2Images(current.map((img, i) => ({ ...img, isCover: i === 0 })));
  };

  const handleDeleteImagePage2 = (index: number) => {
    const current = [...page2ImagesList];
    const filtered = current.filter((_, i) => i !== index);
    setFbPage2Images(filtered.map((img, i) => ({ ...img, isCover: i === 0 })));
  };

  const handleUploadPage2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newImgs: AutoPostImage[] = Array.from(files).map((file, idx) => ({
      id: `fb2-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      url: URL.createObjectURL(file),
      name: file.name,
      isCover: false,
    }));
    const merged = [...page2ImagesList, ...newImgs].map((img, i) => ({ ...img, isCover: i === 0 }));
    setFbPage2Images(merged);
    if (page2FileInputRef.current) page2FileInputRef.current.value = '';
    showToast(`Added ${newImgs.length} photo${newImgs.length > 1 ? 's' : ''} to ${page2Name}`);
  };

  const handleCopyImagesToPage2 = () => {
    setFbPage2Images([...page1ImagesList]);
    showToast(`Copied photos from ${page1Name} to ${page2Name}`);
  };

  const handleResetImagesPage2 = () => {
    setFbPage2Images([]);
    showToast(`Reset ${page2Name} photos to master property photos`);
  };

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
    `Elevated city living next to BTS Bang Chak

Ideo Sukhumvit 93 · 28 Sq.m. Studio on the 28th floor with uninterrupted skyline views. Fully furnished with premium appliances, walk-in layout, and turnkey readiness.

Location: Ideo Sukhumvit 93 (BTS Bang Chak 15m)
Rent: ฿18,000 / month
Condition: Fully Furnished | Ready to move in

DM or contact Line: @estatebangkok for private viewings`
  );
  const [igFirstCommentHashtags, setIgFirstCommentHashtags] = useState(
    '#BangkokCondo #BangkokRealEstate #CondoForRent #SukhumvitCondo #IdeoSukhumvit93 #BTSBangChak #BangkokLiving #InteriorInspo #LuxuryCondoBangkok'
  );
  const [igLocationTag, setIgLocationTag] = useState('Ideo Sukhumvit 93, Sukhumvit Road, Bangkok');

  // TikTok Box State
  const [ttAccountId, setTtAccountId] = useState('');
  const [tt1Hook, setTt1Hook] = useState('Is this the best condo value under 20k in Sukhumvit?');
  const [tt2Hook, setTt2Hook] = useState('Wait until you see the rooftop view on this Sukhumvit condo...');
  const [tt1Caption, setTt1Caption] = useState(
    `Only 15 meters from BTS Bang Chak! High floor 28 sqm studio with insane city skyline views for 18,000 THB/month. Would you live here? Comment below! #BangkokCondo #CondoTour #BKKLiving #IdeoSukhumvit93`
  );
  const [tt2Caption, setTt2Caption] = useState(
    `Bangkok luxury rental gem! 28 sqm studio with unblocked city views directly next to BTS Bang Chak. Monthly rent ฿18,000. Book viewings in bio! #BangkokRealEstate #CondoRental #BangkokLiving`
  );
  const [tt1Sound, setTt1Sound] = useState('Trending Luxury Real Estate Beat (Original Sound)');
  const [tt2Sound, setTt2Sound] = useState('Trending Luxury Real Estate Beat (Original Sound)');
  const [ttHooks, setTtHooks] = useState<Record<string, string>>({});
  const [ttCaptions, setTtCaptions] = useState<Record<string, string>>({});
  const [ttSounds, setTtSounds] = useState<Record<string, string>>({});
  const [selectedPreviewTikTokAccount, setSelectedPreviewTikTokAccount] = useState<ManagedTikTokAccount | null>(null);
  const [ttPrivacy] = useState<'public' | 'friends' | 'private'>('public');
  const [ttAllowComments] = useState(true);
  const [ttAllowDuet] = useState(true);
  const [ttPreviewAccountId, setTtPreviewAccountId] = useState<'tt-acc-1' | 'tt-acc-2'>('tt-acc-1');

  // Compatibility aliases
  const ttHook = tt1Hook;
  const setTtHook = setTt1Hook;
  const ttCaption = tt1Caption;
  const setTtCaption = setTt1Caption;
  const ttSound = tt1Sound;
  const setTtSound = setTt1Sound;

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

  // Compact Select styles specifically for top navbar
  const navSelectStyles = useMemo(
    () => ({
      ...selectStyles,
      control: (base: any) => ({
        ...base,
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
        borderColor: 'var(--border-color)',
        borderRadius: '7px',
        boxShadow: 'none',
        minHeight: '30px',
        height: '30px',
        fontSize: '0.75rem',
        cursor: 'pointer',
        padding: '0 2px',
        '&:hover': {
          borderColor: 'var(--accent-primary)',
        },
      }),
      valueContainer: (base: any) => ({
        ...base,
        height: '30px',
        padding: '0 6px',
      }),
      indicatorsContainer: (base: any) => ({
        ...base,
        height: '30px',
      }),
      dropdownIndicator: (base: any) => ({
        ...base,
        padding: '2px 6px',
      }),
    }),
    [selectStyles, isDark]
  );

  const [storedInstagramAccounts, setStoredInstagramAccounts] = useState<ManagedInstagramAccount[]>(() => getStoredInstagramAccounts());
  useEffect(() => {
    return subscribeInstagramAccounts((accounts) => {
      setStoredInstagramAccounts(accounts);
    });
  }, []);

  const hasInstagramAccount = storedInstagramAccounts.length > 0;
  const isEffectiveIgEnabled = hasInstagramAccount && igEnabled;

  const igAccountOptions = useMemo(() => {
    if (storedInstagramAccounts.length > 0) {
      return storedInstagramAccounts.map((acc) => ({
        value: acc.id,
        label: `${acc.handle} (${acc.name || 'Instagram'})`,
        handle: acc.handle,
        followers: acc.followers || '',
      }));
    }
    return CONNECTED_IG_ACCOUNTS.map((acc) => ({
      value: acc.id,
      label: `${acc.handle} (${acc.followers})`,
      handle: acc.handle,
      followers: acc.followers,
    }));
  }, [storedInstagramAccounts]);

  const [storedTikTokAccounts, setStoredTikTokAccounts] = useState<ManagedTikTokAccount[]>(() => getStoredTikTokAccounts());
  useEffect(() => {
    fetchTikTokAccounts().then((dbAccounts) => {
      if (dbAccounts && Array.isArray(dbAccounts) && dbAccounts.length > 0) {
        const mapped: ManagedTikTokAccount[] = dbAccounts.map((a) => ({
          id: String(a.id),
          name: a.display_name || a.username,
          handle: a.username.startsWith('@') ? a.username : `@${a.username}`,
          followers: a.follower_count ? `${a.follower_count.toLocaleString()} Followers` : 'Verified Creator',
          avatarUrl: a.avatar_url,
          has_token: a.token_status === 'VALID' || Boolean(a.token_hint),
          token_hint: a.token_hint || '••••',
          token_status: a.token_status === 'VALID' ? 'VALID' : 'UNTESTED',
          permissions: a.permissions ? JSON.parse(a.permissions) : ['user.info.basic', 'video.publish', 'video.upload'],
          can_publish_photo_mode: a.can_publish_photo_mode,
          can_upload_video: a.can_upload_video,
          test_passed: a.test_passed,
          auto_publish_enabled: a.auto_publish_enabled,
          last_tested_at: a.last_tested_at ? new Date(a.last_tested_at).toLocaleTimeString() : undefined,
          environment: (a.environment as any) || 'sandbox',
        }));
        setStoredTikTokAccounts(mapped);
        if (!ttAccountId && mapped.length > 0) {
          setTtAccountId(mapped[0].id);
        }
      }
    }).catch(() => {});

    return subscribeTikTokAccounts((accounts) => {
      setStoredTikTokAccounts(accounts);
      if (!ttAccountId && accounts.length > 0) {
        setTtAccountId(accounts[0].id);
      }
    });
  }, [ttAccountId]);

  const activeTikTokAccounts = useMemo(() => {
    return storedTikTokAccounts.filter((acc) => acc.auto_publish_enabled !== false);
  }, [storedTikTokAccounts]);

  const [ttEnabledOverride, setTtEnabledOverride] = useState<boolean | null>(null);
  const tt1Enabled = activeTikTokAccounts.length > 0;
  const tt2Enabled = activeTikTokAccounts.length > 1;
  const ttEnabled = ttEnabledOverride !== null ? ttEnabledOverride : (activeTikTokAccounts.length > 0 || true);
  const setTt1Enabled = (_val: boolean) => {};
  const setTt2Enabled = (_val: boolean) => {};
  const setTtEnabled = (val: boolean) => setTtEnabledOverride(val);

  const tiktokAccount1 = activeTikTokAccounts[0] || storedTikTokAccounts[0] || null;
  const tiktokAccount2 = activeTikTokAccounts[1] || storedTikTokAccounts[1] || null;

  const ttAccountOptions = useMemo(() => activeTikTokAccounts.map((acc) => ({
    value: acc.id,
    label: `${acc.handle} (${acc.name})`,
    handle: acc.handle,
    followers: acc.followers,
  })), [activeTikTokAccounts]);

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
  const [previewTtSlideIdx, setPreviewTtSlideIdx] = useState<number>(0);
  const [previewFbTab, setPreviewFbTab] = useState<'page1' | 'page2'>('page1');
  const [selectedFbPageTab, setSelectedFbPageTab] = useState<'page1' | 'page2'>('page1');

  const activeFbHeadline =
    fbTargetMode === 'page2' || (fbTargetMode === 'both' && selectedFbPageTab === 'page2')
      ? fbPage2Headline
      : fbHeadline;

  const setActiveFbHeadline = (val: string) => {
    if (fbTargetMode === 'page2' || (fbTargetMode === 'both' && selectedFbPageTab === 'page2')) {
      setFbPage2Headline(val);
    } else {
      setFbHeadline(val);
    }
  };

  const activeFbCaption =
    fbTargetMode === 'page2' || (fbTargetMode === 'both' && selectedFbPageTab === 'page2')
      ? fbPage2Caption
      : fbCaption;

  const setActiveFbCaption = (val: string) => {
    if (fbTargetMode === 'page2' || (fbTargetMode === 'both' && selectedFbPageTab === 'page2')) {
      setFbPage2Caption(val);
    } else {
      setFbCaption(val);
    }
  };

  const activeFbHashtags =
    fbTargetMode === 'page2' || (fbTargetMode === 'both' && selectedFbPageTab === 'page2')
      ? fbPage2Hashtags
      : fbHashtags;

  const setActiveFbHashtags = (val: string) => {
    if (fbTargetMode === 'page2' || (fbTargetMode === 'both' && selectedFbPageTab === 'page2')) {
      setFbPage2Hashtags(val);
    } else {
      setFbHashtags(val);
    }
  };

  const activeFbName =
    fbTargetMode === 'page2' || (fbTargetMode === 'both' && selectedFbPageTab === 'page2')
      ? page2Name
      : page1Name;

  const activeFbPicture =
    fbTargetMode === 'page2' || (fbTargetMode === 'both' && selectedFbPageTab === 'page2')
      ? (page2Picture || CONNECTED_FB_PAGES[1]?.avatarUrl)
      : (page1Picture || CONNECTED_FB_PAGES[0]?.avatarUrl);

  const fbPageSelectOptions = useMemo(() => [
    {
      value: 'both',
      label: 'Both Pages (Simultaneous)',
      detail: 'Slot 1 & Slot 2',
      picture: page1Picture || CONNECTED_FB_PAGES[0]?.avatarUrl,
    },
    {
      value: 'page1',
      label: page1Name || 'Dot BKK Living',
      detail: `Slot 1 • ${page1PageId}`,
      picture: page1Picture || CONNECTED_FB_PAGES[0]?.avatarUrl,
    },
    {
      value: 'page2',
      label: page2Name || 'Bolt Haven Realty',
      detail: `Slot 2 • ${page2PageId}`,
      picture: page2Picture || CONNECTED_FB_PAGES[1]?.avatarUrl,
    },
  ], [page1Name, page2Name, page1PageId, page2PageId, page1Picture, page2Picture]);

  const channelOptions = useMemo(() => {
    const list: {
      value: 'all' | 'facebook' | 'instagram' | 'tiktok';
      label: string;
      icon: React.ReactNode;
      enabled: boolean;
    }[] = [
      {
        value: 'all',
        label: 'All Channels',
        icon: <FiSliders style={{ fontSize: '0.8125rem' }} />,
        enabled: true,
      },
      {
        value: 'facebook',
        label: 'Facebook',
        icon: <FaFacebook style={{ color: '#1877F2', fontSize: '0.875rem' }} />,
        enabled: fbEnabled,
      },
    ];

    if (hasInstagramAccount) {
      list.push({
        value: 'instagram',
        label: 'Instagram',
        icon: <FaInstagram style={{ color: '#E4405F', fontSize: '0.875rem' }} />,
        enabled: isEffectiveIgEnabled,
      });
    }

    list.push({
      value: 'tiktok',
      label: 'TikTok',
      icon: <FaTiktok style={{ color: isDark ? '#00F2FE' : '#000000', fontSize: '0.8125rem' }} />,
      enabled: ttEnabled,
    });

    return list;
  }, [fbEnabled, hasInstagramAccount, isEffectiveIgEnabled, ttEnabled, isDark]);
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);

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

    showToast(`Added ${newImages.length} image${newImages.length > 1 ? 's' : ''}!`);
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
      showToast(`Uploaded ${newImages.length} images!`);
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

  // Instant, butter-smooth drag & drop reordering where photos slide immediately without delay
  const handleDragStartItem = (e: React.DragEvent, imgId: string) => {
    isDraggingRef.current = true;
    draggedImageIdRef.current = imgId;
    lastSwapTargetIdRef.current = null;
    lastSwapTimeRef.current = Date.now();
    setDraggedImageId(imgId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', imgId);
    }
  };

  const handleSwapToCard = (targetImgId: string, targetSection: 'header' | 'body' | 'footer') => {
    const currentDraggedId = draggedImageIdRef.current;
    if (!currentDraggedId || currentDraggedId === targetImgId) return;
    if (lastSwapTargetIdRef.current === targetImgId) return;

    const now = Date.now();
    // Ultra-low 40ms safety guard: instant responsiveness, prevents jitter loop on exact same spot
    if (now - lastSwapTimeRef.current < 40) return;
    lastSwapTimeRef.current = now;
    lastSwapTargetIdRef.current = targetImgId;

    setImages((prev) => {
      const fromIndex = prev.findIndex((img) => img.id === currentDraggedId);
      const toIndex = prev.findIndex((img) => img.id === targetImgId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;

      const copy = [...prev];
      const [dragged] = copy.splice(fromIndex, 1);
      dragged.section = targetSection;
      copy.splice(toIndex, 0, dragged);

      const hasHeader = copy.some((img) => (img.section || 'body') === 'header');
      return copy.map((img, idx) => ({
        ...img,
        isCover: hasHeader
          ? (img.section === 'header' && copy.filter((x) => (x.section || 'body') === 'header')[0]?.id === img.id)
          : idx === 0,
      }));
    });
  };

  const handleDragEndItem = () => {
    draggedImageIdRef.current = null;
    lastSwapTargetIdRef.current = null;
    setDraggedImageId(null);
    setDragOverSection(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  // Professional smooth drag & drop reordering where other photos slide fluidly into place (legacy index-based)
  const handleDragStart = (e: any, index: number) => {
    isDraggingRef.current = true;
    lastSwapTimeRef.current = Date.now();
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      if (e.currentTarget) {
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        e.dataTransfer.setDragImage(target, rect.width / 2, rect.height / 2);
      }
    }
    requestAnimationFrame(() => {
      setDraggedImageIndex(index);
    });
  };

  const handleDragEnter = (targetIndex: number) => {
    if (draggedImageIndex === null || draggedImageIndex === targetIndex) return;
    const now = Date.now();
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
    const idx = images.findIndex((img) => img.url === url);
    setLightboxIndex(idx !== -1 ? idx : 0);
    setLightboxZoom(1);
    setLightboxUrl(url);
  };

  const handleNextLightbox = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (lightboxIndex === null || images.length === 0) return;
    const nextIdx = (lightboxIndex + 1) % images.length;
    setLightboxIndex(nextIdx);
    setLightboxUrl(images[nextIdx].url);
    setLightboxZoom(1);
  };

  const handlePrevLightbox = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (lightboxIndex === null || images.length === 0) return;
    const prevIdx = (lightboxIndex - 1 + images.length) % images.length;
    setLightboxIndex(prevIdx);
    setLightboxUrl(images[prevIdx].url);
    setLightboxZoom(1);
  };

  const handleCloseLightbox = () => {
    setLightboxUrl(null);
    setLightboxIndex(null);
    setLightboxZoom(1);
  };

  const handleDownloadLightboxImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentImg = lightboxIndex !== null ? images[lightboxIndex] : null;
    const url = currentImg?.url || lightboxUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = currentImg?.name || `photo-${(lightboxIndex ?? 0) + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Keyboard navigation for image lightbox (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseLightbox();
      } else if (e.key === 'ArrowRight') {
        handleNextLightbox();
      } else if (e.key === 'ArrowLeft') {
        handlePrevLightbox();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, images]);

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
      setFbHeadline(`${post.projectName} - Ready for ${post.propertyData?.listing_type || 'Rent'}`);
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
    showToast(`Loaded "${post.projectName}" with ${loadedImages.length} images!`);
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

  useEffect(() => {
    const syncEnabledFromPages = (pages: ManagedPageMeta[]) => {
      const p1 = pages.find((p) => p.slot === 1 || p.page_id === '1287202894475973');
      if (p1 && p1.auto_publish_enabled !== undefined) {
        setFbPage1Enabled(p1.auto_publish_enabled);
      } else {
        const s1 = localStorage.getItem('autopost_fb_page_1_enabled');
        if (s1 !== null) setFbPage1Enabled(s1 === 'true');
      }

      const p2 = pages.find((p) => p.slot === 2 || p.page_id === '494870343703559');
      if (p2 && p2.auto_publish_enabled !== undefined) {
        setFbPage2Enabled(p2.auto_publish_enabled);
      } else {
        const s2 = localStorage.getItem('autopost_fb_page_2_enabled');
        if (s2 !== null) setFbPage2Enabled(s2 === 'true');
      }
    };

    const unsub = subscribeManagedPages((pages) => {
      setManagedPages(pages);
      setFbPagesList(getStoredFbPages());
      syncEnabledFromPages(pages);
    });

    const handleStorage = () => {
      const s1 = localStorage.getItem('autopost_fb_page_1_enabled');
      if (s1 !== null) setFbPage1Enabled(s1 === 'true');
      const s2 = localStorage.getItem('autopost_fb_page_2_enabled');
      if (s2 !== null) setFbPage2Enabled(s2 === 'true');
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsub();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const fetchManagedPages = async () => {
    try {
      const res = await fetch(apiUrl('/api/facebook/pages'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.pages)) {
          setManagedPages(data.pages);
          const synced = syncStoredFbPagesWithMeta(data.pages);
          setFbPagesList(synced);

          const s1 = localStorage.getItem('autopost_fb_page_1_enabled');
          const p1 = data.pages.find((p: any) => p.slot === 1 || p.page_id === '1287202894475973');
          if (s1 !== null) {
            setFbPage1Enabled(s1 === 'true');
          } else if (p1 && p1.auto_publish_enabled !== undefined) {
            setFbPage1Enabled(p1.auto_publish_enabled);
          }

          const s2 = localStorage.getItem('autopost_fb_page_2_enabled');
          const p2 = data.pages.find((p: any) => p.slot === 2 || p.page_id === '494870343703559');
          if (s2 !== null) {
            setFbPage2Enabled(s2 === 'true');
          } else if (p2 && p2.auto_publish_enabled !== undefined) {
            setFbPage2Enabled(p2.auto_publish_enabled);
          }
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
        showToast(`Refreshed Facebook Page info for "${targetPage.name || pageId}" from Meta Graph API!`);
        fetchManagedPages();
      } else {
        const errMsg = data.message || 'Could not refresh Page information';
        showToast(errMsg);
        fetchManagedPages();
      }
    } catch (e: any) {
      showToast('Network error refreshing Facebook Page info');
    } finally {
      setRefreshingPageId(null);
    }
  };

  const handleCopyPage1ToPage2 = () => {
    setFbPage2Headline(fbHeadline);
    setFbPage2Caption(fbCaption);
    setFbPage2Hashtags(fbHashtags);
    setFbPage2Images([...(fbImages.length > 0 ? fbImages : images)]);
    showToast('Copied Page 1 content into Page 2. Tweak and customize freely.');
  };

  const handleDifferentiatePage2 = () => {
    setFbPage2Headline(
      fbHeadline.includes('[Page 2 Exclusive]')
        ? fbHeadline
        : `[Page 2 Exclusive] ${fbHeadline}`
    );
    setFbPage2Caption(
      `[Special Community Listing for Page 2]\n\n${fbCaption}`
    );
    showToast('Differentiated copy generated for Page 2!');
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
        showToast('Facebook Account connected! Loading discovered pages...');
        fetchManagedPages();
        fetchMetaConnectionStatus();
        setIsPageSelectionModalOpen(true);
      }
    };
    window.addEventListener('message', handleOAuthMessage);

    // Detect redirect with ?fb_connected=true
    const params = new URLSearchParams(window.location.search);
    if (params.get('fb_connected') === 'true') {
      showToast('Facebook Account connected! Select your pages to continue.');
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
      showToast('Failed to start Facebook authorization');
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
          showToast(`Page (${pageId}) Test PASSED: Access verified with CREATE_CONTENT.`);
        } else {
          showToast(`Page (${pageId}) Test: ${data.test_result.message || 'Verification failed'}`);
        }
        await fetchManagedPages();
      } else {
        showToast(`Connection test failed: ${data.message || 'Unknown error'}`);
      }
    } catch (e) {
      showToast('Network error running connection test');
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
        showToast('Facebook Page connection & permissions verified!');
      } else {
        const err = data.error_message || (data.status === 'EXPIRED' ? 'Token expired or revoked.' : 'Page lacks CREATE_CONTENT permission or token invalid.');
        setTestResult({
          tested: true,
          passed: false,
          message: err,
          permissions: data.permissions || [],
        });
        showToast(`Connection test: ${data.status || 'Failed'}`);
      }
      setMetaStatus(data);
    } catch (err: any) {
      setTestResult({
        tested: true,
        passed: false,
        message: 'Network error connecting to backend API.',
      });
      showToast('Failed to test connection');
    } finally {
      setIsTestingMetaConn(false);
    }
  };

  const handleSavePageAccessToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenInput.trim()) {
      showToast('Please enter a Page Access Token');
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
        showToast('Page Access Token updated and validated successfully!');
        setIsTokenModalOpen(false);
        setNewTokenInput('');
        await fetchMetaConnectionStatus();
      } else {
        showToast(`Error: ${data.message || 'Failed to update token'}`);
      }
    } catch (err: any) {
      showToast('Network error updating token');
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleConnectCustomMetaPage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaPageName.trim()) {
      showToast('Please enter a Facebook Page Name');
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
    showToast(`Successfully linked "${newAccount.name}" with Facebook Meta!`);
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
    setFbHeadline(`${cleanProject} - ${listingType === 'SALE' ? 'คอนโดหรูเพื่อการลงทุน / ขาย' : 'ห้องสวยแต่งครบพร้อมเข้าอยู่'}`);
    setFbCaption(
      `โครงการ: ${cleanProject}\n` +
      `จุดเด่น: ${cleanSpecs}\n` +
      `ราคา: ${cleanPrice}\n\n` +
      `ห้องตกแต่งครบสไตล์ Modern Luxury เฟอร์นิเจอร์บิวท์อิน เครื่องใช้ไฟฟ้าพรีเมียมครบครัน ส่วนกลางระดับ 5 ดาว สระว่ายน้ำลอยฟ้า ฟิตเนสครบวงจร ทำเลดีเยี่ยมใกล้ระบบขนส่งสาธารณะ เดินทางสะดวกสบายมากครับ\n\n` +
      `• สัญญาเช่าขั้นต่ำ 1 ปี (ประกัน 2 เดือน, ล่วงหน้า 1 เดือน)\n` +
      `• มีบริการดูแลตลอดสัญญาเช่า\n\n` +
      `สนใจนัดชมห้องจริงได้ทุกวัน Line ID: @estatebangkok | โทร 081-234-5678\n\n` +
      `#${cleanProject.replace(/\s+/g, '')} #BangkokRealEstate #CondoFor${listingType === 'SALE' ? 'Sale' : 'Rent'} #BTS #คอนโดติดรถไฟฟ้า`
    );
    setFbCta('');
    setFbHashtags('');

    // 2. Instagram: Minimalist, Aesthetic spacing, DM cta
    setIgCaption(
      `Serene luxury redefined at ${cleanProject}\n\n` +
      `Experience refined Bangkok living in this meticulously styled unit featuring ${cleanSpecs}.\n\n` +
      `Project: ${cleanProject}\n` +
      `Price: ${cleanPrice}\n` +
      `Condition: Turnkey Ready | Modern Furnishings\n\n` +
      `Tap link in bio or send a direct message for a personalized tour walkthrough.`
    );
    setIgFirstCommentHashtags(
      `#${cleanProject.replace(/\s+/g, '')} #BangkokCondo #LuxuryInteriors #BangkokLiving #PropertyInvestment #ThailandRealEstate #CondoLifeBangkok`
    );
    setIgLocationTag(`${cleanProject}, Bangkok, Thailand`);

    // 3. TikTok: Catchy hook in first 3 seconds, Photo Mode Carousel script for both accounts
    setTt1Hook(`Is this Bangkok's prettiest condo under ${cleanPrice}?`);
    setTt1Caption(
      `Would you live in this unit at ${cleanProject}? High floor, city view, and only steps from the station! Swipe through the photos and let us know what you think in the comments. #${cleanProject.replace(/\s+/g, '')} #BangkokCondo #RealEstateTikTok #RoomTour`
    );
    setTt2Hook(`Wait until you see this ${cleanProject} studio tour...`);
    setTt2Caption(
      `Luxury condo living next to BTS! Studio unit at ${cleanProject} with stunning skyline view for ${cleanPrice}. Book private viewings now! #${cleanProject.replace(/\s+/g, '')} #BangkokRealEstate #CondoRental`
    );

    showToast(hasInstagramAccount ? 'AI generated tailored content for Facebook, Instagram, and TikTok!' : 'AI generated tailored content for Facebook and TikTok!');
  };

  // ----------------------------------------------------
  // Publishing Workflow Execution
  // ----------------------------------------------------
  const selectedChannelsCount = (fbPage1Enabled ? 1 : 0) + (fbPage2Enabled ? 1 : 0) + (isEffectiveIgEnabled ? 1 : 0) + activeTikTokAccounts.length;

  const handleStartPublish = () => {
    if (selectedChannelsCount === 0) {
      alert(hasInstagramAccount ? 'Please enable at least one social media channel (Facebook, Instagram, or TikTok).' : 'Please enable at least one social media channel (Facebook or TikTok).');
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
        enabled: isEffectiveIgEnabled,
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
          status: isEffectiveIgEnabled ? 'scheduled' : 'skipped',
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
        text: isEffectiveIgEnabled
          ? 'Uploading Instagram Carousel with 1st-comment hashtags...'
          : 'Skipping Instagram...',
        completed: false,
      });
      await new Promise((r) => setTimeout(r, 500));

      // Step 4: TikTok Content Posting API
      let ttResult: PlatformPublishResult = {
        status: 'skipped',
        timestamp: Date.now(),
      };

      if (ttEnabled) {
        setPublishProgress({
          step: 4,
          total: 4,
          text: 'Submitting Photo Mode Carousel to TikTok Content Posting API...',
          completed: false,
        });

        try {
          const targetAcc = activeTikTokAccounts[0];
          const numAccId = targetAcc ? (parseInt(targetAcc.id.replace('tt-acc-', ''), 10) || 1) : 1;
          const photoUrls = (fbImages.length > 0 ? fbImages : images).map((img) => img.url);
          const thisHook = targetAcc ? (ttHooks[targetAcc.id] ?? tt1Hook) : tt1Hook;
          const thisCaption = targetAcc ? (ttCaptions[targetAcc.id] ?? tt1Caption) : tt1Caption;

          const published = await publishTikTokPhotoPost({
            account_id: numAccId,
            title: `${thisHook ? thisHook + '\n\n' : ''}${thisCaption}`,
            photo_images: photoUrls,
            photo_cover_index: 1,
            privacy_level: ttPrivacy === 'private' ? 'SELF_ONLY' : (ttPrivacy === 'friends' ? 'MUTUAL_FOLLOW_FRIENDS' : 'PUBLIC_TO_EVERYONE'),
            disable_comment: !ttAllowComments,
            auto_add_music: true,
          });

          setPublishProgress({
            step: 4,
            total: 4,
            text: `TikTok initialized [ID: ${published.publish_id.slice(0, 16)}...]. Fetching TikTok server status...`,
            completed: false,
          });

          await new Promise((r) => setTimeout(r, 1200));
          const checked = await pollTikTokPublishStatus(published.publish_id);

          ttResult = {
            status: checked.status === 'SUCCESS' ? 'success' : (checked.status === 'FAILED' ? 'failed' : 'processing') as any,
            postId: checked.tiktok_post_id || checked.publish_id,
            postUrl: checked.share_url || (checked.publish_id ? `https://tiktok.com/publish/${checked.publish_id}` : undefined),
            timestamp: Date.now(),
          };
        } catch (err: any) {
          console.error('TikTok publish error:', err);
          ttResult = {
            status: 'failed',
            error: err.message || 'TikTok API error',
            timestamp: Date.now(),
          };
        }
      }

      const isOverallSuccess = (!fbEnabled || fbResult.status === 'success') && (!ttEnabled || ttResult.status !== 'failed');

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
          enabled: isEffectiveIgEnabled,
          accountId: igAccountId,
          accountName: CONNECTED_IG_ACCOUNTS.find((a) => a.id === igAccountId)?.handle || '@instagram',
          caption: igCaption,
          firstCommentHashtags: igFirstCommentHashtags,
          locationTag: igLocationTag,
        },
        tiktok: {
          enabled: ttEnabled,
          accountId: ttAccountId,
          accountName: storedTikTokAccounts.find((a) => a.id === ttAccountId)?.handle || '@tiktok',
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
            status: isEffectiveIgEnabled ? 'success' : 'skipped',
            postId: isEffectiveIgEnabled ? `ig_${randomSeed}` : undefined,
            postUrl: isEffectiveIgEnabled ? `https://instagram.com/p/${randomSeed}` : undefined,
            timestamp: Date.now(),
          },
          tiktok: ttResult,
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


      {/* Hidden File Input for Master Property Photos */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* Top Navbar Portals: Session Switcher & Platform Channel */}
      {headerCenterEl &&
        createPortal(
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
              borderRadius: '24px',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
              position: 'relative',
              userSelect: 'none',
              boxShadow: 'none',
            }}
          >
            {/* Content Button */}
            <button
              type="button"
              onClick={() => setActiveWorkspaceSession('content')}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 14px',
                fontSize: '0.8125rem',
                fontWeight: activeWorkspaceSession === 'content' ? 600 : 500,
                color: activeWorkspaceSession === 'content' ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                zIndex: 1,
                transition: 'color 0.15s ease',
                outline: 'none',
                height: '28px',
              }}
            >
              {activeWorkspaceSession === 'content' && (
                <motion.div
                  layoutId="navbarSessionPill"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    borderRadius: '20px',
                    boxShadow: isDark
                      ? '0 1px 4px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)'
                      : '0 1px 4px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
                    zIndex: -1,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <FiEdit3 style={{ fontSize: '0.8125rem' }} />
              <span>Content</span>
            </button>

            {/* Images Button */}
            <button
              type="button"
              onClick={() => setActiveWorkspaceSession('images')}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px 5px 14px',
                fontSize: '0.8125rem',
                fontWeight: activeWorkspaceSession === 'images' ? 600 : 500,
                color: activeWorkspaceSession === 'images' ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                zIndex: 1,
                transition: 'color 0.15s ease',
                outline: 'none',
                height: '28px',
              }}
            >
              {activeWorkspaceSession === 'images' && (
                <motion.div
                  layoutId="navbarSessionPill"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    borderRadius: '20px',
                    boxShadow: isDark
                      ? '0 1px 4px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)'
                      : '0 1px 4px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
                    zIndex: -1,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <FiImage style={{ fontSize: '0.8125rem' }} />
              <span>Images</span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: '10px',
                  backgroundColor: activeWorkspaceSession === 'images'
                    ? 'var(--accent-primary)'
                    : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.07)'),
                  color: activeWorkspaceSession === 'images' ? '#FFFFFF' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  marginLeft: '2px',
                }}
              >
                {images.length}
              </span>
            </button>
          </div>,
          headerCenterEl
        )}

      {headerActionEl &&
        createPortal(
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '155px' }}>
              <Select
                value={channelOptions.find((opt) => opt.value === activePlatformTab) || channelOptions[0]}
                onChange={(option: any) => {
                  if (option) setActivePlatformTab(option.value);
                }}
                options={channelOptions}
                styles={navSelectStyles}
                isSearchable={false}
                formatOptionLabel={(option: any) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      {option.icon}
                      <span style={{ fontWeight: 600, fontSize: '0.75rem' }}>{option.label}</span>
                    </div>
                    {option.enabled && option.value !== 'all' && (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
                    )}
                  </div>
                )}
              />
            </div>
          </div>,
          headerActionEl
        )}

      {/* ======================================================== */}
      {/* SESSION 1: IMAGES (Compact Multi-Section Studio)         */}
      {/* ======================================================== */}
      {activeWorkspaceSession === 'images' ? (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'none',
            marginBottom: '2rem',
          }}
        >
          <style>{`
            .photo-card-item .photo-card-hover-only {
              opacity: 0;
              pointer-events: none;
              transform: translateY(2px);
              transition: opacity 0.15s ease, transform 0.15s ease;
            }
            .photo-card-item:hover .photo-card-hover-only,
            .photo-card-item:focus-within .photo-card-hover-only {
              opacity: 1 !important;
              pointer-events: auto !important;
              transform: translateY(0) !important;
            }
          `}</style>

          {/* Top Bar Studio Control */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Photo Architecture Studio
                </h2>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    backgroundColor: images.length > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: images.length > 0 ? '#22C55E' : '#EF4444',
                    border: `1px solid ${images.length > 0 ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                  }}
                >
                  {images.length} Photos Total
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                onClick={handleOpenRemainingPostsModal}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  boxShadow: 'none',
                }}
                title="Import photos and details from Remaining Posts"
              >
                <FiLayers style={{ color: 'var(--accent-primary)', fontSize: '0.8125rem' }} />
                <span>From Remaining</span>
              </Button>

              <button
                type="button"
                onClick={() => handleTriggerUpload('body')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '30px',
                  padding: '0 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FiUploadCloud style={{ fontSize: '0.8125rem' }} />
                <span>Upload Photos</span>
              </button>

              <Button
                variant="primary"
                onClick={() => setActiveWorkspaceSession('content')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '30px',
                  padding: '0 14px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  boxShadow: 'none',
                }}
              >
                <span>Continue to Content</span>
                <FiArrowRight style={{ fontSize: '0.75rem' }} />
              </Button>
            </div>
          </div>

          {/* Render 3 Compact Horizontal Lanes: Header, Body, Footer */}
          {[
            {
              key: 'header' as const,
              title: 'Header Images',
              subtitle: 'Cover hero & banner · Shown 1st in album and social feeds',
              icon: <FiStar style={{ color: '#F59E0B', fontSize: '0.9rem' }} />,
              badgeColor: '#F59E0B',
              badgeBg: 'rgba(245, 158, 11, 0.12)',
              badgeBorder: 'rgba(245, 158, 11, 0.25)',
              list: headerImages,
              emptyPrompt: 'No hero photo yet. Drop photo here or click to add cover.',
            },
            {
              key: 'body' as const,
              title: 'Body Images',
              subtitle: 'Property gallery · Interior rooms, bedroom, living area, kitchen & amenities',
              icon: <FiGrid style={{ color: '#3B82F6', fontSize: '0.9rem' }} />,
              badgeColor: '#3B82F6',
              badgeBg: 'rgba(59, 130, 246, 0.12)',
              badgeBorder: 'rgba(59, 130, 246, 0.25)',
              list: bodyImages,
              emptyPrompt: 'No gallery photos yet. Drop showcase photos here or click upload.',
            },
            {
              key: 'footer' as const,
              title: 'Footer Images',
              subtitle: 'Contact & branding cards · LINE QR code, agent card & ending slide',
              icon: <FiPhoneCall style={{ color: '#10B981', fontSize: '0.9rem' }} />,
              badgeColor: '#10B981',
              badgeBg: 'rgba(16, 185, 129, 0.12)',
              badgeBorder: 'rgba(16, 185, 129, 0.25)',
              list: footerImages,
              emptyPrompt: 'No contact card yet. Drop QR code or closing card here.',
            },
          ].map((sec) => {
            const isTargetHovered = dragOverSection === sec.key;

            return (
              <div
                key={sec.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverSection !== sec.key) setDragOverSection(sec.key);
                }}
                onDragLeave={() => {
                  if (dragOverSection === sec.key) setDragOverSection(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverSection(null);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
                    if (files.length > 0) {
                      const newImgs: AutoPostImage[] = files.map((file, idx) => ({
                        id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
                        url: URL.createObjectURL(file),
                        name: file.name,
                        isCover: false,
                        section: sec.key,
                      }));
                      setImages((prev) => {
                        const merged = [...prev, ...newImgs];
                        return merged.map((img, i) => ({ ...img, isCover: i === 0 }));
                      });
                      showToast(`Added ${newImgs.length} photo(s) to ${sec.title}`);
                    }
                    return;
                  }
                  const draggedId = e.dataTransfer.getData('text/plain') || draggedImageId;
                  if (draggedId) {
                    moveImageToSection(draggedId, sec.key);
                    setDraggedImageId(null);
                  }
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  backgroundColor: isTargetHovered ? 'var(--bg-main)' : 'rgba(0, 0, 0, 0.02)',
                  border: isTargetHovered
                    ? `1.5px dashed ${sec.badgeColor}`
                    : '1px solid rgba(156, 163, 175, 0.15)',
                  transition: 'border 0.15s ease, background-color 0.15s ease',
                }}
              >
                {/* Lane Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: sec.badgeBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {sec.icon}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sec.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '10px',
                          backgroundColor: sec.badgeBg,
                          color: sec.badgeColor,
                          border: `1px solid ${sec.badgeBorder}`,
                        }}
                      >
                        {sec.list.length} Photo{sec.list.length !== 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'inline-block' }}>
                        · {sec.subtitle}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Photos Row / Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
                    gap: '10px',
                    alignItems: 'start',
                  }}
                >
                  {sec.list.map((img) => {
                    const globalIdx = images.findIndex((x) => x.id === img.id);
                    const isCover = img.isCover || (sec.key === 'header' && sec.list[0]?.id === img.id);
                    const isDragged = draggedImageId === img.id;

                    return (
                      <motion.div
                        layout
                        key={img.id}
                        className="photo-card-item"
                        draggable
                        onDragStart={(e) => handleDragStartItem(e as any, img.id)}
                        onDragEnter={() => handleSwapToCard(img.id, sec.key)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          handleSwapToCard(img.id, sec.key);
                        }}
                        onDragEnd={handleDragEndItem}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 32,
                          mass: 0.5,
                        }}
                        onClick={() => handlePhotoClick(img.url)}
                        style={{
                          position: 'relative',
                          height: '110px',
                          borderRadius: '9px',
                          overflow: 'hidden',
                          backgroundColor: '#000000',
                          border: isDragged
                            ? '2px dashed var(--accent-primary)'
                            : isCover
                            ? '2px solid #F59E0B'
                            : '1px solid var(--border-color)',
                          boxShadow: isCover ? '0 2px 8px rgba(245, 158, 11, 0.25)' : 'none',
                          opacity: isDragged ? 0.35 : 1,
                          transform: isDragged ? 'scale(0.96)' : 'scale(1)',
                          cursor: 'grab',
                          userSelect: 'none',
                        }}
                      >
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
                          }}
                        />

                        {/* Top-Left Star/Order Badge (Only number, no #) */}
                        {isCover ? (
                          <div
                            style={{
                              position: 'absolute',
                              top: '5px',
                              left: '5px',
                              zIndex: 10,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#F59E0B',
                              color: '#000000',
                              fontSize: '0.625rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            }}
                          >
                            <FiStar style={{ fill: '#000000', fontSize: '0.625rem' }} />
                            <span>1 Cover</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMakeCoverById(img.id);
                            }}
                            title="Click to make 1 Cover Photo"
                            style={{
                              position: 'absolute',
                              top: '5px',
                              left: '5px',
                              zIndex: 10,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(0, 0, 0, 0.65)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#FFFFFF',
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              backdropFilter: 'blur(4px)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F59E0B';
                              e.currentTarget.style.borderColor = '#F59E0B';
                              e.currentTarget.style.color = '#000000';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                              e.currentTarget.style.color = '#FFFFFF';
                            }}
                          >
                            <span>{globalIdx + 1}</span>
                          </button>
                        )}

                        {/* Top-Right Delete Button (Only shows on hover) */}
                        <button
                          type="button"
                          className="photo-card-hover-only"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImageById(img.id);
                          }}
                          title="Delete photo"
                          style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            zIndex: 10,
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(0, 0, 0, 0.65)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6875rem',
                            backdropFilter: 'blur(4px)',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#EF4444';
                            e.currentTarget.style.borderColor = '#EF4444';
                            e.currentTarget.style.transform = 'scale(1.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <FiTrash2 />
                        </button>

                        {/* Ultra-Clean Segmented Micro-Capsule Switcher (Only shows on hover) */}
                        <div
                          className="photo-card-hover-only"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            bottom: '5px',
                            left: '5px',
                            right: '5px',
                            zIndex: 10,
                            height: '22px',
                            backgroundColor: 'rgba(15, 23, 42, 0.76)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.14)',
                            borderRadius: '9999px',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '2px',
                          }}
                        >
                          {(['header', 'body', 'footer'] as const).map((targetSec) => {
                            const isCurrent = (img.section || 'body') === targetSec;
                            const label = targetSec === 'header' ? 'Header' : targetSec === 'body' ? 'Body' : 'Footer';
                            const activeBg = targetSec === 'header' ? '#F59E0B' : targetSec === 'body' ? '#3B82F6' : '#10B981';
                            const activeText = targetSec === 'header' ? '#000000' : '#FFFFFF';

                            return (
                              <button
                                key={targetSec}
                                type="button"
                                onClick={() => moveImageToSection(img.id, targetSec)}
                                title={`Move to ${label}`}
                                style={{
                                  flex: 1,
                                  height: '100%',
                                  padding: 0,
                                  borderRadius: '9999px',
                                  border: 'none',
                                  fontSize: '0.5625rem',
                                  fontWeight: isCurrent ? 700 : 500,
                                  letterSpacing: '0.2px',
                                  backgroundColor: isCurrent ? activeBg : 'transparent',
                                  color: isCurrent ? activeText : 'rgba(255, 255, 255, 0.65)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isCurrent) {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                                    e.currentTarget.style.color = '#FFFFFF';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isCurrent) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                                  }
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Compact Add Slot */}
                  <div
                    onClick={() => handleTriggerUpload(sec.key)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData('text/plain') || draggedImageId;
                      if (id) {
                        moveImageToSection(id, sec.key);
                        setDraggedImageId(null);
                      }
                    }}
                    style={{
                      border: '1.5px dashed var(--border-color)',
                      borderRadius: '9px',
                      height: '110px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = sec.badgeColor;
                      e.currentTarget.style.color = sec.badgeColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                    title={`Click or drop here to add to ${sec.title}`}
                  >
                    <FiPlus style={{ fontSize: '1.15rem' }} />
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>+ Add Photo</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ======================================================== */
        /* SESSION 2: CONTENT (Full Page Social Media Content)      */
        /* ======================================================== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          <style>{`
            @media (min-width: 820px) {
              .facebook-pages-row,
              .social-cards-row,
              .tiktok-cards-row,
              .instagram-cards-row {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
            }
          `}</style>
          {/* Social Media Boxes Stack (Facebook cards 2-in-1-row, Instagram & TikTok 2-in-1-row) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            {/* FACEBOOK PAGES (Page 1 & Page 2 Individual Cards - 2 in one row) */}
            {(activePlatformTab === 'all' || activePlatformTab === 'facebook') && (fbPage1Enabled || fbPage2Enabled) && (
              <div
                className="facebook-pages-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '1.25rem',
                  width: '100%',
                  alignItems: 'stretch',
                }}
              >
                {/* --- Facebook Card 1: Page 1 (Dot BKK Living) --- */}
                {fbPage1Enabled && (
                  <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'none',
                  }}
                >
                  {/* Header: Page Logo, Name, Auth Manager, Active Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: '#1877F2',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          flexShrink: 0,
                          overflow: 'hidden',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'none',
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
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                          {page1Name}
                        </h3>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => (onNavigateTab ? onNavigateTab('auth-manager') : setIsTokenManagerModalOpen(true))}
                        style={{
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '7px',
                          padding: '5px 11px',
                          color: 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <FiSliders style={{ fontSize: '0.75rem' }} />
                        <span>Auth Manager</span>
                      </button>
                    </div>
                  </div>

                  {/* Single Content Box with Bold / Normal formatting */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Post Content
                      </label>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        Title, description & hashtags combined
                      </span>
                    </div>

                    <RichPostEditor
                      initialHtml={fbPage1Html}
                      disabled={!fbPage1Enabled}
                      height="420px"
                      onChange={(socialText, rawHtml) => {
                        setFbCaption(socialText);
                        setFbPage1Html(rawHtml);
                        setFbHeadline('');
                        setFbHashtags('');
                      }}
                      placeholder={`Write complete post for ${page1Name}...`}
                    />
                  </div>

                  {/* Preview Post Button (Aligned right, TikTok size, Facebook color) */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewFbTab('page1');
                        setPreviewPlatform('facebook');
                      }}
                      disabled={!fbPage1Enabled}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        height: '34px',
                        padding: '0 20px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: 'none',
                        color: '#FFFFFF',
                        backgroundColor: '#1877F2',
                        cursor: fbPage1Enabled ? 'pointer' : 'not-allowed',
                        opacity: fbPage1Enabled ? 1 : 0.6,
                        boxShadow: 'none',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (fbPage1Enabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#166FE5';
                      }}
                      onMouseLeave={(e) => {
                        if (fbPage1Enabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#1877F2';
                      }}
                    >
                      <FiEye style={{ fontSize: '0.875rem' }} />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
                )}

                {/* --- Facebook Card 2: Page 2 (Bolt Haven Realty) --- */}
                {fbPage2Enabled && (
                  <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'none',
                  }}
                >
                  {/* Header: Page Logo, Name, Auth Manager, Active Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          flexShrink: 0,
                          overflow: 'hidden',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'none',
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
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                          {page2Name}
                        </h3>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => (onNavigateTab ? onNavigateTab('auth-manager') : setIsTokenManagerModalOpen(true))}
                        style={{
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '7px',
                          padding: '5px 11px',
                          color: 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <FiSliders style={{ fontSize: '0.75rem' }} />
                        <span>Auth Manager</span>
                      </button>
                    </div>
                  </div>

                  {/* Single Content Box with Bold / Normal formatting */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Post Content
                      </label>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        Title, description & hashtags combined
                      </span>
                    </div>

                    <RichPostEditor
                      initialHtml={fbPage2Html}
                      disabled={!fbPage2Enabled}
                      height="420px"
                      onChange={(socialText, rawHtml) => {
                        setFbPage2Caption(socialText);
                        setFbPage2Html(rawHtml);
                        setFbPage2Headline('');
                        setFbPage2Hashtags('');
                      }}
                      placeholder={`Write complete post for ${page2Name}...`}
                    />
                  </div>

                  {/* Preview Post Button (Aligned right, TikTok size, Facebook color) */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewFbTab('page2');
                        setPreviewPlatform('facebook');
                      }}
                      disabled={!fbPage2Enabled}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        height: '34px',
                        padding: '0 20px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: 'none',
                        color: '#FFFFFF',
                        backgroundColor: '#1877F2',
                        cursor: fbPage2Enabled ? 'pointer' : 'not-allowed',
                        opacity: fbPage2Enabled ? 1 : 0.6,
                        boxShadow: 'none',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (fbPage2Enabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#166FE5';
                      }}
                      onMouseLeave={(e) => {
                        if (fbPage2Enabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#1877F2';
                      }}
                    >
                      <FiEye style={{ fontSize: '0.875rem' }} />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
                )}
              </div>
            )}

          {/* ==================================================== */}
          {/* INSTAGRAM: 2 CARDS IN ONE ROW                        */}
          {/* ==================================================== */}
          {hasInstagramAccount && (activePlatformTab === 'all' || activePlatformTab === 'instagram') && (
            <div
              className="instagram-cards-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '1.25rem',
                width: '100%',
                alignItems: 'stretch',
              }}
            >
              {/* --- Instagram Card 1: Content & Geotag --- */}
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
                  height: '100%',
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
                <div style={{ marginBottom: '0.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                    rows={6}
                    placeholder="Clean aesthetic caption with line breaks and DM CTA..."
                    style={{
                      width: '100%',
                      flex: 1,
                      minHeight: '130px',
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
              </div>

              {/* --- Instagram Card 2: 1st Comment Hashtags & Feed Preview --- */}
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
                  height: '100%',
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
                        backgroundColor: 'rgba(228, 64, 95, 0.1)',
                        color: '#E4405F',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        border: '1px solid rgba(228, 64, 95, 0.3)',
                      }}
                    >
                      <FaInstagram />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Feed Preview & Comment
                      </h3>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        Clean feed & auto-comment hashtags
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(228, 64, 95, 0.1)',
                      color: '#E4405F',
                      border: '1px solid rgba(228, 64, 95, 0.25)',
                    }}
                  >
                    Carousel Feed
                  </span>
                </div>

                {/* First Comment / Hashtags (Clean IG Style) */}
                <div style={{ marginBottom: '0.875rem' }}>
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

                {/* Live Instagram Feed Mockup Preview */}
                <div
                  style={{
                    flex: 1,
                    minHeight: '220px',
                    maxHeight: '270px',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                    marginBottom: '0.875rem',
                  }}
                >
                  {/* Top Bar with Profile */}
                  <div
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'linear-gradient(45deg, #F58529 0%, #D62976 50%, #962FBF 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        fontSize: '0.6875rem',
                      }}
                    >
                      <FaInstagram />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {CONNECTED_IG_ACCOUNTS.find((a) => a.id === igAccountId)?.handle || '@dot_bkk_living'}
                      </div>
                      {igLocationTag && (
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                          {igLocationTag}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Image Container */}
                  <div style={{ flex: 1, position: 'relative', minHeight: '140px', backgroundColor: '#000000', overflow: 'hidden' }}>
                    {images[0] ? (
                      <img
                        src={images[0].url}
                        alt="Instagram Feed Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: '0.75rem' }}>
                        No Image Selected
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Bar */}
                  <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        <FaRegHeart />
                        <FaRegComment />
                        <FiShare2 />
                      </div>
                      <FaRegBookmark style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }} />
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, marginRight: '4px', color: 'var(--text-primary)' }}>
                        {CONNECTED_IG_ACCOUNTS.find((a) => a.id === igAccountId)?.handle || 'dot_bkk_living'}
                      </span>
                      {igCaption || 'Caption text...'}
                    </div>
                  </div>
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
            </div>
          )}

          {/* ==================================================== */}
          {/* TIKTOK: ONLY SHOW CARDS FOR CONNECTED ACCOUNTS       */}
          {/* ==================================================== */}
          {(activePlatformTab === 'all' || activePlatformTab === 'tiktok') && (
            <>
              {activeTikTokAccounts.length === 0 ? (
                activePlatformTab === 'tiktok' ? (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px dashed var(--border-color)',
                      borderRadius: '14px',
                      padding: '3rem 1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: isDark ? '#FFFFFF' : '#000000',
                        color: isDark ? '#000000' : '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                      }}
                    >
                      <FaTiktok />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                        No TikTok Accounts Connected
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
                        Connect your TikTok account in Auth Manager first to configure Photo Mode carousels and start auto-publishing.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => (onNavigateTab ? onNavigateTab('auth-manager') : setIsTokenManagerModalOpen(true))}
                      style={{
                        backgroundColor: '#FE2C55',
                        borderColor: '#FE2C55',
                        color: '#FFFFFF',
                        height: '36px',
                        padding: '0 16px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '4px',
                      }}
                    >
                      <FiPlus />
                      <span>Connect TikTok Account</span>
                    </Button>
                  </div>
                ) : null
              ) : (
                <div
                  className="tiktok-cards-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '1.25rem',
                    width: '100%',
                    alignItems: 'stretch',
                  }}
                >
                  {activeTikTokAccounts.map((account, idx) => {
                    const accHook = ttHooks[account.id] ?? (idx === 0 ? tt1Hook : (idx === 1 ? tt2Hook : tt1Hook));
                    const accCaption = ttCaptions[account.id] ?? (idx === 0 ? tt1Caption : (idx === 1 ? tt2Caption : tt1Caption));
                    const accSound = ttSounds[account.id] ?? (idx === 0 ? tt1Sound : (idx === 1 ? tt2Sound : tt1Sound));

                    return (
                      <div
                        key={account.id}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          border: isDark ? '1px solid rgba(254, 44, 85, 0.45)' : '1px solid rgba(254, 44, 85, 0.28)',
                          borderRadius: '14px',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: 'none',
                          transition: 'all 0.2s ease',
                          height: '100%',
                        }}
                      >
                        {/* Box Header - NO SWITCH BUTTON ON CARD */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <TikTokAppIcon size={36} rounded={8} />
                            <div>
                              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                {account.name}
                              </h3>
                            </div>
                          </div>
                        </div>

                        {/* 1. Background Music / Audio */}
                        <div style={{ marginBottom: '0.875rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <FiMusic style={{ color: '#FE2C55' }} />
                            <span>Background Music / Audio</span>
                          </label>
                          <Select
                            value={ttSoundOptions.find((opt) => opt.value === accSound) || ttSoundOptions[0]}
                            onChange={(option: any) => {
                              if (option) {
                                setTtSounds((prev) => ({ ...prev, [account.id]: option.value }));
                                if (idx === 0) setTt1Sound(option.value);
                                if (idx === 1) setTt2Sound(option.value);
                              }
                            }}
                            options={ttSoundOptions}
                            styles={selectStyles}
                            isSearchable={false}
                          />
                        </div>

                        {/* 2. First 3-Sec Hook */}
                        <div style={{ marginBottom: '0.875rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#FE2C55' }}>
                              <FiZap style={{ color: '#FE2C55' }} />
                              <span>First 3-Sec Hook (TikTok Overlay)</span>
                            </label>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              Grab attention immediately
                            </span>
                          </div>
                          <input
                            type="text"
                            value={accHook}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTtHooks((prev) => ({ ...prev, [account.id]: val }));
                              if (idx === 0) setTt1Hook(val);
                              if (idx === 1) setTt2Hook(val);
                            }}
                            placeholder="e.g. Is this the best condo value under 20k in Sukhumvit?"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid rgba(254, 44, 85, 0.35)',
                              backgroundColor: 'var(--bg-main)',
                              color: 'var(--text-primary)',
                              fontSize: '0.8125rem',
                              outline: 'none',
                            }}
                          />
                        </div>

                        {/* 3. TikTok Caption & Tags */}
                        <div style={{ marginBottom: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              <FiFileText style={{ color: 'var(--text-muted)' }} />
                              <span>TikTok Caption & Tags</span>
                            </label>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              {accCaption.length} / 2,200
                            </span>
                          </div>
                          <textarea
                            value={accCaption}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTtCaptions((prev) => ({ ...prev, [account.id]: val }));
                              if (idx === 0) setTt1Caption(val);
                              if (idx === 1) setTt2Caption(val);
                            }}
                            rows={7}
                            placeholder="Short punchy caption with question to provoke comments..."
                            style={{
                              width: '100%',
                              flex: 1,
                              minHeight: '170px',
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
                            }}
                          />
                        </div>

                        {/* Preview Button (Right-aligned, TikTok size) */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPreviewTikTokAccount(account);
                              setTtPreviewAccountId(idx === 1 ? 'tt-acc-2' : 'tt-acc-1');
                              setPreviewTtSlideIdx(0);
                              setPreviewPlatform('tiktok');
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              height: '34px',
                              padding: '0 20px',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#FE2C55',
                              color: '#FFFFFF',
                              cursor: 'pointer',
                              boxShadow: 'none',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = '#E0264D';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = '#FE2C55';
                            }}
                          >
                            <FiEye style={{ fontSize: '0.875rem' }} />
                            <span>Preview</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* SECTION 4: Publishing Action Bar */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '0.875rem 1.125rem',
            boxShadow: 'none',
          }}
        >
          {/* Schedule & Action Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {/* Timing Choice */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === 'NOW'}
                  onChange={() => setScheduleType('NOW')}
                  style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer', width: '13px', height: '13px' }}
                />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <FiZap style={{ fontSize: '0.8125rem', color: 'var(--accent-primary)' }} />
                  <span>Publish Immediately</span>
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === 'SCHEDULED'}
                  onChange={() => setScheduleType('SCHEDULED')}
                  style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer', width: '13px', height: '13px' }}
                />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <FiClock style={{ fontSize: '0.8125rem' }} />
                  <span>Schedule for Later</span>
                </span>
              </label>

              {scheduleType === 'SCHEDULED' && (
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    outline: 'none',
                  }}
                />
              )}
            </div>

            {/* Normal Size Action Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleStartPublish}
                disabled={selectedChannelsCount === 0 || images.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '32px',
                  padding: '0 14px',
                  fontSize: '0.78125rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  backgroundColor: (selectedChannelsCount === 0 || images.length === 0) ? 'var(--bg-main)' : '#1877F2',
                  color: (selectedChannelsCount === 0 || images.length === 0) ? 'var(--text-muted)' : '#FFFFFF',
                  border: (selectedChannelsCount === 0 || images.length === 0) ? '1px solid var(--border-color)' : 'none',
                  cursor: (selectedChannelsCount === 0 || images.length === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <FiSend style={{ fontSize: '0.75rem' }} />
                <span>
                  {scheduleType === 'SCHEDULED'
                    ? `Schedule Post to ${selectedChannelsCount} Channel${selectedChannelsCount > 1 ? 's' : ''}`
                    : `Publish to ${selectedChannelsCount} Channel${selectedChannelsCount > 1 ? 's' : ''} Now`}
                </span>
              </button>
            </div>
          </div>
        </div>
    </div>
  )}
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
              ? (publishProgress.isSuccess ? 'Publishing Completed' : 'Publishing Failed')
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
          maxWidth={previewPlatform === 'facebook' ? '560px' : previewPlatform === 'tiktok' ? '460px' : '450px'}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {previewPlatform === 'facebook' ? (
                <>
                  <FaFacebook style={{ color: '#1877F2', fontSize: '1.125rem' }} />
                  <span>Preview: Facebook Page Post</span>
                </>
              ) : previewPlatform === 'instagram' ? (
                <>
                  <FaInstagram style={{ color: '#E4405F', fontSize: '1.125rem' }} />
                  <span>Preview: Instagram Carousel Post</span>
                </>
              ) : (
                <>
                  <FaTiktok style={{ color: '#FE2C55', fontSize: '1.125rem' }} />
                  <span>Preview: TikTok Photo Mode</span>
                </>
              )}
            </div>
          }
        >
          <div
            style={{
              maxHeight: '78vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              padding: '0.25rem 0.25rem 1.75rem',
              boxSizing: 'border-box',
            }}
          >
            {/* Facebook Preview Card */}
            {previewPlatform === 'facebook' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '520px' }}>
                {/* Sub-tab toggle when Target is "Both" */}
                {fbTargetMode === 'both' && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '14px',
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '4px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewFbTab('page1')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: previewFbTab === 'page1' ? '#1877F2' : 'transparent',
                        color: previewFbTab === 'page1' ? '#FFFFFF' : 'var(--text-secondary)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: previewFbTab === 'page1' ? '0 1px 3px rgba(24, 119, 242, 0.3)' : 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <FaFacebook style={{ color: previewFbTab === 'page1' ? '#FFFFFF' : '#1877F2', fontSize: '0.9375rem' }} />
                      <span>{page1Name || 'Page 1'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFbTab('page2')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: previewFbTab === 'page2' ? '#1877F2' : 'transparent',
                        color: previewFbTab === 'page2' ? '#FFFFFF' : 'var(--text-secondary)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: previewFbTab === 'page2' ? '0 1px 3px rgba(24, 119, 242, 0.3)' : 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <FaFacebook style={{ color: previewFbTab === 'page2' ? '#FFFFFF' : '#1877F2', fontSize: '0.9375rem' }} />
                      <span>{page2Name || 'Page 2'}</span>
                    </button>
                  </div>
                )}

                {(() => {
                  const isPreviewingPage2 = fbTargetMode === 'page2' || (fbTargetMode === 'both' && previewFbTab === 'page2');
                  const targetPageName = isPreviewingPage2 ? page2Name : page1Name;
                  const targetCaption = isPreviewingPage2 ? fbPage2Caption : fbCaption;
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
                        boxShadow: '0 2px 14px rgba(0, 0, 0, 0.12)',
                        overflow: 'hidden',
                        border: '1px solid #CED0D4',
                        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                      }}
                    >
                      {/* FB Post Header */}
                      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: '#1877F2',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.25rem',
                              overflow: 'hidden',
                              border: '1px solid rgba(0, 0, 0, 0.08)',
                              flexShrink: 0,
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
                            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#050505', lineHeight: 1.25 }}>
                              {targetPageName || 'Facebook Page'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#65676B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <span>Just now</span>
                              <span>·</span>
                              <FiGlobe style={{ fontSize: '0.75rem' }} />
                              <span>Public</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#65676B' }}>
                          <div style={{ padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center' }}>
                            <FiMoreHorizontal style={{ fontSize: '1.25rem' }} />
                          </div>
                        </div>
                      </div>

                      {/* FB Post Text - cleanly showing only the formatted content */}
                      <div
                        style={{
                          padding: '0 16px 14px',
                          fontSize: '0.9375rem',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          color: '#050505',
                          wordBreak: 'break-word',
                        }}
                      >
                        {targetCaption || 'No content written yet...'}
                      </div>

                      {/* FB Post Photos Grid */}
                      {targetImgs.length > 0 && (
                        <div style={{ width: '100%', backgroundColor: '#F0F2F5', borderTop: '1px solid #E4E6EB', borderBottom: '1px solid #E4E6EB' }}>
                          <img
                            src={targetImgs[0].url}
                            alt="Cover"
                            style={{
                              width: '100%',
                              maxHeight: '460px',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                          {targetImgs.length > 1 && (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${Math.min(targetImgs.length - 1, 3)}, 1fr)`,
                                gap: '2px',
                                marginTop: '2px',
                                backgroundColor: '#CED0D4',
                              }}
                            >
                              {targetImgs.slice(1, 4).map((img, i) => (
                                <div key={img.id} style={{ height: '100px', position: 'relative', overflow: 'hidden' }}>
                                  <img
                                    src={img.url}
                                    alt="Gallery"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  />
                                  {i === 2 && targetImgs.length > 4 && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        backgroundColor: 'rgba(0,0,0,0.55)',
                                        color: '#FFF',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.25rem',
                                        fontWeight: 700,
                                      }}
                                    >
                                      +{targetImgs.length - 4}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* FB Engagement Stats Bar */}
                      <div
                        style={{
                          padding: '10px 16px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                          color: '#65676B',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: '#1877F2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#FFF',
                                fontSize: '0.625rem',
                                zIndex: 2,
                              }}
                            >
                              <FaThumbsUp style={{ fontSize: '0.6rem' }} />
                            </div>
                            <div
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: '#FA383E',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#FFF',
                                fontSize: '0.55rem',
                                marginLeft: '-4px',
                                zIndex: 1,
                              }}
                            >
                              <FaHeart style={{ fontSize: '0.55rem' }} />
                            </div>
                          </div>
                          <span style={{ fontWeight: 500, marginLeft: '2px' }}>24</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span>4 comments</span>
                          <span>·</span>
                          <span>2 shares</span>
                        </div>
                      </div>

                      {/* FB Action Buttons Bar (Like, Comment, Share) */}
                      <div
                        style={{
                          margin: '0 12px 6px',
                          padding: '4px 0',
                          borderTop: '1px solid #CED0D4',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '4px',
                        }}
                      >
                        <div
                          style={{
                            padding: '8px 0',
                            borderRadius: '6px',
                            color: '#65676B',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            userSelect: 'none',
                          }}
                        >
                          <FaRegThumbsUp style={{ fontSize: '1.05rem' }} />
                          <span>Like</span>
                        </div>
                        <div
                          style={{
                            padding: '8px 0',
                            borderRadius: '6px',
                            color: '#65676B',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            userSelect: 'none',
                          }}
                        >
                          <FaRegComment style={{ fontSize: '1.05rem' }} />
                          <span>Comment</span>
                        </div>
                        <div
                          style={{
                            padding: '8px 0',
                            borderRadius: '6px',
                            color: '#65676B',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            userSelect: 'none',
                          }}
                        >
                          <FiShare2 style={{ fontSize: '1.05rem' }} />
                          <span>Share</span>
                        </div>
                      </div>
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
            {previewPlatform === 'tiktok' && (() => {
              const activePreviewAcc = selectedPreviewTikTokAccount || (ttPreviewAccountId === 'tt-acc-2' ? tiktokAccount2 : tiktokAccount1) || {
                id: 'preview',
                name: 'BoltHaven Property',
                handle: '@bolthavenrealty',
                followers: '',
              };
              const activePreviewHook = (selectedPreviewTikTokAccount ? ttHooks[selectedPreviewTikTokAccount.id] : null) || (ttPreviewAccountId === 'tt-acc-2' ? tt2Hook : tt1Hook);
              const activePreviewCaption = (selectedPreviewTikTokAccount ? ttCaptions[selectedPreviewTikTokAccount.id] : null) || (ttPreviewAccountId === 'tt-acc-2' ? tt2Caption : tt1Caption);
              const activePreviewSound = (selectedPreviewTikTokAccount ? ttSounds[selectedPreviewTikTokAccount.id] : null) || (ttPreviewAccountId === 'tt-acc-2' ? tt2Sound : tt1Sound);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                  <style>{`
                    @keyframes ttDiscSpin {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                    @keyframes ttNoteFloat1 {
                      0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
                      50% { opacity: 0.9; }
                      100% { transform: translate(-16px, -30px) scale(1.1); opacity: 0; }
                    }
                    @keyframes ttNoteFloat2 {
                      0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
                      40% { opacity: 0.9; }
                      100% { transform: translate(-24px, -38px) scale(1.2); opacity: 0; }
                    }
                  `}</style>

                  {/* Account Selector if multiple accounts connected */}
                  {activeTikTokAccounts.length > 1 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        marginBottom: '10px',
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '4px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        maxWidth: '320px',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      {activeTikTokAccounts.map((acc, accIdx) => {
                        const isSelected = (selectedPreviewTikTokAccount?.id || tiktokAccount1?.id) === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setSelectedPreviewTikTokAccount(acc);
                              setTtPreviewAccountId(accIdx === 1 ? 'tt-acc-2' : 'tt-acc-1');
                            }}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              borderRadius: '7px',
                              border: 'none',
                              backgroundColor: isSelected ? '#FE2C55' : 'transparent',
                              color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <FaTiktok style={{ fontSize: '0.75rem', color: isSelected ? '#FFFFFF' : '#FE2C55' }} />
                            <span>{acc.handle}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Device Tag */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 10px',
                      borderRadius: '16px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      marginBottom: '10px',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
                    <span>iPhone 16 Pro • Photo Mode 9:16</span>
                  </div>

                  {/* iPhone 16 Pro Chassis */}
                  <div
                    style={{
                      position: 'relative',
                      width: '320px',
                      height: '640px',
                      borderRadius: '48px',
                      padding: '10px',
                      background: 'linear-gradient(145deg, #2b303c 0%, #171a22 45%, #0b0d10 100%)',
                      boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.15) inset, 0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 35px rgba(254, 44, 85, 0.12)',
                      boxSizing: 'border-box',
                      userSelect: 'none',
                    }}
                  >
                    {/* Hardware Buttons */}
                    <div style={{ position: 'absolute', left: '-3px', top: '95px', width: '3px', height: '22px', backgroundColor: '#374151', borderRadius: '2px 0 0 2px' }} />
                    <div style={{ position: 'absolute', left: '-3px', top: '135px', width: '3px', height: '42px', backgroundColor: '#374151', borderRadius: '2px 0 0 2px' }} />
                    <div style={{ position: 'absolute', left: '-3px', top: '190px', width: '3px', height: '42px', backgroundColor: '#374151', borderRadius: '2px 0 0 2px' }} />
                    <div style={{ position: 'absolute', right: '-3px', top: '145px', width: '3px', height: '60px', backgroundColor: '#374151', borderRadius: '0 2px 2px 0' }} />

                    {/* Inside Screen */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        borderRadius: '38px',
                        overflow: 'hidden',
                        backgroundColor: '#000000',
                        color: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {/* Dynamic Island */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '10px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '86px',
                          height: '24px',
                          backgroundColor: '#000000',
                          borderRadius: '16px',
                          zIndex: 60,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: '8px',
                          boxShadow: '0 0 2px rgba(255,255,255,0.08)',
                        }}
                      >
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0b0f19', border: '1px solid #1a2233' }} />
                      </div>

                      {/* iOS Status Bar */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '38px',
                          zIndex: 55,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0 20px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#FFFFFF',
                          pointerEvents: 'none',
                        }}
                      >
                        <span>9:41</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <svg width="14" height="10" viewBox="0 0 17 11" fill="currentColor">
                            <rect x="0" y="8" width="3" height="3" rx="0.5" />
                            <rect x="4.5" y="5.5" width="3" height="5.5" rx="0.5" />
                            <rect x="9" y="3" width="3" height="8" rx="0.5" />
                            <rect x="13.5" y="0" width="3" height="11" rx="0.5" />
                          </svg>
                          <svg width="13" height="10" viewBox="0 0 16 12" fill="currentColor">
                            <path d="M8 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-4.95-4.95a7 7 0 019.9 0l-1.4 1.4a5 5 0 00-7.1 0l-1.4-1.4zm-2.83-2.83a11 11 0 0115.56 0l-1.4 1.4a9 9 0 00-12.76 0l-1.4-1.4z" />
                          </svg>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                            <div style={{ width: '19px', height: '9px', borderRadius: '2.5px', border: '1px solid #FFFFFF', padding: '1px', display: 'flex' }}>
                              <div style={{ width: '85%', height: '100%', backgroundColor: '#FFFFFF', borderRadius: '1px' }} />
                            </div>
                            <div style={{ width: '1.5px', height: '3.5px', backgroundColor: '#FFFFFF', borderRadius: '0 1px 1px 0' }} />
                          </div>
                        </div>
                      </div>

                      {/* Top TikTok Navigation Bar */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '38px',
                          left: 0,
                          right: 0,
                          height: '40px',
                          zIndex: 50,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0 14px',
                          color: '#FFFFFF',
                          pointerEvents: 'auto',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 7px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(0, 0, 0, 0.45)',
                            backdropFilter: 'blur(6px)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            letterSpacing: '0.4px',
                          }}
                        >
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#FE2C55', boxShadow: '0 0 5px #FE2C55' }} />
                          LIVE
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', fontWeight: 600 }}>
                          <span style={{ opacity: 0.65, cursor: 'pointer' }}>Following</span>
                          <div style={{ position: 'relative', fontWeight: 700, cursor: 'pointer' }}>
                            <span>For You</span>
                            <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', width: '22px', height: '2px', backgroundColor: '#FFFFFF', borderRadius: '2px', boxShadow: '0 0 4px rgba(255,255,255,0.8)' }} />
                          </div>
                        </div>

                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(0,0,0,0.45)',
                            backdropFilter: 'blur(6px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            cursor: 'pointer',
                          }}
                        >
                          <FiSearch style={{ fontSize: '13px' }} />
                        </div>
                      </div>

                      {/* Main Full-Bleed Media Canvas */}
                      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                        {images.length > 0 && images[previewTtSlideIdx] ? (
                          <img
                            src={images[previewTtSlideIdx].url}
                            alt={`TikTok Photo ${previewTtSlideIdx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : images[0] ? (
                          <img
                            src={images[0].url}
                            alt="TikTok Photo Cover"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#6B7280' }}>
                            <FiImage style={{ fontSize: '32px' }} />
                            <span style={{ fontSize: '0.8125rem' }}>No Photo Selected</span>
                          </div>
                        )}

                        {/* Top & Bottom Legibility Vignettes */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '130px',
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
                            pointerEvents: 'none',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '240px',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.65) 45%, rgba(0,0,0,0.2) 75%, transparent 100%)',
                            pointerEvents: 'none',
                          }}
                        />

                        {/* TikTok Photo Mode Pill Badge (Top Right) */}
                        {images.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '84px',
                              right: '12px',
                              zIndex: 40,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(0, 0, 0, 0.65)',
                              backdropFilter: 'blur(8px)',
                              border: '1px solid rgba(255, 255, 255, 0.18)',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#FFFFFF',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                            }}
                          >
                            <span>📷</span>
                            <span>Photo</span>
                            <span style={{ opacity: 0.6 }}>•</span>
                            <span>{previewTtSlideIdx + 1}/{images.length}</span>
                          </div>
                        )}

                        {/* Carousel Arrows (if multiple photos) */}
                        {images.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTtSlideIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                              }}
                              style={{
                                position: 'absolute',
                                left: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 45,
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                                backdropFilter: 'blur(6px)',
                                border: '1px solid rgba(255, 255, 255, 0.25)',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                              }}
                            >
                              <FiChevronLeft style={{ fontSize: '16px' }} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTtSlideIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                              }}
                              style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 45,
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                                backdropFilter: 'blur(6px)',
                                border: '1px solid rgba(255, 255, 255, 0.25)',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                              }}
                            >
                              <FiChevronRight style={{ fontSize: '16px' }} />
                            </button>
                          </>
                        )}

                        {/* Authentic TikTok Viral Hook Sticker */}
                        {activePreviewHook && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '120px',
                              left: '12px',
                              right: '12px',
                              zIndex: 40,
                              padding: '10px 12px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(0, 0, 0, 0.82)',
                              backdropFilter: 'blur(10px)',
                              border: '1px solid rgba(255, 255, 255, 0.16)',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Dual-tone TikTok gradient top accent bar */}
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '3px',
                                background: 'linear-gradient(90deg, #FE2C55 0%, #25F4EE 100%)',
                              }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '8.5px', fontWeight: 800, color: '#25F4EE', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                                ✦ PROPERTY HOOK
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                                color: '#FFFFFF',
                                lineHeight: 1.35,
                                textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                              }}
                            >
                              {activePreviewHook}
                            </div>
                          </div>
                        )}

                        {/* Right Action Rail */}
                        <div
                          style={{
                            position: 'absolute',
                            right: '8px',
                            bottom: '76px',
                            zIndex: 45,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          {/* Creator Avatar with pink-red '+' Follow badge */}
                          <div style={{ position: 'relative', marginBottom: '2px' }}>
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                border: '2px solid #FFFFFF',
                                backgroundColor: '#1E293B',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                              }}
                            >
                              {images[0] ? (
                                <img src={images[0].url} alt="Creator" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontWeight: 800, fontSize: '14px', color: '#FE2C55' }}>B</span>
                              )}
                            </div>
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '-5px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '17px',
                                height: '17px',
                                borderRadius: '50%',
                                backgroundColor: '#FE2C55',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 900,
                                boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                                cursor: 'pointer',
                              }}
                            >
                              +
                            </div>
                          </div>

                          {/* Heart */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                            <FaHeart style={{ color: '#FE2C55', fontSize: '23px', filter: 'drop-shadow(0 2px 5px rgba(254,44,85,0.4))' }} />
                            <span style={{ fontSize: '10.5px', fontWeight: 700, marginTop: '2px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>4.8K</span>
                          </div>

                          {/* Comment */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                            <FaComment style={{ color: '#FFFFFF', fontSize: '21px', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))' }} />
                            <span style={{ fontSize: '10.5px', fontWeight: 700, marginTop: '2px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>182</span>
                          </div>

                          {/* Bookmark */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                            <FaBookmark style={{ color: '#FBBF24', fontSize: '20px', filter: 'drop-shadow(0 2px 5px rgba(251,191,36,0.3))' }} />
                            <span style={{ fontSize: '10.5px', fontWeight: 700, marginTop: '2px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>920</span>
                          </div>

                          {/* Share */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                            <FiShare2 style={{ color: '#FFFFFF', fontSize: '21px', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))' }} />
                            <span style={{ fontSize: '10px', fontWeight: 700, marginTop: '2px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>Share</span>
                          </div>

                          {/* Spinning Vinyl Record with Animated Floating Musical Notes */}
                          <div style={{ position: 'relative', marginTop: '4px', cursor: 'pointer' }}>
                            <div
                              style={{
                                position: 'absolute',
                                top: '-12px',
                                left: '-6px',
                                color: '#25F4EE',
                                fontSize: '11px',
                                animation: 'ttNoteFloat1 2.2s ease-out infinite',
                                pointerEvents: 'none',
                              }}
                            >
                              ♪
                            </div>
                            <div
                              style={{
                                position: 'absolute',
                                top: '-16px',
                                left: '6px',
                                color: '#FE2C55',
                                fontSize: '13px',
                                animation: 'ttNoteFloat2 2.6s ease-out 0.6s infinite',
                                pointerEvents: 'none',
                              }}
                            >
                              ♫
                            </div>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, #2a2a2a 20%, #111111 50%, #2a2a2a 70%, #000000 100%)',
                                border: '6px solid #18181b',
                                boxShadow: '0 3px 10px rgba(0,0,0,0.8)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: 'ttDiscSpin 3.5s linear infinite',
                              }}
                            >
                              <div
                                style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  backgroundColor: '#FE2C55',
                                  border: '1.2px solid #FFFFFF',
                                  overflow: 'hidden',
                                }}
                              >
                                {images[0] && (
                                  <img src={images[0].url} alt="Sound" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Creator Info, Caption & Audio */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '48px',
                            left: '10px',
                            right: '58px',
                            zIndex: 40,
                          }}
                        >
                          {/* Handle + Verification */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.8125rem', letterSpacing: '-0.01em', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                              {activePreviewAcc.handle}
                            </span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: '#20D5EC',
                                color: '#000000',
                                fontSize: '7.5px',
                                fontWeight: 900,
                              }}
                            >
                              ✓
                            </span>
                            <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.7)', marginLeft: '2px' }}>• 1h ago</span>
                          </div>

                          {/* Caption */}
                          <div
                            style={{
                              fontSize: '0.75rem',
                              lineHeight: 1.35,
                              maxHeight: '62px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: '#FFFFFF',
                              textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                            }}
                          >
                            {activePreviewCaption}
                          </div>

                          {/* Carousel Dots */}
                          {images.length > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                              {images.map((_, dotIdx) => (
                                <div
                                  key={dotIdx}
                                  onClick={() => setPreviewTtSlideIdx(dotIdx)}
                                  style={{
                                    width: dotIdx === previewTtSlideIdx ? '14px' : '4px',
                                    height: '4px',
                                    borderRadius: '2px',
                                    backgroundColor: dotIdx === previewTtSlideIdx ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                                    transition: 'all 0.2s ease',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.8)',
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          {/* Sound Row */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.6875rem',
                              marginTop: '6px',
                              color: '#E5E7EB',
                              backgroundColor: 'rgba(0, 0, 0, 0.45)',
                              backdropFilter: 'blur(6px)',
                              padding: '3px 7px',
                              borderRadius: '8px',
                              width: 'fit-content',
                              maxWidth: '100%',
                            }}
                          >
                            <FaMusic style={{ color: '#25F4EE', fontSize: '9px', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {activePreviewSound || 'Original Sound - bolthavenrealty'}
                            </span>
                          </div>
                        </div>

                        {/* TikTok Bottom App Bar */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '44px',
                            backgroundColor: 'rgba(0, 0, 0, 0.95)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            zIndex: 50,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-around',
                            padding: '0 4px 8px',
                            fontSize: '9px',
                            fontWeight: 600,
                            color: '#9CA3AF',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#FFFFFF', gap: '2px', cursor: 'pointer' }}>
                            <FiHome style={{ fontSize: '14px' }} />
                            <span>Home</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                            <FiCompass style={{ fontSize: '14px' }} />
                            <span>Friends</span>
                          </div>

                          {/* Iconic TikTok Create '+' Button */}
                          <div style={{ position: 'relative', width: '36px', height: '24px', cursor: 'pointer' }}>
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: 0,
                                width: '30px',
                                backgroundColor: '#25F4EE',
                                borderRadius: '6px',
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                right: 0,
                                width: '30px',
                                backgroundColor: '#FE2C55',
                                borderRadius: '6px',
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: '3px',
                                right: '3px',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '5px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#000000',
                                fontWeight: 900,
                                fontSize: '14px',
                              }}
                            >
                              +
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                            <FiMessageSquare style={{ fontSize: '14px' }} />
                            <span>Inbox</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                            <FiUser style={{ fontSize: '14px' }} />
                            <span>Profile</span>
                          </div>
                        </div>

                        {/* iPhone Home Indicator Line */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '3px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '100px',
                            height: '3.5px',
                            backgroundColor: 'rgba(255, 255, 255, 0.65)',
                            borderRadius: '2px',
                            zIndex: 60,
                            pointerEvents: 'none',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
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
      {/* MODAL 4: Full-Screen Image Lightbox Viewer               */}
      {/* ======================================================== */}
      {lightboxUrl && (
        <div
          onClick={handleCloseLightbox}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            cursor: 'default',
            userSelect: 'none',
          }}
        >
          {/* Top-Left Counter Badge */}
          <div
            style={{
              position: 'absolute',
              top: '24px',
              left: '24px',
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              zIndex: 10,
            }}
          >
            {(lightboxIndex ?? 0) + 1} / {Math.max(images.length, 1)}
          </div>

          {/* Top-Right Close Button */}
          <button
            type="button"
            onClick={handleCloseLightbox}
            title="Close (ESC)"
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.25rem',
              zIndex: 10,
              backdropFilter: 'blur(8px)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.22)';
              e.currentTarget.style.transform = 'scale(1.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <FiX />
          </button>

          {/* Left Arrow Button */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={handlePrevLightbox}
              title="Previous photo (←)"
              aria-label="Previous photo"
              style={{
                position: 'absolute',
                left: '24px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                backdropFilter: 'blur(4px)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.55)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            >
              <FiChevronLeft style={{ fontSize: '24px' }} />
            </button>
          )}

          {/* Right Arrow Button */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={handleNextLightbox}
              title="Next photo (→)"
              aria-label="Next photo"
              style={{
                position: 'absolute',
                right: '24px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                backdropFilter: 'blur(4px)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.55)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            >
              <FiChevronRight style={{ fontSize: '24px' }} />
            </button>
          )}

          {/* Center Main Image Canvas */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: '85vw',
              maxHeight: '78vh',
              overflow: 'visible',
            }}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              e.stopPropagation();
              if (e.deltaY < 0) {
                setLightboxZoom((s) => Math.min(s + 0.25, 3));
              } else {
                setLightboxZoom((s) => Math.max(s - 0.25, 0.5));
              }
            }}
          >
            <img
              src={(lightboxIndex !== null && images[lightboxIndex]?.url) || lightboxUrl}
              alt="Preview"
              style={{
                maxWidth: '85vw',
                maxHeight: '78vh',
                objectFit: 'contain',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85)',
                transform: `scale(${lightboxZoom})`,
                transition: 'transform 0.12s ease-out',
                display: 'block',
              }}
              draggable={false}
            />
          </div>

          {/* Bottom Controls Area (Floating Pill + Hint text) */}
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              zIndex: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hint Text */}
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'rgba(255, 255, 255, 0.5)',
                fontWeight: 400,
                letterSpacing: '0.3px',
              }}
            >
              Scroll to zoom · Arrow keys · ESC to close
            </span>

            {/* Floating Toolbar Pill with ONLY necessary buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                backgroundColor: 'rgba(24, 25, 28, 0.88)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '24px',
                padding: '5px 12px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              }}
            >
              {/* Zoom Out */}
              <button
                type="button"
                onClick={() => setLightboxZoom((s) => Math.max(s - 0.25, 0.5))}
                title="Zoom Out (-)"
                aria-label="Zoom Out"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <FiZoomOut style={{ fontSize: '15px' }} />
              </button>

              {/* Percentage / Reset Button */}
              <button
                type="button"
                onClick={() => setLightboxZoom(1)}
                title="Reset Zoom (0)"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  minWidth: '46px',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {Math.round(lightboxZoom * 100)}%
              </button>

              {/* Zoom In */}
              <button
                type="button"
                onClick={() => setLightboxZoom((s) => Math.min(s + 0.25, 3))}
                title="Zoom In (+)"
                aria-label="Zoom In"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <FiZoomIn style={{ fontSize: '15px' }} />
              </button>

              {/* Divider */}
              <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

              {/* Download Image Button */}
              <button
                type="button"
                onClick={handleDownloadLightboxImage}
                title="Download photo"
                aria-label="Download photo"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <FiDownload style={{ fontSize: '15px' }} />
              </button>
            </div>
          </div>
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
              </div>
            )}

            {/* TikTok Copy */}
            {historyDetailItem.tiktok?.enabled && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FE2C55', fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px' }}>
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
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1877F2', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FaFacebook />
                      <span>Destination 1: {page1Name} (ID: {page1PageId})</span>
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
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FaFacebook />
                      <span>Destination 2: {page2Name} (ID: {page2PageId})</span>
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
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#D97706',
                fontSize: '0.75rem',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <FiAlertCircle style={{ fontSize: '1rem', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Confirmation Required:</strong> Clicking confirm will immediately upload photos and create official Meta Feed Posts. Page 1 and Page 2 are published independently using their own encrypted tokens with zero content mixing.
              </div>
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
