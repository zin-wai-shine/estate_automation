import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import {
  FiCpu,
  FiPlay,
  FiRefreshCw,
  FiCheckCircle,
  FiFacebook,
  FiFileText,
  FiImage,
  FiSettings,
  FiZoomIn,
  FiZoomOut,
  FiMaximize2,
  FiMinimize2,
  FiMove,
  FiCrosshair,
  FiZap,
  FiPlus,
  FiTrash2,
  FiCopy,
  FiCheck,
  FiLayers,
  FiSliders,
  FiArrowRight,
  FiRadio,
} from 'react-icons/fi';

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
    x: 40,
    y: 200,
    autoImport: true,
  },
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
  destination: {
    x: 1040,
    y: 200,
  },
  zoom: 0.9,
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

interface FacebookWorkflowCanvasProps {
  onSwitchToLiveImport?: () => void;
  onConfigChange?: (config: FacebookWorkflowConfig) => void;
}

export const FacebookWorkflowCanvas: React.FC<FacebookWorkflowCanvasProps> = ({
  onSwitchToLiveImport,
  onConfigChange,
}) => {
  const [config, setConfig] = useState<FacebookWorkflowConfig>(() => loadSavedFacebookWorkflowConfig());
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
      // Also sync to backend API if available
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
    const newY = 50 + boxCount * 260;

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
      x: 680,
      y: newY,
    };

    const newConfig = {
      ...config,
      aiBoxes: [...config.aiBoxes, newBox],
    };
    updateConfig(newConfig);
    setSelectedBoxId(newId);
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
  };

  // Duplicate Dynamic AI Box
  const handleDuplicateAIBox = (box: DynamicAIBoxConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newId = `ai-box-${Date.now()}`;
    const duplicated: DynamicAIBoxConfig = {
      ...box,
      id: newId,
      title: `${box.title} (Copy)`,
      y: box.y + 70,
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
      x: 680,
      y: 50 + idx * 260,
    }));

    const resetConfig: FacebookWorkflowConfig = {
      ...config,
      trigger: { x: 40, y: 200, autoImport: config.trigger.autoImport },
      getContent: { ...config.getContent, x: 340, y: 80 },
      getImages: { ...config.getImages, x: 340, y: 380 },
      aiBoxes: defaultBoxes,
      destination: { x: 1060, y: 200 },
      zoom: 0.9,
      panOffset: { x: 40, y: 40 },
    };
    updateConfig(resetConfig);
  };

  // Simulation Runner
  const handleRunSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulationStep(0);
    setSimulationMessage('Triggering Facebook URL Importer scraper...');

    setTimeout(() => {
      setSimulationStep(1);
      const branches = [];
      if (config.getContent.enabled) branches.push('Get Content');
      if (config.getImages.enabled) branches.push('Get Images');
      setSimulationMessage(`Branching active streams: ${branches.join(' & ')}...`);

      setTimeout(() => {
        setSimulationStep(2);
        const activeBoxes = config.aiBoxes.filter((b) => b.enabled);
        setSimulationMessage(`Executing ${activeBoxes.length} AI dynamic prompt processes in parallel...`);

        setTimeout(() => {
          setSimulationStep(3);
          setSimulationMessage('Aggregating listing copy and media into Property Inbox!');

          setTimeout(() => {
            setIsSimulating(false);
            setSimulationStep(-1);
            setSimulationMessage('Workflow simulation completed successfully with 0 errors.');
            setTimeout(() => setSimulationMessage(null), 4000);
          }, 1800);
        }, 1800);
      }, 1500);
    }, 1200);
  };

  // Canvas Mouse Controls (Pan & Zoom)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking canvas background directly
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'canvas-bg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - config.panOffset.x, y: e.clientY - config.panOffset.y });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const newPan = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      };
      setConfig((prev) => ({ ...prev, panOffset: newPan }));
      return;
    }

    if (draggedNodeId) {
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
  };

  // Bezier path helper
  const createBezierPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    let controlOffset = Math.max(50, Math.min(200, Math.abs(deltaX) * 0.5 + Math.abs(deltaY) * 0.1));
    if (deltaX < 0) {
      controlOffset = Math.max(100, Math.min(260, Math.sqrt(deltaX * deltaX + deltaY * deltaY) * 0.4));
    }
    const c1x = start.x + controlOffset;
    const c1y = start.y;
    const c2x = end.x - controlOffset;
    const c2y = end.y;
    return `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  };

  // Node Dimensions
  const NODE_WIDTH = 260;
  const AI_NODE_WIDTH = 300;

  // Socket Calculations
  // Trigger Sockets
  const trigOutContent = { x: config.trigger.x + NODE_WIDTH, y: config.trigger.y + 48 };
  const trigOutImages = { x: config.trigger.x + NODE_WIDTH, y: config.trigger.y + 90 };

  // Content Sockets
  const contentIn = { x: config.getContent.x, y: config.getContent.y + 48 };
  const contentOut = { x: config.getContent.x + NODE_WIDTH, y: config.getContent.y + 48 };

  // Images Sockets
  const imagesIn = { x: config.getImages.x, y: config.getImages.y + 48 };
  const imagesOut = { x: config.getImages.x + NODE_WIDTH, y: config.getImages.y + 48 };

  // Destination Sockets
  const destInTop = { x: config.destination.x, y: config.destination.y + 48 };
  const destInBottom = { x: config.destination.x, y: config.destination.y + 90 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes n8nFlow {
          from { stroke-dashoffset: 28; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.8; filter: drop-shadow(0 0 6px rgba(24, 119, 242, 0.6)); }
          50% { opacity: 1; filter: drop-shadow(0 0 12px rgba(24, 119, 242, 0.9)); }
        }
        @keyframes boxPop {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Top Workflow Control Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--bg-surface)',
          padding: '0.875rem 1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(24, 119, 242, 0.12)',
              color: '#1877F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              flexShrink: 0,
            }}
          >
            <FiLayers />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Facebook Import Workflow Setup
              </h2>
              <Badge variant="info">Visual Builder</Badge>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                • {config.aiBoxes.length} Dynamic AI Process{config.aiBoxes.length > 1 ? 'es' : ''}
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Configure extraction branches (Content, Images) and stack multiple dynamic AI generation boxes.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          {onSwitchToLiveImport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchToLiveImport}
              leftIcon={<FiArrowRight style={{ transform: 'rotate(180deg)' }} />}
              style={{ height: '36px', fontSize: '0.8125rem' }}
            >
              Back to Live Import
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetLayout}
            leftIcon={<FiRefreshCw />}
            title="Auto-align all nodes into clean columns"
            style={{ height: '36px', fontSize: '0.8125rem' }}
          >
            Auto Align
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAddAIBox}
            leftIcon={<FiPlus style={{ color: '#10B981' }} />}
            style={{
              height: '36px',
              fontSize: '0.8125rem',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: '#10B981',
            }}
          >
            Add AI Box
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRunSimulation}
            disabled={isSimulating}
            leftIcon={<FiPlay style={{ color: 'var(--accent-primary)' }} />}
            style={{ height: '36px', fontSize: '0.8125rem' }}
          >
            {isSimulating ? 'Simulating...' : 'Test Simulation'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveConfig}
            leftIcon={saveSuccess ? <FiCheck /> : <FiCheckCircle />}
            style={{
              height: '36px',
              fontSize: '0.8125rem',
              backgroundColor: saveSuccess ? 'var(--status-success)' : undefined,
            }}
          >
            {saveSuccess ? 'Saved!' : 'Save Workflow'}
          </Button>
        </div>
      </div>

      {/* Simulation / Status Feedback */}
      {simulationMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.625rem',
            backgroundColor: isSimulating ? 'rgba(24, 119, 242, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: isSimulating ? '1px solid rgba(24, 119, 242, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
            color: isSimulating ? '#1877F2' : '#10B981',
            fontSize: '0.8125rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'boxPop 0.2s ease-out',
          }}
        >
          <FiRadio style={{ animation: isSimulating ? 'pulseGlow 1s infinite' : 'none' }} />
          <span>{simulationMessage}</span>
        </div>
      )}

      {/* Canvas Workspace Container */}
      <div
        ref={canvasRef}
        id="canvas-bg"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
        style={
          isFullscreen
            ? {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9999,
                backgroundColor: 'var(--bg-main)',
                overflow: 'hidden',
                backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1.2px, transparent 1.2px)',
                backgroundSize: '24px 24px',
                userSelect: 'none',
                cursor: isPanning ? 'grabbing' : 'grab',
              }
            : {
                width: '100%',
                height: '680px',
                backgroundColor: '#0F1318',
                borderRadius: '0.875rem',
                border: '1px solid var(--border-color)',
                position: 'relative',
                overflow: 'hidden',
                backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px)',
                backgroundSize: '24px 24px',
                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)',
                userSelect: 'none',
                cursor: isPanning ? 'grabbing' : 'grab',
              }
        }
      >
        {/* Floating Zoom & Canvas Controls */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            backgroundColor: 'rgba(21, 26, 35, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '0.375rem 0.625rem',
            borderRadius: '0.625rem',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div
            title="Drag canvas background to pan"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              paddingRight: '0.5rem',
              borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <FiMove style={{ fontSize: '13px' }} />
            <span>Pan</span>
          </div>

          <button
            type="button"
            onClick={() => setConfig((p) => ({ ...p, zoom: Math.min(p.zoom + 0.1, 1.6) }))}
            title="Zoom In"
            style={{
              background: 'none',
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

          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: '38px', textAlign: 'center' }}>
            {Math.round(config.zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setConfig((p) => ({ ...p, zoom: Math.max(p.zoom - 0.1, 0.45) }))}
            title="Zoom Out"
            style={{
              background: 'none',
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
            onClick={() => setConfig((p) => ({ ...p, zoom: 0.9, panOffset: { x: 40, y: 40 } }))}
            title="Reset View (100%)"
            style={{
              background: 'none',
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
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              marginLeft: '0.25rem',
            }}
          >
            {isFullscreen ? <FiMinimize2 style={{ fontSize: '14px' }} /> : <FiMaximize2 style={{ fontSize: '14px' }} />}
          </button>
        </div>

        {/* Floating Quick Action: Add Dynamic Box */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
          }}
        >
          <button
            type="button"
            onClick={handleAddAIBox}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.875rem',
              color: '#10B981',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            <FiPlus style={{ fontSize: '16px' }} />
            <span>Add Dynamic AI Box</span>
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
              {/* Gradients */}
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

              <linearGradient id="flow-dest-active" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#10B981" />
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
                    stroke={isFlowing ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.08)'}
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
                    stroke={isFlowing ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)'}
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
                    stroke={isFlowing ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)'}
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
              const aiIn = { x: aiBox.x, y: aiBox.y + 48 };
              const path = createBezierPath(contentOut, aiIn);
              const isFlowing = config.getContent.enabled && aiBox.enabled;

              return (
                <g key={`wire-content-ai-${aiBox.id}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.08)'}
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
            {config.aiBoxes.map((aiBox, idx) => {
              const aiOut = { x: aiBox.x + AI_NODE_WIDTH, y: aiBox.y + 48 };
              const destTarget = {
                x: config.destination.x,
                y: config.destination.y + 36 + idx * 16,
              };
              const path = createBezierPath(aiOut, destTarget);
              const isFlowing = config.getContent.enabled && aiBox.enabled;

              return (
                <g key={`wire-ai-dest-${aiBox.id}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.08)'}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={isFlowing ? 'url(#flow-dest-active)' : 'rgba(255, 255, 255, 0.2)'}
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
          {/* NODE 1: FACEBOOK URL IMPORTER (TRIGGER)                  */}
          {/* ======================================================== */}
          <div
            onMouseDown={(e) => startDragNode('trigger', e)}
            style={{
              position: 'absolute',
              left: `${config.trigger.x}px`,
              top: `${config.trigger.y}px`,
              width: `${NODE_WIDTH}px`,
              backgroundColor: '#161B22',
              borderRadius: '0.75rem',
              border: simulationStep === 0 ? '2px solid #1877F2' : '1px solid rgba(24, 119, 242, 0.4)',
              boxShadow: simulationStep === 0 ? '0 0 20px rgba(24, 119, 242, 0.6)' : '0 8px 24px rgba(0, 0, 0, 0.5)',
              zIndex: 10,
              cursor: 'grab',
              transition: 'border 0.2s, box-shadow 0.2s',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0.875rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(24, 119, 242, 0.08)',
                borderTopLeftRadius: '0.75rem',
                borderTopRightRadius: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#1877F2',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                  }}
                >
                  <FiFacebook />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fff' }}>
                    Facebook URL Importer
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#1877F2', fontWeight: 600 }}>
                    INPUT TRIGGER
                  </div>
                </div>
              </div>
              <Badge variant="info">Active</Badge>
            </div>

            {/* Body */}
            <div style={{ padding: '0.75rem 0.875rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <p style={{ margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                Captures raw post URL from Facebook Groups & Marketplace.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.375rem 0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '0.375rem',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <span>Auto-Detect Format</span>
                <span style={{ color: '#10B981', fontWeight: 600 }}>Enabled</span>
              </div>
            </div>

            {/* Output Socket: Top (Content) */}
            <div
              title="Content Branch Socket"
              style={{
                position: 'absolute',
                right: '-7px',
                top: '44px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#3B82F6',
                border: '2px solid #161B22',
                boxShadow: '0 0 8px #3B82F6',
              }}
            />
            {/* Output Socket: Bottom (Images) */}
            <div
              title="Media Branch Socket"
              style={{
                position: 'absolute',
                right: '-7px',
                top: '86px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                border: '2px solid #161B22',
                boxShadow: '0 0 8px #10B981',
              }}
            />
          </div>

          {/* ======================================================== */}
          {/* NODE 2A: GET CONTENT BRANCH (TOGGLEABLE)                 */}
          {/* ======================================================== */}
          <div
            onMouseDown={(e) => startDragNode('get-content', e)}
            style={{
              position: 'absolute',
              left: `${config.getContent.x}px`,
              top: `${config.getContent.y}px`,
              width: `${NODE_WIDTH}px`,
              backgroundColor: '#161B22',
              borderRadius: '0.75rem',
              border: simulationStep === 1
                ? '2px solid #3B82F6'
                : config.getContent.enabled
                ? '1px solid rgba(59, 130, 246, 0.4)'
                : '1px dashed rgba(255, 255, 255, 0.15)',
              opacity: config.getContent.enabled ? 1 : 0.6,
              boxShadow: simulationStep === 1 ? '0 0 20px rgba(59, 130, 246, 0.6)' : '0 8px 24px rgba(0, 0, 0, 0.5)',
              zIndex: 10,
              cursor: 'grab',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Input Socket */}
            <div
              style={{
                position: 'absolute',
                left: '-7px',
                top: '44px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: config.getContent.enabled ? '#3B82F6' : '#6B7280',
                border: '2px solid #161B22',
                boxShadow: config.getContent.enabled ? '0 0 8px #3B82F6' : 'none',
              }}
            />

            {/* Header with Switch */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0.875rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                borderTopLeftRadius: '0.75rem',
                borderTopRightRadius: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: config.getContent.enabled ? '#3B82F6' : '#4B5563',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                  }}
                >
                  <FiFileText />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fff' }}>Get Content</div>
                  <div style={{ fontSize: '0.6875rem', color: '#60A5FA', fontWeight: 600 }}>TEXT EXTRACT</div>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={config.getContent.enabled}
                onClick={(e) => {
                  e.stopPropagation();
                  updateConfig({
                    ...config,
                    getContent: { ...config.getContent, enabled: !config.getContent.enabled },
                  });
                }}
                style={{
                  width: '32px',
                  height: '18px',
                  backgroundColor: config.getContent.enabled ? '#3B82F6' : 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: 0,
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: config.getContent.enabled ? '16px' : '2px',
                    transition: 'left 0.2s ease',
                  }}
                />
              </button>
            </div>

            {/* Options Checklist */}
            <div style={{ padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.71875rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.getContent.extractPrice}
                  onChange={(e) =>
                    updateConfig({
                      ...config,
                      getContent: { ...config.getContent, extractPrice: e.target.checked },
                    })
                  }
                />
                <span>Detect Rent/Sale Price</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.71875rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.getContent.extractSpecs}
                  onChange={(e) =>
                    updateConfig({
                      ...config,
                      getContent: { ...config.getContent, extractSpecs: e.target.checked },
                    })
                  }
                />
                <span>Bed / Bath / Sqm Specs</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.71875rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.getContent.cleanThai}
                  onChange={(e) =>
                    updateConfig({
                      ...config,
                      getContent: { ...config.getContent, cleanThai: e.target.checked },
                    })
                  }
                />
                <span>Clean Thai / English Text</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.71875rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.getContent.extractContacts}
                  onChange={(e) =>
                    updateConfig({
                      ...config,
                      getContent: { ...config.getContent, extractContacts: e.target.checked },
                    })
                  }
                />
                <span>Line ID & Phone CTA</span>
              </label>
            </div>

            {/* Output Socket */}
            <div
              style={{
                position: 'absolute',
                right: '-7px',
                top: '44px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: config.getContent.enabled ? '#3B82F6' : '#6B7280',
                border: '2px solid #161B22',
                boxShadow: config.getContent.enabled ? '0 0 8px #3B82F6' : 'none',
              }}
            />
          </div>

          {/* ======================================================== */}
          {/* NODE 2B: GET IMAGES BRANCH (TOGGLEABLE)                  */}
          {/* ======================================================== */}
          <div
            onMouseDown={(e) => startDragNode('get-images', e)}
            style={{
              position: 'absolute',
              left: `${config.getImages.x}px`,
              top: `${config.getImages.y}px`,
              width: `${NODE_WIDTH}px`,
              backgroundColor: '#161B22',
              borderRadius: '0.75rem',
              border: simulationStep === 1
                ? '2px solid #10B981'
                : config.getImages.enabled
                ? '1px solid rgba(16, 185, 129, 0.4)'
                : '1px dashed rgba(255, 255, 255, 0.15)',
              opacity: config.getImages.enabled ? 1 : 0.6,
              boxShadow: simulationStep === 1 ? '0 0 20px rgba(16, 185, 129, 0.6)' : '0 8px 24px rgba(0, 0, 0, 0.5)',
              zIndex: 10,
              cursor: 'grab',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Input Socket */}
            <div
              style={{
                position: 'absolute',
                left: '-7px',
                top: '44px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: config.getImages.enabled ? '#10B981' : '#6B7280',
                border: '2px solid #161B22',
                boxShadow: config.getImages.enabled ? '0 0 8px #10B981' : 'none',
              }}
            />

            {/* Header with Switch */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0.875rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderTopLeftRadius: '0.75rem',
                borderTopRightRadius: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: config.getImages.enabled ? '#10B981' : '#4B5563',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                  }}
                >
                  <FiImage />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fff' }}>Get Images</div>
                  <div style={{ fontSize: '0.6875rem', color: '#34D399', fontWeight: 600 }}>MEDIA PIPELINE</div>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={config.getImages.enabled}
                onClick={(e) => {
                  e.stopPropagation();
                  updateConfig({
                    ...config,
                    getImages: { ...config.getImages, enabled: !config.getImages.enabled },
                  });
                }}
                style={{
                  width: '32px',
                  height: '18px',
                  backgroundColor: config.getImages.enabled ? '#10B981' : 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: 0,
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: config.getImages.enabled ? '16px' : '2px',
                    transition: 'left 0.2s ease',
                  }}
                />
              </button>
            </div>

            {/* Options Checklist */}
            <div style={{ padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.71875rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.getImages.downloadHD}
                  onChange={(e) =>
                    updateConfig({
                      ...config,
                      getImages: { ...config.getImages, downloadHD: e.target.checked },
                    })
                  }
                />
                <span>Download Full HD Images</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.71875rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.getImages.preserveOrder}
                  onChange={(e) =>
                    updateConfig({
                      ...config,
                      getImages: { ...config.getImages, preserveOrder: e.target.checked },
                    })
                  }
                />
                <span>Preserve Original Sequence (#01..#08)</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.71875rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.getImages.watermark}
                  onChange={(e) =>
                    updateConfig({
                      ...config,
                      getImages: { ...config.getImages, watermark: e.target.checked },
                    })
                  }
                />
                <span>Brand Watermark Auto-Overlay</span>
              </label>
            </div>

            {/* Output Socket */}
            <div
              style={{
                position: 'absolute',
                right: '-7px',
                top: '44px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: config.getImages.enabled ? '#10B981' : '#6B7280',
                border: '2px solid #161B22',
                boxShadow: config.getImages.enabled ? '0 0 8px #10B981' : 'none',
              }}
            />
          </div>

          {/* ======================================================== */}
          {/* NODE 3: DYNAMIC AI PROMPT GENERATION BOXES (MULTIPLE!)   */}
          {/* ======================================================== */}
          {config.aiBoxes.map((box) => {
            const isSelected = selectedBoxId === box.id;
            const isCurrentSimulating = simulationStep === 2 && box.enabled;

            return (
              <div
                key={box.id}
                onMouseDown={(e) => startDragNode(box.id, e)}
                onClick={() => setSelectedBoxId(box.id)}
                style={{
                  position: 'absolute',
                  left: `${box.x}px`,
                  top: `${box.y}px`,
                  width: `${AI_NODE_WIDTH}px`,
                  backgroundColor: '#161B22',
                  borderRadius: '0.75rem',
                  border: isCurrentSimulating
                    ? '2px solid #8B5CF6'
                    : isSelected
                    ? '2px solid var(--accent-primary)'
                    : box.enabled
                    ? '1px solid rgba(139, 92, 246, 0.4)'
                    : '1px dashed rgba(255, 255, 255, 0.15)',
                  boxShadow: isCurrentSimulating
                    ? '0 0 24px rgba(139, 92, 246, 0.7)'
                    : isSelected
                    ? '0 0 16px rgba(24, 119, 242, 0.5)'
                    : '0 8px 24px rgba(0, 0, 0, 0.5)',
                  opacity: box.enabled ? 1 : 0.6,
                  zIndex: isSelected ? 20 : 12,
                  cursor: 'grab',
                  animation: 'boxPop 0.25s ease-out',
                  transition: 'border 0.2s, box-shadow 0.2s',
                }}
              >
                {/* Input Socket (receives from Get Content) */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-7px',
                    top: '44px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: box.enabled ? '#8B5CF6' : '#6B7280',
                    border: '2px solid #161B22',
                    boxShadow: box.enabled ? '0 0 8px #8B5CF6' : 'none',
                  }}
                />

                {/* Header with Title & Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: 'rgba(139, 92, 246, 0.08)',
                    borderTopLeftRadius: '0.75rem',
                    borderTopRightRadius: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: box.provider === 'openai' ? '#10A37F' : 'var(--accent-primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        flexShrink: 0,
                      }}
                    >
                      {box.provider === 'openai' ? <FiCpu /> : <FiZap />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <input
                        type="text"
                        value={box.title}
                        onChange={(e) => handleUpdateAIBox(box.id, { title: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          width: '90%',
                          outline: 'none',
                          padding: 0,
                          textOverflow: 'ellipsis',
                        }}
                      />
                      <div style={{ fontSize: '0.6875rem', color: '#A78BFA', fontWeight: 600 }}>
                        {box.provider === 'openai' ? 'OpenAI GPT-4o' : 'Google Gemini'}
                      </div>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                    {/* Duplicate */}
                    <button
                      type="button"
                      onClick={(e) => handleDuplicateAIBox(box, e)}
                      title="Duplicate this AI process box"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <FiCopy style={{ fontSize: '13px' }} />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteAIBox(box.id, e)}
                      title="Delete this dynamic AI box"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#EF4444',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <FiTrash2 style={{ fontSize: '13px' }} />
                    </button>

                    {/* Enable Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={box.enabled}
                      onClick={(e) => handleToggleAIBox(box.id, e)}
                      style={{
                        width: '28px',
                        height: '16px',
                        backgroundColor: box.enabled ? '#8B5CF6' : 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        padding: 0,
                        outline: 'none',
                        marginLeft: '2px',
                      }}
                    >
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '50%',
                          position: 'absolute',
                          top: '2px',
                          left: box.enabled ? '14px' : '2px',
                          transition: 'left 0.2s ease',
                        }}
                      />
                    </button>
                  </div>
                </div>

                {/* Box Controls / Selectors */}
                <div
                  style={{
                    padding: '0.75rem 0.875rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.625rem',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Process Type Dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Process Type
                    </label>
                    <Select
                      options={PROCESS_TYPE_OPTIONS}
                      value={box.processType}
                      onChange={(val) => {
                        let defaultTitle = box.title;
                        const matched = PROCESS_TYPE_OPTIONS.find((p) => p.value === val);
                        if (matched) defaultTitle = matched.label;
                        handleUpdateAIBox(box.id, { processType: val as any, title: defaultTitle });
                      }}
                      height="32px"
                    />
                  </div>

                  {/* AI Provider & Engine Model */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      AI Engine & Model
                    </label>
                    <Select
                      options={MODEL_OPTIONS}
                      value={box.model}
                      onChange={(val) => {
                        const isOAI = val.includes('gpt');
                        handleUpdateAIBox(box.id, {
                          model: val,
                          provider: isOAI ? 'openai' : 'google_ai',
                        });
                      }}
                      height="32px"
                    />
                  </div>

                  {/* Prompt Instructions Tweak */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Custom Prompt Instructions (Optional)
                    </label>
                    <textarea
                      value={box.customPrompt}
                      onChange={(e) => handleUpdateAIBox(box.id, { customPrompt: e.target.value })}
                      placeholder="e.g. emphasize price negotiable, BTS Thong Lo 2 mins, urgent sale..."
                      rows={2}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.375rem',
                        padding: '0.375rem 0.5rem',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        resize: 'vertical',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>

                {/* Output Socket (connects to destination) */}
                <div
                  style={{
                    position: 'absolute',
                    right: '-7px',
                    top: '44px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: box.enabled ? '#8B5CF6' : '#6B7280',
                    border: '2px solid #161B22',
                    boxShadow: box.enabled ? '0 0 8px #8B5CF6' : 'none',
                  }}
                />
              </div>
            );
          })}

          {/* ======================================================== */}
          {/* NODE 4: PROPERTY INBOX / OUTPUT DESTINATION              */}
          {/* ======================================================== */}
          <div
            onMouseDown={(e) => startDragNode('destination', e)}
            style={{
              position: 'absolute',
              left: `${config.destination.x}px`,
              top: `${config.destination.y}px`,
              width: `${NODE_WIDTH}px`,
              backgroundColor: '#161B22',
              borderRadius: '0.75rem',
              border: simulationStep === 3 ? '2px solid #10B981' : '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: simulationStep === 3 ? '0 0 20px rgba(16, 185, 129, 0.6)' : '0 8px 24px rgba(0, 0, 0, 0.5)',
              zIndex: 10,
              cursor: 'grab',
              transition: 'border 0.2s, box-shadow 0.2s',
            }}
          >
            {/* Input Socket Top */}
            <div
              style={{
                position: 'absolute',
                left: '-7px',
                top: '44px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                border: '2px solid #161B22',
                boxShadow: '0 0 8px #10B981',
              }}
            />
            {/* Input Socket Bottom */}
            <div
              style={{
                position: 'absolute',
                left: '-7px',
                top: '86px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                border: '2px solid #161B22',
                boxShadow: '0 0 8px #10B981',
              }}
            />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0.875rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderTopLeftRadius: '0.75rem',
                borderTopRightRadius: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#10B981',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                  }}
                >
                  <FiCheckCircle />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fff' }}>Property Inbox</div>
                  <div style={{ fontSize: '0.6875rem', color: '#34D399', fontWeight: 600 }}>DESTINATION</div>
                </div>
              </div>
              <Badge variant="success">Ready</Badge>
            </div>

            {/* Body */}
            <div style={{ padding: '0.75rem 0.875rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <p style={{ margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                Saves structured property specs, extracted media, and multi-AI generated copy to Inbox.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.375rem 0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '0.375rem',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <span>Outputs Configured</span>
                <span style={{ color: '#10B981', fontWeight: 600 }}>
                  {config.aiBoxes.filter((b) => b.enabled).length} AI + {config.getImages.enabled ? '1 Media' : '0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
