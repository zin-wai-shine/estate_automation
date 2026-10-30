import { type WatermarkConfig, loadActiveWatermarkConfig } from '../autopost/watermarkStorage';
import { drawWatermarkOnContext, loadImageElement } from '../autopost/watermarkCanvas';

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
    id: 'format-grid-2split',
    name: 'FB Hero Cut',
    description: 'Social grid split • 2 seamless horizontal swipe tiles',
    mode: 'grid',
    targetWidth: 1080,
    targetHeight: 1080,
    aspect: '1:1',
    fitMode: 'cover',
    focusPosition: 'center',
    cropZoom: 1,
    gridLayoutId: 'two-squares',
    watermarkConfig: {
      enabled: true,
      type: 'text',
      logoUrl: '',
      logoName: '',
      text: 'BoltHaven Property',
      textColor: '#FFFFFF',
      fontSize: 26,
      fontWeight: '600',
      opacity: 85,
      scale: 25,
      position: 'bottom-right',
      margin: 4,
      hasShadow: true,
      smartScope: 'all',
    },
    isDefault: false,
    createdAt: 1792509885458,
    updatedAt: Date.now(),
  },
  {
    id: 'format-1792362113668',
    name: 'FB Format',
    description: '1080 × 1350 px • Portrait listing photos for Facebook & IG',
    mode: 'standard',
    targetWidth: 1080,
    targetHeight: 1350,
    aspect: '4:5',
    fitMode: 'cover',
    focusPosition: 'center',
    cropZoom: 1,
    isDefault: true,
    createdAt: 1792362113668,
    updatedAt: Date.now(),
  },
  {
    id: 'format-1774-887',
    name: 'Original 1774×887 Format',
    description: '1774 × 887 px • Fill (Cover) • Anchor: Center',
    mode: 'standard',
    targetWidth: 1774,
    targetHeight: 887,
    aspect: '1774:887',
    fitMode: 'cover',
    focusPosition: 'center',
    cropZoom: 1,
    watermarkConfig: {
      enabled: true,
      type: 'text',
      logoUrl: '',
      logoName: '',
      text: 'BoltHaven Property',
      textColor: '#FFFFFF',
      fontSize: 26,
      fontWeight: '600',
      opacity: 85,
      scale: 25,
      position: 'bottom-right',
      margin: 4,
      hasShadow: true,
      smartScope: 'all',
    },
    isDefault: false,
    createdAt: 1793310158189,
    updatedAt: Date.now(),
  },
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
    isDefault: false,
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

