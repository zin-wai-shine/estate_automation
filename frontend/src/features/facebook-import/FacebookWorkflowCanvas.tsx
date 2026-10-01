import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import {
  FiCpu,
  FiPlay,
  FiRefreshCw,
  FiCheckCircle,
  FiFileText,
  FiImage,
  FiSettings,
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
  FiX,
  FiLayers,
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa';
import { SiGooglegemini } from 'react-icons/si';

export interface DynamicAIBoxConfig {
  id: string;
  title: string;
  processType: 'rental' | 'sale' | 'tiktok' | 'line_oa' | 'seo_tags' | 'custom';
  provider: 'google_ai' | 'openai';
  model: string;
  templateId: string;
  templateText: string;
  customPrompt: string;
  enabled: boolean;
  x: number;
  y: number;
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
    y: 120,
  },
  getImages: {
    enabled: true,
    downloadHD: true,
    preserveOrder: true,
    watermark: false,
    x: 340,
    y: 320,
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
      y: 100,
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
      y: 280,
    },
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
        return {
          ...DEFAULT_FB_WORKFLOW_CONFIG,
          ...parsed,
          getContent: { ...DEFAULT_FB_WORKFLOW_CONFIG.getContent, ...parsed.getContent },
          getImages: { ...DEFAULT_FB_WORKFLOW_CONFIG.getImages, ...parsed.getImages },
          trigger: { ...DEFAULT_FB_WORKFLOW_CONFIG.trigger, ...parsed.trigger },
          destination: { ...DEFAULT_FB_WORKFLOW_CONFIG.destination, ...parsed.destination },
          aiBoxes: parsed.aiBoxes.length > 0 ? parsed.aiBoxes : DEFAULT_FB_WORKFLOW_CONFIG.aiBoxes,
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

export type ActiveModalNode =
  | { type: 'trigger' }
  | { type: 'get-content' }
  | { type: 'get-images' }
  | { type: 'ai-box'; boxId: string }
  | { type: 'destination' }
  | null;

interface FacebookWorkflowCanvasProps {
  initialConfig?: FacebookWorkflowConfig;
  onSwitchToLiveImport?: () => void;
  onConfigChange?: (config: FacebookWorkflowConfig) => void;
}

export const FacebookWorkflowCanvas: React.FC<FacebookWorkflowCanvasProps> = ({
  initialConfig,
  onSwitchToLiveImport,
  onConfigChange,
}) => {
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

  // Node Modal State
  const [activeModalNode, setActiveModalNode] = useState<ActiveModalNode>(null);
  const dragStartCoord = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

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

  // Add Dynamic AI Box
  const handleAddAIBox = () => {
    const newId = `ai-box-${Date.now()}`;
    const boxCount = config.aiBoxes.length;
    const newY = 80 + boxCount * 140;

    const newBox: DynamicAIBoxConfig = {
      id: newId,
      title: `AI Process #${boxCount + 1}`,
      processType: 'rental',
      provider: boxCount % 2 === 0 ? 'google_ai' : 'openai',
      model: boxCount % 2 === 0 ? 'gemini-flash-latest' : 'gpt-4o',
      templateId: '1',
      templateText:
        'Generate optimized marketing copy for this property listing.\nHighlight rent/sale price, transit access, and clear call-to-action.',
      customPrompt: '',
      enabled: true,
      x: 640,
      y: newY,
    };

    const newConfig = {
      ...config,
      aiBoxes: [...config.aiBoxes, newBox],
    };
    updateConfig(newConfig);
    setSelectedBoxId(newId);
    setActiveModalNode({ type: 'ai-box', boxId: newId });
  };

  // Delete Dynamic AI Box
  const handleDeleteAIBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (config.aiBoxes.length <= 1) {
      alert('You must have at least one AI process box in the workflow.');
      return;
    }
    const newBoxes = config.aiBoxes.filter((b) => b.id !== id);
    const newConfig = {
      ...config,
      aiBoxes: newBoxes,
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

  // Reset Layout to pristine aligned grid
  const handleResetLayout = () => {
    const defaultBoxes = config.aiBoxes.map((box, idx) => ({
      ...box,
      x: 640,
      y: 80 + idx * 150,
    }));

    const resetConfig: FacebookWorkflowConfig = {
      ...config,
      trigger: { x: 80, y: 220, autoImport: config.trigger.autoImport },
      getContent: { ...config.getContent, x: 340, y: 120 },
      getImages: { ...config.getImages, x: 340, y: 320 },
      destination: { x: 960, y: 220 },
      aiBoxes: defaultBoxes,
    };
    updateConfig(resetConfig);
  };

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
          `3. Triggering ${activeAI.length} AI Generation Models (${activeAI.map((b) => b.model.includes('gemini') ? 'Gemini' : 'GPT-4o').join(', ')})...`
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
    setIsPanning(true);
    setPanStart({ x: e.clientX - config.panOffset.x, y: e.clientY - config.panOffset.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
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

  // Circular Node Dimensions
  const CIRCLE_SIZE = 72;
  const HALF_CIRCLE = CIRCLE_SIZE / 2; // 36

  // Sockets for wires
  const trigOutContent = { x: config.trigger.x + CIRCLE_SIZE, y: config.trigger.y + HALF_CIRCLE - 10 };
  const trigOutImages = { x: config.trigger.x + CIRCLE_SIZE, y: config.trigger.y + HALF_CIRCLE + 10 };

  const contentIn = { x: config.getContent.x, y: config.getContent.y + HALF_CIRCLE };
  const contentOut = { x: config.getContent.x + CIRCLE_SIZE, y: config.getContent.y + HALF_CIRCLE };

  const imagesIn = { x: config.getImages.x, y: config.getImages.y + HALF_CIRCLE };
  const imagesOut = { x: config.getImages.x + CIRCLE_SIZE, y: config.getImages.y + HALF_CIRCLE };

  const destInTop = { x: config.destination.x, y: config.destination.y + HALF_CIRCLE - 10 };
  const destInBottom = { x: config.destination.x, y: config.destination.y + HALF_CIRCLE + 10 };

  // Currently active AI Box in modal (if applicable)
  const currentModalAIBox = activeModalNode?.type === 'ai-box'
    ? config.aiBoxes.find((b) => b.id === activeModalNode.boxId)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes n8nFlow {
          from { stroke-dashoffset: 28; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.85; filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.7)); }
          50% { opacity: 1; filter: drop-shadow(0 0 18px rgba(59, 130, 246, 1)); }
        }
      `}</style>

      {/* Top Workflow Control Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          backgroundColor: 'var(--bg-surface)',
          padding: '0.625rem 1rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Badge variant="info" size="sm">Visual Graph</Badge>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Click any circle node to configure details
            </span>
          </div>

          {/* Quick Stats Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                padding: '2px 7px',
                borderRadius: '4px',
                backgroundColor: config.getContent.enabled ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                color: config.getContent.enabled ? '#60A5FA' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: config.getContent.enabled ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
              }}
            >
              Content: {config.getContent.enabled ? '100% Full' : 'OFF'}
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                padding: '2px 7px',
                borderRadius: '4px',
                backgroundColor: config.getImages.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                color: config.getImages.enabled ? '#34D399' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: config.getImages.enabled ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
              }}
            >
              Images: {config.getImages.enabled ? 'All Media' : 'OFF'}
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                padding: '2px 7px',
                borderRadius: '4px',
                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                color: '#C4B5FD',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              {config.aiBoxes.length} AI Nodes
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddAIBox}
            leftIcon={<FiPlus style={{ color: '#10B981' }} />}
            style={{ height: '32px', fontSize: '0.75rem', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10B981' }}
          >
            + Add Dynamic AI Node
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRunSimulation}
            disabled={isSimulating}
            leftIcon={
              isSimulating ? (
                <FiRefreshCw className="spin" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <FiPlay />
              )
            }
            style={{
              height: '32px',
              fontSize: '0.75rem',
              backgroundColor: isSimulating ? 'rgba(24, 119, 242, 0.1)' : undefined,
            }}
          >
            {isSimulating ? 'Simulating...' : 'Test Flow'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetLayout}
            leftIcon={<FiCrosshair />}
            style={{ height: '32px', fontSize: '0.75rem' }}
          >
            Reset Layout
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveConfig}
            leftIcon={saveSuccess ? <FiCheck /> : <FiCheckCircle />}
            style={{
              height: '32px',
              fontSize: '0.75rem',
              backgroundColor: saveSuccess ? 'var(--status-success)' : undefined,
            }}
          >
            {saveSuccess ? 'Saved!' : 'Save Workflow'}
          </Button>

          {onSwitchToLiveImport && (
            <Button
              variant="primary"
              size="sm"
              onClick={onSwitchToLiveImport}
              leftIcon={<FiArrowRight />}
              style={{
                height: '32px',
                fontSize: '0.75rem',
                background: 'linear-gradient(135deg, #1877F2 0%, #3B82F6 100%)',
              }}
            >
              Use in Live Import
            </Button>
          )}
        </div>
      </div>

      {/* Simulation Banner Notification */}
      {simulationMessage && (
        <div
          style={{
            backgroundColor: isSimulating ? 'rgba(24, 119, 242, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${isSimulating ? '#1877F2' : '#10B981'}`,
            borderRadius: '0.5rem',
            padding: '0.625rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            fontSize: '0.8125rem',
            color: '#FFFFFF',
            boxShadow: 'var(--shadow-sm)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {isSimulating ? (
            <FiRefreshCw className="spin" style={{ animation: 'spin 1s linear infinite', color: '#60A5FA' }} />
          ) : (
            <FiCheckCircle style={{ color: '#10B981' }} />
          )}
          <span style={{ fontWeight: 500 }}>{simulationMessage}</span>
        </div>
      )}

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
          height: isFullscreen ? '94vh' : '640px',
          backgroundColor: '#0D1117',
          backgroundImage: `
            radial-gradient(circle, rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px)
          `,
          backgroundSize: '24px 24px',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          cursor: isPanning ? 'grabbing' : 'default',
          userSelect: 'none',
          boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.8)',
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
            backgroundColor: 'rgba(22, 27, 34, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '4px 6px',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
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
            <defs>
              <linearGradient id="flow-content-active" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1877F2" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>

              <linearGradient id="flow-images-active" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1877F2" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>

              <linearGradient id="flow-ai-active" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>

            {/* 1. Trigger -> Get Content Line */}
            {(() => {
              const path = createBezierPath(trigOutContent, contentIn);
              const isFlowing = config.getContent.enabled;
              return (
                <g key="wire-trigger-content">
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)'}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'url(#flow-content-active)' : 'rgba(255, 255, 255, 0.2)'}
                    strokeWidth="2.5"
                    strokeDasharray={isFlowing ? '6, 6' : '4, 4'}
                    strokeLinecap="round"
                    style={{
                      animation: isFlowing ? 'n8nFlow 1.2s linear infinite' : 'none',
                    }}
                  />
                </g>
              );
            })()}

            {/* 2. Trigger -> Get Images Line */}
            {(() => {
              const path = createBezierPath(trigOutImages, imagesIn);
              const isFlowing = config.getImages.enabled;
              return (
                <g key="wire-trigger-images">
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)'}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'url(#flow-images-active)' : 'rgba(255, 255, 255, 0.2)'}
                    strokeWidth="2.5"
                    strokeDasharray={isFlowing ? '6, 6' : '4, 4'}
                    strokeLinecap="round"
                    style={{
                      animation: isFlowing ? 'n8nFlow 1.2s linear infinite' : 'none',
                    }}
                  />
                </g>
              );
            })()}

            {/* 3. Get Images -> Destination Line */}
            {(() => {
              const path = createBezierPath(imagesOut, destInBottom);
              const isFlowing = config.getImages.enabled;
              return (
                <g key="wire-images-dest">
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)'}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? '#10B981' : 'rgba(255, 255, 255, 0.2)'}
                    strokeWidth="2.5"
                    strokeDasharray={isFlowing ? '6, 6' : '4, 4'}
                    strokeLinecap="round"
                    style={{
                      animation: isFlowing ? 'n8nFlow 1.2s linear infinite' : 'none',
                    }}
                  />
                </g>
              );
            })()}

            {/* 4. Get Content -> Each AI Box Lines */}
            {config.aiBoxes.map((aiBox) => {
              const aiIn = { x: aiBox.x, y: aiBox.y + HALF_CIRCLE };
              const path = createBezierPath(contentOut, aiIn);
              const isFlowing = config.getContent.enabled && aiBox.enabled;

              return (
                <g key={`wire-content-ai-${aiBox.id}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)'}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'url(#flow-ai-active)' : 'rgba(255, 255, 255, 0.2)'}
                    strokeWidth="2.5"
                    strokeDasharray={isFlowing ? '6, 6' : '4, 4'}
                    strokeLinecap="round"
                    style={{
                      animation: isFlowing ? 'n8nFlow 1.2s linear infinite' : 'none',
                    }}
                  />
                </g>
              );
            })}

            {/* 5. Each AI Box -> Destination Lines */}
            {config.aiBoxes.map((aiBox) => {
              const aiOut = { x: aiBox.x + CIRCLE_SIZE, y: aiBox.y + HALF_CIRCLE };
              const path = createBezierPath(aiOut, destInTop);
              const isFlowing = aiBox.enabled;

              return (
                <g key={`wire-ai-dest-${aiBox.id}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)'}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? '#A78BFA' : 'rgba(255, 255, 255, 0.2)'}
                    strokeWidth="2.5"
                    strokeDasharray={isFlowing ? '6, 6' : '4, 4'}
                    strokeLinecap="round"
                    style={{
                      animation: isFlowing ? 'n8nFlow 1.2s linear infinite' : 'none',
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* ======================================================== */}
          {/* NODE 1: FACEBOOK URL IMPORTER (TRIGGER CIRCLE)           */}
          {/* ======================================================== */}
          <div
            className="canvas-node"
            onMouseDown={(e) => startDragNode('trigger', e)}
            onClick={(e) => handleNodeClick({ type: 'trigger' }, e)}
            title="Click to configure Facebook Importer Trigger"
            style={{
              position: 'absolute',
              left: `${config.trigger.x}px`,
              top: `${config.trigger.y}px`,
              width: `${CIRCLE_SIZE}px`,
              height: `${CIRCLE_SIZE}px`,
              borderRadius: '50%',
              backgroundColor: '#161B22',
              backgroundImage: 'radial-gradient(circle at 35% 35%, rgba(24, 119, 242, 0.4) 0%, #161B22 100%)',
              border: simulationStep === 0 ? '2.5px solid #1877F2' : '2px solid rgba(24, 119, 242, 0.7)',
              boxShadow: simulationStep === 0
                ? '0 0 25px rgba(24, 119, 242, 0.85)'
                : '0 0 16px rgba(24, 119, 242, 0.35), 0 8px 24px rgba(0, 0, 0, 0.6)',
              zIndex: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <FaFacebook style={{ fontSize: '30px', color: '#1877F2', filter: 'drop-shadow(0 2px 6px rgba(24, 119, 242, 0.5))' }} />

            {/* Output Socket: Content */}
            <div
              style={{
                position: 'absolute',
                right: '-6px',
                top: `${HALF_CIRCLE - 14}px`,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#3B82F6',
                border: '2px solid #161B22',
                boxShadow: '0 0 8px #3B82F6',
              }}
            />
            {/* Output Socket: Images */}
            <div
              style={{
                position: 'absolute',
                right: '-6px',
                top: `${HALF_CIRCLE + 2}px`,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                border: '2px solid #161B22',
                boxShadow: '0 0 8px #10B981',
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
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                Facebook Post
              </span>
              <span style={{ fontSize: '0.625rem', color: '#60A5FA', fontWeight: 500, backgroundColor: 'rgba(0,0,0,0.7)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                Trigger • Auto
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
            title="Click to configure Get Content"
            style={{
              position: 'absolute',
              left: `${config.getContent.x}px`,
              top: `${config.getContent.y}px`,
              width: `${CIRCLE_SIZE}px`,
              height: `${CIRCLE_SIZE}px`,
              borderRadius: '50%',
              backgroundColor: '#161B22',
              backgroundImage: config.getContent.enabled
                ? 'radial-gradient(circle at 35% 35%, rgba(59, 130, 246, 0.4) 0%, #161B22 100%)'
                : 'none',
              border: simulationStep === 1
                ? '2.5px solid #3B82F6'
                : config.getContent.enabled
                ? '2px solid rgba(59, 130, 246, 0.7)'
                : '2px dashed rgba(255, 255, 255, 0.2)',
              opacity: config.getContent.enabled ? 1 : 0.5,
              boxShadow: simulationStep === 1
                ? '0 0 25px rgba(59, 130, 246, 0.85)'
                : config.getContent.enabled
                ? '0 0 16px rgba(59, 130, 246, 0.35), 0 8px 24px rgba(0, 0, 0, 0.6)'
                : 'none',
              zIndex: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <FiFileText style={{ fontSize: '28px', color: config.getContent.enabled ? '#3B82F6' : '#9CA3AF' }} />

            {/* Input Socket (Left) */}
            <div
              style={{
                position: 'absolute',
                left: '-6px',
                top: `${HALF_CIRCLE - 6}px`,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: config.getContent.enabled ? '#3B82F6' : '#6B7280',
                border: '2px solid #161B22',
                boxShadow: config.getContent.enabled ? '0 0 8px #3B82F6' : 'none',
              }}
            />
            {/* Output Socket (Right) */}
            <div
              style={{
                position: 'absolute',
                right: '-6px',
                top: `${HALF_CIRCLE - 6}px`,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: config.getContent.enabled ? '#3B82F6' : '#6B7280',
                border: '2px solid #161B22',
                boxShadow: config.getContent.enabled ? '0 0 8px #3B82F6' : 'none',
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
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                Get Content
              </span>
              <span
                style={{
                  fontSize: '0.625rem',
                  color: config.getContent.enabled ? '#60A5FA' : '#9CA3AF',
                  fontWeight: 500,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: `1px solid ${config.getContent.enabled ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {config.getContent.enabled ? 'Full Content' : 'OFF'}
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
            title="Click to configure Get Images"
            style={{
              position: 'absolute',
              left: `${config.getImages.x}px`,
              top: `${config.getImages.y}px`,
              width: `${CIRCLE_SIZE}px`,
              height: `${CIRCLE_SIZE}px`,
              borderRadius: '50%',
              backgroundColor: '#161B22',
              backgroundImage: config.getImages.enabled
                ? 'radial-gradient(circle at 35% 35%, rgba(16, 185, 129, 0.4) 0%, #161B22 100%)'
                : 'none',
              border: simulationStep === 1
                ? '2.5px solid #10B981'
                : config.getImages.enabled
                ? '2px solid rgba(16, 185, 129, 0.7)'
                : '2px dashed rgba(255, 255, 255, 0.2)',
              opacity: config.getImages.enabled ? 1 : 0.5,
              boxShadow: simulationStep === 1
                ? '0 0 25px rgba(16, 185, 129, 0.85)'
                : config.getImages.enabled
                ? '0 0 16px rgba(16, 185, 129, 0.35), 0 8px 24px rgba(0, 0, 0, 0.6)'
                : 'none',
              zIndex: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <FiImage style={{ fontSize: '28px', color: config.getImages.enabled ? '#10B981' : '#9CA3AF' }} />

            {/* Input Socket (Left) */}
            <div
              style={{
                position: 'absolute',
                left: '-6px',
                top: `${HALF_CIRCLE - 6}px`,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: config.getImages.enabled ? '#10B981' : '#6B7280',
                border: '2px solid #161B22',
                boxShadow: config.getImages.enabled ? '0 0 8px #10B981' : 'none',
              }}
            />
            {/* Output Socket (Right) */}
            <div
              style={{
                position: 'absolute',
                right: '-6px',
                top: `${HALF_CIRCLE - 6}px`,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: config.getImages.enabled ? '#10B981' : '#6B7280',
                border: '2px solid #161B22',
                boxShadow: config.getImages.enabled ? '0 0 8px #10B981' : 'none',
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
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                Get Images
              </span>
              <span
                style={{
                  fontSize: '0.625rem',
                  color: config.getImages.enabled ? '#34D399' : '#9CA3AF',
                  fontWeight: 500,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: `1px solid ${config.getImages.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {config.getImages.enabled ? 'All Media' : 'OFF'}
              </span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* NODE 3: DYNAMIC MULTI-BOX AI PROCESSORS (CIRCLES)        */}
          {/* ======================================================== */}
          {config.aiBoxes.map((box) => {
            const isSelected = selectedBoxId === box.id;
            const isCurrentSimulating = simulationStep === 2 && box.enabled;
            const isGoogle = box.provider === 'google_ai';
            const themeColor = isGoogle ? '#60A5FA' : '#10B981';

            return (
              <div
                key={box.id}
                className="canvas-node"
                onMouseDown={(e) => startDragNode(box.id, e)}
                onClick={(e) => handleNodeClick({ type: 'ai-box', boxId: box.id }, e)}
                title={`Click to configure ${box.title}`}
                style={{
                  position: 'absolute',
                  left: `${box.x}px`,
                  top: `${box.y}px`,
                  width: `${CIRCLE_SIZE}px`,
                  height: `${CIRCLE_SIZE}px`,
                  borderRadius: '50%',
                  backgroundColor: '#161B22',
                  backgroundImage: box.enabled
                    ? `radial-gradient(circle at 35% 35%, ${isGoogle ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.4)'} 0%, #161B22 100%)`
                    : 'none',
                  border: isCurrentSimulating
                    ? '2.5px solid #8B5CF6'
                    : isSelected
                    ? '2.5px solid #A78BFA'
                    : box.enabled
                    ? `2px solid ${themeColor}`
                    : '2px dashed rgba(255, 255, 255, 0.2)',
                  opacity: box.enabled ? 1 : 0.5,
                  boxShadow: isCurrentSimulating
                    ? '0 0 25px rgba(139, 92, 246, 0.85)'
                    : box.enabled
                    ? `0 0 16px ${isGoogle ? 'rgba(59, 130, 246, 0.35)' : 'rgba(16, 185, 129, 0.35)'}, 0 8px 24px rgba(0, 0, 0, 0.6)`
                    : 'none',
                  zIndex: isSelected ? 20 : 15,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {/* Center Icon */}
                {isGoogle ? (
                  <SiGooglegemini style={{ fontSize: '28px', color: box.enabled ? '#60A5FA' : '#9CA3AF' }} />
                ) : (
                  <OpenAIIcon size={28} color={box.enabled ? '#10B981' : '#9CA3AF'} />
                )}

                {/* Input Socket (Left) */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-6px',
                    top: `${HALF_CIRCLE - 6}px`,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: box.enabled ? '#8B5CF6' : '#6B7280',
                    border: '2px solid #161B22',
                    boxShadow: box.enabled ? '0 0 8px #8B5CF6' : 'none',
                  }}
                />
                {/* Output Socket (Right) */}
                <div
                  style={{
                    position: 'absolute',
                    right: '-6px',
                    top: `${HALF_CIRCLE - 6}px`,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: box.enabled ? '#8B5CF6' : '#6B7280',
                    border: '2px solid #161B22',
                    boxShadow: box.enabled ? '0 0 8px #8B5CF6' : 'none',
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
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                    {box.title}
                  </span>
                  <span
                    style={{
                      fontSize: '0.625rem',
                      color: isGoogle ? '#93C5FD' : '#6EE7B7',
                      fontWeight: 500,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: `1px solid ${themeColor}40`,
                    }}
                  >
                    {isGoogle ? 'Gemini' : 'GPT-4o'} • {box.enabled ? 'ON' : 'OFF'}
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
            title="Click to view Property Inbox Destination details"
            style={{
              position: 'absolute',
              left: `${config.destination.x}px`,
              top: `${config.destination.y}px`,
              width: `${CIRCLE_SIZE}px`,
              height: `${CIRCLE_SIZE}px`,
              borderRadius: '50%',
              backgroundColor: '#161B22',
              backgroundImage: 'radial-gradient(circle at 35% 35%, rgba(16, 185, 129, 0.4) 0%, #161B22 100%)',
              border: simulationStep === 3 ? '2.5px solid #10B981' : '2px solid rgba(16, 185, 129, 0.7)',
              boxShadow: simulationStep === 3
                ? '0 0 25px rgba(16, 185, 129, 0.85)'
                : '0 0 16px rgba(16, 185, 129, 0.35), 0 8px 24px rgba(0, 0, 0, 0.6)',
              zIndex: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <FiCheckCircle style={{ fontSize: '30px', color: '#10B981', filter: 'drop-shadow(0 2px 6px rgba(16, 185, 129, 0.5))' }} />

            {/* Input Socket: AI inputs (Top) */}
            <div
              style={{
                position: 'absolute',
                left: '-6px',
                top: `${HALF_CIRCLE - 14}px`,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#8B5CF6',
                border: '2px solid #161B22',
                boxShadow: '0 0 8px #8B5CF6',
              }}
            />
            {/* Input Socket: Images (Bottom) */}
            <div
              style={{
                position: 'absolute',
                left: '-6px',
                top: `${HALF_CIRCLE + 2}px`,
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                border: '2px solid #161B22',
                boxShadow: '0 0 8px #10B981',
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
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                Property Inbox
              </span>
              <span style={{ fontSize: '0.625rem', color: '#34D399', fontWeight: 500, backgroundColor: 'rgba(0,0,0,0.7)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                Destination • Ready
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
          onClose={() => setActiveModalNode(null)}
          maxWidth="560px"
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                {currentModalAIBox.provider === 'openai' ? (
                  <OpenAIIcon size={20} />
                ) : (
                  <SiGooglegemini style={{ fontSize: '20px', color: '#60A5FA' }} />
                )}
                <span>Configure AI Process: {currentModalAIBox.title}</span>
              </div>
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

          {/* DYNAMIC AI BOX MODAL CONTENT */}
          {activeModalNode.type === 'ai-box' && currentModalAIBox && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Box Title & Enable Toggle */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Node Title
                  </label>
                  <input
                    type="text"
                    value={currentModalAIBox.title}
                    onChange={(e) => handleUpdateAIBox(currentModalAIBox.id, { title: e.target.value })}
                    style={{
                      width: '100%',
                      height: '34px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.375rem',
                      padding: '0 0.625rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => handleToggleAIBox(currentModalAIBox.id)}
                    style={{
                      height: '34px',
                      padding: '0 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      borderRadius: '0.375rem',
                      border: `1px solid ${currentModalAIBox.enabled ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}`,
                      backgroundColor: currentModalAIBox.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
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
                    <span>{currentModalAIBox.enabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>
              </div>

              {/* Process Type Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Target Process Type
                </label>
                <Select
                  options={PROCESS_TYPE_OPTIONS}
                  value={currentModalAIBox.processType}
                  onChange={(val) => handleUpdateAIBox(currentModalAIBox.id, { processType: val as any })}
                  height="34px"
                />
              </div>

              {/* Provider Selection Tabs */}
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  AI Engine & Provider
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateAIBox(currentModalAIBox.id, {
                        provider: 'google_ai',
                        model: 'gemini-flash-latest',
                      })
                    }
                    style={{
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      borderRadius: '0.375rem',
                      border: `1.5px solid ${currentModalAIBox.provider === 'google_ai' ? '#3B82F6' : 'var(--border-color)'}`,
                      backgroundColor: currentModalAIBox.provider === 'google_ai' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-main)',
                      color: currentModalAIBox.provider === 'google_ai' ? '#60A5FA' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <SiGooglegemini style={{ fontSize: '15px' }} />
                    <span>Google Gemini</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateAIBox(currentModalAIBox.id, {
                        provider: 'openai',
                        model: 'gpt-4o',
                      })
                    }
                    style={{
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      borderRadius: '0.375rem',
                      border: `1.5px solid ${currentModalAIBox.provider === 'openai' ? '#10B981' : 'var(--border-color)'}`,
                      backgroundColor: currentModalAIBox.provider === 'openai' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-main)',
                      color: currentModalAIBox.provider === 'openai' ? '#34D399' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <OpenAIIcon size={15} />
                    <span>OpenAI ChatGPT</span>
                  </button>
                </div>

                <Select
                  options={
                    currentModalAIBox.provider === 'google_ai'
                      ? [
                          { value: 'gemini-flash-latest', label: 'Gemini Flash (Ultra Fast & Responsive)' },
                          { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Deep Multimodal Reasoning)' },
                        ]
                      : [
                          { value: 'gpt-4o', label: 'GPT-4o (Omni High Precision)' },
                          { value: 'gpt-4o-mini', label: 'GPT-4o-mini (Lightweight & Economical)' },
                        ]
                  }
                  value={currentModalAIBox.model}
                  onChange={(val) => handleUpdateAIBox(currentModalAIBox.id, { model: val })}
                  height="34px"
                />
              </div>

              {/* Custom Prompt Instructions */}
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Custom Prompt Instructions (Optional)
                </label>
                <textarea
                  value={currentModalAIBox.customPrompt}
                  onChange={(e) => handleUpdateAIBox(currentModalAIBox.id, { customPrompt: e.target.value })}
                  rows={3}
                  placeholder="e.g. emphasize price negotiable, BTS Thong Lo 2 mins, urgent sale, contact via LINE ID..."
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.375rem',
                    padding: '0.5rem 0.625rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Modal Footer Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-color)',
                  marginTop: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleDuplicateAIBox(currentModalAIBox, e)}
                    leftIcon={<FiCopy />}
                    style={{ height: '32px', fontSize: '0.75rem' }}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleDeleteAIBox(currentModalAIBox.id, e)}
                    leftIcon={<FiTrash2 style={{ color: '#EF4444' }} />}
                    style={{ height: '32px', fontSize: '0.75rem', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#EF4444' }}
                  >
                    Delete Node
                  </Button>
                </div>

                <Button variant="primary" size="sm" onClick={() => setActiveModalNode(null)}>
                  Done
                </Button>
              </div>
            </div>
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
};
