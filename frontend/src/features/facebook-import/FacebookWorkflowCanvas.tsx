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
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa';
import { SiGooglegemini } from 'react-icons/si';
import { AITrainingChatbot, ModelSelectorMenu, LaoZhangIcon, RunwareIcon } from './AITrainingChatbot';
import { useTheme } from '../../context/ThemeContext';
import { getAIModelDisplayName, isImageAIBox, isImageModel } from './aiModelUtils';
import { AIImageStudio } from './AIImageStudio';

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
  { value: 'runware:100@1', label: 'Runware SDXL Realism (runware:100@1)' },
  { value: 'runware:101@1', label: 'Runware FLUX.1 Schnell (runware:101@1)' },
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
        // Auto-migrate old cramped layout to ensure clean base lane and gap:
        const updatedGetImages =
          !parsed.getImages.y || parsed.getImages.y <= 350
            ? { ...parsed.getImages, y: 390 }
            : parsed.getImages;
        const updatedGetContent =
          !parsed.getContent.y || parsed.getContent.y >= 120
            ? { ...parsed.getContent, y: 110 }
            : parsed.getContent;
        const updatedAiBoxes = parsed.aiBoxes.map((b: any, idx: number) => {
          if (idx === 0 && (!b.y || b.y >= 95)) return { ...b, y: 80 };
          if (idx === 1 && (!b.y || b.y >= 260)) return { ...b, y: 230 };
          return b;
        });

        return {
          ...DEFAULT_FB_WORKFLOW_CONFIG,
          ...parsed,
          getContent: { ...DEFAULT_FB_WORKFLOW_CONFIG.getContent, ...updatedGetContent },
          getImages: { ...DEFAULT_FB_WORKFLOW_CONFIG.getImages, ...updatedGetImages },
          trigger: { ...DEFAULT_FB_WORKFLOW_CONFIG.trigger, ...parsed.trigger },
          destination: { ...DEFAULT_FB_WORKFLOW_CONFIG.destination, ...parsed.destination },
          aiBoxes: updatedAiBoxes.length > 0 ? updatedAiBoxes : DEFAULT_FB_WORKFLOW_CONFIG.aiBoxes,
          connections,
        };
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
  onSocketMouseDown?: (type: 'input' | 'output', e: React.MouseEvent) => void;
  onSocketMouseUp?: (type: 'input' | 'output', e: React.MouseEvent) => void;
}