export const syncCropFormatToWorkflowConfig = async (format: CropStudioFormat) => {
  const updateBox = (box: any) => {
    const isMatch =
      box.cropFormatId === format.id ||
      box.templateId === format.id ||
      box.watermarkPresetId === format.id ||
      (box.templateText && box.templateText.toLowerCase() === format.name.toLowerCase()) ||
      (box.title && box.title.toLowerCase().includes(format.name.toLowerCase())) ||
      (format.name.toLowerCase().includes('fb') && (box.title?.toLowerCase().includes('fb') || box.templateText?.toLowerCase().includes('fb')));

    if (isMatch && (box.processType === 'watermark' || box.model === 'watermark' || box.provider === 'watermark')) {
      box.cropFormatId = format.id;
      box.templateId = format.id;
      box.watermarkPresetId = format.id;
      const cleanName = format.name.replace(/^Format:\s*/i, '');
      box.templateText = cleanName;
      box.title = cleanName;
      box.subtitle = 'Crop & Cut';
      box.targetWidth = format.targetWidth;
      box.targetHeight = format.targetHeight;
      box.aspect = format.aspect;
      box.fitMode = format.fitMode;
      box.focusPosition = format.focusPosition;
      box.cropZoom = format.cropZoom;
      if (format.watermarkConfig) {
        box.watermarkConfig = format.watermarkConfig;
      }
      return true;
    }
    return false;
  };

  // 1. Sync immediately to localStorage workflow formats
  try {
    const rawWf = localStorage.getItem('ea_workflow_formats_v2');
    if (rawWf) {
      const parsedWf = JSON.parse(rawWf);
      if (Array.isArray(parsedWf)) {
        let changed = false;
        parsedWf.forEach((wf: any) => {
          if (wf.config?.aiBoxes && Array.isArray(wf.config.aiBoxes)) {
            wf.config.aiBoxes.forEach((b: any) => {
              if (updateBox(b)) changed = true;
            });
          }
        });
        if (changed) {
          localStorage.setItem('ea_workflow_formats_v2', JSON.stringify(parsedWf));
        }
      }
    }
  } catch (e) {}

  // 2. Sync immediately to localStorage Facebook workflow config
  try {
    const rawFb = localStorage.getItem('ea_facebook_workflow_config_v2');
    if (rawFb) {
      const parsedFb = JSON.parse(rawFb);
      if (parsedFb.aiBoxes && Array.isArray(parsedFb.aiBoxes)) {
        let changed = false;
        parsedFb.aiBoxes.forEach((b: any) => {
          if (updateBox(b)) changed = true;
        });
        if (changed) {
          localStorage.setItem('ea_facebook_workflow_config_v2', JSON.stringify(parsedFb));
        }
      }
    }
  } catch (e) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ea_workflow_updated'));
    window.dispatchEvent(new CustomEvent('ea_crop_formats_updated', { detail: getSavedCropFormats() }));
  }

  // 3. Sync to backend API
  try {
    const res = await fetch('http://localhost:8085/api/workflow/config');
    if (!res.ok) return;
    const data = await res.json();
    let modified = false;

    if (Array.isArray(data.workflow_formats)) {
      data.workflow_formats.forEach((wf: any) => {
        if (wf.config?.aiBoxes && Array.isArray(wf.config.aiBoxes)) {
          wf.config.aiBoxes.forEach((b: any) => {
            if (updateBox(b)) modified = true;
          });
        }
      });
    }

    if (data.facebook_import_workflow?.aiBoxes && Array.isArray(data.facebook_import_workflow.aiBoxes)) {
      data.facebook_import_workflow.aiBoxes.forEach((b: any) => {
        if (updateBox(b)) modified = true;
      });
    }

    if (modified) {
      await fetch('http://localhost:8085/api/workflow/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }
  } catch (e) {
    console.warn('Failed to sync updated crop format to backend workflow config', e);
  }
};

let hasFetchedFromBackend = false;

export const fetchCropFormatsFromBackend = async (): Promise<CropStudioFormat[]> => {
  try {
    const res = await fetch('http://localhost:8085/api/crop-formats');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.formats) && data.formats.length > 0) {
      const serverFormats: CropStudioFormat[] = data.formats;
      hasFetchedFromBackend = true;
      localStorage.setItem(STORAGE_CROP_FORMATS_KEY, JSON.stringify(serverFormats));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ea_crop_formats_updated', { detail: serverFormats }));
      }
      return serverFormats;
    }
  } catch (err) {
    console.warn('Failed to fetch crop formats from backend API:', err);
  }
  return getSavedCropFormats();
};

