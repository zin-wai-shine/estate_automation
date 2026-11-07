import type {
  FacebookWorkflowConfig,
  DynamicAIBoxConfig,
  WorkflowWireConnection,
  CombineBoxConfig,
  DestinationNodeConfig,
} from '../facebook-import/FacebookWorkflowCanvas';
import {
  DEFAULT_FB_WORKFLOW_CONFIG,
  sanitizeAndResolveCollisions,
  stripLargeBase64FromWorkflowConfig,
} from '../facebook-import/FacebookWorkflowCanvas';

export interface WorkflowFormat {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
  config: FacebookWorkflowConfig;
}

const STORAGE_FORMATS_KEY = 'estate_saved_workflow_formats_v2';
const STORAGE_SELECTED_FORMAT_ID_KEY = 'estate_active_workflow_format_id_v2';
const STORAGE_PINNED_FORMAT_ID_KEY = 'estate_pinned_workflow_format_id_v2';

export const getPinnedWorkflowFormatId = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_PINNED_FORMAT_ID_KEY);
    if (saved !== null) return saved;
  } catch (e) {}
  return getActiveWorkflowFormatId();
};

export const setPinnedWorkflowFormatId = (id: string) => {
  try {
    localStorage.setItem(STORAGE_PINNED_FORMAT_ID_KEY, id);
  } catch (e) {}
};