export const MergedNodeShape: React.FC<MergedNodeShapeProps> = ({
  sockets,
  strokeColor,
  fillColor,
  strokeWidth = 2,
  strokeDasharray = 'none',
  highlightInput = false,
  highlightOutput = false,
  isConnectedInput = false,
  isConnectedOutput = false,
  onSocketMouseDown,
  onSocketMouseUp,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const resolvedFillColor = fillColor || (isDark ? '#161B22' : '#FFFFFF');
  const [hoveredSocket, setHoveredSocket] = useState<'input' | 'output' | null>(null);

  const isReceptiveInput = highlightInput && !isConnectedInput;
  const isReceptiveOutput = highlightOutput && !isConnectedOutput;
  const isReceptive = isReceptiveInput || isReceptiveOutput;

  // Deep yellow representing receptive connect state (no glow)
  const DEEP_YELLOW = '#D29922';
  const effectiveStrokeColor = isReceptive ? DEEP_YELLOW : strokeColor;

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
        {/* RIGHT OUTPUT SOCKET: NEXT ICON (→), MERGES WITH CYCLE    */}
        {/* ======================================================== */}
        {(sockets === 'right' || sockets === 'both') && (
          <path
            d="M 71 36 L 79.5 36 M 76 32.5 L 79.5 36 L 76 39.5"
            fill="none"
            stroke={isReceptiveOutput ? DEEP_YELLOW : (hoveredSocket === 'output' && !isConnectedOutput ? '#FFFFFF' : strokeColor)}
            strokeWidth={isReceptiveOutput ? 2.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
            }}
          />
        )}

        {/* ======================================================== */}
        {/* LEFT INPUT SOCKET: BACK ICON (←), MERGES WITH CYCLE      */}
        {/* ======================================================== */}
        {(sockets === 'left' || sockets === 'both') && (
          <path
            d="M 1 36 L -7.5 36 M -4 32.5 L -7.5 36 L -4 39.5"
            fill="none"
            stroke={isReceptiveInput ? DEEP_YELLOW : (hoveredSocket === 'input' && !isConnectedInput ? '#FFFFFF' : strokeColor)}
            strokeWidth={isReceptiveInput ? 2.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
            }}
          />
        )}
      </svg>

      {/* Right Output Socket Hitbox for drag-to-connect */}
      {(sockets === 'right' || sockets === 'both') && (
        <div
          className="socket-handle socket-handle-output"
          onMouseEnter={() => setHoveredSocket('output')}
          onMouseLeave={() => setHoveredSocket(null)}
          onMouseDown={(e) => {
            if (isConnectedOutput) {
              e.stopPropagation();
              return;
            }
            onSocketMouseDown?.('output', e);
          }}
          onMouseUp={(e) => onSocketMouseUp?.('output', e)}
          style={{
            position: 'absolute',
            right: '-16px',
            top: '20px',
            width: '28px',
            height: '32px',
            cursor: isConnectedOutput ? 'default' : 'grab',
            pointerEvents: 'auto',
            zIndex: 30,
            borderRadius: '0 16px 16px 0',
          }}
        />
      )}

      {/* Left Input Socket Hitbox for drag-to-connect */}
      {(sockets === 'left' || sockets === 'both') && (
        <div
          className="socket-handle socket-handle-input"
          onMouseEnter={() => setHoveredSocket('input')}
          onMouseLeave={() => setHoveredSocket(null)}
          onMouseDown={(e) => {
            if (isConnectedInput) {
              e.stopPropagation();
              return;
            }
            onSocketMouseDown?.('input', e);
          }}
          onMouseUp={(e) => onSocketMouseUp?.('input', e)}
          style={{
            position: 'absolute',
            left: '-16px',
            top: '20px',
            width: '28px',
            height: '32px',
            cursor: isConnectedInput ? 'default' : 'crosshair',
            pointerEvents: 'auto',
            zIndex: 30,
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

export interface FacebookWorkflowCanvasRef {
  addAIBox: (templateOverride?: CanvasPromptOption) => void;
  resetLayout: () => void;
}

export interface FacebookWorkflowCanvasProps {
  initialConfig?: FacebookWorkflowConfig;
  onSwitchToLiveImport?: () => void;
  onConfigChange?: (config: FacebookWorkflowConfig) => void;
  allowEditPrompt?: boolean;
}

export const FacebookWorkflowCanvas = forwardRef<
  FacebookWorkflowCanvasRef,
  FacebookWorkflowCanvasProps
>(function FacebookWorkflowCanvas(
  { initialConfig, onConfigChange, allowEditPrompt = false },
  ref
) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const [config, setConfig] = useState<FacebookWorkflowConfig>(() => initialConfig || loadSavedFacebookWorkflowConfig());

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
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

  // Directional forward-only connection validation with strict duplicate rejection:
  // "and that can't connect back with other and that only can connect next other step"
  const isValidConnection = (fromId: string, toId: string): boolean => {
    if (!fromId || !toId || fromId === toId) return false;

    // Reject if already connected in either direction
    if (isAlreadyConnected(fromId, toId)) {
      return false;
    }

    const conns = config.connections || [];

    // Step 1: trigger -> get-content or get-images (already statically connected)
    if (fromId === 'trigger') {
      return false;
    }

    // Step 2: get-content -> dynamic AI nodes only
    if (fromId === 'get-content') {
      if (!toId.startsWith('ai-box-')) return false;
      // Target AI box must NOT already have an incoming connection
      const aiAlreadyHasInput = conns.some((c) => c.toNodeId === toId);
      return !aiAlreadyHasInput;
    }

    // Step 2b: get-images -> dynamic AI nodes (Image Edit & Enhance)
    if (fromId === 'get-images') {
      if (!toId.startsWith('ai-box-')) return false;
      // Target AI box must NOT already have an incoming connection
      const aiAlreadyHasInput = conns.some((c) => c.toNodeId === toId);
      return !aiAlreadyHasInput;
    }

    // Step 3: dynamic AI nodes -> destination only
    if (fromId.startsWith('ai-box-')) {
      if (toId !== 'destination') return false;
      // This AI box must NOT already have an outgoing connection to destination
      const alreadyConnectedToDest = conns.some(
        (c) => c.fromNodeId === fromId && c.toNodeId === 'destination'
      );
      return !alreadyConnectedToDest;
    }

    return false;
  };

  // Socket Drag-to-Connect Handlers ("Drag that string")
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
                    model: b.model?.startsWith('runware:') ? b.model : 'runware:101@1',
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
      return;
    }

    // Prevent starting drag from an already connected socket
    const conns = config.connections || [];
    if (socketType === 'output') {
      if (nodeId === 'trigger' || nodeId === 'get-images') return;
      if (nodeId.startsWith('ai-box-') && conns.some((c) => c.fromNodeId === nodeId)) return;
    }
    if (socketType === 'input') {
      if (nodeId === 'get-content' || nodeId === 'get-images') return;
      if (nodeId.startsWith('ai-box-') && conns.some((c) => c.toNodeId === nodeId)) return;
    }

    // Start dragging a new wire from this socket
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
              model: b.model?.startsWith('runware:') ? b.model : 'runware:101@1',
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

    const newConfig: FacebookWorkflowConfig = {
      ...config,
      aiBoxes: [...config.aiBoxes, newBox],
      connections: [...(config.connections || []), newConn],
    };

    updateConfig(newConfig);
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

    const newConfig: FacebookWorkflowConfig = {
      ...config,
      aiBoxes: [...config.aiBoxes, newBox],
      connections: [...(config.connections || []), newConn],
    };

    updateConfig(newConfig);
    setSelectedBoxId(newId);
  };

  // Add Dynamic AI Box (appears on canvas first, not connected to another until user creates what it is used for and drags string)
  const handleAddAIBox = (templateOverride?: CanvasPromptOption) => {
    const prompts = loadAvailablePromptTemplates();
    const boxCount = config.aiBoxes.length;
    const maxY = config.aiBoxes.reduce((max, b) => Math.max(max, b.y), 0);
    const newY = boxCount === 0 ? 120 : Math.max(maxY + 140, 80 + boxCount * 140);

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

  // Delete Dynamic AI Box
  const handleDeleteAIBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (config.aiBoxes.length <= 1) {
      alert('You must have at least one AI process box in the workflow.');
      return;
    }
    const box = config.aiBoxes.find((b) => b.id === id);
    const boxName = box ? box.title : 'this AI node';
    if (!window.confirm(`Are you sure you want to delete "${boxName}"?`)) {
      return;
    }
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

  // Reset Layout to pristine aligned grid with clean base and gaps
  const handleResetLayout = () => {
    const defaultBoxes = config.aiBoxes.map((box, idx) => ({
      ...box,
      x: 640,
      y: idx === 0 ? 80 : 80 + idx * 150,
    }));

    const resetConfig: FacebookWorkflowConfig = {
      ...config,
      zoom: 0.95,
      panOffset: { x: 30, y: 30 },
      trigger: { x: 80, y: 220, autoImport: config.trigger.autoImport },
      getContent: { ...config.getContent, x: 340, y: 110 },
      getImages: { ...config.getImages, x: 340, y: 390 },
      destination: { x: 960, y: 220 },
      aiBoxes: defaultBoxes,
    };
    updateConfig(resetConfig);
  };

  useImperativeHandle(
    ref,
    () => ({
      addAIBox: (templateOverride) => handleAddAIBox(templateOverride),
      resetLayout: () => handleResetLayout(),
    }),
    [config]
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
              const path =
                conn.fromNodeId === 'get-images' && conn.toNodeId === 'destination'
                  ? createBaseChannelPath(fromPos, toPos)
                  : createBezierPath(fromPos, toPos);

              const fromEnabled =
                conn.fromNodeId === 'get-content'
                  ? config.getContent.enabled
                  : conn.fromNodeId === 'get-images'
                  ? config.getImages.enabled
                  : config.aiBoxes.find((b) => b.id === conn.fromNodeId)?.enabled ?? true;
              const toEnabled =
                conn.toNodeId === 'destination'
                  ? true
                  : config.aiBoxes.find((b) => b.id === conn.toNodeId)?.enabled ?? true;
              const isFlowing = fromEnabled && toEnabled;
              const isHovered = hoveredWireId === conn.id;

              const isFromImages = conn.fromNodeId === 'get-images' || (
                (config.connections || []).some((c) => c.fromNodeId === 'get-images' && c.toNodeId === conn.fromNodeId)
              );
              const wireStrokeColor = isHovered ? '#F85149' : isFlowing ? (isFromImages ? '#10B981' : '#A371F7') : (isDark ? '#30363D' : '#CBD5E1');

              const midX = (fromPos.x + toPos.x) / 2;
              const midY = (fromPos.y + toPos.y) / 2;

              return (
                <g
                  key={conn.id}
                  className="workflow-wire-group"
                  onMouseEnter={() => setHoveredWireId(conn.id)}
                  onMouseLeave={() => setHoveredWireId(null)}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                >
                  {/* Invisible thicker hit-path for hovering / clicking to disconnect */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    onClick={(e) => handleRemoveConnection(conn.id, e)}
                  />
                  {/* Visual dashed flowing wire */}
                  <path
                    d={path}
                    fill="none"
                    stroke={wireStrokeColor}
                    strokeWidth={isHovered ? '2.5' : '2'}
                    strokeDasharray={isFlowing ? '8, 8' : 'none'}
                    strokeLinecap="round"
                    style={{
                      animation: isFlowing ? 'n8nFlow 1.2s linear infinite' : 'none',
                      transition: 'stroke 0.15s ease',
                    }}
                  />
                  {/* Disconnect indicator on hover */}
                  {isHovered && (
                    <g
                      transform={`translate(${midX}, ${midY})`}
                      onClick={(e) => handleRemoveConnection(conn.id, e)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle r="10" fill="#F85149" stroke={isDark ? "#161B22" : "#FFFFFF"} strokeWidth="2" />
                      <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
                      <line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
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

          {/* ======================================================== */}
          {/* NODE 1: FACEBOOK URL IMPORTER (TRIGGER CIRCLE)           */}
          {/* ======================================================== */}
          <div
            className="canvas-node"
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
              transition: 'filter 0.18s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'drop-shadow(0 0 10px rgba(56, 139, 253, 0.5))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
          >
            <MergedNodeShape
              sockets="right"
              strokeColor="#388BFD"
              socketDotColor="#388BFD"
              isConnectedOutput={true}
              highlightOutput={false}
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
          <div
            className="canvas-node"
            onMouseDown={(e) => startDragNode('get-content', e)}
            onClick={(e) => handleNodeClick({ type: 'get-content' }, e)}
            style={{
              position: 'absolute',
              left: `${config.getContent.x}px`,
              top: `${config.getContent.y}px`,
              width: `${CIRCLE_SIZE}px`,
              height: `${CIRCLE_SIZE}px`,
              opacity: config.getContent.enabled ? 1 : 0.6,
              zIndex: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'filter 0.18s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'drop-shadow(0 0 10px rgba(56, 139, 253, 0.5))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
          >
            <MergedNodeShape
              sockets="both"
              strokeColor={config.getContent.enabled ? '#388BFD' : '#30363D'}
              socketDotColor={config.getContent.enabled ? '#388BFD' : '#484F58'}
              isConnectedInput={true}
              isConnectedOutput={false}
              highlightInput={false}
              highlightOutput={dragWire?.fromType === 'input' && isValidConnection('get-content', dragWire.fromNodeId)}
              onSocketMouseDown={(type, e) => handleSocketMouseDown('get-content', type, e)}
              onSocketMouseUp={(type, e) => handleSocketMouseUp('get-content', type, e)}
            />
            <FiFileText
              style={{
                fontSize: '28px',
                color: config.getContent.enabled ? '#58A6FF' : '#8B949E',
                position: 'relative',
                zIndex: 2,
              }}
            />

            {/* Plus Icon Button to add AI node & connect immediately before next step */}
            <button
              type="button"
              className="canvas-control add-ai-branch-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleAddAIBoxConnectedFromContent();
              }}
              style={{
                position: 'absolute',
                right: '-36px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                border: '1.5px solid #388BFD',
                color: '#388BFD',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 35,
                padding: 0,
                boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.45)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1F6FEB';
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.borderColor = '#79C0FF';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(56, 139, 253, 0.65)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#161B22' : '#FFFFFF';
                e.currentTarget.style.color = '#388BFD';
                e.currentTarget.style.borderColor = '#388BFD';
                e.currentTarget.style.boxShadow = isDark ? '0 2px 8px rgba(0, 0, 0, 0.45)' : '0 2px 8px rgba(0, 0, 0, 0.1)';
              }}
            >
              <FiPlus style={{ fontSize: '13px', strokeWidth: '2.5' }} />
            </button>

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
                Get Content
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                {config.getContent.enabled ? 'Full Content' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* NODE 2B: GET IMAGES BRANCH (CIRCLE)                      */}
          {/* ======================================================== */}
          <div
            className="canvas-node"
            onMouseDown={(e) => startDragNode('get-images', e)}
            onClick={(e) => handleNodeClick({ type: 'get-images' }, e)}
            style={{
              position: 'absolute',
              left: `${config.getImages.x}px`,
              top: `${config.getImages.y}px`,
              width: `${CIRCLE_SIZE}px`,
              height: `${CIRCLE_SIZE}px`,
              opacity: config.getImages.enabled ? 1 : 0.6,
              zIndex: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'filter 0.18s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'drop-shadow(0 0 10px rgba(46, 160, 67, 0.5))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
          >
            <MergedNodeShape
              sockets="both"
              strokeColor={config.getImages.enabled ? '#2EA043' : '#30363D'}
              socketDotColor={config.getImages.enabled ? '#2EA043' : '#484F58'}
              isConnectedInput={true}
              isConnectedOutput={true}
              highlightInput={false}
              highlightOutput={dragWire?.fromType === 'input' && isValidConnection('get-images', dragWire.fromNodeId)}
              onSocketMouseDown={(type, e) => handleSocketMouseDown('get-images', type, e)}
              onSocketMouseUp={(type, e) => handleSocketMouseUp('get-images', type, e)}
            />
            <FiImage
              style={{
                fontSize: '28px',
                color: config.getImages.enabled ? '#3FB950' : '#8B949E',
                position: 'relative',
                zIndex: 2,
              }}
            />

            {/* Plus Icon Button to add AI image branch node & connect immediately */}
            <button
              type="button"
              className="canvas-control add-ai-branch-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleAddAIBoxConnectedFromImages();
              }}
              style={{
                position: 'absolute',
                right: '-36px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                border: '1.5px solid #2EA043',
                color: '#2EA043',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 35,
                padding: 0,
                boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.45)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2EA043';
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.borderColor = '#3FB950';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(46, 160, 67, 0.65)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#161B22' : '#FFFFFF';
                e.currentTarget.style.color = '#2EA043';
                e.currentTarget.style.borderColor = '#2EA043';
                e.currentTarget.style.boxShadow = isDark ? '0 2px 8px rgba(0, 0, 0, 0.45)' : '0 2px 8px rgba(0, 0, 0, 0.1)';
              }}
              title="Add Image Enhancement Node"
            >
              <FiPlus style={{ fontSize: '13px', strokeWidth: '2.5' }} />
            </button>

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
                Get Images
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                {config.getImages.enabled ? 'All Media' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* NODE 3: DYNAMIC MULTI-BOX AI PROCESSORS (CIRCLES)        */}
          {/* ======================================================== */}
          {config.aiBoxes.map((box) => {
            const isSelected = selectedBoxId === box.id;
            const isImageNode = isImageAIBox(box, config.connections);
            const isGoogle = !isImageNode && (box.provider === 'google_ai' || isImageModel(box.model, box.provider) || (!box.provider && !box.model?.startsWith('runware:')));
            const isLaoZhang = !isImageNode && box.provider === 'laozhang_ai';
            const isRunware = isImageNode;
            const themeColor = isRunware ? '#10B981' : isLaoZhang ? '#2563EB' : isGoogle ? '#388BFD' : '#2EA043';
            const strokeColor = isSelected ? '#A371F7' : box.enabled ? themeColor : '#30363D';
            const strokeDasharray = !isSelected && !box.enabled ? '4, 4' : 'none';
            const isBoxInputConnected = (config.connections || []).some((c) => c.toNodeId === box.id);
            const isBoxOutputConnected = (config.connections || []).some((c) => c.fromNodeId === box.id);

            return (
              <div
                key={box.id}
                className="canvas-node"
                onMouseDown={(e) => startDragNode(box.id, e)}
                onClick={(e) => handleNodeClick({ type: 'ai-box', boxId: box.id }, e)}
                style={{
                  position: 'absolute',
                  left: `${box.x}px`,
                  top: `${box.y}px`,
                  width: `${CIRCLE_SIZE}px`,
                  height: `${CIRCLE_SIZE}px`,
                  opacity: box.enabled ? 1 : 0.6,
                  zIndex: isSelected ? 20 : 15,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'filter 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = isRunware
                    ? 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.55))'
                    : isGoogle
                    ? 'drop-shadow(0 0 10px rgba(56, 139, 253, 0.55))'
                    : isLaoZhang
                    ? 'drop-shadow(0 0 10px rgba(37, 99, 235, 0.55))'
                    : 'drop-shadow(0 0 10px rgba(46, 160, 67, 0.55))';
                }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
              >
                <MergedNodeShape
                  sockets="both"
                  strokeColor={strokeColor}
                  strokeDasharray={strokeDasharray}
                  socketDotColor={strokeColor}
                  isConnectedInput={isBoxInputConnected}
                  isConnectedOutput={isBoxOutputConnected}
                  highlightInput={dragWire?.fromType === 'output' && isValidConnection(dragWire.fromNodeId, box.id)}
                  highlightOutput={dragWire?.fromType === 'input' && isValidConnection(box.id, dragWire.fromNodeId)}
                  onSocketMouseDown={(type, e) => handleSocketMouseDown(box.id, type, e)}
                  onSocketMouseUp={(type, e) => handleSocketMouseUp(box.id, type, e)}
                />

                {/* Center Icon */}
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
                    <RunwareIcon size={26} color={box.enabled ? '#10B981' : '#8B949E'} />
                  ) : isLaoZhang ? (
                    <LaoZhangIcon size={28} />
                  ) : isGoogle ? (
                    <SiGooglegemini style={{ fontSize: '28px', color: box.enabled ? '#58A6FF' : '#8B949E' }} />
                  ) : (
                    <OpenAIIcon size={28} color={box.enabled ? '#3FB950' : '#8B949E'} />
                  )}
                </div>

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
                    {box.title}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    {!isImageNode && isImageModel(box.model, box.provider)
                      ? 'Gemini Flash'
                      : getAIModelDisplayName(box.provider, box.model)}{' '}
                    · {box.enabled ? 'Active' : 'Off'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* ======================================================== */}
          {/* NODE 4: PROPERTY INBOX (DESTINATION CIRCLE)               */}
          {/* ======================================================== */}
          <div
            className="canvas-node"
            onMouseDown={(e) => startDragNode('destination', e)}
            onClick={(e) => handleNodeClick({ type: 'destination' }, e)}
            style={{
              position: 'absolute',
              left: `${config.destination.x}px`,
              top: `${config.destination.y}px`,
              width: `${CIRCLE_SIZE}px`,
              height: `${CIRCLE_SIZE}px`,
              zIndex: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'filter 0.18s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'drop-shadow(0 0 10px rgba(46, 160, 67, 0.5))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
          >
            <MergedNodeShape
              sockets="left"
              strokeColor="#2EA043"
              socketDotColor="#2EA043"
              highlightInput={dragWire?.fromType === 'output' && isValidConnection(dragWire.fromNodeId, 'destination')}
              onSocketMouseDown={(type, e) => handleSocketMouseDown('destination', type, e)}
              onSocketMouseUp={(type, e) => handleSocketMouseUp('destination', type, e)}
            />
            <FiCheckCircle style={{ fontSize: '30px', color: '#2EA043', position: 'relative', zIndex: 2 }} />

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
                Property Inbox
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                Destination · Ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* NODE CONFIGURATION MODAL BOX                             */}
      {/* ======================================================== */}
      {activeModalNode && (
        <Modal
          isOpen={Boolean(activeModalNode)}
          onClose={handleCloseModal}
          maxWidth={activeModalNode.type === 'ai-box' ? '1120px' : '560px'}
          height={activeModalNode.type === 'ai-box' ? '88vh' : undefined}
          bodyPadding={activeModalNode.type === 'ai-box' ? '0' : undefined}

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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative', minHeight: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, zIndex: 1 }}>
                      {isModalImageBox ? (
                        <RunwareIcon size={18} color="#10B981" />
                      ) : currentModalAIBox.provider === 'laozhang_ai' ? (
                        <LaoZhangIcon size={18} />
                      ) : currentModalAIBox.provider === 'openai' ? (
                        <OpenAIIcon size={18} />
                      ) : (
                        <SiGooglegemini style={{ fontSize: '18px', color: '#60A5FA' }} />
                      )}
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                        {currentModalAIBox.title}
                      </span>
                    </div>

                    {/* Center AI Model Selector */}
                    <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                      <ModelSelectorMenu
                        provider={currentModalAIBox.provider}
                        model={currentModalAIBox.model}
                        filterType={isModalImageBox ? 'image' : 'text'}
                        onSelectModel={(provider, model) => handleUpdateAIBox(currentModalAIBox.id, { provider, model })}
                      />
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
                    width: '36px',
                    height: '20px',
                    backgroundColor: config.trigger.autoImport ? '#1877F2' : 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: config.trigger.autoImport ? '18px' : '2px',
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
                    width: '36px',
                    height: '20px',
                    backgroundColor: config.getContent.enabled ? '#3B82F6' : 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: config.getContent.enabled ? '18px' : '2px',
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
                    width: '36px',
                    height: '20px',
                    backgroundColor: config.getImages.enabled ? '#10B981' : 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: config.getImages.enabled ? '18px' : '2px',
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
      )}
    </div>
  );
});

FacebookWorkflowCanvas.displayName = 'FacebookWorkflowCanvas';
