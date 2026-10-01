import type { FacebookWorkflowConfig, DynamicAIBoxConfig } from '../facebook-import/FacebookWorkflowCanvas';
import { DEFAULT_FB_WORKFLOW_CONFIG } from '../facebook-import/FacebookWorkflowCanvas';

export interface WorkflowFormat {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
  config: FacebookWorkflowConfig;
}

const STORAGE_FORMATS_KEY = 'estate_saved_workflow_formats_v2';
const STORAGE_SELECTED_FORMAT_ID_KEY = 'estate_active_workflow_format_id_v2';

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
        y: 80,
      },
      getImages: {
        enabled: true,
        downloadHD: true,
        preserveOrder: true,
        watermark: false,
        x: 340,
        y: 380,
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
          x: 680,
          y: 50,
        },
        {
          id: 'ai-box-tiktok',
          title: 'TikTok Viral Hook & Video Script',
          processType: 'tiktok',
          provider: 'openai',
          model: 'gpt-4o',
          templateId: '2',
          templateText:
            'Create a viral 15-second TikTok script for this property.\nHook in the first 3 seconds, 3 quick visual highlights, and clear urgent call-to-action.',
          customPrompt: '',
          enabled: true,
          x: 680,
          y: 330,
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
        y: 80,
      },
      getImages: {
        enabled: true,
        downloadHD: true,
        preserveOrder: true,
        watermark: true,
        x: 340,
        y: 380,
      },
      aiBoxes: [
        {
          id: 'ai-box-sale',
          title: 'Facebook Sale & Investment Pitch',
          processType: 'sale',
          provider: 'openai',
          model: 'gpt-4o',
          templateId: '3',
          templateText:
            'Write a professional sales copy for property sale.\nHighlight investment rental yield %, capital appreciation, BTS access, and sale price.\nAdd professional Line ID CTA.',
          customPrompt: '',
          enabled: true,
          x: 680,
          y: 50,
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
          x: 680,
          y: 330,
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
        y: 80,
      },
      getImages: {
        enabled: true,
        downloadHD: true,
        preserveOrder: true,
        watermark: false,
        x: 340,
        y: 380,
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
          x: 680,
          y: 180,
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
        y: 80,
      },
      getImages: {
        enabled: false,
        downloadHD: false,
        preserveOrder: false,
        watermark: false,
        x: 340,
        y: 380,
      },
      aiBoxes: [
        {
          id: 'ai-box-translation',
          title: 'Thai to English Translation',
          processType: 'rental',
          provider: 'openai',
          model: 'gpt-4o',
          templateId: '1',
          templateText:
            'Translate and polish the Thai listing into fluent, professional English for foreign expats.\nFormat with clean emojis, price in THB, and near BTS/MRT.',
          customPrompt: '',
          enabled: true,
          x: 680,
          y: 50,
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
          x: 680,
          y: 330,
        },
      ],
    },
  },
];

export const getSavedWorkflowFormats = (): WorkflowFormat[] => {
  try {
    const raw = localStorage.getItem(STORAGE_FORMATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load saved workflow formats', e);
  }
  return INITIAL_DEFAULT_FORMATS;
};

export const saveWorkflowFormatsList = (formats: WorkflowFormat[]) => {
  try {
    localStorage.setItem(STORAGE_FORMATS_KEY, JSON.stringify(formats));
    // Sync with backend API
    fetch('http://localhost:8085/api/workflow/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_formats: formats,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch (e) {
    console.error('Failed to save workflow formats', e);
  }
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
