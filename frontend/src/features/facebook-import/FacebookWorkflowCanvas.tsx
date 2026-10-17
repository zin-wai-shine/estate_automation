import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
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
  FiX,
  FiAlertTriangle,
  FiEdit2,
  FiZap,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa';
import { SiGooglegemini } from 'react-icons/si';
import { AITrainingChatbot, ModelSelectorMenu, LaoZhangIcon, RunwareIcon } from './AITrainingChatbot';
import { useTheme } from '../../context/ThemeContext';
import { getAIModelDisplayName, isImageAIBox, isImageModel } from './aiModelUtils';
import { AIImageStudio } from './AIImageStudio';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';

export { getAIModelDisplayName };

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
  processType?: 'rental' | 'sale' | 'tiktok' | 'line_oa' | 'seo_tags' | 'custom' | string;
  provider: 'google_ai' | 'openai' | 'laozhang_ai' | 'runware_ai';
  model: string;
  templateId: string;
  templateText: string;
  customPrompt: string;
  enabled: boolean;
  strength?: number;
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
    x: number;
    y: number;
    autoImport: boolean;
  };
  destination: {
    x: number;
    y: number;
  };
  aiBoxes: DynamicAIBoxConfig[];
  connections?: WorkflowWireConnection[];
  zoom: number;
  panOffset: { x: number; y: number };
}

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

export const DEFAULT_FB_WORKFLOW_CONFIG: FacebookWorkflowConfig = {
  trigger: {
    x: 80,
    y: 220,
    autoImport: true,
  },
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
      title: 'TikTok Viral Hook & Script',
      processType: 'tiktok',
      provider: 'openai',
      model: 'gpt-4o',
      templateId: '2',
      templateText:
        'Create a viral 15-second TikTok script for this property.\nHook in the first 3 seconds, 3 quick visual highlights, and clear urgent call-to-action.',
      customPrompt: '',
      enabled: true,
      x: 640,
      y: 230,
    },
  ],
  connections: [
    { id: 'conn-content-rental', fromNodeId: 'get-content', toNodeId: 'ai-box-rental' },
    { id: 'conn-rental-dest', fromNodeId: 'ai-box-rental', toNodeId: 'destination' },
    { id: 'conn-content-tiktok', fromNodeId: 'get-content', toNodeId: 'ai-box-tiktok' },
    { id: 'conn-tiktok-dest', fromNodeId: 'ai-box-tiktok', toNodeId: 'destination' },
  ],
  destination: {
    x: 960,
    y: 220,
  },
  zoom: 0.95,
  panOffset: { x: 30, y: 30 },
};

/**
 * Resolves node collisions and ensures clean non-overlapping coordinates for all workflow nodes.
 */
export const sanitizeAndResolveCollisions = (
  conf: FacebookWorkflowConfig
): FacebookWorkflowConfig => {
  if (!conf) return DEFAULT_FB_WORKFLOW_CONFIG;

  const rawAiBoxes = Array.isArray(conf.aiBoxes) && conf.aiBoxes.length > 0
    ? conf.aiBoxes
    : DEFAULT_FB_WORKFLOW_CONFIG.aiBoxes;

  const placed: Array<{ x: number; y: number }> = [];

  const updatedAiBoxes = rawAiBoxes.map((b: any, idx: number) => {
    let x = typeof b.x === 'number' && !isNaN(b.x) && b.x > 0 ? b.x : 640;
    let y = typeof b.y === 'number' && !isNaN(b.y) && b.y > 0 ? b.y : (80 + idx * 150);

    // Check collision against all already placed AI nodes.
    // Circle size is 72px diameter and labels extend ~45px downwards.
    // Consider colliding if horizontal overlap < 100px and vertical overlap < 110px.
    const hasCollision = (currX: number, currY: number) =>
      placed.some(
        (p) => Math.abs(currX - p.x) < 100 && Math.abs(currY - p.y) < 110
      );

    while (hasCollision(x, y)) {
      y += 150;
    }

    placed.push({ x, y });
    return { ...b, x, y };
  });

  const updatedGetImages =
    !conf.getImages?.y || conf.getImages.y <= 350
      ? { ...conf.getImages, y: 390 }
      : conf.getImages;
  const updatedGetContent =
    !conf.getContent?.y || conf.getContent.y >= 120
      ? { ...conf.getContent, y: 110 }
      : conf.getContent;

  const validNodeIds = new Set([
    'trigger',
    'get-content',
    'get-images',
    'destination',
    ...updatedAiBoxes.map((b: any) => b.id),
  ]);

  let connections = Array.isArray(conf.connections)
    ? conf.connections.filter(
        (c: any) => c && validNodeIds.has(c.fromNodeId) && validNodeIds.has(c.toNodeId)
      )
    : undefined;

  if (!connections || connections.length === 0) {
    connections = [];
    updatedAiBoxes.forEach((b: any) => {
      connections!.push({ id: `conn-content-${b.id}`, fromNodeId: 'get-content', toNodeId: b.id });
      connections!.push({ id: `conn-${b.id}-dest`, fromNodeId: b.id, toNodeId: 'destination' });
    });
  }

  return {
    ...DEFAULT_FB_WORKFLOW_CONFIG,
    ...conf,
    getContent: { ...DEFAULT_FB_WORKFLOW_CONFIG.getContent, ...updatedGetContent },
    getImages: { ...DEFAULT_FB_WORKFLOW_CONFIG.getImages, ...updatedGetImages },
    trigger: { ...DEFAULT_FB_WORKFLOW_CONFIG.trigger, ...conf.trigger },
    destination: { ...DEFAULT_FB_WORKFLOW_CONFIG.destination, ...conf.destination },
    aiBoxes: updatedAiBoxes,
    connections,
  };
};

export const loadSavedFacebookWorkflowConfig = (): FacebookWorkflowConfig => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.getContent && parsed.getImages && Array.isArray(parsed.aiBoxes)) {
        let connections = Array.isArray(parsed.connections) ? parsed.connections : undefined;
        if (!connections) {
          connections = [];
          parsed.aiBoxes.forEach((b: any) => {
            connections.push({ id: `conn-content-${b.id}`, fromNodeId: 'get-content', toNodeId: b.id });
            connections.push({ id: `conn-${b.id}-dest`, fromNodeId: b.id, toNodeId: 'destination' });
          });
        }
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
  onSocketMouseDown?: (type: 'input' | 'output', e: React.MouseEvent) => void;
  onSocketMouseUp?: (type: 'input' | 'output', e: React.MouseEvent) => void;
  onSocketMouseEnter?: (type: 'input' | 'output') => void;
  onSocketMouseLeave?: (type: 'input' | 'output') => void;
}