export const INITIAL_DEFAULT_FORMATS: WorkflowFormat[] = [
  {
    id: 'format-standard-rental',
    name: 'Standard Rental Listing (Thai & English)',
    description: 'Extracts caption and HD photos, generates dual-language rental copy and TikTok script',
    isDefault: true,
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now(),
    config: {
      ...DEFAULT_FB_WORKFLOW_CONFIG,
      getContent: {
        enabled: true,
        extractPrice: true,
        extractSpecs: true,
        cleanThai: true,
        extractContacts: true,
        x: 340,
        y: 110,
      },
      getImages: {
        enabled: true,
        downloadHD: true,
        preserveOrder: true,
        watermark: false,
        x: 340,
        y: 390,
      },
      aiBoxes: [
        {
          id: 'ai-box-rental',
          title: 'Thai/EN Rental Listing Copy',
          processType: 'rental',
          provider: 'google_ai',
          model: 'gemini-flash-latest',
          templateId: '1',
          templateText:
            'Transform the raw Facebook post into a compelling high-converting condo rental listing.\nHighlight: Rent Price, BTS/MRT station, Unit Size, Room Layout, Deposit terms, and Line ID CTA.\nLanguages: Thai primary, English summary.',
          customPrompt: '',
          enabled: true,
          x: 640,
          y: 80,
        },
        {
          id: 'ai-box-tiktok',
          title: 'TikTok Viral Hook & Video Script',
          processType: 'tiktok',
          provider: 'google_ai',
          model: 'gemini-flash-latest',
          templateId: '2',
          templateText:
            'Create a viral 15-second TikTok script for this property.\nHook in the first 3 seconds, 3 quick visual highlights, and clear urgent call-to-action.',
          customPrompt: '',
          enabled: true,
          x: 640,
          y: 230,
        },
      ],
    },
  },
  {
    id: 'format-condo-sale',
    name: 'Condo Sale & Yield Summary',
    description: 'Focused on property sale marketing, ROI yield calculation, and LINE OA customer blast',
    isDefault: false,
    createdAt: Date.now() - 3600000 * 12,
    updatedAt: Date.now(),
    config: {
      ...DEFAULT_FB_WORKFLOW_CONFIG,
      getContent: {
        enabled: true,
        extractPrice: true,
        extractSpecs: true,
        cleanThai: true,
        extractContacts: true,
        x: 340,
        y: 110,
      },
      getImages: {
        enabled: true,
        downloadHD: true,
        preserveOrder: true,
        watermark: true,
        x: 340,
        y: 390,
      },
      aiBoxes: [
        {
          id: 'ai-box-sale',
          title: 'Facebook Sale & Investment Pitch',
          processType: 'sale',
          provider: 'google_ai',
          model: 'gemini-1.5-pro',
          templateId: '3',
          templateText:
            'Write a professional sales copy for property sale.\nHighlight investment rental yield %, capital appreciation, BTS access, and sale price.\nAdd professional Line ID CTA.',
          customPrompt: '',
          enabled: true,
          x: 640,
          y: 80,
        },
        {
          id: 'ai-box-line-oa',
          title: 'LINE Official Broadcast Blast',
          processType: 'line_oa',
          provider: 'google_ai',
          model: 'gemini-1.5-pro',
          templateId: '1',
          templateText:
            'Craft an exclusive LINE Official broadcast message for VIP buyers.\nConcise bullet points, pricing, room specs, and direct appointment link.',
          customPrompt: '',
          enabled: true,
          x: 640,
          y: 230,
        },
      ],
    },
  },
  {
    id: 'format-media-only',
    name: 'High-Res Photos & Media Only (Fast)',
    description: 'Bypasses caption text processing to rapidly download and preserve ordered listing photos',
    isDefault: false,
    createdAt: Date.now() - 3600000 * 6,
    updatedAt: Date.now(),
    config: {
      ...DEFAULT_FB_WORKFLOW_CONFIG,
      getContent: {
        enabled: false,
        extractPrice: false,
        extractSpecs: false,
        cleanThai: false,
        extractContacts: false,
        x: 340,
        y: 110,
      },
      getImages: {
        enabled: true,
        downloadHD: true,
        preserveOrder: true,
        watermark: false,
        x: 340,
        y: 390,
      },
      aiBoxes: [
        {
          id: 'ai-box-media-caption',
          title: 'Quick Image Caption & Tags',
          processType: 'seo_tags',
          provider: 'google_ai',
          model: 'gemini-flash-latest',
          templateId: '1',
          templateText: 'Generate clean photo captions and high-engagement social media hashtags.',
          customPrompt: '',
          enabled: true,
          x: 640,
          y: 160,
        },
      ],
    },
  },
  {
    id: 'format-content-only',
    name: 'Text & English Translation Only',
    description: 'Extracts post caption and specifications without downloading photos, translates to English',
    isDefault: false,
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now(),
    config: {
      ...DEFAULT_FB_WORKFLOW_CONFIG,
      getContent: {
        enabled: true,
        extractPrice: true,
        extractSpecs: true,
        cleanThai: true,
        extractContacts: true,
        x: 340,
        y: 110,
      },
      getImages: {
        enabled: false,
        downloadHD: false,
        preserveOrder: false,
        watermark: false,
        x: 340,
        y: 390,
      },
      aiBoxes: [
        {
          id: 'ai-box-translation',
          title: 'Thai to English Translation',
          processType: 'rental',
          provider: 'google_ai',
          model: 'gemini-flash-latest',
          templateId: '1',
          templateText:
            'Translate and polish the Thai listing into fluent, professional English for foreign expats.\nFormat with clean emojis, price in THB, and near BTS/MRT.',
          customPrompt: '',
          enabled: true,
          x: 640,
          y: 80,
        },
        {
          id: 'ai-box-seo',
          title: 'SEO Keywords & Hashtags',
          processType: 'seo_tags',
          provider: 'google_ai',
          model: 'gemini-flash-latest',
          templateId: '1',
          templateText: 'Generate 20 top-ranking real estate hashtags for Bangkok condos and rentals.',
          customPrompt: '',
          enabled: true,
          x: 640,
          y: 230,
        },
      ],
    },
  },
];

/**
 * Deep-clones a workflow configuration and gives all AI boxes, combine boxes,
 * destinations, and wire connections fresh unique IDs, re-mapping all internal
 * connections and input references so the cloned configuration is completely
 * isolated from its source.
 */