export const getSavedCropFormats = (): CropStudioFormat[] => {
  if (!hasFetchedFromBackend && typeof window !== 'undefined') {
    hasFetchedFromBackend = true;
    fetchCropFormatsFromBackend().catch(() => {});
  }

  try {
    const raw = localStorage.getItem(STORAGE_CROP_FORMATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Return existing user formats directly, preserving custom names and edits
        const cleaned = parsed.map((fmt: CropStudioFormat) => {
          // If FB Format was inadvertently assigned raw image dimensions (e.g. 960x1706) or 1200x1200, restore 1080x1350 (4:5)
          if (
            fmt.id === 'format-1792362113668' &&
            ((fmt.targetWidth === 960 && fmt.targetHeight === 1706) ||
             (fmt.targetWidth === 1200 && fmt.targetHeight === 1200) ||
             fmt.aspect === '960:1706')
          ) {
            return {
              ...fmt,
              targetWidth: 1080,
              targetHeight: 1350,
              aspect: '4:5',
              updatedAt: Date.now(),
            };
          }
          return fmt;
        });

        // Ensure newly supported presets (like FB Hero Cut and Original 1774×887 Format) are present if not already added
        const hasHeroCut = cleaned.some((f: CropStudioFormat) => f.id === 'format-grid-2split' || f.name.toLowerCase().includes('hero cut'));
        if (!hasHeroCut) {
          const defaultHeroCut = INITIAL_CROP_FORMATS.find((f) => f.id === 'format-grid-2split');
          if (defaultHeroCut) {
            cleaned.unshift(defaultHeroCut);
            try {
              localStorage.setItem(STORAGE_CROP_FORMATS_KEY, JSON.stringify(cleaned));
            } catch (e) {}
          }
        }

        const has1774 = cleaned.some((f: CropStudioFormat) => f.id === 'format-1774-887' || f.name.includes('1774'));
        if (!has1774) {
          const default1774 = INITIAL_CROP_FORMATS.find((f) => f.id === 'format-1774-887');
          if (default1774) {
            cleaned.splice(1, 0, default1774);
            try {
              localStorage.setItem(STORAGE_CROP_FORMATS_KEY, JSON.stringify(cleaned));
            } catch (e) {}
          }
        }

        return cleaned;
      }
    }
  } catch (e) {
    console.error('Failed to load saved crop formats', e);
  }
  return INITIAL_CROP_FORMATS;
};

export const saveCropFormatsList = (formats: CropStudioFormat[]) => {
  try {
    localStorage.setItem(STORAGE_CROP_FORMATS_KEY, JSON.stringify(formats));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ea_crop_formats_updated', { detail: formats }));
    }
  } catch (e) {
    console.error('Failed to save crop formats', e);
  }

  // Persist to backend database JSON store immediately
  try {
    fetch('http://localhost:8085/api/crop-formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formats }),
    }).catch((err) => {
      console.warn('Failed to save crop formats to backend API:', err);
    });
  } catch (err) {
    console.warn('Failed to dispatch save crop formats:', err);
  }
};

export const updateCropFormat = (
  id: string,
  updates: Partial<CropStudioFormat>
): CropStudioFormat | null => {
  const formats = getSavedCropFormats();
  const index = formats.findIndex((f) => f.id === id);
  if (index === -1) return null;

  const updated: CropStudioFormat = {
    ...formats[index],
    ...updates,
    updatedAt: Date.now(),
  };

  const nextList = [...formats];
  nextList[index] = updated;
  saveCropFormatsList(nextList);
  syncCropFormatToWorkflowConfig(updated);
  return updated;
};

export const renameCropFormat = (id: string, newName: string): CropStudioFormat | null => {
  if (!newName.trim()) return null;
  return updateCropFormat(id, { name: newName.trim() });
};

