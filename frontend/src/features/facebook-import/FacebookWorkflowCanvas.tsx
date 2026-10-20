import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Select, type SelectGroup } from '../../components/ui/Select';
import {
  FiCpu,
  FiPlay,
  FiRefreshCw,
  FiCheckCircle,
  FiFileText,
  FiImage,
  FiZoomIn,
  FiZoomOut,
  FiMaximize2,
  FiMinimize2,
  FiCrosshair,
  FiPlus,
  FiTrash2,
  FiCopy,
  FiCheck,
  FiSliders,
  FiArrowRight,
  FiRotateCcw,
  FiSave,
  FiX,
  FiAlertTriangle,
  FiEdit2,
  FiChevronLeft,
  FiChevronRight,
  FiTerminal,
  FiShield,
  FiScissors,
  FiGrid,
  FiChevronDown,
  FiLink,
  FiZap,
  FiGlobe,
  FiLayers,
  FiSend,
  FiExternalLink,
  FiShare2,
  FiLayout,
  FiEye,
  FiThumbsUp,
  FiMessageSquare,
  FiDownload,
  FiGitMerge,
  FiFolder,
  FiCornerDownRight,
} from 'react-icons/fi';
import { FaFacebook, FaFacebookF, FaInstagram, FaTiktok } from 'react-icons/fa';
import { SiGooglegemini } from 'react-icons/si';
import { HiSparkles } from 'react-icons/hi2';
import { useScrollLock } from '../../hooks/useScrollLock';
import { AITrainingChatbot, ModelSelectorMenu, LaoZhangIcon, RunwareIcon } from './AITrainingChatbot';
import { useTheme } from '../../context/ThemeContext';
import { getAIModelDisplayName, isImageAIBox, isImageModel, isWatermarkAIBox, isEnhanceAIBox, isAIBoxConnected, isTextFormatAIBox, isTextAIBox } from './aiModelUtils';
import { AIImageStudio } from './AIImageStudio';
import { WatermarkNodeModal } from './WatermarkNodeModal';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { loadWatermarkPresets, DEFAULT_WATERMARK_CONFIG, DEFAULT_PRESETS, type WatermarkConfig } from '../autopost/watermarkStorage';
import { getSavedCropFormats, type CropStudioFormat } from '../watermark/cropFormats';
import { getStoredManagedPages, saveStoredManagedPage, DEFAULT_MANAGED_FB_PAGES, type ManagedPageMeta } from '../autopost/autoPostStorage';

export { getAIModelDisplayName, isWatermarkAIBox, isEnhanceAIBox, isTextFormatAIBox, isTextAIBox };

export interface CanvasPromptOption {
  id: string;
  name: string;
  category?: string;
  templateText: string;
  model?: string;
}

export const loadAvailablePromptTemplates = (): CanvasPromptOption[] => {
  try {
    const raw = localStorage.getItem('estate_prompt_templates');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((item: any) => item && (item.templateText || item.name))
          .map((item: any) => ({
            id: String(item.id),
            name: item.name || 'Untitled Prompt',
            category: item.category || 'GENERAL',
            templateText: item.templateText || '',
            model: item.model,
          }));
      }
    }
  } catch (e) {
    console.error('Failed to load prompt templates', e);
  }
  return [
    {
      id: '1',
      name: 'Facebook Rental Listing Copy (Thai/English)',
      category: 'FACEBOOK_RENT',
      templateText:
        'Generate an attractive Facebook real estate rental post for a condo in Bangkok.\nTitle: {title}\nPrice: {price}\nLocation: {location}\nInclude high-converting CTA and relevant hashtags.',
    },
    {
      id: '2',
      name: 'TikTok Short Video Script & Hook Generator',
      category: 'TIKTOK',
      templateText:
        'Create a viral 15-second TikTok video script for property listing {title}.\nStart with a high-curiosity hook, list 3 key highlights, and end with Line ID CTA.',
    },
    {
      id: '3',
      name: 'Facebook Property Sale Copy Template',
      category: 'FACEBOOK_SALE',
      templateText:
        'Write a professional sales copy for property sale: {title}.\nHighlight investment yield, BTS access, and price {price}.',
    },
  ];
};

export interface DynamicAIBoxConfig {
  id: string;
  title: string;
  processType?: 'rental' | 'sale' | 'tiktok' | 'line_oa' | 'seo_tags' | 'custom' | 'image_enhance' | 'watermark' | 'text_ai' | 'text_format' | string;
  provider: 'google_ai' | 'openai' | 'laozhang_ai' | 'runware_ai' | 'watermark';
  model: string;
  templateId: string;
  templateText: string;
  customPrompt: string;
  enabled: boolean;
  strength?: number;
  watermarkPresetId?: string;
  watermarkConfig?: WatermarkConfig;
  cropFormatId?: string;
  subtitle?: string;
  targetPages?: 'all' | 'first-only' | 'body-only' | 'custom';
  customPages?: string;
  x: number;
  y: number;
}

export interface WorkflowWireConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface FacebookWorkflowConfig {
  getContent: {
    enabled: boolean;
    extractPrice: boolean;
    extractSpecs: boolean;
    cleanThai: boolean;
    extractContacts: boolean;
    x: number;
    y: number;
  };
  getImages: {
    enabled: boolean;
    downloadHD: boolean;
    preserveOrder: boolean;
    watermark: boolean;
    x: number;
    y: number;
  };
  trigger: {
    enabled?: boolean;
    x: number;
    y: number;
    autoImport: boolean;
    sourceMode?: 'paste' | 'page_sync' | 'webhook';
    monitoredPageName?: string;
    monitoredPageId?: string;
    autoClassifyProperty?: boolean;
    extractAlbums?: boolean;
    extractVideoClips?: boolean;
    cleanPromotionalText?: boolean;
    syncIntervalMinutes?: number;
  };
  destination: DestinationNodeConfig;
  destinations?: DestinationNodeConfig[];
  outputNode?: OutputNodeConfig;
  combineBoxes?: CombineBoxConfig[];
  aiBoxes: DynamicAIBoxConfig[];
  connections?: WorkflowWireConnection[];
  zoom: number;
  panOffset: { x: number; y: number };
}

export interface OutputNodeConfig {
  id?: string;
  enabled?: boolean;
  x?: number;
  y?: number;
  title?: string;
  previewMode?: 'card' | 'text' | 'media';
}

export interface CombineBoxConfig {
  id: string;
  title: string;
  enabled: boolean;
  x: number;
  y: number;
}

export interface DestinationNodeConfig {
  id: string;
  enabled?: boolean;
  x: number;
  y: number;
  targetMode?: 'remaining_posts' | 'social_media' | 'hybrid';
  platform?: 'facebook' | 'instagram' | 'tiktok' | 'database';
  accountId?: string;
  accountName?: string;
  accountUsername?: string;
  accountAvatar?: string;
  storeInDatabase?: boolean; // save to database / Remaining Posts
  postToSocialMedia?: boolean; // post directly to social media
  selectedPageId?: string;
  selectedPageIds?: string[];
  platforms?: ('facebook' | 'instagram' | 'tiktok')[];
  selectedIgAccountIds?: string[];
  selectedTiktokAccountIds?: string[];
  publishDirectly?: boolean;
  includeHashtags?: boolean;
  includeFirstComment?: boolean;
  includeContent?: boolean; // include text & description from combine box
  includeImages?: boolean;  // include photos & visuals from combine box
  title?: string;
}

export interface ManagedSocialAccountMeta {
  account_id: string;
  name: string;
  username: string;
  platform: 'instagram' | 'tiktok';
  picture_url?: string;
  category?: string;
}

export const DEFAULT_MANAGED_IG_ACCOUNTS: ManagedSocialAccountMeta[] = [
  {
    account_id: 'ig-101',
    name: 'Dot BKK Living IG',
    username: '@dotbkk_living',
    platform: 'instagram',
    category: 'Real Estate Agency',
  },
  {
    account_id: 'ig-102',
    name: 'Living Space Bangkok',
    username: '@livingspace_bkk',
    platform: 'instagram',
    category: 'Property Rental',
  },
];

export const DEFAULT_MANAGED_TIKTOK_ACCOUNTS: ManagedSocialAccountMeta[] = [
  {
    account_id: 'tt-201',
    name: 'Dot BKK TikTok',
    username: '@dotbkk.living',
    platform: 'tiktok',
    category: 'Real Estate Agency',
  },
  {
    account_id: 'tt-202',
    name: 'Bangkok Condo Tour',
    username: '@bangkok.condo.hub',
    platform: 'tiktok',
    category: 'Condo Tours',
  },
];

const LOCAL_STORAGE_KEY = 'estate_fb_workflow_config_v1';

export const PROCESS_TYPE_OPTIONS = [
  { value: 'rental', label: 'FB Rental Copy (Thai/EN)' },
  { value: 'sale', label: 'FB Sale Copy (Yield & ROI)' },
  { value: 'tiktok', label: 'TikTok / Reels Video Hook' },
  { value: 'line_oa', label: 'LINE Official Broadcast' },
  { value: 'seo_tags', label: 'SEO Keywords & Hashtags' },
  { value: 'custom', label: 'Custom AI Prompt Flow' },
];

export const MODEL_OPTIONS = [
  { value: 'gemini-flash-latest', label: 'Google Gemini Flash (Ultra Fast)' },
  { value: 'gemini-1.5-pro', label: 'Google Gemini 1.5 Pro (Deep Reasoning)' },
  { value: 'gpt-4o', label: 'OpenAI GPT-4o (Omni High Precision)' },
  { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o-mini (Lightweight)' },
  { value: 'gpt-image-2.5-sunburst', label: 'OpenAI GPT Image 2.5 Sunburst' },
  { value: 'gpt-image-2.5-flare', label: 'OpenAI GPT Image 2.5 Flare' },
  { value: 'runware:upscale', label: 'Runware Upscale & Restore' },
  { value: 'runware:101@1', label: 'Runware FLUX.1 Schnell' },
  { value: 'runware:100@1', label: 'Runware SDXL Realism' },
  { value: 'civitai:133005@782002', label: 'Runware Juggernaut XL' },
  { value: 'google:nano-banana@2.1', label: 'Runware Nano Banana 2.1 (Google)' },
  { value: 'google:nano-banana@2-lite', label: 'Runware Nano Banana 2 Lite (Google)' },
];

export const RUNWARE_IMAGE_MODEL_OPTIONS = [
  { value: 'runware:101@1', label: 'Runware AI · FLUX.1 Schnell (Fastest)' },
  { value: 'runware:100@1', label: 'Runware AI · SDXL Realism' },
  { value: 'runware:102@1', label: 'Runware AI · FLUX.1 Dev (High Detail)' },
  { value: 'civitai:133005@782002', label: 'Runware AI · Juggernaut XL' },
  { value: 'google:nano-banana@2.1', label: 'Runware AI · Nano Banana 2.1 (Google)' },
  { value: 'google:nano-banana@2-lite', label: 'Runware AI · Nano Banana 2 Lite' },
  { value: 'runware:upscale', label: 'Runware AI · Upscale & Restore' },
];

export const CONTENT_AI_MODEL_OPTIONS = [
  // Google Gemini Models (Active & Verified with Available Credits)
  { value: 'google_ai|gemini-flash-latest', label: 'Google · Gemini Flash (Fast & Active)' },
  { value: 'google_ai|gemini-1.5-flash', label: 'Google · Gemini 1.5 Flash (Balanced)' },
  { value: 'google_ai|gemini-1.5-pro', label: 'Google · Gemini 1.5 Pro (Deep Reasoning)' },
  { value: 'google_ai|gemini-2.0-flash', label: 'Google · Gemini 2.0 Flash (Next Gen)' },
  { value: 'google_ai|gemini-2.5-flash', label: 'Google · Gemini 2.5 Flash (Ultra Fast)' },
  { value: 'google_ai|gemini-pro-latest', label: 'Google · Gemini Pro (High Precision)' },
];

export const AI_ENGINE_MODEL_GROUPS: SelectGroup[] = [
  {
    label: 'Google Gemini',
    options: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Ultra Fast & Precise)' },
      { value: 'gemini-flash-latest', label: 'Gemini Flash Latest' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Deep Reasoning)' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Balanced)' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Next Gen)' },
    ],
  },
  {
    label: 'OpenAI',
    options: [
      { value: 'gpt-4o', label: 'GPT-4o (High Precision)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o-mini (Lightweight & Fast)' },
    ],
  },
];

export const DEFAULT_FB_WORKFLOW_CONFIG: FacebookWorkflowConfig = {
  trigger: {
    enabled: false,
    x: 100,
    y: 232,
    autoImport: true,
    sourceMode: 'paste',
    monitoredPageName: 'Bangkok Real Estate & Condo Exchange',
    monitoredPageId: 'fb-page-living-bkk',
    autoClassifyProperty: true,
    extractAlbums: true,
    extractVideoClips: true,
    cleanPromotionalText: true,
    syncIntervalMinutes: 5,
  },
  getContent: {
    enabled: false,
    extractPrice: true,
    extractSpecs: true,
    cleanThai: true,
    extractContacts: true,
    x: 300,
    y: 140,
  },
  getImages: {
    enabled: false,
    downloadHD: true,
    preserveOrder: true,
    watermark: false,
    x: 300,
    y: 323,
  },
  aiBoxes: [],
  combineBoxes: [],
  connections: [],
  outputNode: {
    id: 'output',
    enabled: true,
    x: 740,
    y: 248,
    title: 'Final Content & Images',
  },
  destination: {
    id: 'destination',
    enabled: true,
    x: 960,
    y: 248,
    targetMode: 'hybrid',
    storeInDatabase: true,
    postToSocialMedia: true,
    selectedPageId: '1287202894475973',
    selectedPageIds: ['1287202894475973'],
    selectedIgAccountIds: ['ig-1'],
    selectedTiktokAccountIds: ['tt-1'],
    publishDirectly: true,
    includeHashtags: true,
    includeFirstComment: false,
    title: 'Social & Database Storage',
  },
  destinations: [
    {
      id: 'destination',
      enabled: true,
      x: 960,
      y: 248,
      targetMode: 'hybrid',
      storeInDatabase: true,
      postToSocialMedia: true,
      selectedPageId: '1287202894475973',
      selectedPageIds: ['1287202894475973'],
      selectedIgAccountIds: ['ig-1'],
      selectedTiktokAccountIds: ['tt-1'],
      publishDirectly: true,
      includeHashtags: true,
      includeFirstComment: false,
      title: 'Social & Database Storage',
    },
  ],
  zoom: 0.9,
  panOffset: { x: 500, y: 180 },
};

export const getNormalizedDestinations = (conf: FacebookWorkflowConfig): DestinationNodeConfig[] => {
  if (!conf) return [DEFAULT_FB_WORKFLOW_CONFIG.destination];
  if (Array.isArray(conf.destinations) && conf.destinations.length > 0) {
    return conf.destinations.map((d, i) => ({
      ...d,
      id: d.id || (i === 0 ? 'destination' : `dest-${i}`),
      storeInDatabase: d.storeInDatabase ?? (d.targetMode !== 'social_media'),
      postToSocialMedia: d.postToSocialMedia ?? (d.targetMode !== 'remaining_posts'),
      selectedPageIds: d.selectedPageIds || (d.selectedPageId ? [d.selectedPageId] : ['1287202894475973']),
      enabled: d.enabled !== false,
      title: d.title || (d.targetMode === 'remaining_posts' ? 'Remaining Posts' : 'Social Media'),
    }));
  }
  const dest = conf.destination || DEFAULT_FB_WORKFLOW_CONFIG.destination;
  return [{
    ...dest,
    id: dest.id || 'destination',
    storeInDatabase: dest.storeInDatabase ?? (dest.targetMode !== 'social_media'),
    postToSocialMedia: dest.postToSocialMedia ?? (dest.targetMode !== 'remaining_posts'),
    selectedPageIds: dest.selectedPageIds || (dest.selectedPageId ? [dest.selectedPageId] : ['1287202894475973']),
    enabled: dest.enabled !== false,
    title: dest.title || (dest.targetMode === 'remaining_posts' ? 'Remaining Posts' : 'Social Media'),
  }];
};

export const dedupeConnections = (connList: WorkflowWireConnection[] | undefined): WorkflowWireConnection[] => {
  if (!connList || !Array.isArray(connList)) return [];
  const seen = new Set<string>();
  return connList.filter((c) => {
    if (!c || !c.fromNodeId || !c.toNodeId || c.fromNodeId === c.toNodeId) return false;
    const key = `${c.fromNodeId}->${c.toNodeId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Auto-connects workflow pipeline nodes cleanly:
 * - Trigger -> Get Content & Get Images
 * - Get Content -> all Content AI models (forking branches)
 * - Get Images -> Enhancer -> all Watermark / Format nodes (forking branches)
 * - Endpoints -> Combine Box (if present) OR Output node -> Destinations
 * - Eliminates duplicate wires, phantom endpoints, and self-loops.
 */
export const autoConnectWorkflow = (
  boxes: DynamicAIBoxConfig[],
  existingConns: WorkflowWireConnection[] = [],
  getContentEnabled: boolean = true,
  getImagesEnabled: boolean = true,
  destinationEnabled: boolean = true,
  outputEnabled: boolean = true,
  destinations: DestinationNodeConfig[] = [],
  combineBoxes: CombineBoxConfig[] = []
): WorkflowWireConnection[] => {
  let conns = (existingConns || []).filter(Boolean);

  const activeCombineBoxes = (combineBoxes || []).filter((cb) => cb && cb.enabled !== false);
  const hasCombine = activeCombineBoxes.length > 0;
  const primaryCombineId = hasCombine ? activeCombineBoxes[0].id : null;

  // When Combine Boxes exist, the Output node is superseded/hidden
  const effectiveOutputEnabled = !hasCombine && outputEnabled;

  if (hasCombine && primaryCombineId) {
    // Migrate any legacy connections referencing 'output' to the primary combine box
    conns = conns.map((c) => ({
      ...c,
      fromNodeId: c.fromNodeId === 'output' ? primaryCombineId : c.fromNodeId,
      toNodeId: c.toNodeId === 'output' ? primaryCombineId : c.toNodeId,
    }));
  }

  // Remove self-connections
  conns = conns.filter((c) => c.fromNodeId !== c.toNodeId);

  if (!getContentEnabled) {
    conns = conns.filter((c) => c.fromNodeId !== 'get-content' && c.toNodeId !== 'get-content');
  }
  if (!getImagesEnabled) {
    conns = conns.filter((c) => c.fromNodeId !== 'get-images' && c.toNodeId !== 'get-images');
  }
  if (!destinationEnabled) {
    conns = conns.filter(
      (c) =>
        c.fromNodeId !== 'destination' &&
        c.toNodeId !== 'destination' &&
        !c.fromNodeId.startsWith('dest-') &&
        !c.toNodeId.startsWith('dest-')
    );
  }

  const enhanceBoxes = boxes.filter((b) => isEnhanceAIBox(b, conns));
  const watermarkBoxes = boxes.filter((b) => isWatermarkAIBox(b));
  const textFormatBoxes = boxes.filter((b) => isTextFormatAIBox(b));
  const textAIBoxes = boxes.filter(
    (b) => !isWatermarkAIBox(b) && !enhanceBoxes.includes(b) && !isTextFormatAIBox(b)
  );

  // 1. Text Pipeline: get-content -> textAIBoxes -> textFormatBoxes
  if (getContentEnabled) {
    if (textAIBoxes.length > 0 && textFormatBoxes.length > 0) {
      // Remove direct shortcuts from get-content to format boxes when AI boxes exist
      conns = conns.filter(
        (c) => !(c.fromNodeId === 'get-content' && textFormatBoxes.some((f) => f.id === c.toNodeId))
      );

      // Connect get-content -> each text AI box
      textAIBoxes.forEach((aiBox) => {
        const exists = conns.some((c) => c.fromNodeId === 'get-content' && c.toNodeId === aiBox.id);
        if (!exists) {
          conns.push({
            id: `conn-content-${aiBox.id}`,
            fromNodeId: 'get-content',
            toNodeId: aiBox.id,
          });
        }
      });

      // Connect each text AI box -> text format boxes (if format box has no incoming wire, connect from first AI box)
      textFormatBoxes.forEach((fmt) => {
        const hasIncoming = conns.some((c) => c.toNodeId === fmt.id);
        if (!hasIncoming) {
          const primaryAI = textAIBoxes[0];
          conns.push({
            id: `conn-${primaryAI.id}-${fmt.id}`,
            fromNodeId: primaryAI.id,
            toNodeId: fmt.id,
          });
        }
      });
    } else if (textAIBoxes.length > 0) {
      textAIBoxes.forEach((aiBox) => {
        const exists = conns.some((c) => c.fromNodeId === 'get-content' && c.toNodeId === aiBox.id);
        if (!exists) {
          conns.push({
            id: `conn-content-${aiBox.id}`,
            fromNodeId: 'get-content',
            toNodeId: aiBox.id,
          });
        }
      });
    } else if (textFormatBoxes.length > 0) {
      textFormatBoxes.forEach((fmt) => {
        const exists = conns.some((c) => c.fromNodeId === 'get-content' && c.toNodeId === fmt.id);
        if (!exists) {
          conns.push({
            id: `conn-content-${fmt.id}`,
            fromNodeId: 'get-content',
            toNodeId: fmt.id,
          });
        }
      });
    }
  }

  // 2. Image Pipeline: get-images -> enhancers -> watermarks
  if (getImagesEnabled) {
    if (enhanceBoxes.length > 0 && watermarkBoxes.length > 0) {
      // Remove direct shortcuts from get-images to watermark when enhancers exist
      conns = conns.filter(
        (c) => !(c.fromNodeId === 'get-images' && watermarkBoxes.some((w) => w.id === c.toNodeId))
      );

      // Connect get-images -> each enhance box
      enhanceBoxes.forEach((enh) => {
        const exists = conns.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === enh.id);
        if (!exists) {
          conns.push({
            id: `conn-images-${enh.id}`,
            fromNodeId: 'get-images',
            toNodeId: enh.id,
          });
        }
      });

      // Connect enhance boxes -> watermark boxes
      enhanceBoxes.forEach((enh) => {
        watermarkBoxes.forEach((wm) => {
          const exists = conns.some((c) => c.fromNodeId === enh.id && c.toNodeId === wm.id);
          if (!exists) {
            conns.push({
              id: `conn-${enh.id}-${wm.id}`,
              fromNodeId: enh.id,
              toNodeId: wm.id,
            });
          }
        });
      });
    } else if (enhanceBoxes.length > 0) {
      enhanceBoxes.forEach((enh) => {
        const exists = conns.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === enh.id);
        if (!exists) {
          conns.push({
            id: `conn-images-${enh.id}`,
            fromNodeId: 'get-images',
            toNodeId: enh.id,
          });
        }
      });
    } else if (watermarkBoxes.length > 0) {
      watermarkBoxes.forEach((wm) => {
        const exists = conns.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === wm.id);
        if (!exists) {
          conns.push({
            id: `conn-images-${wm.id}`,
            fromNodeId: 'get-images',
            toNodeId: wm.id,
          });
        }
      });
    }
  }

  // 3. Connect Endpoints to Merger (Combine Box OR Output Node) -> Destinations
  if (hasCombine && primaryCombineId) {
    // 3A. Combine Box Mode: All text & image endpoints flow into primaryCombineId
    const textEndpoints = textFormatBoxes.length > 0 ? textFormatBoxes : textAIBoxes;
    if (textEndpoints.length > 0) {
      // Remove shortcut from textAIBoxes to combine box when textFormatBoxes exist
      if (textFormatBoxes.length > 0) {
        conns = conns.filter(
          (c) => !(textAIBoxes.some((a) => a.id === c.fromNodeId) && activeCombineBoxes.some((b) => b.id === c.toNodeId))
        );
      }
      textEndpoints.forEach((cb) => {
        const alreadyConnected = conns.some(
          (c) =>
            c.fromNodeId === cb.id &&
            (activeCombineBoxes.some((b) => b.id === c.toNodeId) ||
              c.toNodeId.startsWith('dest-') ||
              c.toNodeId === 'destination')
        );
        if (!alreadyConnected) {
          conns.push({
            id: `conn-${cb.id}-${primaryCombineId}`,
            fromNodeId: cb.id,
            toNodeId: primaryCombineId,
          });
        }
      });
    } else if (getContentEnabled) {
      const alreadyConnected = conns.some(
        (c) =>
          c.fromNodeId === 'get-content' &&
          (activeCombineBoxes.some((b) => b.id === c.toNodeId) ||
            c.toNodeId.startsWith('dest-') ||
            c.toNodeId === 'destination')
      );
      if (!alreadyConnected) {
        conns.push({
          id: `conn-get-content-${primaryCombineId}`,
          fromNodeId: 'get-content',
          toNodeId: primaryCombineId,
        });
      }
    }

    // Image endpoints -> Combine Box
    const imgEndpoints = watermarkBoxes.length > 0 ? watermarkBoxes : enhanceBoxes.length > 0 ? enhanceBoxes : [];
    if (imgEndpoints.length > 0) {
      // Remove shortcut from enhanceBoxes to combine box when watermarkBoxes exist
      if (watermarkBoxes.length > 0) {
        conns = conns.filter(
          (c) => !(enhanceBoxes.some((a) => a.id === c.fromNodeId) && activeCombineBoxes.some((b) => b.id === c.toNodeId))
        );
      }
      imgEndpoints.forEach((imgNode) => {
        const alreadyConnected = conns.some(
          (c) =>
            c.fromNodeId === imgNode.id &&
            (activeCombineBoxes.some((b) => b.id === c.toNodeId) ||
              c.toNodeId.startsWith('dest-') ||
              c.toNodeId === 'destination')
        );
        if (!alreadyConnected) {
          conns.push({
            id: `conn-${imgNode.id}-${primaryCombineId}`,
            fromNodeId: imgNode.id,
            toNodeId: primaryCombineId,
          });
        }
      });
    } else if (getImagesEnabled) {
      const alreadyConnected = conns.some(
        (c) =>
          c.fromNodeId === 'get-images' &&
          (activeCombineBoxes.some((b) => b.id === c.toNodeId) ||
            c.toNodeId.startsWith('dest-') ||
            c.toNodeId === 'destination')
      );
      if (!alreadyConnected) {
        conns.push({
          id: `conn-get-images-${primaryCombineId}`,
          fromNodeId: 'get-images',
          toNodeId: primaryCombineId,
        });
      }
    }

    // Combine Box -> Destinations
    if (destinationEnabled) {
      const activeDests = (destinations || []).filter((d) => d && d.enabled !== false);
      const targetList = activeDests.length > 0 ? activeDests : [{ id: 'destination', enabled: true }];

      // Connect Combine Box to destinations if it doesn't already connect to at least one destination
      const hasAnyDestConnection = conns.some(
        (c) =>
          activeCombineBoxes.some((b) => b.id === c.fromNodeId) &&
          targetList.some((d) => (d.id || 'destination') === c.toNodeId)
      );
      if (!hasAnyDestConnection) {
        const firstDestId = targetList[0].id || 'destination';
        conns.push({
          id: `conn-${primaryCombineId}-${firstDestId}`,
          fromNodeId: primaryCombineId,
          toNodeId: firstDestId,
        });
      }

      // Remove direct shortcuts from upstream AI boxes to destination (they converge into Combine Box)
      conns = conns.filter((c) => {
        const isTargetingDest = targetList.some((d) => (d.id || 'destination') === c.toNodeId);
        const isFromCombine = activeCombineBoxes.some((b) => b.id === c.fromNodeId);
        const isDestToDest = c.fromNodeId.startsWith('dest-') || c.fromNodeId === 'destination';
        return !(isTargetingDest && !isFromCombine && !isDestToDest);
      });
    }
  } else if (effectiveOutputEnabled) {
    // 3B. Standard Output Node Mode (Final Content & Images)
    const textEndpoints = textFormatBoxes.length > 0 ? textFormatBoxes : textAIBoxes;
    if (textEndpoints.length > 0) {
      textEndpoints.forEach((cb) => {
        const exists = conns.some((c) => c.fromNodeId === cb.id && c.toNodeId === 'output');
        if (!exists) {
          conns.push({
            id: `conn-${cb.id}-output`,
            fromNodeId: cb.id,
            toNodeId: 'output',
          });
        }
      });
    } else if (getContentEnabled) {
      const exists = conns.some((c) => c.fromNodeId === 'get-content' && c.toNodeId === 'output');
      if (!exists) {
        conns.push({
          id: `conn-get-content-output`,
          fromNodeId: 'get-content',
          toNodeId: 'output',
        });
      }
    }

    // Image endpoints -> output
    if (watermarkBoxes.length > 0) {
      watermarkBoxes.forEach((wm) => {
        const exists = conns.some((c) => c.fromNodeId === wm.id && c.toNodeId === 'output');
        if (!exists) {
          conns.push({
            id: `conn-${wm.id}-output`,
            fromNodeId: wm.id,
            toNodeId: 'output',
          });
        }
      });
    } else if (enhanceBoxes.length > 0) {
      enhanceBoxes.forEach((enh) => {
        const exists = conns.some((c) => c.fromNodeId === enh.id && c.toNodeId === 'output');
        if (!exists) {
          conns.push({
            id: `conn-${enh.id}-output`,
            fromNodeId: enh.id,
            toNodeId: 'output',
          });
        }
      });
    } else if (getImagesEnabled) {
      const exists = conns.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === 'output');
      if (!exists) {
        conns.push({
          id: `conn-get-images-output`,
          fromNodeId: 'get-images',
          toNodeId: 'output',
        });
      }
    }

    // Output -> all active destinations (Remaining Posts Database & Facebook Pages)
    if (destinationEnabled) {
      const activeDests = (destinations || []).filter((d) => d && d.enabled !== false);
      const targetList = activeDests.length > 0 ? activeDests : [{ id: 'destination', enabled: true }];
      targetList.forEach((d) => {
        const destId = d.id || 'destination';
        const exists = conns.some((c) => c.fromNodeId === 'output' && c.toNodeId === destId);
        if (!exists) {
          conns.push({
            id: `conn-output-${destId}`,
            fromNodeId: 'output',
            toNodeId: destId,
          });
        }
      });

      // Remove direct shortcuts from upstream nodes straight to destination (they now converge into output)
      conns = conns.filter((c) => {
        const isTargetingDest = targetList.some((d) => (d.id || 'destination') === c.toNodeId);
        return !(isTargetingDest && c.fromNodeId !== 'output');
      });
    }
  } else if (destinationEnabled) {
    // 3C. Direct to Destination Fallback (neither Combine Box nor Output Node active)
    const activeDests = (destinations || []).filter((d) => d && d.enabled !== false);
    const targetDestId = activeDests[0]?.id || 'destination';
    const textEndpoints = textFormatBoxes.length > 0 ? textFormatBoxes : textAIBoxes;
    if (textEndpoints.length > 0) {
      textEndpoints.forEach((cb) => {
        const exists = conns.some(
          (c) =>
            c.fromNodeId === cb.id &&
            (c.toNodeId === targetDestId || c.toNodeId === 'destination' || c.toNodeId.startsWith('dest-'))
        );
        if (!exists) {
          conns.push({
            id: `conn-${cb.id}-${targetDestId}`,
            fromNodeId: cb.id,
            toNodeId: targetDestId,
          });
        }
      });
    } else if (getContentEnabled) {
      const exists = conns.some(
        (c) =>
          c.fromNodeId === 'get-content' &&
          (c.toNodeId === targetDestId || c.toNodeId === 'destination' || c.toNodeId.startsWith('dest-'))
      );
      if (!exists) {
        conns.push({
          id: `conn-get-content-${targetDestId}`,
          fromNodeId: 'get-content',
          toNodeId: targetDestId,
        });
      }
    }

    const imgEndpoints = watermarkBoxes.length > 0 ? watermarkBoxes : enhanceBoxes.length > 0 ? enhanceBoxes : [];
    if (imgEndpoints.length > 0) {
      imgEndpoints.forEach((imgNode) => {
        const exists = conns.some(
          (c) =>
            c.fromNodeId === imgNode.id &&
            (c.toNodeId === targetDestId || c.toNodeId === 'destination' || c.toNodeId.startsWith('dest-'))
        );
        if (!exists) {
          conns.push({
            id: `conn-${imgNode.id}-${targetDestId}`,
            fromNodeId: imgNode.id,
            toNodeId: targetDestId,
          });
        }
      });
    } else if (getImagesEnabled) {
      const exists = conns.some(
        (c) =>
          c.fromNodeId === 'get-images' &&
          (c.toNodeId === targetDestId || c.toNodeId === 'destination' || c.toNodeId.startsWith('dest-'))
      );
      if (!exists) {
        conns.push({
          id: `conn-get-images-${targetDestId}`,
          fromNodeId: 'get-images',
          toNodeId: targetDestId,
        });
      }
    }
  }

  return dedupeConnections(conns);
};

export const autoConnectImagePipeline = (
  boxes: DynamicAIBoxConfig[],
  existingConns: WorkflowWireConnection[] = [],
  getContentEnabled: boolean = true,
  getImagesEnabled: boolean = true,
  destinationEnabled?: boolean,
  outputEnabled?: boolean,
  destinations?: DestinationNodeConfig[],
  combineBoxes?: CombineBoxConfig[]
): WorkflowWireConnection[] => {
  return autoConnectWorkflow(
    boxes,
    existingConns,
    getContentEnabled,
    getImagesEnabled,
    destinationEnabled !== false,
    outputEnabled !== false,
    destinations || [],
    combineBoxes || []
  );
};

/**
 * Auto-layout: arranges nodes into a clean, hierarchical tree-branching layout (matching n8n style).
 * - Root Trigger (Facebook Post) at X = 100, Y = 440
 * - Upper Swimlane: Text / Content AI pipeline centered at Y = 220 (Get Content -> fanning out to AI models at Y = 110, 330)
 * - Lower Swimlane: Image / Watermark pipeline centered at Y = 660 (Get Images -> Enhancers at Y = 660 -> fanning out to formats at Y = 530, 790)
 * - Column spacing: X = 100 -> 340 -> 600 -> 860
 */
export const buildAlignedLayout = (
  boxes: DynamicAIBoxConfig[],
  connections: WorkflowWireConnection[] | undefined,
  base: FacebookWorkflowConfig
): FacebookWorkflowConfig => {
  const conns = connections || [];
  const fromContent = (id: string) => conns.some((c) => c.fromNodeId === 'get-content' && c.toNodeId === id);
  const fromImages = (id: string) => conns.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === id);

  const watermarkBoxes = boxes.filter((b) => isWatermarkAIBox(b));
  const enhanceBoxes = boxes.filter(
    (b) => !isWatermarkAIBox(b) && (isEnhanceAIBox(b, conns) || fromImages(b.id))
  );
  const textFormatBoxes = boxes.filter((b) => isTextFormatAIBox(b));
  const textAIBoxes = boxes.filter(
    (b) => !isWatermarkAIBox(b) && !enhanceBoxes.includes(b) && !isTextFormatAIBox(b) && (fromContent(b.id) || !fromImages(b.id))
  );
  const otherBoxes = boxes.filter(
    (b) => !textAIBoxes.includes(b) && !textFormatBoxes.includes(b) && !enhanceBoxes.includes(b) && !watermarkBoxes.includes(b)
  );

  // Compact Clean Tree Metrics
  const NODE_V_STEP = 120;      // Compact vertical step - gives clean ~16px gap between label and card
  const BRANCH_GAP = 36;        // Balanced separation gap between Content and Image branches
  const TOP_MARGIN = 80;

  // Horizontal column grid
  const TRIGGER_X = 100;
  const COL_BRANCH_X = 300;     // Column 1: Get Content & Get Images
  const COL_AI_X = 520;         // Column 2: Content AI Models & Image Enhancers / Direct Formats
  const COL_FORMAT_X = 740;     // Column 3: Formats & Watermark Nodes (when Enhancers exist)

  const yById: Record<string, number> = {};
  const xById: Record<string, number> = {};

  // 1. Content AI Branch (Dynamic height, fanning out symmetrically)
  const numTextAI = textAIBoxes.length;
  const numTextFormat = textFormatBoxes.length;
  const hasTextAI = numTextAI > 0;
  const textFormatColX = hasTextAI ? COL_FORMAT_X : COL_AI_X;

  const textSlots = Math.max(numTextAI, numTextFormat, 1);
  const contentTopY = TOP_MARGIN;
  const contentCenterY =
    textSlots <= 1
      ? contentTopY
      : contentTopY + ((textSlots - 1) * NODE_V_STEP) / 2;

  // Position Text AI Boxes (Column 2: 520)
  if (numTextAI === 1) {
    xById[textAIBoxes[0].id] = COL_AI_X;
    yById[textAIBoxes[0].id] = contentCenterY;
  } else if (numTextAI > 1) {
    // Keep primary AI box (the one feeding format presets or first) at contentCenterY (140)
    // so Get Content (140) -> Primary Gemini (140) stays 100% dead-straight!
    // Additional text AI boxes stack cleanly below it (140 + idx * 120 = 260, exactly like Image 3)
    const primaryAI = textAIBoxes.find((b) => conns.some((c) => c.fromNodeId === b.id && textFormatBoxes.some((f) => f.id === c.toNodeId))) || textAIBoxes[0];
    const otherAIs = textAIBoxes.filter((b) => b.id !== primaryAI.id);
    const orderedAIs = [primaryAI, ...otherAIs];

    orderedAIs.forEach((b, idx) => {
      xById[b.id] = COL_AI_X;
      yById[b.id] = contentCenterY + idx * NODE_V_STEP;
    });
  }

  // Optimize format box order to eliminate crossing wires:
  // Sort boxes based on their downstream destination/combine box targets.
  // Format presets connecting to higher targets (e.g. top combine box) are placed at the top.
  // Format presets connecting to lower targets or branching to multiple combine boxes are placed lower.
  const activeCbList = (base.combineBoxes || []).filter((cb) => cb && cb.enabled !== false);
  const activeDestList = getNormalizedDestinations(base);

  const sortedTextFormatBoxes = [...textFormatBoxes].sort((a, b) => {
    const getTargetRank = (boxId: string) => {
      const outConns = conns.filter((c) => c.fromNodeId === boxId);
      if (outConns.length === 0) return 999;

      const ranks = outConns.map((c) => {
        const cbIdx = activeCbList.findIndex((cb) => cb.id === c.toNodeId);
        if (cbIdx !== -1) return cbIdx * 10;

        const destIdx = activeDestList.findIndex((d) => d.id === c.toNodeId);
        if (destIdx !== -1) return destIdx * 10;

        return 50;
      });

      return ranks.reduce((sum, r) => sum + r, 0) / ranks.length;
    };

    const rankDiff = getTargetRank(a.id) - getTargetRank(b.id);
    if (rankDiff !== 0) return rankDiff;
    return textFormatBoxes.indexOf(a) - textFormatBoxes.indexOf(b);
  });

  // Position Text Format Boxes (Column 3: 740, or 520 if no AI box)
  if (numTextFormat === 1) {
    xById[sortedTextFormatBoxes[0].id] = textFormatColX;
    yById[sortedTextFormatBoxes[0].id] = contentCenterY;
  } else if (numTextFormat > 1) {
    const offset = ((textSlots - numTextFormat) * NODE_V_STEP) / 2;
    sortedTextFormatBoxes.forEach((b, idx) => {
      xById[b.id] = textFormatColX;
      yById[b.id] = contentTopY + offset + idx * NODE_V_STEP;
    });
  }

  // 2. Image Pipeline Branch (Isolated vertical band, completely collision-free)
  const numEnhance = enhanceBoxes.length;
  const numWatermark = watermarkBoxes.length;
  const hasEnhancers = numEnhance > 0;
  // If text AI, format presets, or enhancers exist, watermark format presets sit in Column 3 (740)
  const hasAnyFormatsOrAI = numTextAI > 0 || numTextFormat > 0 || hasEnhancers;
  const watermarkColX = hasAnyFormatsOrAI ? COL_FORMAT_X : COL_AI_X;

  const imageSlots = Math.max(numEnhance, numWatermark, 1);
  const contentSpan = (textSlots - 1) * NODE_V_STEP;
  const naturalImageTopY = contentTopY + contentSpan + NODE_V_STEP + BRANCH_GAP;
  // Ensure the image branch maintains clean separation and never collides with upper text format presets
  const imageTopY = Math.max(320, naturalImageTopY);
  const imageCenterY =
    imageSlots <= 1
      ? imageTopY
      : imageTopY + ((imageSlots - 1) * NODE_V_STEP) / 2;

  // Position Image Enhancers (Column 2: 520)
  if (numEnhance === 1) {
    xById[enhanceBoxes[0].id] = COL_AI_X;
    yById[enhanceBoxes[0].id] = imageCenterY;
  } else if (numEnhance > 1) {
    const offset = ((imageSlots - numEnhance) * NODE_V_STEP) / 2;
    enhanceBoxes.forEach((b, idx) => {
      xById[b.id] = COL_AI_X;
      yById[b.id] = imageTopY + offset + idx * NODE_V_STEP;
    });
  }

  // Position Watermark / Format Boxes (Column 3: 740, or 520 if totally standalone)
  if (numWatermark === 1) {
    xById[watermarkBoxes[0].id] = watermarkColX;
    yById[watermarkBoxes[0].id] = imageCenterY;
  } else if (numWatermark > 1) {
    const offset = ((imageSlots - numWatermark) * NODE_V_STEP) / 2;
    watermarkBoxes.forEach((b, idx) => {
      xById[b.id] = watermarkColX;
      yById[b.id] = imageTopY + offset + idx * NODE_V_STEP;
    });
  }

  // 3. Other boxes (if any)
  const otherColX = (hasAnyFormatsOrAI && numWatermark > 0) ? (COL_FORMAT_X + 220) : (COL_AI_X + 220);
  otherBoxes.forEach((b, idx) => {
    xById[b.id] = otherColX;
    yById[b.id] = contentTopY + idx * NODE_V_STEP;
  });

  const hasContent = base.getContent?.enabled !== false;
  const hasImages = base.getImages?.enabled !== false;
  const getContentY = contentCenterY;
  const getImagesY = imageCenterY;
  const triggerY = hasContent && hasImages
    ? Math.round((getContentY + getImagesY) / 2)
    : hasContent
    ? getContentY
    : hasImages
    ? getImagesY
    : 200;

  const isOutputActive = base.outputNode?.enabled !== false;
  const activeCombineBoxes = (base.combineBoxes || []).filter((cb) => cb && cb.enabled !== false);
  const allXValues = Object.values(xById);
  const maxNodeX = allXValues.length > 0 ? Math.max(...allXValues) : COL_FORMAT_X;
  const mergerNodeX = Math.max(COL_FORMAT_X + 220, maxNodeX + 220); // Column 4: 960
  const outputNodeX = isOutputActive ? mergerNodeX : maxNodeX;
  const outputNodeY = triggerY;
  const destinationX = mergerNodeX + 220; // Column 5: 1180

  // Hierarchical Destination Layout:
  // Primary destinations (connected from Combine Box / Output or root) sit at Column 5 (1180).
  // Child destinations (connected from a platform hub) fan out into Column 6 (1400).
  const rawDests = getNormalizedDestinations(base);
  const isChildDest = (destId: string) =>
    conns.some((c) => rawDests.some((p) => p.id === c.fromNodeId) && c.toNodeId === destId);

  const primaryDests = rawDests.filter((d) => !isChildDest(d.id));
  const childDests = rawDests.filter((d) => isChildDest(d.id));

  const totalPrimary = primaryDests.length;
  const PRIMARY_STEP = 150;
  const destCoords: Record<string, { x: number; y: number }> = {};

  // Helper to compute natural vertical center of inputs feeding a node
  const getNodeInputCenterY = (nodeId: string): number => {
    const inConns = conns.filter((c) => c.toNodeId === nodeId);
    const inYs = inConns
      .map((c) => {
        if (yById[c.fromNodeId] !== undefined) return yById[c.fromNodeId];
        if (c.fromNodeId === 'get-content') return getContentY;
        if (c.fromNodeId === 'get-images') return getImagesY;
        return undefined;
      })
      .filter((y): y is number => typeof y === 'number');

    if (inYs.length > 0) {
      return Math.round(inYs.reduce((a, b) => a + b, 0) / inYs.length);
    }
    return contentCenterY;
  };

  const isSingleCbMode = activeCombineBoxes.length <= 1;
  const singleCb = activeCombineBoxes[0];
  const singleCbCenterY = singleCb ? getNodeInputCenterY(singleCb.id) : contentCenterY;
  const singleCbConnectedDestId = singleCb
    ? conns.find((c) => c.fromNodeId === singleCb.id && primaryDests.some((p) => p.id === c.toNodeId))?.toNodeId
    : undefined;

  primaryDests.forEach((p, pIdx) => {
    let py: number;

    if (isSingleCbMode) {
      // If there is only 1 combine box, align its connected destination directly to the center line!
      if (singleCbConnectedDestId) {
        if (p.id === singleCbConnectedDestId) {
          py = singleCbCenterY;
        } else {
          const otherIdx = primaryDests.filter((d) => d.id !== singleCbConnectedDestId).findIndex((d) => d.id === p.id);
          py = singleCbCenterY + (otherIdx + 1) * PRIMARY_STEP;
        }
      } else {
        // Direct connection without combine box or fallback
        const inConns = conns.filter((c) => c.toNodeId === p.id);
        const inYs = inConns.map((c) => yById[c.fromNodeId]).filter((y): y is number => typeof y === 'number');
        if (inYs.length > 0) {
          py = Math.round(inYs.reduce((a, b) => a + b, 0) / inYs.length);
        } else {
          py = totalPrimary <= 1 ? singleCbCenterY : singleCbCenterY + pIdx * PRIMARY_STEP;
        }
      }
    } else {
      // Multiple combine boxes / lanes (e.g. Image 2 with top Remaining Posts DB & bottom Facebook Hub)
      py = totalPrimary === 2
        ? (pIdx === 0 ? contentCenterY : imageCenterY)
        : (totalPrimary <= 1 ? triggerY : triggerY - Math.round(((totalPrimary - 1) * PRIMARY_STEP) / 2) + pIdx * PRIMARY_STEP);
    }

    destCoords[p.id] = { x: destinationX, y: py };

    // Position children of this primary destination in Column 6 (destinationX + 220 = 1400)
    const children = childDests.filter((c) => conns.some((w) => w.fromNodeId === p.id && w.toNodeId === c.id));
    const numChildren = children.length;
    const CHILD_STEP = 130;
    const startChildY = numChildren <= 1 ? py : py - Math.round(((numChildren - 1) * CHILD_STEP) / 2);

    children.forEach((c, cIdx) => {
      destCoords[c.id] = {
        x: destinationX + 220,
        y: startChildY + cIdx * CHILD_STEP,
      };
    });
  });

  // Handle any orphan child destinations (if parent wire was cut or not found)
  childDests.forEach((c, cIdx) => {
    if (!destCoords[c.id]) {
      destCoords[c.id] = {
        x: destinationX + 220,
        y: triggerY + cIdx * 130,
      };
    }
  });

  const updatedDestinations = rawDests.map((d) => ({
    ...d,
    x: destCoords[d.id]?.x ?? destinationX,
    y: destCoords[d.id]?.y ?? triggerY,
  }));

  // Categorize Combine Boxes by upstream column:
  // - Early combine boxes: directly connected from Column 1 (Get Content or Get Images)
  //   -> Placed in Column 2 (x = 520, near Get Content / Get Images!)
  //   -> If from Get Content: sits at y = 20 (contentCenterY - 120, above the primary Gemini in Image 3)
  //   -> If from Get Images: sits at y = imageCenterY + 120
  // - Late combine boxes: connected from Column 3 format presets or general destination mergers
  //   -> Placed in Column 4 (x = mergerNodeX = 960)
  //   -> Upper lane (connected to Remaining Posts DB or text branch): y = contentCenterY = 140
  //   -> Lower lane (connected to Facebook Hub or image branch): y = imageCenterY = 323
  const getUpstreamMaxX = (cbId: string): number => {
    const inConns = conns.filter((c) => c.toNodeId === cbId);
    if (inConns.length === 0) return COL_FORMAT_X;
    let maxX = 0;
    inConns.forEach((c) => {
      if (c.fromNodeId === 'trigger') maxX = Math.max(maxX, TRIGGER_X);
      else if (c.fromNodeId === 'get-content' || c.fromNodeId === 'get-images') maxX = Math.max(maxX, COL_BRANCH_X);
      else if (xById[c.fromNodeId] !== undefined) maxX = Math.max(maxX, xById[c.fromNodeId]);
      else maxX = Math.max(maxX, COL_BRANCH_X);
    });
    return maxX;
  };

  const earlyCbList: CombineBoxConfig[] = [];
  const lateCbList: CombineBoxConfig[] = [];

  (base.combineBoxes || []).filter((cb) => cb && cb.enabled !== false).forEach((cb) => {
    const upstreamX = getUpstreamMaxX(cb.id);
    if (upstreamX <= COL_BRANCH_X) {
      earlyCbList.push(cb);
    } else {
      lateCbList.push(cb);
    }
  });

  const cbCoords: Record<string, { x: number; y: number }> = {};

  // Early combine boxes (Column 2: 520, near Get Content or Get Images):
  earlyCbList.forEach((cb, idx) => {
    const isFromImages = conns.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === cb.id);
    const cy = isFromImages
      ? imageCenterY + (idx + 1) * NODE_V_STEP
      : contentCenterY - (idx + 1) * NODE_V_STEP; // 140 - 120 = 20 (exactly like Image 3!)
    cbCoords[cb.id] = { x: COL_AI_X, y: cy };
  });

  // Late combine boxes (Column 4: 960, merging format presets / endpoints into destinations):
  lateCbList.forEach((cb, idx) => {
    // If connects to a destination, match that destination's Y directly for a straight line:
    const directDestConn = conns.find((c) => c.fromNodeId === cb.id && primaryDests.some((p) => p.id === c.toNodeId));
    if (directDestConn && destCoords[directDestConn.toNodeId]) {
      cbCoords[cb.id] = { x: mergerNodeX, y: destCoords[directDestConn.toNodeId].y };
      return;
    }

    if (lateCbList.length <= 1) {
      cbCoords[cb.id] = { x: mergerNodeX, y: singleCbCenterY };
      return;
    }

    // Default lane positions for multiple late combine boxes:
    const targetY = idx === 0 ? contentCenterY : idx === 1 ? imageCenterY : imageCenterY + (idx - 1) * 140;
    cbCoords[cb.id] = { x: mergerNodeX, y: targetY };
  });

  const updatedCombineBoxes = (base.combineBoxes || []).map((cb) => {
    const coords = cbCoords[cb.id];
    return {
      ...cb,
      x: coords?.x ?? mergerNodeX,
      y: coords?.y ?? triggerY,
    };
  });

  return {
    ...base,
    aiBoxes: boxes.map((b) => ({
      ...b,
      x: xById[b.id] ?? COL_AI_X,
      y: yById[b.id] ?? contentCenterY,
    })),
    trigger: { ...base.trigger, x: TRIGGER_X, y: triggerY },
    getContent: { ...base.getContent, x: COL_BRANCH_X, y: getContentY },
    getImages: { ...base.getImages, x: COL_BRANCH_X, y: getImagesY },
    combineBoxes: updatedCombineBoxes,
    outputNode: {
      id: 'output',
      enabled: isOutputActive,
      x: outputNodeX,
      y: outputNodeY,
      title: base.outputNode?.title || 'Final Content & Images',
    },
    destination: updatedDestinations[0],
    destinations: updatedDestinations,
  };
};

/**
 * Resolves node collisions and ensures clean non-overlapping coordinates for all workflow nodes.
 */
export const sanitizeAndResolveCollisions = (
  conf: FacebookWorkflowConfig
): FacebookWorkflowConfig => {
  if (!conf) return DEFAULT_FB_WORKFLOW_CONFIG;

  const rawAiBoxes = Array.isArray(conf.aiBoxes) ? conf.aiBoxes : [];
  const updatedAiBoxes = rawAiBoxes.map((b) => {
    // If it's a watermark or image box, preserve it
    if (
      b.processType === 'watermark' ||
      b.provider === 'watermark' ||
      b.processType === 'image_enhance' ||
      b.provider === 'runware_ai'
    ) {
      return b;
    }
    // If text AI box uses an inactive provider without credits (openai or laozhang_ai), migrate to active google_ai
    if (b.provider === 'openai' || b.provider === 'laozhang_ai') {
      return {
        ...b,
        provider: 'google_ai' as const,
        model: 'gemini-flash-latest',
      };
    }
    return b;
  });

  const rawDests = getNormalizedDestinations(conf);
  const activeDests = rawDests.filter((d) => d.enabled !== false);
  const isDestEnabled = activeDests.length > 0;
  const activeDestIds = activeDests.map((d) => d.id);
  const activeCombineBoxes = (conf.combineBoxes || []).filter((cb) => cb.enabled !== false);
  const activeCombineBoxIds = activeCombineBoxes.map((cb) => cb.id);
  const hasCombineBoxes = activeCombineBoxIds.length > 0;
  const isOutputEnabled = !hasCombineBoxes && conf.outputNode?.enabled !== false;

  const validNodeIds = new Set([
    'trigger',
    ...(conf.getContent?.enabled !== false ? ['get-content'] : []),
    ...(conf.getImages?.enabled !== false ? ['get-images'] : []),
    ...(isOutputEnabled ? ['output'] : []),
    ...activeDestIds,
    ...activeCombineBoxIds,
    ...updatedAiBoxes.filter((b: any) => b.enabled !== false).map((b: any) => b.id),
  ]);

  let connections = Array.isArray(conf.connections)
    ? conf.connections
        .map((c: any) => {
          if (!c) return null;
          // Auto-migrate connections from 'output' to the primary combine box if combine boxes are present
          if (hasCombineBoxes) {
            const primaryCombineId = activeCombineBoxIds[0];
            return {
              ...c,
              fromNodeId: c.fromNodeId === 'output' ? primaryCombineId : c.fromNodeId,
              toNodeId: c.toNodeId === 'output' ? primaryCombineId : c.toNodeId,
            };
          }
          return c;
        })
        .filter(
          (c: any) =>
            c &&
            validNodeIds.has(c.fromNodeId) &&
            validNodeIds.has(c.toNodeId) &&
            c.fromNodeId !== c.toNodeId
        )
    : [];

  connections = dedupeConnections(connections);

  // Auto-connect image & content pipeline -> output (Final Content & Images) -> destinations
  const nextConnections = dedupeConnections(
    isDestEnabled
      ? autoConnectWorkflow(
          updatedAiBoxes,
          connections,
          conf.getContent?.enabled !== false,
          conf.getImages?.enabled !== false,
          isDestEnabled,
          isOutputEnabled,
          rawDests,
          conf.combineBoxes || []
        )
      : connections.filter(
          (c) => c.toNodeId !== 'destination' && !c.toNodeId.startsWith('dest-')
        )
  );

  const baseConfig: FacebookWorkflowConfig = {
    ...DEFAULT_FB_WORKFLOW_CONFIG,
    ...conf,
    getContent: { ...DEFAULT_FB_WORKFLOW_CONFIG.getContent, ...conf.getContent },
    getImages: { ...DEFAULT_FB_WORKFLOW_CONFIG.getImages, ...conf.getImages },
    trigger: { ...DEFAULT_FB_WORKFLOW_CONFIG.trigger, ...conf.trigger },
    outputNode: {
      id: 'output',
      enabled: isOutputEnabled,
      title: conf.outputNode?.title || 'Final Content & Images',
      x: conf.outputNode?.x,
      y: conf.outputNode?.y,
    },
    combineBoxes: conf.combineBoxes || [],
    destination: activeDests[0] || { ...DEFAULT_FB_WORKFLOW_CONFIG.destination, enabled: false },
    destinations: rawDests,
    aiBoxes: updatedAiBoxes,
    connections: nextConnections,
  };

  return buildAlignedLayout(updatedAiBoxes, nextConnections, baseConfig);
};

export const loadSavedFacebookWorkflowConfig = (): FacebookWorkflowConfig => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.getContent && parsed.getImages && Array.isArray(parsed.aiBoxes)) {
        let connections = Array.isArray(parsed.connections) ? parsed.connections : [];
        return sanitizeAndResolveCollisions({
          ...DEFAULT_FB_WORKFLOW_CONFIG,
          ...parsed,
          connections,
        });
      }
    }
  } catch (e) {
    console.error('Failed to load facebook workflow config', e);
  }
  return DEFAULT_FB_WORKFLOW_CONFIG;
};

const OpenAIIcon: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = '#10A37F' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.5045 4.5045 0 0 1-4.4945 4.4947zm-9.66-4.5264a4.4707 4.4707 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1401-2.0474zm-1.127-10.742a4.4707 4.4707 0 0 1 2.3468-1.9729v5.6725a.7617.7617 0 0 0 .3879.6765l5.8144 3.3543-2.02 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866a4.4992 4.4992 0 0 1-1.6278-6.1122zm16.637 4.906l-5.838-3.3733 2.02-1.1635a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4945 4.4945 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4068-.6815zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.5797V7.2473a.0852.0852 0 0 1 .0332-.0615l4.9318-2.8466a4.4945 4.4945 0 0 1 6.6437 4.5422zm-8.8418-2.1246l-2.02 1.1635a.0757.0757 0 0 1-.071 0l-4.8303-2.7913a4.4945 4.4945 0 0 1 5.1764-1.3725l-.142.0804 1.8869 1.0886v1.8313z" />
  </svg>
);

export interface MergedNodeShapeProps {
  sockets: 'left' | 'right' | 'both';
  strokeColor: string;
  fillColor?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  socketDotColor?: string;
  highlightInput?: boolean;
  highlightOutput?: boolean;
  isConnectedInput?: boolean;
  isConnectedOutput?: boolean;
  hasReceiver?: boolean; // Can connect NEXT (downstream)
  hasSource?: boolean;   // Can connect BACK (upstream)
  isTrigger?: boolean;   // First trigger node
  isCircle?: boolean;    // Circular account/end node
  showAddButton?: boolean;
  onAddClick?: (e: React.MouseEvent) => void;
  onSocketMouseDown?: (type: 'input' | 'output', e: React.MouseEvent) => void;
  onSocketMouseUp?: (type: 'input' | 'output', e: React.MouseEvent) => void;
  onSocketMouseEnter?: (type: 'input' | 'output') => void;
  onSocketMouseLeave?: (type: 'input' | 'output') => void;
}

const CANVAS_NODE_ACTION_CSS = `
.canvas-node::before {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 21px;
  border: 1.5px dashed var(--ring, #388BFD);
  opacity: 0;
  transform: scale(0.94);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}
.canvas-node.is-circle::before {
  border-radius: 50% !important;
}
.canvas-node.is-trigger::before {
  border-radius: 41px 20px 20px 41px !important;
}
.canvas-node.is-selected::before {
  opacity: 1 !important;
  border-color: #388BFD !important;
  border-style: dashed !important;
  border-width: 1.5px !important;
  transform: scale(1) !important;
  box-shadow: 0 0 12px rgba(56, 139, 253, 0.45) !important;
}
.canvas-node.is-circle.is-selected::before {
  border-radius: 50% !important;
}
.canvas-node.is-trigger.is-selected::before {
  border-radius: 41px 20px 20px 41px !important;
}
.canvas-node:hover::before,
.canvas-node.is-hovered::before {
  opacity: 0.6;
  transform: scale(1);
}
.canvas-node.is-receptive::before {
  opacity: 0.7;
  border-color: var(--receptive-color, #D97706);
  transform: scale(1.02);
}
.canvas-node.is-running::before {
  content: '' !important;
  position: absolute !important;
  inset: -4px !important;
  border-radius: 20px !important;
  border: 2px solid #0284C7 !important;
  opacity: 0.85 !important;
  transform: scale(1) !important;
  box-shadow: 0 0 12px rgba(2, 132, 199, 0.45) !important;
}
.canvas-node.is-trigger.is-running::before {
  border-radius: 40px 19px 19px 40px !important;
}
.canvas-node.is-running::after {
  display: none !important;
}
.canvas-node.is-completed::before {
  content: '' !important;
  position: absolute !important;
  inset: -4px !important;
  border-radius: 20px !important;
  border: 1.5px solid #10B981 !important;
  opacity: 0.75 !important;
  transform: scale(1) !important;
  animation: none !important;
  box-shadow: none !important;
}
.canvas-node.is-trigger.is-completed::before {
  border-radius: 40px 19px 19px 40px !important;
}
.canvas-node.is-completed {
  filter: none !important;
}
@keyframes nodeRingSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes badgePopIn {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes sidebarSlideIn {
  from { transform: translateX(100%); opacity: 0.8; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes sidebarFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.node-hit{position:absolute;display:flex;align-items:center;pointer-events:none !important;z-index:45}
.node-action{width:28px;height:28px;border-radius:50%;background:var(--na-bg);border:1.5px solid var(--na-color);color:var(--na-color);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;opacity:0;transform:scale(.3) translateX(-6px);box-shadow:0 2px 8px rgba(0,0,0,.18);transition:opacity .18s ease,transform .25s cubic-bezier(.34,1.56,.64,1),background-color .15s ease,color .15s ease;pointer-events:none}
.canvas-node:hover .node-action,
.canvas-node.is-hovered .node-action,
.node-action:hover{opacity:1;transform:scale(1) translateX(0);pointer-events:auto !important}
.canvas-node .node-action:hover,
.node-action:hover{background:var(--na-color);color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.28);transform:scale(1.15)}
`;

const NodeActionButton: React.FC<{
  title: string;
  color: string;
  isDark: boolean;
  delay?: number;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}> = ({ title, color, isDark, delay = 0, onClick, children }) => (
  <button
    type="button"
    className="node-action"
    title={title}
    aria-label={title}
    onMouseDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      onClick(e);
    }}
    style={{
      ['--na-color' as any]: color,
      ['--na-bg' as any]: isDark ? '#161B22' : '#FFFFFF',
      transitionDelay: `${delay}ms`,
    }}
  >
    {children}
  </button>
);

export const NodeExecutionBadge: React.FC<{
  status?: 'idle' | 'running' | 'success' | 'error';
}> = ({ status }) => {
  if (!status || status === 'idle') return null;

  if (status === 'running') {
    return (
      <div
        style={{
          position: 'absolute',
          top: '-5px',
          right: '-5px',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          color: '#0284C7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
          border: '1.5px solid #0284C7',
          zIndex: 25,
          pointerEvents: 'none',
        }}
        title="Executing step..."
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          style={{ animation: 'spin 0.9s linear infinite' }}
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="rgba(2, 132, 199, 0.25)"
            strokeWidth="3"
          />
          <path
            d="M12 3a9 9 0 0 1 9 9"
            stroke="#0284C7"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div
        style={{
          position: 'absolute',
          top: '-5px',
          right: '-5px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#10B981',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
          border: '1.5px solid #FFFFFF',
          zIndex: 25,
          pointerEvents: 'none',
        }}
        title="Step completed"
      >
        <FiCheck style={{ fontSize: '11px', strokeWidth: 3 }} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        style={{
          position: 'absolute',
          top: '-5px',
          right: '-5px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#EF4444',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
          border: '1.5px solid #FFFFFF',
          zIndex: 25,
          pointerEvents: 'none',
        }}
        title="Execution error"
      >
        <FiAlertTriangle style={{ fontSize: '11px' }} />
      </div>
    );
  }

  return null;
};

export const MergedNodeShape: React.FC<MergedNodeShapeProps> = ({
  sockets,
  strokeColor,
  fillColor,
  strokeWidth = 1.75,
  strokeDasharray = 'none',
  socketDotColor,
  highlightInput = false,
  highlightOutput = false,
  isConnectedInput: _isConnectedInput = false,
  isConnectedOutput: _isConnectedOutput = false,
  hasReceiver = true,
  hasSource: _hasSource = false,
  isTrigger = false,
  isCircle = false,
  showAddButton = false,
  onAddClick,
  onSocketMouseDown,
  onSocketMouseUp,
  onSocketMouseEnter,
  onSocketMouseLeave,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const resolvedFillColor = fillColor || (isDark ? '#1C2128' : '#FFFFFF');
  const [hoveredSocket, setHoveredSocket] = useState<'input' | 'output' | null>(null);

  const isReceptiveInput = Boolean(highlightInput);
  const isReceptiveOutput = Boolean(highlightOutput);
  const isReceptive = isReceptiveInput || isReceptiveOutput;

  // Soft refined warm gold representing receptive connect state
  const RECEPTIVE_COLOR = isDark ? '#EAB308' : '#D97706';
  const defaultBorder = isDark ? '#475569' : '#94A3B8';
  const effectiveStrokeColor = isReceptive ? RECEPTIVE_COLOR : (strokeColor || defaultBorder);

  const outputDotColor = isReceptiveOutput
    ? RECEPTIVE_COLOR
    : hoveredSocket === 'output'
    ? (isDark ? '#38BDF8' : '#0284C7')
    : (socketDotColor || (isDark ? '#94A3B8' : '#64748B'));

  const inputDotColor = isReceptiveInput
    ? RECEPTIVE_COLOR
    : hoveredSocket === 'input'
    ? (isDark ? '#38BDF8' : '#0284C7')
    : (socketDotColor || (isDark ? '#94A3B8' : '#64748B'));

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '72px',
        height: '72px',
        pointerEvents: 'none',
      }}
    >
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '72px',
          height: '72px',
          overflow: 'visible',
          filter: isDark ? 'drop-shadow(0 4px 14px rgba(0, 0, 0, 0.45))' : 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08))',
        }}
        viewBox="0 0 72 72"
      >
        {/* n8n Node Card */}
        {isTrigger ? (
          // n8n Trigger Node: Distinct D-Shape with curved left side (matching Image 3)
          <path
            d="M 36 1 L 56 1 A 15 15 0 0 1 71 16 L 71 56 A 15 15 0 0 1 56 71 L 36 71 A 35 35 0 0 1 36 1 Z"
            fill={resolvedFillColor}
            stroke={effectiveStrokeColor}
            strokeWidth={isReceptive ? 2.5 : strokeWidth}
            strokeDasharray={strokeDasharray}
            style={{
              transition: 'stroke 0.2s ease, stroke-width 0.2s ease, fill 0.2s ease',
            }}
          />
        ) : isCircle ? (
          <circle
            cx="36"
            cy="36"
            r="35"
            fill={resolvedFillColor}
            stroke={effectiveStrokeColor}
            strokeWidth={isReceptive ? 2.5 : strokeWidth}
            strokeDasharray={strokeDasharray}
            style={{
              transition: 'stroke 0.2s ease, stroke-width 0.2s ease, fill 0.2s ease',
            }}
          />
        ) : (
          <rect
            x="1"
            y="1"
            width="70"
            height="70"
            rx="16"
            ry="16"
            fill={resolvedFillColor}
            stroke={effectiveStrokeColor}
            strokeWidth={isReceptive ? 2.5 : strokeWidth}
            strokeDasharray={strokeDasharray}
            style={{
              transition: 'stroke 0.2s ease, stroke-width 0.2s ease, fill 0.2s ease',
            }}
          />
        )}

        {/* LEFT INPUT PORT (n8n grey notch/tab on left border at x = 1, y = 36) */}
        {(sockets === 'left' || sockets === 'both') && (
          <g>
            {isReceptiveInput && (
              <circle
                cx="1"
                cy="36"
                r="9"
                fill={RECEPTIVE_COLOR}
                opacity="0.35"
              />
            )}
            <rect
              x="-4"
              y="28"
              width="8"
              height="16"
              rx="2.5"
              fill={inputDotColor}
              stroke={inputDotColor}
              strokeWidth="1.5"
              style={{
                transition: 'all 0.15s ease',
              }}
            />
            <polygon
              points="-1,32 3,36 -1,40"
              fill={isDark ? '#1C2128' : '#FFFFFF'}
            />
          </g>
        )}

        {/* n8n line connecting right edge/dot to [+] button */}
        {showAddButton && (
          <line x1="71" y1="36" x2="87" y2="36" stroke={isDark ? '#4B5563' : '#94A3B8'} strokeWidth="1.75" />
        )}

        {/* RIGHT OUTPUT PORT (n8n solid circle on right border at x = 71, y = 36) */}
        {(sockets === 'right' || sockets === 'both') && (
          <g>
            {isReceptiveOutput && (
              <circle
                cx="71"
                cy="36"
                r="9"
                fill={RECEPTIVE_COLOR}
                opacity="0.35"
              />
            )}
            <circle
              cx="71"
              cy="36"
              r={isReceptiveOutput || hoveredSocket === 'output' ? 6.5 : 5}
              fill={outputDotColor}
              stroke={outputDotColor}
              strokeWidth="1.5"
              style={{
                transition: 'all 0.15s ease',
              }}
            />
          </g>
        )}
      </svg>

      {/* Right Output Socket Hitbox for drag-to-connect NEXT (strictly covers ONLY the socket dot at x=71, NEVER the [+] button) */}
      {(sockets === 'right' || sockets === 'both') && (
        <div
          className="socket-handle socket-handle-output"
          onMouseEnter={() => {
            setHoveredSocket('output');
            onSocketMouseEnter?.('output');
          }}
          onMouseLeave={() => {
            setHoveredSocket(null);
            onSocketMouseLeave?.('output');
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onSocketMouseDown?.('output', e);
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onSocketMouseUp?.('output', e);
          }}
          style={{
            position: 'absolute',
            right: '-8px',
            top: '24px',
            width: '16px',
            height: '24px',
            cursor: hasReceiver ? 'grab' : (isReceptiveOutput ? 'pointer' : 'default'),
            pointerEvents: 'auto',
            zIndex: 25,
            borderRadius: '50%',
          }}
        />
      )}

      {/* [+] ADD STEP BUTTON on right - Dedicated HTML button with high zIndex so it NEVER triggers wire dragging */}
      {showAddButton && (
        <button
          type="button"
          className="merged-node-add-btn"
          title="Connect Next Step"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onAddClick?.(e);
          }}
          style={{
            position: 'absolute',
            left: '87px',
            top: '25px',
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            border: isDark ? '1.5px solid #4B5563' : '1.5px solid #94A3B8',
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
            pointerEvents: 'auto',
            zIndex: 40,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = isDark ? '#60A5FA' : '#2563EB';
            e.currentTarget.style.backgroundColor = isDark ? '#263342' : '#EFF6FF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = isDark ? '#4B5563' : '#94A3B8';
            e.currentTarget.style.backgroundColor = isDark ? '#1F2937' : '#FFFFFF';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M 6 2 L 6 10 M 2 6 L 10 6"
              stroke={isDark ? '#9CA3AF' : '#64748B'}
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

      {/* Left Input Socket (Static port notch - does not initiate dragging wires) */}
      {(sockets === 'left' || sockets === 'both') && (
        <div
          className="socket-handle socket-handle-input"
          style={{
            position: 'absolute',
            left: '-8px',
            top: '24px',
            width: '16px',
            height: '24px',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
};

export type ActiveModalNode =
  | { type: 'trigger' }
  | { type: 'add-trigger' }
  | { type: 'get-content' }
  | { type: 'get-images' }
  | { type: 'ai-box'; boxId: string }
  | { type: 'destination'; destinationId?: string }
  | { type: 'output' }
  | { type: 'combine'; combineId: string; id?: string }
  | null;

export interface DeletedAIBoxRecord {
  box: DynamicAIBoxConfig;
  connections: WorkflowWireConnection[];
  deletedAt: number;
}

export const LOCAL_STORAGE_DELETED_KEY = 'ea_workflow_deleted_boxes';

export const loadSavedDeletedBoxes = (): DeletedAIBoxRecord[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

export interface FacebookWorkflowCanvasRef {
  addAIBox: (templateOverride?: CanvasPromptOption) => void;
  resetLayout: () => void;
  openRecoverModal: () => void;
  openGeneralSettings: () => void;
  toggleGeneralSettings: () => void;
  getDeletedBoxesCount: () => number;
}

export interface WorkflowExecutionState {
  isRunning?: boolean;
  activeNodeIds?: string[];
  completedNodeIds?: string[];
  failedNodeIds?: string[];
  currentStepMessage?: string;
  stepIndex?: number;
  totalSteps?: number;
  isComplete?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

export interface FacebookWorkflowCanvasProps {
  initialConfig?: FacebookWorkflowConfig;
  onSwitchToLiveImport?: () => void;
  onConfigChange?: (config: FacebookWorkflowConfig) => void;
  allowEditPrompt?: boolean;
  onDeletedCountChange?: (count: number) => void;
  rawContent?: string;
  images?: Array<{
    index: number;
    facebook_photo_id?: string;
    source_url: string;
    stored_url?: string;
    width?: number;
    height?: number;
    status?: string;
  }>;
  watermarkedPhotos?: Record<number, string>;
  enhancedPhotos?: Record<number, string>;
  aiGeneratedOutputs?: Record<string, string>;
  aiGeneratedCopy?: string;
  projectName?: string;
  autoFormatBoxes?: Record<string, boolean>;
  onToggleBoxAutoFormat?: (boxId: string, checked: boolean) => void;
  autoEnhance?: boolean;
  onToggleAutoEnhance?: (checked: boolean) => void;
  executionState?: WorkflowExecutionState;
  onCloseCanvas?: () => void;
  onViewLogs?: () => void;
  // General Settings integrations
  onSaveFormat?: () => void;
  isSaveSuccess?: boolean;
  autoSave?: boolean;
  onToggleAutoSave?: (enabled: boolean) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onUseInFacebookImport?: () => void;
  isGeneralSettingsOpen?: boolean;
  onToggleGeneralSettings?: (open: boolean) => void;
  formatName?: string;
}

/**
 * Calculates pan offset (x, y) so that all active nodes or initial trigger
 * are centered in the viewport.
 */
export const calculateCenteredPanOffset = (
  cfg: FacebookWorkflowConfig,
  viewportWidth: number,
  viewportHeight: number,
  zoom?: number
): { x: number; y: number } => {
  if (!viewportWidth || !viewportHeight || viewportWidth <= 0 || viewportHeight <= 0) {
    return cfg.panOffset || { x: 500, y: 180 };
  }

  const effectiveZoom = zoom ?? cfg.zoom ?? 0.9;
  const CIRCLE_SIZE = 72;
  const LABEL_EXTRA = 32;

  const isTriggerEnabled = cfg.trigger?.enabled === true;
  const isContentEnabled = cfg.getContent?.enabled !== false;
  const isImagesEnabled = cfg.getImages?.enabled !== false;
  const activeBoxes = (cfg.aiBoxes || []).filter((b) => b.enabled !== false);

  const points: { x: number; y: number; width: number; height: number }[] = [];

  // If trigger is enabled, or if in initial state (neither trigger nor other nodes enabled)
  if (isTriggerEnabled || (!isContentEnabled && !isImagesEnabled && activeBoxes.length === 0)) {
    points.push({
      x: cfg.trigger?.x ?? 100,
      y: cfg.trigger?.y ?? 200,
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE + LABEL_EXTRA,
    });
  }

  if (isContentEnabled) {
    points.push({
      x: cfg.getContent?.x ?? 300,
      y: cfg.getContent?.y ?? 140,
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE + LABEL_EXTRA,
    });
  }

  if (isImagesEnabled) {
    points.push({
      x: cfg.getImages?.x ?? 300,
      y: cfg.getImages?.y ?? 356,
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE + LABEL_EXTRA,
    });
  }

  activeBoxes.forEach((b) => {
    points.push({
      x: b.x,
      y: b.y,
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE + LABEL_EXTRA,
    });
  });

  // Combine Boxes
  (cfg.combineBoxes || [])
    .filter((cb) => cb && cb.enabled !== false)
    .forEach((cb) => {
      points.push({
        x: cb.x ?? 960,
        y: cb.y ?? 200,
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE + LABEL_EXTRA,
      });
    });

  // Post Output Node (id: 'output')
  if (cfg.outputNode && cfg.outputNode.enabled !== false) {
    points.push({
      x: cfg.outputNode.x ?? 740,
      y: cfg.outputNode.y ?? 200,
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE + LABEL_EXTRA,
    });
  }

  // All Destination Nodes (e.g. Dot BKK Living, Remaining Posts Database)
  const allDestinations = getNormalizedDestinations(cfg).filter((d) => d && d.enabled !== false);
  allDestinations.forEach((d) => {
    points.push({
      x: d.x ?? 960,
      y: d.y ?? 200,
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE + LABEL_EXTRA,
    });
  });

  if (points.length === 0) {
    points.push({
      x: cfg.trigger?.x ?? 100,
      y: cfg.trigger?.y ?? 200,
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE + LABEL_EXTRA,
    });
  }

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x + p.width));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y + p.height));

  const contentMidX = (minX + maxX) / 2;
  const contentMidY = (minY + maxY) / 2;

  const targetPanX = Math.round(viewportWidth / 2 - contentMidX * effectiveZoom);
  const targetPanY = Math.round(viewportHeight / 2 - contentMidY * effectiveZoom);

  return { x: targetPanX, y: targetPanY };
};

export const FacebookWorkflowCanvas = forwardRef<
  FacebookWorkflowCanvasRef,
  FacebookWorkflowCanvasProps
>(function FacebookWorkflowCanvas(
  {
    initialConfig,
    onConfigChange,
    allowEditPrompt: _allowEditPrompt = false,
    onDeletedCountChange,
    rawContent,
    images = [],
    watermarkedPhotos = {},
    enhancedPhotos = {},
    aiGeneratedOutputs = {},
    aiGeneratedCopy = '',
    projectName: _projectName = '',
    autoFormatBoxes: _propsAutoFormatBoxes,
    onToggleBoxAutoFormat: _propsOnToggleBoxAutoFormat,
    autoEnhance: _propsAutoEnhance,
    onToggleAutoEnhance: _propsOnToggleAutoEnhance,
    executionState,
    onCloseCanvas: _onCloseCanvas,
    onViewLogs: _onViewLogs,
    onSaveFormat,
    isSaveSuccess = false,
    autoSave = true,
    onToggleAutoSave,
    onUndo,
    canUndo = false,
    onUseInFacebookImport,
    isGeneralSettingsOpen,
    onToggleGeneralSettings,
    formatName,
  },
  ref
) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const RECEPTIVE_COLOR = isDark ? '#EAB308' : '#D97706';
  const [config, setConfig] = useState<FacebookWorkflowConfig>(() =>
    sanitizeAndResolveCollisions(initialConfig || loadSavedFacebookWorkflowConfig())
  );

  useEffect(() => {
    if (initialConfig) {
      setConfig(sanitizeAndResolveCollisions(initialConfig));
    }
  }, [initialConfig]);

  const getNodeExecutionStatus = (nodeId: string): 'idle' | 'running' | 'success' | 'error' => {
    if (!executionState) return 'idle';
    if (executionState.failedNodeIds?.includes(nodeId)) return 'error';
    if (executionState.activeNodeIds?.includes(nodeId)) return 'running';
    if (executionState.completedNodeIds?.includes(nodeId)) return 'success';
    return 'idle';
  };

  const canvasRef = useRef<HTMLDivElement>(null);
  const hasAutoCenteredRef = useRef(false);

  // Auto-center workflow nodes in viewport on mount as soon as canvas is measured
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const performCenter = (width: number, height: number) => {
      if (width <= 50 || height <= 50) return;
      hasAutoCenteredRef.current = true;
      setConfig((prev) => {
        const nextPan = calculateCenteredPanOffset(prev, width, height, prev.zoom);
        if (prev.panOffset.x === nextPan.x && prev.panOffset.y === nextPan.y) {
          return prev;
        }
        return { ...prev, panOffset: nextPan };
      });
    };

    if (el.clientWidth > 50 && el.clientHeight > 50 && !hasAutoCenteredRef.current) {
      performCenter(el.clientWidth, el.clientHeight);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50 && !hasAutoCenteredRef.current) {
          performCenter(width, height);
        }
      }
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (initialConfig) {
      const sanitized = sanitizeAndResolveCollisions(initialConfig);
      if (canvasRef.current && canvasRef.current.clientWidth > 50 && canvasRef.current.clientHeight > 50) {
        const centeredPan = calculateCenteredPanOffset(
          sanitized,
          canvasRef.current.clientWidth,
          canvasRef.current.clientHeight,
          sanitized.zoom
        );
        setConfig({ ...sanitized, panOffset: centeredPan });
      } else {
        hasAutoCenteredRef.current = false;
        setConfig(sanitized);
      }
    }
  }, [initialConfig]);

  // Ensure sanitized, deduplicated config is persisted on mount to immediately repair any legacy corrupted/duplicate connections
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {}
  }, []);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState<number>(-1);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Managed Facebook Pages from Auth Manager
  const [managedPages, setManagedPages] = useState<ManagedPageMeta[]>(() => {
    const stored = getStoredManagedPages();
    return stored.length > 0 ? stored : DEFAULT_MANAGED_FB_PAGES;
  });
  const selectedPageId = config.destination?.selectedPageId || managedPages[0]?.page_id || '1287202894475973';
  const selectedPage = managedPages.find((p) => p.page_id === selectedPageId) || managedPages[0];

  // Destination inline Add Page Form state
  const [isAddPageOpen, setIsAddPageOpen] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [newPageId, setNewPageId] = useState('');
  const [newPageCategory, setNewPageCategory] = useState('Real Estate Agency');
  const [newPagePicture, setNewPagePicture] = useState('');

  // Managed Instagram & TikTok accounts
  const [managedIgAccounts, setManagedIgAccounts] = useState<ManagedSocialAccountMeta[]>(DEFAULT_MANAGED_IG_ACCOUNTS);
  const [managedTiktokAccounts, setManagedTiktokAccounts] = useState<ManagedSocialAccountMeta[]>(DEFAULT_MANAGED_TIKTOK_ACCOUNTS);
  const [isAddIgOpen, setIsAddIgOpen] = useState(false);
  const [isAddTiktokOpen, setIsAddTiktokOpen] = useState(false);
  const [newIgUsername, setNewIgUsername] = useState('');
  const [newIgName, setNewIgName] = useState('');
  const [newTiktokUsername, setNewTiktokUsername] = useState('');
  const [newTiktokName, setNewTiktokName] = useState('');

  // Recovery and Deletion Confirmation State
  const [deletedBoxes, setDeletedBoxes] = useState<DeletedAIBoxRecord[]>(() => loadSavedDeletedBoxes());
  const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);
  const [isSocialConnectDrawerExpanded, setIsSocialConnectDrawerExpanded] = useState<boolean>(false);
  const [activeSocialPlatformFilter, setActiveSocialPlatformFilter] = useState<'facebook' | 'instagram' | 'tiktok'>('facebook');
  const [quickAddPopover, setQuickAddPopover] = useState<{
    nodeId: string;
    nodeType: 'ai-box' | 'get-content' | 'get-images' | 'combine';
    x: number;
    y: number;
    socialExpanded?: boolean;
    activePlatform?: 'facebook' | 'instagram' | 'tiktok';
  } | null>(null);

  useEffect(() => {
    if (isGeneralSettingsOpen !== undefined) {
      setIsRecoverModalOpen(isGeneralSettingsOpen);
      if (isGeneralSettingsOpen) {
        setActiveModalNode(null);
        setIsAISettingsDrawerOpen(false);
      }
    }
  }, [isGeneralSettingsOpen]);

  const handleToggleGeneralSettings = (open: boolean) => {
    setIsRecoverModalOpen(open);
    onToggleGeneralSettings?.(open);
    if (open) {
      setActiveModalNode(null);
      setIsAISettingsDrawerOpen(false);
    }
  };
  const [selectRecoverIds, setSelectRecoverIds] = useState<Set<string>>(new Set());
  const [dontAskDeleteAgain, setDontAskDeleteAgain] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ea_workflow_skip_delete_confirm') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    onDeletedCountChange?.(deletedBoxes.length);
  }, [deletedBoxes.length, onDeletedCountChange]);

  // Drag-to-connect String State
  interface DragWireState {
    fromNodeId: string;
    fromType: 'output' | 'input';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }
  const [dragWire, setDragWire] = useState<DragWireState | null>(null);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);
  const [hoveredXId, setHoveredXId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredOutputNodeId, setHoveredOutputNodeId] = useState<string | null>(null);
  const [hoveredInputNodeId, setHoveredInputNodeId] = useState<string | null>(null);
  const hoverLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Canvas Node Title Editing State
  const [editingCanvasBoxId, setEditingCanvasBoxId] = useState<string | null>(null);
  const [editingCanvasBoxTitle, setEditingCanvasBoxTitle] = useState('');

  const handleNodeMouseEnter = (nodeId: string) => {
    if (hoverLeaveTimeoutRef.current) {
      clearTimeout(hoverLeaveTimeoutRef.current);
      hoverLeaveTimeoutRef.current = null;
    }
    setHoveredNodeId(nodeId);
  };

  const handleNodeMouseLeave = (nodeId: string) => {
    if (hoverLeaveTimeoutRef.current) {
      clearTimeout(hoverLeaveTimeoutRef.current);
    }
    hoverLeaveTimeoutRef.current = setTimeout(() => {
      setHoveredNodeId((curr) => (curr === nodeId ? null : curr));
    }, 350);
  };

  useEffect(() => {
    return () => {
      if (hoverLeaveTimeoutRef.current) {
        clearTimeout(hoverLeaveTimeoutRef.current);
      }
    };
  }, []);

  // Node Modal State
  const [activeModalNode, setActiveModalNode] = useState<ActiveModalNode>(null);
  const [isAISettingsDrawerOpen, setIsAISettingsDrawerOpen] = useState(false);

  // Dedicated Connect Items Drawer (opened via [+] node button)
  const [connectDrawerNode, setConnectDrawerNode] = useState<{
    nodeId: string;
    nodeType: string;
    title: string;
    platform?: 'facebook' | 'instagram' | 'tiktok' | 'database';
  } | null>(null);

  const [isAddFromTriggerOpen, setIsAddFromTriggerOpen] = useState(false);
  const [pendingDeleteBox, setPendingDeleteBox] = useState<DynamicAIBoxConfig | null>(null);
  const [pendingDeleteConnection, setPendingDeleteConnection] = useState<{ id: string; fromTitle: string; toTitle: string } | null>(null);
  const confirmDeleteConnection = () => {
    if (pendingDeleteConnection) {
      updateConfig({ ...config, connections: (config.connections || []).filter((c) => c.id !== pendingDeleteConnection.id) });
      setPendingDeleteConnection(null);
    }
  };

  // Lightbox & image compiled preview
  const [lightboxImageIndex, setLightboxImageIndex] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);

  // Output & Combine Copy / Media states
  const [outputSelectedCopyKey, setOutputSelectedCopyKey] = useState<string>('primary');
  const [copiedTextSuccess, setCopiedTextSuccess] = useState<boolean>(false);
  const [postCardExpanded, setPostCardExpanded] = useState<boolean>(false);
  const [selectedCombineFormatId, setSelectedCombineFormatId] = useState<string>('all');
  const [copiedCombineSuccess, setCopiedCombineSuccess] = useState<boolean>(false);

  const activeCopy: string = useMemo(() => {
    if (outputSelectedCopyKey === 'original') return rawContent || '';
    if (outputSelectedCopyKey === 'primary') return aiGeneratedCopy || rawContent || '';
    if (aiGeneratedOutputs[outputSelectedCopyKey]) return aiGeneratedOutputs[outputSelectedCopyKey];
    return aiGeneratedCopy || rawContent || '';
  }, [outputSelectedCopyKey, aiGeneratedCopy, rawContent, aiGeneratedOutputs]);

  interface CompiledImageItem {
    index: number;
    facebook_photo_id?: string;
    source_url: string;
    stored_url?: string;
    width?: number;
    height?: number;
    status?: string;
    finalUrl: string;
    isWatermarked: boolean;
    isEnhanced: boolean;
  }

  const compiledImages: CompiledImageItem[] = useMemo(() => {
    return (images || []).map((img) => {
      const isWatermarked = Boolean(watermarkedPhotos[img.index]);
      const isEnhanced = Boolean(enhancedPhotos[img.index]);
      const finalUrl =
        watermarkedPhotos[img.index] ||
        enhancedPhotos[img.index] ||
        (img.stored_url
          ? img.stored_url.startsWith('http')
            ? img.stored_url
            : `http://localhost:8085${img.stored_url}`
          : img.source_url);
      return {
        ...img,
        finalUrl,
        isWatermarked,
        isEnhanced,
      };
    });
  }, [images, watermarkedPhotos, enhancedPhotos]);

  const handleOpenLightbox = (indexOrUrl: number | string) => {
    if (typeof indexOrUrl === 'number') {
      setLightboxImageIndex(indexOrUrl);
    } else {
      const foundIdx = compiledImages.findIndex((img) => img.finalUrl === indexOrUrl || img.source_url === indexOrUrl);
      setLightboxImageIndex(foundIdx >= 0 ? foundIdx : 0);
    }
    setZoomScale(1);
  };

  const handleDownloadImage = async (imgUrl: string, index?: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const fullUrl = imgUrl.startsWith('/storage') ? `http://localhost:8085${imgUrl}` : imgUrl;
      const response = await fetch(fullUrl, { mode: 'cors' });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `property-photo-${index !== undefined ? index + 1 : Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.warn('Direct blob download failed, falling back to window download:', err);
      const fullUrl = imgUrl.startsWith('/storage') ? `http://localhost:8085${imgUrl}` : imgUrl;
      const a = document.createElement('a');
      a.href = fullUrl;
      a.target = '_blank';
      a.download = `property-photo-${index !== undefined ? index + 1 : Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenConnectDrawer = (
    nodeId: string,
    nodeType: string,
    title: string,
    platform?: 'facebook' | 'instagram' | 'tiktok' | 'database',
  ) => {
    setActiveModalNode(null);
    setSelectedBoxId(null);
    setQuickAddPopover(null);
    setIsRecoverModalOpen(false);
    onToggleGeneralSettings?.(false);
    setConnectDrawerNode({ nodeId, nodeType, title, platform });
  };

  const renderCenteredConnectButton = (
    nodeId: string,
    nodeType: string,
    nodeTitle?: string,
    platform?: 'facebook' | 'instagram' | 'tiktok' | 'database',
  ) => (
    <button
      type="button"
      onClick={() => handleOpenConnectDrawer(nodeId, nodeType, nodeTitle || nodeId, platform)}
      aria-label="Connect Next Step"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
        width: '100%',
        height: '38px',
        marginBottom: '0.875rem',
        padding: '0 1rem',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        backgroundColor: isDark ? 'var(--bg-surface)' : '#F1F5F9',
        color: 'var(--text-primary)',
        fontSize: '0.8125rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: isDark ? '0 1px 2px rgba(0, 0, 0, 0.25)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = isDark ? 'var(--bg-surface-hover)' : '#E2E8F0';
        e.currentTarget.style.borderColor = isDark ? 'var(--border-color-hover)' : '#94A3B8';
        const arrow = e.currentTarget.querySelector('.next-step-arrow') as HTMLElement | null;
        if (arrow) arrow.style.transform = 'translateX(3px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isDark ? 'var(--bg-surface)' : '#F1F5F9';
        e.currentTarget.style.borderColor = 'var(--border-color)';
        const arrow = e.currentTarget.querySelector('.next-step-arrow') as HTMLElement | null;
        if (arrow) arrow.style.transform = 'translateX(0)';
      }}
    >
      <span>Connect Next Step</span>
      <span
        className="next-step-arrow"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          transition: 'transform 0.15s ease',
          color: 'var(--text-secondary)',
        }}
      >
        <FiArrowRight size={14} />
      </span>
    </button>
  );
  const dragStartCoord = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Deletion Confirmation Modal State
  interface DeleteConfirmTarget {
    type: 'connection' | 'node';
    title: string;
    description: string;
    confirmText?: string;
    onConfirm: () => void;
  }
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<DeleteConfirmTarget | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteConfirmTarget) {
        setDeleteConfirmTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirmTarget]);

  const handleCloseModal = () => {
    setActiveModalNode(null);
    setConnectDrawerNode(null);
    setIsAISettingsDrawerOpen(false);
  };

  // Mutually exclusive sidebars: when node inspector or connect drawer opens, close General Settings
  useEffect(() => {
    if (activeModalNode || connectDrawerNode) {
      setIsRecoverModalOpen(false);
      onToggleGeneralSettings?.(false);
    }
  }, [activeModalNode, connectDrawerNode]);

  // Available prompt templates from library (synced with PromptTemplatesView)
  const [availablePrompts, setAvailablePrompts] = useState<CanvasPromptOption[]>(() => loadAvailablePromptTemplates());

  useEffect(() => {
    const syncPrompts = () => {
      setAvailablePrompts(loadAvailablePromptTemplates());
    };
    syncPrompts();
    window.addEventListener('storage', syncPrompts);
    return () => window.removeEventListener('storage', syncPrompts);
  }, [activeModalNode]);

  // Sync to parent and localStorage
  const updateConfig = (newConfig: FacebookWorkflowConfig) => {
    const hasCombineBoxes = (newConfig.combineBoxes || []).some((b) => b && b.enabled !== false);
    const primaryCombineId = hasCombineBoxes
      ? (newConfig.combineBoxes || []).find((b) => b && b.enabled !== false)?.id
      : null;

    let conns = Array.isArray(newConfig.connections)
      ? newConfig.connections
          .map((c) => {
            if (!c) return null;
            if (hasCombineBoxes && primaryCombineId) {
              return {
                ...c,
                fromNodeId: c.fromNodeId === 'output' ? primaryCombineId : c.fromNodeId,
                toNodeId: c.toNodeId === 'output' ? primaryCombineId : c.toNodeId,
              };
            }
            return c;
          })
          .filter((c) => c && c.fromNodeId !== c.toNodeId)
      : [];

    const sanitizedConfig = {
      ...newConfig,
      connections: dedupeConnections(conns as WorkflowWireConnection[]),
    };

    setConfig(sanitizedConfig);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitizedConfig));
    } catch (e) {}
    if (onConfigChange) onConfigChange(sanitizedConfig);
  };

  const handleSaveConfig = async () => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
      try {
        await fetch('http://localhost:8085/api/workflow/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facebook_import_workflow: config,
            timestamp: Date.now(),
          }),
        });
      } catch (err) {}

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  // Socket positions helper for connecting wires
  const getNodeSocketPos = (nodeId: string, socketType: 'input' | 'output') => {
    if (nodeId === 'trigger') {
      return { x: config.trigger.x + 75, y: config.trigger.y + HALF_CIRCLE };
    }
    if (nodeId === 'get-content') {
      if (config.getContent?.enabled === false) return null;
      const hasAddBtn = Boolean(config.getContent.enabled);
      return socketType === 'output'
        ? { x: config.getContent.x + (hasAddBtn ? 109 : 71), y: config.getContent.y + HALF_CIRCLE }
        : { x: config.getContent.x + 1, y: config.getContent.y + HALF_CIRCLE };
    }
    if (nodeId === 'get-images') {
      if (config.getImages?.enabled === false) return null;
      const hasAddBtn = Boolean(config.getImages.enabled);
      return socketType === 'output'
        ? { x: config.getImages.x + (hasAddBtn ? 109 : 71), y: config.getImages.y + HALF_CIRCLE }
        : { x: config.getImages.x + 1, y: config.getImages.y + HALF_CIRCLE };
    }
    if (nodeId === 'output') {
      const hasCombineBoxes = (config.combineBoxes || []).some((b) => b && b.enabled !== false);
      if (hasCombineBoxes) return null;
      const outNode = config.outputNode;
      if (!outNode || outNode.enabled === false) return null;
      const outX = outNode.x ?? 620;
      const outY = outNode.y ?? 248;
      const hasAddBtn = isNodeEffectivelyEnabled('output');
      return socketType === 'output'
        ? { x: outX + (hasAddBtn ? 109 : 71), y: outY + HALF_CIRCLE }
        : { x: outX + 1, y: outY + HALF_CIRCLE };
    }
    if (nodeId === 'destination' || nodeId.startsWith('dest-')) {
      const allDests = getNormalizedDestinations(config);
      const dest = allDests.find((d) => d.id === nodeId && d.enabled !== false);
      if (!dest) {
        return null;
      }
      const destX = dest.x ?? 740;
      const destY = dest.y ?? 248;
      return socketType === 'output'
        ? { x: destX + 71, y: destY + HALF_CIRCLE }
        : { x: destX + 1, y: destY + HALF_CIRCLE };
    }
    const cb = (config.combineBoxes || []).find((b) => b.id === nodeId && b.enabled !== false);
    if (cb) {
      return socketType === 'output'
        ? { x: cb.x + 109, y: cb.y + HALF_CIRCLE }
        : { x: cb.x + 1, y: cb.y + HALF_CIRCLE };
    }
    const box = config.aiBoxes.find((b) => b.id === nodeId && b.enabled !== false);
    if (box) {
      const hasAddBtn = isNodeEffectivelyEnabled(box.id);
      return socketType === 'output'
        ? { x: box.x + (hasAddBtn ? 109 : 71), y: box.y + HALF_CIRCLE }
        : { x: box.x + 1, y: box.y + HALF_CIRCLE };
    }
    return null;
  };

  const dragWireStartTime = useRef(0);

  // Check if two nodes already have a connection (either dynamically or statically)
  // "and if that already connect don't can't be connect again next to back or back to next"
  const isAlreadyConnected = (nodeA: string, nodeB: string): boolean => {
    const conns = config.connections || [];
    if (
      conns.some(
        (c) =>
          (c.fromNodeId === nodeA && c.toNodeId === nodeB) ||
          (c.fromNodeId === nodeB && c.toNodeId === nodeA)
      )
    ) {
      return true;
    }
    // Hardcoded static wires
    if ((nodeA === 'trigger' && nodeB === 'get-content') || (nodeA === 'get-content' && nodeB === 'trigger')) return true;
    if ((nodeA === 'trigger' && nodeB === 'get-images') || (nodeA === 'get-images' && nodeB === 'trigger')) return true;
    return false;
  };

  const isReachable = (startId: string, targetId: string, conns: WorkflowWireConnection[]): boolean => {
    const visited = new Set<string>();
    const queue = [startId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === targetId) return true;
      if (!visited.has(curr)) {
        visited.add(curr);
        const nextNodes = conns.filter((c) => c.fromNodeId === curr).map((c) => c.toNodeId);
        queue.push(...nextNodes);
      }
    }
    return false;
  };

  // Check if a node is effectively enabled (cascading disabled state down from upstream relatives,
  // excluding the endpoint destination):
  // "if that connect disabled that receiver taht relative I means just necessary relative not end point just relative must be disabled too"
  const isNodeEffectivelyEnabled = (nodeId: string, visited: Set<string> = new Set()): boolean => {
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);

    if (nodeId === 'trigger') return true;
    if (nodeId === 'output') {
      if (config.outputNode?.enabled === false) return false;
      const conns = config.connections || [];
      const incoming = conns.filter((c) => c.toNodeId === 'output');
      if (incoming.length > 0) {
        return incoming.some((c) => isNodeEffectivelyEnabled(c.fromNodeId, new Set(visited)));
      }
      return true;
    }
    if (nodeId === 'destination' || nodeId.startsWith('dest-')) {
      const allDests = getNormalizedDestinations(config);
      const dest = allDests.find((d) => d.id === nodeId);
      return Boolean(dest ? dest.enabled !== false : config.destination?.enabled !== false);
    }
    if (nodeId === 'get-content') return Boolean(config.getContent.enabled);
    if (nodeId === 'get-images') return Boolean(config.getImages.enabled);

    const cb = (config.combineBoxes || []).find((b) => b.id === nodeId);
    if (cb) {
      if (cb.enabled === false) return false;
      const conns = config.connections || [];
      const incoming = conns.filter((c) => c.toNodeId === nodeId);
      if (incoming.length > 0) {
        return incoming.some((c) => isNodeEffectivelyEnabled(c.fromNodeId, new Set(visited)));
      }
      return true;
    }

    const box = config.aiBoxes.find((b) => b.id === nodeId);
    if (!box) return false;
    if (!box.enabled) return false;

    // Relative node must have active upstream inputs:
    // If incoming connections exist, all upstream branches must not be disabled.
    const conns = config.connections || [];
    const incoming = conns.filter((c) => c.toNodeId === nodeId);
    if (incoming.length > 0) {
      const hasActiveUpstream = incoming.some((c) =>
        isNodeEffectivelyEnabled(c.fromNodeId, new Set(visited))
      );
      if (!hasActiveUpstream) return false;
    }

    return true;
  };

  // Directional forward-only connection validation with strict duplicate rejection:
  // "and that can't connect back with other and that only can connect next other step"
  const isValidConnection = (fromId: string, toId: string): boolean => {
    if (!fromId || !toId || fromId === toId) return false;

    // Reject if already connected in either direction
    if (isAlreadyConnected(fromId, toId)) {
      return false;
    }

    const isTargetCombine = toId.startsWith('combine-box') || (config.combineBoxes || []).some((b) => b.id === toId);
    const isSourceCombine = fromId.startsWith('combine-box') || (config.combineBoxes || []).some((b) => b.id === fromId);

    // Target is a Combine Box: can receive from content, images, any AI box, or another Combine Box
    if (isTargetCombine) {
      if (fromId === 'trigger' || fromId === toId) return false;
      return true;
    }

    // Source is a Combine Box: can connect to destinations or another Combine Box
    if (isSourceCombine) {
      if (toId === 'destination' || toId.startsWith('dest-')) return true;
      if (isTargetCombine && toId !== fromId) return true;
      return false;
    }

    // Disallow connections originating from disabled nodes
    if (!isNodeEffectivelyEnabled(fromId)) {
      return false;
    }

    const conns = config.connections || [];

    // Step 1: trigger -> get-content or get-images (already statically connected)
    if (fromId === 'trigger') {
      return false;
    }

    // Step 2: get-content -> dynamic AI copywriting nodes OR combine box OR output OR destination
    if (fromId === 'get-content') {
      if (toId === 'output' || toId === 'destination' || toId.startsWith('dest-') || isTargetCombine) return true;
      if (!toId.startsWith('ai-box-')) return false;
      const targetBox = config.aiBoxes.find((b) => b.id === toId);
      if (!targetBox) return false;
      // Cannot connect if already connected to get-images
      const isConnectedToImages = conns.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === toId);
      if (isConnectedToImages) return false;
      const alreadyHasInput = conns.some((c) => c.toNodeId === toId);
      return !alreadyHasInput;
    }

    // Step 2b: get-images -> dynamic AI image enhancer OR watermark nodes OR combine box OR output OR destination
    if (fromId === 'get-images') {
      if (toId === 'output' || toId === 'destination' || toId.startsWith('dest-') || isTargetCombine) return true;
      if (!toId.startsWith('ai-box-')) return false;
      const targetBox = config.aiBoxes.find((b) => b.id === toId);
      if (!targetBox) return false;
      // Cannot connect if connected to get-content
      const isConnectedToContent = conns.some((c) => c.fromNodeId === 'get-content' && c.toNodeId === toId);
      if (isConnectedToContent) return false;
      // Must be an image node (enhancer or watermark)
      if (!isImageAIBox(targetBox, conns)) return false;
      const alreadyHasInput = conns.some((c) => c.toNodeId === toId);
      return !alreadyHasInput;
    }

    // Step 3: dynamic AI / Watermark nodes
    if (fromId.startsWith('ai-box-')) {
      const sourceBox = config.aiBoxes.find((b) => b.id === fromId);
      const targetBox = config.aiBoxes.find((b) => b.id === toId);

      // Connect to combine box, output or destination (Remaining Posts / Social Media Output)
      if (toId === 'output' || toId === 'destination' || toId.startsWith('dest-') || isTargetCombine) {
        return true;
      }

      // A) Text AI Model Box -> Text Format Preset Box (1-to-many fanout)
      if (sourceBox && isTextAIBox(sourceBox, conns) && targetBox && isTextFormatAIBox(targetBox)) {
        const alreadyConnected = conns.some((c) => c.fromNodeId === fromId && c.toNodeId === toId);
        return !alreadyConnected;
      }

      // B) Image Enhancer -> Watermark node
      // "if that enhance have that watermark must be have after that enhance"
      if (sourceBox && isEnhanceAIBox(sourceBox, conns) && targetBox && isWatermarkAIBox(targetBox)) {
        const alreadyConnected = conns.some((c) => c.fromNodeId === fromId && c.toNodeId === toId);
        return !alreadyConnected;
      }

      // C) Watermark -> Watermark node (chaining multiple watermarks for multiple pages)
      if (sourceBox && isWatermarkAIBox(sourceBox) && targetBox && isWatermarkAIBox(targetBox)) {
        const alreadyConnected = conns.some((c) => c.fromNodeId === fromId && c.toNodeId === toId);
        return !alreadyConnected;
      }

      return false;
    }

    // Step 4: output node -> destination
    if (fromId === 'output') {
      if (toId === 'destination' || toId.startsWith('dest-')) {
        return true;
      }
      return false;
    }

    // Step 5: platform destination hub -> child account destination
    const isFromDest = fromId === 'destination' || fromId.startsWith('dest-');
    const isToDest = toId === 'destination' || toId.startsWith('dest-');
    if (isFromDest && isToDest && fromId !== toId) {
      return true;
    }

    return false;
  };

  // Socket Drag-to-Connect Handlers ("Drag that string" - supports connecting NEXT and BACK)
  const handleSocketMouseDown = (
    nodeId: string,
    socketType: 'input' | 'output',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();

    // If a wire is already being dragged, clicking a socket completes or cancels the connection
    if (dragWire) {
      if (dragWire.fromType !== socketType && dragWire.fromNodeId !== nodeId) {
        const sourceId = dragWire.fromType === 'output' ? dragWire.fromNodeId : nodeId;
        const destId = dragWire.fromType === 'input' ? dragWire.fromNodeId : nodeId;
        if (isValidConnection(sourceId, destId)) {
          const currentConnections = config.connections || [];
          const exists = currentConnections.some(
            (c) => (c.fromNodeId === sourceId && c.toNodeId === destId) || (c.fromNodeId === destId && c.toNodeId === sourceId)
          );
          if (!exists) {
            const newConn: WorkflowWireConnection = {
              id: `conn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              fromNodeId: sourceId,
              toNodeId: destId,
            };
            let updatedBoxes = config.aiBoxes;
            if (sourceId === 'get-content') {
              updatedBoxes = config.aiBoxes.map((b) => {
                if (b.id === destId) {
                  const isImg = isImageModel(b.model, b.provider) || b.processType === 'image_enhance';
                  return {
                    ...b,
                    processType: 'rental',
                    provider: isImg ? 'google_ai' : b.provider,
                    model: isImg ? 'gemini-flash-latest' : b.model,
                  };
                }
                return b;
              });
            } else if (sourceId === 'get-images') {
              updatedBoxes = config.aiBoxes.map((b) => {
                if (b.id === destId) {
                  return {
                    ...b,
                    processType: 'image_enhance',
                    provider: 'runware_ai',
                    model:
                      b.model?.startsWith('runware:') ||
                      b.model?.startsWith('google:nano-banana') ||
                      b.model?.startsWith('civitai:')
                        ? b.model
                        : 'google:nano-banana@2.1',
                  };
                }
                return b;
              });
            }
            updateConfig({
              ...config,
              aiBoxes: updatedBoxes,
              connections: [...currentConnections, newConn],
            });
          }
        }
      }
      setDragWire(null);
      setHoveredOutputNodeId(null);
      setHoveredInputNodeId(null);
      return;
    }

    // Trigger and input sockets (the arrow notch) cannot initiate dragging
    if (nodeId === 'trigger' || socketType === 'input') return;

    // Start dragging a new wire from this socket
    setHoveredOutputNodeId(null);
    dragWireStartTime.current = Date.now();
    const pos = getNodeSocketPos(nodeId, socketType);
    if (!pos) return;
    setDragWire({
      fromNodeId: nodeId,
      fromType: socketType,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
  };

  const handleSocketMouseUp = (
    targetNodeId: string,
    targetSocketType: 'input' | 'output',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setHoveredOutputNodeId(null);
    setHoveredInputNodeId(null);
    if (!dragWire) return;

    // Released on the exact same socket it originated from
    if (dragWire.fromNodeId === targetNodeId && dragWire.fromType === targetSocketType) {
      // If mouseup happened almost immediately (<250ms), user did a single click:
      // keep dragWire alive so they can move the cursor and click the destination socket!
      if (Date.now() - dragWireStartTime.current < 250) {
        return;
      }
      setDragWire(null);
      return;
    }

    // Sockets must be complementary: one output, one input
    if (dragWire.fromType === targetSocketType) {
      setDragWire(null);
      return;
    }
    // Cannot connect a node to itself
    if (dragWire.fromNodeId === targetNodeId) {
      setDragWire(null);
      return;
    }

    const sourceId = dragWire.fromType === 'output' ? dragWire.fromNodeId : targetNodeId;
    const destId = dragWire.fromType === 'input' ? dragWire.fromNodeId : targetNodeId;

    // Validate forward-only directional rule: can only connect to the next valid step!
    if (!isValidConnection(sourceId, destId)) {
      setDragWire(null);
      return;
    }

    // Check if connection already exists
    const currentConnections = config.connections || [];
    const exists = currentConnections.some(
      (c) => c.fromNodeId === sourceId && c.toNodeId === destId
    );

    if (!exists) {
      const newConn: WorkflowWireConnection = {
        id: `conn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fromNodeId: sourceId,
        toNodeId: destId,
      };
      let updatedBoxes = config.aiBoxes;
      if (sourceId === 'get-content') {
        updatedBoxes = config.aiBoxes.map((b) => {
          if (b.id === destId) {
            const isImg = isImageModel(b.model, b.provider) || b.processType === 'image_enhance';
            return {
              ...b,
              processType: 'rental',
              provider: isImg ? 'google_ai' : b.provider,
              model: isImg ? 'gemini-flash-latest' : b.model,
            };
          }
          return b;
        });
      } else if (sourceId === 'get-images') {
        updatedBoxes = config.aiBoxes.map((b) => {
          if (b.id === destId) {
            return {
              ...b,
              processType: 'image_enhance',
              provider: 'runware_ai',
              model:
                b.model?.startsWith('runware:') ||
                b.model?.startsWith('google:nano-banana') ||
                b.model?.startsWith('civitai:')
                  ? b.model
                  : 'google:nano-banana@2.1',
            };
          }
          return b;
        });
      }
      const nextConns = [...currentConnections, newConn];
      const nextConfig = buildAlignedLayout(updatedBoxes, nextConns, {
        ...config,
        aiBoxes: updatedBoxes,
        connections: nextConns,
      });
      updateConfig(nextConfig);
    }
    setDragWire(null);
  };

  const getNodeDisplayName = (nodeId: string): string => {
    if (nodeId === 'trigger') return 'Extract Link Trigger';
    if (nodeId === 'get-content') return 'Get Content';
    if (nodeId === 'get-images') return 'Get Images';
    if (nodeId === 'output') return config.outputNode?.title || 'Final Content & Images';
    if (nodeId === 'destination') return 'Saved Properties';
    if (nodeId.startsWith('dest-')) {
      const dest = getNormalizedDestinations(config).find((d) => d.id === nodeId);
      return dest?.title || 'Destination';
    }
    const cb = (config.combineBoxes || []).find((b) => b.id === nodeId);
    if (cb) return cb.title || 'Combine Box';
    const box = config.aiBoxes.find((b) => b.id === nodeId);
    return box?.title || nodeId;
  };

  const handlePromptDeleteConnection = (conn: WorkflowWireConnection, e?: React.SyntheticEvent) => {
    handleRemoveConnection(conn.id, conn.fromNodeId, conn.toNodeId, e);
  };

  const executeDeleteGetContent = () => {
    setHoveredWireId(null);
    setHoveredXId(null);

    const removedConns = (config.connections || []).filter(
      (c) => c.fromNodeId === 'get-content' || c.toNodeId === 'get-content'
    );
    const remainingConns = (config.connections || []).filter(
      (c) => c.fromNodeId !== 'get-content' && c.toNodeId !== 'get-content'
    );

    const record: DeletedAIBoxRecord = {
      box: {
        id: 'get-content',
        title: 'Get Content (Text & Specs)',
        processType: 'rental',
        provider: 'google_ai',
        model: 'gemini-flash-latest',
        templateId: 'content',
        templateText: '',
        customPrompt: '',
        enabled: true,
        x: config.getContent.x || 300,
        y: config.getContent.y || 140,
      },
      connections: removedConns,
      deletedAt: Date.now(),
    };

    const nextDeleted = [record, ...deletedBoxes.filter((d) => d.box.id !== 'get-content')];
    setDeletedBoxes(nextDeleted);
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(nextDeleted));
    } catch {}

    const newConf: FacebookWorkflowConfig = {
      ...config,
      getContent: {
        ...config.getContent,
        enabled: false,
      },
      connections: remainingConns,
    };

    updateConfig(newConf);
    if (activeModalNode?.type === 'get-content') {
      setActiveModalNode(null);
    }
  };

  const handleDeleteGetContent = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setDeleteConfirmTarget({
      type: 'node',
      title: 'Delete "Get Content" Node?',
      description: 'Are you sure you want to remove the Get Content node? You can recover it anytime from General Settings.',
      confirmText: 'Confirm Delete',
      onConfirm: () => {
        executeDeleteGetContent();
        setDeleteConfirmTarget(null);
      },
    });
  };

  const executeDeleteGetImages = () => {
    setHoveredWireId(null);
    setHoveredXId(null);

    const removedConns = (config.connections || []).filter(
      (c) => c.fromNodeId === 'get-images' || c.toNodeId === 'get-images'
    );
    const remainingConns = (config.connections || []).filter(
      (c) => c.fromNodeId !== 'get-images' && c.toNodeId !== 'get-images'
    );

    const record: DeletedAIBoxRecord = {
      box: {
        id: 'get-images',
        title: 'Get Images (HD Media)',
        processType: 'image_upscale',
        provider: 'runware_ai',
        model: 'runware:upscale',
        templateId: 'images',
        templateText: '',
        customPrompt: '',
        enabled: true,
        x: config.getImages.x || 300,
        y: config.getImages.y || 356,
      },
      connections: removedConns,
      deletedAt: Date.now(),
    };

    const nextDeleted = [record, ...deletedBoxes.filter((d) => d.box.id !== 'get-images')];
    setDeletedBoxes(nextDeleted);
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(nextDeleted));
    } catch {}

    const newConf: FacebookWorkflowConfig = {
      ...config,
      getImages: {
        ...config.getImages,
        enabled: false,
      },
      connections: remainingConns,
    };

    updateConfig(newConf);
    if (activeModalNode?.type === 'get-images') {
      setActiveModalNode(null);
    }
  };

  const handleDeleteGetImages = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setDeleteConfirmTarget({
      type: 'node',
      title: 'Delete "Get Images" Node?',
      description: 'Are you sure you want to remove the Get Images node? You can recover it anytime from General Settings.',
      confirmText: 'Confirm Delete',
      onConfirm: () => {
        executeDeleteGetImages();
        setDeleteConfirmTarget(null);
      },
    });
  };

  const executeDeleteTrigger = () => {
    setHoveredWireId(null);
    setHoveredXId(null);

    const remainingConns = (config.connections || []).filter(
      (c) => c.fromNodeId !== 'trigger' && c.toNodeId !== 'trigger'
    );
    const newConf: FacebookWorkflowConfig = {
      ...config,
      trigger: {
        ...config.trigger,
        enabled: false,
      },
      connections: remainingConns,
    };
    let targetPan = config.panOffset;
    if (canvasRef.current && canvasRef.current.clientWidth > 0 && canvasRef.current.clientHeight > 0) {
      targetPan = calculateCenteredPanOffset(
        newConf,
        canvasRef.current.clientWidth,
        canvasRef.current.clientHeight,
        config.zoom
      );
    }
    updateConfig({
      ...newConf,
      panOffset: targetPan,
    });
    if (activeModalNode?.type === 'trigger') {
      setActiveModalNode(null);
    }
  };

  const handleDeleteTrigger = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setDeleteConfirmTarget({
      type: 'node',
      title: 'Delete "Extract Link" Node?',
      description: 'Are you sure you want to delete this trigger node? The workflow will return to the initial state.',
      confirmText: 'Confirm Delete',
      onConfirm: () => {
        executeDeleteTrigger();
        setDeleteConfirmTarget(null);
      },
    });
  };

  const handleEnableGetContent = () => {
    updateConfig({
      ...config,
      getContent: {
        ...config.getContent,
        enabled: true,
        x: config.getContent.x || 300,
        y: config.getContent.y || 140,
      },
    });
    setDeletedBoxes((prev) => prev.filter((d) => d.box.id !== 'get-content'));
  };

  const handleEnableGetImages = () => {
    updateConfig({
      ...config,
      getImages: {
        ...config.getImages,
        enabled: true,
        x: config.getImages.x || 300,
        y: config.getImages.y || 356,
      },
    });
    setDeletedBoxes((prev) => prev.filter((d) => d.box.id !== 'get-images'));
  };

  const executeDeleteDestination = () => {
    setHoveredWireId(null);
    setHoveredXId(null);

    const removedConns = (config.connections || []).filter(
      (c) => c.fromNodeId === 'destination' || c.toNodeId === 'destination'
    );
    const remainingConns = (config.connections || []).filter(
      (c) => c.fromNodeId !== 'destination' && c.toNodeId !== 'destination'
    );

    const isSocialMedia = config.destination?.targetMode === 'social_media';
    const record: DeletedAIBoxRecord = {
      box: {
        id: 'destination',
        title: config.destination?.title || (isSocialMedia ? (selectedPage?.name || 'Facebook Post') : 'Remaining Posts'),
        processType: 'custom',
        provider: (isSocialMedia ? 'facebook' : 'remaining_posts') as any,
        model: isSocialMedia ? 'Direct Publish' : 'Remaining Posts Queue',
        templateId: 'destination',
        templateText: '',
        customPrompt: '',
        enabled: true,
        x: config.destination?.x || 740,
        y: config.destination?.y || 248,
      },
      connections: removedConns,
      deletedAt: Date.now(),
    };

    const nextDeleted = [record, ...deletedBoxes.filter((d) => d.box.id !== 'destination')];
    setDeletedBoxes(nextDeleted);
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(nextDeleted));
    } catch {}

    const newConf: FacebookWorkflowConfig = {
      ...config,
      destination: {
        ...config.destination,
        enabled: false,
      },
      connections: remainingConns,
    };

    updateConfig(newConf);
    if (activeModalNode?.type === 'destination') {
      setActiveModalNode(null);
    }
  };

  const handleDeleteDestination = (e?: React.SyntheticEvent, destId?: string) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const targetId = destId || (activeModalNode?.type === 'destination' ? activeModalNode.destinationId : null) || 'destination';
    handleDeleteDestinationNode(targetId, e);
  };

  const handleConnectInputToOutput = (sourceNodeId: string) => {
    const conns = config.connections || [];
    if (!conns.some((c) => c.fromNodeId === sourceNodeId && c.toNodeId === 'output')) {
      updateConfig({
        ...config,
        connections: [
          ...conns,
          {
            id: `conn-${sourceNodeId}-output-${Date.now()}`,
            fromNodeId: sourceNodeId,
            toNodeId: 'output',
          },
        ],
      });
    }
  };

  const handleDisconnectInputFromOutput = (sourceNodeId: string) => {
    const conns = (config.connections || []).filter(
      (c) => !(c.fromNodeId === sourceNodeId && c.toNodeId === 'output')
    );
    updateConfig({
      ...config,
      connections: conns,
    });
  };

  const handleToggleTerminalConnection = (destId: string) => {
    const conns = config.connections || [];
    const isConnected = conns.some((c) => c.fromNodeId === 'output' && c.toNodeId === destId);
    if (isConnected) {
      updateConfig({
        ...config,
        connections: conns.filter((c) => !(c.fromNodeId === 'output' && c.toNodeId === destId)),
      });
    } else {
      updateConfig({
        ...config,
        connections: [
          ...conns,
          {
            id: `conn-output-${destId}-${Date.now()}`,
            fromNodeId: 'output',
            toNodeId: destId,
          },
        ],
      });
    }
  };

  const handleUpdateDestinationPage = (destId: string, pageId: string) => {
    const currentDests = getNormalizedDestinations(config);
    const targetPage = managedPages.find((p) => p.page_id === pageId);
    const updatedDests = currentDests.map((d) => {
      if (d.id === destId) {
        return {
          ...d,
          selectedPageId: pageId,
          selectedPageIds: [pageId],
          title: targetPage?.name || d.title,
        };
      }
      return d;
    });
    updateConfig({
      ...config,
      destination: updatedDests[0],
      destinations: updatedDests,
    });
  };

  const handleToggleDestinationNode = (destId: string) => {
    const currentDests = getNormalizedDestinations(config);
    const updatedDests = currentDests.map((d) => {
      if (d.id === destId) {
        return {
          ...d,
          enabled: d.enabled === false ? true : false,
        };
      }
      return d;
    });
    updateConfig({
      ...config,
      destination: updatedDests[0],
      destinations: updatedDests,
    });
  };

  const handleAddDestinationNode = (
    targetMode: 'remaining_posts' | 'social_media' | 'hybrid' = 'social_media',
    specificPageId?: string
  ) => {
    const currentDests = getNormalizedDestinations(config);
    const newId = `dest-${Date.now()}`;
    const targetPage = specificPageId
      ? managedPages.find((p) => p.page_id === specificPageId) || managedPages[0]
      : managedPages[currentDests.length % Math.max(1, managedPages.length)] || managedPages[0];
    const isDb = targetMode === 'remaining_posts' || targetMode === 'hybrid';
    const isSoc = targetMode === 'social_media' || targetMode === 'hybrid';
    const title = targetMode === 'remaining_posts'
      ? 'Remaining Posts Database'
      : targetMode === 'social_media'
      ? (targetPage?.name || 'Facebook Post')
      : 'Social & Database Storage';

    const newDest: DestinationNodeConfig = {
      id: newId,
      enabled: true,
      x: (currentDests[0]?.x || 740),
      y: (currentDests[currentDests.length - 1]?.y || 248) + 140,
      targetMode,
      storeInDatabase: isDb,
      postToSocialMedia: isSoc,
      selectedPageId: targetPage?.page_id || '1287202894475973',
      selectedPageIds: [targetPage?.page_id || '1287202894475973'],
      publishDirectly: true,
      includeHashtags: true,
      includeFirstComment: false,
      title,
    };

    const updatedDests = [...currentDests, newDest];
    const isOutputEnabled = config.outputNode?.enabled !== false;
    const newConns = [...(config.connections || [])];
    if (isOutputEnabled && !newConns.some((c) => c.fromNodeId === 'output' && c.toNodeId === newId)) {
      newConns.push({
        id: `conn-output-${newId}`,
        fromNodeId: 'output',
        toNodeId: newId,
      });
    }

    updateConfig({
      ...config,
      destination: updatedDests[0],
      destinations: updatedDests,
      connections: newConns,
    });
    if (activeModalNode?.type !== 'output') {
      setConnectDrawerNode(null);
      setActiveModalNode({ type: 'destination', destinationId: newId });
    }
  };

  const handleDeleteDestinationNode = (destId: string, e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const currentDests = getNormalizedDestinations(config);
    const target = currentDests.find((d) => d.id === destId);
    const nodeLabel = target?.title || 'Destination';

    setDeleteConfirmTarget({
      type: 'node',
      title: `Delete "${nodeLabel}"?`,
      description: 'Are you sure you want to remove this output destination? You can restore it anytime.',
      confirmText: 'Confirm Delete',
      onConfirm: () => {
        const remainingDests = currentDests.filter((d) => d.id !== destId);
        const remainingConns = (config.connections || []).filter((c) => {
          if (c.fromNodeId === destId || c.toNodeId === destId) return false;
          if (remainingDests.length === 0) {
            if (c.fromNodeId === 'destination' || c.toNodeId === 'destination') return false;
            if (c.fromNodeId.startsWith('dest-') || c.toNodeId.startsWith('dest-')) return false;
          }
          return true;
        });
        if (remainingDests.length === 0) {
          updateConfig({
            ...config,
            destination: {
              ...config.destination,
              enabled: false,
            },
            destinations: [],
            connections: remainingConns,
          });
        } else {
          updateConfig({
            ...config,
            destination: remainingDests[0],
            destinations: remainingDests,
            connections: remainingConns,
          });
        }
        if (activeModalNode?.type === 'destination') {
          setActiveModalNode(null);
        }
        setDeleteConfirmTarget(null);
      },
    });
  };

  const handleEnableDestination = () => {
    const hasCombine = (config.combineBoxes || []).some((b) => b && b.enabled !== false);
    const isOutputActive = !hasCombine && config.outputNode?.enabled !== false;
    const updatedConns = autoConnectWorkflow(
      config.aiBoxes,
      config.connections,
      config.getContent.enabled,
      config.getImages.enabled,
      true,
      isOutputActive,
      getNormalizedDestinations(config),
      config.combineBoxes || []
    );
    updateConfig({
      ...config,
      destination: {
        ...config.destination,
        enabled: true,
        x: config.destination?.x || 740,
        y: config.destination?.y || 248,
      },
      connections: updatedConns,
    });
    setDeletedBoxes((prev) => prev.filter((d) => d.box.id !== 'destination'));
  };

  const handleConnectOrCreateDestination = (
    fromNodeId: string,
    targetMode: 'remaining_posts' | 'social_media' | 'hybrid',
    platform?: 'facebook' | 'instagram' | 'tiktok' | 'database',
    account?: { id: string; name: string; username?: string; picture_url?: string }
  ) => {
    const rawDests = getNormalizedDestinations(config);
    const activeDests = rawDests.filter((d) => d.enabled !== false);

    // 1. If platform and account are explicitly given, create or connect to a dedicated node for this specific account
    if (platform && account) {
      let targetDest = activeDests.find(
        (d) =>
          d.platform === platform &&
          (d.accountId === account.id || d.selectedPageId === account.id || d.title === account.name)
      );

      let destId = targetDest?.id;
      let updatedDests = [...rawDests];

      if (!destId) {
        destId = `dest-${platform}-${account.id.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}`;
        const sourceDest = activeDests.find((d) => d.id === fromNodeId);
        const sourceCb = (config.combineBoxes || []).find((b) => b.id === fromNodeId);
        const lastDest = activeDests[activeDests.length - 1];
        let newX = 980;
        let newY = 248;
        if (sourceDest) {
          const siblingCount = (config.connections || []).filter((c) => c.fromNodeId === fromNodeId).length;
          newX = sourceDest.x + 180;
          newY = sourceDest.y + siblingCount * 115;
        } else if (sourceCb) {
          const siblingCount = (config.connections || []).filter((c) => c.fromNodeId === fromNodeId).length;
          newX = sourceCb.x + 180;
          newY = sourceCb.y + siblingCount * 115;
        } else if (lastDest) {
          newX = lastDest.x;
          newY = lastDest.y + 140;
        }

        const newDest: DestinationNodeConfig = {
          id: destId,
          enabled: true,
          x: newX,
          y: newY,
          targetMode: 'social_media',
          platform: platform,
          accountId: account.id,
          accountName: account.name,
          accountUsername: account.username,
          accountAvatar: account.picture_url,
          storeInDatabase: false,
          postToSocialMedia: true,
          selectedPageId: platform === 'facebook' ? account.id : undefined,
          selectedPageIds: platform === 'facebook' ? [account.id] : undefined,
          selectedIgAccountIds: platform === 'instagram' ? [account.id] : undefined,
          selectedTiktokAccountIds: platform === 'tiktok' ? [account.id] : undefined,
          publishDirectly: true,
          includeHashtags: true,
          includeFirstComment: false,
          includeContent: true,
          includeImages: true,
          title: account.name,
        };

        updatedDests = [...updatedDests.filter((d) => d.enabled !== false), newDest];
      }

      const existingConn = (config.connections || []).some(
        (c) => c.fromNodeId === fromNodeId && c.toNodeId === destId
      );

      const newConnections = existingConn
        ? config.connections || []
        : [
            ...(config.connections || []),
            {
              id: `conn-${fromNodeId}-${destId}-${Date.now()}`,
              fromNodeId,
              toNodeId: destId,
            },
          ];

      updateConfig({
        ...config,
        destination: updatedDests[0],
        destinations: updatedDests,
        connections: newConnections,
      });
      setQuickAddPopover(null);
      setConnectDrawerNode(null);
      return;
    }

    // 1b. If platform is specified without a specific account, create or connect to a platform hub node (e.g. Facebook box)
    if (platform && !account) {
      let targetDest = activeDests.find((d) => d.platform === platform && !d.accountId);
      let destId = targetDest?.id;
      let updatedDests = [...rawDests];

      if (!destId) {
        destId = `dest-platform-${platform}-${Date.now()}`;
        const sourceDest = activeDests.find((d) => d.id === fromNodeId);
        const sourceCb = (config.combineBoxes || []).find((b) => b.id === fromNodeId);
        const lastDest = activeDests[activeDests.length - 1];
        let newX = 980;
        let newY = 248;
        if (sourceCb) {
          const siblingCount = (config.connections || []).filter((c) => c.fromNodeId === fromNodeId).length;
          newX = sourceCb.x + 180;
          newY = sourceCb.y + siblingCount * 120;
        } else if (sourceDest) {
          const siblingCount = (config.connections || []).filter((c) => c.fromNodeId === fromNodeId).length;
          newX = sourceDest.x + 180;
          newY = sourceDest.y + siblingCount * 120;
        } else if (lastDest) {
          newX = lastDest.x;
          newY = lastDest.y + 140;
        }
        const platformTitle =
          platform === 'facebook'
            ? 'Facebook'
            : platform === 'instagram'
            ? 'Instagram'
            : platform === 'tiktok'
            ? 'TikTok'
            : 'Social Media';

        const newDest: DestinationNodeConfig = {
          id: destId,
          enabled: true,
          x: newX,
          y: newY,
          targetMode: 'social_media',
          platform: platform,
          title: platformTitle,
          storeInDatabase: false,
          postToSocialMedia: true,
          publishDirectly: true,
          includeContent: true,
          includeImages: true,
        };
        updatedDests = [...updatedDests.filter((d) => d.enabled !== false), newDest];
      }

      const existingConn = (config.connections || []).some(
        (c) => c.fromNodeId === fromNodeId && c.toNodeId === destId
      );

      const newConnections = existingConn
        ? config.connections || []
        : [
            ...(config.connections || []),
            {
              id: `conn-${fromNodeId}-${destId}-${Date.now()}`,
              fromNodeId,
              toNodeId: destId,
            },
          ];

      updateConfig({
        ...config,
        destination: updatedDests[0],
        destinations: updatedDests,
        connections: newConnections,
      });
      setQuickAddPopover(null);
      setConnectDrawerNode(null);
      return;
    }

    // 2. Look for an existing destination that matches this targetMode
    let targetDest = activeDests.find((d) => {
      const isDb = d.storeInDatabase ?? (d.targetMode !== 'social_media');
      const isSoc = d.postToSocialMedia ?? (d.targetMode !== 'remaining_posts');
      if (targetMode === 'remaining_posts') return isDb && !isSoc;
      if (targetMode === 'social_media') return isSoc && !isDb && !d.platform;
      return isDb && isSoc;
    });

    let destId = targetDest?.id;
    let updatedDests = [...rawDests];

    if (!destId) {
      destId = `dest-${Date.now()}`;
      const defaultPage = managedPages[0];
      const isDb = targetMode === 'remaining_posts' || targetMode === 'hybrid';
      const isSoc = targetMode === 'social_media' || targetMode === 'hybrid';
      const title =
        targetMode === 'remaining_posts'
          ? 'Remaining Posts Database'
          : targetMode === 'social_media'
          ? 'Social Media'
          : 'Social & Database Storage';

      const newDest: DestinationNodeConfig = {
        id: destId,
        enabled: true,
        x: updatedDests[0]?.x || 740,
        y: (updatedDests[updatedDests.length - 1]?.y || 248) + 140,
        targetMode,
        platform: targetMode === 'remaining_posts' ? 'database' : undefined,
        storeInDatabase: isDb,
        postToSocialMedia: isSoc,
        selectedPageId: defaultPage?.page_id || '1287202894475973',
        selectedPageIds: [defaultPage?.page_id || '1287202894475973'],
        selectedIgAccountIds: [managedIgAccounts[0]?.account_id || 'ig-1'],
        selectedTiktokAccountIds: [managedTiktokAccounts[0]?.account_id || 'tt-1'],
        publishDirectly: true,
        includeHashtags: true,
        includeFirstComment: false,
        includeContent: true,
        includeImages: true,
        title,
      };

      updatedDests = [...updatedDests.filter((d) => d.enabled !== false), newDest];
    }

    // Connect fromNodeId -> destId
    const existingConn = (config.connections || []).some(
      (c) => c.fromNodeId === fromNodeId && c.toNodeId === destId
    );

    const newConnections = existingConn
      ? config.connections || []
      : [
          ...(config.connections || []),
          {
            id: `conn-${fromNodeId}-${destId}-${Date.now()}`,
            fromNodeId,
            toNodeId: destId,
          },
        ];

    const nextConfig = buildAlignedLayout(config.aiBoxes, newConnections, {
      ...config,
      destination: updatedDests[0],
      destinations: updatedDests,
      connections: newConnections,
    });
    updateConfig(nextConfig);
    setQuickAddPopover(null);
    setConnectDrawerNode(null);
  };

  const handleAddOutputNode = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const currentDests = getNormalizedDestinations(config);
    const destX = currentDests[0]?.x ?? 740;
    const destY = currentDests[0]?.y ?? 248;
    const outX = Math.max(320, destX - 160);
    const outY = destY;

    const newOutputNode: OutputNodeConfig = {
      id: 'output',
      enabled: true,
      x: config.outputNode?.x ?? outX,
      y: config.outputNode?.y ?? outY,
      title: config.outputNode?.title || 'Final Content & Images',
    };

    let conns = [...(config.connections || [])];
    
    // Auto-connect content and image nodes to output
    const contentBoxes = config.aiBoxes.filter((b) => !isWatermarkAIBox(b) && !isEnhanceAIBox(b, conns));
    const imageBoxes = config.aiBoxes.filter((b) => isWatermarkAIBox(b) || isEnhanceAIBox(b, conns));

    const sourceIds: string[] = [];
    if (contentBoxes.length > 0) {
      contentBoxes.forEach((b) => sourceIds.push(b.id));
    } else if (config.getContent.enabled) {
      sourceIds.push('get-content');
    }

    if (imageBoxes.length > 0) {
      imageBoxes.forEach((b) => sourceIds.push(b.id));
    } else if (config.getImages.enabled) {
      sourceIds.push('get-images');
    }

    sourceIds.forEach((srcId) => {
      if (!conns.some((c) => c.fromNodeId === srcId && c.toNodeId === 'output')) {
        conns.push({
          id: `conn-${srcId}-output-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          fromNodeId: srcId,
          toNodeId: 'output',
        });
      }
    });

    // Auto-connect output to destination nodes
    currentDests.forEach((dest) => {
      if (dest.enabled !== false && !conns.some((c) => c.fromNodeId === 'output' && c.toNodeId === dest.id)) {
        conns.push({
          id: `conn-output-${dest.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          fromNodeId: 'output',
          toNodeId: dest.id,
        });
      }
    });

    updateConfig({
      ...config,
      outputNode: newOutputNode,
      connections: conns,
    });
    setConnectDrawerNode(null);
    setActiveModalNode({ type: 'output' });
  };

  const handleConnectOrCreateOutputNode = (fromNodeId: string) => {
    const currentDests = getNormalizedDestinations(config);
    const destX = currentDests[0]?.x ?? 740;
    const destY = currentDests[0]?.y ?? 248;
    const outX = Math.max(320, destX - 160);
    const outY = destY;

    const newOutputNode: OutputNodeConfig = {
      id: 'output',
      enabled: true,
      x: config.outputNode?.x ?? outX,
      y: config.outputNode?.y ?? outY,
      title: config.outputNode?.title || 'Final Content & Images',
    };

    let conns = [...(config.connections || [])];
    if (!conns.some((c) => c.fromNodeId === fromNodeId && c.toNodeId === 'output')) {
      conns.push({
        id: `conn-${fromNodeId}-output-${Date.now()}`,
        fromNodeId,
        toNodeId: 'output',
      });
    }

    // Connect output -> destination if destination exists
    currentDests.forEach((dest) => {
      if (dest.enabled !== false && !conns.some((c) => c.fromNodeId === 'output' && c.toNodeId === dest.id)) {
        conns.push({
          id: `conn-output-${dest.id}-${Date.now()}`,
          fromNodeId: 'output',
          toNodeId: dest.id,
        });
      }
    });

    updateConfig({
      ...config,
      outputNode: newOutputNode,
      connections: conns,
    });
    setQuickAddPopover(null);
    setConnectDrawerNode(null);
    setActiveModalNode({ type: 'output' });
  };

  const handleDeleteOutputNode = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setDeleteConfirmTarget({
      type: 'node',
      title: 'Remove "Post Output" Node?',
      description: 'Are you sure you want to remove the Output box? Your upstream content and media nodes will remain intact.',
      confirmText: 'Confirm Remove',
      onConfirm: () => {
        const remainingConns = (config.connections || []).filter(
          (c) => c.fromNodeId !== 'output' && c.toNodeId !== 'output'
        );
        updateConfig({
          ...config,
          outputNode: {
            ...config.outputNode,
            id: 'output',
            enabled: false,
          },
          connections: remainingConns,
        });
        if (activeModalNode?.type === 'output') {
          setActiveModalNode(null);
        }
        setDeleteConfirmTarget(null);
      },
     });
  };

  const handleConnectOrCreateGetContent = (fromNodeId: string) => {
    const conns = [...(config.connections || [])];
    if (!conns.some((c) => c.fromNodeId === fromNodeId && c.toNodeId === 'get-content')) {
      conns.push({
        id: `conn-${fromNodeId}-get-content-${Date.now()}`,
        fromNodeId,
        toNodeId: 'get-content',
      });
    }
    updateConfig({
      ...config,
      getContent: {
        ...config.getContent,
        enabled: true,
        x: config.getContent.x ?? ((config.trigger.x ?? 80) + 220),
        y: config.getContent.y ?? 140,
      },
      connections: conns,
    });
    setConnectDrawerNode(null);
    setActiveModalNode({ type: 'get-content' });
  };

  const handleConnectOrCreateGetImages = (fromNodeId: string) => {
    const conns = [...(config.connections || [])];
    if (!conns.some((c) => c.fromNodeId === fromNodeId && c.toNodeId === 'get-images')) {
      conns.push({
        id: `conn-${fromNodeId}-get-images-${Date.now()}`,
        fromNodeId,
        toNodeId: 'get-images',
      });
    }
    updateConfig({
      ...config,
      getImages: {
        ...config.getImages,
        enabled: true,
        x: config.getImages.x ?? ((config.trigger.x ?? 80) + 220),
        y: config.getImages.y ?? 356,
      },
      connections: conns,
    });
    setConnectDrawerNode(null);
    setActiveModalNode({ type: 'get-images' });
  };

  // ── Combine Box handlers ─────────────────────────────────────────────────
  const handleAddCombineBox = (fromNodeId: string): string => {
    const id = `combine-box-${Date.now()}`;
    const fromNode = (function () {
      if (fromNodeId === 'trigger') return { x: config.trigger.x ?? 80, y: config.trigger.y ?? 248 };
      if (fromNodeId === 'get-content') return { x: config.getContent.x ?? 300, y: config.getContent.y ?? 140 };
      if (fromNodeId === 'get-images') return { x: config.getImages.x ?? 300, y: config.getImages.y ?? 356 };
      const box = config.aiBoxes.find((b) => b.id === fromNodeId);
      if (box) return { x: box.x, y: box.y };
      const existingCb = (config.combineBoxes || []).find((b) => b.id === fromNodeId);
      if (existingCb) return { x: existingCb.x, y: existingCb.y };
      return { x: 500, y: 248 };
    })();

    const newBox: CombineBoxConfig = {
      id,
      title: 'Combine Box',
      enabled: true,
      x: fromNode.x + 220,
      y: fromNode.y,
    };

    const newConn: WorkflowWireConnection = {
      id: `conn-${fromNodeId}-${id}`,
      fromNodeId,
      toNodeId: id,
    };

    const nextCombineBoxes = [...(config.combineBoxes || []), newBox];
    const nextConns = [...(config.connections || []), newConn];
    const nextConfig = buildAlignedLayout(config.aiBoxes, nextConns, {
      ...config,
      combineBoxes: nextCombineBoxes,
      connections: nextConns,
    });
    updateConfig(nextConfig);
    return id;
  };

  const handleConnectOrCreateCombineBox = (fromNodeId: string): string => {
    const existingCb = (config.combineBoxes || []).find((b) => b.enabled !== false);
    if (existingCb) {
      if (!(config.connections || []).some((c) => c.fromNodeId === fromNodeId && c.toNodeId === existingCb.id)) {
        const newConn: WorkflowWireConnection = {
          id: `conn-${fromNodeId}-${existingCb.id}-${Date.now()}`,
          fromNodeId,
          toNodeId: existingCb.id,
        };
        const nextConns = [...(config.connections || []), newConn];
        updateConfig(buildAlignedLayout(config.aiBoxes, nextConns, { ...config, connections: nextConns }));
      }
      return existingCb.id;
    }
    return handleAddCombineBox(fromNodeId);
  };

  const handleDeleteCombineBox = (boxId: string, e?: React.SyntheticEvent) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setDeleteConfirmTarget({
      type: 'node',
      title: 'Delete Combine Box?',
      description: 'Remove this Combine Box and all its wires. Upstream nodes stay intact.',
      confirmText: 'Delete',
      onConfirm: () => {
        const remainingBoxes = (config.combineBoxes || []).filter((b) => b.id !== boxId);
        const remainingConns = (config.connections || []).filter((c) => c.fromNodeId !== boxId && c.toNodeId !== boxId);
        const nextConfig = buildAlignedLayout(config.aiBoxes, remainingConns, {
          ...config,
          combineBoxes: remainingBoxes,
          connections: remainingConns,
        });
        updateConfig(nextConfig);
        if (activeModalNode?.type === 'combine' && (activeModalNode.combineId === boxId || (activeModalNode as any).id === boxId)) {
          setActiveModalNode(null);
        }
        setDeleteConfirmTarget(null);
      },
    });
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleAddNewPage = () => {
    if (!newPageName.trim() || !newPageId.trim()) return;
    const nextSlot = managedPages.length + 1;
    const newPage: ManagedPageMeta = {
      id: Date.now(),
      slot: nextSlot,
      page_id: newPageId.trim(),
      name: newPageName.trim(),
      label: `Page Slot ${nextSlot}`,
      page_url: `https://www.facebook.com/profile.php?id=${newPageId.trim()}`,
      picture_url: newPagePicture.trim() || undefined,
      category: newPageCategory.trim() || 'Real Estate Agency',
      has_token: true,
      token_hint: '••••mock',
      token_status: 'VALID',
      permissions: ['CREATE_CONTENT', 'pages_manage_posts', 'pages_read_engagement'],
      can_create_content: true,
      test_passed: true,
      is_connected: true,
      auto_publish_enabled: true,
      ready_to_publish: true,
      last_tested_at: 'Just now',
    };
    saveStoredManagedPage(newPage);
    const updated = getStoredManagedPages();
    setManagedPages(updated.length > 0 ? updated : [...managedPages, newPage]);
    updateConfig({
      ...config,
      destination: {
        ...config.destination,
        targetMode: 'social_media',
        selectedPageId: newPage.page_id,
        title: config.destination?.title || 'Social Media',
      },
    });
    setIsAddPageOpen(false);
    setNewPageName('');
    setNewPageId('');
    setNewPageCategory('Real Estate Agency');
    setNewPagePicture('');
  };

  const handleAddNewIgAccount = () => {
    if (!newIgUsername.trim()) return;
    const cleanUsername = newIgUsername.trim().startsWith('@') ? newIgUsername.trim() : `@${newIgUsername.trim()}`;
    const newAcct: ManagedSocialAccountMeta = {
      account_id: `ig-${Date.now()}`,
      username: cleanUsername,
      name: newIgName.trim() || cleanUsername,
      platform: 'instagram',
      category: 'Real Estate',
    };
    setManagedIgAccounts((prev) => [...prev, newAcct]);
    setIsAddIgOpen(false);
    setNewIgUsername('');
    setNewIgName('');
  };

  const handleAddNewTiktokAccount = () => {
    if (!newTiktokUsername.trim()) return;
    const cleanUsername = newTiktokUsername.trim().startsWith('@') ? newTiktokUsername.trim() : `@${newTiktokUsername.trim()}`;
    const newAcct: ManagedSocialAccountMeta = {
      account_id: `tt-${Date.now()}`,
      username: cleanUsername,
      name: newTiktokName.trim() || cleanUsername,
      platform: 'tiktok',
      category: 'Video Tours',
    };
    setManagedTiktokAccounts((prev) => [...prev, newAcct]);
    setIsAddTiktokOpen(false);
    setNewTiktokUsername('');
    setNewTiktokName('');
  };

  const handleTogglePageActive = (pageId: string) => {
    const page = managedPages.find((p) => p.page_id === pageId);
    if (!page) return;
    const updatedPage: ManagedPageMeta = {
      ...page,
      auto_publish_enabled: !page.auto_publish_enabled,
      ready_to_publish: !page.auto_publish_enabled && page.has_token,
    };
    saveStoredManagedPage(updatedPage);
    const updated = getStoredManagedPages();
    setManagedPages(updated.length > 0 ? updated : managedPages.map((p) => (p.page_id === pageId ? updatedPage : p)));
  };

  const handleWireDelete = (conn: WorkflowWireConnection, e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setHoveredWireId(null);
    setHoveredXId(null);

    if (conn.fromNodeId === 'trigger' && conn.toNodeId === 'get-content') {
      setDeleteConfirmTarget({
        type: 'connection',
        title: 'Disconnect "Get Content"?',
        description: 'Are you sure you want to disconnect and remove the Get Content step from this workflow?',
        confirmText: 'Confirm Disconnect',
        onConfirm: () => {
          executeDeleteGetContent();
          setDeleteConfirmTarget(null);
        },
      });
      return;
    }
    if (conn.fromNodeId === 'trigger' && conn.toNodeId === 'get-images') {
      setDeleteConfirmTarget({
        type: 'connection',
        title: 'Disconnect "Get Images"?',
        description: 'Are you sure you want to disconnect and remove the Get Images step from this workflow?',
        confirmText: 'Confirm Disconnect',
        onConfirm: () => {
          executeDeleteGetImages();
          setDeleteConfirmTarget(null);
        },
      });
      return;
    }
    // For all node-to-node wires (AI models, format presets, watermark/cut presets, combine boxes, destinations):
    // Clicking (X) purely disconnects the wire. It NEVER deletes the source or target box!
    handleRemoveConnection(conn.id, conn.fromNodeId, conn.toNodeId, e);
  };

  const handleRemoveConnection = (
    connId: string,
    fromNodeId?: string,
    toNodeId?: string,
    e?: React.SyntheticEvent
  ) => {
    if (e) {
      e.stopPropagation();
    }
    setHoveredWireId(null);
    setHoveredXId(null);
    const newConnections = (config.connections || []).filter((c) => {
      if (c.id === connId) return false;
      if (fromNodeId && toNodeId && c.fromNodeId === fromNodeId && c.toNodeId === toNodeId) return false;
      return true;
    });
    updateConfig({
      ...config,
      connections: newConnections,
    });
  };

  // Add Dynamic Text AI Model Box (Gemini, OpenAI, Claude, LaoZhang)
  const handleAddTextAIBox = (fromNodeId: string = 'get-content'): string => {
    const textAIBoxes = config.aiBoxes.filter((b) => isTextAIBox(b, config.connections));
    const newCount = textAIBoxes.length + 1;
    const newId = `ai-box-${Date.now()}`;
    const newBox: DynamicAIBoxConfig = {
      id: newId,
      title: 'Gemini 2.5 Flash',
      processType: 'text_ai',
      provider: 'google_ai',
      model: 'gemini-flash-latest',
      templateId: '',
      templateText: '',
      customPrompt: '',
      enabled: true,
      x: 520,
      y: 80 + (newCount - 1) * 120,
    };

    const newConn: WorkflowWireConnection = {
      id: `conn-${fromNodeId}-${newId}`,
      fromNodeId: fromNodeId,
      toNodeId: newId,
    };

    const nextBoxes = [...config.aiBoxes, newBox];
    const nextConns = autoConnectWorkflow(
      nextBoxes,
      [...(config.connections || []), newConn],
      config.getContent.enabled,
      config.getImages.enabled,
      config.destination?.enabled !== false,
      config.outputNode?.enabled !== false,
      getNormalizedDestinations(config),
      config.combineBoxes || []
    );
    updateConfig(buildAlignedLayout(nextBoxes, nextConns, { ...config, aiBoxes: nextBoxes, connections: nextConns }));
    setSelectedBoxId(newId);
    return newId;
  };

  // Add Dynamic Text Format Preset Box (connects from a Text AI Model Box or fromNodeId)
  const handleAddTextFormatBox = (sourceAIBoxId?: string, templateOverride?: CanvasPromptOption): string => {
    const prompts = loadAvailablePromptTemplates();
    const formatBoxes = config.aiBoxes.filter((b) => isTextFormatAIBox(b));
    const newCount = formatBoxes.length + 1;

    const chosenTemplate =
      templateOverride ||
      (prompts.length > 0 ? prompts[(newCount - 1) % prompts.length] : undefined);

    const sourceBox = sourceAIBoxId ? config.aiBoxes.find((b) => b.id === sourceAIBoxId) : undefined;
    const fromId = sourceAIBoxId || config.aiBoxes.find((b) => isTextAIBox(b, config.connections))?.id || 'get-content';

    const newId = `ai-box-format-${Date.now()}`;
    const newBox: DynamicAIBoxConfig = {
      id: newId,
      title: chosenTemplate ? `Format: ${chosenTemplate.name}` : `Format Preset #${newCount}`,
      processType: 'text_format',
      provider: sourceBox?.provider || 'google_ai',
      model: sourceBox?.model || 'gemini-flash-latest',
      templateId: chosenTemplate ? String(chosenTemplate.id) : 'custom',
      templateText: chosenTemplate
        ? chosenTemplate.templateText
        : 'Generate optimized marketing copy for this property listing.\nHighlight rent/sale price, transit access, and clear call-to-action.',
      customPrompt: '',
      enabled: true,
      x: 740,
      y: 80 + (newCount - 1) * 120,
    };

    const newConn: WorkflowWireConnection = {
      id: `conn-${fromId}-${newId}`,
      fromNodeId: fromId,
      toNodeId: newId,
    };

    const nextBoxes = [...config.aiBoxes, newBox];
    const nextConns = [...(config.connections || []), newConn];
    updateConfig(buildAlignedLayout(nextBoxes, nextConns, { ...config, aiBoxes: nextBoxes, connections: nextConns }));
    setSelectedBoxId(newId);
    return newId;
  };

  const handleAddAIBoxConnectedFromContent = (_templateOverride?: CanvasPromptOption): string => {
    return handleAddTextAIBox('get-content');
  };

  const handleAddAIBoxConnectedFrom = (fromNodeId: string, templateOverride?: CanvasPromptOption): string => {
    if (fromNodeId === 'get-content') {
      return handleAddTextAIBox(fromNodeId);
    }
    return handleAddTextFormatBox(fromNodeId, templateOverride);
  };

  // Add Dynamic Image AI Box connected from Get Images (Enhance Images)
  const handleAddAIBoxConnectedFromImages = (_sourceId?: string): string => {
    const enhanceBoxes = config.aiBoxes.filter((b) => isEnhanceAIBox(b));
    const newCount = enhanceBoxes.length + 1;
    const newId = `ai-box-${Date.now()}`;
    const newBox: DynamicAIBoxConfig = {
      id: newId,
      title: `Image Enhancer #${newCount}`,
      processType: 'image_enhance',
      provider: 'runware_ai',
      model: 'runware:101@1',
      templateId: 'image-hdr',
      templateText:
        'Enhance real estate property photo: clean natural lighting, architectural clarity, realistic interior staging, ultra sharp 8k detail.',
      customPrompt: 'Real estate interior luxury enhancement, warm lighting, high detail, remove noise',
      enabled: true,
      x: 580,
      y: 360 + (newCount - 1) * 140,
    };

    const nextBoxes = [...config.aiBoxes, newBox];
    const updatedGetImages = {
      ...config.getImages,
      enabled: true,
      x: config.getImages.x || 300,
      y: config.getImages.y || 356,
    };

    let nextConns = [...(config.connections || [])];
    if (config.trigger.enabled && !nextConns.some((c) => c.fromNodeId === 'trigger' && c.toNodeId === 'get-images')) {
      nextConns.push({
        id: 'conn-trigger-images',
        fromNodeId: 'trigger',
        toNodeId: 'get-images',
      });
    }
    if (!nextConns.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === newId)) {
      nextConns.push({
        id: `conn-images-${newId}`,
        fromNodeId: 'get-images',
        toNodeId: newId,
      });
    }

    nextConns = autoConnectImagePipeline(nextBoxes, nextConns, config.getContent.enabled, true);
    const nextConfig = {
      ...config,
      getImages: updatedGetImages,
      aiBoxes: nextBoxes,
      connections: nextConns,
    };
    updateConfig(buildAlignedLayout(nextBoxes, nextConns, nextConfig));
    setSelectedBoxId(newId);
    return newId;
  };

  // Add Dynamic Studio Format Node (using saved formats from Crop & Cut Studio)
  const handleAddWatermarkNodeConnectedFromImages = (_sourceId?: string, formatOverride?: CropStudioFormat): string => {
    const savedCropFormats = getSavedCropFormats();
    const defaultFormat = formatOverride || savedCropFormats.find((f) => f.isDefault) || savedCropFormats[0];

    const watermarkBoxes = config.aiBoxes.filter((b) => isWatermarkAIBox(b));
    const newCount = watermarkBoxes.length + 1;
    const newId = `ai-box-watermark-${Date.now()}`;

    const newBox: DynamicAIBoxConfig = {
      id: newId,
      title: defaultFormat ? `Format: ${defaultFormat.name}` : `Crop & Format #${newCount}`,
      subtitle: defaultFormat ? `${defaultFormat.targetWidth}×${defaultFormat.targetHeight} (${defaultFormat.aspect || 'Crop'})` : 'Saved Studio Format',
      processType: 'watermark',
      provider: 'watermark',
      model: 'watermark',
      templateId: defaultFormat?.id || '',
      templateText: defaultFormat?.name || '',
      cropFormatId: defaultFormat?.id || '',
      watermarkPresetId: defaultFormat?.id || '',
      customPrompt: '',
      enabled: true,
      x: 820,
      y: 390 + (newCount - 1) * 140,
    };

    const nextBoxes = [...config.aiBoxes, newBox];
    const updatedGetImages = {
      ...config.getImages,
      enabled: true,
      x: config.getImages.x || 300,
      y: config.getImages.y || 356,
    };

    let nextConns = [...(config.connections || [])];
    if (config.trigger.enabled && !nextConns.some((c) => c.fromNodeId === 'trigger' && c.toNodeId === 'get-images')) {
      nextConns.push({
        id: 'conn-trigger-images',
        fromNodeId: 'trigger',
        toNodeId: 'get-images',
      });
    }

    nextConns = autoConnectImagePipeline(nextBoxes, nextConns, config.getContent.enabled, true);
    const nextConfig = {
      ...config,
      getImages: updatedGetImages,
      aiBoxes: nextBoxes,
      connections: nextConns,
    };
    updateConfig(buildAlignedLayout(nextBoxes, nextConns, nextConfig));
    setSelectedBoxId(newId);
    return newId;
  };

  // Add Dynamic AI Box (appears on canvas first, not connected to another until user creates what it is used for and drags string)
  const handleAddAIBox = (templateOverride?: CanvasPromptOption) => {
    const prompts = loadAvailablePromptTemplates();
    const boxCount = config.aiBoxes.length;
    const maxY = config.aiBoxes.reduce((max, b) => Math.max(max, b.y), 0);
    const newY = boxCount === 0 ? 80 : maxY + 150;

    // Pick next prompt template from library
    const chosenTemplate =
      templateOverride ||
      (prompts.length > 0 ? prompts[boxCount % prompts.length] : undefined);

    const newId = `ai-box-${Date.now()}`;
    const newBox: DynamicAIBoxConfig = {
      id: newId,
      title: chosenTemplate ? chosenTemplate.name : `AI Process #${boxCount + 1}`,
      provider: 'google_ai',
      model: 'gemini-flash-latest',
      templateId: chosenTemplate ? String(chosenTemplate.id) : 'custom',
      templateText: chosenTemplate
        ? chosenTemplate.templateText
        : 'Generate optimized marketing copy for this property listing.\nHighlight rent/sale price, transit access, and clear call-to-action.',
      customPrompt: '',
      enabled: true,
      x: 640,
      y: newY,
    };

    const newConfig = {
      ...config,
      aiBoxes: [...config.aiBoxes, newBox],
      // Starts completely unconnected on canvas
    };
    updateConfig(newConfig);
    setSelectedBoxId(newId);
    // User requested: "show that cycle at canvas first don't need to connected in another until I create what that use for and after that I can connect it with drap that string"
  };

  // Helper for rendering AI Box icon in recover & delete modals
  const renderAIBoxIcon = (b: DynamicAIBoxConfig, size = 22) => {
    if (b.id === 'get-content') return <FiFileText style={{ fontSize: `${size}px`, color: '#3B82F6' }} />;
    if (b.id === 'get-images') return <FiImage style={{ fontSize: `${size}px`, color: '#10B981' }} />;
    const isWatermark = isWatermarkAIBox(b);
    if (isWatermark) return <FiScissors style={{ fontSize: `${size}px`, color: '#8B5CF6' }} />;
    const isImageNode = isImageAIBox(b, config.connections);
    const isGoogle = !isImageNode && (b.provider === 'google_ai' || isImageModel(b.model, b.provider) || (!b.provider && !b.model?.startsWith('runware:')));
    const isLaoZhang = !isImageNode && b.provider === 'laozhang_ai';
    const isRunware = isImageNode;

    if (isRunware) return <RunwareIcon size={size} color="#10B981" />;
    if (isLaoZhang) return <LaoZhangIcon size={size} />;
    if (isGoogle) return <SiGooglegemini style={{ fontSize: `${size}px`, color: '#58A6FF' }} />;
    return <OpenAIIcon size={size} color="#3FB950" />;
  };

  const timeAgo = (timestamp: number): string => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  const confirmDeleteAIBox = (id: string) => {
    const box = config.aiBoxes.find((b) => b.id === id);
    if (!box) {
      return;
    }

    const associatedConnections = (config.connections || []).filter(
      (c) => c.fromNodeId === id || c.toNodeId === id
    );

    const newRecord: DeletedAIBoxRecord = {
      box,
      connections: associatedConnections,
      deletedAt: Date.now(),
    };

    const nextDeleted = [newRecord, ...deletedBoxes.filter((d) => d.box.id !== id)];
    setDeletedBoxes(nextDeleted);
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(nextDeleted));
    } catch {}

    const newBoxes = config.aiBoxes.filter((b) => b.id !== id);
    const unassociatedConnections = (config.connections || []).filter(
      (c) => c.fromNodeId !== id && c.toNodeId !== id
    );
    const newConnections = autoConnectImagePipeline(newBoxes, unassociatedConnections);
    const newConfig = buildAlignedLayout(newBoxes, newConnections, {
      ...config,
      aiBoxes: newBoxes,
      connections: newConnections,
    });
    updateConfig(newConfig);

    if (selectedBoxId === id) setSelectedBoxId(null);
    if (activeModalNode?.type === 'ai-box' && activeModalNode.boxId === id) {
      setActiveModalNode(null);
    }
  };

  // Delete Dynamic AI Box - asks confirmation before putting into Deleted Nodes
  const handleDeleteAIBox = (id: string, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    const box = config.aiBoxes.find((b) => b.id === id);
    const title = box?.title || (isWatermarkAIBox(box) ? 'Format Preset' : 'AI Node');
    setDeleteConfirmTarget({
      type: 'node',
      title: `Delete "${title}"?`,
      description: `Are you sure you want to delete "${title}"? You can recover it anytime from General Settings.`,
      confirmText: 'Confirm Delete',
      onConfirm: () => {
        confirmDeleteAIBox(id);
        setDeleteConfirmTarget(null);
      },
    });
  };

  // Recover selected deleted boxes back onto canvas
  const handleRecoverSelected = (targetIds?: Set<string>) => {
    const ids = targetIds || selectRecoverIds;
    if (ids.size === 0) return;

    const recordsToRestore = deletedBoxes.filter((r) => ids.has(r.box.id));
    if (recordsToRestore.length === 0) return;

    let enableContent = false;
    let enableImages = false;
    let maxY = config.aiBoxes.reduce((max, b) => Math.max(max, b.y), 60);
    const restoredBoxes: DynamicAIBoxConfig[] = [];
    const restoredConns: WorkflowWireConnection[] = [];
    const existingIds = new Set(config.aiBoxes.map((b) => b.id));

    recordsToRestore.forEach((record) => {
      if (record.box.id === 'get-content') {
        enableContent = true;
        record.connections.forEach((conn) => {
          if (!restoredConns.some((c) => c.fromNodeId === conn.fromNodeId && c.toNodeId === conn.toNodeId)) {
            restoredConns.push(conn);
          }
        });
        return;
      }
      if (record.box.id === 'get-images') {
        enableImages = true;
        record.connections.forEach((conn) => {
          if (!restoredConns.some((c) => c.fromNodeId === conn.fromNodeId && c.toNodeId === conn.toNodeId)) {
            restoredConns.push(conn);
          }
        });
        return;
      }

      let b = { ...record.box };
      if (existingIds.has(b.id)) {
        b.id = `ai-box-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      }
      existingIds.add(b.id);

      const hasOverlap = config.aiBoxes.some((ex) => Math.hypot(ex.x - b.x, ex.y - b.y) < 50);
      if (hasOverlap) {
        maxY += 130;
        b = { ...b, y: maxY };
      }
      restoredBoxes.push(b);

      record.connections.forEach((conn) => {
        const fromExists =
          conn.fromNodeId === 'get-content' ||
          conn.fromNodeId === 'get-images' ||
          config.aiBoxes.some((x) => x.id === conn.fromNodeId) ||
          restoredBoxes.some((x) => x.id === conn.fromNodeId);

        const toExists =
          conn.toNodeId === 'destination' ||
          config.aiBoxes.some((x) => x.id === conn.toNodeId) ||
          restoredBoxes.some((x) => x.id === conn.toNodeId);

        if (fromExists && toExists) {
          const fromId = conn.fromNodeId === record.box.id ? b.id : conn.fromNodeId;
          const toId = conn.toNodeId === record.box.id ? b.id : conn.toNodeId;
          const alreadyExists =
            (config.connections || []).some((c) => c.fromNodeId === fromId && c.toNodeId === toId) ||
            restoredConns.some((c) => c.fromNodeId === fromId && c.toNodeId === toId);

          if (!alreadyExists) {
            restoredConns.push({
              id: `conn-restored-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              fromNodeId: fromId,
              toNodeId: toId,
            });
          }
        }
      });
    });

    const nextBoxes = [...config.aiBoxes, ...restoredBoxes];
    const nextConns = [...(config.connections || []), ...restoredConns];
    const nextConfig = {
      ...config,
      getContent: enableContent ? { ...config.getContent, enabled: true } : config.getContent,
      getImages: enableImages ? { ...config.getImages, enabled: true } : config.getImages,
      aiBoxes: nextBoxes,
      connections: nextConns,
    };
    updateConfig(buildAlignedLayout(nextBoxes, nextConns, nextConfig));

    const remaining = deletedBoxes.filter((r) => !ids.has(r.box.id));
    setDeletedBoxes(remaining);
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(remaining));
    } catch {}

    setSelectRecoverIds(new Set());
  };

  // Multi-node deletion execution
  const executeDeleteMultipleNodes = (idsToDelete: Set<string>) => {
    if (idsToDelete.size === 0) return;

    setHoveredWireId(null);
    setHoveredXId(null);

    const boxesToDelete = config.aiBoxes.filter((b) => idsToDelete.has(b.id));
    const newRecords: DeletedAIBoxRecord[] = [];

    boxesToDelete.forEach((box) => {
      const associatedConns = (config.connections || []).filter(
        (c) => c.fromNodeId === box.id || c.toNodeId === box.id
      );
      newRecords.push({
        box,
        connections: associatedConns,
        deletedAt: Date.now(),
      });
    });

    if (idsToDelete.has('get-content')) {
      const associatedConns = (config.connections || []).filter(
        (c) => c.fromNodeId === 'get-content' || c.toNodeId === 'get-content'
      );
      newRecords.push({
        box: {
          id: 'get-content',
          title: 'Get Content (Real Estate Text)',
          processType: 'text_extract',
          provider: 'openai',
          model: 'gpt-4o-mini',
          templateId: 'content',
          templateText: '',
          customPrompt: '',
          enabled: true,
          x: config.getContent.x || 300,
          y: config.getContent.y || 140,
        },
        connections: associatedConns,
        deletedAt: Date.now(),
      });
    }

    if (idsToDelete.has('get-images')) {
      const associatedConns = (config.connections || []).filter(
        (c) => c.fromNodeId === 'get-images' || c.toNodeId === 'get-images'
      );
      newRecords.push({
        box: {
          id: 'get-images',
          title: 'Get Images (HD Media)',
          processType: 'image_upscale',
          provider: 'runware_ai',
          model: 'runware:upscale',
          templateId: 'images',
          templateText: '',
          customPrompt: '',
          enabled: true,
          x: config.getImages.x || 300,
          y: config.getImages.y || 356,
        },
        connections: associatedConns,
        deletedAt: Date.now(),
      });
    }

    if (newRecords.length > 0) {
      const nextDeleted = [
        ...newRecords,
        ...deletedBoxes.filter((d) => !idsToDelete.has(d.box.id)),
      ];
      setDeletedBoxes(nextDeleted);
      try {
        localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(nextDeleted));
      } catch {}
    }

    const remainingAiBoxes = config.aiBoxes.filter((b) => !idsToDelete.has(b.id));
    const remainingCombineBoxes = (config.combineBoxes || []).filter((b) => !idsToDelete.has(b.id));

    const currentDests = getNormalizedDestinations(config);
    const remainingDests = currentDests.filter(
      (d) => !idsToDelete.has(d.id) && (d.id !== 'destination' || !idsToDelete.has('destination'))
    );

    const isConnRemoved = (c: WorkflowWireConnection) => {
      if (idsToDelete.has(c.fromNodeId) || idsToDelete.has(c.toNodeId)) return true;
      if (remainingDests.length === 0) {
        if (c.fromNodeId === 'destination' || c.toNodeId === 'destination') return true;
        if (c.fromNodeId.startsWith('dest-') || c.toNodeId.startsWith('dest-')) return true;
      }
      return false;
    };
    const remainingConnections = (config.connections || []).filter((c) => !isConnRemoved(c));

    const newConfig: FacebookWorkflowConfig = {
      ...config,
      trigger: idsToDelete.has('trigger') ? { ...config.trigger, enabled: false } : config.trigger,
      getContent: idsToDelete.has('get-content') ? { ...config.getContent, enabled: false } : config.getContent,
      getImages: idsToDelete.has('get-images') ? { ...config.getImages, enabled: false } : config.getImages,
      outputNode: idsToDelete.has('output') ? { ...config.outputNode, enabled: false } : config.outputNode,
      destination: idsToDelete.has('destination') || remainingDests.length === 0
        ? { ...config.destination, enabled: false }
        : remainingDests[0],
      destinations: remainingDests,
      aiBoxes: remainingAiBoxes,
      combineBoxes: remainingCombineBoxes,
      connections: remainingConnections,
    };

    updateConfig(newConfig);

    if (selectedBoxId && idsToDelete.has(selectedBoxId)) {
      setSelectedBoxId(null);
    }
    if (activeModalNode) {
      if (
        (activeModalNode.type === 'trigger' && idsToDelete.has('trigger')) ||
        (activeModalNode.type === 'get-content' && idsToDelete.has('get-content')) ||
        (activeModalNode.type === 'get-images' && idsToDelete.has('get-images')) ||
        (activeModalNode.type === 'output' && idsToDelete.has('output')) ||
        (activeModalNode.type === 'ai-box' && idsToDelete.has(activeModalNode.boxId)) ||
        (activeModalNode.type === 'combine' && idsToDelete.has(activeModalNode.combineId || (activeModalNode as any).id)) ||
        (activeModalNode.type === 'destination' && idsToDelete.has(activeModalNode.destinationId || 'destination'))
      ) {
        setActiveModalNode(null);
      }
    }

    setSelectedNodeIds(new Set());
  };

  const handleDeleteMultipleNodes = (idsToDelete: Set<string>) => {
    if (idsToDelete.size === 0) return;
    if (idsToDelete.size === 1) {
      const singleId = Array.from(idsToDelete)[0];
      if (singleId === 'trigger') {
        handleDeleteTrigger();
        return;
      }
      if (singleId === 'get-content') {
        handleDeleteGetContent();
        return;
      }
      if (singleId === 'get-images') {
        handleDeleteGetImages();
        return;
      }
      if (singleId === 'output') {
        handleDeleteOutputNode();
        return;
      }
      if (singleId.startsWith('combine-box') || (config.combineBoxes || []).some((cb) => cb.id === singleId)) {
        handleDeleteCombineBox(singleId);
        return;
      }
      if (singleId.startsWith('dest-') || singleId === 'destination') {
        handleDeleteDestinationNode(singleId);
        return;
      }
      const aiBox = config.aiBoxes.find((b) => b.id === singleId);
      if (aiBox) {
        handleDeleteAIBox(singleId);
        return;
      }
    }

    setDeleteConfirmTarget({
      type: 'node',
      title: `Delete ${idsToDelete.size} selected nodes?`,
      description: `Are you sure you want to delete these ${idsToDelete.size} selected nodes? You can restore content and AI nodes anytime from General Settings.`,
      confirmText: `Delete ${idsToDelete.size} Nodes`,
      onConfirm: () => {
        executeDeleteMultipleNodes(idsToDelete);
        setDeleteConfirmTarget(null);
      },
    });
  };

  // Keyboard shortcut listener for multi-selection deletion (Delete / Backspace / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeElement = document.activeElement;
        const isInput =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute('contenteditable') === 'true' ||
          Boolean(activeElement?.closest('input, textarea, [contenteditable="true"]'));
        if (isInput) return;

        if (selectedNodeIds.size > 0) {
          e.preventDefault();
          handleDeleteMultipleNodes(selectedNodeIds);
        }
      } else if (e.key === 'Escape') {
        if (selectedNodeIds.size > 0) {
          setSelectedNodeIds(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, config, deletedBoxes]);

  // Duplicate Dynamic AI Box
  const handleDuplicateAIBox = (box: DynamicAIBoxConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newId = `ai-box-${Date.now()}`;
    const duplicated: DynamicAIBoxConfig = {
      ...box,
      id: newId,
      title: `${box.title} (Copy)`,
      y: box.y + 60,
      x: box.x + 30,
    };
    const nextBoxes = [...config.aiBoxes, duplicated];
    const nextConns = autoConnectImagePipeline(nextBoxes, config.connections);
    const nextConfig = buildAlignedLayout(nextBoxes, nextConns, {
      ...config,
      aiBoxes: nextBoxes,
      connections: nextConns,
    });
    updateConfig(nextConfig);
    setSelectedBoxId(newId);
  };

  // Toggle Box Enabled
  const handleToggleAIBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newBoxes = config.aiBoxes.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b));
    updateConfig({ ...config, aiBoxes: newBoxes });
  };

  // Update AI Box Details
  const handleUpdateAIBox = (id: string, partial: Partial<DynamicAIBoxConfig>) => {
    const newBoxes = config.aiBoxes.map((b) => (b.id === id ? { ...b, ...partial } : b));
    const hasCombine = (config.combineBoxes || []).some((b) => b && b.enabled !== false);
    const isOutputActive = !hasCombine && config.outputNode?.enabled !== false;
    const nextConns = autoConnectImagePipeline(
      newBoxes,
      config.connections,
      config.getContent.enabled,
      config.getImages.enabled,
      getNormalizedDestinations(config).some((d) => d.enabled !== false),
      isOutputActive,
      getNormalizedDestinations(config),
      config.combineBoxes || []
    );
    const nextConfig = buildAlignedLayout(newBoxes, nextConns, {
      ...config,
      aiBoxes: newBoxes,
      connections: nextConns,
    });
    updateConfig(nextConfig);
  };

  // Reset Layout to compact aligned grid with clean gaps (75% zoom)
  const handleResetLayout = () => {
    const isDestEnabled = getNormalizedDestinations(config).some((d) => d.enabled !== false);
    const hasCombine = (config.combineBoxes || []).some((b) => b && b.enabled !== false);
    const isOutputActive = !hasCombine && config.outputNode?.enabled !== false;
    const nextConns = autoConnectWorkflow(
      config.aiBoxes,
      config.connections,
      config.getContent.enabled,
      config.getImages.enabled,
      isDestEnabled,
      isOutputActive,
      getNormalizedDestinations(config),
      config.combineBoxes || []
    );
    const resetConfig = buildAlignedLayout(config.aiBoxes, nextConns, {
      ...config,
      connections: nextConns,
    });

    const vWidth = (canvasRef.current && canvasRef.current.clientWidth > 0)
      ? canvasRef.current.clientWidth
      : (typeof window !== 'undefined' ? window.innerWidth - 56 : 1200);
    const vHeight = (canvasRef.current && canvasRef.current.clientHeight > 0)
      ? canvasRef.current.clientHeight
      : (typeof window !== 'undefined' ? window.innerHeight - 56 : 800);

    // Dynamic zoom to ensure whole flow is focused and centered with balanced margins
    const contentWidth = 1420;
    const contentHeight = 440;
    const fitZoomX = (vWidth - 140) / contentWidth;
    const fitZoomY = (vHeight - 120) / contentHeight;
    const zoom = Math.min(Math.max(Math.min(fitZoomX, fitZoomY), 0.72), 0.88);

    const panOffset = calculateCenteredPanOffset(resetConfig, vWidth, vHeight, zoom);

    updateConfig({ ...resetConfig, zoom, panOffset });
  };

  useImperativeHandle(
    ref,
    () => ({
      addAIBox: (templateOverride) => handleAddAIBox(templateOverride),
      resetLayout: () => handleResetLayout(),
      openRecoverModal: () => {
        handleToggleGeneralSettings(true);
      },
      openGeneralSettings: () => {
        handleToggleGeneralSettings(true);
      },
      toggleGeneralSettings: () => {
        handleToggleGeneralSettings(!isRecoverModalOpen);
      },
      getDeletedBoxesCount: () => deletedBoxes.length,
    }),
    [config, deletedBoxes, isRecoverModalOpen, onToggleGeneralSettings]
  );

  // Run Test Simulation
  const handleRunSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulationStep(0);
    setSimulationMessage('1. Capturing URL & Initializing Facebook OpenClaw...');

    setTimeout(() => {
      setSimulationStep(1);
      const branches = [];
      if (config.getContent.enabled) branches.push('100% Full Content');
      if (config.getImages.enabled) branches.push('All Photos');
      setSimulationMessage(`2. Extracting Branches: ${branches.join(' + ') || 'None selected'}`);

      setTimeout(() => {
        setSimulationStep(2);
        const activeAI = config.aiBoxes.filter((b) => b.enabled);
        setSimulationMessage(
          `3. Triggering ${activeAI.length} AI Generation Models (${activeAI.map((b) => getAIModelDisplayName(b.provider, b.model)).join(', ')})...`
        );

        setTimeout(() => {
          setSimulationStep(3);
          setSimulationMessage('4. Compiling property card, media assets, and AI output to Property Inbox!');

          setTimeout(() => {
            setIsSimulating(false);
            setSimulationStep(-1);
            setSimulationMessage('✓ Pipeline completed successfully! Ready for live import.');
            setTimeout(() => setSimulationMessage(null), 3500);
          }, 1500);
        }, 1800);
      }, 1500);
    }, 1200);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('.canvas-node') ||
      (e.target as HTMLElement).closest('.canvas-control') ||
      (e.target as HTMLElement).closest('.quick-add-popover')
    ) {
      return;
    }
    setQuickAddPopover(null);
    if (!e.shiftKey) {
      setSelectedNodeIds(new Set());
    }
    if (dragWire) {
      setDragWire(null);
      return;
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX - config.panOffset.x, y: e.clientY - config.panOffset.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (dragWire && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = (e.clientX - rect.left - config.panOffset.x) / config.zoom;
      const cy = (e.clientY - rect.top - config.panOffset.y) / config.zoom;
      setDragWire((prev) => (prev ? { ...prev, currentX: cx, currentY: cy } : null));
      return;
    }

    if (isPanning) {
      const newOffset = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      };
      setConfig((prev) => ({ ...prev, panOffset: newOffset }));
    }

    if (draggedNodeId) {
      if (Math.hypot(e.clientX - dragStartCoord.current.x, e.clientY - dragStartCoord.current.y) > 4) {
        hasMoved.current = true;
      }

      const deltaX = (e.clientX - dragStart.x) / config.zoom;
      const deltaY = (e.clientY - dragStart.y) / config.zoom;

      if (selectedNodeIds.has(draggedNodeId) && selectedNodeIds.size > 1) {
        // Move all selected nodes simultaneously
        setConfig((prev) => {
          let newTrigger = prev.trigger;
          if (selectedNodeIds.has('trigger')) {
            newTrigger = { ...newTrigger, x: newTrigger.x + deltaX, y: newTrigger.y + deltaY };
          }

          let newGetContent = prev.getContent;
          if (selectedNodeIds.has('get-content')) {
            newGetContent = { ...newGetContent, x: newGetContent.x + deltaX, y: newGetContent.y + deltaY };
          }

          let newGetImages = prev.getImages;
          if (selectedNodeIds.has('get-images')) {
            newGetImages = { ...newGetImages, x: newGetImages.x + deltaX, y: newGetImages.y + deltaY };
          }

          let newOutputNode = prev.outputNode;
          if (selectedNodeIds.has('output')) {
            newOutputNode = {
              ...newOutputNode,
              id: 'output',
              enabled: prev.outputNode?.enabled !== false,
              x: (prev.outputNode?.x ?? 620) + deltaX,
              y: (prev.outputNode?.y ?? 248) + deltaY,
            };
          }

          const allDests = getNormalizedDestinations(prev);
          const updatedDests = allDests.map((d) =>
            selectedNodeIds.has(d.id) || (d.id === 'destination' && selectedNodeIds.has('destination'))
              ? { ...d, x: d.x + deltaX, y: d.y + deltaY }
              : d
          );
          const newDestination =
            (selectedNodeIds.has('destination') || selectedNodeIds.has(updatedDests[0]?.id))
              ? { ...prev.destination, x: prev.destination.x + deltaX, y: prev.destination.y + deltaY }
              : prev.destination;

          const newAiBoxes = prev.aiBoxes.map((b) =>
            selectedNodeIds.has(b.id) ? { ...b, x: b.x + deltaX, y: b.y + deltaY } : b
          );

          const newCombineBoxes = (prev.combineBoxes || []).map((b) =>
            selectedNodeIds.has(b.id) ? { ...b, x: b.x + deltaX, y: b.y + deltaY } : b
          );

          return {
            ...prev,
            trigger: newTrigger,
            getContent: newGetContent,
            getImages: newGetImages,
            outputNode: newOutputNode,
            destination: newDestination,
            destinations: updatedDests,
            aiBoxes: newAiBoxes,
            combineBoxes: newCombineBoxes,
          };
        });
      } else {
        if (draggedNodeId === 'trigger') {
          setConfig((prev) => ({
            ...prev,
            trigger: { ...prev.trigger, x: prev.trigger.x + deltaX, y: prev.trigger.y + deltaY },
          }));
        } else if (draggedNodeId === 'get-content') {
          setConfig((prev) => ({
            ...prev,
            getContent: { ...prev.getContent, x: prev.getContent.x + deltaX, y: prev.getContent.y + deltaY },
          }));
        } else if (draggedNodeId === 'get-images') {
          setConfig((prev) => ({
            ...prev,
            getImages: { ...prev.getImages, x: prev.getImages.x + deltaX, y: prev.getImages.y + deltaY },
          }));
        } else if (draggedNodeId === 'output') {
          setConfig((prev) => ({
            ...prev,
            outputNode: {
              ...prev.outputNode,
              id: 'output',
              enabled: prev.outputNode?.enabled !== false,
              x: (prev.outputNode?.x ?? 620) + deltaX,
              y: (prev.outputNode?.y ?? 248) + deltaY,
            },
          }));
        } else if (draggedNodeId === 'destination' || draggedNodeId.startsWith('dest-')) {
          setConfig((prev) => {
            const allDests = getNormalizedDestinations(prev);
            const updatedDests = allDests.map((d) =>
              d.id === draggedNodeId ? { ...d, x: d.x + deltaX, y: d.y + deltaY } : d
            );
            return {
              ...prev,
              destination: (draggedNodeId === 'destination' || draggedNodeId === updatedDests[0]?.id)
                ? { ...prev.destination, x: prev.destination.x + deltaX, y: prev.destination.y + deltaY }
                : prev.destination,
              destinations: updatedDests,
            };
          });
        } else if (draggedNodeId.startsWith('ai-box-')) {
          setConfig((prev) => ({
            ...prev,
            aiBoxes: prev.aiBoxes.map((b) =>
              b.id === draggedNodeId ? { ...b, x: b.x + deltaX, y: b.y + deltaY } : b
            ),
          }));
        } else if (draggedNodeId.startsWith('combine-box') || (config.combineBoxes || []).some((b) => b.id === draggedNodeId)) {
          setConfig((prev) => ({
            ...prev,
            combineBoxes: (prev.combineBoxes || []).map((b) =>
              b.id === draggedNodeId ? { ...b, x: b.x + deltaX, y: b.y + deltaY } : b
            ),
          }));
        }
      }

      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    setHoveredOutputNodeId(null);
    setHoveredInputNodeId(null);
    if (dragWire) {
      setDragWire(null);
    }
    if (isPanning) setIsPanning(false);
    if (draggedNodeId) {
      setDraggedNodeId(null);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
      } catch (e) {}
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    const newZoom = Math.min(Math.max(config.zoom * zoomFactor, 0.45), 1.6);
    setConfig((prev) => ({ ...prev, zoom: Number(newZoom.toFixed(2)) }));
  };

  const startDragNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    } else {
      setSelectedNodeIds((prev) => {
        if (prev.has(nodeId)) {
          return prev;
        }
        return new Set([nodeId]);
      });
    }
    setDraggedNodeId(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
    dragStartCoord.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;
  };

  const handleNodeClick = (node: ActiveModalNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      return;
    }
    if (!hasMoved.current) {
      handleToggleGeneralSettings(false);
      setConnectDrawerNode(null);
      setQuickAddPopover(null);
      setActiveModalNode(node);
    }
  };

  // Bezier curve generator with bounded control points to prevent backwards loops and sharp kinks
  const createBezierPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const rawDx = end.x - start.x;
    const rawDy = end.y - start.y;

    if (rawDx < 0) {
      // Loop outward gracefully if connecting backwards
      const vertOffset = Math.min(Math.max(Math.abs(rawDy) * 0.35, 40), 90);
      const c1x = start.x + 40;
      const c1y = start.y + (rawDy >= 0 ? vertOffset : -vertOffset);
      const c2x = end.x - 40;
      const c2y = end.y - (rawDy >= 0 ? vertOffset : -vertOffset);
      return `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
    }

    // Forward straight line check:
    // If the vertical difference between start and end is minor (<= 14px),
    // drawing a cubic Bézier creates an awkward S-bend sag/kink in what should be a clean horizontal line.
    // Instead, draw a crisp, clean straight line directly between sockets!
    if (Math.abs(rawDy) <= 14) {
      return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }

    // Forward curve: control offset is strictly bounded by rawDx * 0.5 so c1x <= c2x always
    const controlOffset = Math.min(
      Math.max(rawDx * 0.45, 20),
      rawDx * 0.5,
      85
    );
    const c1x = start.x + controlOffset;
    const c1y = start.y;
    const c2x = end.x - controlOffset;
    const c2y = end.y;
    return `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  };

  // Base channel bezier path for wires originating from lower base nodes (like Get Images -> Destination)
  // Ensures the wire stays along the bottom base corridor and never cuts under or through middle cycles!
  const createBaseChannelPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const dx = Math.abs(end.x - start.x);
    // Keep control point 1 extended forward along the base line so it travels horizontally below middle nodes
    const c1x = start.x + dx * 0.68;
    const c1y = start.y;
    // Control point 2 curves up towards destination near the end
    const c2x = end.x - Math.min(dx * 0.22, 120);
    const c2y = start.y + (end.y - start.y) * 0.12;
    return `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  };

  // Circular Node Dimensions (all canvas nodes are uniform 72px circles)
  const CIRCLE_SIZE = 72;
  const HALF_CIRCLE = CIRCLE_SIZE / 2; // 36
  const PRIMARY_NODE_COLOR = isDark ? '#3B82F6' : '#2563EB';

  // Unified Sockets for wires (anchoring at card edge ports or plus button)
  const triggerOut = { x: config.trigger.x + 108.5, y: config.trigger.y + HALF_CIRCLE };

  const contentIn = { x: config.getContent.x + 1, y: config.getContent.y + HALF_CIRCLE };
  const contentOut = { x: config.getContent.x + 71, y: config.getContent.y + HALF_CIRCLE };

  const imagesIn = { x: config.getImages.x + 1, y: config.getImages.y + HALF_CIRCLE };
  const imagesOut = { x: config.getImages.x + 71, y: config.getImages.y + HALF_CIRCLE };

  // Currently active AI Box in modal (if applicable)
  const currentModalAIBox = activeModalNode?.type === 'ai-box'
    ? config.aiBoxes.find((b) => b.id === activeModalNode.boxId)
    : null;

  const isContentOutputConnected = (config.connections || []).some((c) => c.fromNodeId === 'get-content');
  const contentHasReceiver = Boolean(config.getContent.enabled) && config.aiBoxes.some((b) => isValidConnection('get-content', b.id));

  const isImagesOutputConnected = (config.connections || []).some((c) => c.fromNodeId === 'get-images');
  const imagesHasReceiver = Boolean(config.getImages.enabled) && config.aiBoxes.some((b) => isValidConnection('get-images', b.id));

  // Connection currently initiating: forward (dragging/hovering NEXT arrow) or backward (dragging/hovering BACK arrow)
  const activeConnectingNodeId = dragWire?.fromType === 'output' ? dragWire.fromNodeId : hoveredOutputNodeId;
  const activeConnectingTargetId = dragWire?.fromType === 'input' ? dragWire.fromNodeId : hoveredInputNodeId;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        ...(isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 999999,
            }
          : {}),
      }}
    >
      <style>{`
        @keyframes n8nFlow {
          from { stroke-dashoffset: 32; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes socketPulse {
          0%, 100% {
            r: 7.5;
            opacity: 0.55;
          }
          50% {
            r: 10;
            opacity: 1;
          }
        }
      `}</style>

      {/* Interactive Infinite Canvas */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onWheel={handleWheel}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          flex: 1,
          minHeight: 0,
          backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
          backgroundImage: isDark
            ? 'radial-gradient(circle, rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px)'
            : 'radial-gradient(circle, rgba(0, 0, 0, 0.12) 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
          border: 'none',
          borderRadius: 0,
          overflow: 'hidden',
          cursor: isPanning ? 'grabbing' : 'default',
          userSelect: 'none',
          boxShadow: isDark ? 'inset 0 0 40px rgba(0, 0, 0, 0.8)' : 'inset 0 0 20px rgba(0, 0, 0, 0.03)',
        }}
      >




        {/* Floating Zoom Controls Bar */}
        <div
          className="canvas-control"
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            backgroundColor: isDark ? 'rgba(22, 27, 34, 0.85)' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(8px)',
            padding: '4px 6px',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.08)',
          }}
        >
          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, zoom: Math.min(prev.zoom + 0.1, 1.6) }))}
            title="Zoom In"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <FiZoomIn style={{ fontSize: '15px' }} />
          </button>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', minWidth: '38px', textAlign: 'center' }}>
            {Math.round(config.zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, zoom: Math.max(prev.zoom - 0.1, 0.45) }))}
            title="Zoom Out"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <FiZoomOut style={{ fontSize: '15px' }} />
          </button>
          <button
            type="button"
            onClick={handleResetLayout}
            title="Auto-Align Layout (n8n Style)"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <FiGrid style={{ fontSize: '14px' }} />
          </button>
          <button
            type="button"
            onClick={() => {
              const vWidth = (canvasRef.current && canvasRef.current.clientWidth > 0)
                ? canvasRef.current.clientWidth
                : (typeof window !== 'undefined' ? window.innerWidth - 56 : 1200);
              const vHeight = (canvasRef.current && canvasRef.current.clientHeight > 0)
                ? canvasRef.current.clientHeight
                : (typeof window !== 'undefined' ? window.innerHeight - 56 : 800);
              const contentWidth = 1420;
              const contentHeight = 440;
              const fitZoomX = (vWidth - 140) / contentWidth;
              const fitZoomY = (vHeight - 120) / contentHeight;
              const zoom = Math.min(Math.max(Math.min(fitZoomX, fitZoomY), 0.72), 0.88);
              const panOffset = calculateCenteredPanOffset(config, vWidth, vHeight, zoom);
              setConfig((prev) => ({ ...prev, zoom, panOffset }));
            }}
            title="Reset Pan & Zoom"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <FiCrosshair style={{ fontSize: '14px' }} />
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isFullscreen ? <FiMinimize2 style={{ fontSize: '14px' }} /> : <FiMaximize2 style={{ fontSize: '14px' }} />}
          </button>
        </div>

        {/* Transformable Canvas Group: SVGs and Nodes */}
        <div
          style={{
            transform: `translate(${config.panOffset.x}px, ${config.panOffset.y}px) scale(${config.zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* SVG Connection Lines */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '3200px',
              height: '2400px',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            {/* 1. Trigger -> Get Content Line */}
            {Boolean(config.trigger?.enabled === true && config.getContent.enabled) && (() => {
              const path = createBezierPath(triggerOut, contentIn);
              const connId = 'conn-trigger-content';
              const isRunning = Boolean(executionState?.isRunning);
              const isExec = Boolean(executionState?.isRunning || executionState?.isComplete);
              const isWireActive = isExec
                ? Boolean(executionState?.completedNodeIds?.includes('trigger') || executionState?.activeNodeIds?.includes('get-content'))
                : config.getContent.enabled;
              const isCompleted = isExec && Boolean(executionState?.completedNodeIds?.includes('get-content'));
              const isFastFlow = isRunning && Boolean(executionState?.activeNodeIds?.includes('get-content'));
              const isRunningFlow = isRunning && isWireActive;

              const isWireHovered = hoveredWireId === connId;
              const isXHovered = hoveredXId === connId;

              const strokeColor = isXHovered
                ? '#F85149'
                : isCompleted
                ? '#10B981'
                : isRunningFlow
                ? (isDark ? '#60A5FA' : '#2563EB')
                : (isDark ? '#4B5563' : '#8B949E');

              const midX = (triggerOut.x + contentIn.x) / 2;
              const midY = (triggerOut.y + contentIn.y) / 2;

              return (
                <g
                  key="wire-trigger-content"
                  className="workflow-wire-group"
                  onMouseEnter={() => setHoveredWireId(connId)}
                  onMouseLeave={() => {
                    setHoveredWireId(null);
                    setHoveredXId(null);
                  }}
                  style={{ pointerEvents: 'auto', cursor: 'default' }}
                >
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    style={{ cursor: 'default' }}
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isXHovered ? '2.5' : isRunningFlow ? '2.5' : isWireHovered ? '2.2' : '2'}
                    strokeDasharray={isRunningFlow ? '4, 4' : 'none'}
                    strokeLinecap="round"
                    style={{
                      animation: isRunningFlow ? (isFastFlow ? 'n8nFlow 0.8s linear infinite' : 'n8nFlow 1.2s linear infinite') : 'none',
                      transition: 'stroke 0.25s ease',
                    }}
                  />
                  {isWireHovered && (
                    <g
                      className="canvas-control workflow-wire-disconnect-btn"
                      transform={`translate(${midX}, ${midY})`}
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                      onMouseEnter={() => setHoveredXId(connId)}
                      onMouseLeave={() => setHoveredXId(null)}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        if (e) {
                          e.stopPropagation();
                          e.preventDefault();
                        }
                        setDeleteConfirmTarget({
                          type: 'connection',
                          title: 'Disconnect "Get Content"?',
                          description: 'Are you sure you want to disconnect and remove the Get Content step from this workflow?',
                          confirmText: 'Confirm Disconnect',
                          onConfirm: () => {
                            executeDeleteGetContent();
                            setDeleteConfirmTarget(null);
                          },
                        });
                      }}
                    >
                      <circle r="18" fill="rgba(0, 0, 0, 0.001)" pointerEvents="all" />
                      <circle
                        r={isXHovered ? 12 : 10}
                        fill="#F85149"
                        stroke={isDark ? '#161B22' : '#FFFFFF'}
                        strokeWidth="2"
                        pointerEvents="none"
                        style={{
                          transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2))',
                        }}
                      />
                      <line
                        x1={isXHovered ? -4 : -3.5}
                        y1={isXHovered ? -4 : -3.5}
                        x2={isXHovered ? 4 : 3.5}
                        y2={isXHovered ? 4 : 3.5}
                        stroke="#FFFFFF"
                        strokeWidth={isXHovered ? 2.2 : 1.8}
                        strokeLinecap="round"
                        pointerEvents="none"
                        style={{ transition: 'all 0.15s ease' }}
                      />
                      <line
                        x1={isXHovered ? 4 : 3.5}
                        y1={isXHovered ? -4 : -3.5}
                        x2={isXHovered ? -4 : -3.5}
                        y2={isXHovered ? 4 : 3.5}
                        stroke="#FFFFFF"
                        strokeWidth={isXHovered ? 2.2 : 1.8}
                        strokeLinecap="round"
                        pointerEvents="none"
                        style={{ transition: 'all 0.15s ease' }}
                      />
                    </g>
                  )}
                </g>
              );
            })()}

            {/* 2. Trigger -> Get Images Line */}
            {Boolean(config.trigger?.enabled === true && config.getImages.enabled) && (() => {
              const path = createBezierPath(triggerOut, imagesIn);
              const connId = 'conn-trigger-images';
              const isRunning = Boolean(executionState?.isRunning);
              const isExec = Boolean(executionState?.isRunning || executionState?.isComplete);
              const isWireActive = isExec
                ? Boolean(executionState?.completedNodeIds?.includes('trigger') || executionState?.activeNodeIds?.includes('get-images'))
                : config.getImages.enabled;
              const isCompleted = isExec && Boolean(executionState?.completedNodeIds?.includes('get-images'));
              const isFastFlow = isRunning && Boolean(executionState?.activeNodeIds?.includes('get-images'));
              const isRunningFlow = isRunning && isWireActive;

              const isWireHovered = hoveredWireId === connId;
              const isXHovered = hoveredXId === connId;

              const strokeColor = isXHovered
                ? '#F85149'
                : isCompleted
                ? '#10B981'
                : isRunningFlow
                ? (isDark ? '#60A5FA' : '#2563EB')
                : (isDark ? '#4B5563' : '#94A3B8');

              const midX = (triggerOut.x + imagesIn.x) / 2;
              const midY = (triggerOut.y + imagesIn.y) / 2;

              return (
                <g
                  key="wire-trigger-images"
                  className="workflow-wire-group"
                  onMouseEnter={() => setHoveredWireId(connId)}
                  onMouseLeave={() => {
                    setHoveredWireId(null);
                    setHoveredXId(null);
                  }}
                  style={{ pointerEvents: 'auto', cursor: 'default' }}
                >
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    style={{ cursor: 'default' }}
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isXHovered ? '2.5' : isRunningFlow ? '2.5' : isWireHovered ? '2.2' : '2'}
                    strokeDasharray={isRunningFlow ? '4, 4' : 'none'}
                    strokeLinecap="round"
                    style={{
                      animation: isRunningFlow ? (isFastFlow ? 'n8nFlow 0.8s linear infinite' : 'n8nFlow 1.2s linear infinite') : 'none',
                      transition: 'stroke 0.25s ease',
                    }}
                  />
                  {isWireHovered && (
                    <g
                      className="canvas-control workflow-wire-disconnect-btn"
                      transform={`translate(${midX}, ${midY})`}
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                      onMouseEnter={() => setHoveredXId(connId)}
                      onMouseLeave={() => setHoveredXId(null)}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        if (e) {
                          e.stopPropagation();
                          e.preventDefault();
                        }
                        setDeleteConfirmTarget({
                          type: 'connection',
                          title: 'Disconnect "Get Images"?',
                          description: 'Are you sure you want to disconnect and remove the Get Images step from this workflow?',
                          confirmText: 'Confirm Disconnect',
                          onConfirm: () => {
                            executeDeleteGetImages();
                            setDeleteConfirmTarget(null);
                          },
                        });
                      }}
                    >
                      <circle r="18" fill="rgba(0, 0, 0, 0.001)" pointerEvents="all" />
                      <circle
                        r={isXHovered ? 12 : 10}
                        fill="#F85149"
                        stroke={isDark ? '#161B22' : '#FFFFFF'}
                        strokeWidth="2"
                        pointerEvents="none"
                        style={{
                          transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2))',
                        }}
                      />
                      <line
                        x1={isXHovered ? -4 : -3.5}
                        y1={isXHovered ? -4 : -3.5}
                        x2={isXHovered ? 4 : 3.5}
                        y2={isXHovered ? 4 : 3.5}
                        stroke="#FFFFFF"
                        strokeWidth={isXHovered ? 2.2 : 1.8}
                        strokeLinecap="round"
                        pointerEvents="none"
                        style={{ transition: 'all 0.15s ease' }}
                      />
                      <line
                        x1={isXHovered ? 4 : 3.5}
                        y1={isXHovered ? -4 : -3.5}
                        x2={isXHovered ? -4 : -3.5}
                        y2={isXHovered ? 4 : 3.5}
                        stroke="#FFFFFF"
                        strokeWidth={isXHovered ? 2.2 : 1.8}
                        strokeLinecap="round"
                        pointerEvents="none"
                        style={{ transition: 'all 0.15s ease' }}
                      />
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Dynamic AI / Workflow Connections from config.connections */}
            {dedupeConnections(config.connections || []).map((conn) => {
              const fromPos = getNodeSocketPos(conn.fromNodeId, 'output');
              const toPos = getNodeSocketPos(conn.toNodeId, 'input');
              // Safety check: skip any wire with unresolved coordinates to prevent broken loops to (0, 0)
              if (
                !fromPos ||
                !toPos ||
                (fromPos.x === 0 && fromPos.y === 0) ||
                (toPos.x === 0 && toPos.y === 0)
              ) {
                return null;
              }
              const path =
                conn.fromNodeId === 'get-images' && (conn.toNodeId === 'destination' || conn.toNodeId.startsWith('dest-'))
                  ? createBaseChannelPath(fromPos, toPos)
                  : createBezierPath(fromPos, toPos);

              const fromEnabled = isNodeEffectivelyEnabled(conn.fromNodeId);
              const toEnabled = isNodeEffectivelyEnabled(conn.toNodeId);
              const isConnectedAndEnabled = fromEnabled && toEnabled;

              const isRunning = Boolean(executionState?.isRunning);
              const isExec = Boolean(executionState?.isRunning || executionState?.isComplete);
              const fromCompleted = Boolean(executionState?.completedNodeIds?.includes(conn.fromNodeId));
              const toActive = Boolean(executionState?.activeNodeIds?.includes(conn.toNodeId));
              const toCompleted = Boolean(executionState?.completedNodeIds?.includes(conn.toNodeId));

              const isExecActive = isRunning && (fromCompleted || toActive);
              const isExecDone = isExec && toCompleted;
              const isFastFlow = isRunning && toActive;

              const isWireHovered = hoveredWireId === conn.id;
              const isXHovered = hoveredXId === conn.id;

              const wireStrokeColor = isXHovered
                ? '#F85149'
                : isExecDone
                ? '#10B981'
                : isExecActive
                ? (isDark ? '#60A5FA' : '#2563EB')
                : (isDark ? '#4B5563' : '#94A3B8');

              const midX = (fromPos.x + toPos.x) / 2;
              const midY = (fromPos.y + toPos.y) / 2;

              return (
                <g
                  key={conn.id}
                  className="workflow-wire-group"
                  onMouseEnter={() => setHoveredWireId(conn.id)}
                  onMouseLeave={() => {
                    setHoveredWireId(null);
                    setHoveredXId(null);
                  }}
                  style={{ pointerEvents: 'auto', cursor: 'default' }}
                >
                  {/* Invisible thicker hit-path for hovering to reveal the disconnect (x) button */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    style={{ cursor: 'default' }}
                  />
                  {/* Visual straight/flowing wire */}
                  <path
                    d={path}
                    fill="none"
                    stroke={wireStrokeColor}
                    strokeWidth={isXHovered ? '2.5' : isExecActive ? '2.5' : isConnectedAndEnabled ? '2.2' : isWireHovered ? '2.2' : '2'}
                    strokeDasharray={isExecActive ? '4, 4' : 'none'}
                    strokeLinecap="round"
                    style={{
                      animation: isExecActive ? (isFastFlow ? 'n8nFlow 0.8s linear infinite' : 'n8nFlow 1.2s linear infinite') : 'none',
                      transition: 'stroke 0.18s ease, stroke-width 0.18s ease',
                    }}
                  />
                  {/* Disconnect indicator on hover */}
                  {isWireHovered && (
                    <g
                      className="canvas-control workflow-wire-disconnect-btn"
                      transform={`translate(${midX}, ${midY})`}
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                      onMouseEnter={() => setHoveredXId(conn.id)}
                      onMouseLeave={() => setHoveredXId(null)}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        handleWireDelete(conn, e);
                      }}
                    >
                      {/* Generous hit area circle for easy, accurate clicking */}
                      <circle r="18" fill="rgba(0, 0, 0, 0.001)" pointerEvents="all" />
                      <circle
                        r={isXHovered ? 12 : 10}
                        fill="#F85149"
                        stroke={isDark ? "#161B22" : "#FFFFFF"}
                        strokeWidth="2"
                        pointerEvents="none"
                        style={{
                          transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2))',
                        }}
                      />
                      <line
                        x1={isXHovered ? -4 : -3.5}
                        y1={isXHovered ? -4 : -3.5}
                        x2={isXHovered ? 4 : 3.5}
                        y2={isXHovered ? 4 : 3.5}
                        stroke="#FFFFFF"
                        strokeWidth={isXHovered ? 2.2 : 1.8}
                        strokeLinecap="round"
                        pointerEvents="none"
                        style={{ transition: 'all 0.15s ease' }}
                      />
                      <line
                        x1={isXHovered ? 4 : 3.5}
                        y1={isXHovered ? -4 : -3.5}
                        x2={isXHovered ? -4 : -3.5}
                        y2={isXHovered ? 4 : 3.5}
                        stroke="#FFFFFF"
                        strokeWidth={isXHovered ? 2.2 : 1.8}
                        strokeLinecap="round"
                        pointerEvents="none"
                        style={{ transition: 'all 0.15s ease' }}
                      />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Active Live Wire when user is dragging a string */}
            {dragWire && (() => {
              const isFromOutput = dragWire.fromType === 'output';
              const start = isFromOutput
                ? { x: dragWire.startX, y: dragWire.startY }
                : { x: dragWire.currentX, y: dragWire.currentY };
              const end = isFromOutput
                ? { x: dragWire.currentX, y: dragWire.currentY }
                : { x: dragWire.startX, y: dragWire.startY };
              const path =
                dragWire.fromNodeId === 'get-images'
                  ? createBaseChannelPath(start, end)
                  : createBezierPath(start, end);

              const wireColor = PRIMARY_NODE_COLOR;

              return (
                <g style={{ pointerEvents: 'none' }}>
                  <path
                    d={path}
                    fill="none"
                    stroke={wireColor}
                    strokeWidth="2.5"
                    strokeDasharray="8, 8"
                    strokeLinecap="round"
                    style={{
                      animation: 'n8nFlow 1.2s linear infinite',
                    }}
                  />
                  <circle
                    cx={dragWire.currentX}
                    cy={dragWire.currentY}
                    r="6"
                    fill={wireColor}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </g>
              );
            })()}
          </svg>

          <style>{CANVAS_NODE_ACTION_CSS}</style>

          {/* ======================================================== */}
          {/* NODE 1: TRIGGER NODE OR INITIAL PLUS BOX                 */}
          {/* ======================================================== */}
          {(() => {
            const isTriggerEnabled = config.trigger?.enabled === true;

            if (!isTriggerEnabled) {
              return (
                <div
                  className={`canvas-node is-initial-plus-box ${selectedNodeIds.has('trigger') ? 'is-selected' : ''}`}
                  onMouseDown={(e) => startDragNode('trigger', e)}
                  style={{
                    position: 'absolute',
                    left: `${config.trigger?.x || 100}px`,
                    top: `${config.trigger?.y || 200}px`,
                    width: `${CIRCLE_SIZE}px`,
                    height: `${CIRCLE_SIZE}px`,
                    zIndex: 15,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hasMoved.current) {
                      const updated = {
                        ...config,
                        trigger: { ...config.trigger, enabled: true },
                      };
                      updateConfig(updated);
                      handleOpenConnectDrawer('trigger', 'trigger', 'Facebook URL Importer');
                    }
                  }}
                >
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '20px',
                      border: isDark ? '2px dashed rgba(59, 130, 246, 0.6)' : '2px dashed #3B82F6',
                      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3B82F6',
                      transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.06)';
                      e.currentTarget.style.borderColor = '#2563EB';
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(59, 130, 246, 0.12)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.borderColor = isDark ? 'rgba(59, 130, 246, 0.6)' : '#3B82F6';
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.15)';
                    }}
                  >
                    <FiPlus size={28} strokeWidth={2.5} />
                  </div>

                  {/* Label below plus box */}
                  <div
                    style={{
                      position: 'absolute',
                      top: `${CIRCLE_SIZE + 8}px`,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      pointerEvents: 'none',
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Add Trigger
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Click to start
                    </span>
                  </div>
                </div>
              );
            }

            const triggerStatus = getNodeExecutionStatus('trigger');
            return (
              <div
                className={`canvas-node is-trigger ${selectedNodeIds.has('trigger') ? 'is-selected' : ''} ${hoveredNodeId === 'trigger' ? 'is-hovered' : ''} ${triggerStatus === 'running' ? 'is-running' : ''} ${triggerStatus === 'success' ? 'is-completed' : ''}`}
                onMouseEnter={() => handleNodeMouseEnter('trigger')}
                onMouseLeave={() => handleNodeMouseLeave('trigger')}
                onMouseDown={(e) => startDragNode('trigger', e)}
                onClick={(e) => handleNodeClick({ type: 'trigger' }, e)}
                style={{
                  position: 'absolute',
                  left: `${config.trigger.x}px`,
                  top: `${config.trigger.y}px`,
                  width: `${CIRCLE_SIZE}px`,
                  height: `${CIRCLE_SIZE}px`,
                  zIndex: 15,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MergedNodeShape
                  sockets="right"
                  isTrigger={true}
                  strokeColor={
                    triggerStatus === 'running'
                      ? '#0284C7'
                      : triggerStatus === 'success'
                      ? '#10B981'
                      : activeModalNode?.type === 'trigger'
                      ? PRIMARY_NODE_COLOR
                      : (isDark ? '#30363D' : '#D0D7DE')
                  }
                  socketDotColor={
                    triggerStatus === 'running'
                      ? '#0284C7'
                      : triggerStatus === 'success'
                      ? '#10B981'
                      : activeModalNode?.type === 'trigger'
                      ? PRIMARY_NODE_COLOR
                      : (isDark ? '#8B949E' : '#64748B')
                  }
                  isConnectedOutput={Boolean(config.getContent.enabled || config.getImages.enabled)}
                  highlightOutput={false}
                  hasReceiver={false}
                  showAddButton={true}
                  onAddClick={(e) => {
                    e.stopPropagation();
                    setDragWire(null);
                    handleOpenConnectDrawer('trigger', 'trigger', config.trigger.monitoredPageName || 'Extract Link');
                  }}
                  onSocketMouseDown={(type, e) => handleSocketMouseDown('trigger', type, e)}
                  onSocketMouseUp={(type, e) => handleSocketMouseUp('trigger', type, e)}
                />
                <FiLink style={{ fontSize: '28px', color: '#1877F2', position: 'relative', zIndex: 2, pointerEvents: 'none' }} />
                <NodeExecutionBadge status={triggerStatus} />

                {/* Label below circle */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${CIRCLE_SIZE + 8}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {config.trigger.monitoredPageName || 'Extract Link'}
                  </span>
                  {triggerStatus === 'running' && (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        color: isDark ? '#38BDF8' : '#0284C7',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: isDark ? '#38BDF8' : '#0284C7',
                        }}
                      />
                      <span>Ingesting Link...</span>
                    </span>
                  )}
                  {triggerStatus === 'success' && (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: '#10B981',
                        fontWeight: 600,
                      }}
                    >
                      ✓ Link Located
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ======================================================== */}
          {/* NODE 2A: GET CONTENT BRANCH (CIRCLE)                     */}
          {/* ======================================================== */}
          {Boolean(config.getContent.enabled) && (() => {
            const isContentReceptive = Boolean(
              activeConnectingTargetId && isValidConnection('get-content', activeConnectingTargetId)
            );
            const contentStatus = getNodeExecutionStatus('get-content');

            return (
              <div
                className={`canvas-node ${selectedNodeIds.has('get-content') ? 'is-selected' : ''} ${hoveredNodeId === 'get-content' ? 'is-hovered' : ''} ${isContentReceptive ? 'is-receptive' : ''} ${contentStatus === 'running' ? 'is-running' : ''} ${contentStatus === 'success' ? 'is-completed' : ''}`}
                onMouseEnter={() => handleNodeMouseEnter('get-content')}
                onMouseLeave={() => handleNodeMouseLeave('get-content')}
                onMouseDown={(e) => startDragNode('get-content', e)}
                onMouseUp={(e) => {
                  if (dragWire && dragWire.fromType === 'input' && isValidConnection('get-content', dragWire.fromNodeId)) {
                    handleSocketMouseUp('get-content', 'output', e);
                  }
                }}
                onClick={(e) => handleNodeClick({ type: 'get-content' }, e)}
                style={{
                  position: 'absolute',
                  left: `${config.getContent.x}px`,
                  top: `${config.getContent.y}px`,
                  width: `${CIRCLE_SIZE}px`,
                  height: `${CIRCLE_SIZE}px`,
                  ['--ring' as any]: isContentReceptive ? RECEPTIVE_COLOR : contentStatus === 'running' ? '#0284C7' : '#388BFD',
                  ['--receptive-color' as any]: RECEPTIVE_COLOR,
                  opacity: config.getContent.enabled ? 1 : 0.6,
                  zIndex: isContentReceptive ? 35 : hoveredNodeId === 'get-content' ? 25 : 15,
                  cursor: isContentReceptive ? 'crosshair' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.2s ease',
                }}
              >
                <MergedNodeShape
                  sockets="both"
                  strokeColor={
                    contentStatus === 'running'
                      ? '#0284C7'
                      : contentStatus === 'success'
                      ? '#10B981'
                      : activeModalNode?.type === 'get-content'
                      ? PRIMARY_NODE_COLOR
                      : isContentReceptive
                      ? RECEPTIVE_COLOR
                      : (isDark ? '#30363D' : '#D0D7DE')
                  }
                  socketDotColor={
                    contentStatus === 'running'
                      ? '#0284C7'
                      : contentStatus === 'success'
                      ? '#10B981'
                      : activeModalNode?.type === 'get-content'
                      ? PRIMARY_NODE_COLOR
                      : isContentReceptive
                      ? RECEPTIVE_COLOR
                      : (isDark ? '#8B949E' : '#64748B')
                  }
                  isConnectedInput={true}
                  isConnectedOutput={isContentOutputConnected}
                  highlightInput={false}
                  highlightOutput={isContentReceptive}
                  hasReceiver={contentHasReceiver}
                  hasSource={false}
                  showAddButton={Boolean(config.getContent.enabled)}
                  onAddClick={(e) => {
                    e.stopPropagation();
                    setDragWire(null);
                    handleOpenConnectDrawer('get-content', 'get-content', 'Get Content');
                  }}
                  onSocketMouseDown={(type, e) => handleSocketMouseDown('get-content', type, e)}
                  onSocketMouseUp={(type, e) => handleSocketMouseUp('get-content', type, e)}
                  onSocketMouseEnter={(type) => {
                    if (type === 'output' && contentHasReceiver) {
                      setHoveredOutputNodeId('get-content');
                    }
                  }}
                  onSocketMouseLeave={(type) => {
                    if (type === 'output') {
                      setHoveredOutputNodeId((curr) => (curr === 'get-content' ? null : curr));
                    }
                  }}
                />
                <FiFileText
                  style={{
                    fontSize: '30px',
                    color: contentStatus === 'success' ? '#10B981' : config.getContent.enabled ? '#0284C7' : '#8B949E',
                    position: 'relative',
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                />
                <NodeExecutionBadge status={contentStatus} />

                {/* Label below circle */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${CIRCLE_SIZE + 8}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    pointerEvents: 'auto',
                    zIndex: 2,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Get Content
                  </span>
                  {contentStatus === 'running' ? (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        color: isDark ? '#38BDF8' : '#0284C7',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: isDark ? '#38BDF8' : '#0284C7',
                        }}
                      />
                      <span>Extracting Text...</span>
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color:
                          contentStatus === 'success'
                            ? '#10B981'
                            : isContentReceptive
                            ? RECEPTIVE_COLOR
                            : 'var(--text-muted)',
                        fontWeight: contentStatus === 'success' || isContentReceptive ? 600 : 400,
                      }}
                    >
                      {contentStatus === 'success'
                        ? (rawContent ? `✓ ${rawContent.length} chars` : '✓ Caption Extracted')
                        : isContentReceptive
                        ? 'Connect Back Here'
                        : config.getContent.enabled
                        ? 'Full Content'
                        : 'Disabled'}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ======================================================== */}
          {/* NODE 2B: GET IMAGES BRANCH (CIRCLE)                      */}
          {/* ======================================================== */}
          {Boolean(config.getImages.enabled) && (() => {
            const isImagesReceptive = Boolean(
              activeConnectingTargetId && isValidConnection('get-images', activeConnectingTargetId)
            );
            const imagesStatus = getNodeExecutionStatus('get-images');

            return (
              <div
                className={`canvas-node ${selectedNodeIds.has('get-images') ? 'is-selected' : ''} ${hoveredNodeId === 'get-images' ? 'is-hovered' : ''} ${isImagesReceptive ? 'is-receptive' : ''} ${imagesStatus === 'running' ? 'is-running' : ''} ${imagesStatus === 'success' ? 'is-completed' : ''}`}
                onMouseEnter={() => handleNodeMouseEnter('get-images')}
                onMouseLeave={() => handleNodeMouseLeave('get-images')}
                onMouseDown={(e) => startDragNode('get-images', e)}
                onMouseUp={(e) => {
                  if (dragWire && dragWire.fromType === 'input' && isValidConnection('get-images', dragWire.fromNodeId)) {
                    handleSocketMouseUp('get-images', 'output', e);
                  }
                }}
                onClick={(e) => handleNodeClick({ type: 'get-images' }, e)}
                style={{
                  position: 'absolute',
                  left: `${config.getImages.x}px`,
                  top: `${config.getImages.y}px`,
                  width: `${CIRCLE_SIZE}px`,
                  height: `${CIRCLE_SIZE}px`,
                  ['--ring' as any]: isImagesReceptive ? RECEPTIVE_COLOR : imagesStatus === 'running' ? '#10B981' : '#2EA043',
                  ['--receptive-color' as any]: RECEPTIVE_COLOR,
                  opacity: config.getImages.enabled ? 1 : 0.6,
                  zIndex: isImagesReceptive ? 35 : hoveredNodeId === 'get-images' ? 25 : 15,
                  cursor: isImagesReceptive ? 'crosshair' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.2s ease',
                }}
              >
                <MergedNodeShape
                  sockets="both"
                  strokeColor={
                    imagesStatus === 'running'
                      ? '#0284C7'
                      : imagesStatus === 'success'
                      ? '#10B981'
                      : activeModalNode?.type === 'get-images'
                      ? PRIMARY_NODE_COLOR
                      : isImagesReceptive
                      ? RECEPTIVE_COLOR
                      : (isDark ? '#30363D' : '#D0D7DE')
                  }
                  socketDotColor={
                    imagesStatus === 'running'
                      ? '#0284C7'
                      : imagesStatus === 'success'
                      ? '#10B981'
                      : activeModalNode?.type === 'get-images'
                      ? PRIMARY_NODE_COLOR
                      : isImagesReceptive
                      ? RECEPTIVE_COLOR
                      : (isDark ? '#8B949E' : '#64748B')
                  }
                  isConnectedInput={true}
                  isConnectedOutput={isImagesOutputConnected}
                  highlightInput={false}
                  highlightOutput={isImagesReceptive}
                  hasReceiver={imagesHasReceiver}
                  hasSource={false}
                  showAddButton={Boolean(config.getImages.enabled)}
                  onAddClick={(e) => {
                    e.stopPropagation();
                    setDragWire(null);
                    handleOpenConnectDrawer('get-images', 'get-images', 'Get Images');
                  }}
                  onSocketMouseDown={(type, e) => handleSocketMouseDown('get-images', type, e)}
                  onSocketMouseUp={(type, e) => handleSocketMouseUp('get-images', type, e)}
                  onSocketMouseEnter={(type) => {
                    if (type === 'output' && imagesHasReceiver) {
                      setHoveredOutputNodeId('get-images');
                    }
                  }}
                  onSocketMouseLeave={(type) => {
                    if (type === 'output') {
                      setHoveredOutputNodeId((curr) => (curr === 'get-images' ? null : curr));
                    }
                  }}
                />
                <FiImage
                  style={{
                    fontSize: '30px',
                    color: imagesStatus === 'success' ? '#10B981' : config.getImages.enabled ? '#10B981' : '#8B949E',
                    position: 'relative',
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                />
                <NodeExecutionBadge status={imagesStatus} />

            {/* Label below circle */}
            <div
              style={{
                position: 'absolute',
                top: `${CIRCLE_SIZE + 8}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                pointerEvents: 'auto',
                zIndex: 2,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Get Images
              </span>
              {imagesStatus === 'running' ? (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: isDark ? '#38BDF8' : '#0284C7',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: isDark ? '#38BDF8' : '#0284C7',
                    }}
                  />
                  <span>Downloading Photos...</span>
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color:
                      imagesStatus === 'success'
                        ? '#10B981'
                        : isImagesReceptive
                        ? RECEPTIVE_COLOR
                        : 'var(--text-muted)',
                    fontWeight: imagesStatus === 'success' || isImagesReceptive ? 600 : 400,
                  }}
                >
                  {imagesStatus === 'success'
                    ? '✓ Photos Ready'
                    : isImagesReceptive
                    ? 'Connect Back Here'
                    : config.getImages.enabled
                    ? 'All Media'
                    : 'Disabled'}
                </span>
              )}
            </div>
          </div>
        );
      })()}

          {/* ======================================================== */}
          {/* NODE 3: DYNAMIC MULTI-BOX AI PROCESSORS (CIRCLES)        */}
          {/* ======================================================== */}
          {config.aiBoxes.map((box) => {
            const isEffectiveEnabled = isNodeEffectivelyEnabled(box.id);
            const isSelected = selectedBoxId === box.id;
            const isWatermark = isWatermarkAIBox(box);
            const isImageNode = isImageAIBox(box, config.connections) || isWatermark;
            const isGoogle = !isImageNode && (box.provider === 'google_ai' || isImageModel(box.model, box.provider) || (!box.provider && !box.model?.startsWith('runware:')));
            const isLaoZhang = !isImageNode && box.provider === 'laozhang_ai';
            const isRunware = isImageNode && !isWatermark;
            const themeColor = PRIMARY_NODE_COLOR;
            const isBoxReceptive = Boolean(
              (activeConnectingNodeId && isValidConnection(activeConnectingNodeId, box.id)) ||
              (activeConnectingTargetId && isValidConnection(box.id, activeConnectingTargetId))
            );
            const boxStatus = getNodeExecutionStatus(box.id);
            const strokeColor =
              boxStatus === 'running'
                ? '#0284C7'
                : boxStatus === 'success'
                ? '#10B981'
                : isSelected
                ? PRIMARY_NODE_COLOR
                : isBoxReceptive
                ? RECEPTIVE_COLOR
                : (isDark ? '#30363D' : '#D0D7DE');
            const strokeDasharray = !isSelected && !isEffectiveEnabled && boxStatus === 'idle' ? '4, 4' : 'none';
            const isEnhance = (isEnhanceAIBox(box) || isImageAIBox(box, config.connections)) && !isWatermark;
            const isBoxInputConnected = (config.connections || []).some((c) => c.toNodeId === box.id);
            const isBoxOutputConnected = (config.connections || []).some((c) => c.fromNodeId === box.id);
            const boxHasReceiver = isEffectiveEnabled && isEnhance;
            const boxCanConnectBack = !isBoxInputConnected && (isValidConnection('get-content', box.id) || isValidConnection('get-images', box.id));
            const boxHasSource = isEffectiveEnabled && boxCanConnectBack;

            return (
              <div
                key={box.id}
                className={`canvas-node ${selectedNodeIds.has(box.id) ? 'is-selected' : ''} ${hoveredNodeId === box.id ? 'is-hovered' : ''} ${isBoxReceptive ? 'is-receptive' : ''} ${boxStatus === 'running' ? 'is-running' : ''} ${boxStatus === 'success' ? 'is-completed' : ''}`}
                onMouseEnter={() => handleNodeMouseEnter(box.id)}
                onMouseLeave={() => handleNodeMouseLeave(box.id)}
                onMouseDown={(e) => startDragNode(box.id, e)}
                onMouseUp={(e) => {
                  if (dragWire && dragWire.fromType === 'output' && isValidConnection(dragWire.fromNodeId, box.id)) {
                    handleSocketMouseUp(box.id, 'input', e);
                  } else if (dragWire && dragWire.fromType === 'input' && isValidConnection(box.id, dragWire.fromNodeId)) {
                    handleSocketMouseUp(box.id, 'output', e);
                  }
                }}
                onClick={(e) => handleNodeClick({ type: 'ai-box', boxId: box.id }, e)}
                style={{
                  position: 'absolute',
                  left: `${box.x}px`,
                  top: `${box.y}px`,
                  width: `${CIRCLE_SIZE}px`,
                  height: `${CIRCLE_SIZE}px`,
                  ['--ring' as any]: isBoxReceptive ? RECEPTIVE_COLOR : boxStatus === 'running' ? '#0284C7' : (isDark ? '#30363D' : '#D0D7DE'),
                  ['--receptive-color' as any]: RECEPTIVE_COLOR,
                  opacity: isEffectiveEnabled ? 1 : 0.6,
                  zIndex: isSelected ? 30 : isBoxReceptive ? 35 : hoveredNodeId === box.id ? 25 : 15,
                  cursor: isBoxReceptive ? 'crosshair' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.2s ease',
                }}
              >
                <MergedNodeShape
                  sockets="both"
                  strokeColor={strokeColor}
                  strokeDasharray={strokeDasharray}
                  socketDotColor={isBoxReceptive ? RECEPTIVE_COLOR : (isDark ? '#8B949E' : '#64748B')}
                  isConnectedInput={isBoxInputConnected}
                  isConnectedOutput={isBoxOutputConnected}
                  highlightInput={isBoxReceptive}
                  highlightOutput={dragWire?.fromType === 'input' && isValidConnection(box.id, dragWire.fromNodeId)}
                  hasReceiver={boxHasReceiver}
                  hasSource={boxHasSource}
                  showAddButton={Boolean(isEffectiveEnabled)}
                  onAddClick={(e) => {
                    e.stopPropagation();
                    setDragWire(null);
                    setDragWire(null);
                    handleOpenConnectDrawer(box.id, 'ai-box', box.title || 'AI Processor');
                  }}
                  onSocketMouseDown={(type, e) => handleSocketMouseDown(box.id, type, e)}
                  onSocketMouseUp={(type, e) => handleSocketMouseUp(box.id, type, e)}
                  onSocketMouseEnter={(type) => {
                    if (type === 'output' && boxHasReceiver) {
                      setHoveredOutputNodeId(box.id);
                    } else if (type === 'input' && boxHasSource) {
                      setHoveredInputNodeId(box.id);
                    }
                  }}
                  onSocketMouseLeave={(type) => {
                    if (type === 'output') {
                      setHoveredOutputNodeId((curr) => (curr === box.id ? null : curr));
                    } else if (type === 'input') {
                      setHoveredInputNodeId((curr) => (curr === box.id ? null : curr));
                    }
                  }}
                />

                {/* Center Icon - preserves natural brand colors like in n8n (Image 2) */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  {isWatermark ? (
                    <FiScissors style={{ fontSize: '28px', color: boxStatus === 'success' ? '#10B981' : isEffectiveEnabled ? '#8B5CF6' : '#8B949E', transition: 'color 0.2s ease' }} />
                  ) : isRunware ? (
                    <RunwareIcon size={28} color={boxStatus === 'success' ? '#10B981' : isEffectiveEnabled ? '#10B981' : '#8B949E'} />
                  ) : isTextFormatAIBox(box) ? (
                    <FiFileText style={{ fontSize: '28px', color: boxStatus === 'success' ? '#10B981' : isEffectiveEnabled ? '#6366F1' : '#8B949E', transition: 'color 0.2s ease' }} />
                  ) : isLaoZhang ? (
                    <LaoZhangIcon size={30} color={boxStatus === 'success' ? '#10B981' : isEffectiveEnabled ? '#2563EB' : '#8B949E'} />
                  ) : isGoogle ? (
                    <SiGooglegemini style={{ fontSize: '30px', color: boxStatus === 'success' ? '#10B981' : isEffectiveEnabled ? '#4285F4' : '#8B949E', transition: 'color 0.2s ease' }} />
                  ) : (
                    <OpenAIIcon size={30} color={boxStatus === 'success' ? '#10B981' : isEffectiveEnabled ? '#10A37F' : '#8B949E'} />
                  )}
                </div>
                <NodeExecutionBadge status={boxStatus} />

                {/* Label below circle */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${CIRCLE_SIZE + 8}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    pointerEvents: 'auto',
                    zIndex: 2,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {editingCanvasBoxId === box.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingCanvasBoxTitle}
                      onChange={(e) => setEditingCanvasBoxTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editingCanvasBoxTitle.trim()) {
                            handleUpdateAIBox(box.id, { title: editingCanvasBoxTitle.trim() });
                          }
                          setEditingCanvasBoxId(null);
                        } else if (e.key === 'Escape') {
                          setEditingCanvasBoxId(null);
                        }
                      }}
                      onBlur={() => {
                        if (editingCanvasBoxTitle.trim()) {
                          handleUpdateAIBox(box.id, { title: editingCanvasBoxTitle.trim() });
                        }
                        setEditingCanvasBoxId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                        border: '1px solid #3B82F6',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        outline: 'none',
                        textAlign: 'center',
                        width: '120px',
                        maxWidth: '120px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        transition: 'color 0.2s ease',
                        maxWidth: '130px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        textAlign: 'center',
                        lineHeight: '1.25',
                        wordBreak: 'break-word',
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCanvasBoxId(box.id);
                        setEditingCanvasBoxTitle(box.title);
                      }}
                    >
                      {box.title}
                    </span>
                  )}
                  {boxStatus === 'running' ? (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        color: isDark ? (isWatermark ? '#FBBF24' : '#C084FC') : (isWatermark ? '#D97706' : '#7C3AED'),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: isDark ? (isWatermark ? '#FBBF24' : '#C084FC') : (isWatermark ? '#D97706' : '#7C3AED'),
                        }}
                      />
                      <span>{isWatermark ? 'Processing...' : isRunware ? 'Enhancing...' : isTextFormatAIBox(box) ? 'Formatting...' : 'Generating...'}</span>
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: isDark ? '#8B949E' : '#64748B',
                        textAlign: 'center',
                        lineHeight: '1.2',
                      }}
                    >
                      {isWatermark ? (box.subtitle || 'Crop & Watermark') : (isRunware || isEnhance) ? 'Image Enhancer' : isTextFormatAIBox(box) ? 'Format Preset' : isTextAIBox(box, config.connections) ? 'AI Model' : 'Copywriter'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* DESTINATION / OUTPUT NODES (Supports Multiple Independent Nodes: Database, Social Media, or Hybrid) */}
          {/* COMBINE BOX NODES */}
          {(config.combineBoxes || []).filter((cb) => cb.enabled !== false).map((cb) => {
            const cbIsSelected = activeModalNode?.type === 'combine' && (activeModalNode.combineId === cb.id || (activeModalNode as any).id === cb.id);
            const cbConnsIn = dedupeConnections(config.connections || []).filter((c) => c.toNodeId === cb.id);
            const cbConnsOut = dedupeConnections(config.connections || []).filter((c) => c.fromNodeId === cb.id);
            const uniqueCbInputs = Array.from(new Set(cbConnsIn.map((c) => c.fromNodeId)));
            const isCbReceptive = Boolean(
              dragWire && dragWire.fromType === 'output' && isValidConnection(dragWire.fromNodeId, cb.id)
            );
            return (
              <div
                key={`node-combine-${cb.id}`}
                className={`canvas-node ${selectedNodeIds.has(cb.id) ? 'is-selected' : ''} ${hoveredNodeId === cb.id ? 'is-hovered' : ''} ${isCbReceptive ? 'is-receptive' : ''}`}
                onMouseEnter={() => handleNodeMouseEnter(cb.id)}
                onMouseLeave={() => handleNodeMouseLeave(cb.id)}
                onMouseDown={(e) => startDragNode(cb.id, e)}
                onMouseUp={(e) => {
                  if (dragWire && dragWire.fromType === 'output' && isValidConnection(dragWire.fromNodeId, cb.id)) {
                    handleSocketMouseUp(cb.id, 'input', e);
                  } else if (dragWire && dragWire.fromType === 'input' && isValidConnection(cb.id, dragWire.fromNodeId)) {
                    handleSocketMouseUp(cb.id, 'output', e);
                  }
                }}
                onClick={(e) => handleNodeClick({ type: 'combine', combineId: cb.id, id: cb.id }, e)}
                style={{
                  position: 'absolute',
                  left: `${cb.x}px`,
                  top: `${cb.y}px`,
                  width: `${CIRCLE_SIZE}px`,
                  height: `${CIRCLE_SIZE}px`,
                  ['--ring' as any]: isCbReceptive ? RECEPTIVE_COLOR : cbIsSelected ? '#F59E0B' : isDark ? '#30363D' : '#D0D7DE',
                  ['--receptive-color' as any]: RECEPTIVE_COLOR,
                  zIndex: cbIsSelected ? 30 : isCbReceptive ? 35 : hoveredNodeId === cb.id ? 25 : 15,
                  cursor: isCbReceptive ? 'crosshair' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.2s ease',
                }}
              >
                <MergedNodeShape
                  sockets="both"
                  strokeColor={cbIsSelected ? '#F59E0B' : isDark ? '#30363D' : '#D0D7DE'}
                  socketDotColor={isCbReceptive ? RECEPTIVE_COLOR : isDark ? '#8B949E' : '#64748B'}
                  isConnectedInput={cbConnsIn.length > 0}
                  isConnectedOutput={cbConnsOut.length > 0}
                  highlightInput={isCbReceptive}
                  highlightOutput={dragWire?.fromType === 'input' && isValidConnection(cb.id, dragWire.fromNodeId)}
                  hasReceiver={true}
                  hasSource={true}
                  onSocketMouseDown={(type, e) => handleSocketMouseDown(cb.id, type, e)}
                  onSocketMouseUp={(type, e) => handleSocketMouseUp(cb.id, type, e)}
                  onSocketMouseEnter={(type) => {
                    if (type === 'input') setHoveredInputNodeId(cb.id);
                    if (type === 'output') setHoveredOutputNodeId(cb.id);
                  }}
                  onSocketMouseLeave={(type) => {
                    if (type === 'input') setHoveredInputNodeId(null);
                    if (type === 'output') setHoveredOutputNodeId(null);
                  }}
                  showAddButton={true}
                  onAddClick={(e) => {
                    e.stopPropagation();
                    setDragWire(null);
                    handleOpenConnectDrawer(cb.id, 'combine', cb.title || 'Combine Box');
                  }}
                />
                {/* Center icon */}
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none' }}>
                  <FiGitMerge style={{ fontSize: '30px', color: '#F59E0B', filter: 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.4))' }} />
                </div>
                {/* Label */}
                <div style={{ position: 'absolute', top: `${CIRCLE_SIZE + 8}px`, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{cb.title || 'Combine Box'}</span>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Merged Output · {uniqueCbInputs.length} input{uniqueCbInputs.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })}

          {getNormalizedDestinations(config).map((destNode, destIdx) => {
            if (destNode.enabled === false) return null;
            const destId = destNode.id || 'destination';
            const destX = destNode.x ?? 740;
            const destY = destNode.y ?? (248 + destIdx * 140);
            const isSelected =
              activeModalNode?.type === 'destination' &&
              (activeModalNode.destinationId ? activeModalNode.destinationId === destId : destIdx === 0);
            const isDestReceptive = Boolean(
              dragWire && dragWire.fromType === 'output' && isValidConnection(dragWire.fromNodeId, destId)
            );
            const isDestRunning = Boolean(
              executionState?.isRunning &&
                (executionState?.activeNodeIds?.includes(destId) ||
                  executionState?.activeNodeIds?.includes('destination'))
            );
            const isDestSuccess = Boolean(
              executionState?.isComplete ||
                executionState?.completedNodeIds?.includes(destId) ||
                executionState?.completedNodeIds?.includes('destination')
            );
            const isDbNode = destNode.targetMode === 'remaining_posts' || destNode.platform === 'database';
            const isHybrid = (destNode.storeInDatabase && destNode.postToSocialMedia) || destNode.targetMode === 'hybrid';
            const platform = destNode.platform || (isDbNode ? 'database' : (destNode.selectedPageId ? 'facebook' : undefined));
            const isFb = platform === 'facebook' && !isHybrid && !isDbNode;
            const isIg = platform === 'instagram' && !isHybrid && !isDbNode;
            const isTiktok = platform === 'tiktok' && !isHybrid && !isDbNode;
            const isPostSocial = !isDbNode;

            const isAccountNode = Boolean(destNode.accountId);
            const isPlatformHub = !isAccountNode && (destNode.targetMode === 'social_media' || Boolean(destNode.platform) || destId.includes('platform'));

            const targetPage = isAccountNode
              ? (managedPages.find((p) => p.page_id === (destNode.accountId || destNode.selectedPageId || destNode.selectedPageIds?.[0])) ||
                 (destNode.accountName ? { page_id: destNode.accountId || '', name: destNode.accountName, picture_url: destNode.accountAvatar, slot: 1 } : undefined))
              : undefined;

            const targetTitle =
              destNode.accountName ||
              (isPlatformHub
                ? (isFb ? 'Facebook' : isIg ? 'Instagram' : isTiktok ? 'TikTok' : destNode.title || 'Social Media')
                : destNode.title ||
                  (isFb ? targetPage?.name || 'Facebook Page' : isIg ? 'Instagram' : isTiktok ? 'TikTok' : isDbNode ? 'Remaining Posts' : 'Social Media'));

            const targetSubtitle =
              isPlatformHub
                ? (isFb ? 'Pages Hub' : isIg ? 'Accounts Hub' : isTiktok ? 'Accounts Hub' : 'Platform')
                : destNode.accountUsername
                ? (destNode.accountUsername.startsWith('@') ? destNode.accountUsername : `@${destNode.accountUsername}`)
                : isFb
                ? targetPage?.name ? `Page · Slot ${targetPage.slot || 1}` : 'Facebook Page'
                : isIg
                ? 'Feed & Reels'
                : isTiktok
                ? 'Video & Slides'
                : isDbNode
                ? 'Database Queue'
                : 'Active';

            const strokeThemeColor =
              isDestSuccess
                ? '#10B981'
                : isDestRunning
                ? '#0284C7'
                : isSelected
                ? isFb
                  ? '#1877F2'
                  : isIg
                  ? '#E1306C'
                  : isTiktok
                  ? '#06B6D4'
                  : isDbNode
                  ? '#0EA5E9'
                  : '#8B5CF6'
                : isDark
                ? '#30363D'
                : '#D0D7DE';

            const isEffectiveEnabled = isNodeEffectivelyEnabled(destId);

            return (
              <div
                key={`node-dest-${destId}`}
                className={`canvas-node ${isAccountNode ? 'is-circle' : ''} ${hoveredNodeId === destId ? 'is-hovered' : ''} ${
                  isDestReceptive ? 'is-receptive' : ''
                } ${isDestRunning ? 'is-running' : ''} ${isDestSuccess ? 'is-completed' : ''}`}
                onMouseEnter={() => handleNodeMouseEnter(destId)}
                onMouseLeave={() => handleNodeMouseLeave(destId)}
                onMouseDown={(e) => startDragNode(destId, e)}
                onMouseUp={(e) => {
                  if (dragWire && dragWire.fromType === 'output' && isValidConnection(dragWire.fromNodeId, destId)) {
                    handleSocketMouseUp(destId, 'input', e);
                  }
                }}
                onClick={(e) => handleNodeClick({ type: 'destination', destinationId: destId }, e)}
                style={{
                  position: 'absolute',
                  left: `${destX}px`,
                  top: `${destY}px`,
                  width: `${CIRCLE_SIZE}px`,
                  height: `${CIRCLE_SIZE}px`,
                  borderRadius: isAccountNode ? '50%' : '18px',
                  ['--ring' as any]: isDestReceptive
                    ? RECEPTIVE_COLOR
                    : isDestRunning
                    ? '#0284C7'
                    : isDark
                    ? '#30363D'
                    : '#D0D7DE',
                  ['--receptive-color' as any]: RECEPTIVE_COLOR,
                  opacity: isEffectiveEnabled ? 1 : 0.6,
                  zIndex: isSelected ? 30 : isDestReceptive ? 35 : hoveredNodeId === destId ? 25 : 15,
                  cursor: isDestReceptive ? 'crosshair' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.2s ease',
                }}
              >
                <MergedNodeShape
                  isCircle={isAccountNode}
                  sockets={isAccountNode ? 'left' : (isFb || isIg || isTiktok || destNode.targetMode === 'social_media' ? 'both' : 'left')}
                  strokeColor={strokeThemeColor}
                  socketDotColor={isDestReceptive ? RECEPTIVE_COLOR : isDark ? '#8B949E' : '#64748B'}
                  isConnectedInput={true}
                  isConnectedOutput={false}
                  highlightInput={isDestReceptive}
                  hasReceiver={!isAccountNode}
                  hasSource={true}
                  showAddButton={!isAccountNode && (isFb || isIg || isTiktok || destNode.targetMode === 'social_media')}
                  onAddClick={(e) => {
                    e.stopPropagation();
                    setConnectDrawerNode({
                      nodeId: destId,
                      nodeType: 'destination',
                      title: targetTitle,
                      platform: destNode.platform || (isFb ? 'facebook' : isIg ? 'instagram' : isTiktok ? 'tiktok' : undefined),
                    });
                  }}
                  onSocketMouseDown={(type, e) => handleSocketMouseDown(destId, type, e)}
                  onSocketMouseUp={(type, e) => handleSocketMouseUp(destId, type, e)}
                  onSocketMouseEnter={(type) => {
                    if (type === 'input') setHoveredInputNodeId(destId);
                  }}
                  onSocketMouseLeave={() => setHoveredInputNodeId(null)}
                />

                {/* Center Icon */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  {isAccountNode ? (
                    // 🌟 DEDICATED ACCOUNT / PAGE NODE: Prominent Profile Picture of Facebook Page in Center
                    (() => {
                      const pageAvatar = destNode.accountAvatar || targetPage?.picture_url;
                      const pageInitials = (targetTitle || 'FB').slice(0, 2).toUpperCase();
                      const platColor = isFb ? '#1877F2' : isIg ? '#E1306C' : '#06B6D4';

                      return (
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            userSelect: 'none',
                          }}
                        >
                          {pageAvatar ? (
                            <img
                              src={pageAvatar}
                              alt={targetTitle}
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                backgroundColor: isDark ? '#1C2128' : '#EFF6FF',
                                color: platColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.9375rem',
                                fontWeight: 700,
                              }}
                            >
                              {pageInitials}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : isFb ? (
                    // 📘 FACEBOOK PLATFORM HUB: ONLY Facebook "F" Icon without background
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      <FaFacebookF size={28} color="#1877F2" />
                    </div>
                  ) : isIg ? (
                    // 📸 INSTAGRAM PLATFORM HUB: ONLY Instagram Icon
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        boxShadow: '0 2px 8px rgba(225, 48, 108, 0.4)',
                      }}
                    >
                      <FaInstagram size={22} />
                    </div>
                  ) : isTiktok ? (
                    // 🎵 TIKTOK PLATFORM HUB: ONLY TikTok Icon
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        backgroundColor: '#000000',
                        border: '1px solid #333333',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#25F4EE',
                        boxShadow: '0 2px 8px rgba(37, 244, 238, 0.4)',
                      }}
                    >
                      <FaTiktok size={20} />
                    </div>
                  ) : isDbNode ? (
                    <FiLayers style={{ fontSize: '30px', color: '#0EA5E9', filter: 'drop-shadow(0 2px 6px rgba(14, 165, 233, 0.4))' }} />
                  ) : (
                    <div
                      style={{
                        position: 'relative',
                        width: '38px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #1877F2 0%, #E1306C 50%, #000000 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          boxShadow: '0 2px 6px rgba(225, 48, 108, 0.35)',
                        }}
                      >
                        <FiShare2 size={19} />
                      </div>
                      {isHybrid && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: -3,
                            right: -3,
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: '#0284C7',
                            border: isDark ? '2px solid #161B22' : '2px solid #FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                          }}
                        >
                          <FiLayers size={10} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <NodeExecutionBadge status={isDestSuccess ? 'success' : isDestRunning ? 'running' : 'idle'} />

                {/* Label below node */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${CIRCLE_SIZE + 8}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {targetTitle}
                  </span>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                    {targetSubtitle}
                  </span>
                </div>
              </div>
            );
          })}



          {/* QUICK ADD POPOVER (Store in Database / Post to Social Media) */}
          {quickAddPopover && (() => {
            const isDarkTheme = isDark;
            const targetBox = config.aiBoxes.find((b) => b.id === quickAddPopover.nodeId);
            const isImageNode =
              quickAddPopover.nodeType === 'get-images' ||
              (targetBox && (isWatermarkAIBox(targetBox) || isImageAIBox(targetBox, config.connections)));

            return (
              <div
                className="canvas-control quick-add-popover"
                style={{
                  position: 'absolute',
                  left: `${quickAddPopover.x}px`,
                  top: `${quickAddPopover.y - 20}px`,
                  width: '240px',
                  borderRadius: '10px',
                  backgroundColor: isDarkTheme ? '#1A1F26' : '#FFFFFF',
                  border: isDarkTheme ? '1px solid #30363D' : '1px solid #E2E8F0',
                  boxShadow: isDarkTheme
                    ? '0 12px 30px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)'
                    : '0 10px 25px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                  zIndex: 100,
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.15rem 0.25rem 0.35rem', borderBottom: isDarkTheme ? '1px solid #30363D' : '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Connect Next Step
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickAddPopover(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                  >
                    <FiX size={12} />
                  </button>
                </div>

                {/* Option 1: Store in Remaining Posts Database */}
                <button
                  type="button"
                  onClick={() => handleConnectOrCreateDestination(quickAddPopover.nodeId, 'remaining_posts')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.5rem',
                    borderRadius: '6px',
                    border: '1px solid transparent',
                    backgroundColor: isDarkTheme ? 'rgba(2, 132, 199, 0.12)' : '#F0F9FF',
                    color: isDarkTheme ? '#38BDF8' : '#0284C7',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0284C7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div style={{ width: '26px', height: '26px', borderRadius: '5px', backgroundColor: '#0284C7', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiLayers size={13} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Store in Database
                    </div>
                    <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                      Queue in Remaining Posts
                    </div>
                  </div>
                </button>

                {/* Option 2: Post to Social Media (Expandable File-System List) */}
                <button
                  type="button"
                  onClick={() =>
                    setQuickAddPopover({
                      ...quickAddPopover,
                      socialExpanded: !quickAddPopover.socialExpanded,
                    })
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.45rem',
                    padding: '0.45rem 0.5rem',
                    borderRadius: '6px',
                    border: quickAddPopover.socialExpanded ? '1px solid #E1306C' : '1px solid transparent',
                    backgroundColor: quickAddPopover.socialExpanded
                      ? (isDarkTheme ? 'rgba(225, 48, 108, 0.15)' : '#FFF1F5')
                      : (isDarkTheme ? 'rgba(37, 99, 235, 0.12)' : '#EFF6FF'),
                    color: isDarkTheme ? '#60A5FA' : '#2563EB',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '5px', background: 'linear-gradient(135deg, #1877F2 0%, #E1306C 50%, #000000 100%)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FiShare2 size={13} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Post to Social Media
                      </div>
                      <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                        {quickAddPopover.socialExpanded ? 'Choose platform below' : 'Choose Facebook, Instagram, or TikTok'}
                      </div>
                    </div>
                  </div>
                  <FiChevronDown
                    size={13}
                    style={{
                      transform: quickAddPopover.socialExpanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                      color: 'var(--text-muted)',
                      flexShrink: 0,
                    }}
                  />
                </button>

                {quickAddPopover.socialExpanded && (
                  <div
                    style={{
                      marginLeft: '0.5rem',
                      paddingLeft: '0.55rem',
                      borderLeft: `2px solid ${isDarkTheme ? '#30363D' : '#CBD5E1'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      maxHeight: '180px',
                      overflowY: 'auto',
                    }}
                  >
                    {/* Facebook Platform */}
                    <div
                      onClick={() =>
                        handleConnectOrCreateDestination(quickAddPopover.nodeId, 'social_media', 'facebook')
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.35rem 0.45rem',
                        borderRadius: '4px',
                        border: isDarkTheme ? '1px solid #30363D' : '1px solid #E2E8F0',
                        backgroundColor: isDarkTheme ? '#161B22' : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                        <FaFacebook size={12} color="#1877F2" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Facebook
                        </span>
                      </div>
                      <span style={{ fontSize: '0.5rem', color: '#1877F2', fontWeight: 600 }}>+ Facebook Box</span>
                    </div>

                    {/* Instagram Platform */}
                    <div
                      onClick={() =>
                        handleConnectOrCreateDestination(quickAddPopover.nodeId, 'social_media', 'instagram')
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.35rem 0.45rem',
                        borderRadius: '4px',
                        border: isDarkTheme ? '1px solid #30363D' : '1px solid #E2E8F0',
                        backgroundColor: isDarkTheme ? '#161B22' : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                        <FaInstagram size={12} color="#E1306C" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Instagram
                        </span>
                      </div>
                      <span style={{ fontSize: '0.5rem', color: '#E1306C', fontWeight: 600 }}>+ Instagram Box</span>
                    </div>

                    {/* TikTok Platform */}
                    <div
                      onClick={() =>
                        handleConnectOrCreateDestination(quickAddPopover.nodeId, 'social_media', 'tiktok')
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.35rem 0.45rem',
                        borderRadius: '4px',
                        border: isDarkTheme ? '1px solid #30363D' : '1px solid #E2E8F0',
                        backgroundColor: isDarkTheme ? '#161B22' : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                        <FaTiktok size={11} color="#25F4EE" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          TikTok
                        </span>
                      </div>
                      <span style={{ fontSize: '0.5rem', color: '#06B6D4', fontWeight: 600 }}>+ TikTok Box</span>
                    </div>
                  </div>
                )}

                {/* Option 3: Dual (Hybrid) */}
                <button
                  type="button"
                  onClick={() => handleConnectOrCreateDestination(quickAddPopover.nodeId, 'hybrid')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.5rem',
                    borderRadius: '6px',
                    border: '1px solid transparent',
                    backgroundColor: isDarkTheme ? 'rgba(139, 92, 246, 0.12)' : '#F5F3FF',
                    color: isDarkTheme ? '#A78BFA' : '#7C3AED',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#8B5CF6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div style={{ position: 'relative', width: '26px', height: '26px', borderRadius: '5px', backgroundColor: '#8B5CF6', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiLayers size={11} />
                    <div style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#FFFFFF', borderRadius: '50%', padding: '1px', display: 'flex' }}>
                      <FaFacebook size={7} color="#1877F2" />
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Social & Database
                    </div>
                    <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                      Store & publish simultaneously
                    </div>
                  </div>
                </button>

                {/* Contextual Pipeline Step: Add Format Preset if Image node */}
                {isImageNode && (
                  <button
                    type="button"
                    onClick={() => {
                      handleAddWatermarkNodeConnectedFromImages(quickAddPopover.nodeId);
                      setQuickAddPopover(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.45rem 0.5rem',
                      borderRadius: '6px',
                      border: isDarkTheme ? '1px dashed #30363D' : '1px dashed #CBD5E1',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      marginTop: '0.1rem',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#8B5CF6';
                      e.currentTarget.style.color = '#8B5CF6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isDarkTheme ? '#30363D' : '#CBD5E1';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <div style={{ width: '26px', height: '26px', borderRadius: '5px', backgroundColor: isDarkTheme ? 'rgba(139, 92, 246, 0.2)' : '#EDE9FE', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FiScissors size={13} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Add Format Preset
                      </div>
                      <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                        Aspect ratio & watermark
                      </div>
                    </div>
                  </button>
                )}
              </div>
            );
          })()}

        </div>
      </div>

      {/* ======================================================== */}
      {/* NODE CONFIGURATION SLIDE-OVER SIDEBAR                    */}
      {/* (Trigger, Get Content, Get Images, Combine, AI Process)   */}
      {/* ======================================================== */}
      {activeModalNode &&
        activeModalNode.type !== 'destination' &&
        !(activeModalNode.type === 'ai-box' && currentModalAIBox && isWatermarkAIBox(currentModalAIBox)) &&
        !connectDrawerNode && (() => {
          const isTrigger = activeModalNode.type === 'trigger' || activeModalNode.type === 'add-trigger';
          const isContent = activeModalNode.type === 'get-content';
          const isImages = activeModalNode.type === 'get-images';
          const isCombine = activeModalNode.type === 'combine';
          const isAIBox = activeModalNode.type === 'ai-box' && Boolean(currentModalAIBox);

          // Combine Box metadata
          const combineId = isCombine ? (activeModalNode.combineId || (activeModalNode as any).id) : null;
          const currentCombineBox = isCombine
            ? (config.combineBoxes || []).find((b) => b.id === combineId) || config.combineBoxes?.[0]
            : null;
          const combineInputs = isCombine && currentCombineBox
            ? (config.connections || []).filter((c) => c.toNodeId === currentCombineBox.id)
            : [];

          return (
            <aside
              className="workflow-sidebar"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: '380px',
                maxWidth: '100%',
                backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
                borderLeft: '1px solid var(--border-color)',
                boxShadow: isDark
                  ? '-8px 0 28px rgba(0, 0, 0, 0.75)'
                  : '-3px 0 16px rgba(0, 0, 0, 0.06)',
                zIndex: 170,
                display: 'flex',
                flexDirection: 'column',
                animation: 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.875rem 1rem',
                  borderBottom: 'none',
                  backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, flex: 1 }}>
                  {/* Icon */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: isTrigger
                        ? 'rgba(24, 119, 242, 0.12)'
                        : isContent
                        ? 'rgba(59, 130, 246, 0.12)'
                        : isImages
                        ? 'rgba(16, 185, 129, 0.12)'
                        : isCombine
                        ? 'rgba(245, 158, 11, 0.12)'
                        : currentModalAIBox?.provider === 'google_ai'
                        ? 'rgba(96, 165, 250, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isTrigger && <FaFacebook size={18} color="#1877F2" />}
                    {isContent && <FiFileText size={18} color="#3B82F6" />}
                    {isImages && <FiImage size={18} color="#10B981" />}
                    {isCombine && <FiGitMerge size={18} color="#F59E0B" />}
                    {isAIBox && currentModalAIBox && (
                      currentModalAIBox.provider === 'google_ai' ? (
                        <SiGooglegemini size={18} color="#60A5FA" />
                      ) : currentModalAIBox.provider === 'openai' ? (
                        <OpenAIIcon size={18} />
                      ) : currentModalAIBox.provider === 'laozhang_ai' ? (
                        <LaoZhangIcon size={18} />
                      ) : (
                        <RunwareIcon size={18} color="#10B981" />
                      )
                    )}
                  </div>

                  {/* Title & Subtitle */}
                  <div style={{ minWidth: 0, flex: 1, paddingRight: '0.5rem' }}>
                    {isAIBox && currentModalAIBox ? (
                      <input
                        type="text"
                        value={currentModalAIBox.title}
                        onChange={(e) => handleUpdateAIBox(currentModalAIBox.id, { title: e.target.value })}
                        placeholder="Node Name"
                        title="Click to rename node"
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          backgroundColor: 'transparent',
                          border: 'none',
                          outline: 'none',
                          width: '100%',
                          padding: '1px 0',
                          lineHeight: 1.2,
                        }}
                      />
                    ) : isCombine && currentCombineBox ? (
                      <input
                        type="text"
                        value={currentCombineBox.title || 'Combine Box'}
                        onChange={(e) => {
                          const updatedBoxes = (config.combineBoxes || []).map((b) =>
                            b.id === currentCombineBox.id ? { ...b, title: e.target.value } : b
                          );
                          updateConfig({ ...config, combineBoxes: updatedBoxes });
                        }}
                        placeholder="Combine Box Name"
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          backgroundColor: 'transparent',
                          border: 'none',
                          outline: 'none',
                          width: '100%',
                          padding: '1px 0',
                          lineHeight: 1.2,
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                        {isTrigger && 'Facebook URL Importer'}
                        {isContent && 'Get Content Branch'}
                        {isImages && 'Get Images Branch'}
                      </div>
                    )}
                    {!isAIBox && (
                      <div style={{ fontSize: '0.6875rem', color: isDark ? '#8B949E' : '#64748B', marginTop: '2px' }}>
                        {isTrigger && 'Trigger Node · OpenClaw'}
                        {isContent && '100% Full Content Extraction'}
                        {isImages && 'High-Res Media Downloader'}
                        {isCombine && `${combineInputs.length} inputs merged`}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <FiX size={15} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                {/* TRIGGER SIDEBAR CONTENT */}
                {isTrigger && (
                  <>
                    {/* Connect Next Step Quick Button (top) */}
                    {renderCenteredConnectButton('trigger', 'trigger', 'Facebook URL Importer')}

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        padding: '0.875rem',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'var(--bg-surface)' : 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Facebook URL Importer
                        </span>
                        <span
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: isDark ? 'rgba(24, 119, 242, 0.15)' : 'rgba(24, 119, 242, 0.1)',
                            color: '#1877F2',
                          }}
                        >
                          Active Trigger
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Extracts post content, high-resolution media gallery, and property attributes from Facebook URLs to feed downstream workflow branches.
                      </div>
                    </div>
                  </>
                )}

                {/* GET CONTENT SIDEBAR CONTENT */}
                {isContent && (() => {
                  const contentStatus = getNodeExecutionStatus('get-content');
                  return (
                    <>
                      {/* Connect Next Step Quick Button (top) */}
                      {renderCenteredConnectButton('get-content', 'get-content', 'Get Content')}

                      {/* Execution Result Box */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                          padding: '0.625rem',
                          borderRadius: '8px',
                          border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#F8FAFC',
                          marginTop: '0.25rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              Extracted Post Content
                            </span>
                            {rawContent ? (
                              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#10B981', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7', padding: '1px 5px', borderRadius: '4px' }}>
                                ✓ Ready
                              </span>
                            ) : contentStatus === 'running' ? (
                              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#0284C7', backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE', padding: '1px 5px', borderRadius: '4px' }}>
                                ● Extracting...
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                                (Idle)
                              </span>
                            )}
                          </div>

                          {rawContent && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(rawContent);
                                setCopiedTextSuccess(true);
                                setTimeout(() => setCopiedTextSuccess(false), 2000);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: 'none',
                                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.625rem',
                                color: copiedTextSuccess ? '#10B981' : 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              {copiedTextSuccess ? <FiCheck size={11} /> : <FiCopy size={11} />}
                              <span>{copiedTextSuccess ? 'Copied' : 'Copy'}</span>
                            </button>
                          )}
                        </div>

                        {rawContent ? (
                          <>
                            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                              <span>{rawContent.length} characters</span>
                              <span>•</span>
                              <span>{rawContent.trim().split(/\s+/).filter(Boolean).length} words</span>
                            </div>
                            <div
                              style={{
                                maxHeight: '180px',
                                overflowY: 'auto',
                                padding: '0.5rem',
                                borderRadius: '6px',
                                backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                fontSize: '0.75rem',
                                lineHeight: 1.5,
                                color: 'var(--text-primary)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                              }}
                            >
                              {rawContent}
                            </div>
                          </>
                        ) : contentStatus === 'running' ? (
                          <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            Extracting post text and caption from link...
                          </div>
                        ) : (
                          <div style={{ padding: '0.875rem 0.5rem', textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No content extracted yet. Run workflow with a Facebook URL to view live result here.
                          </div>
                        )}
                      </div>

                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                        When enabled, the full raw text caption and specifications are extracted directly from the post and piped simultaneously into all active AI copywriter nodes.
                      </p>
                    </>
                  );
                })()}

                {/* GET IMAGES SIDEBAR CONTENT */}
                {isImages && (() => {
                  const imagesStatus = getNodeExecutionStatus('get-images');
                  return (
                    <>
                      {/* Connect Next Step Quick Button (top) */}
                      {renderCenteredConnectButton('get-images', 'get-images', 'Get Images')}

                      {/* Media Gallery Execution Result Box */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                          padding: '0.625rem',
                          borderRadius: '8px',
                          border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#F8FAFC',
                          marginTop: '0.25rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Extracted Media ({compiledImages.length})
                          </span>
                          {compiledImages.length > 0 ? (
                            <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#10B981', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7', padding: '1px 5px', borderRadius: '4px' }}>
                              ✓ Photos Ready
                            </span>
                          ) : imagesStatus === 'running' ? (
                            <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#0284C7', backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE', padding: '1px 5px', borderRadius: '4px' }}>
                              ● Downloading...
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                              (Idle)
                            </span>
                          )}
                        </div>

                        {compiledImages.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', maxHeight: '200px', overflowY: 'auto' }}>
                            {compiledImages.map((img, i) => (
                              <div
                                key={img.index ?? i}
                                onClick={() => handleOpenLightbox(i)}
                                style={{
                                  position: 'relative',
                                  aspectRatio: '1',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                                }}
                                title="Click to preview full photo"
                              >
                                <img
                                  src={img.finalUrl}
                                  alt={`Photo ${i + 1}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                {img.isEnhanced && (
                                  <span style={{ position: 'absolute', top: 2, left: 2, fontSize: '0.5rem', fontWeight: 700, backgroundColor: '#EC4899', color: '#FFFFFF', padding: '1px 3px', borderRadius: '2px' }}>
                                    HD
                                  </span>
                                )}
                                {img.isWatermarked && (
                                  <span style={{ position: 'absolute', bottom: 2, right: 2, width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : imagesStatus === 'running' ? (
                          <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            Downloading high-resolution photos...
                          </div>
                        ) : (
                          <div style={{ padding: '0.875rem 0.5rem', textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No photos downloaded yet. Run workflow with Facebook URL to fetch media gallery.
                          </div>
                        )}
                      </div>

                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                        When enabled, the entire gallery of photos attached to the Facebook post is retrieved in high quality and sent to active photo formats and destinations.
                      </p>
                    </>
                  );
                })()}

                {/* COMBINE BOX SIDEBAR CONTENT */}
                {isCombine && currentCombineBox && (
                  <>
                    {/* Connect Next Step Quick Button (top) */}
                    {renderCenteredConnectButton(currentCombineBox.id, 'combine', currentCombineBox.title || 'Combine Box')}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.875rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: isDark ? 'var(--bg-surface)' : '#F8FAFC',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Status
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Merges parallel inputs into a unified output
                        </div>
                      </div>
                      <Badge variant="warning">{combineInputs.length} Inputs Merged</Badge>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Incoming Connected Nodes
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {combineInputs.map((c) => {
                          const fromBox = config.aiBoxes.find((b) => b.id === c.fromNodeId);
                          const fromTitle =
                            c.fromNodeId === 'get-content'
                              ? 'Get Content'
                              : c.fromNodeId === 'get-images'
                              ? 'Get Images'
                              : fromBox?.title || c.fromNodeId;
                          return (
                            <div
                              key={c.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF',
                                fontSize: '0.75rem',
                              }}
                            >
                              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{fromTitle}</span>
                              <span style={{ color: '#F59E0B', fontSize: '0.7rem' }}>Connected</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto', paddingTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const newId = `combine-box-${Date.now()}`;
                          updateConfig({
                            ...config,
                            combineBoxes: [
                              ...(config.combineBoxes || []),
                              { id: newId, title: 'Combine Box', enabled: true, x: (currentCombineBox.x ?? 740), y: (currentCombineBox.y ?? 160) + 140 },
                            ],
                          });
                          setActiveModalNode({ type: 'combine', combineId: newId, id: newId });
                        }}
                        style={{
                          height: '32px',
                          borderRadius: '6px',
                          border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB',
                          color: '#D97706',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <FiPlus size={13} />
                        <span>Add Another Combine Box</span>
                      </button>
                    </div>
                  </>
                )}

                {/* AI PROCESS / AI MODEL SIDEBAR CONTENT (Restored Design) */}
                {isAIBox && currentModalAIBox && (
                  <>
                    {/* Connect Next Step Quick Button (top) */}
                    {renderCenteredConnectButton(currentModalAIBox.id, 'ai-box', currentModalAIBox.title || 'AI Processor')}

                    {/* Node Status Toggle Card */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 0.875rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: isDark ? 'var(--bg-surface)' : '#F8FAFC',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Node Status
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {currentModalAIBox.enabled ? 'Executing during workflow run' : 'Node is bypassed'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleAIBox(currentModalAIBox.id)}
                        style={{
                          height: '28px',
                          padding: '0 0.625rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          borderRadius: '6px',
                          border: `1px solid ${currentModalAIBox.enabled ? 'rgba(16, 185, 129, 0.4)' : isDark ? '#30363D' : '#CBD5E1'}`,
                          backgroundColor: currentModalAIBox.enabled ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                          color: currentModalAIBox.enabled ? '#34D399' : 'var(--text-muted)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: currentModalAIBox.enabled ? '#10B981' : '#6B7280',
                          }}
                        />
                        <span>{currentModalAIBox.enabled ? 'Active' : 'Disabled'}</span>
                      </button>
                    </div>

                    {/* Select Prompt Template */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          <FiFileText style={{ fontSize: '12px', color: 'var(--accent-primary, #3B82F6)' }} />
                          Select Prompt Template
                        </label>
                        {currentModalAIBox.templateId && currentModalAIBox.templateId !== 'custom' && (
                          <span style={{ fontSize: '0.625rem', color: '#10B981', fontWeight: 500 }}>
                            ● Linked to Template
                          </span>
                        )}
                      </div>
                      <Select
                        options={[
                          ...availablePrompts.map((p) => ({
                            value: String(p.id),
                            label: p.name,
                          })),
                          { value: 'custom', label: '✨ Custom Prompt (Manual Input)' },
                        ]}
                        value={
                          availablePrompts.some((p) => String(p.id) === String(currentModalAIBox.templateId))
                            ? String(currentModalAIBox.templateId)
                            : availablePrompts.some((p) => p.name === currentModalAIBox.title)
                            ? String(availablePrompts.find((p) => p.name === currentModalAIBox.title)!.id)
                            : currentModalAIBox.templateId === 'custom'
                            ? 'custom'
                            : availablePrompts[0]?.id ? String(availablePrompts[0].id) : 'custom'
                        }
                        onChange={(val) => {
                          if (val === 'custom') {
                            handleUpdateAIBox(currentModalAIBox.id, {
                              templateId: 'custom',
                            });
                            return;
                          }
                          const matched = availablePrompts.find((p) => String(p.id) === String(val));
                          if (matched) {
                            const isGenericTitle =
                              !currentModalAIBox.title ||
                              /^AI Process #\d+/i.test(currentModalAIBox.title) ||
                              availablePrompts.some(
                                (p) =>
                                  currentModalAIBox.title === p.name ||
                                  currentModalAIBox.title === `${p.name} - Prompt` ||
                                  currentModalAIBox.title === `${p.name} - Content - Prompt`
                              );

                            handleUpdateAIBox(currentModalAIBox.id, {
                              templateId: String(matched.id),
                              templateText: matched.templateText,
                              title: isGenericTitle ? matched.name : currentModalAIBox.title,
                            });
                          }
                        }}
                        height="34px"
                        placeholder="Select prompt template..."
                      />
                    </div>

                    {/* AI Engine & Model */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        AI Engine & Model
                      </label>
                      <Select
                        options={AI_ENGINE_MODEL_GROUPS}
                        value={currentModalAIBox.model || (currentModalAIBox.provider === 'openai' ? 'gpt-4o' : 'gemini-2.5-flash')}
                        onChange={(val) => {
                          const isGoogle = AI_ENGINE_MODEL_GROUPS[0]?.options.some((o) => o.value === val);
                          handleUpdateAIBox(currentModalAIBox.id, {
                            model: val,
                            provider: isGoogle ? 'google_ai' : 'openai',
                          });
                        }}
                        height="36px"
                        placeholder="Select AI Model..."
                      />
                    </div>



                    {/* Generated Output Preview Box (if available) */}
                    {(() => {
                      const boxOutput = aiGeneratedOutputs?.[currentModalAIBox.id] || (currentModalAIBox.id === config.aiBoxes[0]?.id ? aiGeneratedCopy : undefined);
                      if (!boxOutput) return null;
                      return (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem',
                            padding: '0.625rem',
                            borderRadius: '8px',
                            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#F8FAFC',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Generated Output Copy
                              </span>
                              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#10B981', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7', padding: '1px 5px', borderRadius: '4px' }}>
                                ✓ Ready
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(boxOutput);
                                setCopiedTextSuccess(true);
                                setTimeout(() => setCopiedTextSuccess(false), 2000);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: 'none',
                                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.625rem',
                                color: copiedTextSuccess ? '#10B981' : 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              {copiedTextSuccess ? <FiCheck size={11} /> : <FiCopy size={11} />}
                              <span>{copiedTextSuccess ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                            <span>{boxOutput.length} characters</span>
                            <span>•</span>
                            <span>{boxOutput.trim().split(/\s+/).filter(Boolean).length} words</span>
                          </div>
                          <div
                            style={{
                              maxHeight: '160px',
                              overflowY: 'auto',
                              padding: '0.5rem',
                              borderRadius: '6px',
                              backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                              border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                              fontSize: '0.75rem',
                              lineHeight: 1.5,
                              color: 'var(--text-primary)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {boxOutput}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Bottom Pinned Footer: Full Width Delete Button */}
              <div
                style={{
                  padding: '0.875rem 1rem',
                  borderTop: 'none',
                  backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
                }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    if (isTrigger) handleDeleteTrigger(e);
                    else if (isContent) handleDeleteGetContent(e);
                    else if (isImages) handleDeleteGetImages(e);
                    else if (isCombine && currentCombineBox) handleDeleteCombineBox(currentCombineBox.id, e);
                    else if (isAIBox && currentModalAIBox) handleDeleteAIBox(currentModalAIBox.id, e);
                    handleCloseModal();
                  }}
                  leftIcon={<FiTrash2 size={13} style={{ color: 'var(--text-secondary)' }} />}
                  style={{
                    width: '100%',
                    height: '34px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    backgroundColor: isDark ? 'var(--bg-surface)' : '#F1F5F9',
                    borderColor: 'var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Delete
                </Button>
              </div>
            </aside>
          );
        })()}

      {/* ======================================================== */}
      {/* PHOTO FORMAT & WATERMARK SLIDE-OVER SIDEBOX              */}
      {/* ======================================================== */}
      {activeModalNode &&
        activeModalNode.type === 'ai-box' &&
        currentModalAIBox &&
        isWatermarkAIBox(currentModalAIBox) &&
        !connectDrawerNode && (() => {
          return (
            <aside
              className="workflow-sidebar"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: '380px',
                maxWidth: '100%',
                backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
                borderLeft: '1px solid var(--border-color)',
                boxShadow: isDark
                  ? '-8px 0 28px rgba(0, 0, 0, 0.75)'
                  : '-3px 0 16px rgba(0, 0, 0, 0.06)',
                zIndex: 170,
                display: 'flex',
                flexDirection: 'column',
                animation: 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Top Navigation Bar with Title & Close [X] */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.875rem 1rem',
                  borderBottom: 'none',
                  backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--accent-primary-alpha, rgba(37, 99, 235, 0.1))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-primary, #3B82F6)',
                      flexShrink: 0,
                    }}
                  >
                    <FiScissors size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                      Photo Format & Crop
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: isDark ? '#8B949E' : '#64748B' }}>
                      Crop & Cut Studio
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'var(--bg-surface)' : 'rgba(0, 0, 0, 0.04)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <FiX size={15} />
                </button>
              </div>

              {/* Scrollable Body with WatermarkNodeModal */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1.25rem',
                }}
              >
                {/* Connect Next Step Quick Button (top) */}
                {renderCenteredConnectButton(currentModalAIBox.id, 'ai-box', currentModalAIBox.title || 'Format Preset')}

                <WatermarkNodeModal
                  box={currentModalAIBox}
                  isDark={isDark}
                  onUpdateBox={(id, updates) => handleUpdateAIBox(id, updates)}
                  onDeleteBox={(id) => {
                    handleDeleteAIBox(id);
                    handleCloseModal();
                  }}
                  onClose={handleCloseModal}
                />
              </div>

              {/* Bottom Pinned Footer: Full Width Delete Button */}
              <div
                style={{
                  padding: '0.875rem 1rem',
                  borderTop: 'none',
                  backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
                }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    handleDeleteAIBox(currentModalAIBox.id, e);
                    handleCloseModal();
                  }}
                  leftIcon={<FiTrash2 size={13} style={{ color: 'var(--text-secondary)' }} />}
                  style={{
                    width: '100%',
                    height: '34px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    backgroundColor: isDark ? 'var(--bg-surface)' : '#F1F5F9',
                    borderColor: 'var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Delete
                </Button>
              </div>
            </aside>
          );
        })()}

      {/* ======================================================== */}
      {/* DESTINATION SLIDE-OVER SIDEBOX (Anchor Right Drawer)      */}
      {/* ======================================================== */}
      {activeModalNode && activeModalNode.type === 'destination' && !connectDrawerNode && (() => {
        const allDests = getNormalizedDestinations(config);
        const activeDestId = activeModalNode.destinationId || allDests[0]?.id || 'destination';
        const currentDest = allDests.find((d) => d.id === activeDestId) || allDests[0];
        const destIdx = allDests.findIndex((d) => d.id === activeDestId);
        const isPlatformHub = currentDest.id.startsWith('dest-platform-') || (currentDest.targetMode === 'social_media' && !currentDest.accountId);
        const isDatabaseQueue = currentDest.id.includes('database') || currentDest.title?.includes('Database') || currentDest.targetMode === 'remaining_posts';
        const isDbNode = isDatabaseQueue || currentDest.platform === 'database';
        const isHybrid = (currentDest.storeInDatabase && currentDest.postToSocialMedia) || currentDest.targetMode === 'hybrid';
        const platform = currentDest.platform || (isDbNode ? 'database' : (currentDest.selectedPageId ? 'facebook' : undefined));
        const isFb = (platform === 'facebook' || currentDest.id.includes('facebook') || currentDest.platform === 'facebook') && !isHybrid && !isDbNode;
        const isIg = (platform === 'instagram' || currentDest.id.includes('instagram') || currentDest.platform === 'instagram') && !isHybrid && !isDbNode;
        const isTiktok = (platform === 'tiktok' || currentDest.id.includes('tiktok') || currentDest.platform === 'tiktok') && !isHybrid && !isDbNode;
        const isAccountNode = Boolean(currentDest.accountId);
        const isPageAccount = isAccountNode;
        const hasPlusButton = !isAccountNode && (isFb || isIg || isTiktok || currentDest.targetMode === 'social_media');

        // Upstream connection detection via reverse graph BFS
        const upstreamIds = new Set<string>();
        const queue = [activeDestId];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          (config.connections || []).forEach((c) => {
            if (c.toNodeId === curr && !upstreamIds.has(c.fromNodeId)) {
              upstreamIds.add(c.fromNodeId);
              queue.push(c.fromNodeId);
            }
          });
        }

        // Check if text/copy is upstream
        const hasIncomingContent =
          upstreamIds.has('get-content') ||
          config.aiBoxes.some((b) => upstreamIds.has(b.id) && !isWatermarkAIBox(b)) ||
          (config.combineBoxes || []).some((cb) => {
            if (!upstreamIds.has(cb.id)) return false;
            const cbInputs = (config.connections || []).filter((c) => c.toNodeId === cb.id).map((c) => c.fromNodeId);
            return cbInputs.some((id) => id === 'get-content' || config.aiBoxes.some((b) => b.id === id && !isWatermarkAIBox(b)));
          });

        // Check if photos/media is upstream
        const hasIncomingImages =
          upstreamIds.has('get-images') ||
          config.aiBoxes.some((b) => upstreamIds.has(b.id) && isWatermarkAIBox(b)) ||
          (config.combineBoxes || []).some((cb) => {
            if (!upstreamIds.has(cb.id)) return false;
            const cbInputs = (config.connections || []).filter((c) => c.toNodeId === cb.id).map((c) => c.fromNodeId);
            return cbInputs.some((id) => id === 'get-images' || config.aiBoxes.some((b) => b.id === id && isWatermarkAIBox(b)));
          });

        const previewCopy =
          activeCopy ||
          rawContent ||
          Object.values(aiGeneratedOutputs)[0] ||
          `✨ ${currentDest.accountName || currentDest.title || 'Luxury Condo'} — 2BR/2BA Modern High-Rise • ฿8,500,000 • Freehold • Contact: 081-234-5678`;

        const updateCurrentDest = (updates: Partial<DestinationNodeConfig>) => {
          const updatedDests = allDests.map((d) => (d.id === activeDestId ? { ...d, ...updates } : d));
          updateConfig({
            ...config,
            destinations: updatedDests,
            destination: updatedDests[0] ? { ...config.destination, ...updatedDests[0] } : config.destination,
          });
        };

        return (
          <aside
            className="workflow-sidebar"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '380px',
              maxWidth: '100%',
              backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
              borderLeft: '1px solid var(--border-color)',
              boxShadow: isDark
                ? '-8px 0 28px rgba(0, 0, 0, 0.75)'
                : '-3px 0 16px rgba(0, 0, 0, 0.06)',
              zIndex: 170,
              display: 'flex',
              flexDirection: 'column',
              animation: 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Top Navigation Bar with Title & Close [X] */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '0.875rem 1rem',
                borderBottom: 'none',
                backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10B981',
                    flexShrink: 0,
                  }}
                >
                  <FiCheckCircle size={17} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    Destination Settings
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: isDark ? '#8B949E' : '#64748B' }}>
                    {currentDest.accountName || currentDest.title || 'Destination Node'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: isDark ? 'var(--bg-surface)' : 'rgba(0, 0, 0, 0.04)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <FiX size={15} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {/* Connect Next Step Quick Button (top) */}
              {hasPlusButton &&
                renderCenteredConnectButton(
                  activeDestId,
                  'destination',
                  currentDest.accountName || currentDest.title || (isFb ? 'Facebook' : isIg ? 'Instagram' : isTiktok ? 'TikTok' : 'Social Media'),
                  isFb ? 'facebook' : isIg ? 'instagram' : isTiktok ? 'tiktok' : undefined
                )}

              {/* Profile Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.875rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: isDark ? 'var(--bg-surface)' : '#F8FAFC',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  {currentDest.accountAvatar ? (
                    <img
                      src={currentDest.accountAvatar}
                      alt={currentDest.accountName || currentDest.title}
                      style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: '#1877F2',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        flexShrink: 0,
                      }}
                    >
                      {(currentDest.accountName || currentDest.title || 'FB').charAt(0)}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentDest.accountName || currentDest.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: isDark ? '#8B949E' : '#64748B' }}>
                      {isPageAccount ? `Facebook Page · Slot ${destIdx + 1}` : isDatabaseQueue ? 'Database Queue' : 'Pages Hub'}
                    </div>
                  </div>
                </div>
                <Badge variant="success">Active Target</Badge>
              </div>

              {/* CONTENT SESSION: Show only if upstream content is connected */}
              {hasIncomingContent && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    padding: '0.875rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'var(--bg-surface)' : '#FFFFFF',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiFileText size={16} color="#3B82F6" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Content Session
                      </span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.7rem', color: isDark ? '#8B949E' : '#64748B' }}>
                      <span>Include</span>
                      <input
                        type="checkbox"
                        checked={currentDest.includeContent !== false}
                        onChange={(e) => updateCurrentDest({ includeContent: e.target.checked })}
                        style={{ cursor: 'pointer' }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'var(--bg-main)' : '#F8FAFC',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.7rem',
                      lineHeight: 1.5,
                      color: 'var(--text-primary)',
                      maxHeight: '110px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {previewCopy}
                  </div>
                </div>
              )}

              {/* IMAGES SESSION: Show only if upstream images are connected */}
              {hasIncomingImages && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    padding: '0.875rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'var(--bg-surface)' : '#FFFFFF',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiImage size={16} color="#10B981" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Images Session ({compiledImages.length} photos)
                      </span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.7rem', color: isDark ? '#8B949E' : '#64748B' }}>
                      <span>Include</span>
                      <input
                        type="checkbox"
                        checked={currentDest.includeImages !== false}
                        onChange={(e) => updateCurrentDest({ includeImages: e.target.checked })}
                        style={{ cursor: 'pointer' }}
                      />
                    </label>
                  </div>

                  {compiledImages.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflowX: 'auto', paddingBottom: '3px' }}>
                      {compiledImages.slice(0, 8).map((img, i) => (
                        <div
                          key={img.index || i}
                          onClick={() => handleOpenLightbox(i)}
                          title="Click to preview"
                          style={{
                            position: 'relative',
                            width: '48px',
                            height: '48px',
                            flexShrink: 0,
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                          }}
                        >
                          <img src={img.finalUrl} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.7rem', color: isDark ? '#8B949E' : '#64748B', fontStyle: 'italic', padding: '0.4rem 0' }}>
                      Photos will be delivered upon workflow execution.
                    </div>
                  )}
                </div>
              )}

              {/* If neither content nor images connected */}
              {!hasIncomingContent && !hasIncomingImages && (
                <div
                  style={{
                    padding: '1.25rem',
                    textAlign: 'center',
                    borderRadius: '8px',
                    border: isDark ? '1px dashed var(--border-color)' : '1px dashed #CBD5E1',
                    color: isDark ? '#8B949E' : '#64748B',
                    fontSize: '0.75rem',
                  }}
                >
                  No Content or Media Connected Yet. Connect wires from Combine Box or Branches to feed this page.
                </div>
              )}

              {/* PUBLISHING STRATEGY */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                  padding: '0.875rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: isDark ? 'var(--bg-surface)' : '#FFFFFF',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Publishing Strategy
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Publish Status</span>
                  <button
                    type="button"
                    onClick={() => updateCurrentDest({ publishDirectly: !(currentDest.publishDirectly !== false) })}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '5px',
                      border: 'none',
                      backgroundColor: currentDest.publishDirectly !== false ? '#10B981' : isDark ? 'var(--bg-main)' : '#E2E8F0',
                      color: '#FFFFFF',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {currentDest.publishDirectly !== false ? 'Direct Publish' : 'Save as Draft'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Include AI Hashtags</span>
                  <input
                    type="checkbox"
                    checked={currentDest.includeHashtags !== false}
                    onChange={(e) => updateCurrentDest({ includeHashtags: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Post First Comment with Contact</span>
                  <input
                    type="checkbox"
                    checked={Boolean(currentDest.includeFirstComment)}
                    onChange={(e) => updateCurrentDest({ includeFirstComment: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Footer Actions: Only Delete button with full width */}
            <div
              style={{
                padding: '0.875rem 1rem',
                borderTop: 'none',
                backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  handleDeleteDestination(e, activeDestId);
                  handleCloseModal();
                }}
                leftIcon={<FiTrash2 size={13} style={{ color: 'var(--text-secondary)' }} />}
                style={{
                  width: '100%',
                  height: '34px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  backgroundColor: isDark ? 'var(--bg-surface)' : '#F1F5F9',
                  borderColor: 'var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Delete
              </Button>
            </div>
          </aside>
        );
      })()}

      {/* CONNECT ITEMS DRAWER (Opened via clicking "+" socket button on ANY workflow node) */}
      {connectDrawerNode && (() => {
        const fromNodeId = connectDrawerNode.nodeId;
        const fromNodeType = connectDrawerNode.nodeType;
        const fromTitle = connectDrawerNode.title;

        // Context booleans
        const isTrigger = fromNodeType === 'trigger' || fromNodeId === 'trigger';
        const isContent = fromNodeType === 'get-content' || fromNodeId === 'get-content';
        const isImages = fromNodeType === 'get-images' || fromNodeId === 'get-images';
        const isAI = fromNodeType === 'ai-box' || fromNodeId.startsWith('ai-box');
        const isOutput = fromNodeType === 'output' || fromNodeId === 'output';
        const fromBox = config.aiBoxes.find((b) => b.id === fromNodeId);
        const isFromTextAI = fromBox ? isTextAIBox(fromBox, config.connections) : false;
        const isFromTextFormat = fromBox ? isTextFormatAIBox(fromBox) : false;
        const isFromEnhance = fromBox ? (isEnhanceAIBox(fromBox, config.connections) || isImageAIBox(fromBox, config.connections)) && !isWatermarkAIBox(fromBox) : false;
        const isFromWatermark = fromBox ? isWatermarkAIBox(fromBox) : false;

        // Outgoing wires from this node
        const outgoingConnections = (config.connections || []).filter((c) => c.fromNodeId === fromNodeId);
        const connectedTargetIds = new Set(outgoingConnections.map((c) => c.toNodeId));

        // Available existing nodes that can be connected
        const fromDestNode = getNormalizedDestinations(config).find((d) => d.id === fromNodeId);
        const resolvedTitle = (fromTitle || fromDestNode?.title || connectDrawerNode.title || '').toLowerCase();
        const resolvedId = (fromNodeId || '').toLowerCase();
        const isNonDestinationNode = isTrigger || isContent || isImages || isAI || isOutput || fromNodeType === 'combine';
        const destinationPlatform: string | undefined = isNonDestinationNode ? undefined : (
          fromDestNode?.platform ||
          (connectDrawerNode.platform === 'database' ? undefined : connectDrawerNode.platform) ||
          (fromDestNode?.selectedPageId || fromDestNode?.selectedPageIds?.length ? 'facebook' : undefined) ||
          (fromDestNode?.selectedIgAccountIds?.length ? 'instagram' : undefined) ||
          (fromDestNode?.selectedTiktokAccountIds?.length ? 'tiktok' : undefined) ||
          (resolvedTitle.includes('facebook') || resolvedId.includes('facebook') ? 'facebook' : undefined) ||
          (resolvedTitle.includes('instagram') || resolvedId.includes('instagram') ? 'instagram' : undefined) ||
          (resolvedTitle.includes('tiktok') || resolvedId.includes('tiktok') ? 'tiktok' : undefined) ||
          (resolvedTitle.includes('database') || resolvedId.includes('database') || fromDestNode?.targetMode === 'remaining_posts' ? 'database' : undefined)
        );
        const isDestination = !isNonDestinationNode && (fromNodeType === 'destination' || fromNodeId.startsWith('dest-') || Boolean(fromDestNode) || destinationPlatform !== undefined);

        // If clicking [+] from a specific Social Media node (Facebook, Instagram, TikTok):
        // Show ONLY the accounts relative to that specific social media platform!
        if (isDestination && destinationPlatform && destinationPlatform !== 'database') {
          const isFb = destinationPlatform === 'facebook';
          const isIg = destinationPlatform === 'instagram';
          const isTiktok = destinationPlatform === 'tiktok';
          const platColor = isFb ? '#1877F2' : isIg ? '#E1306C' : '#06B6D4';
          const platName = isFb ? 'Facebook' : isIg ? 'Instagram' : 'TikTok';

          return (
            <aside
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: '380px',
                maxWidth: '100%',
                backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
                borderLeft: '1px solid var(--border-color)',
                boxShadow: isDark
                  ? '-8px 0 28px rgba(0, 0, 0, 0.75)'
                  : '-3px 0 16px rgba(0, 0, 0, 0.06)',
                zIndex: 170,
                display: 'flex',
                flexDirection: 'column',
                animation: 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderBottom: 'none',
                  backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: isFb ? '#1877F2' : isTiktok ? '#000000' : undefined,
                      background: isIg ? 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' : undefined,
                      border: isTiktok ? '1px solid #333333' : undefined,
                      color: isTiktok ? '#25F4EE' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isFb ? <FaFacebook size={16} /> : isIg ? <FaInstagram size={16} /> : <FaTiktok size={14} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: isDark ? '#F0F6FC' : '#0F172A',
                        lineHeight: 1.2,
                      }}
                    >
                      Connect {platName} Account
                    </div>
                    <div
                      style={{
                        fontSize: '0.625rem',
                        color: platColor,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      From: {fromTitle}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConnectDrawerNode(null);
                    setActiveModalNode(null);
                  }}
                  aria-label="Close"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                    backgroundColor: 'transparent',
                    color: isDark ? '#8B949E' : '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <FiX size={14} />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '0.75rem',
                }}
              >
                {/* Section Header */}
                <div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: isDark ? '#8B949E' : '#64748B',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Choose {platName} Account
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                    Select an account or page to add as a dedicated circular box connected to {fromTitle}:
                  </div>

                  {/* ONLY show accounts relative to this platform! */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {isFb &&
                      managedPages.map((page) => (
                        <div
                          key={page.page_id}
                          onClick={() => {
                            handleConnectOrCreateDestination(fromNodeId, 'social_media', 'facebook', {
                              id: page.page_id,
                              name: page.name,
                              picture_url: page.picture_url,
                            });
                            setConnectDrawerNode(null);
                            setActiveModalNode(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.65rem',
                            borderRadius: '7px',
                            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                            backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#1877F2';
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(24, 119, 242, 0.12)' : '#EFF6FF';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                            e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                backgroundColor: '#1877F2',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {page.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {page.name}
                              </div>
                              <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                                Page • Slot {page.slot || 1} • ID: {page.page_id}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '0.5625rem',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#1877F2',
                              color: '#FFFFFF',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              flexShrink: 0,
                            }}
                          >
                            <FiPlus size={10} /> Add Box
                          </span>
                        </div>
                      ))}

                    {isIg &&
                      managedIgAccounts.map((acct) => (
                        <div
                          key={acct.account_id}
                          onClick={() => {
                            handleConnectOrCreateDestination(fromNodeId, 'social_media', 'instagram', {
                              id: acct.account_id,
                              name: acct.name,
                              username: acct.username,
                            });
                            setConnectDrawerNode(null);
                            setActiveModalNode(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.65rem',
                            borderRadius: '7px',
                            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                            backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#E1306C';
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(225, 48, 108, 0.12)' : '#FFF1F5';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                            e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <FaInstagram size={14} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {acct.name}
                              </div>
                              <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                                {acct.username} • Feed &amp; Reels
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '0.5625rem',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#E1306C',
                              color: '#FFFFFF',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              flexShrink: 0,
                            }}
                          >
                            <FiPlus size={10} /> Add Box
                          </span>
                        </div>
                      ))}

                    {isTiktok &&
                      managedTiktokAccounts.map((acct) => (
                        <div
                          key={acct.account_id}
                          onClick={() => {
                            handleConnectOrCreateDestination(fromNodeId, 'social_media', 'tiktok', {
                              id: acct.account_id,
                              name: acct.name,
                              username: acct.username,
                            });
                            setConnectDrawerNode(null);
                            setActiveModalNode(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.65rem',
                            borderRadius: '7px',
                            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                            backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#06B6D4';
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(6, 182, 212, 0.12)' : '#ECFEFF';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                            e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                backgroundColor: '#000000',
                                border: '1px solid #333333',
                                color: '#25F4EE',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <FaTiktok size={13} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {acct.name}
                              </div>
                              <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                                {acct.username} • Video &amp; Slides
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '0.5625rem',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#06B6D4',
                              color: '#FFFFFF',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              flexShrink: 0,
                            }}
                          >
                            <FiPlus size={10} /> Add Box
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </aside>
          );
        }

        const availableExistingNodes: Array<{ id: string; title: string; subtitle: string; icon: any; color: string }> = [];
        if (!isContent && !connectedTargetIds.has('get-content') && config.getContent.enabled) {
          availableExistingNodes.push({ id: 'get-content', title: 'Get Content', subtitle: 'Extract text & raw caption', icon: FiFileText, color: '#10B981' });
        }
        if (!isImages && !connectedTargetIds.has('get-images') && config.getImages.enabled) {
          availableExistingNodes.push({ id: 'get-images', title: 'Get Images', subtitle: 'Media & photo pipeline', icon: FiImage, color: '#06B6D4' });
        }
        config.aiBoxes.forEach((box) => {
          if (box.id !== fromNodeId && !connectedTargetIds.has(box.id)) {
            const isCrop = isWatermarkAIBox(box);
            const isEnh = isEnhanceAIBox(box, config.connections || []);
            const isTxtAI = isTextAIBox(box, config.connections);
            const isTxtFmt = isTextFormatAIBox(box);
            availableExistingNodes.push({
              id: box.id,
              title: box.title || 'AI Processor',
              subtitle: isCrop ? 'Format & watermark' : isEnh ? 'Photo enhancement' : isTxtAI ? 'AI Engine (Text Model)' : isTxtFmt ? 'Text Format Preset' : 'Text / copywriting',
              icon: isCrop ? FiScissors : isEnh ? FiCpu : isTxtFmt ? FiFileText : FiCpu,
              color: isCrop ? '#8B5CF6' : isEnh ? '#EC4899' : isTxtFmt ? '#6366F1' : '#3B82F6',
            });
          }
        });

        (config.combineBoxes || []).forEach((cb) => {
          if (cb.id !== fromNodeId && cb.enabled !== false && !connectedTargetIds.has(cb.id)) {
            availableExistingNodes.push({
              id: cb.id,
              title: cb.title || 'Combine Box',
              subtitle: 'Merge inputs into unified view',
              icon: FiGitMerge,
              color: '#F59E0B',
            });
          }
        });

        getNormalizedDestinations(config).forEach((dest) => {
          if (dest.enabled !== false && !connectedTargetIds.has(dest.id)) {
            const isDb = dest.storeInDatabase ?? (dest.targetMode !== 'social_media');
            const isSoc = dest.postToSocialMedia ?? (dest.targetMode !== 'remaining_posts');
            availableExistingNodes.push({
              id: dest.id,
              title: dest.title || (isSoc ? 'Facebook Post' : 'Remaining Posts Database'),
              subtitle: isSoc && isDb ? 'Social Media & Database' : isSoc ? 'Publish directly to Facebook Page' : 'Store in database queue',
              icon: isSoc ? FaFacebook : FiLayers,
              color: isSoc ? '#1877F2' : '#0EA5E9',
            });
          }
        });

        // Helper to connect wire to existing node
        const handleConnectToTarget = (targetId: string) => {
          const existing = (config.connections || []).some(
            (c) => c.fromNodeId === fromNodeId && c.toNodeId === targetId
          );
          if (!existing) {
            const newConn: WorkflowWireConnection = {
              id: `conn-${fromNodeId}-${targetId}`,
              fromNodeId: fromNodeId,
              toNodeId: targetId,
            };
            updateConfig({
              ...config,
              connections: [...(config.connections || []), newConn],
            });
          }
          setConnectDrawerNode(null);
          setActiveModalNode(null);
        };

        // Helper to disconnect wire
        const handleDisconnectWire = (connId: string) => {
          updateConfig({
            ...config,
            connections: (config.connections || []).filter((c) => c.id !== connId),
          });
        };

        const isModalWatermark = fromBox ? isWatermarkAIBox(fromBox) : false;
        const isModalImageBox = fromBox ? isImageAIBox(fromBox, config.connections) && !isModalWatermark : false;
        const currentModalAIBox = fromBox;
        const activeModalNode = { type: fromNodeType as any, id: fromNodeId, destinationId: fromNodeId };
        const isModalTextFormat = Boolean(
          activeModalNode.type === 'ai-box' &&
          currentModalAIBox &&
          !isModalWatermark &&
          !isModalImageBox &&
          isTextFormatAIBox(currentModalAIBox)
        );
        const isModalTextAI = Boolean(
          activeModalNode.type === 'ai-box' &&
          currentModalAIBox &&
          !isModalWatermark &&
          !isModalImageBox &&
          !isModalTextFormat
        );

        const getBaseDeleteConfig = (): { label: string; onClick: (e?: any) => void } | null => {
          if (!activeModalNode) return null;
          if (activeModalNode.type === 'trigger') {
            return {
              label: 'Delete Trigger Node',
              onClick: (e) => handleDeleteTrigger(e),
            };
          }
          if (activeModalNode.type === 'ai-box' && currentModalAIBox) {
            return {
              label: isModalWatermark
                ? 'Delete Watermark Node'
                : isModalImageBox
                ? 'Delete Image AI Node'
                : `Delete "${currentModalAIBox.title || 'AI'}" Node`,
              onClick: (e) => handleDeleteAIBox(currentModalAIBox.id, e),
            };
          }
          if (activeModalNode.type === 'get-content') {
            return {
              label: 'Delete "Get Content" Node',
              onClick: (e) => handleDeleteGetContent(e),
            };
          }
          if (activeModalNode.type === 'get-images') {
            return {
              label: 'Delete "Get Images" Node',
              onClick: (e) => handleDeleteGetImages(e),
            };
          }
          if (activeModalNode.type === 'destination') {
            const allDests = getNormalizedDestinations(config);
            const activeDestId = activeModalNode.destinationId || allDests[0]?.id || 'destination';
            const currentDest = allDests.find((d) => d.id === activeDestId) || allDests[0];
            return {
              label: `Delete "${currentDest?.title || 'Destination'}" Node`,
              onClick: (e) => handleDeleteDestination(e, activeDestId),
            };
          }
          if (activeModalNode.type === 'output') {
            return {
              label: 'Delete Output Node',
              onClick: (e) => handleDeleteOutputNode(e),
            };
          }
          if (activeModalNode.type === 'combine') {
            const cbId = (activeModalNode as any).combineId || (activeModalNode as any).id;
            const cb = (config.combineBoxes || []).find((b) => b.id === cbId);
            return {
              label: `Delete "${cb?.title || 'Combine Box'}" Node`,
              onClick: (e) => handleDeleteCombineBox(cbId, e),
            };
          }
          return null;
        };

        const baseDeleteConfig = getBaseDeleteConfig();

        return (
          <aside
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '380px',
              maxWidth: '100%',
              backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
              borderLeft: '1px solid var(--border-color)',
              boxShadow: isDark
                ? '-8px 0 28px rgba(0, 0, 0, 0.75)'
                : '-3px 0 16px rgba(0, 0, 0, 0.06)',
              zIndex: 170,
              display: 'flex',
              flexDirection: 'column',
              animation: 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderBottom: 'none',
                backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                <FiPlus size={20} color="#10B981" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: isDark ? '#F0F6FC' : '#0F172A',
                      lineHeight: 1.2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>Connect Next Step</span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.625rem',
                      color: '#10B981',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    From: {fromTitle}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConnectDrawerNode(null);
                  setActiveModalNode(null);
                }}
                aria-label="Close"
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                  backgroundColor: 'transparent',
                  color: isDark ? '#8B949E' : '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <FiX size={14} />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem',
                padding: '0.75rem',
              }}
            >
              {/* SECTION: Create & Connect New Processing Step */}
              <div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: isDark ? '#8B949E' : '#64748B',
                    marginBottom: '0.45rem',
                  }}
                >
                  Create & Wire New Step
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {/* Get Content / Get Images (restore missing ingestion nodes from the trigger) */}
                  {isTrigger &&
                    [
                      {
                        key: 'get-content',
                        show: !config.getContent.enabled,
                        title: '+ Get Content',
                        desc: 'Extract full text, specs & raw caption',
                        color: '#0EA5E9',
                        Icon: FiFileText,
                        onAdd: handleEnableGetContent,
                      },
                      {
                        key: 'get-images',
                        show: !config.getImages.enabled,
                        title: '+ Get Images',
                        desc: 'Extract all media & listing photos',
                        color: '#10B981',
                        Icon: FiImage,
                        onAdd: handleEnableGetImages,
                      },
                    ]
                      .filter((o) => o.show)
                      .map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => {
                            o.onAdd();
                            setConnectDrawerNode(null);
                            setActiveModalNode(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.55rem 0.65rem',
                            borderRadius: '7px',
                            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                            backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = o.color;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                          }}
                        >
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              backgroundColor: o.color,
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <o.Icon size={14} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                              {o.title}
                            </div>
                            <div style={{ fontSize: '0.5625rem', color: isDark ? '#8B949E' : '#64748B' }}>{o.desc}</div>
                          </div>
                          <FiArrowRight size={13} style={{ color: isDark ? '#8B949E' : '#94A3B8' }} />
                        </button>
                      ))}

                  {/* AI Model (Content AI Copywriter & Text Formatter) */}
                  {(isContent || isImages || isFromTextAI) && (
                    <button
                      type="button"
                      onClick={() => {
                        const newId = handleAddTextAIBox(fromNodeId);
                        setConnectDrawerNode(null);
                        setActiveModalNode({ type: 'ai-box', boxId: newId });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 0.65rem',
                        borderRadius: '7px',
                        border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                        backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#8B5CF6';
                        e.currentTarget.style.backgroundColor = isDark ? '#271F36' : '#F5F3FF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                        e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: '#8B5CF6',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FiMessageSquare size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                          + AI Model
                        </div>
                        <div style={{ fontSize: '0.5625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                          Format text with Gemini or OpenAI models
                        </div>
                      </div>
                      <FiArrowRight size={13} style={{ color: isDark ? '#8B949E' : '#94A3B8' }} />
                    </button>
                  )}

                  {/* Text Format Preset */}
                  {(isContent || isFromTextAI) && (
                    <button
                      type="button"
                      onClick={() => {
                        const newId = handleAddTextFormatBox(fromNodeId);
                        setConnectDrawerNode(null);
                        setActiveModalNode({ type: 'ai-box', boxId: newId });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 0.65rem',
                        borderRadius: '7px',
                        border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                        backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#6366F1';
                        e.currentTarget.style.backgroundColor = isDark ? '#1E1B4B' : '#EEF2FF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                        e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: '#6366F1',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FiFileText size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                          + Format Preset
                        </div>
                        <div style={{ fontSize: '0.5625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                          Apply saved prompt template & format rule
                        </div>
                      </div>
                      <FiArrowRight size={13} style={{ color: isDark ? '#8B949E' : '#94A3B8' }} />
                    </button>
                  )}

                  {/* Image Enhancer */}
                  {(isImages || isFromEnhance) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleAddAIBoxConnectedFromImages(fromNodeId);
                        setConnectDrawerNode(null);
                        setActiveModalNode(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 0.65rem',
                        borderRadius: '7px',
                        border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                        backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#EC4899';
                        e.currentTarget.style.backgroundColor = isDark ? '#2D1524' : '#FDF2F8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                        e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: '#EC4899',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FiImage size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                          + Image Enhancer
                        </div>
                        <div style={{ fontSize: '0.5625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                          AI HDR lighting, clarity & color restoration
                        </div>
                      </div>
                      <FiArrowRight size={13} style={{ color: isDark ? '#8B949E' : '#94A3B8' }} />
                    </button>
                  )}

                  {/* Studio Format / Watermark */}
                  {(isImages || isFromEnhance) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleAddWatermarkNodeConnectedFromImages(fromNodeId);
                        setConnectDrawerNode(null);
                        setActiveModalNode(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 0.65rem',
                        borderRadius: '7px',
                        border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                        backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#8B5CF6';
                        e.currentTarget.style.backgroundColor = isDark ? '#271F36' : '#F5F3FF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                        e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: '#8B5CF6',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FiScissors size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                          + Crop & Format Preset
                        </div>
                        <div style={{ fontSize: '0.5625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                          Apply saved aspect ratio and agency logo
                        </div>
                      </div>
                      <FiArrowRight size={13} style={{ color: isDark ? '#8B949E' : '#94A3B8' }} />
                    </button>
                  )}

                  {/* Post Output Box retired: Combine Box replaces it */}
                  {false && (
                    <button
                      type="button"
                      onClick={() => {
                        handleConnectOrCreateDestination(fromNodeId, 'hybrid');
                        setConnectDrawerNode(null);
                        setActiveModalNode(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 0.65rem',
                        borderRadius: '7px',
                        border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                        backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3B82F6';
                        e.currentTarget.style.backgroundColor = isDark ? '#1E293B' : '#EFF6FF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                        e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: '#3B82F6',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FiLayout size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                          + Post Output Box
                        </div>
                        <div style={{ fontSize: '0.5625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                          Preview studio & multi-destination router
                        </div>
                      </div>
                      <FiArrowRight size={13} style={{ color: isDark ? '#8B949E' : '#94A3B8' }} />
                    </button>
                  )}

                  {/* Combine Box (merge any inputs into one view) */}
                  <button
                    type="button"
                    onClick={() => {
                      const newCbId = handleAddCombineBox(fromNodeId);
                      setConnectDrawerNode(null);
                      setActiveModalNode({ type: 'combine', combineId: newCbId, id: newCbId });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '7px',
                      border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                      backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#F59E0B';
                      e.currentTarget.style.backgroundColor = isDark ? '#2A1F0D' : '#FFFBEB';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                      e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FiGitMerge size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                        + Combine Box
                      </div>
                      <div style={{ fontSize: '0.5625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                        Merge content, images & AI results into one view
                      </div>
                    </div>
                    <FiArrowRight size={13} style={{ color: isDark ? '#8B949E' : '#94A3B8' }} />
                  </button>
                </div>
              </div>

              {/* SECTION: Connect to Existing Canvas Nodes */}
              {availableExistingNodes.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: isDark ? '#8B949E' : '#64748B',
                      marginBottom: '0.45rem',
                    }}
                  >
                    Wire to Existing Canvas Nodes
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {availableExistingNodes.map((node) => {
                      const NodeIcon = node.icon;
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => handleConnectToTarget(node.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.55rem',
                            borderRadius: '6px',
                            border: isDark ? '1px solid #282E33' : '1px solid #E2E8F0',
                            backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = node.color;
                            e.currentTarget.style.transform = 'translateX(2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isDark ? '#282E33' : '#E2E8F0';
                            e.currentTarget.style.transform = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '5px',
                                backgroundColor: node.color,
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <NodeIcon size={12} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  color: isDark ? '#F0F6FC' : '#0F172A',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {node.title}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.5625rem',
                                  color: isDark ? '#8B949E' : '#64748B',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {node.subtitle}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              color: node.color,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                              flexShrink: 0,
                            }}
                          >
                            + Connect
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION: Connected Next Steps (With Disconnect Option) */}
              {outgoingConnections.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: isDark ? '#8B949E' : '#64748B',
                      marginBottom: '0.45rem',
                    }}
                  >
                    Active Outgoing Connections ({outgoingConnections.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {outgoingConnections.map((conn) => {
                      const targetBox = config.aiBoxes.find((b) => b.id === conn.toNodeId);
                      const allDests = getNormalizedDestinations(config);
                      const targetDest = allDests.find((d) => d.id === conn.toNodeId);
                      const targetCb = (config.combineBoxes || []).find((b) => b.id === conn.toNodeId);
                      const targetPage = targetDest ? managedPages.find((p) => p.page_id === (targetDest.selectedPageId || targetDest.selectedPageIds?.[0])) : null;
                      const targetName =
                        conn.toNodeId === 'get-content'
                          ? 'Get Content'
                          : conn.toNodeId === 'get-images'
                          ? 'Get Images'
                          : conn.toNodeId === 'output'
                          ? 'Post Output'
                          : targetDest
                          ? (targetDest.targetMode === 'remaining_posts'
                              ? 'Database (Remaining Posts)'
                              : targetDest.targetMode === 'hybrid'
                              ? 'Social & Database Storage'
                              : `Social Media${targetPage ? ` (${targetPage.name})` : ''}`)
                          : targetCb
                          ? (targetCb.title || 'Combine Box')
                          : targetBox?.title || conn.toNodeId;

                      return (
                        <div
                          key={conn.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.55rem',
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ECFDF5',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <FiCheck size={12} style={{ color: '#10B981', flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                color: isDark ? '#E6EDF3' : '#0F172A',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Connected to {targetName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDisconnectWire(conn.id)}
                            title="Disconnect wire"
                            style={{
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: '#EF4444',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION: Direct Destination Endpoints */}
              <div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: isDark ? '#8B949E' : '#64748B',
                    marginBottom: '0.45rem',
                  }}
                >
                  Direct Destination Routing
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {/* Store in DB */}
                  <button
                    type="button"
                    onClick={() => {
                      handleConnectOrCreateDestination(fromNodeId, 'remaining_posts');
                      setConnectDrawerNode(null);
                      setActiveModalNode(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '7px',
                      border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                      backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0284C7';
                      e.currentTarget.style.backgroundColor = isDark ? '#0C2A40' : '#F0F9FF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                      e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: '#0284C7',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FiLayers size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                        Store in Database
                      </div>
                      <div style={{ fontSize: '0.5625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                        Queue into Remaining Posts Database
                      </div>
                    </div>
                    <FiArrowRight size={13} style={{ color: isDark ? '#8B949E' : '#94A3B8' }} />
                  </button>
                  {/* POST OUTPUT PAYLOAD PREVIEW CARD (Displays contents and images payload inside destination sidebar) */}
                  {!isTrigger && (
                    <div
                      style={{
                        borderRadius: '8px',
                        border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.07)' : '#F5F3FF',
                        padding: '0.55rem 0.625rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <FiLayout size={12} color="#6366F1" />
                          <span style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Output Payload Preview
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!config.outputNode || config.outputNode.enabled === false) {
                              handleAddOutputNode();
                            }
                            setConnectDrawerNode(null);
                            setActiveModalNode({ type: 'output' });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: '#6366F1',
                            color: '#FFFFFF',
                            fontSize: '0.59375rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <FiEye size={10} />
                          <span>Open Full Studio</span>
                        </button>
                      </div>

                      {/* Text Excerpt */}
                      <div
                        style={{
                          fontSize: '0.625rem',
                          color: 'var(--text-secondary)',
                          lineHeight: '1.35',
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#FFFFFF',
                          borderRadius: '5px',
                          padding: '0.35rem 0.45rem',
                          maxHeight: '44px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          border: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #E2E8F0',
                        }}
                      >
                        {activeCopy || rawContent || 'No copy generated yet. Connect an AI content box.'}
                      </div>

                      {/* Image Strip */}
                      {compiledImages.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', overflowX: 'auto', paddingBottom: '2px' }}>
                          {compiledImages.slice(0, 5).map((img, i) => (
                            <div
                              key={img.index || i}
                              onClick={() => handleOpenLightbox(i)}
                              title="Click to preview full photo"
                              style={{
                                position: 'relative',
                                width: '34px',
                                height: '34px',
                                flexShrink: 0,
                                borderRadius: '4px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                              }}
                            >
                              <img src={img.finalUrl} alt={`Thumb ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              {img.isWatermarked && (
                                <div style={{ position: 'absolute', bottom: 1, right: 1, width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                              )}
                            </div>
                          ))}
                          {compiledImages.length > 5 && (
                            <div
                              onClick={() => handleOpenLightbox(5)}
                              title="Click to preview photo gallery"
                              style={{
                                width: '34px',
                                height: '34px',
                                flexShrink: 0,
                                borderRadius: '4px',
                                backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.59375rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              +{compiledImages.length - 5}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                          No images connected.
                        </div>
                      )}
                    </div>
                  )}
                  {/* Post to Social Media (Expandable File-System Drawer) */}
                  <button
                    type="button"
                    onClick={() => setIsSocialConnectDrawerExpanded(!isSocialConnectDrawerExpanded)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '7px',
                      border: isSocialConnectDrawerExpanded
                        ? '1.5px solid #E1306C'
                        : isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                      backgroundColor: isSocialConnectDrawerExpanded
                        ? (isDark ? 'rgba(225, 48, 108, 0.1)' : '#FFF1F5')
                        : (isDark ? '#1C2128' : '#F8FAFC'),
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#E1306C';
                      e.currentTarget.style.backgroundColor = isDark ? '#1F192E' : '#FFF1F5';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSocialConnectDrawerExpanded) {
                        e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                        e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                      }
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #1877F2 0%, #E1306C 50%, #000000 100%)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FiShare2 size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                        Post Directly to Social Media
                      </div>
                      <div style={{ fontSize: '0.5625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                        {isSocialConnectDrawerExpanded ? 'Select a platform below' : 'Choose Facebook, Instagram, or TikTok'}
                      </div>
                    </div>
                    <FiChevronDown
                      size={14}
                      style={{
                        color: isDark ? '#8B949E' : '#94A3B8',
                        transform: isSocialConnectDrawerExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  </button>

                  {/* Under are file open: Choose Social Media Platform */}
                  {isSocialConnectDrawerExpanded && (
                    <div
                      style={{
                        marginLeft: '0.65rem',
                        paddingLeft: '0.75rem',
                        borderLeft: `2px solid ${isDark ? '#30363D' : '#CBD5E1'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                        marginTop: '0.2rem',
                        marginBottom: '0.4rem',
                      }}
                    >
                      {/* 📘 FACEBOOK PLATFORM */}
                      <div
                        onClick={() => {
                          handleConnectOrCreateDestination(fromNodeId, 'social_media', 'facebook');
                          setConnectDrawerNode(null);
                          setActiveModalNode(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.6rem',
                          borderRadius: '6px',
                          border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#1877F2';
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(24, 119, 242, 0.12)' : '#EFF6FF';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                          e.currentTarget.style.backgroundColor = isDark ? '#161B22' : '#FFFFFF';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '5px',
                              backgroundColor: '#1877F2',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FaFacebook size={13} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Facebook
                            </div>
                            <div style={{ fontSize: '0.53125rem', color: 'var(--text-muted)' }}>
                              {managedPages.length} {managedPages.length === 1 ? 'page' : 'pages'} available
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '0.5625rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #1877F2',
                            backgroundColor: isDark ? 'rgba(24, 119, 242, 0.15)' : '#EFF6FF',
                            color: '#1877F2',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0,
                          }}
                        >
                          <FiPlus size={10} /> Facebook Box
                        </span>
                      </div>

                      {/* 📸 INSTAGRAM PLATFORM */}
                      <div
                        onClick={() => {
                          handleConnectOrCreateDestination(fromNodeId, 'social_media', 'instagram');
                          setConnectDrawerNode(null);
                          setActiveModalNode(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.6rem',
                          borderRadius: '6px',
                          border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#E1306C';
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(225, 48, 108, 0.12)' : '#FFF1F5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                          e.currentTarget.style.backgroundColor = isDark ? '#161B22' : '#FFFFFF';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '5px',
                              background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FaInstagram size={13} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Instagram
                            </div>
                            <div style={{ fontSize: '0.53125rem', color: 'var(--text-muted)' }}>
                              {managedIgAccounts.length} {managedIgAccounts.length === 1 ? 'account' : 'accounts'} available
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '0.5625rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #E1306C',
                            backgroundColor: isDark ? 'rgba(225, 48, 108, 0.15)' : '#FFF1F5',
                            color: '#E1306C',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0,
                          }}
                        >
                          <FiPlus size={10} /> Instagram Box
                        </span>
                      </div>

                      {/* 🎵 TIKTOK PLATFORM */}
                      <div
                        onClick={() => {
                          handleConnectOrCreateDestination(fromNodeId, 'social_media', 'tiktok');
                          setConnectDrawerNode(null);
                          setActiveModalNode(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.6rem',
                          borderRadius: '6px',
                          border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#06B6D4';
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(6, 182, 212, 0.12)' : '#ECFEFF';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                          e.currentTarget.style.backgroundColor = isDark ? '#161B22' : '#FFFFFF';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '5px',
                              backgroundColor: '#000000',
                              border: '1px solid #333333',
                              color: '#25F4EE',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FaTiktok size={12} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              TikTok
                            </div>
                            <div style={{ fontSize: '0.53125rem', color: 'var(--text-muted)' }}>
                              {managedTiktokAccounts.length} {managedTiktokAccounts.length === 1 ? 'account' : 'accounts'} available
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '0.5625rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #06B6D4',
                            backgroundColor: isDark ? 'rgba(6, 182, 212, 0.15)' : '#ECFEFF',
                            color: '#06B6D4',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0,
                          }}
                        >
                          <FiPlus size={10} /> TikTok Box
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dual Mode (DB + Social) */}
                  <button
                    type="button"
                    onClick={() => {
                      handleConnectOrCreateDestination(fromNodeId, 'hybrid');
                      setConnectDrawerNode(null);
                      setActiveModalNode(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '7px',
                      border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                      backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#2563EB';
                      e.currentTarget.style.backgroundColor = isDark ? '#172554' : '#EFF6FF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                      e.currentTarget.style.backgroundColor = isDark ? '#1C2128' : '#F8FAFC';
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #0284C7, #1877F2)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FiShare2 size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                        Dual Target (Social & Database)
                      </div>
                      <div style={{ fontSize: '0.5625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                        Save to database and post to Facebook
                      </div>
                    </div>
                    <FiArrowRight size={13} style={{ color: isDark ? '#8B949E' : '#94A3B8' }} />
                  </button>
                </div>
              </div>
            </div>

          </aside>
        );
      })()}



      {/* ======================================================== */}
      {/* DELETE CONFIRMATION MODAL                                */}
      {/* ======================================================== */}
      {/* NODE DELETE CONFIRMATION MODAL                            */}
      {/* ======================================================== */}
      {pendingDeleteBox && (() => {
        const isWatermark = isWatermarkAIBox(pendingDeleteBox);
        const isImage = isImageAIBox(pendingDeleteBox, config.connections) && !isWatermark;
        const modalTitle = isWatermark ? 'Delete Format Node' : isImage ? 'Delete Image Enhancer' : 'Delete AI Node';
        const modalSubtitle = isWatermark
          ? `${pendingDeleteBox.subtitle || '1200×1200 (1:1)'} · ${pendingDeleteBox.enabled !== false ? 'Active' : 'Disabled'}`
          : isImage
          ? `${pendingDeleteBox.model || 'Runware AI'} · ${pendingDeleteBox.enabled !== false ? 'Active' : 'Disabled'}`
          : `${getAIModelDisplayName(pendingDeleteBox.provider, pendingDeleteBox.model)} · ${pendingDeleteBox.enabled !== false ? 'Active' : 'Disabled'}`;

        

        return (
          <Modal
            isOpen={Boolean(pendingDeleteBox)}
            onClose={() => setPendingDeleteBox(null)}
            maxWidth="460px"
            zIndex={100200}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: '#EF4444' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FiAlertTriangle size={16} />
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                  {modalTitle}
                </span>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {isWatermark
                  ? 'Are you sure you want to delete this format preset node? It will be removed from your workflow pipeline.'
                  : 'Are you sure you want to delete this AI node? It will be removed from your workflow pipeline.'}
              </p>

              {/* Target Node Preview */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: isWatermark
                      ? 'rgba(139, 92, 246, 0.15)'
                      : isImage
                      ? 'rgba(16, 185, 129, 0.15)'
                      : isDark
                      ? '#1F2937'
                      : '#F1F5F9',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {renderAIBoxIcon(pendingDeleteBox, 20)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {pendingDeleteBox.title || (isWatermark ? 'Format Preset' : 'Dynamic AI Box')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {modalSubtitle}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  color: isDark ? '#60A5FA' : '#2563EB',
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FiRotateCcw size={13} />
                <span>You can restore this node anytime using the <strong>Recover</strong> button.</span>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Button variant="outline" size="sm" onClick={() => setPendingDeleteBox(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => confirmDeleteAIBox(pendingDeleteBox.id)}
                  style={{
                    backgroundColor: '#EF4444',
                    borderColor: '#EF4444',
                    color: '#FFFFFF',
                  }}
                >
                  Delete Node
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ======================================================== */}
      {/* CONNECTION DELETE CONFIRMATION MODAL                      */}
      {/* ======================================================== */}
      {pendingDeleteConnection && (
        <Modal
          isOpen={Boolean(pendingDeleteConnection)}
          onClose={() => setPendingDeleteConnection(null)}
          maxWidth="460px"
          zIndex={100200}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: '#EF4444' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FiAlertTriangle size={16} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                Delete Connection
              </span>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to delete this connection wire? The nodes will be disconnected.
            </p>

            {/* Target Connection Preview */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                gap: '0.75rem',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>From</div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {pendingDeleteConnection.fromTitle}
                </div>
              </div>
              <div style={{ color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FiArrowRight size={16} />
              </div>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>To</div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {pendingDeleteConnection.toTitle}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="outline" size="sm" onClick={() => setPendingDeleteConnection(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDeleteConnection}
                style={{
                  backgroundColor: '#EF4444',
                  borderColor: '#EF4444',
                  color: '#FFFFFF',
                }}
              >
                Delete Connection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* ADD STEP FROM TRIGGER MODAL                              */}
      {/* ======================================================== */}
      {isAddFromTriggerOpen && (
        <Modal
          isOpen={isAddFromTriggerOpen}
          onClose={() => setIsAddFromTriggerOpen(false)}
          maxWidth="440px"
          zIndex={100200}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  backgroundColor: '#1877F2',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(24, 119, 242, 0.35)',
                }}
              >
                <FaFacebook size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                  Connect Next Step
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Choose which process to connect from Facebook Post
                </div>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0' }}>
            {/* Option 1: Get Content */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                borderRadius: '8px',
                border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#3B82F6',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FiFileText size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Get Content
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    Extract text, price, specs, phone numbers & LINE ID
                  </div>
                </div>
              </div>
              {config.getContent.enabled ? (
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#10B981', padding: '4px 8px' }}>
                  ✓ Active
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    handleEnableGetContent();
                    setIsAddFromTriggerOpen(false);
                  }}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#3B82F6',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <FiPlus size={13} /> Connect
                </button>
              )}
            </div>
                    {/* Step 3: Multi-Destination Node Management (Hybrid Power) */}
                    {(() => {
                      const allDests = getNormalizedDestinations(config);
                      const destId = activeModalNode && activeModalNode.type === 'destination' ? activeModalNode.destinationId : '';
                      return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.1rem' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        All Destination Nodes ({allDests.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {allDests.map((d, dIdx) => {
                          const isCur = d.id === destId;
                          return (
                            <button
                              key={d.id || dIdx}
                              type="button"
                              onClick={() => {
                                setConnectDrawerNode(null);
                                setActiveModalNode({ type: 'destination', destinationId: d.id });
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: isCur ? '1.5px solid #2563EB' : isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                backgroundColor: isCur ? (isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF') : 'transparent',
                                color: isCur ? '#3B82F6' : 'var(--text-secondary)',
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <span>{d.title || `Node ${dIdx + 1}`}</span>
                              {isCur && <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#2563EB' }} />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Add Another Destination Button */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginTop: '0.2rem' }}>
                        <button
                          type="button"
                          onClick={() => handleAddDestinationNode('remaining_posts')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem',
                            height: '26px',
                            borderRadius: '5px',
                            border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                            backgroundColor: isDark ? 'rgba(2, 132, 199, 0.1)' : '#F0F9FF',
                            color: '#0284C7',
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <FiPlus size={11} />
                          <span>+ Database Node</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddDestinationNode('social_media')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem',
                            height: '26px',
                            borderRadius: '5px',
                            border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                            backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#EFF6FF',
                            color: '#2563EB',
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <FiPlus size={11} />
                          <span>+ Social Media Node</span>
                        </button>

                        {(!config.outputNode || config.outputNode.enabled === false) && (
                          <button
                            type="button"
                            onClick={() => handleAddOutputNode()}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.3rem',
                              height: '26px',
                              borderRadius: '5px',
                              border: '1px solid #6366F1',
                              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF',
                              color: isDark ? '#A5B4FC' : '#4F46E5',
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              gridColumn: '1 / -1',
                              marginTop: '0.15rem',
                            }}
                          >
                            <FiLayout size={11} />
                            <span>+ Add Output Box (Preview Studio)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
            {/* Option 2: Get Images */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                borderRadius: '8px',
                border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FiImage size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Get Images
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    Download HD photos, preserve photo order for enhancer
                  </div>
                </div>
              </div>
              {config.getImages.enabled ? (
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#10B981', padding: '4px 8px' }}>
                  ✓ Active
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    handleEnableGetImages();
                    setIsAddFromTriggerOpen(false);
                  }}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <FiPlus size={13} /> Connect
                </button>
              )}
            </div>

            {/* Option 3: Direct AI Model */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                borderRadius: '8px',
                border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#8B5CF6',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <SiGooglegemini size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    AI Copywriter Model
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    Generate rental copy, TikTok script or FB ad
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleAddAIBoxConnectedFromContent();
                  setIsAddFromTriggerOpen(false);
                }}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#8B5CF6',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <FiPlus size={13} /> Add
              </button>
            </div>

            {/* Option 4: Image Enhancer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                borderRadius: '8px',
                border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#EC4899',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FiSliders size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Image Studio & Enhancer
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    Upscale, auto-crop formats or add watermarks
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleAddAIBoxConnectedFromImages();
                  setIsAddFromTriggerOpen(false);
                }}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#EC4899',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <FiPlus size={13} /> Add
              </button>
            </div>

            {/* Direct Link to Facebook Drawer */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => {
                  setIsAddFromTriggerOpen(false);
                  setActiveModalNode({ type: 'trigger' });
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1877F2',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                Configure Facebook Page & Webhook Trigger →
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* Vertical Edge Sidebar Toggle Tab (Sleek rail along right edge - Exact Match to User Image 2) */}
      <button
        type="button"
        data-no-tooltip="true"
        onClick={() => {
          handleToggleGeneralSettings(!isRecoverModalOpen);
        }}
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          right: isRecoverModalOpen ? '380px' : '0px',
          zIndex: 160,
          width: '28px',
          minHeight: '92px',
          padding: '10px 2px',
          display: activeModalNode ? 'none' : 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          backgroundColor: isDark ? '#161B22' : '#1E293B',
          color: isDark ? '#E6EDF3' : '#F8FAFC',
          border: isDark ? '1px solid #30363D' : '1px solid #334155',
          borderRight: 'none',
          borderTopLeftRadius: '8px',
          borderBottomLeftRadius: '8px',
          borderTopRightRadius: '0px',
          borderBottomRightRadius: '0px',
          boxShadow: 'none',
          cursor: 'pointer',
          transition:
            'right 0.28s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = isDark ? '#21262D' : '#334155';
          e.currentTarget.style.borderColor = isDark ? '#484F58' : '#475569';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isDark ? '#161B22' : '#1E293B';
          e.currentTarget.style.borderColor = isDark ? '#30363D' : '#334155';
        }}
        title={isRecoverModalOpen ? 'Close General Settings' : 'Open General Settings'}
      >
        {/* Top Settings Icon - No background */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDark ? '#E6EDF3' : '#F8FAFC',
            flexShrink: 0,
          }}
        >
          <FiSliders
            size={13}
            style={{
              transform: isRecoverModalOpen ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.28s ease',
            }}
          />
        </div>

        {/* Vertical Text Label - Title case, not all capital letters */}
        <span
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: isDark ? '#E6EDF3' : '#F8FAFC',
            textTransform: 'none',
            userSelect: 'none',
            margin: '4px 0',
          }}
        >
          General
        </span>

        {/* Toggle Chevron Arrow */}
        <div style={{ color: isDark ? '#8B949E' : '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isRecoverModalOpen ? <FiChevronRight size={11} /> : <FiChevronLeft size={11} />}
        </div>
      </button>

      {/* RECOVER DELETED NODES SLIDE-OVER RIGHT SIDEBAR           */}
      {/* ======================================================== */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '380px',
          maxWidth: '100%',
          backgroundColor: 'var(--bg-main)',
          borderLeft: '1px solid var(--border-color)',
          boxShadow: isDark
            ? '-8px 0 30px rgba(0, 0, 0, 0.7)'
            : '-4px 0 20px rgba(0, 0, 0, 0.08)',
          zIndex: 150,
          display: (activeModalNode || connectDrawerNode) ? 'none' : 'flex',
          flexDirection: 'column',
          transform: isRecoverModalOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
          opacity: isRecoverModalOpen ? 1 : 0,
          pointerEvents: isRecoverModalOpen ? 'auto' : 'none',
        }}
      >
        {/* Simple Clean Header with Top-Right Close Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.75rem 1rem',
            borderBottom: 'none',
            flexShrink: 0,
            height: '46px',
            backgroundColor: 'var(--bg-main)',
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatName || 'Workflow Settings'}
          </span>
          <button
            type="button"
            onClick={() => handleToggleGeneralSettings(false)}
            title="Close"
            aria-label="Close"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              backgroundColor: 'transparent',
              color: isDark ? '#8B949E' : '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = isDark ? '#8B949E' : '#64748B';
            }}
          >
            <FiX size={14} />
          </button>
        </div>

        {/* Drawer Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Section 1: Workflow Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {onUseInFacebookImport && (
              <Button
                variant="primary"
                size="sm"
                onClick={onUseInFacebookImport}
                leftIcon={<FiArrowRight />}
                style={{
                  width: '100%',
                  height: '36px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  backgroundColor: '#1877F2',
                  borderColor: '#1877F2',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  boxShadow: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Use in Facebook Import
              </Button>
            )}

            <button
              type="button"
              onClick={onSaveFormat}
              style={{
                width: '100%',
                height: '34px',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 500,
                borderRadius: '6px',
                backgroundColor: isSaveSuccess
                  ? 'var(--status-success-bg, rgba(34, 197, 94, 0.12))'
                  : 'var(--bg-surface)',
                color: isSaveSuccess ? 'var(--status-success, #16a34a)' : 'var(--text-primary)',
                border: isSaveSuccess
                  ? '1px solid var(--status-success, #16a34a)'
                  : '1px solid var(--border-color)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSaveSuccess) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSaveSuccess) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }
              }}
            >
              {isSaveSuccess ? (
                <FiCheck size={13} style={{ color: 'var(--status-success, #16a34a)' }} />
              ) : (
                <FiSave size={13} style={{ color: 'var(--accent-primary)' }} />
              )}
              <span>{isSaveSuccess ? 'Format Saved!' : 'Save Format'}</span>
            </button>

            {/* Auto Save Toggle - Clean inline row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.25rem 0.25rem 0',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Auto-save changes
              </span>
              <ToggleSwitch
                checked={autoSave ?? true}
                onChange={(checked) => onToggleAutoSave?.(checked)}
                size="sm"
              />
            </div>
          </div>

          {/* Section 2: Canvas Tools (Undo & Reset Layout) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Canvas Tools
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                style={{
                  height: '32px',
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface)',
                  color: !canUndo ? 'var(--text-muted)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  cursor: !canUndo ? 'not-allowed' : 'pointer',
                  opacity: !canUndo ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (canUndo) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (canUndo) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <FiRotateCcw size={13} />
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={handleResetLayout}
                style={{
                  height: '32px',
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <FiCrosshair size={13} style={{ color: 'var(--accent-primary)' }} />
                <span>Reset Layout</span>
              </button>
            </div>
          </div>

          {/* Section 3: Deleted Nodes (Trash & Direct Restore) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.625rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Deleted Nodes
                </span>
                {deletedBoxes.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--accent-primary-alpha)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {deletedBoxes.length}
                  </span>
                )}
              </div>

              {deletedBoxes.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {deletedBoxes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRecoverSelected(new Set(deletedBoxes.map((d) => d.box.id)))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                    >
                      Restore All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Clear all deleted node history?')) {
                        setDeletedBoxes([]);
                        setSelectRecoverIds(new Set());
                        try {
                          localStorage.removeItem(LOCAL_STORAGE_DELETED_KEY);
                        } catch {}
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.6875rem',
                      cursor: 'pointer',
                      padding: '2px 4px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Deleted Nodes List */}
            {deletedBoxes.length === 0 ? (
              <div
                style={{
                  padding: '1.25rem 0.5rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                }}
              >
                No deleted nodes
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                {deletedBoxes.map((record) => (
                  <div
                    key={record.box.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.625rem',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    {/* Node Icon */}
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: isWatermarkAIBox(record.box)
                          ? 'rgba(139, 92, 246, 0.15)'
                          : isImageAIBox(record.box, record.connections)
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {renderAIBoxIcon(record.box, 14)}
                    </div>

                    {/* Title & Subtitle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {record.box.title || (isWatermarkAIBox(record.box) ? 'Format Preset' : 'Dynamic AI Box')}
                      </div>
                      <div
                        style={{
                          fontSize: '0.625rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {timeAgo(record.deletedAt)}
                      </div>
                    </div>

                    {/* Direct 1-Click Restore Button */}
                    <button
                      type="button"
                      onClick={() => handleRecoverSelected(new Set([record.box.id]))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        height: '26px',
                        padding: '0 8px',
                        borderRadius: '5px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--accent-primary-alpha)';
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.color = 'var(--accent-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      title="Restore to canvas"
                    >
                      <FiRotateCcw size={11} />
                      <span>Restore</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


      </div>

      {/* CONFIRMATION DIALOG / BOX FOR DELETIONS */}
      {deleteConfirmTarget && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            animation: 'fadeIn 0.15s ease-out',
          }}
          onClick={() => setDeleteConfirmTarget(null)}
        >
          <div
            style={{
              width: '90%',
              maxWidth: '380px',
              padding: '1.25rem',
              borderRadius: '12px',
              backgroundColor: isDark ? '#1C2128' : '#FFFFFF',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              boxShadow: isDark
                ? '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                : '0 20px 40px rgba(0, 0, 0, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.875rem',
              animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EF4444',
                  flexShrink: 0,
                }}
              >
                <FiTrash2 size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {deleteConfirmTarget.title}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Confirmation required
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {deleteConfirmTarget.description}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC';
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteConfirmTarget.onConfirm();
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#EF4444';
                }}
              >
                <FiTrash2 size={12} />
                <span>{deleteConfirmTarget.confirmText || 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Image Preview Modal - Exact Match to Second Image */}
      {lightboxImageIndex !== null && compiledImages.length > 0 && compiledImages[lightboxImageIndex] && (() => {
        const activeIdx = lightboxImageIndex;
        const activeImg = compiledImages[activeIdx];
        const activeImgUrl = activeImg.finalUrl;
        const totalImages = compiledImages.length;

        return createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Image Preview"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              userSelect: 'none',
              animation: 'fadeIn 0.15s ease',
            }}
            onClick={() => setLightboxImageIndex(null)}
          >
            {/* Top-Left: Image Counter Pill & Enhanced / Watermarked Badges */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 10,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(6px)',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  letterSpacing: '0.3px',
                }}
              >
                {activeIdx + 1} / {totalImages}
              </span>

              {activeImg.isEnhanced && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(0, 0, 0, 0.72)',
                    backdropFilter: 'blur(6px)',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <HiSparkles style={{ fontSize: '11px', color: '#FFFFFF' }} />
                  Enhanced
                </span>
              )}

              {activeImg.isWatermarked && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    backdropFilter: 'blur(6px)',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Watermarked
                </span>
              )}
            </div>

            {/* Top-Right: Close Button (Circle with X) */}
            <button
              type="button"
              onClick={() => setLightboxImageIndex(null)}
              aria-label="Close preview"
              title="Close (ESC)"
              style={{
                position: 'absolute',
                top: '20px',
                right: '24px',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; }}
            >
              <FiX style={{ fontSize: '18px' }} />
            </button>

            {/* Previous Navigation Arrow (Left side) */}
            {totalImages > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomScale(1);
                  setLightboxImageIndex((prev) => (prev! - 1 + totalImages) % totalImages);
                }}
                title="Previous photo (Left arrow)"
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

            {/* Next Navigation Arrow (Right side) */}
            {totalImages > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomScale(1);
                  setLightboxImageIndex((prev) => (prev! + 1) % totalImages);
                }}
                title="Next photo (Right arrow)"
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
            >
              <img
                src={activeImgUrl}
                alt={`Photo ${activeIdx + 1}`}
                style={{
                  maxWidth: '85vw',
                  maxHeight: '78vh',
                  objectFit: 'contain',
                  borderRadius: '16px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85)',
                  transform: `scale(${zoomScale})`,
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

              {/* Floating Toolbar Pill */}
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
                  onClick={() => setZoomScale((s) => Math.max(s - 0.25, 0.5))}
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
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <FiZoomOut style={{ fontSize: '15px' }} />
                </button>

                {/* Percentage / Reset Button */}
                <button
                  type="button"
                  onClick={() => setZoomScale(1)}
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
                >
                  {Math.round(zoomScale * 100)}%
                </button>

                {/* Zoom In */}
                <button
                  type="button"
                  onClick={() => setZoomScale((s) => Math.min(s + 0.25, 3))}
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
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <FiZoomIn style={{ fontSize: '15px' }} />
                </button>

                {/* Divider */}
                <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

                {/* Download Image Button */}
                <button
                  type="button"
                  onClick={(e) => handleDownloadImage(activeImgUrl, activeIdx, e)}
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
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <FiDownload style={{ fontSize: '15px' }} />
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
});

FacebookWorkflowCanvas.displayName = 'FacebookWorkflowCanvas';