export const ensureIsolatedWorkflowConfig = (
  config: FacebookWorkflowConfig,
  suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
): FacebookWorkflowConfig => {
  if (!config) return config;
  const cloned: FacebookWorkflowConfig = JSON.parse(JSON.stringify(config));
  const idMap = new Map<string, string>();

  // 1. Map AI Boxes
  if (Array.isArray(cloned.aiBoxes)) {
    cloned.aiBoxes.forEach((b) => {
      if (b && b.id) {
        const newId = `${b.id}-cp-${suffix}`;
        idMap.set(b.id, newId);
        b.id = newId;
      }
    });
  }

  // 2. Map Combine Boxes
  if (Array.isArray(cloned.combineBoxes)) {
    cloned.combineBoxes.forEach((cb) => {
      if (cb && cb.id) {
        const newId = `${cb.id}-cp-${suffix}`;
        idMap.set(cb.id, newId);
        cb.id = newId;
      }
    });
  }

  // 3. Map Destinations
  if (Array.isArray(cloned.destinations)) {
    cloned.destinations.forEach((d) => {
      if (d && d.id) {
        const newId = `${d.id}-cp-${suffix}`;
        idMap.set(d.id, newId);
        d.id = newId;
      }
    });
  }

  // 4. Remap AI Box internal references
  if (Array.isArray(cloned.aiBoxes)) {
    cloned.aiBoxes.forEach((b) => {
      if (b) {
        if (b.selectedUpstreamAiId && idMap.has(b.selectedUpstreamAiId)) {
          b.selectedUpstreamAiId = idMap.get(b.selectedUpstreamAiId);
        }
        if (b.condoNameAiBoxId && idMap.has(b.condoNameAiBoxId)) {
          b.condoNameAiBoxId = idMap.get(b.condoNameAiBoxId);
        }
        if (b.selectedUpstreamGroupId && idMap.has(b.selectedUpstreamGroupId)) {
          b.selectedUpstreamGroupId = idMap.get(b.selectedUpstreamGroupId);
        }
        if (Array.isArray(b.presetOrder)) {
          b.presetOrder = b.presetOrder.map((id) => idMap.get(id) || id);
        }
      }
    });
  }

  // 5. Remap Combine Boxes inputOrder & presetOrder
  if (Array.isArray(cloned.combineBoxes)) {
    cloned.combineBoxes.forEach((cb) => {
      if (cb) {
        if (Array.isArray(cb.inputOrder)) {
          cb.inputOrder = cb.inputOrder.map((id) => idMap.get(id) || id);
        }
        if (Array.isArray(cb.presetOrder)) {
          cb.presetOrder = cb.presetOrder.map((id) => idMap.get(id) || id);
        }
      }
    });
  }

  // 6. Remap Connections
  if (Array.isArray(cloned.connections)) {
    cloned.connections = cloned.connections.map((conn) => ({
      ...conn,
      id: `wire-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fromNodeId: idMap.get(conn.fromNodeId) || conn.fromNodeId,
      toNodeId: idMap.get(conn.toNodeId) || conn.toNodeId,
    }));
  }

  return cloned;
};

/**
 * Checks all formats in a list to guarantee that no two formats share identical node IDs.
 * If a duplicate or copied format is detected with overlapping node IDs, it is automatically
 * remapped to isolated unique IDs.
 */
export const ensureFormatsAreIsolated = (formats: WorkflowFormat[]): WorkflowFormat[] => {
  if (!Array.isArray(formats) || formats.length <= 1) return formats;

  const seenBoxIds = new Set<string>();
  let hasModified = false;

  const isolated = formats.map((format, index) => {
    if (!format || !format.config) return format;
    const cfg = format.config;
    const aiBoxes = Array.isArray(cfg.aiBoxes) ? cfg.aiBoxes : [];

    // Check if this format contains any box ID already owned by an earlier format
    const hasCollision = index > 0 && aiBoxes.some((b) => b && b.id && seenBoxIds.has(b.id));

    if (hasCollision) {
      hasModified = true;
      const isolatedCfg = ensureIsolatedWorkflowConfig(cfg, format.id || `cp-${index}`);
      (isolatedCfg.aiBoxes || []).forEach((b) => {
        if (b && b.id) seenBoxIds.add(b.id);
      });
      return {
        ...format,
        config: isolatedCfg,
      };
    } else {
      aiBoxes.forEach((b) => {
        if (b && b.id) seenBoxIds.add(b.id);
      });
      return format;
    }
  });

  if (hasModified) {
    try {
      localStorage.setItem(STORAGE_FORMATS_KEY, JSON.stringify(isolated));
    } catch {}
  }

  return isolated;
};

export const getSavedWorkflowFormats = (): WorkflowFormat[] => {
  const pinnedId = getPinnedWorkflowFormatId();
  try {
    const raw = localStorage.getItem(STORAGE_FORMATS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const formatted = parsed.map((format: WorkflowFormat) => {
          const isPinned = pinnedId ? format.id === pinnedId : Boolean(format.isPinned);
          if (!format.config) return { ...format, isPinned };
          return {
            ...format,
            isPinned,
            config: sanitizeAndResolveCollisions(format.config, format.id),
          };
        });
        return ensureFormatsAreIsolated(formatted);
      }
    }
  } catch (e) {
    console.error('Failed to load saved workflow formats', e);
  }
  return ensureFormatsAreIsolated(
    INITIAL_DEFAULT_FORMATS.map((f) => ({
      ...f,
      isPinned: pinnedId ? f.id === pinnedId : Boolean(f.isPinned),
      config: sanitizeAndResolveCollisions(f.config, f.id),
    }))
  );
};

export const restoreDefaultWorkflowFormats = (): WorkflowFormat[] => {
  const defaults = INITIAL_DEFAULT_FORMATS.map((f) => ({
    ...f,
    config: sanitizeAndResolveCollisions(f.config, f.id),
  }));
  saveWorkflowFormatsList(defaults);
  if (defaults[0]) {
    setActiveWorkflowFormatId(defaults[0].id);
  }
  return defaults;
};

let saveBackendDebounceTimer: any = null;

export const saveWorkflowFormatsList = (formats: WorkflowFormat[]) => {
  const isolatedFormats = ensureFormatsAreIsolated(formats);

  // Synchronously save to localStorage immediately so navigating back/away preserves all node positions
  try {
    localStorage.setItem(STORAGE_FORMATS_KEY, JSON.stringify(isolatedFormats));
  } catch (e) {
    try {
      const compactFormats = isolatedFormats.map((f) =>
        f.config ? { ...f, config: stripLargeBase64FromWorkflowConfig(f.config) } : f
      );
      localStorage.setItem(STORAGE_FORMATS_KEY, JSON.stringify(compactFormats));
    } catch (err) {
      console.error('Failed to save workflow formats to localStorage', err);
    }
  }

  // Always sync with backend API debounced using relative API path (works seamlessly on both public and local)
  if (saveBackendDebounceTimer) clearTimeout(saveBackendDebounceTimer);
  saveBackendDebounceTimer = setTimeout(() => {
    fetch('/api/workflow/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_formats: isolatedFormats,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, 400);
};

export const getActiveWorkflowFormatId = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_SELECTED_FORMAT_ID_KEY);
    if (saved) return saved;
  } catch (e) {}
  return INITIAL_DEFAULT_FORMATS[0].id;
};

export const setActiveWorkflowFormatId = (id: string) => {
  try {
    localStorage.setItem(STORAGE_SELECTED_FORMAT_ID_KEY, id);
  } catch (e) {}
};

export const getActiveWorkflowFormat = (): WorkflowFormat => {
  const formats = getSavedWorkflowFormats();
  const activeId = getActiveWorkflowFormatId();
  return formats.find((f) => f.id === activeId) || formats[0] || INITIAL_DEFAULT_FORMATS[0];
};