export const saveNewCropFormat = (
  formatData: Omit<CropStudioFormat, 'id' | 'createdAt' | 'updatedAt'>
): CropStudioFormat => {
  const formats = getSavedCropFormats();
  const newFormat: CropStudioFormat = {
    ...formatData,
    id: `format-${Date.now()}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const nextList = [newFormat, ...formats];
  saveCropFormatsList(nextList);
  setActiveCropFormatId(newFormat.id);
  syncCropFormatToWorkflowConfig(newFormat);
  return newFormat;
};

export const deleteCropFormat = (id: string): CropStudioFormat[] => {
  const formats = getSavedCropFormats();
  const nextList = formats.filter((f) => f.id !== id);
  saveCropFormatsList(nextList);
  const activeId = getActiveCropFormatId();
  if (activeId === id) {
    setActiveCropFormatId(nextList[0]?.id || '');
  }
  return nextList;
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ea_active_crop_format_changed', { detail: id }));
    }
  } catch (e) {}
};

export const getActiveCropFormat = (): CropStudioFormat => {
  const formats = getSavedCropFormats();
  const activeId = getActiveCropFormatId();
  return formats.find((f) => f.id === activeId) || formats[0] || INITIAL_CROP_FORMATS[0];
};

export interface FormattedCropSlice {
  url: string;
  tileIndex: number;
  totalTiles: number;
  label: string;
  width: number;
  height: number;
  aspect: string;
}

/**
 * High-performance offscreen canvas helper to format any image
 * using a given CropStudioFormat (aspect, dimensions, fit, anchor, zoom, grid splits & watermarks).
 * Returns array of slices: 1 item for standard crop, or multiple items for grid split layouts.
 */
export const formatImageWithCropFormatSlices = async (
  imgSrc: string,
  format: CropStudioFormat
): Promise<FormattedCropSlice[]> => {
  const fallbackItem: FormattedCropSlice = {
    url: imgSrc,
    tileIndex: 1,
    totalTiles: 1,
    label: format.name || 'Photo',
    width: format.targetWidth || 1200,
    height: format.targetHeight || 1200,
    aspect: format.aspect || '1:1',
  };

  try {
    const img = await loadImageElement(imgSrc);
    const naturalW = img.naturalWidth || img.width || 1200;
    const naturalH = img.naturalHeight || img.height || 1200;
    const mime = imgSrc.includes('.png') ? 'image/png' : imgSrc.includes('.webp') ? 'image/webp' : 'image/jpeg';

        // Resolve effective watermark:
        // Priority 1: format.watermarkConfig if present and explicitly defined
        // Priority 2: active studio watermark from loadActiveWatermarkConfig if active
        let effectiveWatermark: WatermarkConfig | null = null;
        if (format.watermarkConfig && typeof format.watermarkConfig.enabled === 'boolean') {
          if (format.watermarkConfig.enabled) {
            effectiveWatermark = format.watermarkConfig;
          }
        } else if (typeof window !== 'undefined') {
          try {
            const activeWk = loadActiveWatermarkConfig();
            if (activeWk?.config?.enabled) {
              effectiveWatermark = activeWk.config;
            }
          } catch {}
        }

        const isGrid =
          format.mode === 'grid' ||
          Boolean(format.gridLayoutId) ||
          (format.description && format.description.toLowerCase().includes('swipe tiles')) ||
          (format.description && format.description.toLowerCase().includes('tile')) ||
          (format.name && format.name.toLowerCase().includes('cut')) ||
          (format.name && format.name.toLowerCase().includes('split')) ||
          (format.name && format.name.toLowerCase().includes('grid'));

        if (isGrid) {
          // Define tiles based on gridLayoutId or default 2-split
          const layoutId = format.gridLayoutId || 'two-squares';
          let tiles: Array<{
            id: number;
            label: string;
            x: number;
            y: number;
            w: number;
            h: number;
            focus: WatermarkPosition;
          }> = [];

          if (
            layoutId === 'two-squares' ||
            (!format.gridLayoutId && (format.description?.includes('2') || format.name?.toLowerCase().includes('hero') || format.name?.toLowerCase().includes('cut')))
          ) {
            tiles = [
              { id: 1, label: 'Left Half (1/2)', x: 0, y: 0, w: 0.5, h: 1, focus: 'center-right' },
              { id: 2, label: 'Right Half (2/2)', x: 0.5, y: 0, w: 0.5, h: 1, focus: 'center-left' },
            ];
          } else if (layoutId === 'three-squares') {
            tiles = [
              { id: 1, label: 'Top Banner (1/3)', x: 0, y: 0, w: 1, h: 0.52, focus: 'center' },
              { id: 2, label: 'Bottom Left (2/3)', x: 0, y: 0.52, w: 0.5, h: 0.48, focus: 'center-right' },
              { id: 3, label: 'Bottom Right (3/3)', x: 0.5, y: 0.52, w: 0.5, h: 0.48, focus: 'center-left' },
            ];
          } else if (layoutId === 'four-squares') {
            tiles = [
              { id: 1, label: 'Top Left (1/4)', x: 0, y: 0, w: 0.5, h: 0.5, focus: 'bottom-right' },
              { id: 2, label: 'Top Right (2/4)', x: 0.5, y: 0, w: 0.5, h: 0.5, focus: 'bottom-left' },
              { id: 3, label: 'Bottom Left (3/4)', x: 0, y: 0.5, w: 0.5, h: 0.5, focus: 'top-right' },
              { id: 4, label: 'Bottom Right (4/4)', x: 0.5, y: 0.5, w: 0.5, h: 0.5, focus: 'top-left' },
            ];
          } else {
            tiles = [
              { id: 1, label: 'Left Half (1/2)', x: 0, y: 0, w: 0.5, h: 1, focus: 'center-right' },
              { id: 2, label: 'Right Half (2/2)', x: 0.5, y: 0, w: 0.5, h: 1, focus: 'center-left' },
            ];
          }

          const tileOutW = format.targetWidth || 1200;
          const tileOutH = format.targetHeight || 1200;
          const slices: FormattedCropSlice[] = [];

          for (const tile of tiles) {
            const tileRawX = Math.round(tile.x * naturalW);
            const tileRawY = Math.round(tile.y * naturalH);
            const tileRawW = Math.round(tile.w * naturalW);
            const tileRawH = Math.round(tile.h * naturalH);

            const focusPos = format.tileFocusMap?.[tile.id] || tile.focus;
            const focusCoord = FOCUS_COORDS[focusPos] || { x: 0.5, y: 0.5 };

            const targetAspect = tileOutW / (tileOutH || 1);
            const tileAspect = tileRawW / (tileRawH || 1);

            let cropW = tileRawW;
            let cropH = tileRawH;

            if (tileAspect > targetAspect) {
              cropW = Math.round(tileRawH * targetAspect);
              cropH = tileRawH;
            } else {
              cropW = tileRawW;
              cropH = Math.round(tileRawW / targetAspect);
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

            if (format.useWatermarkOnTiles !== false && effectiveWatermark && effectiveWatermark.enabled) {
              await drawWatermarkOnContext(ctx, tileOutW, tileOutH, effectiveWatermark);
            }

            slices.push({
              url: canvas.toDataURL(mime, 0.95),
              tileIndex: tile.id,
              totalTiles: tiles.length,
              label: tile.label,
              width: tileOutW,
              height: tileOutH,
              aspect: format.aspect || '1:1',
            });
          }

          if (slices.length > 0) {
            return slices;
          }
        }

        // Standard Single-Image Crop:
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
          return [fallbackItem];
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

        if (effectiveWatermark && effectiveWatermark.enabled) {
          await drawWatermarkOnContext(ctx, width, height, effectiveWatermark);
        }

        return [
          {
            url: canvas.toDataURL(mime, 0.95),
            tileIndex: 1,
            totalTiles: 1,
            label: format.name || 'Photo',
            width,
            height,
            aspect: format.aspect || '1:1',
          },
        ];
      } catch (err) {
        console.warn('Canvas crop formatting error, falling back to original', err);
        return [fallbackItem];
      }
    };

/**
 * High-performance offscreen canvas helper to format any image
 * using a given CropStudioFormat (aspect, dimensions, fit, anchor, zoom).
 */
export const formatImageWithCropFormat = async (
  imgSrc: string,
  format: CropStudioFormat
): Promise<string> => {
  const slices = await formatImageWithCropFormatSlices(imgSrc, format);
  return slices[0]?.url || imgSrc;
};
