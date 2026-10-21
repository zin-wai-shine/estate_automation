import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FiCheck,
  FiUploadCloud,
  FiSave,
  FiTrash2,
  FiEye,
  FiEyeOff,
  FiSliders,
  FiType,
  FiImage as FiImageIcon,
  FiRefreshCw,
  FiDownload,
  FiAlertCircle,
  FiPlus,
  FiChevronDown,
  FiX,
  FiMoreHorizontal,
  FiRotateCcw,
  FiScissors,
  FiMaximize2,
  FiGrid,
  FiCheckCircle,
  FiZap,
  FiTarget,
  FiFolder,
  FiEdit2,
  FiLayers,
  FiShield,
  FiInfo,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { useTheme } from '../../context/ThemeContext';
import { SwitchToggle } from '../autopost/SwitchToggle';
import {
  type WatermarkConfig,
  type WatermarkLayoutMode,
  type WatermarkBorderStyle,
  type SavedWatermarkItem,
  DEFAULT_WATERMARK_CONFIG,
  DEFAULT_SAVED_WATERMARKS,
  SAMPLE_BADGES,
  loadActiveWatermarkConfig,
  saveActiveWatermarkConfig,
  loadSavedWatermarksList,
  saveSavedWatermarksList,
} from '../autopost/watermarkStorage';
import { drawWatermarkOnContext } from '../autopost/watermarkCanvas';
import {
  type CropStudioFormat,
  INITIAL_CROP_FORMATS,
  getSavedCropFormats,
  saveCropFormatsList,
  getActiveCropFormatId,
  setActiveCropFormatId,
  updateCropFormat,
  renameCropFormat,
  saveNewCropFormat,
  deleteCropFormat,
  syncCropFormatToWorkflowConfig,
} from './cropFormats';
import {
  savePhotoToIndexedDB,
  loadPhotosFromIndexedDB,
  deletePhotoFromIndexedDB,
  clearSessionPhotosFromIndexedDB,
} from './cropStudioStorage';

export interface StudioImage {
  id: string;
  url: string;
  name: string;
  originalUrl?: string;
  width?: number;
  height?: number;
}

interface CropPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  aspect: string;
  isCustom?: boolean;
}

type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

const DEFAULT_SAMPLE_PHOTOS: StudioImage[] = [
  {
    id: 'img-1',
    url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1536&q=80',
    name: 'Luxurious Modern Condo Lounge.png',
    width: 1536,
    height: 1024,
  },
  {
    id: 'img-2',
    url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1536&q=80',
    name: 'Kitchen & Dining Area.png',
    width: 1536,
    height: 1024,
  },
  {
    id: 'img-3',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1536&q=80',
    name: 'Modern Bathroom & Spa.png',
    width: 1536,
    height: 1024,
  },
  {
    id: 'img-4',
    url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1448&q=80',
    name: 'Balcony Infinity Skyline.png',
    width: 1448,
    height: 1086,
  },
];

const gcd = (a: number, b: number): number => {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
};

const getAspectRatioLabel = (w: number, h: number): string => {
  if (w <= 0 || h <= 0) return 'Custom';
  if (w === h) return '1:1';
  const divisor = gcd(w, h);
  const rw = Math.round(w / divisor);
  const rh = Math.round(h / divisor);
  if (rw <= 32 && rh <= 32) {
    return `${rw}:${rh}`;
  }
  const ratio = w / h;
  if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(ratio - 4 / 3) < 0.02) return '4:3';
  if (Math.abs(ratio - 3 / 2) < 0.02) return '3:2';
  if (Math.abs(ratio - 4 / 5) < 0.02) return '4:5';
  if (Math.abs(ratio - 9 / 16) < 0.02) return '9:16';
  return `${w}:${h}`;
};

const INITIAL_CROP_PRESETS: CropPreset[] = [
  { id: 'original', name: 'None', width: 0, height: 0, aspect: 'None' },
  { id: '4:3', name: '4:3 Property Listing', width: 1440, height: 1080, aspect: '4:3' },
  { id: '4:5', name: '4:5 Portrait / IG Post', width: 1080, height: 1350, aspect: '4:5' },
  { id: '1:1', name: '1:1 Square Post', width: 1080, height: 1080, aspect: '1:1' },
  { id: '16:9', name: '16:9 Landscape Web', width: 1920, height: 1080, aspect: '16:9' },
  { id: '9:16', name: '9:16 Story / Reel', width: 1080, height: 1920, aspect: '9:16' },
  { id: '3:2', name: '3:2 Classic Photo', width: 1620, height: 1080, aspect: '3:2' },
];

const POSITION_LABELS: Record<WatermarkPosition, string> = {
  'top-left': 'Top Left',
  'top-center': 'Top Center',
  'top-right': 'Top Right',
  'center-left': 'Center Left',
  'center': 'Center',
  'center-right': 'Center Right',
  'bottom-left': 'Bottom Left',
  'bottom-center': 'Bottom Center',
  'bottom-right': 'Bottom Right',
};

const NINE_POSITIONS: WatermarkPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const FOCUS_COORDS: Record<WatermarkPosition, { x: number; y: number }> = {
  'top-left': { x: 0, y: 0 },
  'top-center': { x: 0.5, y: 0 },
  'top-right': { x: 1, y: 0 },
  'center-left': { x: 0, y: 0.5 },
  'center': { x: 0.5, y: 0.5 },
  'center-right': { x: 1, y: 0.5 },
  'bottom-left': { x: 0, y: 1 },
  'bottom-center': { x: 0.5, y: 1 },
  'bottom-right': { x: 1, y: 1 },
};

const POSITION_CSS_MAP: Record<WatermarkPosition, string> = {
  'top-left': 'left top',
  'top-center': 'center top',
  'top-right': 'right top',
  'center-left': 'left center',
  'center': 'center center',
  'center-right': 'right center',
  'bottom-left': 'left bottom',
  'bottom-center': 'center bottom',
  'bottom-right': 'right bottom',
};

const EXPORT_FORMAT_OPTIONS = [
  { id: 'original', label: 'Original File Type' },
  { id: 'jpeg', label: 'JPEG (.jpg)' },
  { id: 'png', label: 'PNG (.png)' },
  { id: 'webp', label: 'WEBP (.webp)' },
];

export interface LayoutTile {
  id: number;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SocialGridLayout {
  id: string;
  name: string;
  subtitle: string;
  tileCount: number;
  hasPlusOneBadge?: boolean;
  tiles: LayoutTile[];
}

const SOCIAL_GRID_LAYOUTS: SocialGridLayout[] = [
  {
    id: 'one-square',
    name: 'One Square',
    subtitle: '1 Single Square',
    tileCount: 1,
    tiles: [{ id: 1, label: 'Single Tile (1/1)', x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: 'two-squares',
    name: 'Two Squares',
    subtitle: 'Two Squares (2 Tiles)',
    tileCount: 2,
    tiles: [
      { id: 1, label: 'Left Half (1/2)', x: 0, y: 0, w: 0.5, h: 1 },
      { id: 2, label: 'Right Half (2/2)', x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: 'three-squares',
    name: 'Three Squares',
    subtitle: 'Top Banner + 2 Squares',
    tileCount: 3,
    tiles: [
      { id: 1, label: 'Top Banner (1/3)', x: 0, y: 0, w: 1, h: 0.52 },
      { id: 2, label: 'Bottom Left (2/3)', x: 0, y: 0.52, w: 0.5, h: 0.48 },
      { id: 3, label: 'Bottom Right (3/3)', x: 0.5, y: 0.52, w: 0.5, h: 0.48 },
    ],
  },
  {
    id: 'four-squares',
    name: 'Four Squares',
    subtitle: '2×2 Cross Grid (4 Tiles)',
    tileCount: 4,
    tiles: [
      { id: 1, label: 'Top Left (1/4)', x: 0, y: 0, w: 0.5, h: 0.5 },
      { id: 2, label: 'Top Right (2/4)', x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { id: 3, label: 'Bottom Left (3/4)', x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { id: 4, label: 'Bottom Right (4/4)', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: 'five-squares',
    name: 'Five Squares',
    subtitle: '2 Top + 3 Bottom (5 Tiles)',
    tileCount: 5,
    tiles: [
      { id: 1, label: 'Top Left (1/5)', x: 0, y: 0, w: 0.5, h: 0.55 },
      { id: 2, label: 'Top Right (2/5)', x: 0.5, y: 0, w: 0.5, h: 0.55 },
      { id: 3, label: 'Bottom Left (3/5)', x: 0, y: 0.55, w: 1 / 3, h: 0.45 },
      { id: 4, label: 'Bottom Center (4/5)', x: 1 / 3, y: 0.55, w: 1 / 3, h: 0.45 },
      { id: 5, label: 'Bottom Right (5/5)', x: 2 / 3, y: 0.55, w: 1 / 3, h: 0.45 },
    ],
  },
  {
    id: 'six-squares',
    name: 'Six Squares',
    subtitle: '2 Top + 4 Bottom (+1 Facebook Grid)',
    tileCount: 6,
    hasPlusOneBadge: true,
    tiles: [
      { id: 1, label: 'Top Left (1/6)', x: 0, y: 0, w: 0.5, h: 0.55 },
      { id: 2, label: 'Top Right (2/6)', x: 0.5, y: 0, w: 0.5, h: 0.55 },
      { id: 3, label: 'Bottom 1 (3/6)', x: 0, y: 0.55, w: 0.25, h: 0.45 },
      { id: 4, label: 'Bottom 2 (4/6)', x: 0.25, y: 0.55, w: 0.25, h: 0.45 },
      { id: 5, label: 'Bottom 3 (5/6)', x: 0.5, y: 0.55, w: 0.25, h: 0.45 },
      { id: 6, label: 'Bottom 4 (6/6)', x: 0.75, y: 0.55, w: 0.25, h: 0.45 },
    ],
  },
];

const getShortFocusLabel = (pos: WatermarkPosition): string => {
  switch (pos) {
    case 'top-left':
      return 'Top Left';
    case 'top-center':
      return 'Top';
    case 'top-right':
      return 'Top Right';
    case 'center-left':
      return 'Left';
    case 'center':
      return 'Center';
    case 'center-right':
      return 'Right';
    case 'bottom-left':
      return 'Bottom Left';
    case 'bottom-center':
      return 'Bottom';
    case 'bottom-right':
      return 'Bottom Right';
    default:
      return 'Center';
  }
};

const getAutoTileFocusMap = (layoutId: string): Record<number, WatermarkPosition> => {
  switch (layoutId) {
    case 'two-squares':
      return { 1: 'center-right', 2: 'center-left' };
    case 'three-squares':
      return { 1: 'center', 2: 'center-right', 3: 'center-left' };
    case 'four-squares':
      return {
        1: 'bottom-right',
        2: 'bottom-left',
        3: 'top-right',
        4: 'top-left',
      };
    case 'five-squares':
      return {
        1: 'bottom-right',
        2: 'bottom-left',
        3: 'top-right',
        4: 'top-center',
        5: 'top-left',
      };
    case 'six-squares':
      return {
        1: 'bottom-right',
        2: 'bottom-left',
        3: 'top-right',
        4: 'top-center',
        5: 'top-center',
        6: 'top-left',
      };
    case 'one-square':
    default:
      return { 1: 'center' };
  }
};
const canvasToBlob = (canvas: HTMLCanvasElement, mime: string, quality = 0.95): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to blob conversion failed'));
      },
      mime,
      quality
    );
  });
};

const triggerFileDownload = (url: string, fileName: string) => {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    } catch {}
  }, 4000);
};

export const WatermarkView: React.FC = () => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  // Workspace Mode: Standard Resolution vs Social Grid Split vs Watermark Studio
  const [studioMode, setStudioMode] = useState<'standard' | 'grid' | 'watermark'>('standard');

  const isSamplePhoto = (img: StudioImage | any): boolean =>
    Boolean(
      img?.url?.includes('images.unsplash.com') ||
      img?.id?.startsWith('img-') ||
      img?.name === 'Luxurious Modern Condo Lounge.png' ||
      img?.name === 'Kitchen & Dining Area.png' ||
      img?.name === 'Modern Bathroom & Spa.png' ||
      img?.name === 'Balcony Infinity Skyline.png'
    );

