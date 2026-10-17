import type { WatermarkConfig } from '../autopost/watermarkStorage';
import { drawWatermarkOnContext } from '../autopost/watermarkCanvas';

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface CropStudioFormat {
  id: string;
  name: string;
  description: string;
  mode: 'standard' | 'grid';
  targetWidth: number;
  targetHeight: number;
  aspect: string;
  fitMode: 'cover' | 'contain';
  focusPosition: WatermarkPosition;
  cropZoom: number;
  // Watermark configuration
  watermarkConfig?: WatermarkConfig;
  // Grid mode settings
  gridLayoutId?: string;
  tileCropMap?: Record<number, { width: number; height: number; presetId?: string }>;
  tileFocusMap?: Record<number, WatermarkPosition>;
  useWatermarkOnTiles?: boolean;
  applyToAllTiles?: boolean;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_CROP_FORMATS_KEY = 'ea_saved_crop_formats_v2';
const STORAGE_ACTIVE_CROP_FORMAT_ID_KEY = 'ea_active_crop_format_id_v2';

export const FOCUS_COORDS: Record<WatermarkPosition, { x: number; y: number }> = {
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

export const INITIAL_CROP_FORMATS: CropStudioFormat[] = [
  {
    id: 'format-ig-portrait',
    name: 'Instagram Portrait (4:5)',
    description: '1080 × 1350 px • High-converting vertical feed format',
    mode: 'standard',
    targetWidth: 1080,
    targetHeight: 1350,
    aspect: '4:5',
    fitMode: 'cover',
    focusPosition: 'center',
    cropZoom: 1,
    isDefault: true,
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now(),
  },
  {
    id: 'format-square-post',
    name: 'Square Listing (1:1)',
    description: '1200 × 1200 px • Universal social post & marketplace grid',
    mode: 'standard',
    targetWidth: 1200,
    targetHeight: 1200,
    aspect: '1:1',
    fitMode: 'cover',
    focusPosition: 'center',
    cropZoom: 1,
    isDefault: false,
    createdAt: Date.now() - 3600000 * 18,
    updatedAt: Date.now(),
  },
  {
    id: 'format-story-reel',
    name: 'Story / Reel (9:16)',
    description: '1080 × 1920 px • Full-screen mobile story & vertical short',
    mode: 'standard',
    targetWidth: 1080,
    targetHeight: 1920,
    aspect: '9:16',
    fitMode: 'cover',
    focusPosition: 'center',
    cropZoom: 1,
    isDefault: false,
    createdAt: Date.now() - 3600000 * 12,
    updatedAt: Date.now(),
  },
  {
    id: 'format-landscape-web',
    name: 'Landscape Web (16:9)',
    description: '1920 × 1080 px • Website hero & property portal banner',
    mode: 'standard',
    targetWidth: 1920,
    targetHeight: 1080,
    aspect: '16:9',
    fitMode: 'cover',
    focusPosition: 'center',
    cropZoom: 1,
    isDefault: false,
    createdAt: Date.now() - 3600000 * 6,
    updatedAt: Date.now(),
  },
  {
    id: 'format-grid-2split',
    name: 'Carousel Split (2 Squares)',
    description: 'Social grid split • 2 seamless horizontal swipe tiles',
    mode: 'grid',
    gridLayoutId: 'two-squares',
    targetWidth: 1080,
    targetHeight: 1080,
    aspect: '1:1',
    fitMode: 'cover',
    focusPosition: 'center',
    cropZoom: 1,
    applyToAllTiles: true,
    isDefault: false,
    createdAt: Date.now() - 3600000 * 3,
    updatedAt: Date.now(),
  },
];

export const getSavedCropFormats = (): CropStudioFormat[] => {
  try {
    const raw = localStorage.getItem(STORAGE_CROP_FORMATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load saved crop formats', e);
  }
  return INITIAL_CROP_FORMATS;
};

export const saveCropFormatsList = (formats: CropStudioFormat[]) => {
  try {
    localStorage.setItem(STORAGE_CROP_FORMATS_KEY, JSON.stringify(formats));
  } catch (e) {
    console.error('Failed to save crop formats', e);
  }
};

export const getActiveCropFormatId = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_ACTIVE_CROP_FORMAT_ID_KEY);
    if (saved) return saved;
  } catch (e) {}
  return INITIAL_CROP_FORMATS[0].id;
};

export const setActiveCropFormatId = (id: string) => {
  try {
    localStorage.setItem(STORAGE_ACTIVE_CROP_FORMAT_ID_KEY, id);
  } catch (e) {}
};

export const getActiveCropFormat = (): CropStudioFormat => {
  const formats = getSavedCropFormats();
  const activeId = getActiveCropFormatId();
  return formats.find((f) => f.id === activeId) || formats[0] || INITIAL_CROP_FORMATS[0];
};

/**
 * High-performance offscreen canvas helper to format any image
 * using a given CropStudioFormat (aspect, dimensions, fit, anchor, zoom).
 */
export const formatImageWithCropFormat = async (
  imgSrc: string,
  format: CropStudioFormat
): Promise<string> => {
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const naturalW = img.naturalWidth || 1200;
        const naturalH = img.naturalHeight || 1200;
        const width = format.targetWidth || 1200;
        const height = format.targetHeight || 1200;
        const fitMode = format.fitMode || 'cover';
        const focusPosition = format.focusPosition || 'center';
        const cropZoom = Math.max(1, format.cropZoom || 1);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imgSrc);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const focusCoord = FOCUS_COORDS[focusPosition] || { x: 0.5, y: 0.5 };

        if (fitMode === 'cover') {
          const targetAspect = width / height;
          const imgAspect = naturalW / naturalH;

          let cropW = naturalW;
          let cropH = naturalH;

          if (imgAspect > targetAspect) {
            cropW = naturalH * targetAspect;
            cropH = naturalH;
          } else {
            cropW = naturalW;
            cropH = naturalW / targetAspect;
          }

          cropW = cropW / cropZoom;
          cropH = cropH / cropZoom;

          const maxOffsetX = Math.max(0, naturalW - cropW);
          const maxOffsetY = Math.max(0, naturalH - cropH);
          const sx = Math.max(0, Math.min(naturalW - cropW, maxOffsetX * focusCoord.x));
          const sy = Math.max(0, Math.min(naturalH - cropH, maxOffsetY * focusCoord.y));

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, width, height);
        } else {
          // Contain (Fit)
          const targetAspect = width / height;
          const imgAspect = naturalW / naturalH;

          let renderW = width;
          let renderH = height;

          if (imgAspect > targetAspect) {
            renderW = width;
            renderH = width / imgAspect;
          } else {
            renderH = height;
            renderW = height * imgAspect;
          }

          const zoomedW = renderW * cropZoom;
          const zoomedH = renderH * cropZoom;

          const offsetX = (width - zoomedW) * focusCoord.x;
          const offsetY = (height - zoomedH) * focusCoord.y;

          ctx.fillStyle = '#1E293B';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, offsetX, offsetY, zoomedW, zoomedH);
        }

        if (format.watermarkConfig?.enabled) {
          await drawWatermarkOnContext(ctx, width, height, format.watermarkConfig);
        }

        const mime = imgSrc.includes('.png') ? 'image/png' : imgSrc.includes('.webp') ? 'image/webp' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, 0.95));
      } catch (err) {
        console.warn('Canvas crop formatting error, falling back to original', err);
        resolve(imgSrc);
      }
    };
    img.onerror = () => {
      resolve(imgSrc);
    };
    img.src = imgSrc;
  });
};