const CANVAS_NODE_ACTION_CSS = `
.canvas-node::before{content:'';position:absolute;inset:-7px;border-radius:50%;border:1.5px dashed var(--ring,#388BFD);opacity:0;transform:scale(.88);transition:opacity .2s ease,transform .35s cubic-bezier(.34,1.56,.64,1);pointer-events:none}
.canvas-node:hover::before,
.canvas-node.is-hovered::before{opacity:.7;transform:scale(1);animation:nodeRingSpin 10s linear infinite}
.canvas-node.is-receptive::before{opacity:.5;border-color:var(--receptive-color,#D97706);transform:scale(1.02);animation:nodeRingSpin 8s linear infinite}
@keyframes nodeRingSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
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

export const MergedNodeShape: React.FC<MergedNodeShapeProps> = ({
  sockets,
  strokeColor,
  fillColor,
  strokeWidth = 2,
  strokeDasharray = 'none',
  socketDotColor,
  highlightInput = false,
  highlightOutput = false,
  isConnectedInput: _isConnectedInput = false,
  isConnectedOutput: _isConnectedOutput = false,
  hasReceiver = true,
  hasSource = false,
  onSocketMouseDown,
  onSocketMouseUp,
  onSocketMouseEnter,
  onSocketMouseLeave,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const resolvedFillColor = fillColor || (isDark ? '#161B22' : '#FFFFFF');
  const [hoveredSocket, setHoveredSocket] = useState<'input' | 'output' | null>(null);

  const isReceptiveInput = Boolean(highlightInput);
  const isReceptiveOutput = Boolean(highlightOutput);
  const isReceptive = isReceptiveInput || isReceptiveOutput;

  // An output socket displays an interactive NEXT arrow (→) whenever it can connect to downstream nodes
  const showNextArrow = Boolean(hasReceiver);

  // An input socket displays an interactive BACK arrow (←) whenever it can connect back to upstream nodes
  const showBackArrow = Boolean(hasSource);

  // Soft refined warm gold representing receptive connect state (reduced glow, gentle tint)
  const RECEPTIVE_COLOR = isDark ? '#EAB308' : '#D97706';
  const effectiveStrokeColor = isReceptive ? RECEPTIVE_COLOR : strokeColor;

  // Center is (36, 36), radius R = 35
  // Outer socket lobes have radius r = 11 (22px diameter), seamlessly merged with the 72px main circle
  let pathD = '';
  if (sockets === 'right') {
    pathD = 'M 69.27 25.14 A 11 11 0 1 1 69.27 46.86 A 35 35 0 1 1 69.27 25.14 Z';
  } else if (sockets === 'left') {
    pathD = 'M 2.73 46.86 A 11 11 0 1 1 2.73 25.14 A 35 35 0 1 1 2.73 46.86 Z';
  } else {
    // both left and right
    pathD = 'M 69.27 25.14 A 11 11 0 1 1 69.27 46.86 A 35 35 0 0 1 2.73 46.86 A 11 11 0 1 1 2.73 25.14 A 35 35 0 0 1 69.27 25.14 Z';
  }

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
          filter: isDark ? 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.45))' : 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))',
        }}
        viewBox="0 0 72 72"
      >
        <path
          d={pathD}
          fill={resolvedFillColor}
          stroke={effectiveStrokeColor}
          strokeWidth={isReceptive ? 2.5 : strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{
            transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
          }}
        />

        {/* ======================================================== */}
        {/* RIGHT OUTPUT SOCKET: NEXT ARROW (→) OR STATIC DOT (•)     */}
        {/* ======================================================== */}
        {(sockets === 'right' || sockets === 'both') && (
          <g>
            {isReceptiveOutput && (
              <circle
                cx="75"
                cy="36"
                r="8.5"
                fill={RECEPTIVE_COLOR}
                opacity="0.35"
              />
            )}
            {showNextArrow ? (
              <path
                d="M 70 36 L 78 36 M 74.5 32.5 L 78 36 L 74.5 39.5"
                fill="none"
                stroke={isReceptiveOutput ? RECEPTIVE_COLOR : (hoveredSocket === 'output' ? (isDark ? '#58A6FF' : '#0969DA') : strokeColor)}
                strokeWidth={isReceptiveOutput || hoveredSocket === 'output' ? 2.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
                }}
              />
            ) : (
              <circle
                cx="75"
                cy="36"
                r={isReceptiveOutput ? 6 : (hoveredSocket === 'output' ? 5.5 : 4.5)}
                fill={isReceptiveOutput ? RECEPTIVE_COLOR : (socketDotColor || strokeColor)}
                style={{
                  transition: 'r 0.15s ease, fill 0.15s ease',
                }}
              />
            )}
          </g>
        )}

        {/* ======================================================== */}
        {/* LEFT INPUT SOCKET: BACK ARROW (←) OR RECEPTIVE DOT (•)    */}
        {/* ======================================================== */}
        {(sockets === 'left' || sockets === 'both') && (
          <g>
            {isReceptiveInput && (
              <circle
                cx="-3"
                cy="36"
                r="8.5"
                fill={RECEPTIVE_COLOR}
                opacity="0.35"
              />
            )}
            {showBackArrow ? (
              <path
                d="M 1 36 L -7 36 M -3.5 32.5 L -7 36 L -3.5 39.5"
                fill="none"
                stroke={isReceptiveInput ? RECEPTIVE_COLOR : (hoveredSocket === 'input' ? (isDark ? '#58A6FF' : '#0969DA') : strokeColor)}
                strokeWidth={isReceptiveInput || hoveredSocket === 'input' ? 2.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
                }}
              />
            ) : (
              <circle
                cx="-3"
                cy="36"
                r={isReceptiveInput ? 6 : (hoveredSocket === 'input' ? 5.5 : 4.5)}
                fill={isReceptiveInput ? RECEPTIVE_COLOR : (socketDotColor || strokeColor)}
                style={{
                  transition: 'r 0.15s ease, fill 0.15s ease',
                }}
              />
            )}
          </g>
        )}
      </svg>

      {/* Right Output Socket Hitbox for drag-to-connect NEXT */}
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
            if (!showNextArrow) return;
            onSocketMouseDown?.('output', e);
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onSocketMouseUp?.('output', e);
          }}
          style={{
            position: 'absolute',
            right: '-16px',
            top: '18px',
            width: '32px',
            height: '36px',
            cursor: showNextArrow ? 'grab' : (isReceptiveOutput ? 'pointer' : 'default'),
            pointerEvents: 'auto',
            zIndex: 50,
            borderRadius: '0 16px 16px 0',
          }}
        />
      )}

      {/* Left Input Socket Hitbox for drag-to-connect BACK */}
      {(sockets === 'left' || sockets === 'both') && (
        <div
          className="socket-handle socket-handle-input"
          onMouseEnter={() => {
            setHoveredSocket('input');
            onSocketMouseEnter?.('input');
          }}
          onMouseLeave={() => {
            setHoveredSocket(null);
            onSocketMouseLeave?.('input');
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (!showBackArrow) return;
            onSocketMouseDown?.('input', e);
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onSocketMouseUp?.('input', e);
          }}
          style={{
            position: 'absolute',
            left: '-16px',
            top: '18px',
            width: '32px',
            height: '36px',
            cursor: showBackArrow ? 'grab' : (isReceptiveInput ? 'pointer' : 'default'),
            pointerEvents: 'auto',
            zIndex: 50,
            borderRadius: '16px 0 0 16px',
          }}
        />
      )}
    </div>
  );
};

export type ActiveModalNode =
  | { type: 'trigger' }
  | { type: 'get-content' }
  | { type: 'get-images' }
  | { type: 'ai-box'; boxId: string }
  | { type: 'destination' }
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
  getDeletedBoxesCount: () => number;
}

export interface FacebookWorkflowCanvasProps {
  initialConfig?: FacebookWorkflowConfig;
  onSwitchToLiveImport?: () => void;
  onConfigChange?: (config: FacebookWorkflowConfig) => void;
  allowEditPrompt?: boolean;
  onDeletedCountChange?: (count: number) => void;
  rawContent?: string;
  autoFormatBoxes?: Record<string, boolean>;
  onToggleBoxAutoFormat?: (boxId: string, checked: boolean) => void;
  autoEnhance?: boolean;
  onToggleAutoEnhance?: (checked: boolean) => void;
}

export const FacebookWorkflowCanvas = forwardRef<
  FacebookWorkflowCanvasRef,
  FacebookWorkflowCanvasProps
>(function FacebookWorkflowCanvas(
  {
    initialConfig,
    onConfigChange,
    allowEditPrompt = false,
    onDeletedCountChange,
    rawContent,
    autoFormatBoxes: propsAutoFormatBoxes,
    onToggleBoxAutoFormat: propsOnToggleBoxAutoFormat,
    autoEnhance: propsAutoEnhance,
    onToggleAutoEnhance: propsOnToggleAutoEnhance,
  },
  ref
) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const RECEPTIVE_COLOR = isDark ? '#EAB308' : '#D97706';
  const RECEPTIVE_GLOW = isDark
    ? 'drop-shadow(0 0 5px rgba(234, 179, 8, 0.35))'
    : 'drop-shadow(0 0 4px rgba(217, 119, 6, 0.22))';
  const [config, setConfig] = useState<FacebookWorkflowConfig>(() =>
    sanitizeAndResolveCollisions(initialConfig || loadSavedFacebookWorkflowConfig())
  );

  // Auto format state per box (synced with localStorage & parent)
  const [internalAutoFormat, setInternalAutoFormat] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('estate_fb_auto_format_boxes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Auto enhance state for photos (synced with localStorage & parent)
  const [internalAutoEnhance, setInternalAutoEnhance] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('estate_fb_auto_enhance');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  // Cross-component synchronizer
  useEffect(() => {
    const handleSync = () => {
      try {
        const savedFmt = localStorage.getItem('estate_fb_auto_format_boxes');
        if (savedFmt) setInternalAutoFormat(JSON.parse(savedFmt));
      } catch {}
      try {
        const savedEnh = localStorage.getItem('estate_fb_auto_enhance');
        if (savedEnh !== null) setInternalAutoEnhance(savedEnh === 'true');
      } catch {}
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('estate_fb_auto_settings_sync', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('estate_fb_auto_settings_sync', handleSync);
    };
  }, []);

  const autoFormatState = propsAutoFormatBoxes ?? internalAutoFormat;
  const autoEnhanceState = propsAutoEnhance ?? internalAutoEnhance;

  const handleToggleBoxAutoFormat = (boxId: string, checked: boolean) => {
    const next = { ...autoFormatState, [boxId]: checked };
    setInternalAutoFormat(next);
    try {
      localStorage.setItem('estate_fb_auto_format_boxes', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('estate_fb_auto_settings_sync'));
    } catch {}
    propsOnToggleBoxAutoFormat?.(boxId, checked);
  };

  const handleToggleAutoEnhance = (checked: boolean) => {
    setInternalAutoEnhance(checked);
    try {
      localStorage.setItem('estate_fb_auto_enhance', String(checked));
      window.dispatchEvent(new CustomEvent('estate_fb_auto_settings_sync'));
    } catch {}
    propsOnToggleAutoEnhance?.(checked);
  };

  const hasAnyAutoFormatActive = Object.values(autoFormatState).some(Boolean);

  const handleToggleAllAutoFormat = (checked: boolean) => {
    const next: Record<string, boolean> = { ...autoFormatState };
    config.aiBoxes.forEach((b) => {
      if (!isImageAIBox(b, config.connections)) {
        next[b.id] = checked;
        propsOnToggleBoxAutoFormat?.(b.id, checked);
      }
    });
    setInternalAutoFormat(next);
    try {
      localStorage.setItem('estate_fb_auto_format_boxes', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('estate_fb_auto_settings_sync'));
    } catch {}
  };

  useEffect(() => {
    if (initialConfig) {
      setConfig(sanitizeAndResolveCollisions(initialConfig));
    }
  }, [initialConfig]);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState<number>(-1);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Recovery and Deletion Confirmation State
  const [deletedBoxes, setDeletedBoxes] = useState<DeletedAIBoxRecord[]>(() => loadSavedDeletedBoxes());
  const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);
  const [selectRecoverIds, setSelectRecoverIds] = useState<Set<string>>(new Set());
  const [pendingDeleteBox, setPendingDeleteBox] = useState<DynamicAIBoxConfig | null>(null);
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
  const hoverLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const dragStartCoord = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  const handleCloseModal = () => {
    setActiveModalNode(null);
    setIsAISettingsDrawerOpen(false);
  };

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

  const canvasRef = useRef<HTMLDivElement>(null);

  // Sync to parent and localStorage
  const updateConfig = (newConfig: FacebookWorkflowConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {}
    if (onConfigChange) onConfigChange(newConfig);
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
      return socketType === 'output'
        ? { x: config.getContent.x + 75, y: config.getContent.y + HALF_CIRCLE }
        : { x: config.getContent.x - 3, y: config.getContent.y + HALF_CIRCLE };
    }
    if (nodeId === 'get-images') {
      return socketType === 'output'
        ? { x: config.getImages.x + 75, y: config.getImages.y + HALF_CIRCLE }
        : { x: config.getImages.x - 3, y: config.getImages.y + HALF_CIRCLE };
    }
    if (nodeId === 'destination') {
      return { x: config.destination.x - 3, y: config.destination.y + HALF_CIRCLE };
    }
    const box = config.aiBoxes.find((b) => b.id === nodeId);
    if (box) {
      return socketType === 'output'
        ? { x: box.x + 75, y: box.y + HALF_CIRCLE }
        : { x: box.x - 3, y: box.y + HALF_CIRCLE };
    }
    return { x: 0, y: 0 };
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
    if ((nodeA === 'get-images' && nodeB === 'destination') || (nodeA === 'destination' && nodeB === 'get-images')) return true;
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
    if (nodeId === 'destination') return true; // endpoint stays ready
    if (nodeId === 'get-content') return Boolean(config.getContent.enabled);
    if (nodeId === 'get-images') return Boolean(config.getImages.enabled);

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

    // Disallow connections originating from disabled nodes
    if (!isNodeEffectivelyEnabled(fromId)) {
      return false;
    }

    // Reject if already connected in either direction
    if (isAlreadyConnected(fromId, toId)) {
      return false;
    }

    const conns = config.connections || [];

    // Step 1: trigger -> get-content or get-images (already statically connected)
    if (fromId === 'trigger') {
      return false;
    }

    // Step 2: get-content -> dynamic AI copywriting nodes
    if (fromId === 'get-content') {
      if (!toId.startsWith('ai-box-')) return false;
      const targetBox = config.aiBoxes.find((b) => b.id === toId);
      if (!targetBox) return false;
      // Cannot connect if already connected to get-images
      const isConnectedToImages = conns.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === toId);
      if (isConnectedToImages) return false;
      const alreadyHasInput = conns.some((c) => c.toNodeId === toId);
      return !alreadyHasInput;
    }

    // Step 2b: get-images -> dynamic AI image enhancer nodes
    if (fromId === 'get-images') {
      if (!toId.startsWith('ai-box-')) return false;
      const targetBox = config.aiBoxes.find((b) => b.id === toId);
      if (!targetBox) return false;
      // Cannot connect if already connected to get-content
      const isConnectedToContent = conns.some((c) => c.fromNodeId === 'get-content' && c.toNodeId === toId);
      if (isConnectedToContent) return false;
      const alreadyHasInput = conns.some((c) => c.toNodeId === toId);
      return !alreadyHasInput;
    }

    // Step 3: dynamic AI nodes -> destination ONLY
    // An AI node cannot connect to other AI nodes (neither the same copywriter type nor the image enhancer below it).
    // It can ONLY connect forward to the final Property Inbox destination!
    if (fromId.startsWith('ai-box-')) {
      if (toId === 'destination') {
        const alreadyConnectedToDest = conns.some(
          (c) => c.fromNodeId === fromId && c.toNodeId === 'destination'
        );
        return !alreadyConnectedToDest;
      }
      return false;
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

    // Trigger has static connections and cannot initiate dragging
    if (nodeId === 'trigger') return;

    // Start dragging a new wire from this socket
    setHoveredOutputNodeId(null);
    dragWireStartTime.current = Date.now();
    const pos = getNodeSocketPos(nodeId, socketType);
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
      updateConfig({
        ...config,
        aiBoxes: updatedBoxes,
        connections: [...currentConnections, newConn],
      });
    }
    setDragWire(null);
  };

  const handleRemoveConnection = (connId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newConnections = (config.connections || []).filter((c) => c.id !== connId);
    updateConfig({
      ...config,
      connections: newConnections,
    });
  };

  // Add Dynamic AI Box directly connected from Get Content ("for text modified and that connect with that")
  const handleAddAIBoxConnectedFromContent = (templateOverride?: CanvasPromptOption) => {
    const prompts = loadAvailablePromptTemplates();
    const boxCount = config.aiBoxes.length;
    const maxY = config.aiBoxes.reduce((max, b) => Math.max(max, b.y), 0);
    const newY = boxCount === 0 ? 120 : Math.max(maxY + 150, 80 + boxCount * 150);

    // Pick next prompt template from library
    const chosenTemplate =
      templateOverride ||
      (prompts.length > 0 ? prompts[boxCount % prompts.length] : undefined);

    const newId = `ai-box-${Date.now()}`;
    const newBox: DynamicAIBoxConfig = {
      id: newId,
      title: chosenTemplate ? chosenTemplate.name : `AI Text Modifier #${boxCount + 1}`,
      provider: boxCount % 2 === 0 ? 'google_ai' : 'openai',
      model: boxCount % 2 === 0 ? 'gemini-flash-latest' : 'gpt-4o',
      templateId: chosenTemplate ? String(chosenTemplate.id) : 'custom',
      templateText: chosenTemplate
        ? chosenTemplate.templateText
        : 'Generate optimized marketing copy for this property listing.\nHighlight rent/sale price, transit access, and clear call-to-action.',
      customPrompt: '',
      enabled: true,
      x: 640,
      y: newY,
    };

    // Automatically connect Get Content -> this new AI node
    const newConn: WorkflowWireConnection = {
      id: `conn-content-${newId}`,
      fromNodeId: 'get-content',
      toNodeId: newId,
    };

    const nextBoxes = [...config.aiBoxes, newBox];
    const nextConns = [...(config.connections || []), newConn];
    updateConfig(buildAlignedLayout(nextBoxes, nextConns, { ...config, aiBoxes: nextBoxes, connections: nextConns }));
    setSelectedBoxId(newId);
  };

  // Add Dynamic Image AI Box connected from Get Images
  const handleAddAIBoxConnectedFromImages = () => {
    const boxCount = config.aiBoxes.length;
    const maxY = config.aiBoxes.reduce((max, b) => Math.max(max, b.y), 0);
    const newY = boxCount === 0 ? 360 : Math.max(maxY + 150, 260 + boxCount * 140);

    const newId = `ai-box-${Date.now()}`;
    const newBox: DynamicAIBoxConfig = {
      id: newId,
      title: `Image Enhancer #${boxCount + 1}`,
      processType: 'image_enhance',
      provider: 'runware_ai',
      model: 'runware:101@1',
      templateId: 'image-hdr',
      templateText:
        'Enhance real estate property photo: clean natural lighting, architectural clarity, realistic interior staging, ultra sharp 8k detail.',
      customPrompt: 'Real estate interior luxury enhancement, warm lighting, high detail, remove noise',
      enabled: true,
      x: 640,
      y: newY,
    };

    // Automatically connect Get Images -> this new AI image node
    const newConn: WorkflowWireConnection = {
      id: `conn-images-${newId}`,
      fromNodeId: 'get-images',
      toNodeId: newId,
    };

    const nextBoxes = [...config.aiBoxes, newBox];
    const nextConns = [...(config.connections || []), newConn];
    updateConfig(buildAlignedLayout(nextBoxes, nextConns, { ...config, aiBoxes: nextBoxes, connections: nextConns }));
    setSelectedBoxId(newId);
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
      provider: boxCount % 2 === 0 ? 'google_ai' : 'openai',
      model: boxCount % 2 === 0 ? 'gemini-flash-latest' : 'gpt-4o',
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
      setPendingDeleteBox(null);
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
    const newConnections = (config.connections || []).filter(
      (c) => c.fromNodeId !== id && c.toNodeId !== id
    );
    const newConfig = {
      ...config,
      aiBoxes: newBoxes,
      connections: newConnections,
    };
    updateConfig(newConfig);

    if (selectedBoxId === id) setSelectedBoxId(null);
    if (activeModalNode?.type === 'ai-box' && activeModalNode.boxId === id) {
      setActiveModalNode(null);
    }
    setPendingDeleteBox(null);
  };

  // Delete Dynamic AI Box - asks confirmation dialog with checkbox unless remembered
  const handleDeleteAIBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (config.aiBoxes.length <= 1) {
      alert('You must have at least one AI process box in the workflow.');
      return;
    }
    const box = config.aiBoxes.find((b) => b.id === id);
    if (!box) return;

    if (dontAskDeleteAgain) {
      confirmDeleteAIBox(id);
    } else {
      setPendingDeleteBox(box);
    }
  };

  // Recover selected deleted boxes back onto canvas
  const handleRecoverSelected = () => {
    if (selectRecoverIds.size === 0) return;

    const recordsToRestore = deletedBoxes.filter((r) => selectRecoverIds.has(r.box.id));
    if (recordsToRestore.length === 0) return;

    let maxY = config.aiBoxes.reduce((max, b) => Math.max(max, b.y), 60);
    const restoredBoxes: DynamicAIBoxConfig[] = [];
    const restoredConns: WorkflowWireConnection[] = [];
    const existingIds = new Set(config.aiBoxes.map((b) => b.id));

    recordsToRestore.forEach((record) => {
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
    updateConfig(buildAlignedLayout(nextBoxes, nextConns, { ...config, aiBoxes: nextBoxes, connections: nextConns }));

    const remaining = deletedBoxes.filter((r) => !selectRecoverIds.has(r.box.id));
    setDeletedBoxes(remaining);
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(remaining));
    } catch {}

    setSelectRecoverIds(new Set());
    setIsRecoverModalOpen(false);
  };

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
    const newConfig = {
      ...config,
      aiBoxes: [...config.aiBoxes, duplicated],
    };
    updateConfig(newConfig);
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
    updateConfig({ ...config, aiBoxes: newBoxes });
  };

  // Auto-layout: stacks AI nodes in one clean column grouped by their source
  // (Get Content first, then Get Images, then unconnected) and vertically centers
  // the source / trigger / destination nodes on their groups.
  const buildAlignedLayout = (
    boxes: DynamicAIBoxConfig[],
    connections: WorkflowWireConnection[] | undefined,
    base: FacebookWorkflowConfig
  ): FacebookWorkflowConfig => {
    const conns = connections || [];
    const fromContent = (id: string) => conns.some((c) => c.fromNodeId === 'get-content' && c.toNodeId === id);
    const fromImages = (id: string) => conns.some((c) => c.fromNodeId === 'get-images' && c.toNodeId === id);

    const contentBoxes = boxes.filter((b) => fromContent(b.id));
    const imageBoxes = boxes.filter((b) => !fromContent(b.id) && fromImages(b.id));
    const otherBoxes = boxes.filter((b) => !fromContent(b.id) && !fromImages(b.id));

    const ROW_GAP = 150;
    const TOP = 80;
    const yById: Record<string, number> = {};
    let row = 0;
    [contentBoxes, imageBoxes, otherBoxes].forEach((group) =>
      group.forEach((b) => {
        yById[b.id] = TOP + row * ROW_GAP;
        row += 1;
      })
    );

    const mean = (list: DynamicAIBoxConfig[], fallback: number) =>
      list.length ? list.reduce((sum, b) => sum + yById[b.id], 0) / list.length : fallback;
    const contentMid = mean(contentBoxes, TOP);
    const imageMid = mean(imageBoxes, TOP + Math.max(contentBoxes.length, 1) * ROW_GAP);
    const centerMid = (contentMid + imageMid) / 2;

    return {
      ...base,
      aiBoxes: boxes.map((b) => ({ ...b, x: 640, y: yById[b.id] })),
      trigger: { ...base.trigger, x: 80, y: Math.round(centerMid) },
      getContent: { ...base.getContent, x: 340, y: Math.round(contentMid) },
      getImages: { ...base.getImages, x: 340, y: Math.round(imageMid) },
      destination: { x: 960, y: Math.round(centerMid) },
    };
  };

  // Reset Layout to pristine aligned grid with clean base and gaps
  const handleResetLayout = () => {
    const resetConfig = buildAlignedLayout(config.aiBoxes, config.connections, config);
    updateConfig({ ...resetConfig, zoom: 0.95, panOffset: { x: 30, y: 30 } });
  };

  useImperativeHandle(
    ref,
    () => ({
      addAIBox: (templateOverride) => handleAddAIBox(templateOverride),
      resetLayout: () => handleResetLayout(),
      openRecoverModal: () => {
        setIsRecoverModalOpen(true);
      },
      getDeletedBoxesCount: () => deletedBoxes.length,
    }),
    [config, deletedBoxes]
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

  // Canvas Mouse & Drag Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-node') || (e.target as HTMLElement).closest('.canvas-control')) {
      return;
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
      } else if (draggedNodeId === 'destination') {
        setConfig((prev) => ({
          ...prev,
          destination: { ...prev.destination, x: prev.destination.x + deltaX, y: prev.destination.y + deltaY },
        }));
      } else if (draggedNodeId.startsWith('ai-box-')) {
        setConfig((prev) => ({
          ...prev,
          aiBoxes: prev.aiBoxes.map((b) =>
            b.id === draggedNodeId ? { ...b, x: b.x + deltaX, y: b.y + deltaY } : b
          ),
        }));
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
    setDraggedNodeId(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
    dragStartCoord.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;
  };

  const handleNodeClick = (node: ActiveModalNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMoved.current) {
      setActiveModalNode(node);
    }
  };

  // Bezier curve generator
  const createBezierPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const dx = Math.abs(end.x - start.x);
    const controlOffset = Math.max(dx * 0.45, 40);
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

  // Unified Single Sockets for wires (anchoring at the center of the protruding socket tabs)
  const triggerOut = { x: config.trigger.x + 75, y: config.trigger.y + HALF_CIRCLE };

  const contentIn = { x: config.getContent.x - 3, y: config.getContent.y + HALF_CIRCLE };
  const contentOut = { x: config.getContent.x + 75, y: config.getContent.y + HALF_CIRCLE };

  const imagesIn = { x: config.getImages.x - 3, y: config.getImages.y + HALF_CIRCLE };
  const imagesOut = { x: config.getImages.x + 75, y: config.getImages.y + HALF_CIRCLE };

  const destIn = { x: config.destination.x - 3, y: config.destination.y + HALF_CIRCLE };

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
        {/* Floating Automations Control Bar (Auto Format & Auto Enhance) */}
        <div
          className="canvas-control"
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: isDark ? 'rgba(22, 27, 34, 0.9)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            padding: '5px 12px',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.45)' : '0 4px 16px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FiZap style={{ color: '#F59E0B', fontSize: '13px' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Auto Actions:
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: hasAnyAutoFormatActive
                ? (isDark ? 'rgba(56, 139, 253, 0.15)' : 'rgba(56, 139, 253, 0.08)')
                : 'transparent',
              transition: 'background-color 0.2s ease',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: hasAnyAutoFormatActive ? '#388BFD' : 'var(--text-muted)',
              }}
            >
              Auto Format
            </span>
            <ToggleSwitch
              checked={hasAnyAutoFormatActive}
              onChange={handleToggleAllAutoFormat}
              size="sm"
              activeColor="#388BFD"
            />
          </div>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: autoEnhanceState
                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)')
                : 'transparent',
              transition: 'background-color 0.2s ease',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: autoEnhanceState ? '#10B981' : 'var(--text-muted)',
              }}
            >
              Auto Enhance
            </span>
            <ToggleSwitch
              checked={autoEnhanceState}
              onChange={handleToggleAutoEnhance}
              size="sm"
              activeColor="#10B981"
            />
          </div>
        </div>

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
            onClick={() => setConfig((prev) => ({ ...prev, zoom: 0.95, panOffset: { x: 30, y: 30 } }))}
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
            {(() => {
              const path = createBezierPath(triggerOut, contentIn);
              const isFlowing = config.getContent.enabled;
              return (
                <path
                  key="wire-trigger-content"
                  d={path}
                  fill="none"
                  stroke={isFlowing ? '#388BFD' : (isDark ? '#30363D' : '#CBD5E1')}
                  strokeWidth="2"
                  strokeDasharray={isFlowing ? '8, 8' : 'none'}
                  strokeLinecap="round"
                  style={{
                    animation: isFlowing ? 'n8nFlow 1.2s linear infinite' : 'none',
                  }}
                />
              );
            })()}

            {/* 2. Trigger -> Get Images Line */}
            {(() => {
              const path = createBezierPath(triggerOut, imagesIn);
              const isFlowing = config.getImages.enabled;
              return (
                <path
                  key="wire-trigger-images"
                  d={path}
                  fill="none"
                  stroke={isFlowing ? '#2EA043' : (isDark ? '#30363D' : '#CBD5E1')}
                  strokeWidth="2"
                  strokeDasharray={isFlowing ? '8, 8' : 'none'}
                  strokeLinecap="round"
                  style={{
                    animation: isFlowing ? 'n8nFlow 1.2s linear infinite' : 'none',
                  }}
                />
              );
            })()}

            {/* 3. Get Images -> Destination Line (only when not branching through AI Image nodes) */}
            {(() => {
              const hasImageAIBranch = (config.connections || []).some((c) => c.fromNodeId === 'get-images');
              if (hasImageAIBranch) return null;
              const path = createBaseChannelPath(imagesOut, destIn);
              const isFlowing = config.getImages.enabled;
              return (
                <path
                  key="wire-images-dest"
                  d={path}
                  fill="none"
                  stroke={isFlowing ? '#2EA043' : (isDark ? '#30363D' : '#CBD5E1')}
                  strokeWidth="2"
                  strokeDasharray={isFlowing ? '8, 8' : 'none'}
                  strokeLinecap="round"
                  style={{
                    animation: isFlowing ? 'n8nFlow 1.2s linear infinite' : 'none',
                  }}
                />
              );
            })()}

            {/* Dynamic AI / Workflow Connections from config.connections */}
            {(config.connections || []).map((conn) => {
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
                conn.fromNodeId === 'get-images' && conn.toNodeId === 'destination'
                  ? createBaseChannelPath(fromPos, toPos)
                  : createBezierPath(fromPos, toPos);

              const fromEnabled = isNodeEffectivelyEnabled(conn.fromNodeId);
              const toEnabled = isNodeEffectivelyEnabled(conn.toNodeId);
              const isFlowing = fromEnabled && toEnabled;
              const isWireHovered = hoveredWireId === conn.id;
              const isXHovered = hoveredXId === conn.id;

              const isFromImages = conn.fromNodeId === 'get-images' || (
                (config.connections || []).some((c) => c.fromNodeId === 'get-images' && c.toNodeId === conn.fromNodeId)
              );
              const wireStrokeColor = isXHovered
                ? '#F85149'
                : isFlowing
                ? (isFromImages ? '#10B981' : '#A371F7')
                : (isDark ? '#30363D' : '#CBD5E1');

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
                  {/* Visual dashed flowing wire */}
                  <path
                    d={path}
                    fill="none"
                    stroke={wireStrokeColor}
                    strokeWidth={isXHovered ? '2.5' : isWireHovered ? '2.25' : '2'}
                    strokeDasharray={isFlowing ? '8, 8' : 'none'}
                    strokeLinecap="round"
                    style={{
                      animation: isFlowing ? 'n8nFlow 1.2s linear infinite' : 'none',
                      transition: 'stroke 0.18s ease, stroke-width 0.18s ease',
                      filter: isXHovered ? 'drop-shadow(0 0 6px rgba(248, 81, 73, 0.65))' : 'none',
                    }}
                  />
                  {/* Disconnect indicator on hover - only active when connection is enabled ("if that disabled these action are not work too") */}
                  {isWireHovered && isFlowing && (
                    <g
                      transform={`translate(${midX}, ${midY})`}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredXId(conn.id)}
                      onMouseLeave={() => setHoveredXId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveConnection(conn.id, e);
                      }}
                    >
                      {/* Generous hit area circle for easy, accurate clicking */}
                      <circle r="16" fill="transparent" />
                      <circle
                        r={isXHovered ? 12 : 10}
                        fill="#F85149"
                        stroke={isDark ? "#161B22" : "#FFFFFF"}
                        strokeWidth="2"
                        style={{
                          transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          filter: isXHovered
                            ? 'drop-shadow(0 0 8px rgba(248, 81, 73, 0.85))'
                            : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25))',
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

              let wireColor = '#A371F7';
              if (dragWire.fromNodeId === 'get-content') wireColor = '#388BFD';
              else if (dragWire.fromNodeId === 'get-images') wireColor = '#2EA043';
              else if (dragWire.fromNodeId.startsWith('ai-box-')) {
                const box = config.aiBoxes.find((b) => b.id === dragWire.fromNodeId);
                wireColor = box?.provider === 'runware_ai' ? '#10B981' : box?.provider === 'laozhang_ai' ? '#3B82F6' : box?.provider === 'google_ai' ? '#388BFD' : '#2EA043';
              }

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
                      filter: `drop-shadow(0 0 6px ${wireColor}99)`,
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
          {/* NODE 1: FACEBOOK URL IMPORTER (TRIGGER CIRCLE)           */}
          {/* ======================================================== */}
          <div
            className={`canvas-node ${hoveredNodeId === 'trigger' ? 'is-hovered' : ''}`}
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
              strokeColor="#388BFD"
              socketDotColor="#388BFD"
              isConnectedOutput={true}
              highlightOutput={false}
              hasReceiver={false}
              onSocketMouseDown={(type, e) => handleSocketMouseDown('trigger', type, e)}
              onSocketMouseUp={(type, e) => handleSocketMouseUp('trigger', type, e)}
            />
            <FaFacebook style={{ fontSize: '30px', color: '#1877F2', position: 'relative', zIndex: 2 }} />

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
                Facebook Post
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                Trigger · Auto
              </span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* NODE 2A: GET CONTENT BRANCH (CIRCLE)                     */}
          {/* ======================================================== */}
          {(() => {
            const isContentReceptive = Boolean(
              activeConnectingTargetId && isValidConnection('get-content', activeConnectingTargetId)
            );

            return (
              <div
                className={`canvas-node ${hoveredNodeId === 'get-content' ? 'is-hovered' : ''} ${isContentReceptive ? 'is-receptive' : ''}`}
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
                  ['--ring' as any]: isContentReceptive ? RECEPTIVE_COLOR : '#388BFD',
                  ['--receptive-color' as any]: RECEPTIVE_COLOR,
                  opacity: config.getContent.enabled ? 1 : 0.6,
                  zIndex: isContentReceptive ? 35 : hoveredNodeId === 'get-content' ? 25 : 15,
                  cursor: isContentReceptive ? 'crosshair' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: isContentReceptive ? RECEPTIVE_GLOW : undefined,
                  transition: 'filter 0.2s ease, transform 0.2s ease',
                }}
              >
                <MergedNodeShape
                  sockets="both"
                  strokeColor={isContentReceptive ? RECEPTIVE_COLOR : config.getContent.enabled ? '#388BFD' : '#30363D'}
                  socketDotColor={isContentReceptive ? RECEPTIVE_COLOR : config.getContent.enabled ? '#388BFD' : '#484F58'}
                  isConnectedInput={true}
                  isConnectedOutput={isContentOutputConnected}
                  highlightInput={false}
                  highlightOutput={isContentReceptive}
                  hasReceiver={contentHasReceiver}
                  hasSource={false}
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
                    fontSize: '28px',
                    color: config.getContent.enabled ? '#58A6FF' : '#8B949E',
                    position: 'relative',
                    zIndex: 2,
                  }}
                />

                {/* Hover: animated plus to add + connect a node with seamless hover bridge */}
                {config.getContent.enabled && (
                  <div
                    className="node-hit"
                    onMouseEnter={() => handleNodeMouseEnter('get-content')}
                    onMouseLeave={() => handleNodeMouseLeave('get-content')}
                    style={{
                      left: '36px',
                      top: '-12px',
                      bottom: '-12px',
                      paddingLeft: '58px',
                      paddingRight: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    <NodeActionButton title="Add AI node" color="#388BFD" isDark={isDark} onClick={() => handleAddAIBoxConnectedFromContent()}>
                      <FiPlus style={{ fontSize: '14px' }} />
                    </NodeActionButton>
                  </div>
                )}

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
                  <span style={{ fontSize: '0.6875rem', color: isContentReceptive ? RECEPTIVE_COLOR : 'var(--text-muted)', fontWeight: isContentReceptive ? 600 : 400 }}>
                    {isContentReceptive ? 'Connect Back Here' : config.getContent.enabled ? 'Full Content' : 'Disabled'}
                  </span>
                  {config.getContent.enabled && (
                    <div
                      style={{
                        marginTop: '3px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        backgroundColor: isDark ? 'rgba(22, 27, 34, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                        border: `1px solid ${hasAnyAutoFormatActive ? '#388BFD' : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)')}`,
                        boxShadow: hasAnyAutoFormatActive
                          ? (isDark ? '0 0 8px rgba(56, 139, 253, 0.3)' : '0 1px 4px rgba(56, 139, 253, 0.2)')
                          : '0 1px 3px rgba(0,0,0,0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAllAutoFormat(!hasAnyAutoFormatActive);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: hasAnyAutoFormatActive ? '#388BFD' : 'var(--text-muted)',
                        }}
                      >
                        Auto Format
                      </span>
                      <ToggleSwitch
                        checked={hasAnyAutoFormatActive}
                        onChange={handleToggleAllAutoFormat}
                        size="sm"
                        activeColor="#388BFD"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ======================================================== */}
          {/* NODE 2B: GET IMAGES BRANCH (CIRCLE)                      */}
          {/* ======================================================== */}
          {(() => {
            const isImagesReceptive = Boolean(
              activeConnectingTargetId && isValidConnection('get-images', activeConnectingTargetId)
            );

            return (
              <div
                className={`canvas-node ${hoveredNodeId === 'get-images' ? 'is-hovered' : ''} ${isImagesReceptive ? 'is-receptive' : ''}`}
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
                  ['--ring' as any]: isImagesReceptive ? RECEPTIVE_COLOR : '#2EA043',
                  ['--receptive-color' as any]: RECEPTIVE_COLOR,
                  opacity: config.getImages.enabled ? 1 : 0.6,
                  zIndex: isImagesReceptive ? 35 : hoveredNodeId === 'get-images' ? 25 : 15,
                  cursor: isImagesReceptive ? 'crosshair' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: isImagesReceptive ? RECEPTIVE_GLOW : undefined,
                  transition: 'filter 0.2s ease, transform 0.2s ease',
                }}
              >
                <MergedNodeShape
                  sockets="both"
                  strokeColor={isImagesReceptive ? RECEPTIVE_COLOR : config.getImages.enabled ? '#2EA043' : '#30363D'}
                  socketDotColor={isImagesReceptive ? RECEPTIVE_COLOR : config.getImages.enabled ? '#2EA043' : '#484F58'}
                  isConnectedInput={true}
                  isConnectedOutput={isImagesOutputConnected}
                  highlightInput={false}
                  highlightOutput={isImagesReceptive}
                  hasReceiver={imagesHasReceiver}
                  hasSource={false}
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
                    fontSize: '28px',
                    color: config.getImages.enabled ? '#3FB950' : '#8B949E',
                    position: 'relative',
                    zIndex: 2,
                  }}
                />

            {/* Hover: animated plus to add + connect a node with seamless hover bridge */}
            {config.getImages.enabled && (
              <div
                className="node-hit"
                onMouseEnter={() => handleNodeMouseEnter('get-images')}
                onMouseLeave={() => handleNodeMouseLeave('get-images')}
                style={{
                  left: '36px',
                  top: '-12px',
                  bottom: '-12px',
                  paddingLeft: '58px',
                  paddingRight: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <NodeActionButton title="Add Image Enhancement node" color="#2EA043" isDark={isDark} onClick={() => handleAddAIBoxConnectedFromImages()}>
                  <FiPlus style={{ fontSize: '14px' }} />
                </NodeActionButton>
              </div>
            )}

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
              <span style={{ fontSize: '0.6875rem', color: isImagesReceptive ? RECEPTIVE_COLOR : 'var(--text-muted)', fontWeight: isImagesReceptive ? 600 : 400 }}>
                {isImagesReceptive ? 'Connect Back Here' : config.getImages.enabled ? 'All Media' : 'Disabled'}
              </span>
              {config.getImages.enabled && (
                <div
                  style={{
                    marginTop: '3px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    backgroundColor: isDark ? 'rgba(22, 27, 34, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                    border: `1px solid ${autoEnhanceState ? '#10B981' : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)')}`,
                    boxShadow: autoEnhanceState
                      ? (isDark ? '0 0 8px rgba(16, 185, 129, 0.3)' : '0 1px 4px rgba(16, 185, 129, 0.2)')
                      : '0 1px 3px rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleAutoEnhance(!autoEnhanceState);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: autoEnhanceState ? '#10B981' : 'var(--text-muted)',
                    }}
                  >
                    Auto Enhance
                  </span>
                  <ToggleSwitch
                    checked={autoEnhanceState}
                    onChange={handleToggleAutoEnhance}
                    size="sm"
                    activeColor="#10B981"
                  />
                </div>
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
            const isImageNode = isImageAIBox(box, config.connections);
            const isGoogle = !isImageNode && (box.provider === 'google_ai' || isImageModel(box.model, box.provider) || (!box.provider && !box.model?.startsWith('runware:')));
            const isLaoZhang = !isImageNode && box.provider === 'laozhang_ai';
            const isRunware = isImageNode;
            const themeColor = isRunware ? '#10B981' : isLaoZhang ? '#2563EB' : isGoogle ? '#388BFD' : '#2EA043';
            const isBoxReceptive = Boolean(
              (activeConnectingNodeId && isValidConnection(activeConnectingNodeId, box.id)) ||
              (activeConnectingTargetId && isValidConnection(box.id, activeConnectingTargetId))
            );
            const strokeColor = isSelected ? '#A371F7' : isBoxReceptive ? RECEPTIVE_COLOR : isEffectiveEnabled ? themeColor : '#30363D';
            const strokeDasharray = !isSelected && !isEffectiveEnabled ? '4, 4' : 'none';
            const isBoxInputConnected = (config.connections || []).some((c) => c.toNodeId === box.id);
            const isBoxOutputConnected = (config.connections || []).some((c) => c.fromNodeId === box.id);
            const boxCanConnectToDest = isValidConnection(box.id, 'destination');
            const boxHasReceiver = isEffectiveEnabled && boxCanConnectToDest;
            const boxCanConnectBack = !isBoxInputConnected && (isValidConnection('get-content', box.id) || isValidConnection('get-images', box.id));
            const boxHasSource = isEffectiveEnabled && boxCanConnectBack;

            return (
              <div
                key={box.id}
                className={`canvas-node ${hoveredNodeId === box.id ? 'is-hovered' : ''} ${isBoxReceptive ? 'is-receptive' : ''}`}
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
                  ['--ring' as any]: isBoxReceptive ? RECEPTIVE_COLOR : isEffectiveEnabled ? themeColor : '#30363D',
                  ['--receptive-color' as any]: RECEPTIVE_COLOR,
                  opacity: isEffectiveEnabled ? 1 : 0.6,
                  zIndex: isSelected ? 30 : isBoxReceptive ? 35 : hoveredNodeId === box.id ? 25 : 15,
                  cursor: isBoxReceptive ? 'crosshair' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: isBoxReceptive ? RECEPTIVE_GLOW : undefined,
                  transition: 'filter 0.2s ease, transform 0.2s ease',
                }}
              >
                <MergedNodeShape
                  sockets="both"
                  strokeColor={strokeColor}
                  strokeDasharray={strokeDasharray}
                  socketDotColor={isBoxReceptive ? RECEPTIVE_COLOR : strokeColor}
                  isConnectedInput={isBoxInputConnected}
                  isConnectedOutput={isBoxOutputConnected}
                  highlightInput={isBoxReceptive}
                  highlightOutput={dragWire?.fromType === 'input' && isValidConnection(box.id, dragWire.fromNodeId)}
                  hasReceiver={boxHasReceiver}
                  hasSource={boxHasSource}
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

                {/* Center Icon - preserves natural brand colors with clear visibility */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isRunware ? (
                    <RunwareIcon size={26} color={isEffectiveEnabled ? '#10B981' : '#8B949E'} />
                  ) : isLaoZhang ? (
                    <LaoZhangIcon size={28} />
                  ) : isGoogle ? (
                    <SiGooglegemini style={{ fontSize: '28px', color: isEffectiveEnabled ? '#58A6FF' : '#8B949E', transition: 'color 0.2s ease' }} />
                  ) : (
                    <OpenAIIcon size={28} color={isEffectiveEnabled ? '#3FB950' : '#8B949E'} />
                  )}
                </div>

                {/* Hover: animated duplicate + delete actions with arrow centered between both buttons */}
                {isEffectiveEnabled && (
                  <div
                    className="node-hit"
                    onMouseEnter={() => handleNodeMouseEnter(box.id)}
                    onMouseLeave={() => handleNodeMouseLeave(box.id)}
                    style={{
                      left: '36px',
                      top: '-12px',
                      bottom: '-12px',
                      paddingLeft: '58px',
                      paddingRight: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    <NodeActionButton title="Duplicate node" color={themeColor} isDark={isDark} delay={0} onClick={(e) => handleDuplicateAIBox(box, e)}>
                      <FiPlus style={{ fontSize: '14px' }} />
                    </NodeActionButton>
                    <NodeActionButton title="Delete node" color="#EF4444" isDark={isDark} delay={40} onClick={(e) => handleDeleteAIBox(box.id, e)}>
                      <FiTrash2 style={{ fontSize: '13px' }} />
                    </NodeActionButton>
                  </div>
                )}

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
                        minWidth: '110px',
                        maxWidth: '220px',
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
                  <span style={{ fontSize: '0.6875rem', color: isBoxReceptive ? RECEPTIVE_COLOR : 'var(--text-muted)', fontWeight: isBoxReceptive ? 600 : 400, transition: 'color 0.2s ease' }}>
                    {isBoxReceptive
                      ? 'Ready to Connect'
                      : `${!isImageNode && isImageModel(box.model, box.provider) ? 'Gemini Flash' : getAIModelDisplayName(box.provider, box.model)} · ${isEffectiveEnabled ? 'Active' : 'Disabled'}`}
                  </span>

                  {/* Switch button for Auto Format or Auto Enhance on this AI node */}
                  {isEffectiveEnabled && (
                    <div
                      style={{
                        marginTop: '3px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        backgroundColor: isDark ? 'rgba(22, 27, 34, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                        border: `1px solid ${
                          (isImageNode ? autoEnhanceState : Boolean(autoFormatState[box.id]))
                            ? (isImageNode ? '#10B981' : '#388BFD')
                            : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)')
                        }`,
                        boxShadow: (isImageNode ? autoEnhanceState : Boolean(autoFormatState[box.id]))
                          ? (isDark
                            ? `0 0 8px ${isImageNode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 139, 253, 0.3)'}`
                            : `0 1px 4px ${isImageNode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 139, 253, 0.2)'}`)
                          : '0 1px 3px rgba(0,0,0,0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isImageNode) {
                          handleToggleAutoEnhance(!autoEnhanceState);
                        } else {
                          handleToggleBoxAutoFormat(box.id, !Boolean(autoFormatState[box.id]));
                        }
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: (isImageNode ? autoEnhanceState : Boolean(autoFormatState[box.id]))
                            ? (isImageNode ? '#10B981' : '#388BFD')
                            : 'var(--text-muted)',
                        }}
                      >
                        {isImageNode ? 'Auto Enhance' : 'Auto Format'}
                      </span>
                      <ToggleSwitch
                        checked={isImageNode ? autoEnhanceState : Boolean(autoFormatState[box.id])}
                        onChange={(checked) => {
                          if (isImageNode) {
                            handleToggleAutoEnhance(checked);
                          } else {
                            handleToggleBoxAutoFormat(box.id, checked);
                          }
                        }}
                        size="sm"
                        activeColor={isImageNode ? '#10B981' : '#388BFD'}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ======================================================== */}
          {/* NODE 4: PROPERTY INBOX (DESTINATION CIRCLE)               */}
          {/* ======================================================== */}
          {(() => {
            const isDestReceptive = Boolean(
              activeConnectingNodeId && isValidConnection(activeConnectingNodeId, 'destination')
            );
            const destHasSource = config.aiBoxes.some((b) => isValidConnection(b.id, 'destination'));

            return (
              <div
                className={`canvas-node ${hoveredNodeId === 'destination' ? 'is-hovered' : ''} ${isDestReceptive ? 'is-receptive' : ''}`}
                onMouseEnter={() => handleNodeMouseEnter('destination')}
                onMouseLeave={() => handleNodeMouseLeave('destination')}
                onMouseDown={(e) => startDragNode('destination', e)}
                onMouseUp={(e) => {
                  if (dragWire && dragWire.fromType === 'output' && isValidConnection(dragWire.fromNodeId, 'destination')) {
                    handleSocketMouseUp('destination', 'input', e);
                  }
                }}
                onClick={(e) => handleNodeClick({ type: 'destination' }, e)}
                style={{
                  position: 'absolute',
                  left: `${config.destination.x}px`,
                  top: `${config.destination.y}px`,
                  width: `${CIRCLE_SIZE}px`,
                  height: `${CIRCLE_SIZE}px`,
                  ['--ring' as any]: isDestReceptive ? RECEPTIVE_COLOR : '#2EA043',
                  ['--receptive-color' as any]: RECEPTIVE_COLOR,
                  zIndex: isDestReceptive ? 35 : 15,
                  cursor: isDestReceptive ? 'crosshair' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: isDestReceptive ? RECEPTIVE_GLOW : undefined,
                  transition: 'filter 0.2s ease, transform 0.2s ease',
                }}
              >
                <MergedNodeShape
                  sockets="left"
                  strokeColor={isDestReceptive ? RECEPTIVE_COLOR : '#2EA043'}
                  socketDotColor={isDestReceptive ? RECEPTIVE_COLOR : '#2EA043'}
                  isConnectedInput={(config.connections || []).some((c) => c.toNodeId === 'destination')}
                  highlightInput={isDestReceptive}
                  hasReceiver={false}
                  hasSource={destHasSource}
                  onSocketMouseDown={(type, e) => handleSocketMouseDown('destination', type, e)}
                  onSocketMouseUp={(type, e) => handleSocketMouseUp('destination', type, e)}
                  onSocketMouseEnter={(type) => {
                    if (type === 'input' && destHasSource) {
                      setHoveredInputNodeId('destination');
                    }
                  }}
                  onSocketMouseLeave={(type) => {
                    if (type === 'input') {
                      setHoveredInputNodeId((curr) => (curr === 'destination' ? null : curr));
                    }
                  }}
                />
                <FiCheckCircle
                  style={{
                    fontSize: '30px',
                    color: '#2EA043',
                    position: 'relative',
                    zIndex: 2,
                    transition: 'color 0.2s ease',
                  }}
                />

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
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    Property Inbox
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: isDestReceptive ? RECEPTIVE_COLOR : 'var(--text-muted)',
                      fontWeight: isDestReceptive ? 600 : 400,
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {isDestReceptive ? 'Ready to Connect' : 'Destination · Ready'}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ======================================================== */}
      {/* NODE CONFIGURATION MODAL BOX                             */}
      {/* ======================================================== */}
      {activeModalNode && (() => {
        const isModalImageBox = Boolean(
          activeModalNode.type === 'ai-box' &&
          currentModalAIBox &&
          isImageAIBox(currentModalAIBox, config.connections)
        );
        return (
          <Modal
            isOpen={Boolean(activeModalNode)}
            onClose={handleCloseModal}
            maxWidth={activeModalNode.type === 'ai-box' ? '96vw' : '560px'}
            height={activeModalNode.type === 'ai-box' ? '92vh' : undefined}
            bodyPadding={activeModalNode.type === 'ai-box' ? '0' : undefined}
            headerExtra={
              currentModalAIBox && isImageAIBox(currentModalAIBox, config.connections) ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginRight: '0.25rem' }}>
                  Strength: {Math.round((currentModalAIBox.strength ?? 0.25) * 100)}%
                </span>
              ) : undefined
            }

          title={
            activeModalNode.type === 'trigger' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <FaFacebook style={{ fontSize: '20px', color: '#1877F2' }} />
                <span>Facebook URL Importer (Trigger)</span>
              </div>
            ) : activeModalNode.type === 'get-content' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <FiFileText style={{ fontSize: '20px', color: '#3B82F6' }} />
                <span>Get Content Branch</span>
              </div>
            ) : activeModalNode.type === 'get-images' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <FiImage style={{ fontSize: '20px', color: '#10B981' }} />
                <span>Get Images Branch</span>
              </div>
            ) : activeModalNode.type === 'destination' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <FiCheckCircle style={{ fontSize: '20px', color: '#10B981' }} />
                <span>Property Inbox Destination</span>
              </div>
            ) : currentModalAIBox ? (
              (() => {
                const isModalImageBox = isImageAIBox(currentModalAIBox, config.connections);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, minHeight: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      {isModalImageBox ? (
                        <RunwareIcon size={18} color="#10B981" />
                      ) : currentModalAIBox.provider === 'laozhang_ai' ? (
                        <LaoZhangIcon size={18} />
                      ) : currentModalAIBox.provider === 'openai' ? (
                        <OpenAIIcon size={18} />
                      ) : (
                        <SiGooglegemini style={{ fontSize: '18px', color: '#60A5FA' }} />
                      )}

                      {/* Directly Editable Node Name in Modal Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                          borderRadius: '6px',
                          padding: '2px 6px',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="text"
                          value={currentModalAIBox.title}
                          onChange={(e) => handleUpdateAIBox(currentModalAIBox.id, { title: e.target.value })}
                          placeholder="Node Name"
                          title="Click to rename node"
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            backgroundColor: 'transparent',
                            border: 'none',
                            outline: 'none',
                            width: `${Math.max(120, Math.min(260, (currentModalAIBox.title?.length || 8) * 9 + 16))}px`,
                            cursor: 'text',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : null
          }
        >
          {/* TRIGGER MODAL CONTENT */}
          {activeModalNode.type === 'trigger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.875rem',
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Auto-Import on Paste
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Automatically triggers extraction when a valid Facebook URL is detected
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateConfig({
                      ...config,
                      trigger: { ...config.trigger, autoImport: !config.trigger.autoImport },
                    })
                  }
                  style={{
                    width: '40px',
                    height: '22px',
                    backgroundColor: config.trigger.autoImport ? '#1877F2' : (isDark ? '#374151' : '#CBD5E1'),
                    borderRadius: '11px',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: 0,
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: config.trigger.autoImport ? '20px' : '2px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
                      transition: 'left 0.2s ease',
                    }}
                  />
                </button>
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Connects incoming Facebook URLs from Groups, Pages, and Marketplace directly to the Get Content and Get Images branches.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Button variant="primary" size="sm" onClick={() => setActiveModalNode(null)}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* GET CONTENT MODAL CONTENT */}
          {activeModalNode.type === 'get-content' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.875rem',
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Enable Content Extraction
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Extracts 100% full original post content & caption
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateConfig({
                      ...config,
                      getContent: { ...config.getContent, enabled: !config.getContent.enabled },
                    })
                  }
                  style={{
                    width: '40px',
                    height: '22px',
                    backgroundColor: config.getContent.enabled ? '#388BFD' : (isDark ? '#374151' : '#CBD5E1'),
                    borderRadius: '11px',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: 0,
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: config.getContent.enabled ? '20px' : '2px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
                      transition: 'left 0.2s ease',
                    }}
                  />
                </button>
              </div>

              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                When enabled, the full raw text caption and specifications are extracted directly from the post and piped simultaneously into all active AI copywriter nodes.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Button variant="primary" size="sm" onClick={() => setActiveModalNode(null)}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* GET IMAGES MODAL CONTENT */}
          {activeModalNode.type === 'get-images' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.875rem',
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Enable Images Download
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Downloads all original photos & media from the post
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateConfig({
                      ...config,
                      getImages: { ...config.getImages, enabled: !config.getImages.enabled },
                    })
                  }
                  style={{
                    width: '40px',
                    height: '22px',
                    backgroundColor: config.getImages.enabled ? '#10B981' : (isDark ? '#374151' : '#CBD5E1'),
                    borderRadius: '11px',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: 0,
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: config.getImages.enabled ? '20px' : '2px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
                      transition: 'left 0.2s ease',
                    }}
                  />
                </button>
              </div>

              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                When enabled, the entire gallery of photos attached to the Facebook post is retrieved in high quality and sent to the Property Inbox.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Button variant="primary" size="sm" onClick={() => setActiveModalNode(null)}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* DYNAMIC AI BOX MODAL CONTENT (Interactive AI Training & Testing Studio) */}
          {activeModalNode.type === 'ai-box' && currentModalAIBox && (
            isImageAIBox(currentModalAIBox, config.connections) ? (
              <AIImageStudio
                box={currentModalAIBox}
                availablePrompts={availablePrompts}
                isSettingsOpen={isAISettingsDrawerOpen}
                onCloseSettings={() => setIsAISettingsDrawerOpen(false)}
                onUpdateBox={(id, updates) => handleUpdateAIBox(id, updates)}
                onToggleBox={(id) => handleToggleAIBox(id)}
                onDeleteBox={(id) => handleDeleteAIBox(id)}
                onClose={handleCloseModal}
              />
            ) : (
              <AITrainingChatbot
                box={currentModalAIBox}
                availablePrompts={availablePrompts}
                allowEditPrompt={allowEditPrompt}
                initialRawData={rawContent}
                isSettingsOpen={isAISettingsDrawerOpen}
                onCloseSettings={() => setIsAISettingsDrawerOpen(false)}
                onUpdateBox={(id, updates) => handleUpdateAIBox(id, updates)}
                onToggleBox={(id) => handleToggleAIBox(id)}
                onDuplicateBox={(boxToDup) => handleDuplicateAIBox(boxToDup)}
                onDeleteBox={(id) => handleDeleteAIBox(id)}
                onClose={handleCloseModal}
              />
            )
          )}

          {/* DESTINATION MODAL CONTENT */}
          {activeModalNode.type === 'destination' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.875rem',
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Property Inbox Target
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '2px', fontWeight: 500 }}>
                    Active & Ready to Receive Data
                  </div>
                </div>
                <Badge variant="success">Ready</Badge>
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Aggregates:
                <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                  <li>{config.aiBoxes.filter((b) => b.enabled).length} Dynamic AI listing copies</li>
                  <li>{config.getImages.enabled ? 'All original photos & media' : 'Media branch disabled'}</li>
                  <li>Extracted price, bed/bath specs, contact info, and canonical Facebook URL</li>
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Button variant="primary" size="sm" onClick={() => setActiveModalNode(null)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </Modal>
        );
      })()}

      {/* Vertical Edge Sidebar Toggle Tab (Sleek rail along right edge) */}
      {(deletedBoxes.length > 0 || isRecoverModalOpen) && (
        <button
          type="button"
          onClick={() => {
            setIsRecoverModalOpen((prev) => !prev);
          }}
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            right: isRecoverModalOpen ? '310px' : '0px',
            zIndex: 160,
            width: '28px',
            minHeight: '100px',
            padding: '8px 2px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            backgroundColor: 'var(--accent-primary)',
            color: '#FFFFFF',
            border: '1px solid var(--accent-primary)',
            borderRight: 'none',
            borderTopLeftRadius: '8px',
            borderBottomLeftRadius: '8px',
            borderTopRightRadius: '0px',
            borderBottomRightRadius: '0px',
            boxShadow: isDark
              ? '-4px 0 20px rgba(59, 130, 246, 0.45)'
              : '-3px 0 14px rgba(37, 99, 235, 0.35)',
            cursor: 'pointer',
            transition:
              'right 0.28s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
            e.currentTarget.style.borderColor = 'var(--accent-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
        >
          {/* Top Recover Icon */}
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            <FiRotateCcw
              size={12}
              style={{
                transform: isRecoverModalOpen ? 'rotate(-90deg)' : 'none',
                transition: 'transform 0.28s ease',
              }}
            />
          </div>

          {/* Vertical Text Label */}
          <span
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontSize: '0.5625rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: '#FFFFFF',
              textTransform: 'uppercase',
              userSelect: 'none',
              margin: '2px 0',
              opacity: 0.95,
            }}
          >
            Recover
          </span>

          {/* Count Badge */}
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              minWidth: '17px',
              height: '17px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.28)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {deletedBoxes.length}
          </span>

          {/* Toggle Chevron Arrow */}
          <div style={{ color: 'rgba(255, 255, 255, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isRecoverModalOpen ? <FiChevronRight size={11} /> : <FiChevronLeft size={11} />}
          </div>
        </button>
      )}

      {/* ======================================================== */}
      {/* DELETE CONFIRMATION MODAL                                */}
      {/* ======================================================== */}
      {pendingDeleteBox && (
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
                Delete AI Node
              </span>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to delete this AI node? It will be removed from your workflow pipeline.
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
                  borderRadius: '50%',
                  backgroundColor: isDark ? '#1F2937' : '#F1F5F9',
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
                  {pendingDeleteBox.title || 'Dynamic AI Box'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {pendingDeleteBox.model || 'Gemini Flash'} · {pendingDeleteBox.processType || 'AI Copywriter'}
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

            {/* Checkbox: Don't ask confirmation again */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                userSelect: 'none',
                marginTop: '0.25rem',
              }}
            >
              <input
                type="checkbox"
                checked={dontAskDeleteAgain}
                onChange={(e) => {
                  const val = e.target.checked;
                  setDontAskDeleteAgain(val);
                  try {
                    localStorage.setItem('ea_workflow_skip_delete_confirm', String(val));
                  } catch {}
                }}
                style={{
                  width: '15px',
                  height: '15px',
                  accentColor: '#1877F2',
                  cursor: 'pointer',
                }}
              />
              <span>Don't ask confirmation again</span>
            </label>

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
      )}

      {/* ======================================================== */}
      {/* RECOVER DELETED NODES SLIDE-OVER RIGHT SIDEBAR           */}
      {/* ======================================================== */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '310px',
          maxWidth: '100%',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-color)',
          boxShadow: isDark
            ? '-8px 0 30px rgba(0, 0, 0, 0.7)'
            : '-4px 0 20px rgba(0, 0, 0, 0.08)',
          zIndex: 150,
          display: 'flex',
          flexDirection: 'column',
          transform: isRecoverModalOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
          opacity: isRecoverModalOpen ? 1 : 0,
          pointerEvents: isRecoverModalOpen ? 'auto' : 'none',
        }}
      >
        {/* Drawer Header (Clean, minimal 1-line top bar) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 0.875rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            flexShrink: 0,
            height: '46px',
          }}
        >
          <FiRotateCcw size={14} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
            Recover Nodes
          </span>
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
        </div>

        {/* Select All & Clear History Bar */}
        {deletedBoxes.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.45rem 0.875rem',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              fontSize: '0.75rem',
              flexShrink: 0,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                userSelect: 'none',
                fontSize: '0.6875rem',
              }}
            >
              <input
                type="checkbox"
                checked={selectRecoverIds.size === deletedBoxes.length && deletedBoxes.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectRecoverIds(new Set(deletedBoxes.map((d) => d.box.id)));
                  } else {
                    setSelectRecoverIds(new Set());
                  }
                }}
                style={{
                  width: '13px',
                  height: '13px',
                  accentColor: 'var(--accent-primary)',
                  cursor: 'pointer',
                }}
              />
              <span>Select All ({selectRecoverIds.size}/{deletedBoxes.length})</span>
            </label>

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
                borderRadius: '3px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Clear history
            </button>
          </div>
        )}

        {/* Drawer Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.625rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {deletedBoxes.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                margin: 'auto 0',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <FiRotateCcw size={18} />
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No deleted nodes
              </div>
              <div style={{ fontSize: '0.6875rem', maxWidth: '220px', lineHeight: 1.4 }}>
                Deleted nodes will appear here to restore anytime.
              </div>
            </div>
          ) : (
            deletedBoxes.map((record) => {
              const isSelected = selectRecoverIds.has(record.box.id);
              return (
                <div
                  key={record.box.id}
                  onClick={() => {
                    const next = new Set(selectRecoverIds);
                    if (isSelected) {
                      next.delete(record.box.id);
                    } else {
                      next.add(record.box.id);
                    }
                    setSelectRecoverIds(next);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.625rem',
                    backgroundColor: isSelected
                      ? 'var(--accent-primary-alpha)'
                      : 'var(--bg-surface)',
                    border: isSelected
                      ? '1px solid var(--accent-primary)'
                      : '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    }
                  }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      const next = new Set(selectRecoverIds);
                      if (e.target.checked) {
                        next.add(record.box.id);
                      } else {
                        next.delete(record.box.id);
                      }
                      setSelectRecoverIds(next);
                    }}
                    style={{
                      width: '14px',
                      height: '14px',
                      accentColor: 'var(--accent-primary)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />

                  {/* Node Provider Icon */}
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {renderAIBoxIcon(record.box, 15)}
                  </div>

                  {/* Title & Metadata */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {record.box.title || 'Dynamic AI Box'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.625rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span>{record.box.model || 'Gemini'}</span>
                      <span>•</span>
                      <span>{timeAgo(record.deletedAt)}</span>
                      {record.connections && record.connections.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{record.connections.length}w</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        {deletedBoxes.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 0.875rem',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              flexShrink: 0,
            }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRecoverModalOpen(false)}
              style={{ flex: 1, height: '32px', fontSize: '0.75rem' }}
            >
              Close
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleRecoverSelected}
              disabled={selectRecoverIds.size === 0}
              leftIcon={<FiRotateCcw style={{ fontSize: '12px' }} />}
              style={{
                flex: 2,
                height: '32px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Recover ({selectRecoverIds.size})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

FacebookWorkflowCanvas.displayName = 'FacebookWorkflowCanvas';