  // Separate Sessions: Standard Crop Images vs Cut / Social Grid Split Images
  const [standardImages, setStandardImages] = useState<StudioImage[]>(() => {
    try {
      const saved = localStorage.getItem('ea_crop_studio_standard_images_v2') || localStorage.getItem('ea_crop_studio_images_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((img: StudioImage) => img?.url && !img.url.startsWith('blob:') && !isSamplePhoto(img));
          if (valid.length > 0) return valid;
        }
      }
    } catch (e) {}
    return []; // Clean empty workspace by default
  });
  const [standardSelectedImageIndex, setStandardSelectedImageIndex] = useState<number>(0);

  const [gridImages, setGridImages] = useState<StudioImage[]>(() => {
    try {
      const saved = localStorage.getItem('ea_crop_studio_grid_images_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((img: StudioImage) => img?.url && !img.url.startsWith('blob:') && !isSamplePhoto(img));
          if (valid.length > 0) return valid;
        }
      }
    } catch (e) {}
    return []; // Clean empty workspace by default
  });
  const [gridSelectedImageIndex, setGridSelectedImageIndex] = useState<number>(0);

  // Clean out any legacy sample photos from localStorage on mount
  useEffect(() => {
    try {
      const cleanKey = (key: string) => {
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const filtered = list.filter((img: any) => !isSamplePhoto(img));
            if (filtered.length === 0) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, JSON.stringify(filtered));
            }
          }
        }
      };
      cleanKey('ea_crop_studio_standard_images_v2');
      cleanKey('ea_crop_studio_images_v1');
      cleanKey('ea_crop_studio_grid_images_v4');
    } catch {}
  }, []);

  // Restore persisted binary Blobs from IndexedDB on page load / reload
  // This guarantees user-uploaded images survive browser reloads and never break even if deleted from the user's local hard drive
  useEffect(() => {
    let isMounted = true;
    const restoreSavedPhotos = async () => {
      try {
        const [storedStd, storedGrid] = await Promise.all([
          loadPhotosFromIndexedDB('standard'),
          loadPhotosFromIndexedDB('grid'),
        ]);
        if (!isMounted) return;

        if (storedStd && storedStd.length > 0) {
          const cleanStd = storedStd.filter((img) => !isSamplePhoto(img));
          setStandardImages(cleanStd);
          // Purge any sample photos from IndexedDB
          storedStd.filter(isSamplePhoto).forEach((s) => deletePhotoFromIndexedDB(s.id));
        }
        if (storedGrid && storedGrid.length > 0) {
          const cleanGrid = storedGrid.filter((img) => !isSamplePhoto(img));
          setGridImages(cleanGrid);
          storedGrid.filter(isSamplePhoto).forEach((s) => deletePhotoFromIndexedDB(s.id));
        }
      } catch (err) {
        console.warn('Error restoring photos from IndexedDB:', err);
      }
    };

    restoreSavedPhotos();
    return () => {
      isMounted = false;
    };
  }, []);

  // Ask permission before leaving or reloading if there are active photos in the workspace
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (standardImages.length > 0 || gridImages.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Standard trigger for native browser confirmation dialog: "Leave site? Changes you made may not be saved."
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [standardImages.length, gridImages.length]);

  // Active Session Image Library
  const images = studioMode === 'grid' ? gridImages : standardImages;
  const selectedImageIndex = studioMode === 'grid' ? gridSelectedImageIndex : standardSelectedImageIndex;

  const setSelectedImageIndex = (idx: number) => {
    if (studioMode === 'grid') {
      setGridSelectedImageIndex(idx);
    } else {
      setStandardSelectedImageIndex(idx);
    }
  };

  const setImages = (
    updater: StudioImage[] | ((prev: StudioImage[]) => StudioImage[])
  ) => {
    if (studioMode === 'grid') {
      setGridImages((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        try {
          localStorage.setItem('ea_crop_studio_grid_images_v4', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    } else {
      setStandardImages((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        try {
          localStorage.setItem('ea_crop_studio_standard_images_v2', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  };

  const activeImage = images[selectedImageIndex] || images[0];

  // Presets & Active Settings
  const [presets, setPresets] = useState<CropPreset[]>(() => {
    try {
      const saved = localStorage.getItem('ea_crop_studio_presets_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_CROP_PRESETS;
  });
  const initialActiveFormat = useMemo(() => {
    const list = getSavedCropFormats();
    const activeId = getActiveCropFormatId();
    return list.find((f) => f.id === activeId) || list[0] || INITIAL_CROP_FORMATS[0];
  }, []);

  const [activePresetId, setActivePresetId] = useState<string>(() => {
    if (initialActiveFormat?.targetWidth === 1080 && initialActiveFormat?.targetHeight === 1350) return 'ig-portrait';
    if (initialActiveFormat?.targetWidth === 1200 && initialActiveFormat?.targetHeight === 1200) return 'square';
    return 'custom';
  });

  // Crop Settings (Matches Screenshot 1 & 2)
  const [cropEnabled, setCropEnabled] = useState<boolean>(true);
  const [targetWidth, setTargetWidth] = useState<number>(() => initialActiveFormat?.targetWidth || 1080);
  const [targetHeight, setTargetHeight] = useState<number>(() => initialActiveFormat?.targetHeight || 1350);
  const [focusPosition, setFocusPosition] = useState<WatermarkPosition>(() => initialActiveFormat?.focusPosition || 'center');
  const [applyToAllImages, setApplyToAllImages] = useState<boolean>(true);
  const [cropZoom, setCropZoom] = useState<number>(() => initialActiveFormat?.cropZoom || 1);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>(() => initialActiveFormat?.fitMode || 'cover');
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(null);

  // Grid Split Settings (Cut session)
  const [gridLayoutId, setGridLayoutId] = useState<string>('two-squares');
  const [selectedTileId, setSelectedTileId] = useState<number>(2);
  const [tileFocusMap, setTileFocusMap] = useState<Record<number, WatermarkPosition>>(() =>
    getAutoTileFocusMap('two-squares')
  );
  const [useWatermarkOnTiles, setUseWatermarkOnTiles] = useState<boolean>(false);
  const [hideGuides, setHideGuides] = useState<boolean>(false);

  // Watermark Configuration State
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>(() => {
    if (initialActiveFormat?.watermarkConfig) {
      return initialActiveFormat.watermarkConfig;
    }
    try {
      const loaded = loadActiveWatermarkConfig();
      if (loaded?.config) {
        return loaded.config;
      }
    } catch {}
    return {
      ...DEFAULT_WATERMARK_CONFIG,
      enabled: false,
    };
  });
  const [hideWatermarkPreview, setHideWatermarkPreview] = useState<boolean>(false);
  const [isWatermarkCardExpanded, setIsWatermarkCardExpanded] = useState<boolean>(true);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Auto-save watermark config to storage whenever updated
  useEffect(() => {
    try {
      saveActiveWatermarkConfig(watermarkConfig);
    } catch {}
  }, [watermarkConfig]);

  const handleUploadLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, SVG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result as string;
      if (res) {
        setWatermarkConfig((prev) => ({
          ...prev,
          enabled: true,
          type: 'logo',
          logoUrl: res,
          logoName: file.name,
        }));
        showToast(`Uploaded watermark logo: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getWatermarkOverlayStyle = (pos: WatermarkPosition, marginPercent: number) => {
    const m = `${marginPercent}%`;
    switch (pos) {
      case 'top-left':
        return { top: m, left: m, transform: 'none' };
      case 'top-center':
        return { top: m, left: '50%', transform: 'translateX(-50%)' };
      case 'top-right':
        return { top: m, right: m, transform: 'none' };
      case 'center-left':
        return { top: '50%', left: m, transform: 'translateY(-50%)' };
      case 'center':
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'center-right':
        return { top: '50%', right: m, transform: 'translateY(-50%)' };
      case 'bottom-left':
        return { bottom: m, left: m, transform: 'none' };
      case 'bottom-center':
        return { bottom: m, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-right':
      default:
        return { bottom: m, right: m, transform: 'none' };
    }
  };

  // Tile Crop Settings (Grid Split Mode) with Auto-save & Persistence
  const [applyToAllTiles, setApplyToAllTiles] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ea_tile_crop_settings_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.applyToAllTiles === 'boolean') return parsed.applyToAllTiles;
      }
    } catch {}
    return true;
  });

  const [tileCropMap, setTileCropMap] = useState<
    Record<number, { width: number; height: number; presetId?: string }>
  >(() => {
    try {
      const saved = localStorage.getItem('ea_tile_crop_settings_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tileCropMap) return parsed.tileCropMap;
      }
    } catch {}
    return {};
  });

  // Helper to persist tile crop configuration to localStorage
  const saveTileCropSettings = (
    w: number,
    h: number,
    presetId: string,
    applyAll: boolean,
    map: Record<number, { width: number; height: number; presetId?: string }>
  ) => {
    try {
      localStorage.setItem(
        'ea_tile_crop_settings_v1',
        JSON.stringify({
          targetWidth: w,
          targetHeight: h,
          activePresetId: presetId,
          applyToAllTiles: applyAll,
          tileCropMap: map,
        })
      );
    } catch {}
  };

  // Restore saved tile crop settings whenever entering Grid Split mode
  useEffect(() => {
    if (studioMode === 'grid') {
      try {
        const saved = localStorage.getItem('ea_tile_crop_settings_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.targetWidth && parsed.targetHeight) {
            setTargetWidth(parsed.targetWidth);
            setTargetHeight(parsed.targetHeight);
          }
          if (parsed.activePresetId) {
            setActivePresetId(parsed.activePresetId);
          }
        }
      } catch {}
    }
  }, [studioMode]);

  // Export & UI States
  const [exportFormat, setExportFormat] = useState<'original' | 'jpeg' | 'png' | 'webp'>('original');
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSlicing, setIsSlicing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAddPresetModal, setShowAddPresetModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [newCustomW, setNewCustomW] = useState<number>(1200);
  const [newCustomH, setNewCustomH] = useState<number>(1200);

  // Saved Studio Formats (Reusable across Crop Studio & Facebook Import)
  const [cropStudioFormats, setCropStudioFormats] = useState<CropStudioFormat[]>(() => getSavedCropFormats());
  const [selectedStudioFormatId, setSelectedStudioFormatId] = useState<string>(() => getActiveCropFormatId());
  const [showSaveFormatModal, setShowSaveFormatModal] = useState<boolean>(false);
  const [showSavedFormatsModal, setShowSavedFormatsModal] = useState<boolean>(false);
  const [saveFormatMode, setSaveFormatMode] = useState<'update' | 'create'>('update');
  const [saveFormatTargetId, setSaveFormatTargetId] = useState<string>('');
  const [saveFormatName, setSaveFormatName] = useState<string>('');
  const [saveFormatDesc, setSaveFormatDesc] = useState<string>('');
  // Inline rename state in Saved Formats modal
  const [editingFormatId, setEditingFormatId] = useState<string | null>(null);
  const [editingFormatName, setEditingFormatName] = useState<string>('');

  const activeStudioFormat = useMemo(() => {
    return cropStudioFormats.find((f) => f.id === selectedStudioFormatId) || null;
  }, [cropStudioFormats, selectedStudioFormatId]);

  // Auto-sync current studio setup (crop size, framing, anchor, zoom, watermark) into active format
  useEffect(() => {
    if (!selectedStudioFormatId) return;

    const resolvedAspect =
      (targetWidth === 1080 && targetHeight === 1350) ? '4:5' :
      (targetWidth === 1200 && targetHeight === 1200) || (targetWidth === 1080 && targetHeight === 1080) ? '1:1' :
      (targetWidth === 1920 && targetHeight === 1080) ? '16:9' :
      (targetWidth === 1080 && targetHeight === 1920) ? '9:16' :
      (targetWidth === 1440 && targetHeight === 1080) ? '4:3' :
      (targetWidth === 1620 && targetHeight === 1080) ? '3:2' :
      `${targetWidth}:${targetHeight}`;

    const effectiveWatermark = watermarkConfig.enabled ? { ...watermarkConfig } : undefined;

    setCropStudioFormats((prevList) => {
      const existing = prevList.find((f) => f.id === selectedStudioFormatId);
      if (!existing) return prevList;

      const isDifferent =
        existing.targetWidth !== targetWidth ||
        existing.targetHeight !== targetHeight ||
        existing.aspect !== resolvedAspect ||
        existing.fitMode !== fitMode ||
        existing.focusPosition !== focusPosition ||
        existing.cropZoom !== cropZoom ||
        JSON.stringify(existing.watermarkConfig || null) !== JSON.stringify(effectiveWatermark || null);

      if (!isDifferent) return prevList;

      const updated: CropStudioFormat = {
        ...existing,
        targetWidth,
        targetHeight,
        aspect: resolvedAspect,
        fitMode,
        focusPosition,
        cropZoom,
        watermarkConfig: effectiveWatermark,
        updatedAt: Date.now(),
      };
      const nextList = prevList.map((f) => (f.id === selectedStudioFormatId ? updated : f));
      saveCropFormatsList(nextList);
      syncCropFormatToWorkflowConfig(updated);
      return nextList;
    });
  }, [
    selectedStudioFormatId,
    targetWidth,
    targetHeight,
    fitMode,
    focusPosition,
    cropZoom,
    watermarkConfig,
  ]);
  const [isDownloadImageDropdownOpen, setIsDownloadImageDropdownOpen] = useState<boolean>(false);
  const [isDownloadingAllDirect, setIsDownloadingAllDirect] = useState<boolean>(false);
  // Cut Slice Preview Animation states
  const [isCutting, setIsCutting] = useState<boolean>(false);
  const [isCutSpread, setIsCutSpread] = useState<boolean>(false);

  useEffect(() => {
    setIsCutSpread(false);
    setIsCutting(false);
  }, [studioMode, gridLayoutId, selectedImageIndex]);

  const playScissorSnipSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      [0.05, 0.28, 0.52].forEach((delay) => {
        setTimeout(() => {
          try {
            const bufferSize = Math.floor(ctx.sampleRate * 0.04);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 3400;
            filter.Q.value = 3.2;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start();
          } catch {}
        }, delay * 1000);
      });
    } catch {}
  };

  const handleTriggerCutAnimation = () => {
    if (isCutting) return;
    setIsCutSpread(false);
    setIsCutting(true);
    playScissorSnipSound();
    setTimeout(() => {
      setIsCutting(false);
      setIsCutSpread(true);
    }, 750);
  };

  // Portal target
  const [headerActionEl, setHeaderActionEl] = useState<HTMLElement | null>(null);
  const formatDropdownRef = useRef<HTMLDivElement>(null);
  const downloadImageDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHeaderActionEl(document.getElementById('header-action-portal'));
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(e.target as Node)) {
        setIsFormatDropdownOpen(false);
      }
      if (downloadImageDropdownRef.current && !downloadImageDropdownRef.current.contains(e.target as Node)) {
        setIsDownloadImageDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Re-sync saved crop studio formats when window gains focus or formats updated
  useEffect(() => {
    const handleSync = () => {
      setCropStudioFormats(getSavedCropFormats());
    };
    window.addEventListener('focus', handleSync);
    window.addEventListener('ea_crop_formats_updated', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('ea_crop_formats_updated', handleSync);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Sync target dimensions when original preset is active
  useEffect(() => {
    if (activePresetId === 'original' && activeImage) {
      if (activeImage.width && activeImage.height) {
        setTargetWidth(activeImage.width);
        setTargetHeight(activeImage.height);
      }
    }
  }, [activeImage?.id, activeImage?.width, activeImage?.height, activePresetId]);

  // Persist images separately for Standard Crop and Cut sessions
  useEffect(() => {
    try {
      localStorage.setItem('ea_crop_studio_standard_images_v2', JSON.stringify(standardImages));
    } catch (e) {}
  }, [standardImages]);

  useEffect(() => {
    try {
      localStorage.setItem('ea_crop_studio_grid_images_v4', JSON.stringify(gridImages));
    } catch (e) {}
  }, [gridImages]);

  // Persist custom crop presets
  useEffect(() => {
    try {
      localStorage.setItem('ea_crop_studio_presets_v2', JSON.stringify(presets));
    } catch (e) {}
  }, [presets]);

  // Determine export MIME type
  const getExportMimeType = (sourceUrl?: string): 'image/jpeg' | 'image/png' | 'image/webp' => {
    if (exportFormat === 'jpeg') return 'image/jpeg';
    if (exportFormat === 'png') return 'image/png';
    if (exportFormat === 'webp') return 'image/webp';
    if (sourceUrl && sourceUrl.includes('.png')) return 'image/png';
    if (sourceUrl && sourceUrl.includes('.webp')) return 'image/webp';
    return 'image/jpeg';
  };

  // Helper to load image HTML element
  const loadImageElement = async (src: string): Promise<HTMLImageElement> => {
    if (src.startsWith('http')) {
      try {
        const res = await fetch(src, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load blob image'));
            img.src = blobUrl;
          });
        }
      } catch (e) {}
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        const fb = new Image();
        fb.onload = () => resolve(fb);
        fb.onerror = () => reject(new Error('Failed to load image'));
        fb.src = src;
      };
      img.src = src;
    });
  };

  // Render cropped/standardized canvas
  const renderCroppedCanvas = async (
    imgSrc: string,
    width: number,
    height: number,
    fit: 'cover' | 'contain',
    pos: WatermarkPosition,
    zoom: number
  ): Promise<string> => {
    const img = await loadImageElement(imgSrc);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D failed');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (fit === 'contain') {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);
      const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight) * zoom;
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = (width - dw) / 2;
      const dy = (height - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      // Cover crop
      const targetAspect = width / height;
      const imageAspect = img.naturalWidth / img.naturalHeight;
      let baseCropW = img.naturalWidth;
      let baseCropH = img.naturalHeight;

      if (imageAspect > targetAspect) {
        baseCropW = Math.round(img.naturalHeight * targetAspect);
        baseCropH = img.naturalHeight;
      } else {
        baseCropW = img.naturalWidth;
        baseCropH = Math.round(img.naturalWidth / targetAspect);
      }

      const zoomedW = Math.max(20, Math.round(baseCropW / zoom));
      const zoomedH = Math.max(20, Math.round(baseCropH / zoom));

      const coords = FOCUS_COORDS[pos] || FOCUS_COORDS.center;
      const maxOffX = Math.max(0, img.naturalWidth - zoomedW);
      const maxOffY = Math.max(0, img.naturalHeight - zoomedH);
      const sx = Math.round(maxOffX * coords.x);
      const sy = Math.round(maxOffY * coords.y);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, sx, sy, zoomedW, zoomedH, 0, 0, width, height);
    }

    if (watermarkConfig.enabled) {
      await drawWatermarkOnContext(ctx, width, height, watermarkConfig, {
        project: activeImage?.name?.replace(/\.[^/.]+$/, '') || 'Condo Listing',
        phone: '081-234-5678',
        line: '@estatebangkok',
      });
    }

    return canvas.toDataURL(getExportMimeType(imgSrc), 0.95);
  };

  // Handle Select Preset
  const handleSelectPreset = (preset: CropPreset) => {
    setActivePresetId(preset.id);
    if (preset.id === 'original') {
      const w = activeImage?.width || 1200;
      const h = activeImage?.height || 1200;
      setTargetWidth(w);
      setTargetHeight(h);
      return;
    }
    setTargetWidth(preset.width);
    setTargetHeight(preset.height);
    setCropEnabled(true);
  };

  // Add / Save Preset Profile
  const handleSaveCurrentAsProfile = () => {
    if (!targetWidth || !targetHeight || targetWidth <= 0 || targetHeight <= 0) {
      return;
    }

    const existing = presets.find(
      (p) => p.width === targetWidth && p.height === targetHeight && p.id !== 'original'
    );
    if (existing) {
      setActivePresetId(existing.id);
      setCropEnabled(true);
      return;
    }

    const aspectLabel = getAspectRatioLabel(targetWidth, targetHeight);
    const customId = `custom-${targetWidth}x${targetHeight}-${Date.now().toString().slice(-4)}`;
    const newPreset: CropPreset = {
      id: customId,
      name: `${aspectLabel} Custom`,
      width: targetWidth,
      height: targetHeight,
      aspect: aspectLabel,
      isCustom: true,
    };

    setPresets((prev) => [...prev, newPreset]);
    setActivePresetId(newPreset.id);
    setCropEnabled(true);
  };

  // Delete Custom Preset
  const handleDeletePreset = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
    if (activePresetId === id) {
      setActivePresetId('original');
      if (activeImage) {
        setTargetWidth(activeImage.width || 1200);
        setTargetHeight(activeImage.height || 1200);
      }
    }
    showToast('Removed custom ratio');
  };

  // Active Tile Crop Info for Grid Mode
  const currentTileCrop = (!applyToAllTiles && tileCropMap[selectedTileId])
    ? tileCropMap[selectedTileId]
    : { width: targetWidth, height: targetHeight, presetId: activePresetId };

  const currentTileWidth = currentTileCrop.width || targetWidth;
  const currentTileHeight = currentTileCrop.height || targetHeight;
  const currentTilePresetId = currentTileCrop.presetId || activePresetId;

  // Handle Select Tile Preset in Grid Mode (Auto-saves to localStorage)
  const handleSelectTilePreset = (preset: CropPreset) => {
    if (applyToAllTiles) {
      setActivePresetId(preset.id);
      if (preset.id === 'original') {
        const w = activeImage?.width || 1200;
        const h = activeImage?.height || 1200;
        setTargetWidth(w);
        setTargetHeight(h);
        saveTileCropSettings(w, h, 'original', true, tileCropMap);
      } else {
        setTargetWidth(preset.width);
        setTargetHeight(preset.height);
        saveTileCropSettings(preset.width, preset.height, preset.id, true, tileCropMap);
      }
    } else {
      const newMap = {
        ...tileCropMap,
        [selectedTileId]: {
          width: preset.width,
          height: preset.height,
          presetId: preset.id,
        },
      };
      setTileCropMap(newMap);
      saveTileCropSettings(targetWidth, targetHeight, activePresetId, false, newMap);
    }
  };

  // Handle Tile Dimension Manual Updates (W / H inputs with Auto-save)
  const handleUpdateTileDimensions = (newW: number, newH: number) => {
    if (applyToAllTiles) {
      setTargetWidth(newW);
      setTargetHeight(newH);
      setActivePresetId('custom');
      saveTileCropSettings(newW, newH, 'custom', true, tileCropMap);
    } else {
      const newMap = {
        ...tileCropMap,
        [selectedTileId]: {
          width: newW,
          height: newH,
          presetId: 'custom',
        },
      };
      setTileCropMap(newMap);
      saveTileCropSettings(targetWidth, targetHeight, activePresetId, false, newMap);
    }
  };

  // Handle Add Tile Custom Preset (Prevents duplicate, adds to presets & auto-saves)
  const handleAddTileCustomPreset = () => {
    const w = currentTileWidth;
    const h = currentTileHeight;
    if (!w || !h || w <= 0 || h <= 0) return;

    const existing = presets.find((p) => p.width === w && p.height === h && p.id !== 'original');
    if (existing) {
      handleSelectTilePreset(existing);
      return;
    }

    const aspectLabel = getAspectRatioLabel(w, h);
    const customId = `custom-${w}x${h}-${Date.now().toString().slice(-4)}`;
    const newPreset: CropPreset = {
      id: customId,
      name: `${aspectLabel} Custom`,
      width: w,
      height: h,
      aspect: aspectLabel,
      isCustom: true,
    };

    setPresets((prev) => {
      const next = [...prev, newPreset];
      try {
        localStorage.setItem('ea_crop_studio_presets_v2', JSON.stringify(next));
      } catch {}
      return next;
    });

    handleSelectTilePreset(newPreset);
    showToast(`Saved crop size ${w}×${h} px`);
  };

  // Files processing with real image dimensions
  const processFiles = (files: FileList | File[]) => {
    const newImgs: StudioImage[] = [];
    const fileArray = Array.from(files);

    fileArray.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const objectUrl = URL.createObjectURL(file);
        const tempImg = new Image();
        const imgId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const newImgItem: StudioImage = {
          id: imgId,
          url: objectUrl,
          originalUrl: objectUrl,
          name: file.name,
          width: 1536,
          height: 1024,
        };

        // Persist the binary Blob immediately to IndexedDB browser storage
        savePhotoToIndexedDB(studioMode === 'grid' ? 'grid' : 'standard', newImgItem, file);

        tempImg.onload = () => {
          setImages((prev) =>
            prev.map((img) =>
              img.id === imgId
                ? { ...img, width: tempImg.naturalWidth, height: tempImg.naturalHeight }
                : img
            )
          );
          // Update dimension metadata in IndexedDB
          savePhotoToIndexedDB(
            studioMode === 'grid' ? 'grid' : 'standard',
            { ...newImgItem, width: tempImg.naturalWidth, height: tempImg.naturalHeight },
            file
          );
          if (activePresetId === 'original' || studioMode === 'grid') {
            setTargetWidth(tempImg.naturalWidth);
            setTargetHeight(tempImg.naturalHeight);
          }
        };
        tempImg.src = objectUrl;

        newImgs.push(newImgItem);
      }
    });

    if (newImgs.length > 0) {
      const prevLen = images.length;
      setImages((prev) => [...prev, ...newImgs]);
      setSelectedImageIndex(prevLen);
      showToast(`Added ${newImgs.length} new photo(s) to workspace`);
    }
  };

  const handleUploadImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleCopyFromStandardToGrid = () => {
    if (standardImages.length === 0) return;
    const currentStd = standardImages[standardSelectedImageIndex] || standardImages[0];
    const newGridImg: StudioImage = {
      ...currentStd,
      id: `grid-copy-${Date.now()}`,
    };
    savePhotoToIndexedDB('grid', newGridImg);
    setGridImages((prev) => [...prev, newGridImg]);
    setGridSelectedImageIndex(gridImages.length);
    showToast(`Copied "${currentStd.name}" to Cut session`);
  };

  const handleDeleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deletePhotoFromIndexedDB(id);
    if (studioMode === 'grid') {
      const next = gridImages.filter((img) => img.id !== id);
      setGridImages(next);
      if (gridSelectedImageIndex >= next.length) {
        setGridSelectedImageIndex(Math.max(0, next.length - 1));
      }
    } else {
      const next = standardImages.filter((img) => img.id !== id);
      setStandardImages(next);
      if (standardSelectedImageIndex >= next.length) {
        setStandardSelectedImageIndex(Math.max(0, next.length - 1));
      }
    }
    showToast('Removed photo from workspace');
  };

  const handleClearAll = () => {
    clearSessionPhotosFromIndexedDB(studioMode === 'grid' ? 'grid' : 'standard');
    if (studioMode === 'grid') {
      setGridImages([]);
      setGridSelectedImageIndex(0);
      showToast('Cut photos cleared. Upload a new photo to split.');
    } else {
      setStandardImages([]);
      setStandardSelectedImageIndex(0);
      showToast(studioMode === 'watermark' ? 'Watermark workspace photos cleared.' : 'Standard Crop photos cleared.');
    }
  };

  const handleResetToDefaults = () => {
    clearSessionPhotosFromIndexedDB(studioMode === 'grid' ? 'grid' : 'standard');
    if (studioMode === 'grid') {
      setGridImages([]);
      setGridSelectedImageIndex(0);
    } else {
      setStandardImages([]);
      setStandardSelectedImageIndex(0);
    }
    setTargetWidth(1200);
    setTargetHeight(1200);
    setCropEnabled(true);
    setFitMode('cover');
    setFocusPosition('center');
    setCropZoom(1);
    setActivePresetId('custom-1200');
    setShowResetConfirmModal(false);
    showToast(studioMode === 'grid' ? 'Cut workspace reset.' : studioMode === 'watermark' ? 'Watermark workspace reset.' : 'Standard workspace reset to defaults.');
  };

  const handleLoadSamples = () => {
    if (studioMode === 'grid') {
      setGridImages(DEFAULT_SAMPLE_PHOTOS);
      setGridSelectedImageIndex(0);
      showToast('Loaded sample photos to Cut session');
    } else {
      setStandardImages(DEFAULT_SAMPLE_PHOTOS);
      setStandardSelectedImageIndex(0);
      showToast('Loaded 4 sample property photos');
    }
  };

  // Open Save Studio Format Modal (supports update or create)
  const handleOpenSaveFormatModal = (targetFormatId?: string) => {
    const targetFormat = targetFormatId
      ? cropStudioFormats.find((f) => f.id === targetFormatId)
      : activeStudioFormat;

    if (targetFormat) {
      setSaveFormatMode('update');
      setSaveFormatTargetId(targetFormat.id);
      setSaveFormatName(targetFormat.name);
      setSaveFormatDesc(targetFormat.description || `${targetWidth} × ${targetHeight} px`);
    } else {
      setSaveFormatMode('create');
      setSaveFormatTargetId('');
      const defaultName = studioMode === 'grid'
        ? `${currentGridLayout.name} Grid Format`
        : `${activePreset?.aspect || 'Custom'} ${targetWidth}×${targetHeight} Format`;
      const defaultDesc = studioMode === 'grid'
        ? `${currentGridLayout.tileCount} Tiles • Sliced resolution: ${currentTileWidth}×${currentTileHeight} px`
        : `${targetWidth} × ${targetHeight} px • ${fitMode === 'cover' ? 'Fill (Cover)' : 'Fit (Contain)'} • Anchor: ${POSITION_LABELS[focusPosition]}`;
      setSaveFormatName(defaultName);
      setSaveFormatDesc(defaultDesc);
    }
    setShowSaveFormatModal(true);
  };

  // Open modal explicitly to create brand new format
  const handleOpenCreateNewFormatModal = () => {
    setSaveFormatMode('create');
    setSaveFormatTargetId('');
    const defaultName = studioMode === 'grid'
      ? `${currentGridLayout.name} Grid Format`
      : `${activePreset?.aspect || 'Custom'} ${targetWidth}×${targetHeight} Format`;
    const defaultDesc = studioMode === 'grid'
      ? `${currentGridLayout.tileCount} Tiles • Sliced resolution: ${currentTileWidth}×${currentTileHeight} px`
      : `${targetWidth} × ${targetHeight} px • ${fitMode === 'cover' ? 'Fill (Cover)' : 'Fit (Contain)'} • Anchor: ${POSITION_LABELS[focusPosition]}`;
    setSaveFormatName(defaultName);
    setSaveFormatDesc(defaultDesc);
    setShowSaveFormatModal(true);
  };

  // 1-Click Update of any format with current studio settings
  const handleUpdateStudioFormatWithCurrentSettings = (formatId: string, customName?: string, customDesc?: string) => {
    const resolvedAspect =
      (targetWidth === 1080 && targetHeight === 1350) ? '4:5' :
      (targetWidth === 1200 && targetHeight === 1200) || (targetWidth === 1080 && targetHeight === 1080) ? '1:1' :
      (targetWidth === 1920 && targetHeight === 1080) ? '16:9' :
      (targetWidth === 1080 && targetHeight === 1920) ? '9:16' :
      (targetWidth === 1440 && targetHeight === 1080) ? '4:3' :
      (targetWidth === 1620 && targetHeight === 1080) ? '3:2' :
      (activePreset && activePreset.aspect !== 'None' ? activePreset.aspect : `${targetWidth}:${targetHeight}`);

    let updatedFormat: CropStudioFormat | null = null;
    setCropStudioFormats((prevList) => {
      const existing = prevList.find((f) => f.id === formatId);
      if (!existing) return prevList;

      updatedFormat = {
        ...existing,
        name: customName !== undefined ? customName.trim() : existing.name,
        description: customDesc !== undefined ? customDesc.trim() : (existing.description || `${targetWidth} × ${targetHeight} px`),
        mode: studioMode === 'grid' ? 'grid' : 'standard',
        targetWidth,
        targetHeight,
        aspect: resolvedAspect,
        fitMode,
        focusPosition,
        cropZoom,
        watermarkConfig: watermarkConfig.enabled ? { ...watermarkConfig } : undefined,
        gridLayoutId: studioMode === 'grid' ? gridLayoutId : undefined,
        tileCropMap: studioMode === 'grid' ? tileCropMap : undefined,
        tileFocusMap: studioMode === 'grid' ? tileFocusMap : undefined,
        useWatermarkOnTiles: studioMode === 'grid' ? useWatermarkOnTiles : undefined,
        applyToAllTiles: studioMode === 'grid' ? applyToAllTiles : undefined,
        updatedAt: Date.now(),
      };

      const nextList = prevList.map((f) => (f.id === formatId ? updatedFormat! : f));
      saveCropFormatsList(nextList);
      return nextList;
    });

    if (updatedFormat) {
      const saved = updatedFormat as CropStudioFormat;
      setSelectedStudioFormatId(formatId);
      setActiveCropFormatId(formatId);
      syncCropFormatToWorkflowConfig(saved);
      setShowSaveFormatModal(false);
      showToast(`✨ Updated format "${saved.name}" to ${targetWidth}×${targetHeight} (${resolvedAspect})!`);
    }
  };

  // Inline rename of format
  const handleRenameStudioFormat = (formatId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingFormatId(null);
      return;
    }
    const trimmed = newName.trim();
    let updatedFormat: CropStudioFormat | null = null;
    setCropStudioFormats((prevList) => {
      const existing = prevList.find((f) => f.id === formatId);
      if (!existing) return prevList;
      updatedFormat = { ...existing, name: trimmed, updatedAt: Date.now() };
      const nextList = prevList.map((f) => (f.id === formatId ? updatedFormat! : f));
      saveCropFormatsList(nextList);
      return nextList;
    });
    if (updatedFormat) {
      syncCropFormatToWorkflowConfig(updatedFormat);
      showToast(`✨ Renamed format to "${trimmed}"`);
    }
    setEditingFormatId(null);
  };

  // Confirm Save Studio Format (Handles both Update and Create)
  const handleSaveWholeStudioFormat = () => {
    if (!saveFormatName.trim()) return;

    if (saveFormatMode === 'update' && saveFormatTargetId) {
      handleUpdateStudioFormatWithCurrentSettings(saveFormatTargetId, saveFormatName, saveFormatDesc);
      return;
    }

    const resolvedAspect =
      (targetWidth === 1080 && targetHeight === 1350) ? '4:5' :
      (targetWidth === 1200 && targetHeight === 1200) || (targetWidth === 1080 && targetHeight === 1080) ? '1:1' :
      (targetWidth === 1920 && targetHeight === 1080) ? '16:9' :
      (targetWidth === 1080 && targetHeight === 1920) ? '9:16' :
      (targetWidth === 1440 && targetHeight === 1080) ? '4:3' :
      (targetWidth === 1620 && targetHeight === 1080) ? '3:2' :
      (activePreset && activePreset.aspect !== 'None' ? activePreset.aspect : `${targetWidth}:${targetHeight}`);

    const newFormatId = `format-${Date.now()}`;
    const newFormat: CropStudioFormat = {
      id: newFormatId,
      name: saveFormatName.trim(),
      description: saveFormatDesc.trim() || `${targetWidth} × ${targetHeight} px`,
      mode: studioMode === 'grid' ? 'grid' : 'standard',
      targetWidth,
      targetHeight,
      aspect: resolvedAspect,
      fitMode,
      focusPosition,
      cropZoom,
      watermarkConfig: watermarkConfig.enabled ? { ...watermarkConfig } : undefined,
      gridLayoutId: studioMode === 'grid' ? gridLayoutId : undefined,
      tileCropMap: studioMode === 'grid' ? tileCropMap : undefined,
      tileFocusMap: studioMode === 'grid' ? tileFocusMap : undefined,
      useWatermarkOnTiles: studioMode === 'grid' ? useWatermarkOnTiles : undefined,
      applyToAllTiles: studioMode === 'grid' ? applyToAllTiles : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setCropStudioFormats((prevList) => {
      const nextList = [newFormat, ...prevList.filter((f) => f.id !== newFormatId)];
      saveCropFormatsList(nextList);
      return nextList;
    });

    setSelectedStudioFormatId(newFormatId);
    setActiveCropFormatId(newFormatId);
    syncCropFormatToWorkflowConfig(newFormat);
    setShowSaveFormatModal(false);
    showToast(`✨ Saved format "${newFormat.name}"! Ready to use in layout.`);
  };

  // Load a Saved Studio Format
  const handleLoadStudioFormat = (format: CropStudioFormat) => {
    setSelectedStudioFormatId(format.id);
    setActiveCropFormatId(format.id);
    setStudioMode(format.mode);
    setTargetWidth(format.targetWidth);
    setTargetHeight(format.targetHeight);
    setFitMode(format.fitMode);
    setFocusPosition(format.focusPosition);
    setCropZoom(format.cropZoom || 1);
    if (format.watermarkConfig) {
      setWatermarkConfig({ ...format.watermarkConfig });
    }
    const matchingPreset = presets.find((p) => p.width === format.targetWidth && p.height === format.targetHeight);
    if (matchingPreset) {
      setActivePresetId(matchingPreset.id);
    } else {
      setActivePresetId('custom');
    }
    if (format.mode === 'grid' && format.gridLayoutId) {
      setGridLayoutId(format.gridLayoutId);
      if (format.tileCropMap) setTileCropMap(format.tileCropMap);
      if (format.tileFocusMap) setTileFocusMap(format.tileFocusMap);
      if (typeof format.useWatermarkOnTiles === 'boolean') setUseWatermarkOnTiles(format.useWatermarkOnTiles);
      if (typeof format.applyToAllTiles === 'boolean') setApplyToAllTiles(format.applyToAllTiles);
    }
    showToast(`✨ Loaded format: ${format.name}`);
  };

  const handleDeleteStudioFormat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = cropStudioFormats.filter((f) => f.id !== id);
    setCropStudioFormats(updated);
    saveCropFormatsList(updated);
    if (selectedStudioFormatId === id) {
      setSelectedStudioFormatId(updated[0]?.id || '');
    }
    showToast('Deleted format');
  };

  // Download Single Cropped Image
  const handleDownloadSingle = async () => {
    if (!activeImage) return;
    try {
      const mime = getExportMimeType(activeImage.originalUrl || activeImage.url);
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      let dataUrl: string;
      if (activePresetId === 'original' && !watermarkConfig.enabled) {
        dataUrl = activeImage.originalUrl || activeImage.url;
      } else {
        dataUrl = await renderCroppedCanvas(
          activeImage.originalUrl || activeImage.url,
          activePresetId === 'original' ? (activeImage.width || 1200) : targetWidth,
          activePresetId === 'original' ? (activeImage.height || 1200) : targetHeight,
          fitMode,
          focusPosition,
          cropZoom
        );
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      const dimSuffix = activePresetId === 'original' ? 'original' : `${targetWidth}x${targetHeight}`;
      a.download = `${activeImage.name.replace(/\.[^/.]+$/, '')}-${dimSuffix}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Downloaded photo in ${ext.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      const a = document.createElement('a');
      a.href = activeImage.originalUrl || activeImage.url;
      a.download = activeImage.name;
      a.click();
      showToast('Downloaded original photo');
    }
  };

  // Download All as direct individual image files
  const handleDownloadAllDirectImages = async () => {
    if (images.length === 0 || isDownloadingAllDirect) return;
    setIsDownloadingAllDirect(true);
    setIsDownloadImageDropdownOpen(false);
    try {
      showToast(`Preparing ${images.length} photos for download...`);
      const itemsToDownload: { url: string; fileName: string }[] = [];

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const sourceUrl = img.originalUrl || img.url;
        const mime = getExportMimeType(sourceUrl);
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        const dimSuffix = activePresetId === 'original' ? 'original' : `${targetWidth}x${targetHeight}`;
        const fileName = `${img.name.replace(/\.[^/.]+$/, '')}-${dimSuffix}.${ext}`;

        if (activePresetId === 'original' && !watermarkConfig.enabled) {
          itemsToDownload.push({ url: sourceUrl, fileName });
        } else {
          const dataUrl = await renderCroppedCanvas(
            sourceUrl,
            activePresetId === 'original' ? (img.width || 1200) : targetWidth,
            activePresetId === 'original' ? (img.height || 1200) : targetHeight,
            fitMode,
            focusPosition,
            cropZoom
          );
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          itemsToDownload.push({ url: blobUrl, fileName });
        }
      }

      for (let i = 0; i < itemsToDownload.length; i++) {
        const item = itemsToDownload[i];
        triggerFileDownload(item.url, item.fileName);
        if (i < itemsToDownload.length - 1) {
          await new Promise((res) => setTimeout(res, 650));
        }
      }

      showToast(`Downloaded all ${images.length} photos directly as image files!`);
    } catch (err) {
      console.error('Error downloading photos directly', err);
      showToast('⚠️ Error downloading photos directly');
    } finally {
      setIsDownloadingAllDirect(false);
    }
  };

  // Download All as standardized ZIP
  const handleDownloadAllZip = async () => {
    if (images.length === 0) return;
    setIsExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const sourceUrl = img.originalUrl || img.url;
        const mime = getExportMimeType(sourceUrl);
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        const dataUrl = await renderCroppedCanvas(
          sourceUrl,
          activePresetId === 'original' ? (img.width || 1200) : targetWidth,
          activePresetId === 'original' ? (img.height || 1200) : targetHeight,
          fitMode,
          focusPosition,
          cropZoom
        );
        const base64Data = dataUrl.split(',')[1];
        const filename = `${img.name.replace(/\.[^/.]+$/, '')}-${targetWidth}x${targetHeight}.${ext}`;
        zip.file(filename, base64Data, { base64: true });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `standardized-batch-${targetWidth}x${targetHeight}-${Date.now().toString().slice(-4)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Exported all ${images.length} photos in ZIP!`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate ZIP.');
    } finally {
      setIsExporting(false);
    }
  };

  const currentGridLayout = useMemo(() => {
    return SOCIAL_GRID_LAYOUTS.find((l) => l.id === gridLayoutId) || SOCIAL_GRID_LAYOUTS[1];
  }, [gridLayoutId]);

  const currentLayoutTile = useMemo(() => {
    return currentGridLayout.tiles.find((t) => t.id === selectedTileId) || currentGridLayout.tiles[0];
  }, [currentGridLayout, selectedTileId]);

  // Slice & Export Tiles (Social Grid Split Mode)
  const handleSliceAndExportTiles = async () => {
    if (!activeImage) return;
    setIsSlicing(true);
    try {
      const img = await loadImageElement(activeImage.originalUrl || activeImage.url);
      const layout = currentGridLayout;
      const zip = new JSZip();

      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const mime = getExportMimeType(activeImage.originalUrl || activeImage.url);
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const batchCode = `FB-${Math.floor(100000 + Math.random() * 900000)}`;

      for (let i = 0; i < layout.tiles.length; i++) {
        const tile = layout.tiles[i];
        const tileRawX = Math.round(tile.x * naturalW);
        const tileRawY = Math.round(tile.y * naturalH);
        const tileRawW = Math.round(tile.w * naturalW);
        const tileRawH = Math.round(tile.h * naturalH);

        const focusKey = tileFocusMap[tile.id] || 'center';
        const focusCoord = FOCUS_COORDS[focusKey] || { x: 0.5, y: 0.5 };

        // Determine this tile's target width and height
        const tileCrop = (!applyToAllTiles && tileCropMap[tile.id])
          ? tileCropMap[tile.id]
          : { width: targetWidth, height: targetHeight, presetId: activePresetId };

        const isNone = tileCrop.presetId === 'original' || (applyToAllTiles && activePresetId === 'original');

        const tileOutW = isNone ? tileRawW : (tileCrop.width || tileRawW);
        const tileOutH = isNone ? tileRawH : (tileCrop.height || tileRawH);

        let cropW = tileRawW;
        let cropH = tileRawH;

        if (!isNone) {
          const targetAspect = tileOutW / (tileOutH || 1);
          const tileAspect = tileRawW / (tileRawH || 1);

          if (tileAspect > targetAspect) {
            cropW = Math.round(tileRawH * targetAspect);
            cropH = tileRawH;
          } else {
            cropW = tileRawW;
            cropH = Math.round(tileRawW / targetAspect);
          }
        }

        const maxOffsetX = Math.max(0, tileRawW - cropW);
        const maxOffsetY = Math.max(0, tileRawH - cropH);
        const localX = Math.round(maxOffsetX * focusCoord.x);
        const localY = Math.round(maxOffsetY * focusCoord.y);

        const sx = tileRawX + localX;
        const sy = tileRawY + localY;

        const canvas = document.createElement('canvas');
        canvas.width = tileOutW;
        canvas.height = tileOutH;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, tileOutW, tileOutH);
        ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, tileOutW, tileOutH);

        if (useWatermarkOnTiles && watermarkConfig.enabled) {
          await drawWatermarkOnContext(ctx, tileOutW, tileOutH, watermarkConfig, {
            project: activeImage?.name?.replace(/\.[^/.]+$/, '') || 'Condo Listing',
            phone: '081-234-5678',
            line: '@estatebangkok',
          });
        }

        const dataUrl = canvas.toDataURL(mime, 0.95);
        const base64Data = dataUrl.split(',')[1];
        const cleanTileName = tile.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const fileName = `${batchCode}-tile${tile.id}-${cleanTileName}.${ext}`;
        zip.file(fileName, base64Data, { base64: true });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `social-grid-tiles-${batchCode}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Sliced & exported ${layout.tileCount} grid tiles in ZIP!`);
    } catch (err) {
      console.error(err);
      alert('Error slicing image into grid.');
    } finally {
      setIsSlicing(false);
    }
  };

  // Slice & export tiles directly as individual image files
  const handleSliceAndExportTilesDirect = async () => {
    if (!activeImage) return;
    setIsSlicing(true);
    try {
      const img = await loadImageElement(activeImage.originalUrl || activeImage.url);
      const layout = currentGridLayout;
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const mime = getExportMimeType(activeImage.originalUrl || activeImage.url);
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const batchCode = `FB-${Math.floor(100000 + Math.random() * 900000)}`;

      showToast(`Generating all ${layout.tileCount} slice images...`);

      const generatedTiles: { blob: Blob; fileName: string }[] = [];

      for (let i = 0; i < layout.tiles.length; i++) {
        const tile = layout.tiles[i];
        const tileRawX = Math.round(tile.x * naturalW);
        const tileRawY = Math.round(tile.y * naturalH);
        const tileRawW = Math.round(tile.w * naturalW);
        const tileRawH = Math.round(tile.h * naturalH);

        const focusKey = tileFocusMap[tile.id] || 'center';
        const focusCoord = FOCUS_COORDS[focusKey] || { x: 0.5, y: 0.5 };

        const tileCrop = (!applyToAllTiles && tileCropMap[tile.id])
          ? tileCropMap[tile.id]
          : { width: targetWidth, height: targetHeight, presetId: activePresetId };

        const isNone = tileCrop.presetId === 'original' || (applyToAllTiles && activePresetId === 'original');
        const tileOutW = isNone ? tileRawW : (tileCrop.width || tileRawW);
        const tileOutH = isNone ? tileRawH : (tileCrop.height || tileRawH);

        let cropW = tileRawW;
        let cropH = tileRawH;

        if (!isNone) {
          const targetAspect = tileOutW / (tileOutH || 1);
          const tileAspect = tileRawW / (tileRawH || 1);

          if (tileAspect > targetAspect) {
            cropW = Math.round(tileRawH * targetAspect);
            cropH = tileRawH;
          } else {
            cropW = tileRawW;
            cropH = Math.round(tileRawW / targetAspect);
          }
        }

        const maxOffsetX = Math.max(0, tileRawW - cropW);
        const maxOffsetY = Math.max(0, tileRawH - cropH);
        const localX = Math.round(maxOffsetX * focusCoord.x);
        const localY = Math.round(maxOffsetY * focusCoord.y);

        const sx = tileRawX + localX;
        const sy = tileRawY + localY;

        const canvas = document.createElement('canvas');
        canvas.width = tileOutW;
        canvas.height = tileOutH;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, tileOutW, tileOutH);
        ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, tileOutW, tileOutH);

        if (useWatermarkOnTiles && watermarkConfig.enabled) {
          await drawWatermarkOnContext(ctx, tileOutW, tileOutH, watermarkConfig, {
            project: activeImage?.name?.replace(/\.[^/.]+$/, '') || 'Condo Listing',
            phone: '081-234-5678',
            line: '@estatebangkok',
          });
        }

        const blob = await canvasToBlob(canvas, mime, 0.95);
        const cleanTileName = tile.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const fileName = `${batchCode}-tile${tile.id}-${cleanTileName}.${ext}`;
        generatedTiles.push({ blob, fileName });
      }

      for (let i = 0; i < generatedTiles.length; i++) {
        const item = generatedTiles[i];
        const blobUrl = URL.createObjectURL(item.blob);
        triggerFileDownload(blobUrl, item.fileName);
        if (i < generatedTiles.length - 1) {
          await new Promise((res) => setTimeout(res, 650));
        }
      }

      showToast(`Exported all ${layout.tileCount} grid tiles directly as images!`);
    } catch (err) {
      console.error('Error slicing tiles to images:', err);
      showToast('⚠️ Error exporting tiles as images.');
    } finally {
      setIsSlicing(false);
    }
  };

  const activePreset = presets.find((p) => p.id === activePresetId) || presets[0];
  const activePresetDisplayName = activePreset?.name || `Custom ${targetWidth}×${targetHeight}`;

  // =========================================================================
  // NAVBAR HEADER ACTIONS (PORTALED TO TOP NAVBAR)
  // Clean, professional, unified button sizing
  // =========================================================================
  const renderNavbarActions = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      {/* Group 1: Studio Format Presets (Save & Saved Formats) */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        {/* Save / Update Studio Format Button */}
        <button
          type="button"
          onClick={() => handleOpenSaveFormatModal(activeStudioFormat?.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            height: '32px',
            padding: '0 12px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent-primary)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          title={activeStudioFormat ? `Update "${activeStudioFormat.name}" or save as new format` : 'Save whole format to use in Crop & Cut Studio and Workflow'}
        >
          <FiSave size={13} />
          <span>{activeStudioFormat ? 'Save / Update' : 'Save'}</span>
        </button>

        {/* Saved Formats Button (Opens Modal Box) */}
        <button
          type="button"
          onClick={() => setShowSavedFormatsModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            height: '32px',
            padding: '0 12px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
            color: 'var(--accent-primary)',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          title="View and choose from saved formats list"
        >
          <FiScissors size={13} style={{ color: 'var(--accent-primary)' }} />
          <span>Saved Formats</span>
        </button>

        {/* Active Format Indicator Pill */}
        {activeStudioFormat && (
          <div
            onClick={() => setShowSavedFormatsModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 10px',
              borderRadius: '8px',
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.08)',
              border: '1px solid var(--accent-primary)',
              color: 'var(--accent-primary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            title={`Active format: ${activeStudioFormat.name} (${activeStudioFormat.targetWidth}×${activeStudioFormat.targetHeight}). Click to view/edit saved formats.`}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeStudioFormat.name}
            </span>
          </div>
        )}
      </div>

      {/* Group 2: Export File Type & Download (Clean spacing, no group bg) */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        {/* File Type Select Dropdown */}
        <div ref={formatDropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsFormatDropdownOpen((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
            title="Choose export image file extension"
          >
            <span>
              {EXPORT_FORMAT_OPTIONS.find((f) => f.id === exportFormat)?.label || 'Original File Type'}
            </span>
            <FiChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
          </button>

          {isFormatDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                zIndex: 9999,
                width: '165px',
                backgroundColor: isDark ? '#1E2430' : '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                boxShadow: isDark
                  ? '0 10px 25px rgba(0, 0, 0, 0.5)'
                  : '0 10px 25px rgba(0, 0, 0, 0.1)',
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div
                style={{
                  padding: '4px 8px 3px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                File Extension
              </div>
              {EXPORT_FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setExportFormat(opt.id as any);
                    setIsFormatDropdownOpen(false);
                    showToast(`Export format: ${opt.label}`);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor:
                      exportFormat === opt.id ? 'var(--accent-primary-alpha)' : 'transparent',
                    color: exportFormat === opt.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: exportFormat === opt.id ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{opt.label}</span>
                  {exportFormat === opt.id && <FiCheck size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Universal Single Download Button */}
        <div ref={downloadImageDropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsDownloadImageDropdownOpen((prev) => !prev)}
            disabled={!activeImage || isExporting || isSlicing || isDownloadingAllDirect}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 14px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--accent-primary)',
              color: '#FFFFFF',
              cursor: !activeImage || isExporting || isSlicing || isDownloadingAllDirect ? 'not-allowed' : 'pointer',
              opacity: !activeImage ? 0.6 : 1,
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.15s ease',
            }}
            title="Download photo as Image or ZIP"
          >
            {isExporting || isSlicing || isDownloadingAllDirect ? (
              <FiRefreshCw className="animate-spin" size={13} />
            ) : (
              <FiDownload size={13} />
            )}
            <span>
              {isExporting ? 'Zipping...' : isSlicing ? 'Slicing...' : isDownloadingAllDirect ? 'Downloading...' : 'Download Image'}
            </span>
            <FiChevronDown
              size={12}
              style={{
                transform: isDownloadImageDropdownOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>

          {isDownloadImageDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '260px',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '12px',
                boxShadow: '0 12px 28px -4px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)',
                zIndex: 1000,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                padding: '6px',
                gap: '4px',
              }}
            >
              <div
                style={{
                  padding: '6px 10px 4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Select Download Format
              </div>

              {studioMode === 'grid' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDownloadImageDropdownOpen(false);
                      handleSliceAndExportTilesDirect();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f1f5f9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: 'rgba(37,99,235,0.08)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FiImageIcon size={15} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Download as Images</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Save {currentGridLayout.tileCount} tiles directly
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDownloadImageDropdownOpen(false);
                      handleSliceAndExportTiles();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f1f5f9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: 'rgba(16,185,129,0.08)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FiFolder size={15} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Download as ZIP</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Package {currentGridLayout.tileCount} tiles in .zip
                      </span>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDownloadImageDropdownOpen(false);
                      handleDownloadSingle();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f1f5f9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: 'rgba(37,99,235,0.08)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FiImageIcon size={15} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Download as Image</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {activePresetId === 'original' ? 'Original dimensions' : `${targetWidth}×${targetHeight} px`}
                      </span>
                    </div>
                  </button>

                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDownloadImageDropdownOpen(false);
                        handleDownloadAllDirectImages();
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f1f5f9)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: 'rgba(37,99,235,0.08)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FiLayers size={15} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Download All Images</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          Save all {images.length} files directly
                        </span>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsDownloadImageDropdownOpen(false);
                      handleDownloadAllZip();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f1f5f9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: 'rgba(16,185,129,0.08)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FiFolder size={15} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Download as ZIP</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Bundle all {images.length} photos in .zip
                      </span>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Group 3: Utility Capsule (Reset Workspace) */}
      <div>
        <button
          type="button"
          onClick={() => setShowResetConfirmModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            height: '32px',
            padding: '0 12px',
            fontSize: '0.8125rem',
            fontWeight: 500,
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#EF4444';
            e.currentTarget.style.borderColor = '#FCA5A5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          title="Reset workspace to defaults"
        >
          <FiRotateCcw size={13} />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px - 1.5rem)',
        maxHeight: 'calc(100vh - 56px - 1.5rem)',
        width: '100%',
        margin: '0 auto',
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Navbar Actions Portal */}
      {headerActionEl && createPortal(renderNavbarActions(), headerActionEl)}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleUploadImages}
      />
      <input
        ref={addMoreInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleUploadImages}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'fixed',
              top: '68px',
              right: '24px',
              zIndex: 99999,
              backgroundColor: isDark ? '#1E293B' : '#0F172A',
              color: '#F8FAFC',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FiCheck style={{ color: '#22C55E' }} />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Studio Viewport (2-Column Grid) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.45fr) minmax(360px, 420px)',
          gap: '1rem',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* ======================================================== */}
        {/* FIRST COLUMN (LEFT): 3 SEPARATE SESSIONS                  */}
        {/* ======================================================== */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* ======================================================== */}
          {/* 1. HEADER SESSION: CANVAS VIEWPORT & PHOTO META CONTROLS  */}
          {/* ======================================================== */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1.25rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              flexShrink: 0,
              minHeight: '52px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            {activeImage ? (
              <>
                {/* Active image metadata & transformation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--accent-primary-alpha)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FiImageIcon size={15} />
                  </div>

                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '260px',
                    }}
                    title={activeImage.name}
                  >
                    {activeImage.name}
                  </span>

                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>•</span>

                  {studioMode === 'grid' ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {currentGridLayout.name} ({currentGridLayout.tileCount} Tiles • {currentTileWidth} × {currentTileHeight} px)
                    </span>
                  ) : studioMode === 'watermark' ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {activeImage.width || 1536} × {activeImage.height || 1024} px
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ color: watermarkConfig.enabled ? '#22C55E' : 'var(--text-muted)', fontWeight: 600 }}>
                        {watermarkConfig.enabled ? 'Watermark Active' : 'Watermark Off'}
                      </span>
                    </div>
                  ) : activePresetId === 'original' ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {activeImage.width || 1536} × {activeImage.height || 1024} px <span style={{ color: 'var(--text-muted)' }}>(Original)</span>
                    </span>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {activeImage.width || 1536} × {activeImage.height || 1024} px
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {targetWidth} × {targetHeight} px
                      </span>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.75rem' }}>
                        ({activePreset?.aspect || 'Custom'})
                      </span>
                    </div>
                  )}
                </div>

                {/* Header Action controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteImage(activeImage.id, e)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0 12px',
                      height: '32px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#EF4444';
                      e.currentTarget.style.borderColor = isDark ? '#EF4444' : '#FCA5A5';
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF';
                    }}
                    title="Remove this photo from batch"
                  >
                    <FiTrash2 size={13} />
                    <span>Remove</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Empty State Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--accent-primary-alpha)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FiLayers size={15} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Studio Canvas
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      • Preview & Transformation Area
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0 14px',
                      height: '32px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'var(--bg-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF';
                    }}
                  >
                    <FiUploadCloud size={14} />
                    <span>Upload Photos</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ======================================================== */}
          {/* 2. BODY SESSION: CENTRAL WORKSPACE CANVAS                 */}
          {/* ======================================================== */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Central Canvas Display */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files) {
                  processFiles(e.dataTransfer.files);
                }
              }}
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                width: '100%',
                height: '100%',
                backgroundColor: isDark ? '#0C1017' : '#F8FAFC',
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '28px',
                boxSizing: 'border-box',
                backgroundImage: isDark
                  ? 'linear-gradient(45deg, rgba(255,255,255,0.035) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.035) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.035) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.035) 75%)'
                  : 'linear-gradient(45deg, rgba(0,0,0,0.035) 25%, transparent 25%), linear-gradient(-45deg, rgba(0,0,0,0.035) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.035) 75%), linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.035) 75%)',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
                border: isDragOver
                  ? '2px dashed var(--accent-primary)'
                  : 'none',
                boxShadow: isDark
                  ? 'inset 0 2px 8px rgba(0, 0, 0, 0.4)'
                  : 'inset 0 1px 4px rgba(0, 0, 0, 0.04)',
                transition: 'border 0.2s ease, background-color 0.2s ease',
              }}
          >

            {/* Empty State Dropzone */}
            {images.length === 0 ? (
              <div
                style={{
                  width: '90%',
                  maxWidth: '520px',
                  padding: '3rem 2.5rem',
                  borderRadius: '24px',
                  border: isDark
                    ? (isDragOver ? '2px dashed var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.12)')
                    : (isDragOver ? '2px dashed var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.75)'),
                  backgroundColor: isDark
                    ? (isDragOver ? 'rgba(30, 41, 59, 0.85)' : 'rgba(15, 23, 42, 0.65)')
                    : (isDragOver ? 'rgba(239, 246, 255, 0.85)' : 'rgba(255, 255, 255, 0.68)'),
                  backdropFilter: 'blur(24px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                  boxShadow: isDark
                    ? '0 24px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                    : '0 20px 48px -12px rgba(15, 23, 42, 0.08), 0 2px 10px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                  transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {/* Floating Icon with Soft Glow Ring */}
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(99, 102, 241, 0.12))'
                      : 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(99, 102, 241, 0.06))',
                    border: isDark
                      ? '1px solid rgba(96, 165, 250, 0.3)'
                      : '1px solid rgba(37, 99, 235, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                    fontSize: '1.5rem',
                    boxShadow: isDark
                      ? '0 8px 20px -4px rgba(37, 99, 235, 0.35)'
                      : '0 8px 18px -4px rgba(37, 99, 235, 0.22)',
                  }}
                >
                  <FiUploadCloud />
                </div>

                <div>
                  <h3
                    style={{
                      fontSize: '1.1875rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: '0 0 6px 0',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {studioMode === 'standard' ? 'Upload Images to Standard Crop' : 'Upload Image to Cut & Split'}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      maxWidth: '380px',
                      lineHeight: 1.55,
                    }}
                  >
                    {studioMode === 'standard'
                      ? 'Drag and drop listing images onto the canvas, or browse files from your computer to crop.'
                      : 'Upload a new photo for this Social Grid Split session (independent from Standard Crop).'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0 22px',
                      height: '40px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, var(--accent-primary) 0%, #1D4ED8 100%)',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.32), 0 1px 2px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.42)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.32), 0 1px 2px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    <FiImageIcon size={15} />
                    <span>{studioMode === 'standard' ? 'Choose Images' : 'Upload Image to Cut'}</span>
                  </button>

                  {studioMode === 'grid' && standardImages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyFromStandardToGrid}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 18px',
                        height: '40px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        borderRadius: '10px',
                        border: isDark
                          ? '1px solid rgba(255, 255, 255, 0.15)'
                          : '1px solid rgba(0, 0, 0, 0.12)',
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : '#FFFFFF',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.color = 'var(--accent-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      title="Copy the selected photo from Standard Crop into this Cut session"
                    >
                      <FiLayers size={14} />
                      <span>Use Standard Crop Photo</span>
                    </button>
                  )}

                  {studioMode === 'standard' && (
                    <button
                      type="button"
                      onClick={handleLoadSamples}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 20px',
                        height: '40px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        borderRadius: '10px',
                        border: isDark
                          ? '1px solid rgba(255, 255, 255, 0.12)'
                          : '1px solid rgba(0, 0, 0, 0.12)',
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(255, 255, 255, 0.85)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                        transition: 'all 0.18s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.backgroundColor = isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : '#FFFFFF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.backgroundColor = isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(255, 255, 255, 0.85)';
                      }}
                    >
                      <span>Load Sample Photo</span>
                    </button>
                  )}
                </div>

                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Supported formats: JPG, PNG, WEBP, HEIC (Auto-converted for preview & export).
                </span>
              </div>
            ) : activeImage ? (
              <>

                <motion.div
                  layout
                  transition={{
                    layout: { duration: 0.35, ease: [0.25, 1, 0.5, 1] },
                  }}
                  style={{
                    position: 'relative',
                    maxWidth: 'calc(100% - 56px)',
                    maxHeight: 'calc(100% - 56px)',
                    aspectRatio: studioMode === 'grid'
                      ? (activeImage.width && activeImage.height
                          ? `${activeImage.width} / ${activeImage.height}`
                          : `${targetWidth} / ${targetHeight}`)
                      : (activePresetId === 'original' && activeImage.width && activeImage.height
                          ? `${activeImage.width} / ${activeImage.height}`
                          : `${targetWidth} / ${targetHeight}`),
                    borderRadius: 0,
                    overflow: isCutSpread ? 'visible' : 'hidden',
                    border: 'none',
                    boxShadow: isCutSpread
                      ? 'none'
                      : (isDark
                        ? '0 16px 40px rgba(0, 0, 0, 0.6)'
                        : '0 14px 32px -4px rgba(0, 0, 0, 0.15)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: fitMode === 'contain' ? (isDark ? '#0F172A' : '#1E293B') : 'transparent',
                  }}
                >
                  {/* Base In-Flow Image: Guarantees motion.div maintains proper intrinsic sizing and never collapses */}
                  <img
                    src={activeImage.originalUrl || activeImage.url}
                    alt={activeImage.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.opacity = '0';
                    }}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: '100%',
                      height: '100%',
                      borderRadius: 0,
                      border: 'none',
                      objectFit: fitMode === 'cover' ? 'cover' : 'contain',
                      objectPosition: POSITION_CSS_MAP[focusPosition] || 'center center',
                      transform: `scale(${cropZoom})`,
                      transformOrigin: POSITION_CSS_MAP[focusPosition] || 'center center',
                      display: 'block',
                      visibility: studioMode === 'grid' ? 'hidden' : 'visible',
                      transition: 'object-position 0.2s ease, transform 0.2s ease',
                    }}
                  />

                  {/* Real-time Watermark Overlay for Live Studio Preview */}
                  {(studioMode === 'standard' || studioMode === 'watermark') && watermarkConfig.enabled && !hideWatermarkPreview && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        overflow: 'hidden',
                        zIndex: 10,
                      }}
                    >
                      {/* Image Frame / Border overlay */}
                      {watermarkConfig.borderStyle && watermarkConfig.borderStyle !== 'none' && (
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 12 }}>
                          {watermarkConfig.borderStyle === 'solid-thin-white' && (
                            <div style={{ position: 'absolute', inset: '10px', border: '2px solid rgba(255, 255, 255, 0.9)' }} />
                          )}
                          {watermarkConfig.borderStyle === 'solid-dark' && (
                            <div style={{ position: 'absolute', inset: '10px', border: '3.5px solid rgba(15, 23, 42, 0.92)' }} />
                          )}
                          {watermarkConfig.borderStyle === 'luxury-gold' && (
                            <div style={{ position: 'absolute', inset: '10px', border: '2.5px solid #EAB308' }}>
                              <div style={{ position: 'absolute', inset: '4px', border: '1px solid rgba(234, 179, 8, 0.45)' }} />
                            </div>
                          )}
                          {watermarkConfig.borderStyle === 'modern-accent' && (
                            <div style={{ position: 'absolute', inset: '10px', border: '2.5px solid #3B82F6', borderRadius: '4px' }} />
                          )}
                        </div>
                      )}

                      {/* Content Item Renderer */}
                      {(() => {
                        const renderItemContent = () => {
                          if (watermarkConfig.type === 'logo' && watermarkConfig.logoUrl) {
                            return (
                              <img
                                src={watermarkConfig.logoUrl}
                                alt={watermarkConfig.logoName || 'Watermark'}
                                style={{
                                  width: `${watermarkConfig.scale * 3.8}px`,
                                  maxWidth: `${watermarkConfig.scale * 2.2}vw`,
                                  height: 'auto',
                                  display: 'block',
                                  userSelect: 'none',
                                }}
                              />
                            );
                          }
                          if (watermarkConfig.type === 'text' && watermarkConfig.text) {
                            return (
                              <span
                                style={{
                                  color: watermarkConfig.textColor || '#FFFFFF',
                                  fontSize: `clamp(13px, ${(watermarkConfig.fontSize || 24) * 0.75}px, 32px)`,
                                  fontWeight: watermarkConfig.fontWeight || '600',
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                  whiteSpace: 'nowrap',
                                  textShadow: watermarkConfig.hasShadow ? '0 2px 4px rgba(0, 0, 0, 0.85)' : 'none',
                                  userSelect: 'none',
                                  padding: '2px 6px',
                                }}
                              >
                                {watermarkConfig.text
                                  .replace(/{project}/gi, activeImage?.name.replace(/\.[^/.]+$/, '') || 'Condo Listing')
                                  .replace(/{price}/gi, '฿ 5.2M')
                                  .replace(/{phone}/gi, '081-234-5678')
                                  .replace(/{line}/gi, '@estatebangkok')}
                              </span>
                            );
                          }
                          return null;
                        };

                        const layout = watermarkConfig.layoutMode || 'single';
                        const rot = watermarkConfig.rotation || 0;
                        const op = watermarkConfig.opacity / 100;

                        if (layout === 'repeat-grid') {
                          const rows = Math.max(1, Math.min(8, watermarkConfig.rows || 2));
                          const cols = Math.max(1, Math.min(12, watermarkConfig.columns || 6));
                          const gap = watermarkConfig.gapSpacing ?? 8;
                          const usableW = 100 - 2 * gap;
                          const usableH = 100 - 2 * gap;
                          const elements: React.ReactNode[] = [];
                          for (let r = 0; r < rows; r++) {
                            const topPct = rows === 1 ? 50 : gap + (r / (rows - 1)) * usableH;
                            const rowOffset = (watermarkConfig.offsetAlternateRows && r % 2 === 1) ? (usableW / cols) * 0.5 : 0;
                            for (let c = 0; c < cols; c++) {
                              const leftPct = cols === 1 ? 50 : gap + (c / (cols - 1)) * usableW + rowOffset;
                              elements.push(
                                <div
                                  key={`grid-${r}-${c}`}
                                  style={{
                                    position: 'absolute',
                                    top: `${topPct}%`,
                                    left: `${leftPct}%`,
                                    transform: `translate(-50%, -50%) rotate(${rot}deg)`,
                                    opacity: op,
                                    filter: watermarkConfig.hasShadow ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.75))' : 'none',
                                    pointerEvents: 'none',
                                  }}
                                >
                                  {renderItemContent()}
                                </div>
                              );
                            }
                          }
                          return elements;
                        }

                        if (layout === 'top-bottom') {
                          const cols = Math.max(1, Math.min(12, watermarkConfig.columns || 6));
                          const gap = watermarkConfig.gapSpacing ?? 8;
                          const usableW = 100 - 2 * gap;
                          const elements: React.ReactNode[] = [];
                          [gap, 100 - gap].forEach((topPct, rIdx) => {
                            for (let c = 0; c < cols; c++) {
                              const leftPct = cols === 1 ? 50 : gap + (c / (cols - 1)) * usableW;
                              elements.push(
                                <div
                                  key={`tb-${rIdx}-${c}`}
                                  style={{
                                    position: 'absolute',
                                    top: `${topPct}%`,
                                    left: `${leftPct}%`,
                                    transform: `translate(-50%, -50%) rotate(${rot}deg)`,
                                    opacity: op,
                                    filter: watermarkConfig.hasShadow ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.75))' : 'none',
                                    pointerEvents: 'none',
                                  }}
                                >
                                  {renderItemContent()}
                                </div>
                              );
                            }
                          });
                          return elements;
                        }

                        // Default: Single mark anchored
                        const anchorPos = getWatermarkOverlayStyle(watermarkConfig.position, watermarkConfig.margin);
                        return (
                          <div
                            style={{
                              position: 'absolute',
                              ...anchorPos,
                              transform: `${anchorPos.transform && anchorPos.transform !== 'none' ? anchorPos.transform + ' ' : ''}rotate(${rot}deg)`,
                              opacity: op,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              filter: watermarkConfig.hasShadow ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.75))' : 'none',
                              maxWidth: '92%',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {renderItemContent()}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {studioMode === 'grid' && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: isCutting ? 'none' : 'auto',
                      }}
                    >
                      {currentGridLayout.tiles.map((tile) => {
                        const isSelected = selectedTileId === tile.id;
                        const tileFocusKey = tileFocusMap[tile.id] || 'center';
                        const shortFocus = getShortFocusLabel(tileFocusKey);

                        // Calculate outward spread vector from center
                        const cx = tile.x + tile.w / 2;
                        const cy = tile.y + tile.h / 2;
                        const vx = cx - 0.5;
                        const vy = cy - 0.5;
                        const dx = vx !== 0 ? Math.sign(vx) : (tile.x === 0 ? -1 : 1);
                        const dy = vy !== 0 ? Math.sign(vy) : (tile.y === 0 ? -1 : 1);
                        const spreadX = isCutSpread ? dx * 24 : 0;
                        const spreadY = isCutSpread ? dy * 20 : 0;

                        return (
                          <div
                            key={tile.id}
                            onClick={() => {
                              if (!isCutSpread) {
                                setSelectedTileId(tile.id);
                              }
                            }}
                            style={{
                              position: 'absolute',
                              left: `${tile.x * 100}%`,
                              top: `${tile.y * 100}%`,
                              width: `${tile.w * 100}%`,
                              height: `${tile.h * 100}%`,
                              overflow: 'hidden',
                              borderRadius: isCutSpread ? '8px' : 0,
                              boxShadow: isCutSpread
                                ? (isDark
                                  ? '0 18px 38px rgba(0, 0, 0, 0.7), 0 0 0 1.5px var(--accent-primary)'
                                  : '0 14px 32px rgba(0, 0, 0, 0.22), 0 0 0 1.5px var(--accent-primary)')
                                : 'none',
                              transform: `translate(${spreadX}px, ${spreadY}px) scale(${isCutSpread ? 0.96 : 1})`,
                              transition: 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease, border-radius 0.4s ease',
                              cursor: isCutSpread ? 'default' : 'pointer',
                              zIndex: isCutSpread ? 5 : 1,
                            }}
                            title={isCutSpread ? `Tile ${tile.id} (${tile.label})` : `Click to focus Tile ${tile.id}`}
                          >
                            {/* Inner cropped image slice positioned to perfectly match the sub-region */}
                            <div
                              style={{
                                position: 'absolute',
                                left: `${-tile.x * (100 / tile.w)}%`,
                                top: `${-tile.y * (100 / tile.h)}%`,
                                width: `${(1 / tile.w) * 100}%`,
                                height: `${(1 / tile.h) * 100}%`,
                              }}
                            >
                              <img
                                src={activeImage.originalUrl || activeImage.url}
                                alt={activeImage.name}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.opacity = '0';
                                }}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: 0,
                                  border: 'none',
                                  objectFit: fitMode === 'cover' ? 'cover' : 'contain',
                                  objectPosition: POSITION_CSS_MAP[tileFocusKey] || POSITION_CSS_MAP[focusPosition] || 'center center',
                                  transform: `scale(${cropZoom})`,
                                  transformOrigin: POSITION_CSS_MAP[tileFocusKey] || POSITION_CSS_MAP[focusPosition] || 'center center',
                                  display: 'block',
                                  transition: 'object-position 0.2s ease, transform 0.2s ease',
                                }}
                              />
                            </div>

                            {/* Sliced Badge when spread apart */}
                            {isCutSpread && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  left: '8px',
                                  backgroundColor: 'rgba(0, 0, 0, 0.78)',
                                  backdropFilter: 'blur(6px)',
                                  color: '#FFFFFF',
                                  padding: '3px 8px',
                                  borderRadius: '5px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  border: '1px solid rgba(255, 255, 255, 0.2)',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                                  zIndex: 10,
                                }}
                              >
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>Tile {tile.id}</span>
                                <span style={{ opacity: 0.85, fontSize: '0.625rem' }}>({currentTileWidth}×{currentTileHeight})</span>
                              </div>
                            )}

                            {/* Normal Editing Guides when not spread & not hidden */}
                            {!isCutSpread && !hideGuides && (
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  border: isSelected
                                    ? '1.5px dashed var(--accent-primary)'
                                    : '1px dashed var(--accent-primary)',
                                  backgroundColor: isSelected
                                    ? 'var(--accent-primary-alpha)'
                                    : 'transparent',
                                  boxSizing: 'border-box',
                                  pointerEvents: 'none',
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '8px',
                                    left: '8px',
                                    backgroundColor: isSelected
                                      ? 'rgba(0, 0, 0, 0.88)'
                                      : 'rgba(0, 0, 0, 0.72)',
                                    backdropFilter: 'blur(4px)',
                                    color: '#FFFFFF',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.6875rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    border: isSelected
                                      ? '1px solid var(--accent-primary)'
                                      : '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
                                  }}
                                >
                                  <span>
                                    {tile.id} • {tile.label}
                                  </span>
                                  <span style={{ color: 'var(--accent-primary)', fontSize: '0.625rem', fontWeight: 700 }}>
                                    {shortFocus}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Animated Scissors Cutting Overlay */}
                      {isCutting && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 20,
                            pointerEvents: 'none',
                          }}
                        >
                          {/* Seam Cut Laser Lines for Layout */}
                          {currentGridLayout.id === 'two-squares' && (
                            <div
                              style={{
                                position: 'absolute',
                                left: '50%',
                                top: '0%',
                                width: '2px',
                                height: '100%',
                                background: 'linear-gradient(to bottom, #60A5FA, #FFFFFF, #60A5FA)',
                                boxShadow: '0 0 14px #3B82F6, 0 0 28px #60A5FA',
                                animation: 'cutLinePulse 0.75s ease-in-out infinite',
                              }}
                            />
                          )}

                          {currentGridLayout.id === 'three-squares' && (
                            <>
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '0%',
                                  top: '52%',
                                  width: '100%',
                                  height: '2px',
                                  background: 'linear-gradient(to right, #60A5FA, #FFFFFF, #60A5FA)',
                                  boxShadow: '0 0 14px #3B82F6, 0 0 28px #60A5FA',
                                  animation: 'cutLinePulse 0.75s ease-in-out infinite',
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '50%',
                                  top: '52%',
                                  width: '2px',
                                  height: '48%',
                                  background: 'linear-gradient(to bottom, #60A5FA, #FFFFFF, #60A5FA)',
                                  boxShadow: '0 0 14px #3B82F6, 0 0 28px #60A5FA',
                                  animation: 'cutLinePulse 0.75s ease-in-out infinite',
                                }}
                              />
                            </>
                          )}

                          {(currentGridLayout.id === 'four-squares' || currentGridLayout.id === 'five-squares' || currentGridLayout.id === 'six-squares') && (
                            <>
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '0%',
                                  top: currentGridLayout.id === 'four-squares' ? '50%' : '55%',
                                  width: '100%',
                                  height: '2px',
                                  background: 'linear-gradient(to right, #60A5FA, #FFFFFF, #60A5FA)',
                                  boxShadow: '0 0 14px #3B82F6, 0 0 28px #60A5FA',
                                  animation: 'cutLinePulse 0.75s ease-in-out infinite',
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '50%',
                                  top: '0%',
                                  width: '2px',
                                  height: '100%',
                                  background: 'linear-gradient(to bottom, #60A5FA, #FFFFFF, #60A5FA)',
                                  boxShadow: '0 0 14px #3B82F6, 0 0 28px #60A5FA',
                                  animation: 'cutLinePulse 0.75s ease-in-out infinite',
                                }}
                              />
                            </>
                          )}

                          {/* Animated Snipping Scissors Badge */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: '0%',
                              transform: 'translate(-50%, -50%)',
                              animation: 'scissorSnipMove 0.75s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              backgroundColor: '#FFFFFF',
                              color: 'var(--accent-primary)',
                              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4), 0 0 0 3px var(--accent-primary)',
                              zIndex: 25,
                            }}
                          >
                            <FiScissors size={20} style={{ transform: 'rotate(-45deg)' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <FiAlertCircle size={32} style={{ marginBottom: '8px' }} />
                <p style={{ fontSize: '0.875rem' }}>No photo selected</p>
              </div>
            )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* 3. FOOTER SESSION: BATCH IMAGES & FILMSTRIP               */}
          {/* ======================================================== */}
          <div
            style={{
              flexShrink: 0,
              padding: '0.875rem 1.25rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {studioMode === 'standard' ? 'Batch Images' : 'Cut Images'}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-surface-hover)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {images.length}
                </span>
                {images.length === 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                    {studioMode === 'standard' ? '(Empty queue)' : '(Upload photo to cut)'}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => addMoreInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 14px',
                    height: '34px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'var(--bg-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF';
                  }}
                >
                  <FiPlus size={14} />
                  <span>Add More</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={images.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 14px',
                    height: '34px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: images.length === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                    cursor: images.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: images.length === 0 ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (images.length > 0) {
                      e.currentTarget.style.color = '#EF4444';
                      e.currentTarget.style.borderColor = isDark ? '#EF4444' : '#FCA5A5';
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = images.length === 0 ? 'var(--text-muted)' : 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <FiTrash2 size={13} />
                  <span>Clear All</span>
                </button>
              </div>
            </div>

            {/* Thumbnail Row */}
            {images.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  overflowX: 'auto',
                  paddingTop: '6px',
                  paddingBottom: '16px',
                  paddingLeft: '6px',
                  paddingRight: '6px',
                  alignItems: 'center',
                }}
              >
              {images.map((img, idx) => {
                const isSelected = selectedImageIndex === idx;
                return (
                  <div
                    key={img.id}
                    onClick={() => {
                      setSelectedImageIndex(idx);
                      if (activePresetId === 'original' && img.width && img.height) {
                        setTargetWidth(img.width);
                        setTargetHeight(img.height);
                      }
                    }}
                    onMouseEnter={() => setHoveredImageIndex(idx)}
                    onMouseLeave={() => setHoveredImageIndex(null)}
                    style={{
                      position: 'relative',
                      display: 'block',
                      borderRadius: '10px',
                      border: isSelected
                        ? '2.5px solid var(--accent-primary)'
                        : (isDark ? '1.5px solid rgba(255, 255, 255, 0.12)' : '1.5px solid var(--border-color)'),
                      boxShadow: isSelected
                        ? '0 4px 16px rgba(37, 99, 235, 0.35)'
                        : '0 1px 3px rgba(0, 0, 0, 0.08)',
                      backgroundColor: '#0F172A',
                      cursor: 'pointer',
                      flexShrink: 0,
                      width: '110px',
                      height: '74px',
                      overflow: 'hidden',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                      transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {/* Fallback card underneath in case of missing or loading blob */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        backgroundColor: '#1E293B',
                        color: 'rgba(255, 255, 255, 0.65)',
                        padding: '6px',
                        textAlign: 'center',
                        userSelect: 'none',
                      }}
                    >
                      <FiFolder style={{ fontSize: '1.25rem', opacity: 0.8 }} />
                      <span
                        style={{
                          fontSize: '0.625rem',
                          maxWidth: '90px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#CBD5E1',
                        }}
                      >
                        {img.name}
                      </span>
                    </div>

                    <img
                      src={img.originalUrl || img.url}
                      alt={img.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scale(1.06)',
                        transformOrigin: 'center center',
                        display: 'block',
                      }}
                    />

                    {/* Hover Actions - Only show when hovered */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: hoveredImageIndex === idx ? 1 : 0,
                        pointerEvents: hoveredImageIndex === idx ? 'auto' : 'none',
                        transform: hoveredImageIndex === idx ? 'scale(1)' : 'scale(0.85)',
                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                        zIndex: 5,
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleDeleteImage(img.id, e)}
                        title="Remove photo"
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(15, 23, 42, 0.85)',
                          backdropFilter: 'blur(6px)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#EF4444';
                          e.currentTarget.style.borderColor = '#EF4444';
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <FiX size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECOND COLUMN (RIGHT): ✂ CROP & CUT CONTROLS             */}
        {/* Exact Layout & Sessions from Screenshots 1 & 2           */}
        {/* ======================================================== */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.25rem',
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Header: Dynamic Studio Title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {studioMode === 'watermark' ? (
                <FiShield style={{ color: 'var(--accent-primary)', fontSize: '1rem' }} />
              ) : (
                <FiScissors style={{ color: 'var(--accent-primary)', fontSize: '1rem' }} />
              )}
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {studioMode === 'watermark' ? 'Watermark Studio' : 'Crop & Cut Studio'}
              </span>
            </div>
          </div>

          {/* Mode Switcher Tabs: [ Standard Crop ] [ Social Grid Split ] [ Watermark ] */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              padding: '3px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-surface-hover)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setStudioMode('standard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                height: '34px',
                borderRadius: '6px',
                border: studioMode === 'standard'
                  ? (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)')
                  : 'none',
                backgroundColor: studioMode === 'standard'
                  ? (isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF')
                  : 'transparent',
                color: studioMode === 'standard' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: studioMode === 'standard'
                  ? (isDark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.08)')
                  : 'none',
                fontSize: '0.75rem',
                fontWeight: studioMode === 'standard' ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              title="Standard Aspect Ratio & Dimensions Crop"
            >
              <FiMaximize2 size={12} />
              <span>Standard Crop</span>
            </button>

            <button
              type="button"
              onClick={() => setStudioMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                height: '34px',
                borderRadius: '6px',
                border: studioMode === 'grid'
                  ? (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)')
                  : 'none',
                backgroundColor: studioMode === 'grid'
                  ? (isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF')
                  : 'transparent',
                color: studioMode === 'grid' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: studioMode === 'grid'
                  ? (isDark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.08)')
                  : 'none',
                fontSize: '0.75rem',
                fontWeight: studioMode === 'grid' ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              title="Social Grid Split & Multi-Tile Slicing"
            >
              <FiGrid size={12} />
              <span>Grid Split</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStudioMode('watermark');
                // Ensure watermark is enabled when entering Watermark Studio
                if (!watermarkConfig.enabled) {
                  setWatermarkConfig((p) => ({ ...p, enabled: true }));
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                height: '34px',
                borderRadius: '6px',
                border: studioMode === 'watermark'
                  ? (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)')
                  : 'none',
                backgroundColor: studioMode === 'watermark'
                  ? (isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF')
                  : 'transparent',
                color: studioMode === 'watermark' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: studioMode === 'watermark'
                  ? (isDark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.08)')
                  : 'none',
                fontSize: '0.75rem',
                fontWeight: studioMode === 'watermark' ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              title="Watermark Logo, Text & Patterns Session"
            >
              <FiShield size={12} />
              <span>Watermark</span>
            </button>
          </div>

          {studioMode === 'standard' ? (
            /* ============================================================== */
            /* MODE 1: STANDARD RESOLUTION CONTROLS                          */
            /* ============================================================== */
            <>
              {/* Card 1: Aspect Ratio & Target Dimensions */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Target Aspect Ratio
                  </span>
                </div>

                {/* None (No Crop) Featured Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActivePresetId('original');
                    if (activeImage) {
                      setTargetWidth(activeImage.width || 1200);
                      setTargetHeight(activeImage.height || 1200);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: activePresetId === 'original'
                      ? '1px solid var(--accent-primary)'
                      : '1px solid var(--border-color)',
                    backgroundColor: activePresetId === 'original'
                      ? 'var(--accent-primary-alpha)'
                      : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF'),
                    color: activePresetId === 'original' ? 'var(--accent-primary)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: activePresetId === 'original' ? 700 : 600 }}>
                      None
                    </span>
                    <span style={{ fontSize: '0.625rem', color: activePresetId === 'original' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                      {activeImage ? `${activeImage.width || 1536} × ${activeImage.height || 1024} px • Native Resolution` : 'Native Resolution'}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: activePresetId === 'original' ? 'var(--accent-primary)' : (isDark ? 'rgba(255,255,255,0.08)' : 'var(--bg-main)'),
                      color: activePresetId === 'original' ? '#FFFFFF' : 'var(--text-secondary)',
                    }}
                  >
                    None
                  </span>
                </button>

                {/* Grid of Aspect Ratios (Standard + Saved Custom Ratios) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '6px',
                  }}
                >
                  {presets.filter(p => p.id !== 'original').map((preset) => {
                    const isSelected = activePresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className="preset-item-wrapper"
                        style={{ position: 'relative' }}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '52px',
                            borderRadius: '8px',
                            border: isSelected
                              ? '1.5px solid var(--accent-primary)'
                              : '1px solid var(--border-color)',
                            backgroundColor: isSelected
                              ? 'var(--accent-primary-alpha)'
                              : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF'),
                            cursor: 'pointer',
                            padding: '4px 6px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.8125rem',
                              fontWeight: isSelected ? 700 : 600,
                              color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                            }}
                          >
                            {preset.aspect}
                          </span>
                          <span
                            style={{
                              fontSize: '0.625rem',
                              color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                              marginTop: '1px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '100%',
                            }}
                          >
                            {preset.isCustom
                              ? `${preset.width}×${preset.height}`
                              : preset.name.replace(/^(1:1|4:5|16:9|4:3|9:16|3:2)\s*/, '')}
                          </span>
                        </button>

                        {/* Remove button for saved custom presets - Hover only, inside top-right corner */}
                        {preset.isCustom && (
                          <button
                            type="button"
                            className="preset-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePreset(preset.id);
                            }}
                            title="Remove custom ratio preset"
                            style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: 'none',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.18)' : '#E2E8F0',
                              color: isDark ? '#E2E8F0' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              zIndex: 2,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#EF4444';
                              e.currentTarget.style.color = '#FFFFFF';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.18)' : '#E2E8F0';
                              e.currentTarget.style.color = isDark ? '#E2E8F0' : '#64748B';
                            }}
                          >
                            <FiX size={10} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Compact Custom Dimension Input Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '4px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flex: 1,
                      height: '34px',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                      padding: '0 8px',
                    }}
                  >
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginRight: '4px' }}>W</span>
                    <input
                      type="number"
                      min="100"
                      max="8000"
                      value={targetWidth}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v > 0) {
                          setTargetWidth(v);
                          setActivePresetId('custom');
                        }
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    />
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>px</span>
                  </div>

                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>×</span>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flex: 1,
                      height: '34px',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                      padding: '0 8px',
                    }}
                  >
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginRight: '4px' }}>H</span>
                    <input
                      type="number"
                      min="100"
                      max="8000"
                      value={targetHeight}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v > 0) {
                          setTargetHeight(v);
                          setActivePresetId('custom');
                        }
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    />
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>px</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCurrentAsProfile}
                    style={{
                      height: '34px',
                      padding: '0 12px',
                      borderRadius: '7px',
                      border: '1px solid var(--accent-primary)',
                      backgroundColor: 'var(--accent-primary-alpha)',
                      color: 'var(--accent-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    title="Add custom size to aspect ratio presets"
                  >
                    <FiPlus size={13} />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Framing & Focal Anchor */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                {/* Framing Style Segmented Toggle */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Framing Style
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '4px',
                      padding: '3px',
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'var(--bg-surface-hover)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setFitMode('cover')}
                      style={{
                        height: '30px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: fitMode === 'cover' ? 'var(--accent-primary)' : 'transparent',
                        color: fitMode === 'cover' ? '#FFFFFF' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: fitMode === 'cover' ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Fill (Cover)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFitMode('contain')}
                      style={{
                        height: '30px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: fitMode === 'contain' ? 'var(--accent-primary)' : 'transparent',
                        color: fitMode === 'contain' ? '#FFFFFF' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: fitMode === 'contain' ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Fit (Contain)
                    </button>
                  </div>
                </div>

                {/* Focal Anchor Section */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '6px',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Focal Anchor
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {POSITION_LABELS[focusPosition]}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <SwitchToggle
                        checked={applyToAllImages}
                        onChange={(val) => setApplyToAllImages(val)}
                        activeColor="var(--accent-primary)"
                        isDark={isDark}
                      />
                      <span
                        onClick={() => setApplyToAllImages((prev) => !prev)}
                        style={{
                          fontSize: '0.6875rem',
                          color: applyToAllImages ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          fontWeight: applyToAllImages ? 600 : 400,
                          transition: 'color 0.15s ease',
                        }}
                      >
                        Apply to all batch
                      </span>
                    </div>
                  </div>

                  {/* 3x3 Dot Matrix Pad */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 20px)',
                      gridTemplateRows: 'repeat(3, 20px)',
                      gap: '6px',
                      padding: '6px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.35)' : 'var(--bg-surface-hover)',
                      border: '1px solid var(--border-color)',
                      boxShadow: isDark ? 'inset 0 1px 3px rgba(0,0,0,0.4)' : 'inset 0 1px 2px rgba(0,0,0,0.04)',
                    }}
                  >
                    {NINE_POSITIONS.map((pos) => {
                      const isActive = focusPosition === pos;
                      return (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setFocusPosition(pos)}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            border: isActive
                              ? '1px solid var(--accent-primary)'
                              : (isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)'),
                            backgroundColor: isActive
                              ? 'var(--accent-primary)'
                              : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF'),
                            boxShadow: isActive
                              ? '0 0 8px var(--accent-primary-alpha, rgba(37, 99, 235, 0.35))'
                              : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            transition: 'all 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.borderColor = 'var(--accent-primary)';
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.14)' : 'var(--bg-surface)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)';
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF';
                            }
                          }}
                          title={`Anchor: ${POSITION_LABELS[pos]}`}
                        >
                          {isActive && (
                            <span
                              style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                backgroundColor: '#FFFFFF',
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Card 3: Zoom */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Zoom
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {Math.round(cropZoom * 100)}%
                  </span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  value={cropZoom}
                  onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '2px' }}>
                  {[
                    { label: 'Fit', val: 1 },
                    { label: '125%', val: 1.25 },
                    { label: '150%', val: 1.5 },
                    { label: '200%', val: 2 },
                  ].map((z) => {
                    const isSelected = Math.abs(cropZoom - z.val) < 0.03;
                    return (
                      <button
                        key={z.val}
                        type="button"
                        onClick={() => setCropZoom(z.val)}
                        style={{
                          height: '28px',
                          fontSize: '0.6875rem',
                          fontWeight: isSelected ? 600 : 500,
                          borderRadius: '6px',
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          backgroundColor: isSelected
                            ? 'var(--accent-primary-alpha)'
                            : (isDark ? 'transparent' : '#FFFFFF'),
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        {z.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 8: Quick Watermark Status Card */}
              <div
                onClick={() => setStudioMode('watermark')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Switch to Watermark Studio"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiShield size={14} style={{ color: watermarkConfig.enabled ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Watermark Studio
                  </span>
                  <span
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      padding: '1.5px 7px',
                      borderRadius: '9999px',
                      backgroundColor: watermarkConfig.enabled ? 'rgba(34, 197, 94, 0.16)' : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'),
                      color: watermarkConfig.enabled ? '#4ADE80' : 'var(--text-muted)',
                      border: watermarkConfig.enabled ? '1px solid rgba(34, 197, 94, 0.3)' : 'none',
                    }}
                  >
                    {watermarkConfig.enabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  Configure →
                </span>
              </div>
            </>
          ) : studioMode === 'grid' ? (
            /* ============================================================== */
            /* MODE 2: SOCIAL GRID SPLIT CONTROLS                            */
            /* ============================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Card 1: Watermark Switch & Clean Preview Button */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Use Watermark
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {useWatermarkOnTiles ? 'Apply watermark to slices' : 'Clean slices (no watermark)'}
                    </div>
                  </div>
                  <SwitchToggle
                    checked={useWatermarkOnTiles}
                    onChange={(val) => setUseWatermarkOnTiles(val)}
                    activeColor="#22C55E"
                    isDark={isDark}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setHideGuides((prev) => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: hideGuides
                      ? 'var(--accent-primary-alpha)'
                      : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF'),
                    color: hideGuides ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {hideGuides ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  <span>{hideGuides ? 'Show Grid Guides' : 'Hide Grid Guides (Clean Preview)'}</span>
                </button>

                {/* Animated Cut Preview Button (Scissors Cut Animation & Smooth Spread Motion) */}
                <button
                  type="button"
                  onClick={handleTriggerCutAnimation}
                  disabled={!activeImage || isCutting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: isCutSpread
                      ? '1px solid var(--accent-primary)'
                      : '1px solid var(--border-color)',
                    backgroundColor: isCutSpread
                      ? 'var(--accent-primary)'
                      : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF'),
                    color: isCutSpread ? '#FFFFFF' : 'var(--accent-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: activeImage && !isCutting ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                    boxShadow: isCutSpread ? '0 2px 8px rgba(37,99,235,0.3)' : '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                  title="Watch the scissors cut the photo into separate slices with smooth spread motion"
                >
                  <FiScissors
                    size={14}
                    style={{
                      transform: isCutting ? 'rotate(-25deg) scale(1.1)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                  <span>
                    {isCutting
                      ? 'Cutting Photo...'
                      : isCutSpread
                      ? 'Replay Cut Animation'
                      : 'Preview Cut Animation'}
                  </span>
                </button>

                {isCutSpread && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCutSpread(false);
                      setIsCutting(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      width: '100%',
                      height: '24px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      fontSize: '0.6875rem',
                      cursor: 'pointer',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <span>✕ Rejoin Full Photo</span>
                  </button>
                )}
              </div>

              {/* Card 2: SELECT GRID FORMAT (3x2 Matrix of Wireframes) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Select Grid Format
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                      {currentGridLayout.name} ({currentGridLayout.tileCount} Tiles)
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                  }}
                >
                  {SOCIAL_GRID_LAYOUTS.map((layout) => {
                    const isSelected = gridLayoutId === layout.id;
                    return (
                      <button
                        key={layout.id}
                        type="button"
                        onClick={() => {
                          setGridLayoutId(layout.id);
                          setSelectedTileId(layout.id === 'two-squares' ? 2 : 1);
                          setTileFocusMap(getAutoTileFocusMap(layout.id));
                          showToast(`Format: ${layout.name} (${layout.tileCount} Tiles)`);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '52px',
                          borderRadius: '8px',
                          border: isSelected
                            ? (isDark ? '2px solid #FFFFFF' : '2px solid var(--accent-primary)')
                            : '1px solid var(--border-color)',
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(255, 255, 255, 0.1)' : 'var(--accent-primary-alpha)')
                            : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-main)'),
                          boxShadow: isSelected && isDark ? '0 0 0 1px rgba(255,255,255,0.4)' : 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          transition: 'all 0.15s ease',
                        }}
                        title={`${layout.name} - ${layout.tileCount} Tiles`}
                      >
                        {/* 38x38 Wireframe */}
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(0, 0, 0, 0.45)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            padding: '2px',
                            boxSizing: 'border-box',
                            display: 'flex',
                          }}
                        >
                          {layout.id === 'one-square' && (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: isSelected
                                  ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                  : 'rgba(255, 255, 255, 0.22)',
                                borderRadius: '2px',
                              }}
                            />
                          )}

                          {layout.id === 'two-squares' && (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '2px',
                                width: '100%',
                                height: '100%',
                              }}
                            >
                              <div
                                style={{
                                  backgroundColor: isSelected
                                    ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                    : 'rgba(255, 255, 255, 0.22)',
                                  borderRadius: '2px',
                                }}
                              />
                              <div
                                style={{
                                  backgroundColor: isSelected
                                    ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                    : 'rgba(255, 255, 255, 0.22)',
                                  borderRadius: '2px',
                                }}
                              />
                            </div>
                          )}

                          {layout.id === 'three-squares' && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                width: '100%',
                                height: '100%',
                              }}
                            >
                              <div
                                style={{
                                  height: '52%',
                                  backgroundColor: isSelected
                                    ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                    : 'rgba(255, 255, 255, 0.22)',
                                  borderRadius: '2px',
                                }}
                              />
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: '2px',
                                  height: '48%',
                                }}
                              >
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {layout.id === 'four-squares' && (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gridTemplateRows: '1fr 1fr',
                                gap: '2px',
                                width: '100%',
                                height: '100%',
                              }}
                            >
                              {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                  key={i}
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          {layout.id === 'five-squares' && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                width: '100%',
                                height: '100%',
                              }}
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: '2px',
                                  height: '55%',
                                }}
                              >
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(3, 1fr)',
                                  gap: '2px',
                                  height: '45%',
                                }}
                              >
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {layout.id === 'six-squares' && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                width: '100%',
                                height: '100%',
                              }}
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: '2px',
                                  height: '55%',
                                }}
                              >
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(3, 1fr)',
                                  gap: '2px',
                                  height: '45%',
                                }}
                              >
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                                <div
                                  style={{
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.22)',
                                    borderRadius: '2px',
                                  }}
                                />
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '7px',
                                    fontWeight: 800,
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(255, 255, 255, 0.7)' : 'var(--accent-primary)')
                                      : 'rgba(255, 255, 255, 0.35)',
                                    color: isDark && isSelected ? '#0F172A' : '#FFFFFF',
                                    borderRadius: '2px',
                                  }}
                                >
                                  +1
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 3: Crop Size for Tiles */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Crop Size for Tiles
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '1px 8px',
                      borderRadius: '4px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-surface-hover)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {currentTileWidth} × {currentTileHeight} px
                  </span>
                </div>

                {/* Apply to All Tiles Toggle & Individual Tile Selector */}
                {currentGridLayout.tiles.length > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      padding: '6px 8px',
                      borderRadius: '7px',
                      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'var(--bg-surface-hover)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <SwitchToggle
                          checked={applyToAllTiles}
                          onChange={(val) => {
                            setApplyToAllTiles(val);
                            saveTileCropSettings(targetWidth, targetHeight, activePresetId, val, tileCropMap);
                          }}
                          activeColor="var(--accent-primary)"
                          isDark={isDark}
                        />
                        <span
                          onClick={() => {
                            const next = !applyToAllTiles;
                            setApplyToAllTiles(next);
                            saveTileCropSettings(targetWidth, targetHeight, activePresetId, next, tileCropMap);
                          }}
                          style={{
                            fontSize: '0.6875rem',
                            color: applyToAllTiles ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: applyToAllTiles ? 600 : 400,
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          Apply to all tiles
                        </span>
                      </div>
                      {!applyToAllTiles && (
                        <span style={{ fontSize: '0.65625rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                          Editing Tile {selectedTileId}
                        </span>
                      )}
                    </div>

                    {!applyToAllTiles && (
                      <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
                        {currentGridLayout.tiles.map((t) => {
                          const isCurrent = selectedTileId === t.id;
                          const tCrop = tileCropMap[t.id] || { width: targetWidth, height: targetHeight };
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTileId(t.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '5px',
                                border: isCurrent
                                  ? '1.5px solid var(--accent-primary)'
                                  : '1px solid var(--border-color)',
                                backgroundColor: isCurrent
                                  ? 'var(--accent-primary-alpha)'
                                  : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF'),
                                color: isCurrent ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                fontSize: '0.65625rem',
                                fontWeight: isCurrent ? 700 : 500,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.12s ease',
                              }}
                            >
                              <span>Tile {t.id}</span>
                              <span style={{ opacity: 0.85, fontSize: '0.59375rem' }}>({tCrop.width}×{tCrop.height})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* None (Native Resolution) Button */}
                <button
                  type="button"
                  onClick={() => handleSelectTilePreset(presets.find((p) => p.id === 'original') || presets[0])}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: currentTilePresetId === 'original'
                      ? '1px solid var(--accent-primary)'
                      : '1px solid var(--border-color)',
                    backgroundColor: currentTilePresetId === 'original'
                      ? 'var(--accent-primary-alpha)'
                      : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF'),
                    color: currentTilePresetId === 'original' ? 'var(--accent-primary)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: currentTilePresetId === 'original' ? 700 : 600 }}>
                      None
                    </span>
                    <span style={{ fontSize: '0.625rem', color: currentTilePresetId === 'original' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                      Native sliced resolution (no crop / distortion)
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: currentTilePresetId === 'original'
                        ? 'var(--accent-primary)'
                        : (isDark ? 'rgba(255,255,255,0.08)' : 'var(--bg-main)'),
                      color: currentTilePresetId === 'original' ? '#FFFFFF' : 'var(--text-secondary)',
                    }}
                  >
                    None
                  </span>
                </button>

                {/* Aspect Ratio Preset Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '6px',
                  }}
                >
                  {presets.filter((p) => p.id !== 'original').map((preset) => {
                    const isSelected = currentTilePresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className="preset-item-wrapper"
                        style={{ position: 'relative' }}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectTilePreset(preset)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '46px',
                            borderRadius: '8px',
                            border: isSelected
                              ? '1.5px solid var(--accent-primary)'
                              : '1px solid var(--border-color)',
                            backgroundColor: isSelected
                              ? 'var(--accent-primary-alpha)'
                              : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF'),
                            cursor: 'pointer',
                            padding: '3px 5px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: isSelected ? 700 : 600,
                              color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                            }}
                          >
                            {preset.aspect}
                          </span>
                          <span
                            style={{
                              fontSize: '0.59375rem',
                              color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                            }}
                          >
                            {preset.width}×{preset.height}
                          </span>
                        </button>
                        {preset.isCustom && (
                          <button
                            type="button"
                            className="preset-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePreset(preset.id);
                            }}
                            style={{
                              position: 'absolute',
                              top: '5px',
                              right: '5px',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: 'none',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.18)' : '#E2E8F0',
                              color: isDark ? '#E2E8F0' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              zIndex: 2,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#EF4444';
                              e.currentTarget.style.color = '#FFFFFF';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.18)' : '#E2E8F0';
                              e.currentTarget.style.color = isDark ? '#E2E8F0' : '#64748B';
                            }}
                            title="Remove custom ratio preset"
                          >
                            <FiX size={10} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Custom Dimensions Input Row with Add Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '2px',
                    paddingTop: '6px',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flex: 1,
                      height: '34px',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                      padding: '0 8px',
                    }}
                  >
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginRight: '4px' }}>W</span>
                    <input
                      type="number"
                      min="100"
                      max="8000"
                      value={currentTileWidth}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v > 0) {
                          handleUpdateTileDimensions(v, currentTileHeight);
                        }
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    />
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>px</span>
                  </div>

                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>×</span>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flex: 1,
                      height: '34px',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                      padding: '0 8px',
                    }}
                  >
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginRight: '4px' }}>H</span>
                    <input
                      type="number"
                      min="100"
                      max="8000"
                      value={currentTileHeight}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v > 0) {
                          handleUpdateTileDimensions(currentTileWidth, v);
                        }
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    />
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>px</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddTileCustomPreset}
                    style={{
                      height: '34px',
                      padding: '0 12px',
                      borderRadius: '7px',
                      border: '1px solid var(--accent-primary)',
                      backgroundColor: 'var(--accent-primary-alpha)',
                      color: 'var(--accent-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    title="Add custom size to presets and auto-save"
                  >
                    <FiPlus size={13} />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Card 4: Tile Focus Position */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                {/* Header + Quick Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Tile Focus Position
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTileFocusMap(getAutoTileFocusMap(gridLayoutId));
                        showToast('Auto-positioned tile focal points');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        color: 'var(--accent-primary)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                      title="Automatically align focus points between adjacent tiles"
                    >
                      <FiZap size={11} />
                      <span>Auto</span>
                    </button>
                    <span style={{ color: 'var(--border-color)', fontSize: '0.6875rem' }}>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const centerMap: Record<number, WatermarkPosition> = {};
                        currentGridLayout.tiles.forEach((t) => {
                          centerMap[t.id] = 'center';
                        });
                        setTileFocusMap(centerMap);
                        showToast('Reset all tiles to Center focus');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                      title="Reset all tile focus points to Center"
                    >
                      <FiTarget size={11} />
                      <span>Center All</span>
                    </button>
                  </div>
                </div>

                {/* Tile Tabs Bar - Clean & Compact */}
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto',
                    paddingBottom: '2px',
                  }}
                >
                  {currentGridLayout.tiles.map((tile) => {
                    const isSelected = tile.id === selectedTileId;
                    const tileFocusKey = tileFocusMap[tile.id] || 'center';
                    const shortLabel = getShortFocusLabel(tileFocusKey);

                    return (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => setSelectedTileId(tile.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: isSelected
                            ? '1.5px solid var(--accent-primary)'
                            : '1px solid var(--border-color)',
                          backgroundColor: isSelected
                            ? 'var(--accent-primary-alpha)'
                            : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF'),
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          flexShrink: 0,
                          fontSize: '0.75rem',
                          fontWeight: isSelected ? 600 : 500,
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <span>Tile {tile.id}</span>
                        <span
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.06)',
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                          }}
                        >
                          {shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 3x3 Focus Editor Card - Ultra Clean & Simple */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {/* 3x3 Grid Pad */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 24px)',
                      gridTemplateRows: 'repeat(3, 24px)',
                      gap: '5px',
                      padding: '5px',
                      borderRadius: '7px',
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.35)' : 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      flexShrink: 0,
                    }}
                  >
                    {NINE_POSITIONS.map((pos) => {
                      const currentTileFocus = tileFocusMap[selectedTileId] || 'center';
                      const isActive = currentTileFocus === pos;
                      return (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => {
                            setTileFocusMap((prev) => ({ ...prev, [selectedTileId]: pos }));
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            border: isActive
                              ? '1px solid var(--accent-primary)'
                              : (isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)'),
                            backgroundColor: isActive
                              ? 'var(--accent-primary)'
                              : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF'),
                            cursor: 'pointer',
                            padding: 0,
                            transition: 'all 0.12s ease',
                          }}
                          title={POSITION_LABELS[pos]}
                        >
                          <span
                            style={{
                              width: isActive ? '6px' : '5px',
                              height: isActive ? '6px' : '5px',
                              borderRadius: '50%',
                              backgroundColor: isActive
                                ? '#FFFFFF'
                                : (isDark ? '#71717A' : '#94A3B8'),
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Clean Focus Info Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Tile {selectedTileId} Anchor
                    </span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {POSITION_LABELS[tileFocusMap[selectedTileId] || 'center']}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* ========================================================================= */
            /* MODE 3: WATERMARK STUDIO CONTROLS                                         */
            /* ========================================================================= */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                flexShrink: 0,
              }}
            >
            {/* 1. Master Watermark Status & Switch Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-secondary)',
                border: watermarkConfig.enabled
                  ? '1.5px solid var(--accent-primary)'
                  : '1px solid var(--border-color)',
                boxShadow: watermarkConfig.enabled
                  ? (isDark ? '0 0 12px rgba(59, 130, 246, 0.2)' : '0 2px 8px rgba(59, 130, 246, 0.12)')
                  : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                {/* Active Watermark Icon / Thumbnail */}
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    padding: '2px',
                  }}
                >
                  {watermarkConfig.type === 'logo' && watermarkConfig.logoUrl ? (
                    <img
                      src={watermarkConfig.logoUrl}
                      alt="Watermark logo"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  ) : watermarkConfig.type === 'text' && watermarkConfig.text ? (
                    <FiType size={16} style={{ color: 'var(--accent-primary)' }} />
                  ) : (
                    <FiShield size={18} style={{ color: watermarkConfig.enabled ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {watermarkConfig.enabled
                        ? (watermarkConfig.type === 'logo'
                            ? (watermarkConfig.logoName || 'Logo Watermark')
                            : (watermarkConfig.text || 'Text Watermark'))
                        : 'Watermark Off'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        padding: '1.5px 7px',
                        borderRadius: '9999px',
                        backgroundColor: watermarkConfig.enabled ? 'rgba(34, 197, 94, 0.16)' : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'),
                        color: watermarkConfig.enabled ? '#4ADE80' : 'var(--text-muted)',
                        border: watermarkConfig.enabled ? '1px solid rgba(34, 197, 94, 0.3)' : 'none',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {watermarkConfig.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {watermarkConfig.enabled
                      ? (watermarkConfig.type === 'logo' ? 'Logo active on preview & exports' : 'Text active on preview & exports')
                      : 'Toggle on to apply watermark'}
                  </span>
                </div>
              </div>

              {/* Theme-merged Switch Toggle & Clear Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {watermarkConfig.enabled && (watermarkConfig.logoUrl || watermarkConfig.text) && (
                  <button
                    type="button"
                    onClick={() => setWatermarkConfig((p) => ({ ...p, enabled: false }))}
                    style={{
                      height: '26px',
                      padding: '0 8px',
                      borderRadius: '5px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                    title="Turn off watermark"
                  >
                    <FiX size={11} />
                    <span>Clear</span>
                  </button>
                )}

                <SwitchToggle
                  checked={watermarkConfig.enabled}
                  onChange={(val) => setWatermarkConfig((p) => ({ ...p, enabled: val }))}
                  activeColor="var(--accent-primary)"
                  isDark={isDark}
                />
              </div>
            </div>

            {/* Hidden File Input for Logo Upload */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleUploadLogoFile}
            />

            {/* 2. Source Type Selector (Logo vs Text) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  padding: '3px',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setWatermarkConfig((p) => ({ ...p, type: 'logo', enabled: true }))}
                  style={{
                    height: '32px',
                    borderRadius: '6px',
                    border: watermarkConfig.type === 'logo'
                      ? (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)')
                      : 'none',
                    backgroundColor: watermarkConfig.type === 'logo'
                      ? (isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF')
                      : 'transparent',
                    color: watermarkConfig.type === 'logo' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: watermarkConfig.type === 'logo' ? 600 : 500,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    boxShadow: watermarkConfig.type === 'logo' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Logo Watermark
                </button>

                <button
                  type="button"
                  onClick={() => setWatermarkConfig((p) => ({ ...p, type: 'text', enabled: true }))}
                  style={{
                    height: '32px',
                    borderRadius: '6px',
                    border: watermarkConfig.type === 'text'
                      ? (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)')
                      : 'none',
                    backgroundColor: watermarkConfig.type === 'text'
                      ? (isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF')
                      : 'transparent',
                    color: watermarkConfig.type === 'text' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: watermarkConfig.type === 'text' ? 600 : 500,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    boxShadow: watermarkConfig.type === 'text' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Text Watermark
                </button>
              </div>

              {/* Logo Selection & Upload */}
              {watermarkConfig.type === 'logo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Upload button */}
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    style={{
                      width: '100%',
                      height: '34px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-secondary)',
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.color = 'var(--accent-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                  >
                    <FiUploadCloud size={14} />
                    <span>Upload Custom Logo</span>
                  </button>
                </div>
              )}

              {/* Text Watermark Controls */}
              {watermarkConfig.type === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    value={watermarkConfig.text}
                    onChange={(e) => setWatermarkConfig((p) => ({ ...p, text: e.target.value, enabled: true }))}
                    placeholder="{project} • 081-234-5678"
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 10px',
                      fontSize: '0.8125rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Tags:</span>
                    {[
                      { label: '+Project', tag: '{project}' },
                      { label: '+Phone', tag: '081-234-5678' },
                      { label: '+Line', tag: '@estatebangkok' },
                    ].map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => {
                          setWatermarkConfig((p) => ({
                            ...p,
                            text: p.text ? `${p.text} · ${t.tag}` : t.tag,
                            enabled: true,
                          }));
                        }}
                        style={{
                          height: '24px',
                          padding: '0 7px',
                          borderRadius: '5px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.6875rem',
                          cursor: 'pointer',
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Color:</span>
                      {['#FFFFFF', '#EAB308', '#38BDF8', '#10B981', '#0F172A'].map((c) => {
                        const isC = (watermarkConfig.textColor || '#FFFFFF').toUpperCase() === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setWatermarkConfig((p) => ({ ...p, textColor: c }))}
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: c,
                              border: isC ? '2px solid var(--accent-primary)' : '1px solid rgba(128,128,128,0.4)',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          />
                        );
                      })}
                      <input
                        type="color"
                        value={watermarkConfig.textColor || '#FFFFFF'}
                        onChange={(e) => setWatermarkConfig((p) => ({ ...p, textColor: e.target.value }))}
                        style={{ width: '20px', height: '20px', borderRadius: '4px', border: 'none', cursor: 'pointer', padding: 0, background: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shadow:</span>
                      <SwitchToggle
                        checked={watermarkConfig.hasShadow}
                        onChange={(val) => setWatermarkConfig((p) => ({ ...p, hasShadow: val }))}
                        activeColor="var(--accent-primary)"
                        isDark={isDark}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Layout & Placement (Clean & Intuitive) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Layout & Position
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  {watermarkConfig.layoutMode === 'single'
                    ? `Single (${POSITION_LABELS[watermarkConfig.position] || 'Bottom Right'})`
                    : watermarkConfig.layoutMode === 'top-bottom'
                    ? 'Top & Bottom Bars'
                    : 'Repeat Grid Pattern'}
                </span>
              </div>

              {/* 3-way Segmented Layout Picker */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '4px',
                  padding: '3px',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {[
                  { mode: 'single', label: 'Single', icon: FiTarget },
                  { mode: 'top-bottom', label: 'Top & Bottom', icon: FiLayers },
                  { mode: 'repeat-grid', label: 'Grid', icon: FiGrid },
                ].map((tab) => {
                  const isSelected = (watermarkConfig.layoutMode || 'single') === tab.mode;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.mode}
                      type="button"
                      onClick={() => setWatermarkConfig((p) => ({ ...p, layoutMode: tab.mode as WatermarkLayoutMode, enabled: true }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        height: '32px',
                        borderRadius: '6px',
                        border: isSelected
                          ? (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)')
                          : 'none',
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF')
                          : 'transparent',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        boxShadow: isSelected
                          ? (isDark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.08)')
                          : 'none',
                        fontSize: '0.75rem',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon size={12} style={{ color: isSelected ? 'var(--accent-primary)' : 'inherit' }} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mode 1: Single Mark Anchor & Angle */}
              {watermarkConfig.layoutMode === 'single' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Theme-merged Anchor Position Matrix Card */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Anchor Position
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        {POSITION_LABELS[watermarkConfig.position] || 'Bottom Right'}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 18px)',
                        gridTemplateRows: 'repeat(3, 18px)',
                        gap: '4px',
                        padding: '4px',
                        borderRadius: '7px',
                        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.35)' : 'var(--bg-surface-hover)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {NINE_POSITIONS.map((pos) => {
                        const isActive = watermarkConfig.position === pos;
                        return (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setWatermarkConfig((p) => ({ ...p, position: pos, enabled: true }))}
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '3px',
                              border: isActive
                                ? '1px solid var(--accent-primary)'
                                : (isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)'),
                              backgroundColor: isActive
                                ? 'var(--accent-primary)'
                                : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF'),
                              boxShadow: isActive
                                ? '0 0 6px var(--accent-primary-alpha, rgba(37, 99, 235, 0.35))'
                                : 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                              transition: 'all 0.15s ease',
                            }}
                            title={`Position: ${POSITION_LABELS[pos]}`}
                          >
                            {isActive && (
                              <span
                                style={{
                                  width: '4px',
                                  height: '4px',
                                  borderRadius: '50%',
                                  backgroundColor: '#FFFFFF',
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clean Angle Presets: 0° Straight vs -45° Diagonal */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Angle:
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[
                        { label: '0° Straight', rot: 0 },
                        { label: '-45° Diagonal', rot: -45 },
                      ].map((ang) => {
                        const isAct = (watermarkConfig.rotation || 0) === ang.rot;
                        return (
                          <button
                            key={ang.rot}
                            type="button"
                            onClick={() => setWatermarkConfig((p) => ({ ...p, rotation: ang.rot, enabled: true }))}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '5px',
                              border: isAct ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isAct ? 'var(--accent-primary-alpha)' : 'transparent',
                              color: isAct ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              fontSize: '0.6875rem',
                              fontWeight: isAct ? 600 : 500,
                              cursor: 'pointer',
                            }}
                          >
                            {ang.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 2: Top & Bottom Pattern */}
              {watermarkConfig.layoutMode === 'top-bottom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Angle:
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[
                        { label: '0° Straight', rot: 0 },
                        { label: '-45° Diagonal', rot: -45 },
                      ].map((ang) => {
                        const isAct = (watermarkConfig.rotation || 0) === ang.rot;
                        return (
                          <button
                            key={ang.rot}
                            type="button"
                            onClick={() => setWatermarkConfig((p) => ({ ...p, rotation: ang.rot, enabled: true }))}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '5px',
                              border: isAct ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isAct ? 'var(--accent-primary-alpha)' : 'transparent',
                              color: isAct ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              fontSize: '0.6875rem',
                              fontWeight: isAct ? 600 : 500,
                              cursor: 'pointer',
                            }}
                          >
                            {ang.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Columns slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Columns: {watermarkConfig.columns || 6}</span>
                      <button
                        type="button"
                        onClick={() => setWatermarkConfig((p) => ({ ...p, columns: 6 }))}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        title="Reset columns"
                      >
                        <FiRotateCcw size={11} />
                      </button>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="12"
                      step="1"
                      value={watermarkConfig.columns || 6}
                      onChange={(e) => setWatermarkConfig((p) => ({ ...p, columns: parseInt(e.target.value, 10), enabled: true }))}
                      style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              )}

              {/* Mode 3: Repeat Grid Pattern */}
              {watermarkConfig.layoutMode === 'repeat-grid' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Angle:
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[
                        { label: '0° Straight', rot: 0, offset: false },
                        { label: '-45° Diagonal', rot: -45, offset: true },
                      ].map((ang) => {
                        const isAct = (watermarkConfig.rotation || 0) === ang.rot;
                        return (
                          <button
                            key={ang.rot}
                            type="button"
                            onClick={() => setWatermarkConfig((p) => ({
                              ...p,
                              rotation: ang.rot,
                              offsetAlternateRows: ang.offset,
                              enabled: true,
                            }))}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '5px',
                              border: isAct ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isAct ? 'var(--accent-primary-alpha)' : 'transparent',
                              color: isAct ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              fontSize: '0.6875rem',
                              fontWeight: isAct ? 600 : 500,
                              cursor: 'pointer',
                            }}
                          >
                            {ang.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rows: {watermarkConfig.rows || 5}</span>
                      <input
                        type="range"
                        min="2"
                        max="8"
                        step="1"
                        value={watermarkConfig.rows || 5}
                        onChange={(e) => setWatermarkConfig((p) => ({ ...p, rows: parseInt(e.target.value, 10), enabled: true }))}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cols: {watermarkConfig.columns || 5}</span>
                      <input
                        type="range"
                        min="2"
                        max="8"
                        step="1"
                        value={watermarkConfig.columns || 5}
                        onChange={(e) => setWatermarkConfig((p) => ({ ...p, columns: parseInt(e.target.value, 10), enabled: true }))}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                    </div>
                  </div>

                  {/* Offset Alternate Rows Checkbox */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(watermarkConfig.offsetAlternateRows)}
                      onChange={(e) => setWatermarkConfig((p) => ({ ...p, offsetAlternateRows: e.target.checked }))}
                      style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                    />
                    <span>Stagger alternate rows (natural diagonal)</span>
                  </label>
                </div>
              )}
            </div>

            {/* 4. Appearance Adjustments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Size & Opacity
                </span>
                <FiInfo size={12} style={{ color: 'var(--text-muted)', cursor: 'help' }} title="Scale and transparency" />
              </div>

              {/* Size Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Size</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{watermarkConfig.scale}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={watermarkConfig.scale}
                  onChange={(e) => setWatermarkConfig((p) => ({ ...p, scale: parseInt(e.target.value, 10), enabled: true }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
              </div>

              {/* Opacity Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Opacity</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{watermarkConfig.opacity}%</span>
                    <button
                      type="button"
                      onClick={() => setWatermarkConfig((p) => ({ ...p, opacity: 40 }))}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                      title="Reset to 40%"
                    >
                      <FiRotateCcw size={11} />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={watermarkConfig.opacity}
                  onChange={(e) => setWatermarkConfig((p) => ({ ...p, opacity: parseInt(e.target.value, 10), enabled: true }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
              </div>

              {/* Image Frame / Border */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Image Frame / Border</span>
                <select
                  value={watermarkConfig.borderStyle || 'none'}
                  onChange={(e) => {
                    const val = e.target.value as WatermarkBorderStyle;
                    setWatermarkConfig((p) => ({ ...p, borderStyle: val, enabled: true }));
                  }}
                  style={{
                    width: '100%',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '0 10px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="none">None (Clean Image)</option>
                  <option value="solid-thin-white">Solid Thin White</option>
                  <option value="solid-dark">Solid Dark Slate</option>
                  <option value="luxury-gold">Luxury Gold Border</option>
                  <option value="modern-accent">Modern Rounded Accent</option>
                </select>
              </div>

              {/* Peek Clean Photo Toggle */}
              <button
                type="button"
                onClick={() => setHideWatermarkPreview((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: hideWatermarkPreview ? 'var(--accent-primary-alpha)' : (isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-secondary)'),
                  color: hideWatermarkPreview ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  width: '100%',
                  justifyContent: 'center',
                  marginTop: '2px',
                  transition: 'all 0.15s ease',
                }}
              >
                {hideWatermarkPreview ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                <span>{hideWatermarkPreview ? 'Watermark Hidden (Click to Show)' : 'Peek Clean Image (Hide Watermark)'}</span>
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Add New Crop Preset Modal */}
      <AnimatePresence>
        {showAddPresetModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '1.5rem',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
              }}
            >
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Add New Crop Size Profile
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Create a custom target resolution preset for fast standardized cropping.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Profile Name
                  </label>
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="e.g. Website Hero, Social Ad, Banner"
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 10px',
                      fontSize: '0.8125rem',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Width (px)</span>
                    <input
                      type="number"
                      value={newCustomW}
                      onChange={(e) => setNewCustomW(parseInt(e.target.value, 10) || 1200)}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                  <span style={{ marginTop: '16px', color: 'var(--text-muted)' }}>×</span>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Height (px)</span>
                    <input
                      type="number"
                      value={newCustomH}
                      onChange={(e) => setNewCustomH(parseInt(e.target.value, 10) || 1200)}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddPresetModal(false)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const clean = newPresetName.trim() || `${newCustomW}×${newCustomH}`;
                    const aspectLabel = getAspectRatioLabel(newCustomW, newCustomH);
                    const p: CropPreset = {
                      id: `custom-${newCustomW}x${newCustomH}-${Date.now().toString().slice(-4)}`,
                      name: clean,
                      width: newCustomW,
                      height: newCustomH,
                      aspect: aspectLabel,
                      isCustom: true,
                    };
                    setPresets((prev) => [...prev, p]);
                    handleSelectPreset(p);
                    setShowAddPresetModal(false);
                    setNewPresetName('');
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save & Select
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '420px',
                padding: '1.5rem',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
              }}
            >
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Reset Workspace to Defaults?
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                This will reset crop resolutions to 1200×1200 px and reload the 4 sample condo photos.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Reset Workspace
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Crop & Cut Studio Format Modal */}
      <AnimatePresence>
        {showSaveFormatModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '460px',
                padding: '1.5rem',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiScissors size={18} style={{ color: 'var(--accent-primary)' }} />
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {saveFormatMode === 'update' ? 'Update Studio Format' : 'Save as New Format'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveFormatModal(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                  title="Close"
                >
                  <FiX size={14} />
                </button>
              </div>

              {/* Mode Toggle Pills (Update Existing vs Create New) */}
              {cropStudioFormats.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    marginBottom: '1rem',
                    padding: '3px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSaveFormatMode('update');
                      const target = activeStudioFormat || cropStudioFormats[0];
                      if (target) {
                        setSaveFormatTargetId(target.id);
                        setSaveFormatName(target.name);
                        setSaveFormatDesc(target.description || `${targetWidth} × ${targetHeight} px`);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: saveFormatMode === 'update' ? 'var(--accent-primary)' : 'transparent',
                      color: saveFormatMode === 'update' ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <FiRefreshCw size={11} />
                    <span>Update Existing Format</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveFormatMode('create');
                      setSaveFormatTargetId('');
                      const defaultName = studioMode === 'grid'
                        ? `${currentGridLayout.name} Grid Format`
                        : `${activePreset?.aspect || 'Custom'} ${targetWidth}×${targetHeight} Format`;
                      setSaveFormatName(defaultName);
                      setSaveFormatDesc(`${targetWidth} × ${targetHeight} px • ${fitMode === 'cover' ? 'Fill (Cover)' : 'Fit (Contain)'}`);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: saveFormatMode === 'create' ? 'var(--accent-primary)' : 'transparent',
                      color: saveFormatMode === 'create' ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <FiPlus size={11} />
                    <span>Save as New Format</span>
                  </button>
                </div>
              )}

              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                {saveFormatMode === 'update'
                  ? 'Update this format with your current crop size, anchor, framing & watermark settings.'
                  : 'Save your current studio settings as a new reusable format for workflow layouts.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
                {saveFormatMode === 'update' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Select Format to Overwrite
                    </label>
                    <select
                      value={saveFormatTargetId}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        setSaveFormatTargetId(targetId);
                        const fmt = cropStudioFormats.find((f) => f.id === targetId);
                        if (fmt) {
                          setSaveFormatName(fmt.name);
                          setSaveFormatDesc(fmt.description || `${targetWidth} × ${targetHeight} px`);
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8125rem',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {cropStudioFormats.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.targetWidth}×{f.targetHeight} • {f.aspect})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Format Name {saveFormatMode === 'update' && '(Rename here if desired)'}
                  </label>
                  <input
                    type="text"
                    value={saveFormatName}
                    onChange={(e) => setSaveFormatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && saveFormatName.trim()) {
                        handleSaveWholeStudioFormat();
                      }
                    }}
                    autoFocus
                    placeholder="e.g., FB Format, Instagram Feed 4:5, Condo Square 1:1"
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Description / Purpose
                  </label>
                  <input
                    type="text"
                    value={saveFormatDesc}
                    onChange={(e) => setSaveFormatDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && saveFormatName.trim()) {
                        handleSaveWholeStudioFormat();
                      }
                    }}
                    placeholder="e.g., Portrait listing photos for Facebook & IG"
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Summary Configuration Card */}
                <div
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-color)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '6px',
                    fontSize: '0.6875rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Mode: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {studioMode === 'grid' ? 'Social Grid Split' : 'Standard Crop'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Dimensions: </span>
                    <strong style={{ color: 'var(--accent-primary)' }}>
                      {targetWidth} × {targetHeight} px
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Framing: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {fitMode === 'cover' ? 'Fill (Cover)' : 'Fit (Contain)'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Anchor: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {POSITION_LABELS[focusPosition]}
                    </strong>
                  </div>
                  {studioMode === 'grid' && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Grid Layout: </span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {currentGridLayout.name} ({currentGridLayout.tileCount} Tiles)
                      </strong>
                    </div>
                  )}
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Watermark: </span>
                    <strong style={{ color: watermarkConfig.enabled ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                      {watermarkConfig.enabled
                        ? (watermarkConfig.type === 'logo'
                            ? `Logo (${watermarkConfig.logoName || 'Custom'}) • ${POSITION_LABELS[watermarkConfig.position] || watermarkConfig.position} • ${watermarkConfig.scale}% size`
                            : `Text ("${watermarkConfig.text}") • ${POSITION_LABELS[watermarkConfig.position] || watermarkConfig.position}`)
                        : 'Disabled (Clean Image)'}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowSaveFormatModal(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '7px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveWholeStudioFormat}
                  disabled={!saveFormatName.trim()}
                  style={{
                    padding: '7px 18px',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: !saveFormatName.trim() ? 'not-allowed' : 'pointer',
                    opacity: !saveFormatName.trim() ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FiCheck size={14} />
                  <span>{saveFormatMode === 'update' ? 'Update Format' : 'Save as New Format'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saved Formats Modal Box */}
      <AnimatePresence>
        {showSavedFormatsModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setShowSavedFormatsModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '520px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.45)',
                overflow: 'hidden',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--accent-primary-alpha)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FiScissors size={16} />
                  </div>
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      Saved Formats
                    </h3>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Click any format to immediately apply crop size, anchor & framing
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSavedFormatsModal(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                  title="Close"
                >
                  <FiX size={15} />
                </button>
              </div>

              {/* Modal Body / Saved List */}
              <div
                style={{
                  padding: '1.25rem 1.5rem',
                  overflowY: 'auto',
                  maxHeight: 'calc(85vh - 140px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {cropStudioFormats.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '2.5rem 1rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <FiScissors
                      size={28}
                      style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.6 }}
                    />
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      No Saved Formats Yet
                    </div>
                    <div>
                      Choose your crop size, select anchor & style, then click <strong>Save</strong> to add your format here.
                    </div>
                  </div>
                ) : (
                  cropStudioFormats.map((fmt) => {
                    const isSelected = selectedStudioFormatId === fmt.id;
                    return (
                      <div
                        key={fmt.id}
                        onClick={() => {
                          handleLoadStudioFormat(fmt);
                          setShowSavedFormatsModal(false);
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(37, 99, 235, 0.12)'
                              : 'rgba(37, 99, 235, 0.05)'
                            : isDark
                            ? 'rgba(255, 255, 255, 0.02)'
                            : 'var(--bg-main)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            e.currentTarget.style.backgroundColor = isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'var(--bg-surface-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.backgroundColor = isDark
                              ? 'rgba(255, 255, 255, 0.02)'
                              : 'var(--bg-main)';
                          }
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            {editingFormatId === fmt.id ? (
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  value={editingFormatName}
                                  onChange={(e) => setEditingFormatName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameStudioFormat(fmt.id, editingFormatName);
                                    if (e.key === 'Escape') setEditingFormatId(null);
                                  }}
                                  autoFocus
                                  style={{
                                    height: '28px',
                                    padding: '0 8px',
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    border: '1.5px solid var(--accent-primary)',
                                    backgroundColor: 'var(--bg-main)',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    flex: 1,
                                    maxWidth: '220px',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRenameStudioFormat(fmt.id, editingFormatName)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: 'var(--accent-primary)',
                                    color: '#FFFFFF',
                                    cursor: 'pointer',
                                  }}
                                  title="Save name"
                                >
                                  <FiCheck size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingFormatId(null)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                  }}
                                  title="Cancel"
                                >
                                  <FiX size={13} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span
                                  style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {fmt.name}
                                </span>
                                {isSelected && (
                                  <span
                                    style={{
                                      fontSize: '0.6875rem',
                                      fontWeight: 700,
                                      color: '#FFFFFF',
                                      backgroundColor: 'var(--accent-primary)',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                      flexShrink: 0,
                                    }}
                                  >
                                    Active
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingFormatId(fmt.id);
                                    setEditingFormatName(fmt.name);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    transition: 'color 0.15s ease',
                                    flexShrink: 0,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                                  title="Rename format"
                                >
                                  <FiEdit2 size={12} />
                                </button>
                              </>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {/* 1-Click Update Format with Current Settings Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateStudioFormatWithCurrentSettings(fmt.id);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 9px',
                                borderRadius: '6px',
                                border: '1px solid var(--accent-primary)',
                                backgroundColor: isSelected ? 'var(--accent-primary)' : (isDark ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.08)'),
                                color: isSelected ? '#FFFFFF' : 'var(--accent-primary)',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title="Update this format with current studio settings (size, anchor, framing & watermark)"
                            >
                              <FiRefreshCw size={11} />
                              <span>Update</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteStudioFormat(fmt.id, e)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                              title="Delete this format"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Format Badges */}
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                            alignItems: 'center',
                            fontSize: '0.75rem',
                          }}
                        >
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                            }}
                          >
                            {fmt.targetWidth} × {fmt.targetHeight} px
                          </span>

                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Ratio: {fmt.aspect}
                          </span>

                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Anchor: {POSITION_LABELS[fmt.focusPosition] || 'Center'}
                          </span>

                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Framing: {fmt.fitMode === 'cover' ? 'Fill (Cover)' : 'Fit (Contain)'}
                          </span>

                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: fmt.mode === 'grid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                              color: fmt.mode === 'grid' ? '#10B981' : 'var(--accent-primary)',
                              fontWeight: 500,
                            }}
                          >
                            {fmt.mode === 'grid' ? 'Grid Split' : 'Standard Crop'}
                          </span>

                          {fmt.watermarkConfig?.enabled && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--accent-primary-alpha)',
                                color: 'var(--accent-primary)',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <FiShield size={11} />
                              <span>Watermark: {fmt.watermarkConfig.type === 'logo' ? 'Logo' : 'Text'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'var(--bg-main)',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSavedFormatsModal(false);
                      handleOpenCreateNewFormatModal();
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--accent-primary)',
                      backgroundColor: 'var(--accent-primary-alpha)',
                      color: 'var(--accent-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <FiPlus size={13} />
                    <span>Save Current as New Format</span>
                  </button>

                  {activeStudioFormat && (
                    <button
                      type="button"
                      onClick={() => {
                        handleUpdateStudioFormatWithCurrentSettings(activeStudioFormat.id);
                        setShowSavedFormatsModal(false);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--accent-primary)',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#FFFFFF',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title={`Update "${activeStudioFormat.name}" with current studio settings`}
                    >
                      <FiRefreshCw size={12} />
                      <span>Update Active ({activeStudioFormat.name})</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowSavedFormatsModal(false)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
